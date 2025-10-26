"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wallet, ConnectWallet } from "@coinbase/onchainkit/wallet";
import dynamic from "next/dynamic";

const ResolveControl = dynamic(() => import("./ResolveControl"), { ssr: false });
import { Avatar, Name } from "@coinbase/onchainkit/identity";

export default function SiteHeader() {
  const pathname = usePathname();

  function isActive(path: string) {
    return pathname === path || pathname?.startsWith(path + "/");
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "0.4rem 0.75rem",
    borderRadius: 6,
    border: active ? "1px solid var(--blue)" : "1px solid transparent",
    background: active ? "rgba(67,45,215,0.08)" : "transparent",
    color: active ? "var(--blue)" : "var(--gray-80)",
    fontWeight: 600,
  });

  return (
    <header style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "0.5rem 1rem",
      borderBottom: "1px solid var(--gray-15)",
      position: "sticky",
      top: 0,
      background: "var(--background)",
      zIndex: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ fontWeight: 800, color: "var(--blue)", fontSize: "1.5rem", lineHeight: 1 }}>
          Predict4Purpose
        </div>
        <nav style={{ display: "flex", gap: 8 }}>
          <Link href="/markets" style={tabStyle(isActive("/markets"))}>Markets</Link>
          <Link href="/heatmap" style={tabStyle(isActive("/heatmap"))}>Map</Link>
        </nav>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <ResolveControl />
        <Wallet>
          <ConnectWallet>
            <Avatar className="h-6 w-6" />
            <Name />
          </ConnectWallet>
        </Wallet>
      </div>
    </header>
  );
}


