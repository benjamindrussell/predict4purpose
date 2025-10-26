"use client";
import { useMemo, useState } from "react";
import { createWalletClient, custom, parseEther } from "viem";
import { base, baseSepolia, hardhat, sepolia } from "viem/chains";
import { spatialMarketAbi } from "../lib/abi/SpatialMarket";

type LatLng = { lat: number; lng: number };

export default function StakeForm({
  amount,
  onAmountChange,
  radiusMeters,
  position,
}: {
  amount: string;
  onAmountChange: (v: string) => void;
  radiusMeters: number;
  position: LatLng | null;
}) {
  const radiusKm = useMemo(() => (radiusMeters / 1000).toFixed(2), [radiusMeters]);
  const canSubmit = position && amount && Number(amount) > 0;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const marketAddress = process.env.NEXT_PUBLIC_MARKET_ADDRESS as `0x${string}` | undefined;

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        if (!canSubmit) return;
        if (!marketAddress) {
          setError("Missing NEXT_PUBLIC_MARKET_ADDRESS");
          return;
        }
        try {
          setSubmitting(true);
          if (!(window as any).ethereum) throw new Error("Wallet not connected");
          const walletClient = createWalletClient({ transport: custom((window as any).ethereum) });
          const [account] = await walletClient.getAddresses();
          if (!account) throw new Error("No account selected");
          const chainId = await walletClient.getChainId();
          const chain =
            chainId === base.id
              ? base
              : chainId === baseSepolia.id
              ? baseSepolia
              : chainId === hardhat.id
              ? hardhat
              : chainId === sepolia.id
              ? sepolia
              : undefined;

          // Convert to microdegrees (int32 bounds enforced on-chain)
          const latE6 = Math.round(position!.lat * 1_000_000);
          const lonE6 = Math.round(position!.lng * 1_000_000);
          const valueWei = parseEther(amount);

          await walletClient.writeContract({
            address: marketAddress,
            abi: spatialMarketAbi,
            functionName: "stakeAt",
            args: [latE6, lonE6],
            account,
            chain,
            value: valueWei,
          });
        } catch (err: any) {
          setError(err?.shortMessage || err?.message || String(err));
        } finally {
          setSubmitting(false);
        }
      }}
      style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
    >
      <div style={{
        border: "1px solid var(--gray-15)",
        background: "var(--gray-10)",
        borderRadius: 8,
        padding: "0.75rem 0.9rem"
      }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Stake info</div>
        <div style={{ color: "var(--gray-60)", fontSize: 14 }}>
          You’ll be paid out if the disaster point is within {radiusKm} km of your pin.
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <label htmlFor="stakeAmount" style={{ fontWeight: 600 }}>
          Stake amount (tokens)
        </label>
        <input
          id="stakeAmount"
          type="number"
          min="0"
          step="0.0001"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          placeholder="e.g. 100"
          style={{
            padding: "0.5rem 0.75rem",
            borderRadius: 8,
            border: "1px solid var(--gray-15)",
            width: "100%",
          }}
        />
      </div>

      {/* Radius section removed per requirements */}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        <div style={{ fontWeight: 600 }}>Selected location</div>
        <div style={{
          border: "1px solid var(--gray-15)",
          borderRadius: 8,
          padding: "0.5rem 0.75rem",
          minHeight: 40,
          background: "var(--gray-10)",
        }}>
          {position ? (
            <span>
              lat {position.lat.toFixed(4)}, lng {position.lng.toFixed(4)}
            </span>
          ) : (
            <span>Click on the map to drop a pin</span>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={!canSubmit || submitting}
        style={{
          background: canSubmit && !submitting ? "var(--blue)" : "var(--gray-50)",
          color: "white",
          border: 0,
          borderRadius: 8,
          padding: "0.75rem 1rem",
          cursor: canSubmit && !submitting ? "pointer" : "not-allowed",
          fontWeight: 600,
        }}
      >
        {submitting ? "Submitting..." : "Stake prediction"}
      </button>

      {error && (
        <div style={{ color: "#b00020", fontSize: 14 }}>{error}</div>
      )}
    </form>
  );
}


