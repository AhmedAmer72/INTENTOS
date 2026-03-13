type ProofPanel =
  | {
      kicker: string;
      title: string;
      meta: string;
      note: string;
    }
  | {
      kicker: string;
      stamp: string;
      stampTone: "rose" | "paper";
      meta: string;
      note: string;
    };

const PANELS: ProofPanel[] = [
  {
    kicker: "INTENT",
    title: "Write what must stay true",
    meta: "Deploy $5,000 USDC · 14 days",
    note: "No leverage. Low risk only.",
  },
  {
    kicker: "SETTLEMENT GATE",
    stamp: "REJECT",
    stampTone: "rose",
    meta: "DemoVault.deposit",
    note: "IntentNotApproved",
  },
  {
    kicker: "VERDICT",
    stamp: "APPROVE",
    stampTone: "paper",
    meta: "Alignment 94.2%",
    note: "Ready to settle",
  },
];

export function HeroProof() {
  return (
    <div className="hero-proof mx-auto w-full max-w-5xl px-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {PANELS.map((panel) => (
          <article key={panel.kicker} className="hero-proof-card rounded-2xl p-5">
            <p className="font-mono text-[10px] tracking-[0.16em] text-primary">{panel.kicker}</p>
            {"title" in panel ? (
              <h3 className="mt-4 text-lg font-semibold leading-snug tracking-tight text-foreground">
                {panel.title}
              </h3>
            ) : (
              <p
                className={`mt-5 inline-block rounded-xl border px-4 py-2 font-serif text-3xl italic leading-none ${
                  panel.stampTone === "rose"
                    ? "border-[#FECDD3]/50 text-[#FECDD3]"
                    : "border-[#F4DFFF]/45 text-[#F4DFFF]"
                }`}
              >
                {panel.stamp}
              </p>
            )}
            <p className="mt-5 font-mono text-[11px] text-muted-foreground">{panel.meta}</p>
            <p className="mt-1 text-sm text-foreground/80">{panel.note}</p>
          </article>
        ))}
      </div>
      <p className="mt-4 text-center font-mono text-[11px] tracking-[0.14em] text-muted-foreground">
        Galileo · 16602 · isApproved is the only gate
      </p>
    </div>
  );
}
