"use client";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

const MapPicker = dynamic(() => import("@/app/components/MapPicker"), { ssr: false });
const StakeForm = dynamic(() => import("@/app/components/StakeForm"), { ssr: false });
const ClaimForm = dynamic(() => import("@/app/components/ClaimForm"), { ssr: false });

export default function WildfiresClient() {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [amount, setAmount] = useState<string>("");
  const radiusMeters = useMemo(() => {
    const env = process.env.NEXT_PUBLIC_RADIUS_METERS;
    const parsed = env ? Number(env) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 5000;
  }, []);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800 }}>Wildfires</h1>
      <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
        <div style={{ flex: 2, border: "1px solid var(--gray-15)", borderRadius: 8, overflow: "hidden", position: "relative", isolation: "isolate" }}>
          <div style={{ height: "60vh" }}>
            <MapPicker value={position} onChange={setPosition} radiusMeters={radiusMeters} />
          </div>
        </div>
        <div style={{ flex: 1, border: "1px solid var(--gray-15)", borderRadius: 8, padding: "1rem" }}>
          <StakeForm amount={amount} onAmountChange={setAmount} radiusMeters={radiusMeters} position={position} />
          <div style={{ height: 16 }} />
          <ClaimForm />
        </div>
      </div>
    </div>
  );
}


