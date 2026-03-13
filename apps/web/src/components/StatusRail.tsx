import { motion } from "motion/react";
import type { Ready, ReadyCheck } from "@/lib/types";
import { cn } from "@/lib/utils";

const ORDER = [
  "router_key",
  "router_live",
  "storage_upload",
  "registry",
  "vault",
  "oracle_key",
  "oracle_funded",
  "oracle_role",
  "agent_id",
  "deployer_key",
  "deployer_funded",
  "meter",
  "meter_settler",
  "consumer",
  "agentic_id",
  "tee_model",
  "executor",
  "settlement_target",
  "bounty",
  "agentic_id_v2",
  "requirement_agent",
  "reputation",
];

const LABELS: Record<string, string> = {
  router_key: "Router key",
  router_live: "Router",
  storage_upload: "Storage",
  registry: "Registry",
  vault: "Vault",
  oracle_key: "Oracle",
  oracle_funded: "Oracle gas",
  oracle_role: "Oracle role",
  agent_id: "Agent ID",
  deployer_key: "Deployer",
  deployer_funded: "Deployer gas",
  meter: "Meter",
  meter_settler: "Meter settler",
  consumer: "Consumer",
  agentic_id: "Agentic ID",
  tee_model: "TEE model",
  executor: "Executor",
  settlement_target: "Settlement",
  bounty: "Bounty",
  agentic_id_v2: "Agentic ID v2",
  requirement_agent: "Req. agent",
  reputation: "Reputation",
};

export function StatusRail({ ready, className }: { ready: Ready | null; className?: string }) {
  if (!ready) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-primary/20 bg-black/35 px-4 py-3 text-[11px] tracking-wide text-white/40 backdrop-blur-xl",
          className,
        )}
      >
        Probing 0G…
      </div>
    );
  }

  const byId = new Map(ready.checks.map((c) => [c.id, c]));
  const items = ORDER.map((id) => byId.get(id)).filter(Boolean) as ReadyCheck[];
  const blocked = ready.checks.filter((c) => c.required && !c.ok);
  const okCount = items.filter((c) => c.ok).length;

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-primary/20 bg-black/35 shadow-[0_12px_36px_rgba(12,4,20,0.35)] backdrop-blur-xl",
        className,
      )}
      aria-label="Live 0G stack"
    >
      <div className="flex items-center justify-between gap-3 px-4 pt-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary">Live 0G</p>
        <p className="text-[11px] tracking-wide text-mute">
          {okCount}/{items.length} · {ready.network} · {ready.chainId}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 px-4 py-3">
        {items.map((c) => (
          <span
            key={c.id}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2 py-0.5 text-[11px] tracking-wide text-mute"
            title={c.detail}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${c.ok ? "bg-brass shadow-[0_0_8px_rgba(192,105,255,0.9)]" : "bg-reject/80"}`}
            />
            {LABELS[c.id] ?? c.id}
          </span>
        ))}
      </div>
      {!ready.ok && blocked[0] && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-t border-white/5 bg-ink-2/80 px-4 py-2 text-xs text-challenge"
        >
          Blocked: {blocked[0].detail}
          {blocked[0].hint ? ` — ${blocked[0].hint}` : ""}
        </motion.p>
      )}
    </section>
  );
}
