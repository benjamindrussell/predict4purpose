"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wallet, ConnectWallet, WalletDropdown, WalletDropdownDisconnect } from "@coinbase/onchainkit/wallet";
import { Avatar, Name } from "@coinbase/onchainkit/identity";
import ResolvePanel from "@/app/components/ResolvePanel";
import { useAccount } from "wagmi";
import { useEffect, useMemo, useState } from "react";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { spatialMarketAbi } from "@/app/lib/abi/SpatialMarket";

export default function SiteHeader() {
  const { address } = useAccount();
  const [canResolve, setCanResolve] = useState(false);
  const [showResolve, setShowResolve] = useState(false);
  const marketAddress = process.env.NEXT_PUBLIC_MARKET_ADDRESS as `0x${string}` | undefined;
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia.base.org";
  const client = useMemo(() => createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) }), [rpcUrl]);

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

  useEffect(() => {
    let cancelled = false;
    async function checkOwner() {
      try {
        if (!marketAddress || !address) {
          if (!cancelled) setCanResolve(false);
          return;
        }
        const resolver = (await client.readContract({ address: marketAddress, abi: spatialMarketAbi as any, functionName: "resolver" })) as `0x${string}`;
        if (!cancelled) setCanResolve(resolver?.toLowerCase() === address.toLowerCase());
      } catch {
        if (!cancelled) setCanResolve(false);
      }
    }
    checkOwner();
    return () => { cancelled = true; };
  }, [address, client, marketAddress]);

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
      zIndex: 2000,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ fontWeight: 800, color: "var(--blue)", fontSize: "1.5rem", lineHeight: 1 }}>
          Predict4Purpose
        </div>
        <nav style={{ display: "flex", gap: 8 }}>
          <Link href="/markets" style={tabStyle(isActive("/markets"))}>Markets</Link>
          <Link href="/positions" style={tabStyle(isActive("/positions"))}>Positions</Link>
          <Link href="/heatmap" style={tabStyle(isActive("/heatmap"))}>Heatmap</Link>
        </nav>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {canResolve && (
          <button
            type="button"
            onClick={() => setShowResolve(true)}
            style={{
              background: "#b00020",
              color: "white",
              border: "1px solid #b00020",
              borderRadius: 6,
              padding: "0.4rem 0.75rem",
              fontWeight: 700,
            }}
          >
            Resolve
          </button>
        )}
      <Wallet>
        <ConnectWallet>
          <Avatar className="h-6 w-6" />
          <Name />
        </ConnectWallet>
        <WalletDropdown>
          <WalletDropdownDisconnect />
        </WalletDropdown>
      </Wallet>
      </div>
      {showResolve && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 4000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "var(--background)", borderRadius: 12, border: "1px solid var(--gray-15)", width: "min(640px, 95vw)", maxWidth: "95vw", padding: 16, boxShadow: "0 8px 24px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontWeight: 800 }}>Resolve market</div>
              <button type="button" onClick={() => setShowResolve(false)} style={{ background: "transparent", border: 0, fontSize: 18, cursor: "pointer" }}>×</button>
            </div>
            <ResolvePanel />
          </div>
        </div>
      )}
    </header>
  );
}


