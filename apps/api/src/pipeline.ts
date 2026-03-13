import {
  CertificateSchema,
  VERDICT_ONCHAIN,
  canonicalIntentId,
  executorBinding,
  hashCanonical,
  intentHashPayload,
  settlementBinding,
  type IntentEnvelope,
  type ProposedAction,
  type SettlementCall,
} from "@intentos/schema";
import { verifyAction } from "@intentos/verifier";
import {
  FailClosedError,
  INTENT_REGISTRY_ABI,
  SETTLEMENT_TARGET_ABI,
  VERIFICATION_METER_ABI,
  downloadJson,
  publicClient,
  signVerificationAttestation,
  uploadJson,
  waitForReceipt,
  walletFromKey,
  type RouterConfig,
} from "@intentos/zerog";
import { encodeFunctionData, keccak256, toBytes } from "viem";
import { config } from "./config.js";
import { prisma } from "./db.js";

export function optionalTxHash(value?: string): `0x${string}` | undefined {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value)) return undefined;
  return value as `0x${string}`;
}

export function assertTeeAttested(evidence?: { teeAttested?: boolean; providerAddress?: string }) {
  if (evidence?.teeAttested) return;
  throw new FailClosedError(
    "tee_required",
    "Layer 2 compute evidence is not TEE-attested. Refusing to recordVerification.",
    502,
  );
}

export function defaultExecutorSettlement(amountWei: string): SettlementCall | undefined {
  if (!config.settlementTarget) return undefined;
  return {
    target: config.settlementTarget,
    calldata: encodeFunctionData({ abi: SETTLEMENT_TARGET_ABI, functionName: "ping", args: ["0x01"] }),
    valueWei: amountWei || "0",
  };
}

export async function recordAttestation(args: {
  intent: IntentEnvelope;
  actionHash: `0x${string}`;
  evidenceRoot: `0x${string}`;
  verdict: string;
  alignmentBps: number;
  confidenceBps: number;
  amountWei: string;
  settlement?: SettlementCall;
}) {
  if (!config.oracleKey || !config.registry) {
    throw new FailClosedError("attest_unconfigured", "oracle key or registry not configured", 503);
  }
  const intentHash = canonicalIntentId(args.intent);
  const intentId = intentHash;
  const amount = BigInt(args.amountWei || "0");
  const binding = args.settlement
    ? executorBinding({
        intentId,
        actionHash: args.actionHash,
        target: args.settlement.target as `0x${string}`,
        calldata: args.settlement.calldata as `0x${string}`,
        value: BigInt(args.settlement.valueWei || "0"),
      })
    : settlementBinding({ intentId, actionHash: args.actionHash, amount });
  const { account, wallet, chain, chainId } = walletFromKey(config.oracleKey, config.network, config.rpc);
  const client = publicClient(config.network, config.rpc);
  const nonce = await client.readContract({
    address: config.registry,
    abi: INTENT_REGISTRY_ABI,
    functionName: "intentNonce",
    args: [intentId],
  });
  const expiry = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const verdict =
    args.verdict === "APPROVE"
      ? VERDICT_ONCHAIN.APPROVE
      : args.verdict === "REJECT"
        ? VERDICT_ONCHAIN.REJECT
        : VERDICT_ONCHAIN.CHALLENGE;
  const sig = await signVerificationAttestation(account, chainId, config.registry, {
    intentId,
    intentHash,
    agentId: args.intent.agent.agenticId as `0x${string}`,
    actionHash: args.actionHash,
    evidenceRoot: args.evidenceRoot,
    verdict,
    alignmentBps: args.alignmentBps,
    confidenceBps: args.confidenceBps,
    nonce,
    expiry,
    settlementBinding: binding,
  });
  const hash = await wallet.writeContract({
    address: config.registry,
    abi: INTENT_REGISTRY_ABI,
    functionName: "recordVerification",
    args: [
      intentId,
      {
        actionHash: args.actionHash,
        evidenceRoot: args.evidenceRoot,
        verdict,
        alignmentBps: args.alignmentBps,
        confidenceBps: args.confidenceBps,
        timestamp: 0n,
        settlementBinding: binding,
      },
      nonce,
      expiry,
      intentHash,
      args.intent.agent.agenticId as `0x${string}`,
      sig,
    ],
    chain,
    account,
  });
  const receipt = await waitForReceipt(client, hash);
  if (receipt.status !== "success") {
    throw new FailClosedError(
      "attest_reverted",
      `recordVerification reverted on-chain (${hash}). Settlement will not see an APPROVE.`,
      502,
    );
  }
  return { ok: true as const, txHash: hash, explorer: `${config.explorer}/tx/${hash}`, settlementBinding: binding };
}

export async function upsertCertificate(
  intent: IntentEnvelope,
  action: ProposedAction,
  result: {
    verdict: string;
    alignmentScore: number;
    confidence: number;
    checks: { severity: string; result: string }[];
    actionHash: string;
    computeEvidence?: { providerAddress?: string; teeAttested?: boolean };
  },
  evidenceRoot: string,
  txs: { registerTxHash?: `0x${string}`; verifyTxHash?: `0x${string}` } = {},
) {
  const existing = await prisma.certificateRow.findUnique({ where: { actionHash: result.actionHash } });
  const hardViolations = result.checks.filter((c) => c.severity === "hard" && c.result === "FAIL").length;
  const cap = intent.constraints.hard.find((c) => c.type === "max_capital");
  const dur = intent.constraints.hard.find((c) => c.type === "max_duration");
  const onchainIntentId = canonicalIntentId(intent);
  const payload = CertificateSchema.parse({
    serial: existing?.id ?? 0,
    intentId: onchainIntentId,
    intentHash: onchainIntentId,
    actionHash: result.actionHash as `0x${string}`,
    decisionHash: hashCanonical({
      intentId: onchainIntentId,
      actionHash: result.actionHash,
      verdict: result.verdict,
      evidenceRoot,
    }),
    evidenceRoot: evidenceRoot as `0x${string}`,
    principal: intent.principal.wallet,
    agentId: intent.agent.agenticId,
    objective: intent.objective.description,
    requestedCapital: cap && cap.type === "max_capital" ? `${cap.value} ${cap.currency}` : "—",
    actualCapital: `${action.params.capital} ${action.params.currency}`,
    requestedDuration: dur && dur.type === "max_duration" ? `${dur.value} ${dur.unit}` : "—",
    actualDuration: action.params.durationDays ? `${action.params.durationDays} days` : "—",
    leverage: String(action.params.leverage),
    risk: action.params.riskClass,
    alignmentScore: result.alignmentScore,
    confidence: result.confidence,
    hardViolations,
    verdict: result.verdict,
    timestamp: Math.floor(Date.now() / 1000),
    chainId: intent.chainId,
    explorerUrl: config.explorer,
    storageRoot: evidenceRoot as `0x${string}`,
    computeProvider: result.computeEvidence?.providerAddress,
    teeAttested: result.computeEvidence?.teeAttested,
    registerTxHash: txs.registerTxHash,
    verifyTxHash: txs.verifyTxHash,
    agenticToken: config.agenticToken || undefined,
    agenticUri: config.agenticId && config.agenticToken ? `${config.explorer}/token/${config.agenticId}?a=${config.agenticToken}` : undefined,
  });

  if (existing) {
    await prisma.certificateRow.update({
      where: { actionHash: result.actionHash },
      data: {
        intentId: onchainIntentId,
        payloadJson: JSON.stringify({ ...payload, serial: existing.id }),
      },
    });
    return { ...payload, serial: existing.id };
  }
  const created = await prisma.certificateRow.create({
    data: { intentId: onchainIntentId, actionHash: result.actionHash, payloadJson: "{}" },
  });
  const withSerial = { ...payload, serial: created.id };
  await prisma.certificateRow.update({
    where: { id: created.id },
    data: { payloadJson: JSON.stringify(withSerial) },
  });
  return withSerial;
}

async function debitMeter(payer: `0x${string}`, intentId: `0x${string}`) {
  if (!config.meter || !config.deployerKey) return { ok: false as const, skipped: true as const };
  const client = publicClient(config.network, config.rpc);
  const price = await client.readContract({
    address: config.meter,
    abi: VERIFICATION_METER_ABI,
    functionName: "priceWei",
  });
  const amount = price > 0n ? price : config.verifyPriceWei;
  const credits = await client.readContract({
    address: config.meter,
    abi: VERIFICATION_METER_ABI,
    functionName: "credits",
    args: [payer],
  });
  if (credits < amount) {
    throw new FailClosedError(
      "meter_unpaid",
      `VerificationMeter: ${payer} has ${credits} credits, need ${amount}. Deposit 0G first.`,
      402,
    );
  }
  const { account, wallet, chain } = walletFromKey(config.deployerKey, config.network, config.rpc);
  const hash = await wallet.writeContract({
    address: config.meter,
    abi: VERIFICATION_METER_ABI,
    functionName: "debit",
    args: [payer, amount, intentId],
    chain,
    account,
  });
  const receipt = await waitForReceipt(client, hash);
  if (receipt.status !== "success") {
    throw new FailClosedError("meter_debit_failed", `VerificationMeter.debit reverted (${hash})`, 502);
  }
  return { ok: true as const, skipped: false as const, txHash: hash, amount: amount.toString() };
}

export async function flushBatchLog(force = false) {
  const pending = await prisma.logEvent.findMany({ where: { batchId: null }, orderBy: { ts: "asc" } });
  if (pending.length === 0) return null;
  if (!force && pending.length < 3) return null;
  if (!config.deployerKey || !config.storageUpload) return null;
  const events = pending.map((e) => ({
    ts: e.ts,
    intentId: e.intentId,
    actionHash: e.actionHash,
    verdict: e.verdict,
    evidenceRoot: e.evidenceRoot,
    verifyTx: e.verifyTx,
  }));
  const uploaded = await uploadJson({ network: config.network, privateKey: config.deployerKey }, { version: "1", events });
  const root = (uploaded.rootHash.startsWith("0x") ? uploaded.rootHash : `0x${uploaded.rootHash}`) as string;
  const batch = await prisma.executionBatch.create({
    data: {
      root,
      fromTs: pending[0]!.ts,
      toTs: pending[pending.length - 1]!.ts,
      count: pending.length,
      eventsJson: JSON.stringify(events),
    },
  });
  await prisma.logEvent.updateMany({
    where: { id: { in: pending.map((e) => e.id) } },
    data: { batchId: batch.id },
  });
  await prisma.verification.updateMany({
    where: { actionHash: { in: pending.map((e) => e.actionHash) } },
    data: { batchId: batch.id },
  });
  return batch;
}

export async function runVerification(args: {
  intent: IntentEnvelope;
  action: ProposedAction;
  router: RouterConfig;
  sourceText?: string;
  amountWei: string;
  registerTx?: string;
  payer?: string;
  mode: "human" | "a2a" | "step";
  execute?: boolean;
}) {
  let action = args.action;
  if (args.execute) {
    const settlement = action.settlement ?? defaultExecutorSettlement(args.amountWei);
    if (!settlement || !config.executor) {
      throw new FailClosedError(
        "executor_unconfigured",
        "execute=true requires INTENT_EXECUTOR_ADDRESS and SETTLEMENT_TARGET_ADDRESS (or action.settlement).",
        503,
      );
    }
    action = { ...action, settlement };
  }

  const verified = await verifyAction({
    intent: args.intent,
    action,
    router: args.router,
    sourceText: args.sourceText,
  });
  const { result, evidence } = verified;
  assertTeeAttested(result.computeEvidence);

  const intentRow = await prisma.intent.findUnique({ where: { id: args.intent.intentId } });
  if (intentRow?.envelopeRoot) {
    evidence.envelopeRoot = intentRow.envelopeRoot;
  }

  const contentHash = hashCanonical(evidence);
  if (!config.deployerKey || config.deployerKey.length !== 66) {
    throw new FailClosedError("missing_deployer", "DEPLOYER_PRIVATE_KEY is required to pay 0G Storage upload fees.", 503);
  }
  const uploaded = await uploadJson({ network: config.network, privateKey: config.deployerKey }, evidence);
  const evidenceRoot = (
    uploaded.rootHash.startsWith("0x") ? uploaded.rootHash : `0x${uploaded.rootHash}`
  ) as `0x${string}`;
  result.evidenceRoot = evidenceRoot;

  await prisma.intent.upsert({
    where: { id: args.intent.intentId },
    create: {
      id: args.intent.intentId,
      intentHash: args.intent.integrity?.contentHash ?? hashCanonical(intentHashPayload(args.intent)),
      principal: args.intent.principal.wallet,
      envelopeJson: JSON.stringify(args.intent),
      sourceText: args.sourceText ?? "",
      envelopeRoot: intentRow?.envelopeRoot ?? undefined,
      status: args.intent.status,
    },
    update: {},
  });

  const registerTx = optionalTxHash(args.registerTx);
  const payer = (args.payer && /^0x[0-9a-fA-F]{40}$/.test(args.payer)
    ? args.payer
    : args.intent.principal.wallet) as `0x${string}`;
  const intentId = canonicalIntentId(args.intent);

  const meter = await debitMeter(payer, intentId);

  const row = await prisma.verification.create({
    data: {
      intentId: args.intent.intentId,
      actionHash: result.actionHash,
      verdict: result.verdict,
      evidenceRoot,
      resultJson: JSON.stringify({ ...result, contentHash }),
      evidenceJson: JSON.stringify(evidence),
      actionJson: JSON.stringify(action),
      registerTx,
      payer,
      meterTx: meter.ok ? meter.txHash : undefined,
      mode: args.mode,
    },
  });

  const cert = await upsertCertificate(args.intent, action, result, evidenceRoot, {
    registerTxHash: registerTx,
  });

  let attest: { ok: boolean; txHash?: string; explorer?: string; error?: string; code?: string } | null = null;
  if (config.oracleKey && config.registry) {
    try {
      attest = await recordAttestation({
        intent: args.intent,
        actionHash: result.actionHash as `0x${string}`,
        evidenceRoot,
        verdict: result.verdict,
        alignmentBps: Math.round(result.alignmentScore * 10_000),
        confidenceBps: Math.round(result.confidence * 10_000),
        amountWei: args.amountWei,
        settlement: args.execute ? action.settlement : undefined,
      });
      if (attest.txHash) {
        await prisma.verification.update({ where: { id: row.id }, data: { verifyTx: attest.txHash } });
        const withTx = { ...cert, verifyTxHash: attest.txHash };
        await prisma.certificateRow.update({
          where: { actionHash: result.actionHash },
          data: { payloadJson: JSON.stringify(withTx) },
        });
        Object.assign(cert, withTx);
      }
    } catch (err) {
      attest = {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        code: err instanceof FailClosedError ? err.code : "attest_failed",
      };
    }
  } else {
    attest = {
      ok: false,
      error: "Oracle key or IntentRegistry missing — cannot recordVerification",
      code: "attest_unconfigured",
    };
  }

  await prisma.logEvent.create({
    data: {
      ts: Math.floor(Date.now() / 1000),
      intentId,
      actionHash: result.actionHash,
      verdict: result.verdict,
      evidenceRoot,
      verifyTx: attest?.txHash,
    },
  });
  const batch = await flushBatchLog(false);

  const executeAfter = Math.floor(Date.now() / 1000) + (Number.isFinite(config.challengeDelay) ? config.challengeDelay : 900);

  return {
    result,
    evidenceRoot,
    contentHash,
    envelopeRoot: evidence.envelopeRoot ?? intentRow?.envelopeRoot ?? null,
    storageUploaded: true,
    verificationId: row.id,
    certificate: cert,
    attest,
    meter,
    batchRoot: batch?.root ?? null,
    vault: {
      address: config.vault || null,
      approved: result.verdict === "APPROVE",
      call: {
        intentId,
        actionHash: result.actionHash,
        valueWei: args.amountWei,
      },
    },
    executor:
      args.execute && config.executor && action.settlement
        ? {
            address: config.executor,
            approved: result.verdict === "APPROVE",
            executeAfter,
            challengeDelay: config.challengeDelay,
            call: {
              intentId,
              actionHash: result.actionHash,
              target: action.settlement.target,
              data: action.settlement.calldata,
              valueWei: action.settlement.valueWei,
            },
          }
        : undefined,
  };
}

export function reputationScore(verdict: string): bigint {
  if (verdict === "APPROVE") return 1n;
  if (verdict === "REJECT") return -1n;
  return 0n;
}

export function evidenceContentHash(evidence: unknown): `0x${string}` {
  return hashCanonical(evidence);
}

export { keccak256, toBytes, downloadJson };
