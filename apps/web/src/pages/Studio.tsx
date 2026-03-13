import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2Icon } from "lucide-react";
import { BaseError, formatEther, parseEther } from "viem";
import { useWallet } from "@/wallet/WalletProvider";
import { isRequestAlreadyPending, isUserRejected } from "@/wallet/eip1193";
import { api, short } from "@/lib/api";
import { waitForReceipt } from "@/lib/receipt";
import { DEMO_VAULT_ABI, INTENT_REGISTRY_ABI } from "@/lib/abi";
import { targetChain } from "@/lib/chains";
import { ConstraintChips } from "@/components/ConstraintChips";
import { GiveFeedback } from "@/components/GiveFeedback";
import { HashField } from "@/components/HashField";
import { PresentCertificate } from "@/components/PresentCertificate";
import { Stepper } from "@/components/Stepper";
import { VerdictStamp } from "@/components/VerdictStamp";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/v-form-8-utils/field";
import { Input } from "@/components/ui/input";
import { Radio, RadioGroup } from "@/components/ui/v-form-8-utils/radio-group";
import { Textarea } from "@/components/ui/textarea";
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
  const text = err instanceof BaseError ? `${err.shortMessage} ${err.message}` : String(err);
  if (/IntentNotApproved/i.test(text)) {
    if (verdict && verdict !== "APPROVE") {
      return "DemoVault reverted IntentNotApproved. Expected for REJECT/CHALLENGE — replan, verify APPROVE, then deposit.";
    }
    return "DemoVault reverted IntentNotApproved. Register the intent and wait for an APPROVE attestation.";
  }
  if (/BindingMismatch/i.test(text)) {
    return "DemoVault reverted BindingMismatch. The 0G amount must match the amount bound at verify.";
  }
  if (/AlreadySettled/i.test(text)) {
    return "DemoVault reverted AlreadySettled. This (intent, action) pair already deposited.";
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

  const [ready, setReady] = useState<Ready | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
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

  const envelope: Envelope | null = compile?.envelope ?? null;
  const stepIndex = STEPS.findIndex((s) => s.id === stage);
  const explorer = meta?.explorer ?? ready?.explorer;

  const refreshReady = useCallback(() => {
    api<Ready>("/ready")
      .then(setReady)
      .catch(() => setReady(null));
  }, []);

  useEffect(() => {
    refreshReady();
    const id = window.setInterval(refreshReady, 15000);
    api<Meta>("/meta")
      .then(setMeta)
      .catch(() => setMeta(null));
    return () => window.clearInterval(id);
  }, [refreshReady]);

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

  const chainMismatch = Boolean(meta && meta.chainId !== targetChain.id);
  const live = ready?.ok !== false && !chainMismatch;
  const readyBlockers = ready?.checks.filter((c) => c.required && !c.ok) ?? [];

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
      const hash = await client.writeContract({
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
        chain: targetChain,
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
        const hash = await client.writeContract({
          account: address,
          address: verify.vault.address,
          abi: DEMO_VAULT_ABI,
          functionName: "deposit",
          args: [verify.vault.call.intentId, verify.vault.call.actionHash],
          value: BigInt(verify.vault.call.valueWei || "0"),
          chain: targetChain,
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

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-10">
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Gate</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Human verify</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Compile, register, greedy-reject, then replan until APPROVE. Meter, reputation, and present live in the
          session pane.
        </p>
      </div>

      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
        <div className="glass rounded-3xl p-5 sm:p-8">
          <Stepper
            steps={STEPS}
            current={Math.max(stepIndex, 0)}
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
          {chainMismatch ? (
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
      <div className="divide-y divide-border rounded-xl border border-border">
        <ReviewRow label="Intent hash" value={short(compile.intentHash, 6)} />
        <ReviewRow label="Model" value={compile.usedModel ?? "—"} />
        <ReviewRow label="Hard constraints" value={String(compile.envelope.constraints.hard.length)} />
      </div>
      {compile.challenge && (
        <p className="rounded-xl border border-challenge/40 px-3 py-2 text-sm text-challenge">
          {compile.challengeReason ?? "Clarify ambiguous terms before anchoring. The compiler will not guess."}
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
            disabled={!compile.eip712 || compile.challenge}
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
          Both calls hit 0G Compute. Greedy usually violates the envelope. Replan asks the same model to obey it.
        </p>
      </div>
      <RadioGroup className="gap-3" value={steer} onValueChange={(v) => setSteer(v as Mode)}>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-accent/50 has-[[data-state=checked]]:border-primary/40 has-[[data-state=checked]]:bg-accent/50">
          <Radio className="mt-0.5" value="greedy" />
          <div>
            <p className="text-sm font-medium">Greedy</p>
            <p className="text-xs text-muted-foreground">Maximize yield. May break capital, duration, or leverage.</p>
          </div>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-accent/50 has-[[data-state=checked]]:border-primary/40 has-[[data-state=checked]]:bg-accent/50">
          <Radio className="mt-0.5" value="replan" />
          <div>
            <p className="text-sm font-medium">Replan</p>
            <p className="text-xs text-muted-foreground">Stay inside the hard constraints. This is the path to APPROVE.</p>
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
          Ask the agent
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
          Compute, uploads evidence to Storage, then the oracle attests on-chain. Galileo RPC can take up to ~3
          minutes to index those receipts.
        </p>
      </div>
      {action && (
        <p className="text-xs text-muted-foreground">
          Verifying the {mode === "replan" ? "replanned" : "greedy"} plan for {action.params.protocol}.
        </p>
      )}
      <Field name="amount">
        <FieldLabel>Settlement amount (0G)</FieldLabel>
        <Input value={amountOg} onChange={(e) => setAmountOg(e.target.value)} inputMode="decimal" />
      </Field>
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
          Verify on 0G
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
          <p className="font-semibold">Settled on DemoVault</p>
          <p className="text-sm text-muted-foreground">The deposit matched an APPROVE attestation.</p>
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
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Review, then settle</h2>
      </div>
      <VerdictStamp verdict={verify.result.verdict} />
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
          Deposit must revert with IntentNotApproved. That revert is the product. Replan and verify until APPROVE.
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
            Replan
          </Button>
        ) : (
          <Button className="flex-1" loading={Boolean(busy)} onClick={onSettle}>
            Deposit
          </Button>
        )}
      </div>
      {verify.result.verdict !== "APPROVE" && (
        <Button className="w-full" variant="outline" loading={Boolean(busy)} onClick={onSettle}>
          Try deposit anyway
        </Button>
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
            {verify.result.computeEvidence?.teeAttested ? " · TEE" : ""}
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
        {verify.result.checks.map((c, i) => (
          <li key={`${c.constraint}-${i}`} className="flex items-center justify-between px-4 py-2.5 text-sm">
            <span>{c.constraint}</span>
            <span
              className={
                c.result === "FAIL" ? "text-destructive" : c.result === "PASS" ? "text-primary" : "text-muted-foreground"
              }
            >
              {c.result}
            </span>
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
