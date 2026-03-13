import { Link, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, Gauge, LayoutGrid, Shield, Wallet } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { Features11 } from "@/components/blocks/features-11";
import { Footer8 } from "@/components/blocks/footer-8";
import { HeroProof } from "@/components/HeroProof";
import { Reveal, Stagger, StaggerItem, revealEase, revealViewport } from "@/components/Reveal";
import { FoxyHero } from "@/components/ui/foxy-hero";

function ArtisticSlogan() {
  return (
    <span className="flex flex-col items-center text-[#F4DFFF]">
      <span
        className="font-bold uppercase leading-[0.9] tracking-[-0.04em] text-white"
        style={{ fontSize: "clamp(40px, 8.4vw, 84px)" }}
      >
        Keep the truth
      </span>
      <span
        className="mt-1 font-serif italic leading-[0.86] text-[#C069FF]"
        style={{ fontSize: "clamp(48px, 10vw, 96px)" }}
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
        figure={<HeroProof />}
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
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-4">
        <p className="hidden shrink-0 text-[11px] font-medium uppercase tracking-[0.2em] text-[#EBE1F8]/80 sm:block">
          Built against live 0G
        </p>
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
      featured: true,
    },
    {
      k: "Meter",
      title: "Prepaid verification",
      body: "Deposit 0G once. Every verify — including REJECT — debits VerificationMeter.",
      to: "/console",
      cta: "Usage console",
      icon: Gauge,
      featured: false,
    },
    {
      k: "Market",
      title: "Agent-to-agent",
      body: "Agent A publishes a requirement. Agent B pays the same gate.",
      to: "/market",
      cta: "Open market",
      icon: LayoutGrid,
      featured: false,
    },
  ];
  return (
    <section id="products" className="landing-section">
      <div className="landing-wrap">
        <Reveal>
          <p className="landing-kicker">Three surfaces</p>
          <h2 className="landing-title">
            Gate. Meter. Market.
          </h2>
        </Reveal>
        <Stagger className="mt-12 grid gap-4 lg:grid-cols-2">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <StaggerItem key={item.k} className={item.featured ? "lg:row-span-2" : undefined}>
                <Link
                  to={item.to}
                  className={`landing-card glass group flex h-full flex-col rounded-3xl p-6 sm:p-8 ${
                    item.featured ? "lg:min-h-[28rem] lg:justify-end" : ""
                  }`}
                >
                  <span className="flex size-10 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </span>
                  <p className="mt-6 font-mono text-[11px] tracking-[0.14em] text-primary">{item.k}</p>
                  <h3 className={`mt-2 font-semibold tracking-tight ${item.featured ? "text-3xl" : "text-xl"}`}>
                    {item.title}
                  </h3>
                  <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                  <p className="mt-6 inline-flex items-center gap-1 text-sm text-primary">
                    {item.cta}
                    <ArrowUpRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
                  </p>
                </Link>
              </StaggerItem>
            );
          })}
        </Stagger>
      </div>
    </section>
  );
}

function How() {
  return (
    <section id="how" className="landing-section landing-section-rule">
      <div className="landing-wrap grid items-start gap-12 lg:grid-cols-12">
        <Reveal className="lg:sticky lg:top-28 lg:col-span-5">
          <p className="landing-kicker">The ritual</p>
          <h2 className="landing-title">
            Five steps.
            <span className="mt-2 block font-serif text-[1.15em] font-normal italic text-primary">
              Nothing faked.
            </span>
          </h2>
        </Reveal>
        <ol className="lg:col-span-7">
          {STEPS.map((s, i) => (
            <motion.li
              key={s.n}
              className="grid grid-cols-[auto_1fr] gap-5 border-t border-white/10 py-6 first:border-t-0 first:pt-0"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={revealViewport}
              transition={{ duration: 0.45, delay: i * 0.05, ease: revealEase }}
            >
              <span className="font-mono text-sm text-primary">{s.n}</span>
              <div>
                <h3 className="text-lg font-semibold tracking-tight text-foreground">{s.title}</h3>
                <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Gate() {
  const reduce = useReducedMotion();
  return (
    <section id="gate" className="landing-section">
      <div className="landing-wrap">
        <motion.div
          className="landing-card glass rounded-3xl px-6 py-14 sm:px-14"
          initial={reduce ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={revealViewport}
          transition={{ duration: 0.65, ease: revealEase }}
        >
          <p className="landing-kicker">Load-bearing property</p>
          <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            A valid transaction that violates intent is still a violation.
          </h2>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground">
            DemoVault never reads the model. The gate is <span className="text-foreground">isApproved</span> plus a
            settlement binding over intent, action, and <span className="font-mono text-foreground">msg.value</span>.
            Greedy plans revert. Compliant replans settle. Certificates are public.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link to="/studio" className="btn">
              <Wallet size={16} />
              Open the studio
            </Link>
            <a className="btn-ghost" href="https://chainscan-galileo.0g.ai" target="_blank" rel="noreferrer">
              0G explorer
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
