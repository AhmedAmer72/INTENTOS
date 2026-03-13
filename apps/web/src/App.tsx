import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { WalletProvider } from "@/wallet/WalletProvider";
import { AppShell } from "@/components/AppShell";
import { Landing } from "@/pages/Landing";
import { Docs } from "@/pages/Docs";
import { Studio } from "@/pages/Studio";
import { CertificatePage } from "@/pages/CertificatePage";
import { ConsolePage } from "@/pages/Console";
import { Market } from "@/pages/Market";
import { Playbook } from "@/pages/Playbook";

export function App() {
  return (
    <WalletProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/docs" element={<Docs />} />
          <Route element={<AppShell />}>
            <Route path="/studio" element={<Studio />} />
            <Route path="/market" element={<Market />} />
            <Route path="/playbook" element={<Playbook />} />
            <Route path="/console" element={<ConsolePage />} />
            <Route path="/proof/:hash" element={<CertificatePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </WalletProvider>
  );
}
