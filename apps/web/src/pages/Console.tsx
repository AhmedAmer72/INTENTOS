import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { isAddress } from "viem";
import { api, short } from "@/lib/api";
import { waitForReceipt } from "@/lib/receipt";
import { AGENTIC_ID_V2_ABI } from "@/lib/abi";
import { targetChain } from "@/lib/chains";
import { NextStepBanner } from "@/components/NextStep";
import { StatusRail } from "@/components/StatusRail";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/wallet/WalletProvider";
import type { Meta, Ready } from "@/lib/types";

type Usage = {
  counts: { APPROVE: number; REJECT: number; CHALLENGE: number; total: number };
  debitedWei: string;
  latestBatchRoot: string | null;
  batches: { id: string; root: string; count: number; createdAt: string }[];
  items: {
    id: string;
    actionHash: string;
    verdict: string;
    alignment: number;
    evidenceRoot: string | null;
    verifyTx: string | null;
    meterTx: string | null;
    payer: string | null;
    teeProvider: string | null;
    mode: string | null;
    createdAt: string;
  }[];
};

type LogOut = {
  batches: { id: string; root: string; count: number; explorer: string }[];
  pending: number;
};

export function ConsolePage() {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [log, setLog] = useState<LogOut | null>(null);
  const [ready, setReady] = useState<Ready | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);

  useEffect(() => {
    api<Usage>("/usage").then(setUsage).catch(() => setUsage(null));
    api<LogOut>("/log").then(setLog).catch(() => setLog(null));
    api<Meta>("/meta").then(setMeta).catch(() => setMeta(null));
    const loadReady = () =>
      api<Ready>("/ready")
        .then(setReady)
        .catch(() => setReady(null));
    loadReady();
    const id = window.setInterval(loadReady, 15000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:py-10">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Usage</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Console</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A log of Gate, Market, and Playbook verifies. CHALLENGE here means a verify did not settle — not a 15-minute
          executor wait.
        </p>
      </div>
      {(usage?.counts.total ?? 0) === 0 ? (
        <NextStepBanner
          tone="wait"
          title="No verifies yet"
          body="Start on Gate: compile, greedy-reject, replan until APPROVE, then deposit. This page fills in after that."
        />
      ) : (
        <NextStepBanner
          tone="wait"
          title="This is a log, not a next action"
          body="Open a certificate from the table if you need explorer links. Agentic ID transfer below is optional Wave 6."
        />
      )}
      <StatusRail ready={ready} />
      <AgenticV2Transfer meta={meta} />
      <div className="grid gap-3 sm:grid-cols-4">
        {(["APPROVE", "REJECT", "CHALLENGE", "total"] as const).map((k) => (
          <div key={k} className="glass rounded-2xl p-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{k}</p>
            <p className="mt-1 font-serif text-3xl">{usage?.counts[k] ?? 0}</p>
          </div>
        ))}
      </div>
      <div className="glass rounded-2xl p-5">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Batch log</p>
        <p className="mt-1 font-mono text-xs break-all">
          latest root {usage?.latestBatchRoot ?? log?.batches[0]?.root ?? "—"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          pending events {log?.pending ?? 0} · DA deferred; this is the append-only execution log.
        </p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card/40">
        <table className="w-full text-left text-xs">
          <thead className="bg-black/30 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Verdict</th>
              <th className="px-3 py-2">Mode</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Meter</th>
            </tr>
          </thead>
          <tbody>
            {(usage?.items ?? []).length === 0 && (
              <tr>
                <td className="px-3 py-6 text-muted-foreground" colSpan={5}>
                  Empty until you finish a verify on Gate, Market, or Playbook.
                </td>
              </tr>
            )}
            {(usage?.items ?? []).map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="px-3 py-2 text-muted-foreground">
                  {new Date(row.createdAt).toLocaleString()}
                </td>
                <td className="px-3 py-2">{row.verdict}</td>
                <td className="px-3 py-2">{row.mode ?? "human"}</td>
                <td className="px-3 py-2">
                  <Link to={`/proof/${row.actionHash}`} className="font-mono text-brass hover:underline">
                    {short(row.actionHash)}
                  </Link>
                </td>
                <td className="px-3 py-2 font-mono">{row.meterTx ? short(row.meterTx) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function AgenticV2Transfer({ meta }: { meta: Meta | null }) {
  const { address, client, publicClient, ensureChain } = useWallet();
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tx, setTx] = useState<string | null>(null);

  if (!meta?.agenticIdV2 || !meta.agenticTokenV2) {
    return (
      <div className="glass rounded-2xl p-5">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Agentic ID v2</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Agentic ID v2 is already on Galileo. This API session is missing AGENTIC_ID_V2_ADDRESS — set it on the API
          env. Do not redeploy.
        </p>
      </div>
    );
  }

  const onTransfer = async () => {
    if (!address || !client) {
      setError("Connect the token holder wallet.");
      return;
    }
    if (!isAddress(to)) {
      setError("Recipient must be a 0x address.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await ensureChain();
      const proofOut = await api<{ proof: `0x${string}` }>("/agentic/v2/proof", {
        method: "POST",
        body: JSON.stringify({
          kind: "transfer",
          tokenId: meta.agenticTokenV2,
          from: address,
          to,
        }),
      });
      const hash = await client.writeContract({
        account: address,
        address: meta.agenticIdV2!,
        abi: AGENTIC_ID_V2_ABI,
        functionName: "transfer",
        args: [address, to as `0x${string}`, BigInt(meta.agenticTokenV2!), "0x", proofOut.proof],
        chain: targetChain,
      });
      const receipt = await waitForReceipt(publicClient, hash);
      if (receipt.status !== "success") throw new Error("Agentic ID v2 transfer reverted.");
      setTx(hash);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <details className="glass rounded-2xl p-5">
      <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Optional · Agentic ID v2 transfer
      </summary>
      <p className="mt-2 font-mono text-xs break-all">
        {meta.agenticIdV2} · token #{meta.agenticTokenV2}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        Oracle-gated transfer for Beat 4. Skip this until Gate deposit works. Use a recipient address you control.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="0x recipient" />
        <Button loading={busy} onClick={onTransfer}>
          Transfer
        </Button>
      </div>
      {tx && meta.explorer && (
        <a className="mt-2 inline-block text-xs text-primary underline" href={`${meta.explorer}/tx/${tx}`} target="_blank" rel="noreferrer">
          {short(tx)}
        </a>
      )}
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </details>
  );
}
