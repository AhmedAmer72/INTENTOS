/**
 * Features 11 — editorial split headline with three indexed, anchored workflow cards.
 * Official install: REACTBITS_LICENSE_KEY in apps/web/.env.local, then
 *   npx shadcn@latest add @reactbits-pro/features-11
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
    <section id="features" className={cn("mx-auto max-w-6xl px-5 py-24", className)}>
      <div className="grid items-start gap-12 lg:grid-cols-12 lg:gap-16">
        <Reveal className="lg:sticky lg:top-28 lg:col-span-5" y={20}>
          <p className="text-xs font-medium text-primary">Capabilities</p>
          <h2 className="mt-4 max-w-sm text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Not a copilot.
            <span className="mt-2 block text-muted-foreground">A gate in front of autonomous money.</span>
          </h2>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground">
            INTENTOS does not replace wallets, agents, or policy engines. It answers one question: did this action
            satisfy the human’s original intent?
          </p>
          <div className="mt-8 flex flex-wrap gap-4 text-sm">
            {CARDS.map((card, i) => (
              <motion.a
                key={card.id}
                href={`#${card.id}`}
                className="font-mono text-xs text-primary underline-offset-4 hover:underline"
                initial={reduce ? false : { opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={revealViewport}
                transition={{ delay: 0.15 + i * 0.08, duration: 0.45, ease: revealEase }}
              >
                {card.index} {card.kicker}
              </motion.a>
            ))}
          </div>
        </Reveal>

        <div className="relative lg:col-span-7">
          <motion.span
            aria-hidden
            className="pointer-events-none absolute top-6 bottom-6 left-[1.15rem] hidden w-px origin-top bg-gradient-to-b from-primary/70 via-primary/25 to-transparent sm:block"
            initial={reduce ? false : { scaleY: 0 }}
            whileInView={{ scaleY: 1 }}
            viewport={revealViewport}
            transition={{ duration: 1.1, ease: revealEase }}
          />
          <Stagger className="space-y-4">
            {CARDS.map((card) => (
              <StaggerItem key={card.id}>
                <motion.article
                  id={card.id}
                  className="landing-card glass scroll-mt-28 rounded-3xl p-6 sm:p-7"
                  whileHover={{ y: -6 }}
                  transition={{ duration: 0.28, ease: revealEase }}
                >
                  <div className="flex items-start gap-4">
                    <span className="relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-ink font-mono text-xs text-primary">
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
                </motion.article>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </div>
    </section>
  );
}

export default Features11;
