const STEPS = ["Intent", "Anchor", "Agent", "Verify", "Proof"];

export function StudioPreview() {
  return (
    <div className="bg-card/90 text-left">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold tracking-wide text-foreground">
          <img src="/logo.png" alt="" className="h-7 w-auto object-contain mix-blend-screen" />
          INTENTOS
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Studio</span>
        </div>
        <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 font-mono text-[11px] text-primary">
          0xf01…30b
        </span>
      </div>

      <div className="grid grid-cols-5 gap-1 px-5 pt-5">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-col items-center gap-1.5">
            <span
              className={`flex size-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                i === 0
                  ? "border-2 border-primary text-primary"
                  : i < 4
                    ? "border border-border text-muted-foreground"
                    : "bg-primary text-primary-foreground"
              }`}
            >
              {i + 1}
            </span>
            <span className={`text-[10px] font-medium ${i === 0 ? "text-foreground" : "text-muted-foreground"}`}>
              {label}
            </span>
          </div>
        ))}
      </div>

      <div className="grid gap-4 p-5 md:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-3">
          <p className="text-xs font-medium text-primary">What must stay true</p>
          <h3 className="text-2xl font-semibold tracking-tight text-foreground">Write the human objective</h3>
          <div className="rounded-xl border border-border bg-background/50 p-3 text-sm leading-relaxed text-muted-foreground">
            Deploy $5,000 USDC into a low-risk yield opportunity for 14 days. No leverage.
          </div>
          <div className="flex flex-wrap gap-2">
            {["HARD · $5,000 USDC", "HARD · 14 days", "HARD · no leverage"].map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[11px] text-foreground"
              >
                {chip}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-border bg-background/40 p-4">
          <div>
            <p className="text-xs font-medium text-destructive">Settlement gate</p>
            <p className="mt-3 inline-flex rotate-[-6deg] rounded-2xl border-2 border-reject/70 px-5 py-2 font-serif text-3xl italic tracking-wide text-reject shadow-[0_0_40px_rgba(251,113,133,0.2)]">
              REJECT
            </p>
            <p className="mt-5 font-mono text-[11px] text-muted-foreground">DemoVault.deposit → IntentNotApproved</p>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            A valid transfer that violates intent still reverts. Replan until APPROVE.
          </p>
        </div>
      </div>
    </div>
  );
}
