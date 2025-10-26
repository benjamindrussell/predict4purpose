"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wallet, ConnectWallet } from "@coinbase/onchainkit/wallet";
import { useAccount, useDisconnect } from "wagmi";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

const ResolveControl = dynamic(() => import("./ResolveControl"), { ssr: false });
import { Avatar, Name } from "@coinbase/onchainkit/identity";

export default function SiteHeader() {
  const pathname = usePathname();
  const { address, connector } = useAccount();
  const { disconnectAsync } = useDisconnect();
  const [disconnecting, setDisconnecting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

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

  const pillButton: React.CSSProperties = {
    padding: "0.4rem 0.75rem",
    borderRadius: 6,
    border: "1px solid var(--blue)",
    background: "rgba(67,45,215,0.08)",
    color: "var(--blue)",
    fontWeight: 700,
  };
  const subtleButton: React.CSSProperties = {
    padding: "0.35rem 0.7rem",
    borderRadius: 6,
    border: "1px solid var(--gray-20)",
    background: "var(--gray-10)",
    color: "var(--gray-80)",
    fontWeight: 600,
  };

  function shortAddress(a?: string | null) {
    if (!a) return "";
    return a.slice(0, 6) + "…" + a.slice(-4);
  }

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!(e.target instanceof Node)) return;
      if (!menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

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
      zIndex: 1000,
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
      <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative" }}>
        <ResolveControl buttonStyle={pillButton} buttonClassName="btn btn-primary" />
        {!address && (
          <Wallet>
            <ConnectWallet>
              <div className="btn btn-primary">Connect</div>
            </ConnectWallet>
          </Wallet>
        )}
        {address && (
          <div ref={menuRef} style={{ position: "relative" }}>
            <button
              type="button"
              className="btn btn-primary"
              style={pillButton}
              onClick={() => setMenuOpen((v) => !v)}
              title={address}
            >
              {shortAddress(address)}
            </button>
            {menuOpen && (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: "calc(100% + 8px)",
                  background: "var(--background)",
                  border: "1px solid var(--gray-15)",
                  borderRadius: 8,
                  boxShadow: "0 8px 18px rgba(0,0,0,0.08)",
                  padding: 8,
                  zIndex: 2000,
                }}
              >
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ ...pillButton, width: "100%" }}
                  disabled={disconnecting}
                  onClick={async () => {
                    if (disconnecting) return;
                    setDisconnecting(true);
                    try {
                      // Some wallets require explicit connector disconnect first
                      if (connector && typeof (connector as any).disconnect === "function") {
                        try { await (connector as any).disconnect(); } catch {}
                      }
                      // Attempt provider-specific disconnects (Phantom, etc.)
                      try { (window as any)?.phantom?.ethereum?.disconnect?.(); } catch {}
                      try { (window as any)?.phantom?.solana?.disconnect?.(); } catch {}
                      try { (window as any)?.ethereum?.disconnect?.(); } catch {}
                      await disconnectAsync().catch(() => {});
                      // Clear cached auto-connect state to avoid instant re-connect
                      try {
                        const clear = (s: Storage) => {
                          const keys = Object.keys(s);
                          for (const k of keys) {
                            const kl = k.toLowerCase();
                            if (kl.includes("wagmi") || kl.includes("onchain") || kl.includes("ock") || kl.includes("coinbase")) {
                              s.removeItem(k);
                            }
                          }
                        };
                        if (typeof window !== "undefined") {
                          clear(window.localStorage);
                          clear(window.sessionStorage);
                        }
                      } catch {}
                      // As a last resort, force a soft reload to defeat eager autoConnect on some providers
                      try { setTimeout(() => { window.location.reload(); }, 50); } catch {}
                    } finally {
                      setDisconnecting(false);
                      setMenuOpen(false);
                    }
                  }}
                >
                  {disconnecting ? "Disconnecting…" : "Disconnect"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}


