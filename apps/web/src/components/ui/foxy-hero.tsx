import { useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface FoxyHeroProps {
  logo?: {
    icon?: ReactNode;
    text: string;
  };
  navigation?: Array<{
    label: string;
    isActive?: boolean;
    onClick?: () => void;
  }>;
  headerCta?: {
    label: string;
    onClick: () => void;
  };
  title: ReactNode;
  titleAriaLabel?: string;
  subtitle: string;
  ctaButtons?: {
    primary: {
      label: string;
      onClick: () => void;
    };
    secondary: {
      label: string;
      onClick: () => void;
    };
  };
  dashboardImage?: string;
  figure?: ReactNode;
  figureBleed?: boolean;
  className?: string;
  children?: ReactNode;
}

export function FoxyHero({
  logo = { text: "Foxy" },
  navigation = [
    { label: "Home", isActive: true },
    { label: "Features" },
    { label: "Pricing" },
    { label: "Blogs" },
    { label: "Contact" },
  ],
  headerCta,
  title,
  titleAriaLabel,
  subtitle,
  ctaButtons,
  dashboardImage,
  figure,
  figureBleed = false,
  className,
  children,
}: FoxyHeroProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <section
      className={cn("relative flex min-h-[100dvh] w-full flex-col items-center overflow-hidden", className)}
      style={{ background: "#0C0414" }}
      role="banner"
      aria-label="Hero section"
    >
      <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden="true" />

      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55 }}
        className="relative z-10 mt-5 flex w-[min(1196px,95vw)] flex-row items-center justify-between rounded-[18px] px-4 py-2.5"
        style={{
          background: "rgba(8, 2, 14, 0.55)",
          border: "1px solid rgba(192, 105, 255, 0.22)",
          boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
        }}
      >
        <div className="flex flex-row items-center gap-2">
          {logo.icon}
          <span className="text-2xl font-semibold text-white">{logo.text}</span>
        </div>

        <nav className="hidden flex-row items-center gap-7 lg:flex" aria-label="Main navigation">
          {navigation.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={item.onClick}
              className="bg-transparent text-lg font-medium"
              style={{ color: item.isActive ? "#FFFFFF" : "rgba(255, 255, 255, 0.5)" }}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {headerCta && (
            <button
              type="button"
              onClick={headerCta.onClick}
              className="btn hidden h-[41px] min-w-[140px] sm:inline-flex"
            >
              {headerCta.label}
            </button>
          )}
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white lg:hidden"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </motion.header>

      <AnimatePresence>
        {menuOpen && (
          <motion.nav
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="relative z-20 mt-4 w-[min(1196px,95vw)] rounded-2xl border border-white/10 bg-[#160822]/90 p-4 lg:hidden"
            aria-label="Mobile navigation"
          >
            <div className="flex flex-col gap-1">
              {navigation.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    item.onClick?.();
                    setMenuOpen(false);
                  }}
                  className="rounded-xl px-3 py-2.5 text-left text-base"
                  style={{ color: item.isActive ? "#FFFFFF" : "rgba(255,255,255,0.65)" }}
                >
                  {item.label}
                </button>
              ))}
              {headerCta && (
                <button
                  type="button"
                  onClick={() => {
                    headerCta.onClick();
                    setMenuOpen(false);
                  }}
                  className="btn mt-2 sm:hidden"
                >
                  {headerCta.label}
                </button>
              )}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>

      {children ? (
        <div className="relative z-10 flex w-full flex-1 items-center justify-center">{children}</div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.12 }}
          className="relative z-10 mt-16 flex w-[min(810px,90vw)] flex-col items-center gap-10 px-4 sm:mt-20"
        >
          <div className="flex w-full flex-col items-center">
            <h1
              className="text-center"
              aria-label={titleAriaLabel ?? (typeof title === "string" ? title : undefined)}
            >
              {title}
            </h1>
            <p className="mt-3 text-center text-lg text-[#F4DFFF]/80">{subtitle}</p>
          </div>

          {ctaButtons && (
            <div className="flex flex-row flex-wrap items-center justify-center gap-4">
              <button type="button" onClick={ctaButtons.primary.onClick} className="btn min-w-[160px]">
                {ctaButtons.primary.label}
              </button>
              <button type="button" onClick={ctaButtons.secondary.onClick} className="btn-ghost min-w-[160px]">
                {ctaButtons.secondary.label}
              </button>
            </div>
          )}
        </motion.div>
      )}

      {(figure || dashboardImage) && (
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.22 }}
          className={cn("relative z-10 mt-14 w-full pb-16", figureBleed ? "" : "px-4")}
        >
          {figure ? (
            figure
          ) : (
            <img
              src={dashboardImage}
              alt="Product preview"
              className="mx-auto w-[min(1100px,90vw)] rounded-2xl"
            />
          )}
        </motion.div>
      )}
    </section>
  );
}
