import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { parseEther } from "viem";
import { useWallet } from "@/wallet/WalletProvider";
import { api, short } from "@/lib/api";
import { waitForReceipt } from "@/lib/receipt";
import { INTENT_BOUNTY_ABI, INTENT_REGISTRY_ABI } from "@/lib/abi";
import { targetChain, targetShortName } from "@/lib/chains";
import { writeTargetContract } from "@/lib/tx";
import { VerdictStamp } from "@/components/VerdictStamp";
import { GiveFeedback } from "@/components/GiveFeedback";
import { FailedRules, NextStepBanner } from "@/components/NextStep";
import { PresentCertificate } from "@/components/PresentCertificate";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Action, CompileOut, Envelope, Meta, Ready, VerifyOut } from "@/lib/types";
import { DEMO_PLACEHOLDER } from "@/lib/types";

type Mode = "greedy" | "replan";
type MarketNext = "connect" | "compile" | "register" | "greedy" | "verify" | "replan" | "fund" | "claim" | "done";

function marketGuide(args: {
  connected: boolean;
  live: boolean;
  compile: boolean;
  registered: boolean;
  hasAction: boolean;
  mode: Mode | null;
  verdict?: VerifyOut["result"]["verdict"];
  funded: boolean;
  claimed: boolean;
}): { id: MarketNext; title: string; body: string; tone: "go" | "wait" | "stop" } {
  if (!args.connected) {
    return {
      id: "connect",
      tone: "wait",
      title: "Connect a wallet",
      body: `Use Connect in the header. Market compile and bounty calls need a ${targetShortName} account.`,
    };
  }
  if (!args.live) {
    return {
      id: "compile",
      tone: "stop",
      title: "The live rail is not ready",
      body: "Open Console and wait until required checks are green, then come back.",
    };
  }
  if (!args.compile) {
    return {
      id: "compile",
      tone: "wait",
      title: "Compile as Agent A",
      body: "This publishes the requirement. Nothing is paid yet.",
    };
  }
  if (!args.registered) {
    return {
      id: "register",
      tone: "wait",
      title: "Register the envelope",
      body: "Sign registerIntent. Agent B cannot be verified until this lands.",
    };
  }
  if (!args.hasAction) {
    return {
      id: "greedy",
      tone: "wait",
      title: "Ask Agent B for a greedy offer",
      body: "Greedy is meant to REJECT. After verify, come back and press B replan.",
    };
  }
  if (!args.verdict) {
    return {
      id: "verify",
      tone: args.mode === "replan" ? "wait" : "stop",
      title: args.mode === "replan" ? "Verify this replan — not a pass yet" : "Verify the greedy offer — expect REJECT",
      body: "An offer is not approval. Fund and claim stay locked until the stamp is APPROVE.",
    };
  }
  if (args.verdict !== "APPROVE") {
    return {
      id: "replan",
      tone: "stop",
      title: "Offer blocked. Press B replan, then Verify again.",
      body: "Do not fund the bounty. REJECT and CHALLENGE cannot be claimed. Repeat replan + verify until APPROVE.",
    };
  }
  if (!args.funded) {
    return {
      id: "fund",
      tone: "go",
      title: "Fund the bounty",
      body: "This offer is APPROVE. Lock 0.0001 0G on IntentBounty, then claim.",
    };
  }
  if (!args.claimed) {
    return {
      id: "claim",
      tone: "go",
      title: "Claim the bounty",
      body: "The escrow is funded. Claim pays Agent B for the approved offer.",
    };
  }
  return {
    id: "done",
    tone: "go",
    title: "A2A pay finished",
    body: "Open the certificate if you want the explorer links. Give feedback from a wallet that does not own the registered agent.",
  };
}

export function Market() {
  const { address, isConnected, ensureChain, client, publicClient } = useWallet();
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
  const [bountyTx, setBountyTx] = useState<string | null>(null);
  const [claimTx, setClaimTx] = useState<string | null>(null);

  const envelope: Envelope | null = compile?.envelope ?? null;
  const explorer = meta?.explorer ?? ready?.explorer;
  const chainMismatch = Boolean(meta && meta.chainId !== targetChain.id);
  const live = ready?.ok !== false && !chainMismatch;
  const guide = marketGuide({
    connected: isConnected,
    live,
    compile: Boolean(compile),
    registered: Boolean(registerTx),
    hasAction: Boolean(action),
    mode,
    verdict: verify?.result.verdict,
    funded: Boolean(bountyTx),
    claimed: Boolean(claimTx),
  });
  const approved = verify?.result.verdict === "APPROVE";

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
      setBountyTx(null);
      setClaimTx(null);
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

  const onFund = () =>
    run("Funding IntentBounty", async () => {
      if (!verify || !meta?.bounty || !client || !address) {
        throw new Error("Verify first and set INTENT_BOUNTY_ADDRESS.");
      }
      await ensureChain();
      const hash = await writeTargetContract(client, publicClient, {
        account: address,
        address: meta.bounty,
        abi: INTENT_BOUNTY_ABI,
        functionName: "fund",
        args: [verify.vault.call.intentId, verify.vault.call.actionHash],
        value: parseEther("0.0001"),
      });
      const receipt = await waitForReceipt(publicClient, hash);
      if (receipt.status !== "success") throw new Error("IntentBounty.fund reverted.");
      setBountyTx(hash);
    });

  const onClaim = () =>
    run("Claiming IntentBounty", async () => {
      if (!verify || !meta?.bounty || !client || !address) {
        throw new Error("Fund after APPROVE, then claim.");
      }
      await ensureChain();
      const hash = await writeTargetContract(client, publicClient, {
        account: address,
        address: meta.bounty,
        abi: INTENT_BOUNTY_ABI,
        functionName: "claim",
        args: [verify.vault.call.intentId, verify.vault.call.actionHash, address],
      });
      const receipt = await waitForReceipt(publicClient, hash);
      if (receipt.status !== "success") throw new Error("IntentBounty.claim reverted. Need APPROVE.");
      setClaimTx(hash);
    });

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-10">
      <div className="mb-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Market</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Machines pay the same gate</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Same gate as Studio, but Agent B pays after APPROVE. Greedy should fail. Replan, then verify again.
          Fund and claim stay locked until the stamp is green.
        </p>
        {chainMismatch && meta && (
          <p className="mt-4 rounded-2xl border border-challenge/40 bg-challenge/10 px-4 py-3 text-sm text-challenge">
            Web is on chain {targetChain.id} ({targetChain.name}) but the API signed for {meta.chainId} (
            {meta.network}). Align VITE_CHAIN_ID and ZEROG_NETWORK.
          </p>
        )}
      </div>
      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
        <div className="glass rounded-3xl p-5 sm:p-8">
          <NextStepBanner title={guide.title} body={guide.body} tone={guide.tone} />
          <p className="mt-4 font-mono text-[11px] text-muted-foreground">
            A {short(meta?.requirementAgentId)} · B {short(meta?.agentId)}
          </p>
          <div className="mt-6 space-y-4">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} />
            <Button
              className="w-full"
              variant={guide.id === "compile" ? "default" : "outline"}
              disabled={!isConnected || !live}
              loading={busy === "Compiling Agent A requirement"}
              onClick={onCompile}
            >
              1. Compile as Agent A
            </Button>
            <Button
              className="w-full"
              variant={guide.id === "register" ? "default" : "outline"}
              disabled={!compile}
              loading={busy === "Signing Agent A envelope"}
              onClick={onRegister}
            >
              2. Register envelope {registerTx ? `· ${short(registerTx)}` : ""}
            </Button>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant={guide.id === "greedy" ? "default" : "outline"}
                disabled={!registerTx}
                loading={Boolean(busy?.includes("maximizing"))}
                onClick={() => onOffer("greedy")}
              >
                3. B greedy
              </Button>
              <Button
                variant={guide.id === "replan" ? "default" : "outline"}
                disabled={!registerTx}
                loading={Boolean(busy?.includes("replanning"))}
                onClick={() => onOffer("replan")}
              >
                B replan
              </Button>
            </div>
            {action && (
              <p className="text-xs text-muted-foreground">
                {mode} · {action.params.protocol} · {action.params.capital} {action.params.currency} · risk{" "}
                {action.params.riskClass}
              </p>
            )}
            <Button
              className="w-full"
              variant={guide.id === "verify" ? "default" : "outline"}
              disabled={!action}
              loading={Boolean(busy?.includes("A2A"))}
              onClick={onVerify}
            >
              4. Verify A2A
            </Button>
            {!approved && verify && (
              <p className="text-xs text-challenge">Fund and claim stay locked until APPROVE.</p>
            )}
            <Button
              className="w-full"
              variant={guide.id === "fund" ? "default" : "outline"}
              disabled={!approved || !meta?.bounty}
              loading={busy === "Funding IntentBounty"}
              onClick={onFund}
            >
              5. Fund bounty {bountyTx ? `· ${short(bountyTx)}` : ""}
            </Button>
            <Button
              className="w-full"
              variant={guide.id === "claim" ? "default" : "outline"}
              disabled={!bountyTx || !approved}
              loading={busy === "Claiming IntentBounty"}
              onClick={onClaim}
            >
              6. Claim bounty {claimTx ? `· ${short(claimTx)}` : ""}
            </Button>
          </div>
        </div>
        <aside className="glass rounded-3xl p-5 sm:p-8">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Offer</p>
          {verify ? (
            <div className="mt-4 space-y-4">
              <VerdictStamp verdict={verify.result.verdict} />
              <FailedRules checks={verify.result.checks} />
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
              Follow the highlighted button. Greedy first, then replan after REJECT. Bounty buttons stay dim until
              APPROVE.
            </p>
          )}
        </aside>
      </div>
      {error && <p className="mt-4 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">{error}</p>}
    </main>
  );
}
