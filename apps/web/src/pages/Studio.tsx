import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2Icon } from "lucide-react";
import { formatEther, parseEther } from "viem";
import { useWallet } from "@/wallet/WalletProvider";
import { isRequestAlreadyPending, isUserRejected } from "@/wallet/eip1193";
import { api, short } from "@/lib/api";
import { waitForReceipt } from "@/lib/receipt";
import { DEMO_VAULT_ABI, INTENT_EXECUTOR_ABI, INTENT_REGISTRY_ABI } from "@/lib/abi";
import { targetChain, targetShortName } from "@/lib/chains";
import { explainTxError, writeTargetContract } from "@/lib/tx";
import { ConstraintChips } from "@/components/ConstraintChips";
import { GiveFeedback } from "@/components/GiveFeedback";
import { HashField } from "@/components/HashField";
import { FailedRules, NextStepBanner } from "@/components/NextStep";
import { PresentCertificate } from "@/components/PresentCertificate";
import { Stepper } from "@/components/Stepper";
import { VerdictStamp } from "@/components/VerdictStamp";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/v-form-8-utils/field";
import { Input } from "@/components/ui/input";
import { Radio, RadioGroup } from "@/components/ui/v-form-8-utils/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useReady } from "@/lib/useReady";
import type { Action, CompileOut, Envelope, Meta, MeterInfo, Ready, VerifyOut } from "@/lib/types";
import { DEMO_PLACEHOLDER } from "@/lib/types";

type Stage = "intent" | "anchor" | "agent" | "verify" | "proof";
type Mode = "greedy" | "replan";

const STEPS: { id: Stage; label: string }[] = [
  { id: "intent", label: "Intent" },
  { id: "anchor", label: "Anchor" },
  { id: "agent", label: "Agent" },
  { id: "verify", label: "Verify" },
  { id: "proof", label: "Proof" },
];

function vaultRevertMessage(err: unknown, verdict?: string): string {
  const text = explainTxError(err);
  if (/IntentNotApproved/i.test(text)) {
    if (verdict && verdict !== "APPROVE") {
      return "The vault refused this plan. That is correct while the stamp is REJECT or CHALLENGE. Press Replan, then Verify, until you see APPROVE.";
    }
    return "The vault refused this deposit. Register the intent and wait for an APPROVE stamp first.";
  }
  if (/BindingMismatch/i.test(text)) {
    return "DemoVault reverted BindingMismatch. The 0G amount must match the amount bound at verify.";
  }
  if (/AlreadySettled/i.test(text)) {
    return "DemoVault reverted AlreadySettled. This (intent, action) pair already deposited.";
  }
  return text;
}

function executorRevertMessage(err: unknown, verdict?: string): string {
  const text = explainTxError(err);
  if (/ChallengePending/i.test(text)) {
    return "IntentExecutor reverted ChallengePending. Wait for the challenge delay (default 15 minutes).";
  }
  if (/BindingMismatch/i.test(text)) {
    return "IntentExecutor reverted BindingMismatch. Target, calldata, and value must match the executor binding from verify.";
  }
  if (/IntentNotApproved/i.test(text)) {
    if (verdict && verdict !== "APPROVE") {
      return "IntentExecutor reverted IntentNotApproved. Expected until replan + APPROVE.";
    }
    return "IntentExecutor reverted IntentNotApproved.";
  }
  if (/AlreadyExecuted/i.test(text)) {
    return "IntentExecutor reverted AlreadyExecuted.";
  }
  if (/CallFailed/i.test(text)) {
    return "IntentExecutor reverted CallFailed — the SettlementTarget call did not succeed.";
  }
  return text;
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[60%] text-right font-medium break-all">{value}</span>
    </div>
  );
}

export function Studio() {
  const { address, isConnected, ensureChain, client, publicClient } = useWallet();

  const { meta, live, apiError, probing, chainMismatch, blockers: readyBlockers, explorer } =
    useReady();
  const [stage, setStage] = useState<Stage>("intent");
  const [text, setText] = useState("");
  const [compile, setCompile] = useState<CompileOut | null>(null);
  const [registerTx, setRegisterTx] = useState<string | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [steer, setSteer] = useState<Mode>("greedy");
  const [verify, setVerify] = useState<VerifyOut | null>(null);
  const [amountOg, setAmountOg] = useState("0.0001");
  const [settleTx, setSettleTx] = useState<string | null>(null);
  const [settleErr, setSettleErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [meter, setMeter] = useState<MeterInfo | null>(null);
  const [bindExecutor, setBindExecutor] = useState(false);

  const envelope: Envelope | null = compile?.envelope ?? null;
  const stepIndex = STEPS.findIndex((s) => s.id === stage);

  useEffect(() => {
    if (!address) return;
    const load = () =>
      api<MeterInfo>(`/meter/${address}`)
        .then(setMeter)
        .catch(() => setMeter(null));
    load();
    const id = window.setInterval(load, 12000);
    return () => window.clearInterval(id);
  }, [address]);

  // The envelope is signed for one principal and the meter is debited per payer,
  // so a session cannot survive an account switch — it would revert at register
  // or bill the wrong wallet.
  const lastAddress = useRef<`0x${string}` | undefined>(undefined);
  useEffect(() => {
    const previous = lastAddress.current;
    lastAddress.current = address;
    if (!previous || !address || previous === address) return;
    setCompile(null);
    setRegisterTx(null);
    setAction(null);
    setMode(null);
    setVerify(null);
    setSettleTx(null);
    setSettleErr(null);
    setStage("intent");
    setError(`Wallet switched to ${short(address)}. The session was cleared — compile again with this account.`);
  }, [address]);

  const unlocked = useMemo<Record<Stage, boolean>>(() => {
    const anchored = Boolean(registerTx);
    return {
      intent: true,
      anchor: Boolean(compile),
      agent: anchored,
      verify: Boolean(anchored && action),
      proof: Boolean(verify),
    };
  }, [compile, registerTx, action, verify]);

  const run = useCallback(async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (err) {
      if (isUserRejected(err)) {
        setError("MetaMask cancelled the request. If it says “malicious site”, that is MetaMask’s phishing list on this Vercel hostname — tick the box and continue only if you opened the official INTENTOS deploy.");
      } else if (isRequestAlreadyPending(err)) {
        setError("MetaMask already has a pending prompt. Open the extension, finish or dismiss it, then try again.");
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setBusy(null);
    }
  }, []);

  const onCompile = () =>
    run("Compiling on 0G Compute", async () => {
      if (!address) throw new Error("Connect a wallet on 0G before compiling.");
      if (!text.trim()) throw new Error("Write an intent first.");
      const out = await api<CompileOut>("/compile", {
        method: "POST",
        body: JSON.stringify({ text: text.trim(), principal: address }),
      });
      setCompile(out);
      setAction(null);
      setMode(null);
      setVerify(null);
      setRegisterTx(null);
      setSettleTx(null);
      setSettleErr(null);
      setStage("anchor");
    });

  const onRegister = () =>
    run("Waiting on MetaMask to sign registerIntent", async () => {
      if (!compile?.eip712 || !client || !address) {
        throw new Error("Registry or wallet missing. Deploy IntentRegistry, then connect MetaMask.");
      }
      await ensureChain();
      const { domain, types, message } = compile.eip712;
      const sig = await client.signTypedData({
        account: address,
        domain,
        types,
        primaryType: "IntentRegistration",
        message: {
          intentHash: message.intentHash,
          principal: message.principal,
          agentId: message.agentId,
          createdAt: BigInt(message.createdAt),
          expiresAt: BigInt(message.expiresAt),
          nonce: BigInt(message.nonce),
        },
      });
      const hash = await writeTargetContract(client, publicClient, {
        account: address,
        address: domain.verifyingContract,
        abi: INTENT_REGISTRY_ABI,
        functionName: "registerIntent",
        args: [
          {
            intentHash: message.intentHash,
            principal: message.principal,
            agentId: message.agentId,
            createdAt: BigInt(message.createdAt),
            expiresAt: BigInt(message.expiresAt),
            status: 1,
          },
          BigInt(message.nonce),
          sig,
        ],
      });
      const receipt = await waitForReceipt(publicClient, hash);
      if (receipt.status !== "success") throw new Error("registerIntent reverted on-chain.");
      setRegisterTx(hash);
      setStage("agent");
    });

  const onPropose = (next: Mode) =>
    run(next === "greedy" ? "Agent maximizing yield" : "Agent replanning to constraints", async () => {
      if (!envelope) throw new Error("Compile an intent first.");
      const out = await api<{ action: Action; mode: Mode }>("/agent/propose", {
        method: "POST",
        body: JSON.stringify({ intent: envelope, mode: next }),
      });
      setAction(out.action);
      setMode(out.mode);
      setVerify(null);
      setSettleTx(null);
      setSettleErr(null);
      setStage("verify");
    });

  const onVerify = () =>
    run("Verifying on 0G (Compute + Storage + attest — up to ~3 min)", async () => {
      if (!envelope || !action) throw new Error("Need a compiled intent and an agent proposal.");
      let amountWei = "0";
      try {
        amountWei = parseEther(amountOg || "0").toString();
      } catch {
        throw new Error("Settlement amount must be a valid 0G decimal.");
      }
      if (meter?.configured && BigInt(meter.credits) < BigInt(meter.priceWei || "0")) {
        throw new Error("Deposit VerificationMeter credits before verify. The fee is prepaid 0G.");
      }
      const out = await api<VerifyOut>("/verify", {
        method: "POST",
        body: JSON.stringify({
          intent: envelope,
          action,
          sourceText: text.trim(),
          amountWei,
          registerTx,
          payer: address,
          execute: bindExecutor,
        }),
      });
      setVerify(out);
      setSettleTx(null);
      setSettleErr(null);
      setStage("proof");
    });

  const onSettle = () =>
    run("Calling DemoVault.deposit", async () => {
      if (!verify || !client || !address) {
        throw new Error("Connect a wallet and complete verification first.");
      }
      if (!verify.vault.address) {
        throw new Error("DEMO_VAULT_ADDRESS is not configured.");
      }
      await ensureChain();
      try {
        const hash = await writeTargetContract(client, publicClient, {
          account: address,
          address: verify.vault.address,
          abi: DEMO_VAULT_ABI,
          functionName: "deposit",
          args: [verify.vault.call.intentId, verify.vault.call.actionHash],
          value: BigInt(verify.vault.call.valueWei || "0"),
        });
        const receipt = await waitForReceipt(publicClient, hash);
        setSettleTx(hash);
        if (receipt.status !== "success") {
          let decoded = "DemoVault.deposit reverted on-chain.";
          try {
            await publicClient.simulateContract({
              account: address,
              address: verify.vault.address,
              abi: DEMO_VAULT_ABI,
              functionName: "deposit",
              args: [verify.vault.call.intentId, verify.vault.call.actionHash],
              value: BigInt(verify.vault.call.valueWei || "0"),
            });
          } catch (sim) {
            decoded = vaultRevertMessage(sim, verify.result.verdict);
          }
          setSettleErr(decoded);
          throw new Error(decoded);
        }
        setSettleErr(null);
        await api("/settle", {
          method: "POST",
          body: JSON.stringify({ actionHash: verify.result.actionHash, settleTx: hash }),
        }).catch(() => undefined);
      } catch (err) {
        const msg = vaultRevertMessage(err, verify.result.verdict);
        setSettleErr(msg);
        throw new Error(msg);
      }
    });

  const onExecute = () =>
    run("Calling IntentExecutor.execute", async () => {
      if (!verify?.executor || !client || !address) {
        throw new Error("Connect a wallet and verify with IntentExecutor binding first.");
      }
      await ensureChain();
      try {
        const hash = await writeTargetContract(client, publicClient, {
          account: address,
          address: verify.executor.address,
          abi: INTENT_EXECUTOR_ABI,
          functionName: "execute",
          args: [
            verify.executor.call.intentId,
            verify.executor.call.actionHash,
            verify.executor.call.target,
            verify.executor.call.data,
          ],
          value: BigInt(verify.executor.call.valueWei || "0"),
        });
        const receipt = await waitForReceipt(publicClient, hash);
        setSettleTx(hash);
        if (receipt.status !== "success") {
          let decoded = "IntentExecutor.execute reverted on-chain.";
          try {
            await publicClient.simulateContract({
              account: address,
              address: verify.executor.address,
              abi: INTENT_EXECUTOR_ABI,
              functionName: "execute",
              args: [
                verify.executor.call.intentId,
                verify.executor.call.actionHash,
                verify.executor.call.target,
                verify.executor.call.data,
              ],
              value: BigInt(verify.executor.call.valueWei || "0"),
            });
          } catch (sim) {
            decoded = executorRevertMessage(sim, verify.result.verdict);
          }
          setSettleErr(decoded);
          throw new Error(decoded);
        }
        setSettleErr(null);
        await api("/settle", {
          method: "POST",
          body: JSON.stringify({ actionHash: verify.result.actionHash, settleTx: hash }),
        }).catch(() => undefined);
      } catch (err) {
        const msg = executorRevertMessage(err, verify.result.verdict);
        setSettleErr(msg);
        throw new Error(msg);
      }
    });

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-10">
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Gate</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Human verify</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          The vault moves funds only after a green APPROVE stamp. Greedy is meant to fail. After Replan you must
          Verify again — a new plan is not a pass. Ignore deposit until APPROVE.
        </p>
      </div>

      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
        <div className="glass rounded-3xl p-5 sm:p-8">
          <Stepper
            steps={STEPS.map((s) =>
              s.id !== "proof"
                ? s
                : {
                    ...s,
                    label:
                      verify?.result.verdict === "APPROVE" ? "Settle" : verify ? "Blocked" : "Proof",
                  },
            )}
            current={Math.max(stepIndex, 0)}
            blocked={stage === "proof" && Boolean(verify && verify.result.verdict !== "APPROVE")}
            onSelect={(i) => {
              const next = STEPS[i];
              if (next && unlocked[next.id]) setStage(next.id);
            }}
          />

          <AnimatePresence mode="wait">
            <motion.div
              key={stage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
              className="mt-8"
            >
              {stage === "intent" && (
                <IntentStep
                  text={text}
                  setText={setText}
                  compile={compile}
                  connected={isConnected}
                  live={live}
                  probing={probing}
                  apiError={apiError}
                  readyBlockers={readyBlockers}
                  chainMismatch={chainMismatch}
                  busy={busy}
                  onCompile={onCompile}
                  onNext={() => setStage("anchor")}
                />
              )}
              {stage === "anchor" && (
                <AnchorStep
                  compile={compile}
                  registerTx={registerTx}
                  explorer={explorer}
                  busy={busy}
                  onBack={() => setStage("intent")}
                  onRegister={onRegister}
                  onNext={() => setStage("agent")}
                />
              )}
              {stage === "agent" && (
                <AgentStep
                  action={action}
                  mode={mode}
                  steer={steer}
                  setSteer={setSteer}
                  live={live}
                  busy={busy}
                  onBack={() => setStage("anchor")}
                  onPropose={onPropose}
                  onNext={() => setStage("verify")}
                />
              )}
              {stage === "verify" && (
                <VerifyStep
                  verify={verify}
                  action={action}
                  mode={mode}
                  amountOg={amountOg}
                  setAmountOg={setAmountOg}
                  busy={busy}
                  registered={Boolean(registerTx)}
                  live={live}
                  meterBlocked={Boolean(
                    meter?.configured && BigInt(meter.credits) < BigInt(meter.priceWei || "0"),
                  )}
                  bindExecutor={bindExecutor}
                  setBindExecutor={setBindExecutor}
                  executorReady={Boolean(meta?.executor && meta?.settlementTarget)}
                  onBack={() => setStage("agent")}
                  onVerify={onVerify}
                />
              )}
              {stage === "proof" && (
                <ProofStep
                  verify={verify}
                  settleTx={settleTx}
                  settleErr={settleErr}
                  explorer={explorer}
                  busy={busy}
                  meta={meta}
                  agentId={action?.agentId ?? meta?.agentId}
                  onBack={() => setStage("verify")}
                  onReplan={() => {
                    setSteer("replan");
                    onPropose("replan");
                  }}
                  onSettle={onSettle}
                  onExecute={onExecute}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <aside className="space-y-4">
          <div className="glass rounded-3xl p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Session</p>
            <h2 className="mt-1 text-lg font-semibold">Envelope</h2>
            {envelope ? (
              <div className="mt-4 space-y-3">
                <p className="text-sm">{envelope.objective.description}</p>
                <ConstraintChips hard={envelope.constraints.hard} soft={envelope.constraints.soft} />
                <HashField label="Intent hash" value={compile?.intentHash} />
                <HashField label="Envelope root" value={compile?.envelopeRoot ?? undefined} />
                {registerTx && <HashField label="Register tx" value={registerTx} />}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Compile to pin constraints and the intent hash here.</p>
            )}
          </div>
          <div className="glass rounded-3xl p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Last verdict</p>
            {verify ? (
              <div className="mt-3 space-y-3">
                <VerdictStamp verdict={verify.result.verdict} />
                <p className="text-xs text-muted-foreground">
                  Alignment {(verify.result.alignmentScore * 100).toFixed(1)}%
                  {verify.meter?.txHash ? ` · meter ${short(verify.meter.txHash)}` : ""}
                </p>
                {verify.result.verdict === "APPROVE" ? (
                  <p className="text-xs text-primary">Next: Deposit. The vault will accept this attestation.</p>
                ) : (
                  <p className="text-xs text-challenge">Next: Replan, then Verify. Deposit stays locked.</p>
                )}
                <Link className="text-sm text-primary underline" to={`/proof/${verify.result.actionHash}`}>
                  Open certificate
                </Link>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Verify a plan to stamp APPROVE / REJECT here.</p>
            )}
          </div>
        </aside>
      </div>

      {chainMismatch && meta && (
        <p className="mt-4 rounded-2xl border border-challenge/40 bg-challenge/10 px-4 py-3 text-sm text-challenge">
          Studio is on chain {targetChain.id} ({targetChain.name}) but the API signed for {meta.chainId} (
          {meta.network}). Align VITE_CHAIN_ID and ZEROG_NETWORK.
        </p>
      )}
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground"
        >
          {error}
        </motion.div>
      )}
      {busy && <p className="mt-3 text-center text-xs text-primary">{busy}…</p>}
    </main>
  );
}

function IntentStep({
  text,
  setText,
  compile,
  connected,
  live,
  probing,
  apiError,
  readyBlockers,
  chainMismatch,
  busy,
  onCompile,
  onNext,
}: {
  text: string;
  setText: (v: string) => void;
  compile: CompileOut | null;
  connected: boolean;
  live: boolean;
  probing: boolean;
  apiError: string | null;
  readyBlockers: Ready["checks"];
  chainMismatch: boolean;
  busy: string | null;
  onCompile: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium text-primary">What must stay true</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Write the human objective</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          INTENTOS compiles this into a committed envelope. The agent chooses how. Settlement does not.
        </p>
      </div>
      <NextStepBanner
        tone="wait"
        title="Compile the sample intent"
        body="Connect the wallet, paste or insert the $5,000 text, then Compile. This only locks the rules — nothing is deposited yet."
      />
      <Field name="intent">
        <FieldLabel>Intent</FieldLabel>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={DEMO_PLACEHOLDER}
          rows={5}
        />
      </Field>
      <button
        type="button"
        className="text-xs text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
        onClick={() => setText(DEMO_PLACEHOLDER)}
      >
        Insert the sample intent
      </button>
      {!connected && (
        <p className="text-xs text-challenge">Connect a wallet first — use Connect in the header. MetaMask will offer to add {targetChain.name}.</p>
      )}
      {connected && !live && (
        <div className="rounded-xl border border-challenge/40 px-3 py-2 text-xs text-challenge">
          {probing ? (
            <p className="text-muted-foreground">Checking the 0G rail…</p>
          ) : apiError ? (
            <p>The INTENTOS API is unreachable, so compile is disabled. {apiError}</p>
          ) : chainMismatch ? (
            <p>Wallet/API chain mismatch. Studio expects {targetChain.name} ({targetChain.id}).</p>
          ) : readyBlockers.length ? (
            <ul className="space-y-1">
              {readyBlockers.map((c) => (
                <li key={c.id}>
                  {c.detail}
                  {c.hint ? ` — ${c.hint}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p>The API is not ready. Open /console or GET /ready.</p>
          )}
        </div>
      )}
      <Button className="w-full" disabled={!connected || !live} loading={Boolean(busy)} onClick={onCompile}>
        Compile on 0G
      </Button>
      {compile && (
        <div className="space-y-4">
          {compile.usedModel && (
            <p className="text-xs text-muted-foreground">Compiled with {compile.usedModel}</p>
          )}
          {compile.challenge && (
            <p className="rounded-xl border border-challenge/40 px-3 py-2 text-sm text-challenge">
              {compile.challengeReason}
            </p>
          )}
          <ConstraintChips hard={compile.envelope.constraints.hard} soft={compile.envelope.constraints.soft} />
          <Button className="w-full" variant="outline" onClick={onNext}>
            Continue
          </Button>
        </div>
      )}
    </div>
  );
}

function AnchorStep({
  compile,
  registerTx,
  explorer,
  busy,
  onBack,
  onRegister,
  onNext,
}: {
  compile: CompileOut | null;
  registerTx: string | null;
  explorer?: string;
  busy: string | null;
  onBack: () => void;
  onRegister: () => void;
  onNext: () => void;
}) {
  if (!compile) {
    return <p className="text-sm text-muted-foreground">Compile an intent before anchoring it.</p>;
  }
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium text-primary">On-chain commitment</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Confirm and register</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Only the keccak of the envelope is posted. The document stays off-chain until evidence lands in 0G Storage.
          MetaMask must confirm the signature — if it flags this Vercel URL, that is their phishing list, not a contract bug.
        </p>
      </div>
      <NextStepBanner
        tone="wait"
        title={registerTx ? "Continue to the agent" : "Sign registerIntent"}
        body={
          registerTx
            ? "The envelope is on-chain. Next the agent proposes a plan. Still no deposit."
            : "Approve the MetaMask signature. Funds do not move on this step."
        }
      />
      <div className="divide-y divide-border rounded-xl border border-border">
        <ReviewRow label="Intent hash" value={short(compile.intentHash, 6)} />
        <ReviewRow label="Model" value={compile.usedModel ?? "—"} />
        <ReviewRow label="Hard constraints" value={String(compile.envelope.constraints.hard.length)} />
      </div>
      {compile.challenge && (
        <p className="rounded-xl border border-challenge/40 px-3 py-2 text-sm text-challenge">
          {compile.challengeReason ?? "Some terms are still open. You can register the envelope as written, or go back and add the missing numbers."}
        </p>
      )}
      {compile.storageWarning && (
        <p className="rounded-xl border border-challenge/40 px-3 py-2 text-sm text-challenge">
          {compile.storageWarning}
        </p>
      )}
      {!compile.eip712 && (
        <p className="rounded-xl border border-challenge/40 px-3 py-2 text-sm text-challenge">
          INTENT_REGISTRY_ADDRESS is missing. Deploy contracts first.
        </p>
      )}
      {registerTx && explorer && (
        <p className="text-sm text-success-foreground">
          Anchored.{" "}
          <a className="underline" href={`${explorer}/tx/${registerTx}`} target="_blank" rel="noreferrer">
            {short(registerTx)}
          </a>
        </p>
      )}
      <div className="flex gap-3">
        <Button className="flex-1" variant="outline" type="button" onClick={onBack}>
          Back
        </Button>
        {registerTx ? (
          <Button className="flex-1" onClick={onNext}>
            Continue
          </Button>
        ) : (
          <Button
            className="flex-1"
            disabled={!compile.eip712}
            loading={Boolean(busy)}
            onClick={onRegister}
          >
            Sign & register
          </Button>
        )}
      </div>
    </div>
  );
}

function AgentStep({
  action,
  mode,
  steer,
  setSteer,
  live,
  busy,
  onBack,
  onPropose,
  onNext,
}: {
  action: Action | null;
  mode: Mode | null;
  steer: Mode;
  setSteer: (m: Mode) => void;
  live: boolean;
  busy: string | null;
  onBack: () => void;
  onPropose: (m: Mode) => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium text-primary">Autonomous proposal</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Choose how the agent plans</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Both calls hit 0G Compute. Greedy is the fail demo. Replan is the path toward APPROVE. Neither one deposits.
        </p>
      </div>
      <NextStepBanner
        tone="wait"
        title={action ? "Continue to Verify" : steer === "greedy" ? "Ask for a greedy plan first" : "Ask for a constrained replan"}
        body={
          action
            ? "A proposal is not a pass. Verify it next. Greedy should REJECT. Replan still needs a green APPROVE before deposit."
            : "Start with Greedy to see the vault refuse, then come back and Replan. Or skip straight to Replan if you only want APPROVE."
        }
      />
      <RadioGroup className="gap-3" value={steer} onValueChange={(v) => setSteer(v as Mode)}>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-accent/50 has-[[data-state=checked]]:border-primary/40 has-[[data-state=checked]]:bg-accent/50">
          <Radio className="mt-0.5" value="greedy" />
          <div>
            <p className="text-sm font-medium">Greedy — expect REJECT</p>
            <p className="text-xs text-muted-foreground">Maximize yield. Usually breaks a hard rule. Deposit will fail on purpose.</p>
          </div>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-accent/50 has-[[data-state=checked]]:border-primary/40 has-[[data-state=checked]]:bg-accent/50">
          <Radio className="mt-0.5" value="replan" />
          <div>
            <p className="text-sm font-medium">Replan — try for APPROVE</p>
            <p className="text-xs text-muted-foreground">Obey capital, duration, leverage, and low risk. You still have to Verify after this.</p>
          </div>
        </label>
      </RadioGroup>
      {action && (
        <div className="rounded-xl border border-border p-4">
          <p className="text-[10px] uppercase tracking-[0.16em] text-primary">
            {mode === "greedy" ? "Greedy proposal" : "Replanned proposal"}
          </p>
          <p className="mt-2 text-sm leading-relaxed">{action.plan.summary}</p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <Fact k="Protocol" v={action.params.protocol} />
            <Fact k="Capital" v={`${action.params.capital} ${action.params.currency}`} />
            <Fact k="Leverage" v={String(action.params.leverage)} />
            <Fact k="Risk" v={action.params.riskClass} />
          </dl>
        </div>
      )}
      <div className="flex gap-3">
        <Button className="flex-1" variant="outline" type="button" onClick={onBack}>
          Back
        </Button>
        <Button className="flex-1" disabled={!live} loading={Boolean(busy)} onClick={() => onPropose(steer)}>
          {steer === "replan" ? "Ask for a replan" : "Ask for a greedy plan"}
        </Button>
      </div>
      {action && (
        <Button className="w-full" variant="outline" onClick={onNext}>
          Continue to verify
        </Button>
      )}
    </div>
  );
}

function VerifyStep({
  verify,
  action,
  mode,
  amountOg,
  setAmountOg,
  busy,
  registered,
  live,
  meterBlocked,
  bindExecutor,
  setBindExecutor,
  executorReady,
  onBack,
  onVerify,
}: {
  verify: VerifyOut | null;
  action: Action | null;
  mode: Mode | null;
  amountOg: string;
  setAmountOg: (v: string) => void;
  busy: string | null;
  registered: boolean;
  live: boolean;
  meterBlocked: boolean;
  bindExecutor: boolean;
  setBindExecutor: (v: boolean) => void;
  executorReady: boolean;
  onBack: () => void;
  onVerify: () => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium text-primary">Four-layer scan</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Bind amount and verify</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          This 0G amount is hashed into the attestation. Changing it later makes deposit revert. Verify calls 0G
          Compute, uploads evidence to Storage, then the oracle attests on-chain. {targetShortName} RPC can take up
          to ~3 minutes to index those receipts.
        </p>
      </div>
      <NextStepBanner
        tone={mode === "replan" ? "wait" : "stop"}
        title={
          mode === "replan"
            ? "Verify this replan — it is not approved yet"
            : "Verify the greedy plan — expect REJECT"
        }
        body={
          mode === "replan"
            ? "Replan only wrote a new proposal. Press Verify. Deposit unlocks only if the stamp comes back APPROVE. If it is REJECT or CHALLENGE, replan again."
            : "This is the fail demo. After REJECT, do not deposit. Press Replan, then Verify again."
        }
      />
      {action && (
        <p className="text-xs text-muted-foreground">
          Next check: the {mode === "replan" ? "replanned" : "greedy"} plan for {action.params.protocol} · risk{" "}
          {action.params.riskClass} · {action.params.capital} {action.params.currency}.
        </p>
      )}
      <Field name="amount">
        <FieldLabel>Settlement amount (0G)</FieldLabel>
        <Input value={amountOg} onChange={(e) => setAmountOg(e.target.value)} inputMode="decimal" />
      </Field>
      <details className="rounded-xl border border-white/10 px-4 py-2 text-xs text-muted-foreground">
        <summary className="cursor-pointer select-none text-sm font-medium text-foreground/80">
          Optional Beat 2 · IntentExecutor
        </summary>
        <p className="mt-2 leading-relaxed">
          Leave this off for Beat 1. DemoVault is the product: greedy reverts, replan APPROVE deposits. Checking this
          binds Execute instead of Deposit and waits 15 minutes. One verify = one binding.
        </p>
        <label className="mt-3 flex items-start gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            className="mt-1"
            checked={bindExecutor}
            disabled={!executorReady}
            onChange={(e) => setBindExecutor(e.target.checked)}
          />
          <span>
            Bind IntentExecutor instead of DemoVault
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {executorReady
                ? `Live on ${targetShortName}. Use only after Beat 1 deposit works.`
                : "This API session has no executor address, so Beat 1 DemoVault is the only settlement."}
            </span>
          </span>
        </label>
      </details>
      {!registered && (
        <p className="text-xs text-challenge">
          Anchor the intent first. recordVerification cannot run until registerIntent lands.
        </p>
      )}
      {meterBlocked && (
        <p className="text-xs text-challenge">Deposit meter credits first. Verify is blocked until the prepaid fee is covered.</p>
      )}
      <div className="flex gap-3">
        <Button className="flex-1" variant="outline" type="button" onClick={onBack}>
          Back
        </Button>
        <Button
          className="flex-1"
          disabled={!registered || !live || meterBlocked}
          loading={Boolean(busy)}
          onClick={onVerify}
        >
          {mode === "replan" ? "Verify this replan" : "Verify greedy plan"}
        </Button>
      </div>
      {verify && (
        <div className="space-y-4">
          <VerdictStamp verdict={verify.result.verdict} />
          <p className="text-sm text-muted-foreground">
            Alignment {(verify.result.alignmentScore * 100).toFixed(1)}% · confidence{" "}
            {(verify.result.confidence * 100).toFixed(1)}%
          </p>
          <LayerBreakdown verify={verify} />
        </div>
      )}
    </div>
  );
}

function ProofStep({
  verify,
  settleTx,
  settleErr,
  explorer,
  busy,
  meta,
  agentId,
  onBack,
  onReplan,
  onSettle,
  onExecute,
}: {
  verify: VerifyOut | null;
  settleTx: string | null;
  settleErr: string | null;
  explorer?: string;
  busy: string | null;
  meta: Meta | null;
  agentId?: string | null;
  onBack: () => void;
  onReplan: () => void;
  onSettle: () => void;
  onExecute: () => void;
}) {
  if (!verify) return <p className="text-sm text-muted-foreground">Run verification to mint a certificate.</p>;

  const settled = Boolean(settleTx && !settleErr);
  let amountLabel = verify.vault.call.valueWei || "0";
  try {
    amountLabel = `${formatEther(BigInt(verify.vault.call.valueWei || "0"))} 0G`;
  } catch {
    /* keep wei */
  }

  if (settled) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2Icon className="size-6 text-success" />
        </div>
        <div className="space-y-1">
          <p className="font-semibold">{verify.executor ? "Settled on IntentExecutor" : "Settled on DemoVault"}</p>
          <p className="text-sm text-muted-foreground">
            {verify.executor
              ? "The call matched an APPROVE executor binding after the challenge delay."
              : "The deposit matched an APPROVE attestation."}
          </p>
        </div>
        {explorer && settleTx && (
          <a className="text-sm text-primary underline" href={`${explorer}/tx/${settleTx}`} target="_blank" rel="noreferrer">
            {short(settleTx)}
          </a>
        )}
        <Link className="text-sm text-muted-foreground underline" to={`/proof/${verify.result.actionHash}`}>
          Open certificate
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium text-primary">Evidence & settlement</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">
          {verify.result.verdict === "APPROVE" ? "Cleared — you can deposit" : "Blocked — do not deposit"}
        </h2>
      </div>
      {verify.result.verdict === "APPROVE" ? (
        <NextStepBanner
          tone="go"
          title="Press Deposit"
          body="The oracle attested APPROVE. The vault will accept this amount and action hash."
        />
      ) : (
        <NextStepBanner
          tone="stop"
          title={
            verify.result.verdict === "CHALLENGE"
              ? "CHALLENGE is not a pass. Press Replan."
              : "REJECT is the gate working. Press Replan."
          }
          body="Try deposit anyway will fail in MetaMask on purpose. Replan writes a new plan, then you must Verify again. Repeat until the stamp is APPROVE."
        />
      )}
      <VerdictStamp verdict={verify.result.verdict} />
      <FailedRules checks={verify.result.checks} />
      <LayerBreakdown verify={verify} />
      <div className="divide-y divide-border rounded-xl border border-border">
        <ReviewRow label="Verdict" value={verify.result.verdict} />
        <ReviewRow label="Amount" value={amountLabel} />
        <ReviewRow label="Action" value={short(verify.result.actionHash, 6)} />
        <ReviewRow label="Storage root" value={short(verify.evidenceRoot, 6)} />
      </div>
      <div className="grid gap-4">
        <HashField label="Content hash" value={verify.contentHash} />
        <HashField label="Attestation tx" value={verify.attest?.txHash} />
        {verify.envelopeRoot && <HashField label="Envelope root" value={verify.envelopeRoot} />}
      </div>
      {verify.attest?.ok && verify.attest.explorer && (
        <a className="text-sm text-primary underline" href={verify.attest.explorer} target="_blank" rel="noreferrer">
          Attestation on explorer
        </a>
      )}
      {verify.attest && !verify.attest.ok && (
        <p className="rounded-xl border border-challenge/40 bg-challenge/10 px-3 py-2 text-sm text-challenge">
          On-chain attestation failed — DemoVault will revert. {verify.attest.error}
        </p>
      )}
      {verify.result.verdict !== "APPROVE" && (
        <p className="text-xs text-muted-foreground">
          The vault is locked until APPROVE. Replan is the next action — not deposit.
        </p>
      )}
      {settleErr && (
        <p className="text-sm text-destructive">
          {settleErr}{" "}
          {settleTx && explorer && (
            <a className="underline" href={`${explorer}/tx/${settleTx}`} target="_blank" rel="noreferrer">
              {short(settleTx)}
            </a>
          )}
        </p>
      )}
      <div className="flex gap-3">
        <Button className="flex-1" variant="outline" type="button" onClick={onBack}>
          Back
        </Button>
        {verify.result.verdict !== "APPROVE" ? (
          <Button className="flex-1" onClick={onReplan}>
            Replan, then verify
          </Button>
        ) : verify.executor ? (
          <Button className="flex-1" loading={Boolean(busy)} onClick={onExecute}>
            Execute
          </Button>
        ) : (
          <Button className="flex-1" loading={Boolean(busy)} onClick={onSettle}>
            Deposit
          </Button>
        )}
      </div>
      {verify.executor && (
        <p className="text-xs text-muted-foreground">
          Challenge delay {verify.executor.challengeDelay}s. Execute after unix {verify.executor.executeAfter}.
          DemoVault.deposit on this attestation will revert BindingMismatch.
        </p>
      )}
      {verify.result.verdict !== "APPROVE" && (
        <details className="rounded-xl border border-white/10 px-4 py-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none font-medium text-foreground/80">
            Judge demo: show the vault revert
          </summary>
          <p className="mt-2 leading-relaxed">
            This calls DemoVault.deposit while the stamp is not APPROVE. MetaMask will show a failed interaction.
            That revert is the product — it is not a bug.
          </p>
          <Button className="mt-3 w-full" variant="outline" size="sm" loading={Boolean(busy)} onClick={onSettle}>
            Show IntentNotApproved revert
          </Button>
        </details>
      )}
      {verify.result.verdict === "APPROVE" && verify.executor && (
        <details className="rounded-xl border border-white/10 px-4 py-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none font-medium text-foreground/80">
            Judge demo: DemoVault on an executor binding
          </summary>
          <p className="mt-2 leading-relaxed">
            This attestation is bound to IntentExecutor. DemoVault.deposit should revert BindingMismatch.
          </p>
          <Button className="mt-3 w-full" variant="outline" size="sm" loading={Boolean(busy)} onClick={onSettle}>
            Show BindingMismatch revert
          </Button>
        </details>
      )}
      <GiveFeedback
        agentId={agentId}
        verdict={verify.result.verdict}
        actionHash={verify.result.actionHash}
        evidenceHash={verify.contentHash}
        identityRegistry={meta?.identityRegistry}
        reputationRegistry={meta?.reputationRegistry}
        explorer={explorer}
      />
      {verify.result.verdict === "APPROVE" && (
        <PresentCertificate
          consumer={meta?.consumer}
          intentId={verify.vault.call.intentId}
          actionHash={verify.vault.call.actionHash}
          explorer={explorer}
        />
      )}
      {verify.meter?.ok && verify.meter.txHash && (
        <p className="text-center text-xs text-muted-foreground">Meter debit {short(verify.meter.txHash)}</p>
      )}
      <Link className="block text-center text-sm text-muted-foreground underline" to={`/proof/${verify.result.actionHash}`}>
        Open certificate
      </Link>
    </div>
  );
}

function LayerBreakdown({ verify }: { verify: VerifyOut }) {
  return (
    <div className="space-y-4">
      {verify.result.challengeReason && (
        <p className="rounded-xl border border-challenge/40 px-3 py-2 text-sm text-challenge">
          {verify.result.challengeReason}
        </p>
      )}
      <ul className="divide-y divide-border rounded-xl border border-border text-sm">
        <li className="flex items-center justify-between px-4 py-2.5">
          <span>Layer 1 · rules</span>
          <span className={verify.result.hardConstraintsSatisfied ? "text-primary" : "text-destructive"}>
            {verify.result.hardConstraintsSatisfied ? "PASS" : "FAIL"}
          </span>
        </li>
        <li className="flex items-center justify-between px-4 py-2.5">
          <span>Layer 2 · TEE semantics</span>
          <span className="text-muted-foreground">
            {((verify.result.layerResults?.layer2?.alignmentScore ?? verify.result.alignmentScore) * 100).toFixed(0)}%
            {verify.result.computeEvidence?.teeAttested ? " · TEE" : " · TEE missing"}
          </span>
        </li>
        <li className="flex items-center justify-between px-4 py-2.5">
          <span>Layer 3 · consistency</span>
          <span
            className={verify.result.layerResults?.layer3?.driftedFields?.length ? "text-challenge" : "text-primary"}
          >
            {verify.result.layerResults?.layer3?.driftedFields?.length
              ? `DRIFT · ${verify.result.layerResults.layer3.driftedFields.join(", ")}`
              : "PASS"}
          </span>
        </li>
        <li className="flex items-center justify-between px-4 py-2.5">
          <span>Layer 4 · 0G Storage</span>
          <span className={verify.storageUploaded ? "text-primary" : "text-destructive"}>
            {verify.storageUploaded ? "UPLOADED" : "MISSING"}
          </span>
        </li>
      </ul>
      <ul className="divide-y divide-border rounded-xl border border-border">
        {[...verify.result.checks]
          .sort((a, b) => Number(b.result === "FAIL") - Number(a.result === "FAIL"))
          .map((c, i) => (
            <li key={`${c.constraint}-${i}`} className="px-4 py-2.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span>{c.constraint}</span>
                <span
                  className={
                    c.result === "FAIL"
                      ? "text-destructive"
                      : c.result === "PASS"
                        ? "text-primary"
                        : "text-muted-foreground"
                  }
                >
                  {c.result}
                </span>
              </div>
              {c.result === "FAIL" && c.message ? (
                <p className="mt-1 text-xs text-muted-foreground">{c.message}</p>
              ) : null}
            </li>
          ))}
      </ul>
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{k}</dt>
      <dd className="mt-0.5">{v}</dd>
    </div>
  );
}
