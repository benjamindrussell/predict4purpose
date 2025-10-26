"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { baseSepolia } from "viem/chains";
import { createPublicClient, http } from "viem";
import { spatialMarketAbi } from "@/app/lib/abi/SpatialMarket";

const MapPicker = dynamic(() => import("@/app/components/MapPicker"), { ssr: false });
const StakeForm = dynamic(() => import("@/app/components/StakeForm"), { ssr: false });
const ClaimForm = dynamic(() => import("@/app/components/ClaimForm"), { ssr: false });

export default function WildfiresClient() {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [isClosed, setIsClosed] = useState<boolean | null>(null);
  const radiusMeters = useMemo(() => {
    const env = process.env.NEXT_PUBLIC_RADIUS_METERS;
    const parsed = env ? Number(env) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 5000;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const marketAddress = process.env.NEXT_PUBLIC_MARKET_ADDRESS as `0x${string}` | undefined;
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia.base.org";
    const client = createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) });
    async function load() {
      if (!marketAddress) return;
      try {
        const closeTs = await client.readContract({ address: marketAddress, abi: spatialMarketAbi, functionName: "tradingClose" }) as bigint;
        if (!cancelled) setIsClosed(Boolean(closeTs && closeTs > BigInt(0)));
      } catch {}
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>Wildfires</h1>
        {isClosed !== null && (
          <div
            style={{
              background: isClosed ? "rgba(238,39,55,0.10)" : "rgba(91,197,0,0.10)",
              color: isClosed ? "#ee2737" : "#2e7d00",
              border: `1px solid ${isClosed ? "#f5a3ab" : "#bfe5a1"}`,
              borderRadius: 999,
              padding: "0 10px",
              fontSize: 12,
              height: 26,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
            }}
          >
            {isClosed ? "Market Closed" : "Market Open"}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ flex: 2, border: "1px solid var(--gray-15)", borderRadius: 8, overflow: "hidden", position: "relative", isolation: "isolate" }}>
          <div style={{ height: "60vh" }}>
            <MapPicker value={position} onChange={setPosition} radiusMeters={radiusMeters} />
          </div>
        </div>
        <div style={{ flex: 1, border: "1px solid var(--gray-15)", borderRadius: 8, padding: "1rem" }}>
          <StakeForm amount={amount} onAmountChange={setAmount} radiusMeters={radiusMeters} position={position} />
          <div style={{ height: 16 }} />
          <ClaimForm disabled={isClosed === false} />
        </div>
      </div>
    </div>
  );
}


