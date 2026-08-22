import { Link, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, Gauge, LayoutGrid, Shield, Wallet } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { Features11 } from "@/components/blocks/features-11";
import { Footer8 } from "@/components/blocks/footer-8";
import { Reveal, Stagger, StaggerItem, revealEase, revealViewport } from "@/components/Reveal";
import { TiltedTiles } from "@/components/ui/tilted-tiles";
import { FoxyHero } from "@/components/ui/foxy-hero";
import { INTENT_TILES } from "@/lib/intent-tiles";

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
  { n: "01", title: "Write the intent", body: "What must remain true after the agent acts — in English, not a policy DSL." },
  { n: "02", title: "Anchor the hash", body: "EIP-712 sign the envelope. Only the keccak goes on IntentRegistry." },
  { n: "03", title: "Let the agent plan", body: "Greedy maximize yield, or replan inside the envelope. Both calls are live 0G Compute." },
  { n: "04", title: "Verify four layers", body: "Rules, semantics, consistency, storage. Stamp APPROVE, REJECT, or CHALLENGE." },
  { n: "05", title: "Settle or revert", body: "Approved actions deposit. Violations revert on 0G Chain — explorers included." },
];

export function Landing() {
  const navigate = useNavigate();
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="relative overflow-x-hidden bg-[#0C0414]">
      <FoxyHero
        logo={{
          icon: <BrandMark size={40} wordmark={false} to={null} />,
          text: "INTENTOS",
        }}
        navigation={[
          { label: "Home", isActive: true, onClick: () => window.scrollTo({ top: 0, behavior: "smooth" }) },
          { label: "Features", onClick: () => scrollTo("features") },
          { label: "How it works", onClick: () => scrollTo("how") },
        ]}
        headerCta={{
          label: "Open studio",
          onClick: () => navigate("/studio"),
        }}
        title={<ArtisticSlogan />}
        titleAriaLabel="Keep the truth. Revert the rest."
        subtitle="If it violates intent, it never settles."
        ctaButtons={{
          primary: {
            label: "Open studio",
            onClick: () => navigate("/studio"),
          },
          secondary: {
            label: "How it works",
            onClick: () => scrollTo("how"),
          },
        }}
        figureBleed
        figure={
          <TiltedTiles
            images={INTENT_TILES}
            columns={14}
            tilesPerColumn={5}
            tileAspect={1}
            rowGap={10}
            columnGap={10}
            borderRadius={16}
            rotateX={38}
            rotateY={14}
            rotateZ={-18}
            offsetX={-24}
            planeWidth={260}
            planeHeight={270}
            stagger={18}
            duration={28}
            fadeTop={16}
            fadeBottom={14}
            parallax
            parallaxStrength={6}
            saturation={1.08}
            width="100%"
            height="100%"
          />
        }
      />
      <LogoStrip />
      <Products />
      <Features11 />
      <How />
      <Gate />
      <Footer8 />
    </div>
  );
}

function LogoStrip() {
  const items = ["0G Chain", "0G Storage", "0G Compute", "ERC-8004", "EIP-712"];
  const track = [...items, ...items, ...items, ...items];
  return (
    <section className="border-y border-white/10 bg-[#8B3FD4]">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-5">
        <Reveal y={12} duration={0.5} className="hidden shrink-0 sm:block">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#EBE1F8]/80">
            Built against live 0G
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
      k: "Gate",
      title: "Compile, verify, settle",
      body: "The fail-closed path. Greedy REJECT, replan APPROVE, DemoVault reads isApproved.",
      to: "/studio",
      cta: "Open studio",
      icon: Shield,
    },
    {
      k: "Meter",
      title: "Prepaid verification",
      body: "Deposit 0G once. Every verify — including REJECT — debits VerificationMeter.",
      to: "/console",
      cta: "Usage console",
      icon: Gauge,
    },
    {
      k: "Market",
      title: "Agent-to-agent",
      body: "Agent A publishes a requirement. Agent B pays the same gate. No human in the loop after envelopes exist.",
      to: "/market",
      cta: "Open market",
      icon: LayoutGrid,
    },
  ];
  return (
    <section id="products" className="mx-auto max-w-6xl px-5 py-24">
      <Reveal>
        <p className="text-xs font-medium text-primary">Three products</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Gate. Meter. Market.
        </h2>
        <motion.div
          className="mt-4 h-px max-w-40 origin-left bg-gradient-to-r from-primary to-transparent"
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={revealViewport}
          transition={{ duration: 0.8, ease: revealEase, delay: 0.12 }}
        />
      </Reveal>
      <Stagger className="mt-12 grid gap-4 md:grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <StaggerItem key={item.k}>
              <motion.div whileHover={{ y: -8 }} transition={{ duration: 0.28, ease: revealEase }}>
                <Link to={item.to} className="landing-card glass group block rounded-3xl p-6">
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
    </section>
  );
}

function How() {
  const reduce = useReducedMotion();
  return (
    <section id="how" className="border-y border-white/5 bg-gradient-to-b from-ink-2/30 to-transparent">
      <div className="mx-auto max-w-6xl px-5 py-24">
        <Reveal>
          <p className="text-xs font-medium text-primary">The ritual</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Five steps. Nothing faked.
          </h2>
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
                  className="landing-card glass block rounded-3xl p-5 sm:p-6"
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
    <section id="gate" className="mx-auto max-w-6xl px-5 py-24">
      <motion.div
        className="glass landing-card relative overflow-hidden rounded-3xl px-6 py-14 sm:px-14"
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
        <p className="relative text-xs font-medium text-destructive">Load-bearing property</p>
        <h2 className="relative mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          A valid transaction that violates intent is still a violation.
        </h2>
        <p className="relative mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground">
          DemoVault never reads the model. The gate is <span className="text-foreground">isApproved</span> plus a
          settlement binding over intent, action, and <span className="font-mono text-foreground">msg.value</span>.
          Greedy plans revert. Compliant replans settle. Certificates are public.
        </p>
        <div className="relative mt-10 flex flex-wrap gap-3">
          <Link to="/studio" className="btn">
            <Wallet size={16} />
            Open the studio
          </Link>
          <a className="btn-ghost" href="https://chainscan-galileo.0g.ai" target="_blank" rel="noreferrer">
            0G explorer
          </a>
        </div>
      </motion.div>
    </section>
  );
}
