import Fastify, { type FastifyReply } from "fastify";
import cors from "@fastify/cors";
import { encodeAbiParameters, formatEther, isAddress, keccak256, toBytes } from "viem";
import {
  DEMO_INTENT_TEXT,
  IntentEnvelopeSchema,
  PLAYBOOK_STEPS,
  ProposedActionSchema,
  canonicalIntentId,
  hashCanonical,
  intentHashPayload,
  toBytes32AgentId,
  type IntentEnvelope,
} from "@intentos/schema";
import { compileIntent } from "@intentos/verifier";
import { proposeAction, REFERENCE_AGENT, normalizeProposeMode } from "@intentos/agent-sdk";
import {
  AGENTIC_ID_ABI,
  AGENTIC_ID_V2_ABI,
  FailClosedError,
  INTENT_REGISTRY_ABI,
  VERIFICATION_METER_ABI,
  downloadJson,
  isFailClosedError,
  listTeeModels,
  pickChatRouterModel,
  publicClient,
  routerModelsFromList,
  uploadJson,
  walletFromKey,
  type RouterConfig,
} from "@intentos/zerog";
import { config } from "./config.js";
import { prisma } from "./db.js";
import {
  flushBatchLog,
  optionalTxHash,
  recordAttestation,
  runVerification,
} from "./pipeline.js";

function routerCfg(): RouterConfig | undefined {
  if (!config.routerApiKey) return undefined;
  return {
    network: config.network,
    apiKey: config.routerApiKey,
    model: config.routerModel,
    baseUrl: config.routerUrl,
  };
}

function failClosed(reply: FastifyReply, err: unknown) {
  if (isFailClosedError(err)) {
    const status = typeof err.status === "number" ? err.status : 503;
    return reply.code(status).send({ error: err.message, code: err.code });
  }
  const raw = err instanceof Error ? err.message : String(err);
  const message = raw.replace(/\s*Version: viem@[\d.]+\s*/g, "").trim();
  return reply.code(500).send({ error: message, code: "internal" });
}

function requirePrincipal(value: unknown): `0x${string}` | null {
  if (typeof value !== "string" || !isAddress(value) || /^0x0{40}$/i.test(value)) return null;
  if (value.toLowerCase() === "0x1111111111111111111111111111111111111111") return null;
  return value as `0x${string}`;
}

function requireAgentId(): `0x${string}` | null {
  if (!config.agentIdRaw) return null;
  return toBytes32AgentId(config.agentIdRaw);
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function bytecodeLive(address: string): Promise<boolean> {
  if (!isAddress(address)) return false;
  const client = publicClient(config.network, config.rpc);
  const code = await withTimeout(
    client.getBytecode({ address: address as `0x${string}` }),
    8000,
    `bytecode ${address}`,
  );
  return Boolean(code && code !== "0x");
}

type ReadyCheck = {
  id: string;
  ok: boolean;
  required: boolean;
  detail: string;
  hint?: string;
};

async function runVerifyRoute(
  _req: unknown,
  reply: FastifyReply,
  body: {
    intent?: unknown;
    action?: unknown;
    sourceText?: string;
    amountWei?: string;
    registerTx?: string;
    payer?: string;
    execute?: boolean;
  },
  mode: "human" | "a2a" | "step",
) {
  const intentParsed = IntentEnvelopeSchema.safeParse(body.intent);
  const actionParsed = ProposedActionSchema.safeParse(body.action);
  if (!intentParsed.success) return reply.code(400).send({ error: intentParsed.error.flatten(), code: "invalid_intent" });
  if (!actionParsed.success) return reply.code(400).send({ error: actionParsed.error.flatten(), code: "invalid_action" });
  const router = routerCfg();
  if (!router) {
    return reply.code(503).send({
      error: `Verify requires ZEROG_ROUTER_API_KEY. Layer 2 cannot be skipped.`,
      code: "missing_router_key",
    });
  }
  if (!config.storageUpload) {
    return reply.code(503).send({
      error: "ZEROG_STORAGE_UPLOAD must be 1. Local keccak commitments are disabled.",
      code: "storage_disabled",
    });
  }
  try {
    return await runVerification({
      intent: intentParsed.data,
      action: actionParsed.data,
      router,
      sourceText: body.sourceText,
      amountWei: body.amountWei ?? "0",
      registerTx: body.registerTx,
      payer: body.payer,
      mode,
      execute: Boolean(body.execute || actionParsed.data.settlement),
    });
  } catch (err) {
    return failClosed(reply, err);
  }
}

export async function buildServer() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  app.get("/", async () => ({
    service: "intentos-api",
    ok: true,
    docs: "This host is the compile/verify API. The landing page is the Vercel web app.",
    health: "/health",
    ready: "/ready",
    meta: "/meta",
  }));

  app.get("/health", async () => ({
    ok: true,
    network: config.network,
    chainId: config.chainId,
    registry: config.registry || null,
    vault: config.vault || null,
    router: Boolean(config.routerApiKey),
    storageUpload: config.storageUpload,
    agent: REFERENCE_AGENT,
    demoIntent: DEMO_INTENT_TEXT,
  }));

  app.get("/ready", async () => {
    const checks: ReadyCheck[] = [];

    checks.push({
      id: "router_key",
      ok: Boolean(config.routerApiKey),
      required: true,
      detail: config.routerApiKey ? "ZEROG_ROUTER_API_KEY is set" : "ZEROG_ROUTER_API_KEY is missing",
      hint: `Create an sk- key at ${config.routerUi} → Dashboard → API Keys`,
    });

    if (config.routerApiKey) {
      try {
        const listed = await withTimeout(listTeeModels(routerCfg()!), 8000, "router models");
        const ids = routerModelsFromList(listed).map((m) => m.id);
        const chat = pickChatRouterModel(listed, config.routerModel);
        const pinned = ids.includes(config.routerModel);
        checks.push({
          id: "router_live",
          ok: pinned,
          required: true,
          detail: pinned
            ? `0G Router reachable (${config.routerModel})`
            : `ZEROG_ROUTER_MODEL=${config.routerModel} is not on this Router. Available: ${ids.join(", ") || "(none)"}`,
          hint: pinned
            ? undefined
            : `Set ZEROG_ROUTER_MODEL=${chat ?? "a chat model from GET /v1/models"}`,
        });
        const pinnedModel = routerModelsFromList(listed).find((m) => m.id === config.routerModel);
        checks.push({
          id: "tee_model",
          ok: pinnedModel?.tee_attested === true,
          required: false,
          detail:
            pinnedModel?.tee_attested === true
              ? `${config.routerModel} reports tee_attested`
              : pinnedModel?.tee_attested === false
                ? `${config.routerModel} is not tee_attested`
                : `${config.routerModel} did not report tee_attested — verify still requires Layer 2 TEE evidence`,
        });
      } catch (err) {
        checks.push({
          id: "router_live",
          ok: false,
          required: true,
          detail: err instanceof Error ? err.message : String(err),
          hint: `Deposit 0G on ${config.routerUi} and confirm the key has inference permission`,
        });
      }
    } else {
      checks.push({
        id: "router_live",
        ok: false,
        required: true,
        detail: "Skipped — no Router key",
        hint: `Create an sk- key at ${config.routerUi}`,
      });
    }

    checks.push({
      id: "deployer_key",
      ok: Boolean(config.deployerKey && config.deployerKey.length === 66),
      required: true,
      detail: config.deployerKey ? "DEPLOYER_PRIVATE_KEY is set" : "DEPLOYER_PRIVATE_KEY is missing",
      hint: "Run pnpm provision, then fund the deployer from https://faucet.0g.ai",
    });

    checks.push({
      id: "oracle_key",
      ok: Boolean(config.oracleKey && config.oracleKey.length === 66),
      required: true,
      detail: config.oracleKey ? "VERIFIER_ORACLE_PRIVATE_KEY is set" : "VERIFIER_ORACLE_PRIVATE_KEY is missing",
      hint: "Fund the oracle wallet, then deploy so it receives VERIFIER_ROLE",
    });

    checks.push({
      id: "storage_upload",
      ok: config.storageUpload,
      required: true,
      detail: config.storageUpload ? "ZEROG_STORAGE_UPLOAD=1" : "ZEROG_STORAGE_UPLOAD is not 1",
      hint: "Set ZEROG_STORAGE_UPLOAD=1 after the deployer has gas for storage fees",
    });

    checks.push({
      id: "agent_id",
      ok: Boolean(config.agentIdRaw),
      required: true,
      detail: config.agentIdRaw ? `AGENT_ID=${config.agentIdRaw}` : "AGENT_ID is not set",
      hint: "pnpm --filter @intentos/contracts register-agent:galileo and copy the returned id",
    });

    if (config.registry) {
      try {
        const live = await bytecodeLive(config.registry);
        checks.push({
          id: "registry",
          ok: live,
          required: true,
          detail: live
            ? `IntentRegistry ${config.registry}`
            : `No bytecode at INTENT_REGISTRY_ADDRESS ${config.registry}`,
          hint: live ? undefined : "pnpm contracts:deploy:galileo",
        });
      } catch (err) {
        checks.push({
          id: "registry",
          ok: false,
          required: true,
          detail: err instanceof Error ? err.message : String(err),
          hint: "Check ZEROG_TESTNET_RPC and INTENT_REGISTRY_ADDRESS",
        });
      }
    } else {
      checks.push({
        id: "registry",
        ok: false,
        required: true,
        detail: "INTENT_REGISTRY_ADDRESS is empty",
        hint: "pnpm contracts:deploy:galileo and paste IntentRegistry into .env",
      });
    }

    if (config.vault) {
      try {
        const live = await bytecodeLive(config.vault);
        checks.push({
          id: "vault",
          ok: live,
          required: true,
          detail: live
            ? `DemoVault ${config.vault}`
            : `No bytecode at DEMO_VAULT_ADDRESS ${config.vault}`,
          hint: live ? undefined : "pnpm contracts:deploy:galileo",
        });
      } catch (err) {
        checks.push({
          id: "vault",
          ok: false,
          required: true,
          detail: err instanceof Error ? err.message : String(err),
          hint: "Check DEMO_VAULT_ADDRESS",
        });
      }
    } else {
      checks.push({
        id: "vault",
        ok: false,
        required: true,
        detail: "DEMO_VAULT_ADDRESS is empty",
        hint: "pnpm contracts:deploy:galileo and paste DemoVault into .env",
      });
    }

    const client = publicClient(config.network, config.rpc);
    if (config.oracleKey && config.oracleKey.length === 66) {
      try {
        const { account } = walletFromKey(config.oracleKey, config.network, config.rpc);
        const bal = await withTimeout(
          client.getBalance({ address: account.address }),
          8000,
          "oracle balance",
        );
        checks.push({
          id: "oracle_funded",
          ok: bal > 0n,
          required: true,
          detail: bal > 0n ? `Oracle has ${formatEther(bal)} 0G` : `Oracle ${account.address} has 0 0G`,
          hint: bal > 0n ? undefined : "Fund the oracle from the deployer or https://faucet.0g.ai",
        });
        if (config.registry) {
          try {
            const role = await withTimeout(
              client.readContract({
                address: config.registry,
                abi: INTENT_REGISTRY_ABI,
                functionName: "hasRole",
                args: [keccak256(toBytes("VERIFIER_ROLE")), account.address],
              }),
              8000,
              "oracle role",
            );
            checks.push({
              id: "oracle_role",
              ok: Boolean(role),
              required: true,
              detail: role
                ? `Oracle holds VERIFIER_ROLE`
                : `Oracle ${account.address} is missing VERIFIER_ROLE`,
              hint: role ? undefined : "Redeploy IntentRegistry with this oracle, or grantRole",
            });
          } catch (err) {
            checks.push({
              id: "oracle_role",
              ok: false,
              required: true,
              detail: err instanceof Error ? err.message : String(err),
              hint: "Confirm INTENT_REGISTRY_ADDRESS and that hasRole is available",
            });
          }
        }
      } catch (err) {
        checks.push({
          id: "oracle_funded",
          ok: false,
          required: true,
          detail: err instanceof Error ? err.message : String(err),
          hint: "Check VERIFIER_ORACLE_PRIVATE_KEY",
        });
      }
    }

    if (config.deployerKey && config.deployerKey.length === 66) {
      try {
        const { account } = walletFromKey(config.deployerKey, config.network, config.rpc);
        const bal = await withTimeout(
          client.getBalance({ address: account.address }),
          8000,
          "deployer balance",
        );
        checks.push({
          id: "deployer_funded",
          ok: bal > 0n,
          required: true,
          detail: bal > 0n ? `Deployer has ${formatEther(bal)} 0G` : `Deployer ${account.address} has 0 0G`,
          hint: bal > 0n ? undefined : "Fund the deployer from https://faucet.0g.ai",
        });
      } catch (err) {
        checks.push({
          id: "deployer_funded",
          ok: false,
          required: true,
          detail: err instanceof Error ? err.message : String(err),
          hint: "Check DEPLOYER_PRIVATE_KEY",
        });
      }
    }

    if (config.meter) {
      try {
        const live = await bytecodeLive(config.meter);
        checks.push({
          id: "meter",
          ok: live,
          required: true,
          detail: live ? `VerificationMeter ${config.meter}` : `No bytecode at ${config.meter}`,
        });
        if (live && config.deployerKey) {
          const { account } = walletFromKey(config.deployerKey, config.network, config.rpc);
          const role = await withTimeout(
            publicClient(config.network, config.rpc).readContract({
              address: config.meter,
              abi: VERIFICATION_METER_ABI,
              functionName: "hasRole",
              args: [keccak256(toBytes("SETTLER_ROLE")), account.address],
            }),
            8000,
            "meter settler",
          );
          checks.push({
            id: "meter_settler",
            ok: Boolean(role),
            required: true,
            detail: role ? "Deployer holds SETTLER_ROLE" : "Deployer missing SETTLER_ROLE on meter",
          });
        }
      } catch (err) {
        checks.push({
          id: "meter",
          ok: false,
          required: true,
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    } else {
      checks.push({
        id: "meter",
        ok: false,
        required: false,
        detail: "VERIFICATION_METER_ADDRESS is empty",
        hint: "pnpm --filter @intentos/contracts deploy:wave45:galileo",
      });
    }

    if (config.consumer) {
      checks.push({
        id: "consumer",
        ok: await bytecodeLive(config.consumer).catch(() => false),
        required: true,
        detail: `CertificateConsumer ${config.consumer}`,
      });
    } else {
      checks.push({
        id: "consumer",
        ok: false,
        required: false,
        detail: "CERTIFICATE_CONSUMER_ADDRESS is empty",
      });
    }

    if (config.agenticId && config.agenticToken) {
      try {
        const owner = await withTimeout(
          publicClient(config.network, config.rpc).readContract({
            address: config.agenticId,
            abi: AGENTIC_ID_ABI,
            functionName: "ownerOf",
            args: [BigInt(config.agenticToken)],
          }),
          8000,
          "agentic owner",
        );
        checks.push({
          id: "agentic_id",
          ok: Boolean(owner),
          required: true,
          detail: `Agentic ID #${config.agenticToken} owned by ${owner}`,
        });
      } catch (err) {
        checks.push({
          id: "agentic_id",
          ok: false,
          required: true,
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    } else {
      checks.push({
        id: "agentic_id",
        ok: false,
        required: false,
        detail: "AGENTIC_ID_ADDRESS / AGENTIC_ID_TOKEN not set",
      });
    }

    checks.push({
      id: "requirement_agent",
      ok: Boolean(config.requirementAgentIdRaw),
      required: false,
      detail: config.requirementAgentIdRaw
        ? `REQUIREMENT_AGENT_ID=${config.requirementAgentIdRaw}`
        : "REQUIREMENT_AGENT_ID not set",
    });

    checks.push({
      id: "reputation",
      ok: await bytecodeLive(config.reputationRegistry).catch(() => false),
      required: false,
      detail: `ERC-8004 Reputation ${config.reputationRegistry}`,
    });

    const wave6: Array<{ id: string; address: string; label: string }> = [
      { id: "executor", address: config.executor, label: "IntentExecutor" },
      { id: "settlement_target", address: config.settlementTarget, label: "SettlementTarget" },
      { id: "bounty", address: config.bounty, label: "IntentBounty" },
      { id: "agentic_id_v2", address: config.agenticIdV2, label: "IntentosAgenticIdV2" },
    ];
    for (const item of wave6) {
      if (!item.address) {
        checks.push({
          id: item.id,
          ok: false,
          required: false,
          detail: `${item.label} not set`,
          hint: "pnpm contracts:deploy:wave6:galileo",
        });
        continue;
      }
      const live = await bytecodeLive(item.address).catch(() => false);
      checks.push({
        id: item.id,
        ok: live,
        required: true,
        detail: live ? `${item.label} ${item.address}` : `No bytecode at ${item.address}`,
      });
    }

    return {
      ok: checks.filter((c) => c.required).every((c) => c.ok),
      network: config.network,
      chainId: config.chainId,
      explorer: config.explorer,
      routerUi: config.routerUi,
      checks,
    };
  });

  app.post("/compile", async (req, reply) => {
    const body = req.body as {
      text?: string;
      principal?: string;
      playbook?: boolean;
      agentId?: string;
    };
    if (!body?.text?.trim()) return reply.code(400).send({ error: "text required", code: "text_required" });
    const principal = requirePrincipal(body.principal);
    if (!principal) {
      return reply.code(400).send({
        error: "principal wallet address required — connect MetaMask on 0G. Fake 0x1111… principals are disabled.",
        code: "principal_required",
      });
    }
    const agentId = body.agentId ? toBytes32AgentId(body.agentId) : requireAgentId();
    if (!agentId) {
      return reply.code(503).send({
        error: "AGENT_ID is not configured. Register the agent on ERC-8004 first.",
        code: "missing_agent_id",
      });
    }
    if (!routerCfg()) {
      return reply.code(503).send({
        error: `Compile requires ZEROG_ROUTER_API_KEY. Create an sk- key at ${config.routerUi}.`,
        code: "missing_router_key",
      });
    }

    let nonce = 0;
    if (config.registry) {
      try {
        const onchain = await publicClient(config.network, config.rpc).readContract({
          address: config.registry,
          abi: INTENT_REGISTRY_ABI,
          functionName: "principalNonce",
          args: [principal],
        });
        nonce = Number(onchain);
      } catch (err) {
        return reply.code(502).send({
          error: `Could not read principalNonce from IntentRegistry: ${err instanceof Error ? err.message : String(err)}`,
          code: "nonce_read_failed",
        });
      }
    }

    let compiled;
    try {
      compiled = await compileIntent(
        body.text.trim(),
        {
          principal,
          agentId,
          chainId: config.chainId,
          nonce,
        },
        routerCfg(),
      );
    } catch (err) {
      return failClosed(reply, err);
    }

    if (body.playbook) {
      compiled.envelope.steps = PLAYBOOK_STEPS.map((s) => ({ ...s }));
    }
    const intentHash = hashCanonical(intentHashPayload(compiled.envelope));
    compiled.envelope.integrity = { contentHash: intentHash };
    compiled.envelope.status = compiled.challenge ? "DRAFT" : "ACTIVE";

    let envelopeRoot: string | null = null;
    if (config.storageUpload) {
      if (!config.deployerKey || config.deployerKey.length !== 66) {
        return reply.code(503).send({
          error: "DEPLOYER_PRIVATE_KEY is required to upload the compiled envelope to 0G Storage.",
          code: "missing_deployer",
        });
      }
      try {
        const uploaded = await uploadJson(
          { network: config.network, privateKey: config.deployerKey },
          intentHashPayload(compiled.envelope),
        );
        envelopeRoot = uploaded.rootHash.startsWith("0x") ? uploaded.rootHash : `0x${uploaded.rootHash}`;
      } catch (err) {
        return reply.code(502).send({
          error: `Envelope upload to 0G Storage failed: ${err instanceof Error ? err.message : String(err)}`,
          code: "envelope_upload_failed",
        });
      }
    }

    await prisma.intent.upsert({
      where: { id: compiled.envelope.intentId },
      create: {
        id: compiled.envelope.intentId,
        intentHash,
        principal,
        envelopeJson: JSON.stringify(compiled.envelope),
        sourceText: body.text,
        envelopeRoot,
        status: compiled.envelope.status,
      },
      update: {
        envelopeJson: JSON.stringify(compiled.envelope),
        intentHash,
        envelopeRoot,
        status: compiled.envelope.status,
      },
    });

    return {
      ...compiled,
      intentHash,
      envelopeRoot,
      eip712: config.registry
        ? {
            domain: {
              name: "INTENTOS IntentRegistry",
              version: "1",
              chainId: config.chainId,
              verifyingContract: config.registry,
            },
            types: {
              IntentRegistration: [
                { name: "intentHash", type: "bytes32" },
                { name: "principal", type: "address" },
                { name: "agentId", type: "bytes32" },
                { name: "createdAt", type: "uint64" },
                { name: "expiresAt", type: "uint64" },
                { name: "nonce", type: "uint256" },
              ],
            },
            primaryType: "IntentRegistration" as const,
            message: {
              intentHash,
              principal,
              agentId: compiled.envelope.agent.agenticId,
              createdAt: compiled.envelope.createdAt.toString(),
              expiresAt: compiled.envelope.expiresAt.toString(),
              nonce: compiled.envelope.nonce.toString(),
            },
          }
        : null,
    };
  });

  app.get("/envelope/:intentId", async (req, reply) => {
    const { intentId } = req.params as { intentId: string };
    let row: { envelopeRoot: string | null; intentHash: string } | null = null;
    try {
      row = await prisma.intent.findFirst({
        where: { OR: [{ id: intentId }, { intentHash: intentId }] },
        select: { envelopeRoot: true, intentHash: true },
      });
    } catch {
      return reply.code(404).send({ error: "envelope not on storage", code: "envelope_missing" });
    }
    if (!row?.envelopeRoot) {
      return reply.code(404).send({ error: "envelope not on storage", code: "envelope_missing" });
    }
    if (!config.deployerKey || config.deployerKey.length !== 66) {
      return reply.code(503).send({
        error: "DEPLOYER_PRIVATE_KEY is required to download from 0G Storage.",
        code: "missing_deployer",
      });
    }
    try {
      const payload = await withTimeout(
        downloadJson({ network: config.network, privateKey: config.deployerKey }, row.envelopeRoot),
        12_000,
        "envelope download",
      );
      const recomputed = hashCanonical(payload);
      return {
        envelopeRoot: row.envelopeRoot,
        intentHash: row.intentHash,
        payload,
        matches: recomputed === row.intentHash,
      };
    } catch (err) {
      return reply.code(502).send({
        error: err instanceof Error ? err.message : String(err),
        code: "envelope_download_failed",
      });
    }
  });

  app.post("/agent/propose", async (req, reply) => {
    const body = req.body as {
      intent?: unknown;
      mode?: string;
      strategy?: string;
    };
    const parsed = IntentEnvelopeSchema.safeParse(body.intent);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten(), code: "invalid_intent" });
    const router = routerCfg();
    if (!router) {
      return reply.code(503).send({
        error: `Agent propose requires ZEROG_ROUTER_API_KEY. Create an sk- key at ${config.routerUi}.`,
        code: "missing_router_key",
      });
    }
    const mode = normalizeProposeMode(body.mode ?? body.strategy);
    try {
      const out = await proposeAction(parsed.data, mode, router);
      return { action: out.action, mode: out.mode, usedModel: out.usedModel, computeEvidence: out.evidence, agent: REFERENCE_AGENT };
    } catch (err) {
      return failClosed(reply, err);
    }
  });

  app.post("/verify", async (req, reply) => {
    const body = req.body as {
      intent?: unknown;
      action?: unknown;
      sourceText?: string;
      amountWei?: string;
      registerTx?: string;
      payer?: string;
      execute?: boolean;
    };
    return runVerifyRoute(req, reply, body, "human");
  });

  app.post("/verify/a2a", async (req, reply) => {
    const body = req.body as {
      requirement?: unknown;
      intent?: unknown;
      offer?: unknown;
      action?: unknown;
      amountWei?: string;
      registerTx?: string;
      payer?: string;
      sourceText?: string;
      execute?: boolean;
    };
    return runVerifyRoute(
      req,
      reply,
      {
        intent: body.requirement ?? body.intent,
        action: body.offer ?? body.action,
        amountWei: body.amountWei,
        registerTx: body.registerTx,
        payer: body.payer,
        sourceText: body.sourceText,
        execute: body.execute,
      },
      "a2a",
    );
  });

  app.post("/verify/step", async (req, reply) => {
    const body = req.body as {
      intent?: unknown;
      action?: unknown;
      stepId?: string;
      previousActionHashes?: string[];
      amountWei?: string;
      registerTx?: string;
      payer?: string;
      sourceText?: string;
    };
    const intentParsed = IntentEnvelopeSchema.safeParse(body.intent);
    if (!intentParsed.success) return reply.code(400).send({ error: intentParsed.error.flatten(), code: "invalid_intent" });
    const steps = intentParsed.data.steps ?? [];
    const stepId = body.stepId ?? (body.action as { stepId?: string } | undefined)?.stepId;
    if (steps.length > 0 && !stepId) {
      return reply.code(400).send({ error: "stepId required for a multi-step envelope", code: "step_required" });
    }
    const index = stepId ? steps.findIndex((s) => s.id === stepId) : -1;
    if (stepId && steps.length > 0 && index < 0) {
      return reply.code(400).send({ error: `Unknown step ${stepId}`, code: "step_unknown" });
    }
    if (stepId && index > 0 && config.registry) {
      const prev = steps.slice(0, index);
      const hashes = body.previousActionHashes ?? [];
      const client = publicClient(config.network, config.rpc);
      const onchainId = canonicalIntentId(intentParsed.data);
      for (let i = 0; i < prev.length; i++) {
        const actionHash = hashes[i] as `0x${string}` | undefined;
        if (!actionHash) {
          return reply.code(409).send({
            error: `Step ${prev[i]!.id} must be APPROVE'd on-chain before ${stepId}.`,
            code: "step_predecessor_missing",
          });
        }
        const approved = await client.readContract({
          address: config.registry,
          abi: INTENT_REGISTRY_ABI,
          functionName: "isApproved",
          args: [onchainId, actionHash],
        });
        if (!approved) {
          return reply.code(409).send({
            error: `Step ${prev[i]!.id} is not APPROVE'd on-chain.`,
            code: "step_predecessor_unapproved",
          });
        }
      }
    }
    const action = body.action && typeof body.action === "object" ? (body.action as Record<string, unknown>) : {};
    const params = action.params && typeof action.params === "object" ? (action.params as Record<string, unknown>) : {};
    if (stepId) {
      action.stepId = stepId;
      action.params = { ...params, stepId };
    }
    return runVerifyRoute(req, reply, { ...body, action }, "step");
  });

  app.post("/agent/offer", async (req, reply) => {
    const body = req.body as { intent?: unknown; requirement?: unknown; mode?: string };
    const parsed = IntentEnvelopeSchema.safeParse(body.requirement ?? body.intent);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten(), code: "invalid_intent" });
    const router = routerCfg();
    if (!router) {
      return reply.code(503).send({
        error: `Agent offer requires ZEROG_ROUTER_API_KEY.`,
        code: "missing_router_key",
      });
    }
    try {
      const out = await proposeAction(parsed.data, normalizeProposeMode(body.mode), router);
      const offerAgent = requireAgentId();
      const action = offerAgent ? { ...out.action, agentId: offerAgent } : out.action;
      return { action, mode: out.mode, usedModel: out.usedModel, computeEvidence: out.evidence, agent: REFERENCE_AGENT };
    } catch (err) {
      return failClosed(reply, err);
    }
  });

  app.get("/certificate/action/:actionHash", async (req, reply) => {
    const { actionHash } = req.params as { actionHash: string };
    const row = await prisma.certificateRow.findUnique({ where: { actionHash } });
    if (!row) return reply.code(404).send({ error: "certificate not found" });
    return JSON.parse(row.payloadJson);
  });

  app.get("/certificate/:intentId/:actionHash", async (req, reply) => {
    const { intentId, actionHash } = req.params as { intentId: string; actionHash: string };
    const row = await prisma.certificateRow.findFirst({
      where: { intentId, actionHash },
    });
    if (!row) {
      const byHash = await prisma.certificateRow.findUnique({ where: { actionHash } });
      if (!byHash) return reply.code(404).send({ error: "certificate not found" });
      return JSON.parse(byHash.payloadJson);
    }
    return JSON.parse(row.payloadJson);
  });

  app.post("/settle", async (req, reply) => {
    const body = req.body as { actionHash?: string; settleTx?: string };
    if (!body.actionHash || !optionalTxHash(body.settleTx)) {
      return reply.code(400).send({ error: "actionHash and settleTx required", code: "settle_input" });
    }
    const settleTx = optionalTxHash(body.settleTx)!;
    const row = await prisma.verification.findFirst({ where: { actionHash: body.actionHash } });
    if (!row) return reply.code(404).send({ error: "verification not found" });
    await prisma.verification.update({ where: { id: row.id }, data: { settleTx } });
    const cert = await prisma.certificateRow.findUnique({ where: { actionHash: body.actionHash } });
    if (cert) {
      const payload = JSON.parse(cert.payloadJson) as Record<string, unknown>;
      await prisma.certificateRow.update({
        where: { actionHash: body.actionHash },
        data: { payloadJson: JSON.stringify({ ...payload, settleTxHash: settleTx }) },
      });
    }
    return { ok: true, settleTx };
  });

  app.get("/proof/:actionHash", async (req, reply) => {
    const { actionHash } = req.params as { actionHash: string };
    const row = await prisma.verification.findFirst({
      where: { actionHash },
      include: { intent: true },
    });
    if (!row) return reply.code(404).send({ error: "not found" });
    const evidence = JSON.parse(row.evidenceJson);
    const stored = JSON.parse(row.resultJson) as { contentHash?: string };
    const localHash = hashCanonical(evidence);
    let storageMatch: boolean | null = null;
    let storageError: string | null = null;
    if (config.deployerKey && config.storageUpload && row.evidenceRoot) {
      try {
        const fromStorage = await withTimeout(
          downloadJson(
            { network: config.network, privateKey: config.deployerKey },
            row.evidenceRoot,
          ),
          12_000,
          "0G Storage download",
        );
        storageMatch = hashCanonical(fromStorage) === localHash;
      } catch (err) {
        storageError = err instanceof Error ? err.message : String(err);
      }
    }
    return {
      verification: JSON.parse(row.resultJson),
      evidence,
      evidenceRoot: row.evidenceRoot,
      localHash,
      contentHash: stored.contentHash ?? null,
      matches: stored.contentHash ? stored.contentHash === localHash : false,
      storageMatch,
      storageError,
      intent: JSON.parse(row.intent.envelopeJson),
      explorer: config.explorer,
      registerTxHash: row.registerTx ?? null,
      verifyTxHash: row.verifyTx ?? null,
      settleTxHash: row.settleTx ?? null,
      reputationTx: row.reputationTx ?? null,
      meterTx: row.meterTx ?? null,
      envelopeRoot: row.intent.envelopeRoot ?? null,
      mode: row.mode,
    };
  });

  app.post("/attest", async (req, reply) => {
    const body = req.body as {
      intent?: IntentEnvelope;
      actionHash?: `0x${string}`;
      evidenceRoot?: `0x${string}`;
      verdict?: string;
      alignmentBps?: number;
      confidenceBps?: number;
      amount?: string;
      amountWei?: string;
      settlement?: { target: `0x${string}`; calldata: `0x${string}`; valueWei: string };
    };
    if (!config.oracleKey || !config.registry) {
      return reply.code(503).send({
        error: "oracle key or registry not configured",
        code: "attest_unconfigured",
      });
    }
    if (!body.intent || !body.actionHash || !body.evidenceRoot) {
      return reply.code(400).send({ error: "intent, actionHash, evidenceRoot required", code: "attest_input" });
    }
    try {
      const out = await recordAttestation({
        intent: body.intent,
        actionHash: body.actionHash,
        evidenceRoot: body.evidenceRoot,
        verdict: body.verdict ?? "CHALLENGE",
        alignmentBps: body.alignmentBps ?? 0,
        confidenceBps: body.confidenceBps ?? 0,
        amountWei: body.amountWei ?? body.amount ?? "0",
        settlement: body.settlement,
      });
      return out;
    } catch (err) {
      return failClosed(reply, err);
    }
  });

  app.get("/meter/:address", async (req, reply) => {
    const { address } = req.params as { address: string };
    if (!isAddress(address)) return reply.code(400).send({ error: "invalid address", code: "bad_address" });
    if (!config.meter) {
      return {
        address: null,
        credits: "0",
        priceWei: config.verifyPriceWei.toString(),
        configured: false,
      };
    }
    const client = publicClient(config.network, config.rpc);
    const [credits, priceWei] = await Promise.all([
      client.readContract({
        address: config.meter,
        abi: VERIFICATION_METER_ABI,
        functionName: "credits",
        args: [address as `0x${string}`],
      }),
      client.readContract({ address: config.meter, abi: VERIFICATION_METER_ABI, functionName: "priceWei" }),
    ]);
    return {
      address: config.meter,
      credits: credits.toString(),
      priceWei: priceWei.toString(),
      configured: true,
      explorer: `${config.explorer}/address/${config.meter}`,
    };
  });

  app.get("/usage", async () => {
    const rows = await prisma.verification.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
      include: { intent: true },
    });
    const batches = await prisma.executionBatch.findMany({ orderBy: { createdAt: "desc" }, take: 8 });
    const counts = { APPROVE: 0, REJECT: 0, CHALLENGE: 0, total: rows.length };
    for (const r of rows) {
      if (r.verdict in counts) counts[r.verdict as keyof typeof counts] += 1;
    }
    const metered = rows.filter((r) => r.meterTx).length;
    const items = rows.map((r) => {
      const parsed = JSON.parse(r.resultJson) as {
        alignmentScore?: number;
        computeEvidence?: { providerAddress?: string; teeAttested?: boolean };
      };
      return {
        id: r.id,
        actionHash: r.actionHash,
        verdict: r.verdict,
        evidenceRoot: r.evidenceRoot,
        verifyTx: r.verifyTx,
        payer: r.payer,
        meterTx: r.meterTx,
        mode: r.mode,
        reputationTx: r.reputationTx,
        batchId: r.batchId,
        alignment: parsed.alignmentScore ?? 0,
        teeProvider: parsed.computeEvidence?.providerAddress ?? null,
        createdAt: r.createdAt,
      };
    });
    return {
      counts,
      debitedWei: (BigInt(metered) * config.verifyPriceWei).toString(),
      latestBatchRoot: batches[0]?.root ?? null,
      items,
      verifications: items,
      batches: batches.map((b) => ({
        id: b.id,
        root: b.root,
        count: b.count,
        fromTs: b.fromTs,
        toTs: b.toTs,
        createdAt: b.createdAt,
      })),
    };
  });

  app.get("/log", async () => {
    const batches = await prisma.executionBatch.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
    const pending = await prisma.logEvent.count({ where: { batchId: null } });
    return {
      pending,
      note: "0G DA is deferred. This is the append-only execution log on 0G Storage.",
      batches: batches.map((b) => ({
        id: b.id,
        root: b.root,
        count: b.count,
        fromTs: b.fromTs,
        toTs: b.toTs,
        createdAt: b.createdAt,
        explorer: config.explorer,
        storage: `https://indexer-storage-testnet-turbo.0g.ai`,
      })),
    };
  });

  app.post("/log/flush", async () => {
    const batch = await flushBatchLog(true);
    return { ok: true, batch };
  });

  app.post("/reputation", async (req, reply) => {
    const body = req.body as { actionHash?: string; reputationTx?: string };
    if (!body.actionHash || !optionalTxHash(body.reputationTx)) {
      return reply.code(400).send({ error: "actionHash and reputationTx required", code: "reputation_input" });
    }
    const row = await prisma.verification.findFirst({ where: { actionHash: body.actionHash } });
    if (!row) return reply.code(404).send({ error: "verification not found" });
    await prisma.verification.update({
      where: { id: row.id },
      data: { reputationTx: body.reputationTx },
    });
    return { ok: true };
  });

  app.get("/meta", async () => ({
    chainId: config.chainId,
    network: config.network,
    registry: config.registry || null,
    vault: config.vault || null,
    meter: config.meter || null,
    consumer: config.consumer || null,
    agenticId: config.agenticId || null,
    agenticToken: config.agenticToken || null,
    executor: config.executor || null,
    settlementTarget: config.settlementTarget || null,
    bounty: config.bounty || null,
    agenticIdV2: config.agenticIdV2 || null,
    agenticTokenV2: config.agenticTokenV2 || null,
    challengeDelay: config.challengeDelay,
    explorer: config.explorer,
    routerUi: config.routerUi,
    agentId: config.agentIdRaw ? toBytes32AgentId(config.agentIdRaw) : null,
    requirementAgentId: config.requirementAgentIdRaw ? toBytes32AgentId(config.requirementAgentIdRaw) : null,
    identityRegistry: config.identityRegistry,
    reputationRegistry: config.reputationRegistry,
    demoIntent: DEMO_INTENT_TEXT,
    verifyPriceWei: config.verifyPriceWei.toString(),
  }));

  app.post("/agentic/v2/proof", async (req, reply) => {
    const body = req.body as {
      kind?: string;
      tokenId?: string;
      from?: string;
      to?: string;
      newMetadataHash?: `0x${string}`;
      newEncryptedURI?: string;
    };
    if (!config.oracleKey || !config.agenticIdV2) {
      return reply.code(503).send({
        error: "Oracle key or AGENTIC_ID_V2_ADDRESS is not configured",
        code: "agentic_v2_unconfigured",
      });
    }
    if ((body.kind !== "transfer" && body.kind !== "clone") || !body.tokenId || !isAddress(body.from ?? "") || !isAddress(body.to ?? "")) {
      return reply.code(400).send({
        error: "kind (transfer|clone), tokenId, from, and to are required",
        code: "agentic_v2_input",
      });
    }
    const tokenId = BigInt(body.tokenId);
    const client = publicClient(config.network, config.rpc);
    let newEncryptedURI = body.newEncryptedURI;
    let newMetadataHash = body.newMetadataHash;
    if (!newEncryptedURI || !newMetadataHash) {
      try {
        const [uri, hash] = await Promise.all([
          client.readContract({
            address: config.agenticIdV2,
            abi: AGENTIC_ID_V2_ABI,
            functionName: "getEncryptedURI",
            args: [tokenId],
          }),
          client.readContract({
            address: config.agenticIdV2,
            abi: AGENTIC_ID_V2_ABI,
            functionName: "getMetadataHash",
            args: [tokenId],
          }),
        ]);
        newEncryptedURI = newEncryptedURI ?? uri;
        newMetadataHash = newMetadataHash ?? hash;
      } catch (err) {
        return reply.code(502).send({
          error: err instanceof Error ? err.message : String(err),
          code: "agentic_v2_read_failed",
        });
      }
    }
    const { account } = walletFromKey(config.oracleKey, config.network, config.rpc);
    if (!account.signTypedData) {
      return reply.code(500).send({ error: "oracle cannot sign typed data", code: "agentic_v2_sign" });
    }
    if (!newEncryptedURI || !newMetadataHash) {
      return reply.code(400).send({ error: "metadata hash and URI required", code: "agentic_v2_input" });
    }
    const attestationTypes = {
      TransferAttestation: [
        { name: "tokenId", type: "uint256" },
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "newMetadataHash", type: "bytes32" },
        { name: "uriHash", type: "bytes32" },
      ],
      CloneAttestation: [
        { name: "tokenId", type: "uint256" },
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "newMetadataHash", type: "bytes32" },
        { name: "uriHash", type: "bytes32" },
      ],
    } as const;
    const uriHash = keccak256(toBytes(newEncryptedURI));
    const sig = await account.signTypedData({
      domain: {
        name: "INTENTOS AgenticId",
        version: "1",
        chainId: config.chainId,
        verifyingContract: config.agenticIdV2,
      },
      types: attestationTypes,
      primaryType: body.kind === "clone" ? "CloneAttestation" : "TransferAttestation",
      message: {
        tokenId,
        from: body.from as `0x${string}`,
        to: body.to as `0x${string}`,
        newMetadataHash,
        uriHash,
      },
    });
    const proof = encodeAbiParameters(
      [{ type: "bytes32" }, { type: "string" }, { type: "bytes" }],
      [newMetadataHash as `0x${string}`, newEncryptedURI, sig],
    );
    return {
      kind: body.kind,
      tokenId: body.tokenId,
      from: body.from,
      to: body.to,
      newMetadataHash,
      newEncryptedURI,
      proof,
      contract: config.agenticIdV2,
    };
  });

  return app;
}
