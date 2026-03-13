import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { parseEther } from "viem";
import { useWallet } from "@/wallet/WalletProvider";
import { api, short } from "@/lib/api";
import { waitForReceipt } from "@/lib/receipt";
import { INTENT_REGISTRY_ABI } from "@/lib/abi";
import { targetChain } from "@/lib/chains";
import { VerdictStamp } from "@/components/VerdictStamp";
import { GiveFeedback } from "@/components/GiveFeedback";
import { PresentCertificate } from "@/components/PresentCertificate";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Action, CompileOut, Envelope, Meta, Ready, VerifyOut } from "@/lib/types";
import { DEMO_PLACEHOLDER } from "@/lib/types";

type Mode = "greedy" | "replan";

export function Market() {
  const { address, ensureChain, client, publicClient } = useWallet();
  const [ready, setReady] = useState<Ready | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [text, setText] = useState(DEMO_PLACEHOLDER);
  const [compile, setCompile] = useState<CompileOut | null>(null);
  const [registerTx, setRegisterTx] = useState<string | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [verify, setVerify] = useState<VerifyOut | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const envelope: Envelope | null = compile?.envelope ?? null;
  const explorer = meta?.explorer ?? ready?.explorer;

  useEffect(() => {
    api<Ready>("/ready").then(setReady).catch(() => setReady(null));
    api<Meta>("/meta").then(setMeta).catch(() => setMeta(null));
  }, []);

  const run = useCallback(async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }, []);

  const onCompile = () =>
    run("Compiling Agent A requirement", async () => {
      if (!address) throw new Error("Connect a wallet first.");
      if (!meta?.requirementAgentId) throw new Error("REQUIREMENT_AGENT_ID is not configured.");
      const out = await api<CompileOut>("/compile", {
        method: "POST",
        body: JSON.stringify({ text: text.trim(), principal: address, agentId: meta.requirementAgentId }),
      });
      setCompile(out);
      setAction(null);
      setMode(null);
      setVerify(null);
      setRegisterTx(null);
    });

  const onRegister = () =>
    run("Signing Agent A envelope", async () => {
      if (!compile?.eip712 || !client || !address) throw new Error("Compile and connect first.");
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
      if (receipt.status !== "success") throw new Error("registerIntent reverted.");
      setRegisterTx(hash);
    });

  const onOffer = (next: Mode) =>
    run(next === "greedy" ? "Agent B maximizing yield" : "Agent B replanning", async () => {
      if (!envelope) throw new Error("Compile Agent A first.");
      const out = await api<{ action: Action; mode: Mode }>("/agent/offer", {
        method: "POST",
        body: JSON.stringify({ requirement: envelope, mode: next }),
      });
      setAction(out.action);
      setMode(out.mode);
      setVerify(null);
    });

  const onVerify = () =>
    run("Verifying A2A on 0G", async () => {
      if (!envelope || !action || !address) throw new Error("Need a requirement, an offer, and a payer.");
      const out = await api<VerifyOut>("/verify/a2a", {
        method: "POST",
        body: JSON.stringify({
          requirement: envelope,
          offer: action,
          payer: address,
          amountWei: parseEther("0.0001").toString(),
          registerTx,
        }),
      });
      setVerify(out);
    });

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-10">
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Market</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Machines pay the same gate</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Agent A publishes a requirement. Agent B offers greedy (expect REJECT) then replans (expect APPROVE).
        </p>
      </div>
      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
        <div className="glass rounded-3xl p-5 sm:p-8">
          <p className="font-mono text-[11px] text-muted-foreground">
            A {short(meta?.requirementAgentId)} · B {short(meta?.agentId)}
          </p>
          <div className="mt-6 space-y-4">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} />
            <Button className="w-full" disabled={!ready?.ok} loading={busy === "Compiling Agent A requirement"} onClick={onCompile}>
              1. Compile as Agent A
            </Button>
            <Button
              className="w-full"
              variant="outline"
              disabled={!compile}
              loading={busy === "Signing Agent A envelope"}
              onClick={onRegister}
            >
              2. Register envelope {registerTx ? `· ${short(registerTx)}` : ""}
            </Button>
            <div className="grid grid-cols-2 gap-3">
              <Button disabled={!registerTx} loading={Boolean(busy?.includes("maximizing"))} onClick={() => onOffer("greedy")}>
                3. B greedy
              </Button>
              <Button disabled={!registerTx} loading={Boolean(busy?.includes("replanning"))} onClick={() => onOffer("replan")}>
                B replan
              </Button>
            </div>
            {action && (
              <p className="text-xs text-muted-foreground">
                {mode} · {action.params.protocol} · {action.params.capital} {action.params.currency}
              </p>
            )}
            <Button className="w-full" disabled={!action} loading={Boolean(busy?.includes("A2A"))} onClick={onVerify}>
              4. Verify A2A
            </Button>
          </div>
        </div>
        <aside className="glass rounded-3xl p-5 sm:p-8">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Offer</p>
          {verify ? (
            <div className="mt-4 space-y-4">
              <VerdictStamp verdict={verify.result.verdict} />
              <p className="text-sm text-muted-foreground">
                Alignment {(verify.result.alignmentScore * 100).toFixed(1)}% · meter{" "}
                {verify.meter?.ok ? short(verify.meter.txHash) : verify.meter?.skipped ? "skipped" : "unpaid"}
              </p>
              <GiveFeedback
                agentId={action?.agentId ?? meta?.agentId}
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
              <Link className="block text-sm text-primary underline" to={`/proof/${verify.result.actionHash}`}>
                Open certificate
              </Link>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Run greedy first — it should REJECT. Replan, then verify again.
            </p>
          )}
        </aside>
      </div>
      {error && <p className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">{error}</p>}
    </main>
  );
}
