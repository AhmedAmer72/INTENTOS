import { useCallback, useEffect, useState } from "react";
import { parseEther } from "viem";
import { useWallet } from "@/wallet/WalletProvider";
import { api, short } from "@/lib/api";
import { waitForReceipt } from "@/lib/receipt";
import { DEMO_VAULT_ABI, INTENT_REGISTRY_ABI } from "@/lib/abi";
import { targetChain } from "@/lib/chains";
import { PresentCertificate } from "@/components/PresentCertificate";
import { VerdictStamp } from "@/components/VerdictStamp";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Action, CompileOut, Envelope, Meta, Ready, VerifyOut } from "@/lib/types";
import { DEMO_PLACEHOLDER } from "@/lib/types";

type Mode = "greedy" | "replan";

function bindStep(action: Action, stepId: string): Action {
  return { ...action, stepId, params: { ...action.params, stepId } };
}

export function Playbook() {
  const { address, ensureChain, client, publicClient } = useWallet();
  const [ready, setReady] = useState<Ready | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [text, setText] = useState(DEMO_PLACEHOLDER);
  const [compile, setCompile] = useState<CompileOut | null>(null);
  const [registerTx, setRegisterTx] = useState<string | null>(null);
  const [step1, setStep1] = useState<VerifyOut | null>(null);
  const [step2, setStep2] = useState<VerifyOut | null>(null);
  const [settleTx, setSettleTx] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const envelope: Envelope | null = compile?.envelope ?? null;
  const explorer = meta?.explorer ?? ready?.explorer;
  const step1Approved = Boolean(step1?.result.verdict === "APPROVE" && step1.attest?.ok);

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
    run("Compiling playbook", async () => {
      if (!address) throw new Error("Connect a wallet first.");
      const out = await api<CompileOut>("/compile", {
        method: "POST",
        body: JSON.stringify({ text: text.trim(), principal: address, playbook: true }),
      });
      setCompile(out);
      setRegisterTx(null);
      setStep1(null);
      setStep2(null);
      setSettleTx(null);
    });

  const onRegister = () =>
    run("Signing playbook", async () => {
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

  const verifyStep = (stepId: string, mode: Mode, previous: string[]) =>
    run(`Verifying ${stepId}`, async () => {
      if (!envelope || !address) throw new Error("Compile first.");
      const proposed = await api<{ action: Action }>("/agent/propose", {
        method: "POST",
        body: JSON.stringify({ intent: envelope, mode }),
      });
      const action = bindStep(proposed.action, stepId);
      const out = await api<VerifyOut>("/verify/step", {
        method: "POST",
        body: JSON.stringify({
          intent: envelope,
          action,
          stepId,
          previousActionHashes: previous,
          payer: address,
          amountWei: parseEther("0.0001").toString(),
          registerTx,
        }),
      });
      if (stepId === "allocate") setStep1(out);
      else setStep2(out);
    });

  const onSettle = () =>
    run("Settling final step", async () => {
      if (!step2 || !client || !address || !step2.vault.address) throw new Error("Step 2 must APPROVE first.");
      await ensureChain();
      const hash = await client.writeContract({
        account: address,
        address: step2.vault.address,
        abi: DEMO_VAULT_ABI,
        functionName: "deposit",
        args: [step2.vault.call.intentId, step2.vault.call.actionHash],
        value: BigInt(step2.vault.call.valueWei || "0"),
        chain: targetChain,
      });
      await waitForReceipt(publicClient, hash);
      setSettleTx(hash);
    });

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-10">
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Playbook</p>
        <h1 className="mt-1 font-serif text-3xl sm:text-4xl">Allocate, then settle</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Step 2 cannot verify until step 1 is APPROVE on-chain. DemoVault.deposit runs only on the final step.
        </p>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="glass rounded-3xl p-5 sm:p-8 space-y-4">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} />
          <Button className="w-full" disabled={!ready?.ok} loading={Boolean(busy?.includes("playbook"))} onClick={onCompile}>
            Compile two-step envelope
          </Button>
          <Button className="w-full" variant="outline" disabled={!compile} loading={Boolean(busy?.includes("Signing"))} onClick={onRegister}>
            Register {registerTx ? `· ${short(registerTx)}` : ""}
          </Button>
        </div>
        <div className="space-y-4">
          <div className="glass rounded-3xl p-5 space-y-3">
            <p className="font-serif text-xl">1 · Allocate inside caps</p>
            <Button
              className="w-full"
              disabled={!registerTx}
              loading={busy === "Verifying allocate"}
              onClick={() => verifyStep("allocate", "replan", [])}
            >
              Verify step 1
            </Button>
            {step1 && <VerdictStamp verdict={step1.result.verdict} />}
          </div>
          <div className="glass rounded-3xl p-5 space-y-3">
            <p className="font-serif text-xl">2 · Settle</p>
            {!step1Approved && (
              <p className="text-xs text-challenge">Locked until step 1 is APPROVE + attested.</p>
            )}
            <Button
              className="w-full"
              disabled={!step1Approved}
              loading={busy === "Verifying settle"}
              onClick={() => verifyStep("settle", "replan", step1 ? [step1.result.actionHash] : [])}
            >
              Verify step 2
            </Button>
            {step2 && <VerdictStamp verdict={step2.result.verdict} />}
            <Button
              className="w-full"
              variant="outline"
              disabled={step2?.result.verdict !== "APPROVE"}
              loading={Boolean(busy?.includes("Settling"))}
              onClick={onSettle}
            >
              Deposit on DemoVault
            </Button>
            {settleTx && explorer && (
              <a className="block text-xs text-primary underline" href={`${explorer}/tx/${settleTx}`} target="_blank" rel="noreferrer">
                settled {short(settleTx)}
              </a>
            )}
            {step2?.result.verdict === "APPROVE" && (
              <PresentCertificate
                consumer={meta?.consumer}
                intentId={step2.vault.call.intentId}
                actionHash={step2.vault.call.actionHash}
                explorer={explorer}
              />
            )}
          </div>
        </div>
      </div>
      {error && <p className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">{error}</p>}
    </main>
  );
}
