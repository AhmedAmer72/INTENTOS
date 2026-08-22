import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, short } from "@/lib/api";
import { StatusRail } from "@/components/StatusRail";
import type { Ready } from "@/lib/types";

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

  useEffect(() => {
    api<Usage>("/usage").then(setUsage).catch(() => setUsage(null));
    api<LogOut>("/log").then(setLog).catch(() => setLog(null));
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
        <h1 className="mt-1 font-serif text-3xl sm:text-4xl">Console</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last verifications, meter debits, and the append-only 0G Storage batch log.
        </p>
      </div>
      <StatusRail ready={ready} />
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
