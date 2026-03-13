/**
 * Features 11 — editorial split headline with three indexed workflow cards.
 */
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight } from "lucide-react";

import { Reveal, revealEase, revealViewport, Stagger, StaggerItem } from "@/components/Reveal";
import { cn } from "@/lib/utils";

const CARDS = [
  {
    id: "features-compile",
    index: "01",
    kicker: "Compile",
    title: "Intent becomes an envelope",
    body: "Natural language is compiled on 0G Compute into hard caps, duration, leverage, and allowed actions. Ambiguity is a CHALLENGE — never a guessed number.",
    points: ["Structured constraints", "No silent defaults", "Hash-ready document"],
  },
  {
    id: "features-verify",
    index: "02",
    kicker: "Verify",
    title: "Four layers, fail-closed",
    body: "Deterministic rules run first. TEE-backed semantics may only downgrade APPROVE. Evidence is uploaded to 0G Storage — the merkle root is what gets attested.",
    points: ["Layer 1 cannot be overruled", "TEE-backed Layer 2", "Storage roots, not local keccak"],
  },
  {
    id: "features-settle",
    index: "03",
    kicker: "Settle",
    title: "The revert is the product",
    body: "DemoVault.deposit reads isApproved. A technically valid transfer that violates intent fails with IntentNotApproved. Every verdict mints a public certificate.",
    points: ["IntentNotApproved on greedy plans", "Binding over msg.value", "Portable proof pages"],
  },
];

export function Features11({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  return (
    <section id="features" className={cn("landing-section landing-section-rule", className)}>
      <div className="landing-wrap grid items-start gap-12 lg:grid-cols-12 lg:gap-16">
        <Reveal className="lg:sticky lg:top-28 lg:col-span-5" y={20}>
          <p className="landing-kicker">Capabilities</p>
          <h2 className="landing-title landing-title-wide">
            Not a copilot.
            <span className="mt-2 block font-serif text-[1.05em] font-normal italic text-primary">
              A gate in front of autonomous money.
            </span>
          </h2>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground">
            INTENTOS does not replace wallets, agents, or policy engines. It answers one question: did this action
            satisfy the human’s original intent?
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            {CARDS.map((card, i) => (
              <motion.a
                key={card.id}
                href={`#${card.id}`}
                className="font-mono text-xs text-primary underline-offset-4 hover:underline"
                initial={reduce ? false : { opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={revealViewport}
                transition={{ delay: 0.1 + i * 0.06, duration: 0.4, ease: revealEase }}
              >
                {card.index} {card.kicker}
              </motion.a>
            ))}
          </div>
        </Reveal>

        <Stagger className="space-y-4 lg:col-span-7">
          {CARDS.map((card) => (
            <StaggerItem key={card.id}>
              <article id={card.id} className="landing-card glass scroll-mt-28 rounded-3xl p-6 sm:p-7">
                <div className="flex items-start gap-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-[#0C0414] font-mono text-xs text-primary">
                    {card.index}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-primary">{card.kicker}</p>
                    <h3 className="mt-1 text-xl font-semibold tracking-tight text-foreground">{card.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{card.body}</p>
                    <ul className="mt-4 space-y-1.5">
                      {card.points.map((point) => (
                        <li key={point} className="flex gap-2 text-sm text-foreground/85">
                          <span className="mt-2 size-1 shrink-0 rounded-full bg-primary" />
                          {point}
                        </li>
                      ))}
                    </ul>
                    <Link
                      to="/studio"
                      className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    >
                      Run this in the studio
                      <ArrowUpRight className="size-3.5" />
                    </Link>
                  </div>
                </div>
              </article>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

export default Features11;
