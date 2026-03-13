import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Footer8 } from "@/components/blocks/footer-8";
import { LandingHeader } from "@/components/LandingHeader";
import { api, short } from "@/lib/api";
import { targetChain, targetExplorer, targetShortName } from "@/lib/chains";
import type { Meta } from "@/lib/types";
import { DEMO_PLACEHOLDER } from "@/lib/types";

function tokenId(id: string) {
  try {
    return BigInt(id).toString();
  } catch {
    return short(id);
  }
}

const TOC = [
  { id: "overview", label: "Overview" },
  { id: "surfaces", label: "Surfaces" },
  { id: "studio-run", label: "A Studio run" },
  { id: "verdicts", label: "Verdicts" },
  { id: "market-playbook", label: "Market & Playbook" },
  { id: "network", label: "Network" },
  { id: "certificates", label: "Certificates" },
];

const SURFACES = [
  {
    title: "Studio",
    to: "/studio",
    body: "The human gate. Compile an intent, register the hash, ask for a greedy plan, replan, verify, then deposit on DemoVault.",
  },
  {
    title: "Market",
    to: "/market",
    body: "Agent A publishes a requirement. Agent B proposes an offer. IntentBounty funds and pays only after APPROVE.",
  },
  {
    title: "Playbook",
    to: "/playbook",
    body: "Multi-step work. Later steps stay locked until earlier ones return APPROVE and are attested.",
  },
  {
    title: "Console",
    to: "/console",
    body: "Verdict counts, meter credits, and the append-only storage log across Gate, Market, and Playbook.",
  },
];

const RUN = [
  ["Intent", "Write what must stay true. The default demo is the same sentence Studio uses."],
  ["Anchor", "Sign the envelope. Only keccak(intent) is registered on 0G."],
  ["Agent", "Ask for a greedy plan first. It should REJECT. Then replan inside the envelope."],
  ["Verify", "Rules run first and cannot be talked away. Meaning is checked on attested compute. Evidence is stored."],
  ["Proof", "DemoVault.deposit opens only on APPROVE. A mismatched amount reverts BindingMismatch."],
];

export function Docs() {
  const [meta, setMeta] = useState<Meta | null>(null);

  useEffect(() => {
    api<Meta>("/meta")
      .then(setMeta)
      .catch(() => setMeta(null));
    const id = window.location.hash.replace("#", "");
    if (!id) return;
    const t = window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }), 60);
    return () => window.clearTimeout(t);
  }, []);

  const contracts = [
    ["IntentRegistry", meta?.registry],
    ["DemoVault", meta?.vault],
    ["IntentBounty", meta?.bounty],
    ["IntentExecutor", meta?.executor],
    ["VerificationMeter", meta?.meter],
  ] as const;

  return (
    <div className="min-h-svh bg-[#0C0414] text-foreground">
      <LandingHeader active="docs" />

      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 lg:grid-cols-[220px_1fr] lg:py-16">
        <aside className="hidden lg:block">
          <nav className="sticky top-28 space-y-1" aria-label="On this page">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.16em] text-primary">On this page</p>
            {TOC.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="block rounded-lg px-3 py-1.5 text-sm text-white/50 hover:bg-white/5 hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 pb-8">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">Documentation</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            The intent layer, explained.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/65">
            INTENTOS verifies whether an autonomous action still honors the human’s original rules — before money
            moves on 0G.
          </p>

          <section id="overview" className="scroll-mt-28 mt-14">
            <h2 className="text-2xl font-semibold text-white">What it is</h2>
            <p className="mt-3 text-sm leading-relaxed text-white/65">
              A person writes what must stay true. An agent proposes how. INTENTOS compiles that intent, verifies the
              plan, and either approves settlement or lets it fail on-chain. A transfer that is technically valid but
              violates the rules does not go through.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-white/65">
              It does not replace wallets, agents, or policy engines. It answers one question: did this action satisfy
              the original intent?
            </p>
          </section>

          <section id="surfaces" className="scroll-mt-28 mt-14">
            <h2 className="text-2xl font-semibold text-white">Product surfaces</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {SURFACES.map((item) => (
                <Link
                  key={item.title}
                  to={item.to}
                  className="landing-card glass landing-card-plum rounded-2xl p-5 transition hover:border-primary/50"
                >
                  <p className="font-medium text-white">{item.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-white/60">{item.body}</p>
                </Link>
              ))}
            </div>
          </section>

          <section id="studio-run" className="scroll-mt-28 mt-14">
            <h2 className="text-2xl font-semibold text-white">How a Studio run works</h2>
            <p className="mt-3 text-sm leading-relaxed text-white/65">
              Studio is the judge demo. The default intent is: “{DEMO_PLACEHOLDER}”
            </p>
            <ol className="mt-5 space-y-3">
              {RUN.map(([title, body], i) => (
                <li key={title} className="rounded-2xl border border-white/10 bg-[#160822] px-4 py-3">
                  <p className="font-mono text-[11px] text-primary">
                    {String(i + 1).padStart(2, "0")} {title}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-white/65">{body}</p>
                </li>
              ))}
            </ol>
          </section>

          <section id="verdicts" className="scroll-mt-28 mt-14">
            <h2 className="text-2xl font-semibold text-white">Verdicts</h2>
            <dl className="mt-5 space-y-4">
              <div>
                <dt className="font-serif text-2xl italic text-rose-200">REJECT</dt>
                <dd className="mt-1 text-sm leading-relaxed text-white/65">
                  A hard rule failed. DemoVault reverts. Replan, then verify again.
                </dd>
              </div>
              <div>
                <dt className="font-serif text-2xl italic text-[#F5C16A]">CHALLENGE</dt>
                <dd className="mt-1 text-sm leading-relaxed text-white/65">
                  Meaning is unclear. Not a pass. In Console, CHALLENGE means the verify did not settle — not the
                  15-minute IntentExecutor delay.
                </dd>
              </div>
              <div>
                <dt className="font-serif text-2xl italic text-[#F4DFFF]">APPROVE</dt>
                <dd className="mt-1 text-sm leading-relaxed text-white/65">
                  Rules, meaning, and evidence agree. Deposit, bounty claim, or a bound executor call can proceed.
                </dd>
              </div>
            </dl>
          </section>

          <section id="market-playbook" className="scroll-mt-28 mt-14">
            <h2 className="text-2xl font-semibold text-white">Market and Playbook</h2>
            <p className="mt-3 text-sm leading-relaxed text-white/65">
              Market uses the same gate. Agent A compiles and registers a requirement. Agent B’s greedy offer is
              expected to REJECT. Fund and claim stay locked until APPROVE.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-white/65">
              Playbook sequences steps. Allocate must be approved before settle unlocks. Deposit still goes through
              DemoVault after the last APPROVE.
            </p>
          </section>

          <section id="network" className="scroll-mt-28 mt-14">
            <h2 className="text-2xl font-semibold text-white">Network</h2>
            <p className="mt-3 text-sm leading-relaxed text-white/65">
              INTENTOS is live on {targetChain.name} (chain {targetChain.id}). Connect a wallet on {targetShortName}{" "}
              before you compile. Explorer:{" "}
              <a className="text-primary underline-offset-4 hover:underline" href={targetExplorer} target="_blank" rel="noreferrer">
                {targetExplorer.replace("https://", "")}
              </a>
              .
            </p>
            <dl className="mt-5 divide-y divide-white/8 rounded-2xl border border-white/10 bg-[#160822]">
              {contracts.map(([name, addr]) => (
                <div key={name} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <dt className="text-sm text-white/70">{name}</dt>
                  <dd className="font-mono text-xs text-white/85">
                    {addr ? (
                      <a
                        href={`${meta?.explorer ?? targetExplorer}/address/${addr}`}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-primary"
                      >
                        {short(addr)}
                      </a>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            {(meta?.agentId || meta?.requirementAgentId) && (
              <p className="mt-3 text-xs text-white/45">
                ERC-8004
                {meta.agentId ? ` Agent B #${tokenId(meta.agentId)}` : ""}
                {meta.requirementAgentId ? ` · Agent A #${tokenId(meta.requirementAgentId)}` : ""}
              </p>
            )}
          </section>

          <section id="certificates" className="scroll-mt-28 mt-14">
            <h2 className="text-2xl font-semibold text-white">Certificates</h2>
            <p className="mt-3 text-sm leading-relaxed text-white/65">
              Every verdict can be opened as a public certificate at <span className="font-mono text-white/80">/proof/:hash</span>.
              Present it once. Feedback belongs to the principal — the person who wrote the intent — not the agent that
              proposed the plan.
            </p>
          </section>

          <div className="mt-14 flex flex-wrap gap-3">
            <Link to="/studio" className="btn">
              Open studio
            </Link>
            <Link to="/" className="btn-ghost">
              Back to home
            </Link>
          </div>
        </main>
      </div>

      <Footer8 />
    </div>
  );
}
