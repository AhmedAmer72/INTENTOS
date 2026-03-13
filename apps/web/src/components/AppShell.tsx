import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Wallet } from "lucide-react";
import { useWallet } from "@/wallet/WalletProvider";
import { short } from "@/lib/api";
import { targetChain } from "@/lib/chains";
import { BrandMark } from "@/components/BrandMark";
import { MeterStrip } from "@/components/MeterStrip";
import { Button } from "@/components/ui/button";
import { GlassTiles } from "@/components/ui/glass-tiles";

const TABS = [
  { to: "/studio", label: "Gate" },
  { to: "/market", label: "Market" },
  { to: "/playbook", label: "Playbook" },
  { to: "/console", label: "Console" },
];

export function AppShell() {
  const { address, isConnected, connect } = useWallet();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="relative min-h-svh overflow-x-hidden bg-ink">
      <GlassTiles
        className="pointer-events-none fixed inset-0 z-0"
        width="100%"
        height="100%"
        speed={0.65}
        tileDensity={5.5}
        rippleLayers={6}
        warpStrength={0.28}
        bandSharpness={3.2}
        chromaticSpread={0.22}
        colorA="#551A94"
        colorB="#C069FF"
        backgroundColor="#0C0414"
        opacity={0.38}
        dpr={1.5}
      />
      <div
        className="pointer-events-none fixed inset-0 z-[1]"
        style={{
          background:
            "radial-gradient(1100px 620px at 50% -8%, rgba(12, 4, 20, 0.28) 20%, rgba(12, 4, 20, 0.9) 100%)",
        }}
      />

      <header className="sticky top-0 z-20 px-3 pt-3 sm:px-4">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-2xl border border-[#D4A8FF]/60 bg-[#1c0f2e] shadow-[0_0_0_1px_rgba(192,105,255,0.28),0_14px_40px_rgba(0,0,0,0.55),0_0_32px_rgba(192,105,255,0.22)]">
          <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
            <BrandMark size={38} />

            <nav className="flex min-w-0 flex-1 items-center justify-center">
              <div className="flex items-center gap-0.5 overflow-x-auto rounded-full border border-white/10 bg-white/[0.04] p-1">
                {TABS.map((tab) => (
                  <NavLink
                    key={tab.to}
                    to={tab.to}
                    className={({ isActive }) =>
                      [
                        "shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium tracking-wide transition",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-[0_0_18px_rgba(192,105,255,0.45)]"
                          : "text-white/55 hover:bg-white/5 hover:text-white",
                      ].join(" ")
                    }
                  >
                    {tab.label}
                  </NavLink>
                ))}
              </div>
            </nav>

            <div className="flex shrink-0 items-center gap-2">
              <MeterStrip address={address} onBusy={setBusy} onError={setError} />
              <span className="hidden rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[11px] text-white/60 sm:inline">
                {targetChain.name}
              </span>
              {isConnected ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/35 bg-primary/10 px-3 py-1 font-mono text-xs text-primary">
                  <Wallet className="size-3" />
                  {short(address, 3)}
                </span>
              ) : (
                <Button
                  size="sm"
                  loading={busy === "Connecting wallet"}
                  onClick={() => {
                    setBusy("Connecting wallet");
                    connect()
                      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
                      .finally(() => setBusy(null));
                  }}
                >
                  Connect
                </Button>
              )}
            </div>
          </div>
        </div>
        {error && (
          <p className="mx-auto mt-2 max-w-6xl rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-center text-xs text-destructive-foreground">
            {error}
          </p>
        )}
      </header>

      <div className="relative z-10">
        <Outlet />
      </div>
    </div>
  );
}
