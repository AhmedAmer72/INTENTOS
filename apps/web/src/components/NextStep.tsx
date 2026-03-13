import type { Check } from "@/lib/types";

export function NextStepBanner({
  title,
  body,
  tone,
}: {
  title: string;
  body: string;
  tone: "go" | "wait" | "stop";
}) {
  const box =
    tone === "go"
      ? "border-primary/40 bg-primary/10"
      : tone === "stop"
        ? "border-destructive/35 bg-destructive/10"
        : "border-challenge/40 bg-challenge/10";
  const eyebrow =
    tone === "go" ? "text-primary" : tone === "stop" ? "text-destructive-foreground" : "text-challenge";
  return (
    <div className={`rounded-xl border px-4 py-3 ${box}`}>
      <p className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${eyebrow}`}>What to do now</p>
      <p className="mt-1 text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

export function FailedRules({ checks }: { checks: Check[] | undefined }) {
  const fails = (checks ?? []).filter((c) => c.result === "FAIL");
  if (!fails.length) return null;
  return (
    <div className="rounded-xl border border-destructive/35 bg-destructive/10 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-destructive-foreground">
        Why this was blocked
      </p>
      <ul className="mt-2 space-y-2">
        {fails.map((c, i) => (
          <li key={`${c.constraintId ?? c.constraint}-${i}`} className="text-sm">
            <span className="font-medium text-foreground">{c.constraint}</span>
            {c.message ? <span className="text-muted-foreground"> — {c.message}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
