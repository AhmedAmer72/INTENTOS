/**
 * Footer 8 — minimal centered footer with social icon row and link columns.
 * Official install: REACTBITS_LICENSE_KEY in apps/web/.env.local, then
 *   npx shadcn@latest add @reactbits-pro/footer-8
 */
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { ExternalLink, Globe, LayoutGrid, Wallet } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { Reveal, revealEase, revealViewport, Stagger, StaggerItem } from "@/components/Reveal";

import { targetExplorer } from "@/lib/chains";
import { cn } from "@/lib/utils";

const SOCIAL = [
  { label: "Studio", href: "/studio", icon: Wallet, external: false },
  { label: "Market", href: "/market", icon: LayoutGrid, external: false },
  { label: "0G explorer", href: targetExplorer, icon: ExternalLink, external: true },
  { label: "0G", href: "https://0g.ai", icon: Globe, external: true },
];

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Studio", href: "/studio", external: false },
      { label: "Market", href: "/market", external: false },
      { label: "Console", href: "/console", external: false },
      { label: "Playbook", href: "/playbook", external: false },
      { label: "Docs", href: "/docs", external: false },
      { label: "The gate", href: "/#gate", external: false },
    ],
  },
  {
    title: "Protocol",
    links: [
      { label: "0G Chain", href: targetExplorer, external: true },
      { label: "0G Storage", href: "https://docs.0g.ai", external: true },
      { label: "0G Compute", href: "https://docs.0g.ai", external: true },
      { label: "ERC-8004", href: "https://eips.ethereum.org/EIPS/eip-8004", external: true },
    ],
  },
  {
    title: "Evidence",
    links: [
      { label: "Compile", href: "#features-compile", external: false },
      { label: "Verify", href: "#features-verify", external: false },
      { label: "Settle", href: "#features-settle", external: false },
      { label: "Certificates", href: "/docs#certificates", external: false },
    ],
  },
];

function FooterLink({
  href,
  external,
  children,
}: {
  href: string;
  external?: boolean;
  children: ReactNode;
}) {
  const className = "text-sm text-muted-foreground transition hover:text-primary";
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {children}
      </a>
    );
  }
  if (href.startsWith("#")) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link to={href} className={className}>
      {children}
    </Link>
  );
}

export function Footer8({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  return (
    <footer className={cn("landing-band landing-band-deep border-t border-white/5 px-5 py-16", className)}>
      <div className="mx-auto flex max-w-5xl flex-col items-center text-center">
        <Reveal y={18}>
          <BrandMark size={40} />
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            Intent verification for autonomous AI on 0G. Compile, verify, settle — or revert.
          </p>
        </Reveal>

        <Stagger className="mt-6 flex items-center gap-3">
          {SOCIAL.map((item) => {
            const Icon = item.icon;
            const inner = (
              <motion.span
                whileHover={reduce ? undefined : { y: -3, scale: 1.06 }}
                className="flex size-10 items-center justify-center rounded-full border border-border bg-card/60 text-foreground transition hover:border-primary/50 hover:text-primary"
              >
                <Icon className="size-4" />
                <span className="sr-only">{item.label}</span>
              </motion.span>
            );
            return (
              <StaggerItem key={item.label}>
                {item.external ? (
                  <a href={item.href} target="_blank" rel="noreferrer">
                    {inner}
                  </a>
                ) : (
                  <Link to={item.href}>{inner}</Link>
                )}
              </StaggerItem>
            );
          })}
        </Stagger>

        <Stagger className="mt-12 grid w-full gap-8 text-left sm:grid-cols-3 sm:text-center">
          {COLUMNS.map((column) => (
            <StaggerItem key={column.title}>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">{column.title}</p>
              <ul className="mt-3 space-y-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <FooterLink href={link.href} external={link.external}>
                      {link.label}
                    </FooterLink>
                  </li>
                ))}
              </ul>
            </StaggerItem>
          ))}
        </Stagger>

        <motion.p
          className="mt-12 text-xs text-muted-foreground"
          initial={reduce ? false : { opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={revealViewport}
          transition={{ duration: 0.6, ease: revealEase, delay: 0.15 }}
        >
          © {new Date().getFullYear()} INTENTOS. Fail-closed on 0G.
        </motion.p>
      </div>
    </footer>
  );
}

export default Footer8;
