import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { BrandMark } from "@/components/BrandMark";

type NavId = "home" | "features" | "how" | "docs";

export function LandingHeader({ active = "home" }: { active?: NavId }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const goHome = (hash?: string) => {
    if (!hash) {
      navigate("/");
      return;
    }
    if (window.location.pathname === "/") {
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    navigate(`/#${hash}`);
  };

  const items: { id: NavId; label: string; onClick: () => void }[] = [
    { id: "home", label: "Home", onClick: () => goHome() },
    { id: "features", label: "Features", onClick: () => goHome("features") },
    { id: "how", label: "How it works", onClick: () => goHome("how") },
    { id: "docs", label: "Docs", onClick: () => navigate("/docs") },
  ];

  return (
    <header className="sticky top-0 z-20 flex justify-center px-4 pt-5">
      <div className="relative w-full max-w-[1196px]">
      <div
        className="flex w-full items-center justify-between px-4 py-2.5"
        style={{
          borderRadius: 18,
          background: "rgba(8, 2, 14, 0.45)",
          border: "1px solid rgba(192, 105, 255, 0.22)",
          boxShadow: "0 0 0 1px rgba(192,105,255,0.06), 0 16px 40px rgba(0,0,0,0.35), 0 0 32px rgba(192,105,255,0.12)",
          backdropFilter: "blur(16px)",
        }}
      >
        <button type="button" className="flex items-center gap-2" onClick={() => goHome()} aria-label="INTENTOS home">
          <BrandMark size={40} wordmark={false} to={null} />
          <span className="text-lg font-semibold tracking-wide text-white">INTENTOS</span>
        </button>

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Main navigation">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              className={`text-[15px] ${item.id === active ? "text-white" : "text-white/50 hover:text-white"}`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button type="button" className="btn hidden sm:inline-flex" onClick={() => navigate("/studio")}>
            Open studio
          </button>
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
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.nav
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute top-[calc(100%+8px)] left-0 right-0 rounded-2xl border border-white/10 bg-[#160822]/94 p-4 backdrop-blur-xl lg:hidden"
            aria-label="Mobile navigation"
          >
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  item.onClick();
                  setMenuOpen(false);
                }}
                className="block w-full rounded-xl px-3 py-2.5 text-left text-base text-white/80"
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              className="btn mt-2 w-full sm:hidden"
              onClick={() => {
                navigate("/studio");
                setMenuOpen(false);
              }}
            >
              Open studio
            </button>
          </motion.nav>
        )}
      </AnimatePresence>
      </div>
    </header>
  );
}
