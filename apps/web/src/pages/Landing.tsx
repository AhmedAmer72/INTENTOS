import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, BookOpen, Gauge, LayoutGrid, ListChecks, Shield, Wallet } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { HeroFigure } from "@/components/HeroFigure";
import { Features11 } from "@/components/blocks/features-11";
import { Footer8 } from "@/components/blocks/footer-8";
import { Reveal, Stagger, StaggerItem, revealEase, revealViewport } from "@/components/Reveal";
import { FoxyHero } from "@/components/ui/foxy-hero";
import { targetChain, targetExplorer, targetShortName } from "@/lib/chains";

function ArtisticSlogan() {
  return (
    <span className="flex flex-col items-center text-[#F4DFFF]">
      <span
        className="font-bold uppercase leading-[0.9] tracking-[-0.04em] text-white"
        style={{
          fontSize: "clamp(40px, 8.4vw, 84px)",
          textShadow: "0 16px 48px rgba(192, 105, 255, 0.35)",
        }}
      >
        Keep the truth
      </span>
      <span
        className="mt-1 font-serif italic leading-[0.86] text-[#C069FF]"
        style={{
          fontSize: "clamp(48px, 10vw, 96px)",
          textShadow: "0 18px 50px rgba(192, 105, 255, 0.5)",
        }}
      >
        revert the rest
      </span>
    </span>
  );
}

const STEPS = [
  { n: "01", title: "Intent", body: "Write what must stay true after the agent acts — in English.", tone: "orchid" },
  { n: "02", title: "Anchor", body: "Sign the envelope. Only the hash is registered on 0G.", tone: "plum" },
  { n: "03", title: "Agent", body: "Ask for a greedy plan, then a replan that stays inside the rules.", tone: "royal" },
  { n: "04", title: "Verify", body: "Rules, attested meaning, stored evidence. APPROVE, REJECT, or CHALLENGE.", tone: "gold" },
  { n: "05", title: "Proof", body: "DemoVault.deposit opens only on APPROVE. Everything else reverts.", tone: "rose" },
];

export function Landing() {
  const navigate = useNavigate();
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const id = window.location.hash.replace("#", "");
    if (!id) return;
    const t = window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }), 60);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="relative overflow-x-hidden bg-[#0C0414]">
      <FoxyHero
        logo={{
          icon: <BrandMark size={48} wordmark={false} to={null} />,
          text: "INTENTOS",
        }}
        navigation={[
          { label: "Home", isActive: true, onClick: () => window.scrollTo({ top: 0, behavior: "smooth" }) },
          { label: "Features", onClick: () => scrollTo("features") },
          { label: "How it works", onClick: () => scrollTo("how") },
          { label: "Docs", onClick: () => navigate("/docs") },
        ]}
        headerCta={{
          label: "Open studio",
          onClick: () => navigate("/studio"),
        }}
        title={<ArtisticSlogan />}
        titleAriaLabel="Keep the truth. Revert the rest."
        subtitle="The intent layer for autonomous AI. If it violates the original rules, it never settles."
        ctaButtons={{
          primary: {
            label: "Open studio",
            onClick: () => navigate("/studio"),
          },
          secondary: {
            label: "Read the docs",
            onClick: () => navigate("/docs"),
          },
        }}
        figureBleed
        figure={<HeroFigure />}
      />
      <LogoStrip />
      <Products />
      <Verdicts />
      <Features11 />
      <How />
      <Gate />
      <Footer8 />
    </div>
  );
}

function LogoStrip() {
  const items = [
    "0G Mainnet",
    `Chain ${targetChain.id}`,
    "APPROVE · REJECT · CHALLENGE",
    "DemoVault",
    "ERC-8004",
    "Public certificates",
  ];
  const track = [...items, ...items, ...items, ...items];
  return (
    <section className="border-y border-white/10 bg-[#8B3FD4]">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-5">
        <Reveal y={12} duration={0.5} className="hidden shrink-0 sm:block">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#EBE1F8]/80">
            Live on {targetShortName}
          </p>
        </Reveal>
        <div className="relative min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
          <div className="landing-marquee gap-10 pr-10">
            {track.map((item, i) => (
              <span key={`${item}-${i}`} className="shrink-0 text-sm text-[#EBE1F8]">
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Products() {
  const items = [
    {
      k: "Studio",
      title: "The human gate",
      body: "Compile, register, verify, then deposit. Greedy should fail. Replan until APPROVE.",
      to: "/studio",
      cta: "Open studio",
      icon: Shield,
      tone: "orchid",
    },
    {
      k: "Market",
      title: "Agents pay the same gate",
      body: "Agent A publishes a requirement. Agent B offers. The bounty pays only after APPROVE.",
      to: "/market",
      cta: "Open market",
      icon: LayoutGrid,
      tone: "plum",
    },
    {
      k: "Playbook",
      title: "Multi-step work",
      body: "Sequential work. Later steps stay locked until earlier ones come back APPROVE.",
      to: "/playbook",
      cta: "Open playbook",
      icon: ListChecks,
      tone: "royal",
    },
    {
      k: "Console",
      title: "Usage and proof",
      body: "Verdict counts, meter credits, and the append-only storage log.",
      to: "/console",
      cta: "Open console",
      icon: Gauge,
      tone: "gold",
    },
  ];
  return (
    <section id="products" className="landing-band landing-band-plum border-y border-white/5">
      <div className="mx-auto max-w-6xl px-5 py-24">
        <Reveal>
          <p className="text-xs font-medium text-primary">Product</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            One gate. Four surfaces.
          </h2>
          <motion.div
            className="mt-4 h-px max-w-40 origin-left bg-gradient-to-r from-primary to-transparent"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={revealViewport}
            transition={{ duration: 0.8, ease: revealEase, delay: 0.12 }}
          />
        </Reveal>
        <Stagger className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <StaggerItem key={item.k}>
                <motion.div whileHover={{ y: -8 }} transition={{ duration: 0.28, ease: revealEase }}>
                  <Link to={item.to} className={`landing-card glass landing-card-${item.tone} group block h-full rounded-3xl p-6`}>
                    <span className="flex size-10 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
                      <Icon className="size-4" />
                    </span>
                    <p className="mt-5 font-mono text-[11px] text-primary">{item.k}</p>
                    <h3 className="mt-2 text-xl font-semibold">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                    <p className="mt-6 inline-flex items-center gap-1 text-sm text-primary">
                      {item.cta}
                      <ArrowUpRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
                    </p>
                  </Link>
                </motion.div>
              </StaggerItem>
            );
          })}
        </Stagger>
      </div>
    </section>
  );
}

function Verdicts() {
  const items = [
    {
      k: "REJECT",
      tone: "rose" as const,
      title: "The vault refuses",
      body: "A hard rule failed. DemoVault.deposit reverts with IntentNotApproved. Press Replan.",
    },
    {
      k: "CHALLENGE",
      tone: "gold" as const,
      title: "Not a pass",
      body: "Meaning is unclear. Settlement stays closed. This is not the 15-minute executor delay.",
    },
    {
      k: "APPROVE",
      tone: "orchid" as const,
      title: "Settlement can open",
      body: "Rules, meaning, and evidence agree. Deposit or bounty claim can proceed.",
    },
  ];
  return (
    <section id="verdicts" className="landing-band landing-band-ink border-y border-white/5">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <Reveal>
          <p className="text-xs font-medium text-primary">Verdicts</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Three stamps. Only one opens the gate.
          </h2>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">
            The same stamps appear in Studio, Market, Playbook, and Console.
          </p>
        </Reveal>
        <Stagger className="mt-10 grid gap-4 md:grid-cols-3">
          {items.map((item) => (
            <StaggerItem key={item.k}>
              <article className={`landing-card glass landing-card-${item.tone} h-full rounded-3xl p-6`}>
                <p className="font-serif text-3xl italic tracking-wide">{item.k}</p>
                <h3 className="mt-3 text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </article>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

function How() {
  const reduce = useReducedMotion();
  return (
    <section id="how" className="landing-band landing-band-royal border-y border-white/5">
      <div className="mx-auto max-w-6xl px-5 py-24">
        <Reveal>
          <p className="text-xs font-medium text-primary">How it works</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            The same five steps as Studio.
          </h2>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">
            Did this action satisfy the original intent? Everything else is in service of that.
          </p>
        </Reveal>
        <div className="relative mt-14">
          <motion.div
            aria-hidden
            className="pointer-events-none absolute top-8 right-[8%] left-[8%] hidden h-px bg-gradient-to-r from-transparent via-primary/55 to-transparent sm:block"
            initial={reduce ? false : { scaleX: 0, opacity: 0 }}
            whileInView={{ scaleX: 1, opacity: 1 }}
            viewport={revealViewport}
            transition={{ duration: 1.05, ease: revealEase }}
            style={{ originX: 0 }}
          />
          <Stagger className="grid gap-4 sm:grid-cols-5">
            {STEPS.map((s) => (
              <StaggerItem key={s.n}>
                <motion.article
                  className={`landing-card glass landing-card-${s.tone} block rounded-3xl p-5 sm:p-6`}
                  whileHover={{ y: -6 }}
                  transition={{ duration: 0.28, ease: revealEase }}
                >
                  <p className="font-mono text-[11px] text-primary">{s.n}</p>
                  <h3 className="mt-3 font-semibold tracking-tight text-foreground">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                </motion.article>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </div>
    </section>
  );
}

function Gate() {
  const reduce = useReducedMotion();
  return (
    <section id="gate" className="landing-band landing-band-ink">
      <div className="mx-auto max-w-6xl px-5 py-24">
        <motion.div
          className="glass landing-card landing-card-rose relative overflow-hidden rounded-3xl px-6 py-14 sm:px-14"
          initial={reduce ? false : { opacity: 0, y: 36, scale: 0.98 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={revealViewport}
          transition={{ duration: 0.8, ease: revealEase }}
        >
          <motion.div
            className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-destructive/15 blur-3xl"
            animate={reduce ? undefined : { opacity: [0.35, 0.75, 0.35], scale: [1, 1.12, 1] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute -bottom-24 -left-10 h-64 w-64 rounded-full bg-primary/20 blur-3xl"
            animate={reduce ? undefined : { opacity: [0.3, 0.7, 0.3], scale: [1, 1.15, 1] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
          />
          <p className="relative text-xs font-medium text-destructive">The load-bearing idea</p>
          <h2 className="relative mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            A valid transaction that violates intent is still a violation.
          </h2>
          <p className="relative mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground">
            DemoVault does not read the model. It reads the attestation. Greedy plans revert. Compliant replans
            settle. Every verdict leaves a public certificate.
          </p>
          <div className="relative mt-10 flex flex-wrap gap-3">
            <Link to="/studio" className="btn">
              <Wallet size={16} />
              Open the studio
            </Link>
            <Link to="/docs" className="btn-ghost">
              <BookOpen size={16} />
              Read the docs
            </Link>
            <a className="btn-ghost" href={targetExplorer} target="_blank" rel="noreferrer">
              {targetShortName} explorer
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
