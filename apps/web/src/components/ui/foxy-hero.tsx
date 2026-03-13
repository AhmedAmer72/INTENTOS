import React, { useState } from "react";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface FoxyHeroProps {
  logo?: {
    icon?: React.ReactNode;
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
  title: React.ReactNode;
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
  figure?: React.ReactNode;
  figureBleed?: boolean;
  className?: string;
  children?: React.ReactNode;
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
      className={cn(
        "relative flex min-h-screen w-full flex-col items-center overflow-hidden",
        className,
      )}
      style={{ background: "#0C0414" }}
      role="banner"
      aria-label="Hero section"
    >
      <div className="hero-atmosphere pointer-events-none absolute inset-0" aria-hidden="true" />

      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 flex flex-row items-center justify-between px-4"
        style={{
          width: "min(1196px, 95vw)",
          marginTop: "22px",
          padding: "10px 16px",
          borderRadius: "18px",
          background: "rgba(8, 2, 14, 0.45)",
          border: "1px solid rgba(192, 105, 255, 0.22)",
          boxShadow: "0 0 0 1px rgba(192,105,255,0.06), 0 16px 40px rgba(0,0,0,0.35), 0 0 32px rgba(192,105,255,0.12)",
        }}
      >
        <div className="flex flex-row items-center justify-center" style={{ gap: "7px" }}>
          {logo.icon}
          <span
            style={{
              fontFamily: "Inter, sans-serif",
              fontStyle: "normal",
              fontWeight: 600,
              fontSize: "24px",
              lineHeight: "29px",
              color: "#FFFFFF",
              filter: "drop-shadow(0px 4px 4px rgba(0, 0, 0, 0.25))",
            }}
          >
            {logo.text}
          </span>
        </div>

        <nav
          className="hidden flex-row items-center lg:flex"
          style={{ gap: "28px" }}
          aria-label="Main navigation"
        >
          {navigation.map((item, index) => (
            <button
              key={index}
              type="button"
              onClick={item.onClick}
              className="transition-opacity hover:opacity-100"
              style={{
                fontFamily: "Inter, sans-serif",
                fontStyle: "normal",
                fontWeight: 500,
                fontSize: "18px",
                lineHeight: "29px",
                color: item.isActive ? "#FFFFFF" : "rgba(255, 255, 255, 0.5)",
                opacity: item.isActive ? 1 : 0.5,
                background: "transparent",
                border: 0,
                cursor: "pointer",
              }}
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
              className="hidden flex-row items-center justify-center transition-all hover:scale-105 sm:flex"
              style={{
                padding: "6px 16px",
                minWidth: "140px",
                height: "41px",
                background:
                  "radial-gradient(50% 50% at 50% 50%, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.1) 50%, rgba(255, 255, 255, 0.2) 100%), #551A94",
                borderRadius: "100px",
                fontFamily: "Inter, sans-serif",
                fontWeight: 500,
                fontSize: "16px",
                lineHeight: "29px",
                color: "#FFFFFF",
                border: 0,
                cursor: "pointer",
              }}
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
            className="relative z-20 mt-4 w-[min(1196px,95vw)] rounded-2xl border border-white/10 bg-[#160822]/90 p-4 backdrop-blur-xl lg:hidden"
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
                  style={{
                    fontFamily: "Inter, sans-serif",
                    color: item.isActive ? "#FFFFFF" : "rgba(255,255,255,0.65)",
                    background: "transparent",
                    border: 0,
                    cursor: "pointer",
                  }}
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
                  className="mt-2 rounded-full px-4 py-2 text-white sm:hidden"
                  style={{
                    background:
                      "radial-gradient(50% 50% at 50% 50%, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.1) 50%, rgba(255, 255, 255, 0.2) 100%), #551A94",
                    border: 0,
                    cursor: "pointer",
                    fontFamily: "Inter, sans-serif",
                    fontWeight: 500,
                  }}
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
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3 }}
          className="relative z-10 flex flex-col items-center px-4"
          style={{
            width: "min(810px, 90vw)",
            gap: "41px",
            marginTop: figureBleed ? "clamp(40px, 7vh, 88px)" : "clamp(64px, 12vh, 145px)",
          }}
        >
          <div className="flex w-full flex-col items-center" style={{ gap: "0px" }}>
            <motion.h1
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.5 }}
              className="text-center"
              aria-label={titleAriaLabel ?? (typeof title === "string" ? title : undefined)}
              style={
                typeof title === "string"
                  ? {
                      fontFamily: "Inter, sans-serif",
                      fontStyle: "normal",
                      fontWeight: 700,
                      fontSize: "clamp(32px, 5vw, 64px)",
                      lineHeight: "1.2",
                      background:
                        "linear-gradient(91.84deg, #231233 -12.23%, #F4DFFF 66.73%, #231233 119.29%), #F4DFFF",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }
                  : undefined
              }
            >
              {title}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.7 }}
              className="text-center"
              style={{
                fontFamily: "Inter, sans-serif",
                fontStyle: "normal",
                fontWeight: 400,
                fontSize: "clamp(16px, 2vw, 20px)",
                lineHeight: "1.2",
                background:
                  "linear-gradient(91.3deg, #231233 -10.75%, #F4DFFF 13.44%, #F4DFFF 96.07%, #231233 103.03%), #F4DFFF",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                marginTop: "10px",
              }}
            >
              {subtitle}
            </motion.p>
          </div>

          {ctaButtons && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.9 }}
              className="flex flex-row flex-wrap items-center justify-center"
              style={{ gap: "24px" }}
            >
              <button
                type="button"
                onClick={ctaButtons.primary.onClick}
                className="flex flex-row items-center justify-center transition-all hover:scale-105"
                style={{
                  padding: "6px 16px",
                  minWidth: "160px",
                  height: "41px",
                  background:
                    "radial-gradient(50% 50% at 50% 50%, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.1) 50%, rgba(255, 255, 255, 0.2) 100%), #551A94",
                  borderRadius: "100px",
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 500,
                  fontSize: "16px",
                  lineHeight: "29px",
                  color: "#FFFFFF",
                  border: 0,
                  cursor: "pointer",
                }}
              >
                {ctaButtons.primary.label}
              </button>
              <button
                type="button"
                onClick={ctaButtons.secondary.onClick}
                className="flex flex-row items-center justify-center transition-all hover:scale-105"
                style={{
                  padding: "6px 16px",
                  minWidth: "180px",
                  height: "41px",
                  borderRadius: "100px",
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 500,
                  fontSize: "16px",
                  lineHeight: "29px",
                  color: "#FFFFFF",
                  background: "transparent",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  cursor: "pointer",
                }}
              >
                {ctaButtons.secondary.label}
              </button>
            </motion.div>
          )}
        </motion.div>
      )}

      {(figure || dashboardImage) && (
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: 1.2 }}
          className={cn("relative z-10", figureBleed ? "w-full" : "px-4")}
          style={{
            width: figureBleed ? "100%" : "min(1100px, 90vw)",
            height: "auto",
            marginTop: figureBleed ? "clamp(28px, 6vh, 72px)" : "clamp(64px, 10vh, 180px)",
            marginBottom: figureBleed ? 0 : "80px",
          }}
        >
          <div
            className="pointer-events-none absolute"
            style={{
              left: "50%",
              transform: "translateX(-50%)",
              top: "-56px",
              width: "836px",
              height: "220px",
              background:
                "radial-gradient(ellipse at 50% 40%, rgba(192, 105, 255, 0.42) 0%, rgba(155, 79, 224, 0.18) 42%, transparent 72%)",
            }}
          />

          <div
            className="pointer-events-none absolute"
            style={{
              width: "520px",
              height: "80px",
              left: "50%",
              transform: "translateX(-50%)",
              bottom: "-12px",
              background: "radial-gradient(ellipse at center, rgba(143, 83, 208, 0.45) 0%, transparent 72%)",
            }}
          />

          <div
            className="relative overflow-hidden"
            style={{
              width: "100%",
              height: figureBleed ? "min(640px, 64vh)" : "auto",
              aspectRatio: figure || figureBleed ? undefined : "1100 / 783",
              borderRadius: figureBleed ? 0 : "20px",
              background: figureBleed
                ? "transparent"
                : "linear-gradient(0deg, rgba(0, 0, 0, 0.12), rgba(0, 0, 0, 0.12)), #160822",
              boxShadow: figureBleed ? "none" : "0 0 0 1px rgba(244, 223, 255, 0.1)",
            }}
          >
            {figure ? (
              <div className="h-full w-full">{figure}</div>
            ) : (
              <img
                src={dashboardImage}
                alt="Product preview"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            )}
            {figureBleed ? (
              <>
                <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-[#0C0414] to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#0C0414] to-transparent" />
                <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[#0C0414] to-transparent sm:w-16" />
                <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#0C0414] to-transparent sm:w-16" />
              </>
            ) : null}
          </div>
        </motion.div>
      )}

      {!figure && !dashboardImage && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 1.2 }}
          className="relative z-10 w-full overflow-hidden"
          style={{
            marginTop: "clamp(80px, 12vh, 150px)",
            paddingBottom: "80px",
          }}
        >
          <div className="relative w-full">
            <div
              className="pointer-events-none absolute top-0 bottom-0 left-0 z-10"
              style={{
                width: "200px",
                background: "linear-gradient(90deg, #0C0414 0%, rgba(12, 4, 20, 0) 100%)",
              }}
            />
            <div
              className="pointer-events-none absolute top-0 right-0 bottom-0 z-10"
              style={{
                width: "200px",
                background: "linear-gradient(270deg, #0C0414 0%, rgba(12, 4, 20, 0) 100%)",
              }}
            />

            <motion.div
              className="flex items-center"
              animate={{ x: [0, -1920] }}
              transition={{
                x: {
                  repeat: Infinity,
                  repeatType: "loop",
                  duration: 30,
                  ease: "linear",
                },
              }}
              style={{ gap: "80px", paddingLeft: "80px" }}
            >
              {[...Array(2)].map((_, setIndex) => (
                <React.Fragment key={setIndex}>
                  <div className="flex h-20 w-[180px] flex-shrink-0 items-center justify-center">
                    <svg width="120" height="60" viewBox="0 0 256 417" fill="none" aria-hidden="true">
                      <path d="M127.961 0L125.507 8.17L125.507 285.168L127.961 287.618L255.922 212.32L127.961 0Z" fill="#F4DFFF" fillOpacity="0.6" />
                      <path d="M127.96 0L0 212.32L127.96 287.618V154.158V0Z" fill="#F4DFFF" fillOpacity="0.4" />
                    </svg>
                  </div>
                  <div className="flex h-20 w-[180px] flex-shrink-0 items-center justify-center">
                    <svg width="100" height="100" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                      <circle cx="16" cy="16" r="16" fill="#F4DFFF" fillOpacity="0.2" />
                      <path d="M21.5 15.5C21.5 14.5 20.8 13.8 20 13.5C20.5 13 20.8 12.3 20.5 11.5C20.2 10.3 19 9.8 17.8 10.2L17.5 8.5H16L16.3 10.2C15.9 10.3 15.5 10.4 15.1 10.5L14.8 8.5H13.3L13.6 10.2C13.3 10.3 12.9 10.4 12.6 10.5L10.5 11L11 12.5C11 12.5 12 12.2 12 12.3C12.5 12.2 12.8 12.5 12.9 12.9L13.5 16.5L13.6 19.5C13.6 19.8 13.5 20.2 13 20.3C13.1 20.3 12 20.6 12 20.6L11.5 22.2L13.5 21.7C13.9 21.6 14.2 21.5 14.6 21.4L14.9 23.2H16.4L16.1 21.4C16.5 21.3 16.9 21.2 17.3 21.1L17.6 22.9H19.1L18.8 21.1C20.3 20.8 21.5 19.8 21.5 18.2C21.6 17 21 16.2 20 15.8C20.8 15.5 21.4 14.8 21.5 13.9V15.5ZM18.5 18.5C18.5 19.5 16.5 19.8 15.5 20L15.2 17C16.2 16.8 18.5 16.5 18.5 18.5ZM17.5 13C17.5 14 15.8 14.2 15 14.4L14.7 11.9C15.5 11.7 17.5 11.4 17.5 13Z" fill="#F4DFFF" fillOpacity="0.8" />
                    </svg>
                  </div>
                  <div className="flex h-20 w-[180px] flex-shrink-0 items-center justify-center">
                    <svg width="100" height="100" viewBox="0 0 126 126" fill="none" aria-hidden="true">
                      <path d="M38.171 53.203L62.998 28.376L87.826 53.203L101.648 39.381L62.998 0.731L24.348 39.381L38.171 53.203Z" fill="#F4DFFF" fillOpacity="0.6" />
                      <path d="M0.85 62.997L14.672 49.175L28.494 62.997L14.672 76.819L0.85 62.997Z" fill="#F4DFFF" fillOpacity="0.5" />
                      <path d="M38.171 72.791L62.998 97.618L87.826 72.791L101.648 86.614L62.998 125.264L24.348 86.614L38.171 72.791Z" fill="#F4DFFF" fillOpacity="0.6" />
                      <path d="M97.502 62.997L111.324 49.175L125.146 62.997L111.324 76.819L97.502 62.997Z" fill="#F4DFFF" fillOpacity="0.5" />
                    </svg>
                  </div>
                  <div className="flex h-20 w-[180px] flex-shrink-0 items-center justify-center">
                    <svg width="120" height="40" viewBox="0 0 397 311" fill="none" aria-hidden="true">
                      <path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z" fill="#F4DFFF" fillOpacity="0.4" />
                      <path d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z" fill="#F4DFFF" fillOpacity="0.7" />
                      <path d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z" fill="#F4DFFF" fillOpacity="0.5" />
                    </svg>
                  </div>
                  <div className="flex h-20 w-[180px] flex-shrink-0 items-center justify-center">
                    <svg width="100" height="100" viewBox="0 0 2000 2000" fill="none" aria-hidden="true">
                      <circle cx="1000" cy="1000" r="900" fill="none" stroke="#F4DFFF" strokeWidth="100" strokeOpacity="0.3" />
                      <circle cx="1000" cy="1000" r="200" fill="#F4DFFF" fillOpacity="0.6" />
                      <circle cx="600" cy="800" r="120" fill="#F4DFFF" fillOpacity="0.4" />
                      <circle cx="1400" cy="800" r="120" fill="#F4DFFF" fillOpacity="0.4" />
                      <circle cx="600" cy="1200" r="120" fill="#F4DFFF" fillOpacity="0.4" />
                      <circle cx="1400" cy="1200" r="120" fill="#F4DFFF" fillOpacity="0.4" />
                    </svg>
                  </div>
                  <div className="flex h-20 w-[180px] flex-shrink-0 items-center justify-center">
                    <svg width="100" height="80" viewBox="0 0 38 33" fill="none" aria-hidden="true">
                      <path d="M29 10.2c-.7-.4-1.6-.4-2.4 0L21 13.5l-3.8 2.1-5.5 3.3c-.7.4-1.6.4-2.4 0L5 16.3c-.7-.4-1.2-1.2-1.2-2.1v-4c0-.8.4-1.6 1.2-2.1l4.3-2.5c.7-.4 1.6-.4 2.4 0L16 8.2c.7.4 1.2 1.2 1.2 2.1v3.3l3.8-2.2V8c0-.8-.4-1.6-1.2-2.1l-8-4.7c-.7-.4-1.6-.4-2.4 0L1.2 5.9C.4 6.3 0 7.1 0 8v9.4c0 .8.4 1.6 1.2 2.1l8.1 4.7c.7.4 1.6.4 2.4 0l5.5-3.2 3.8-2.2 5.5-3.2c.7-.4 1.6-.4 2.4 0l4.3 2.5c.7.4 1.2 1.2 1.2 2.1v4c0 .8-.4 1.6-1.2 2.1L29 28.8c-.7.4-1.6.4-2.4 0l-4.3-2.5c-.7-.4-1.2-1.2-1.2-2.1V21l-3.8 2.2v3.3c0 .8.4 1.6 1.2 2.1l8.1 4.7c.7.4 1.6.4 2.4 0l8.1-4.7c.7-.4 1.2-1.2 1.2-2.1V17c0-.8-.4-1.6-1.2-2.1L29 10.2z" fill="#F4DFFF" fillOpacity="0.6" />
                    </svg>
                  </div>
                  <div className="flex h-20 w-[180px] flex-shrink-0 items-center justify-center">
                    <svg width="100" height="100" viewBox="0 0 256 256" fill="none" aria-hidden="true">
                      <circle cx="128" cy="128" r="128" fill="#F4DFFF" fillOpacity="0.15" />
                      <path d="M145 128L128 100L111 128H145Z" fill="#F4DFFF" fillOpacity="0.7" />
                      <path d="M100 150L128 100L156 150H100Z" fill="#F4DFFF" fillOpacity="0.5" />
                      <path d="M85 170L128 100L171 170H85Z" fill="#F4DFFF" fillOpacity="0.3" />
                    </svg>
                  </div>
                  <div className="flex h-20 w-[180px] flex-shrink-0 items-center justify-center">
                    <svg width="100" height="100" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                      <path d="M16 6L9 10v8l7 4 7-4v-8l-7-4zm0 3l4 2.3v4.4L16 18l-4-2.3v-4.4L16 9z" fill="#F4DFFF" fillOpacity="0.6" />
                      <path d="M16 2L6 8v16l10 6 10-6V8l-10-6zm7 20.5l-7 4.2-7-4.2V9.5l7-4.2 7 4.2v13z" fill="#F4DFFF" fillOpacity="0.4" />
                    </svg>
                  </div>
                </React.Fragment>
              ))}
            </motion.div>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 1.5 }}
            className="mt-12 text-center"
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "18px",
              fontWeight: 400,
              color: "rgba(244, 223, 255, 0.5)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Trusted by Leading Crypto Platforms
          </motion.p>
        </motion.div>
      )}
    </section>
  );
}
