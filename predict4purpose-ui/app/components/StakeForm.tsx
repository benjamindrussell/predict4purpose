"use client";
import { useMemo, useState, useCallback } from "react";
import { encodeFunctionData, parseEther } from "viem";
import { baseSepolia } from "viem/chains";
import {
  Transaction,
  TransactionButton,
  TransactionSponsor,
  TransactionToast,
  TransactionToastAction,
  TransactionToastIcon,
  TransactionToastLabel,
  type LifecycleStatus,
} from "@coinbase/onchainkit/transaction";
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
  const isSponsored = Boolean(process.env.NEXT_PUBLIC_CDP_PAYMASTER_URL);

  const calls = useCallback(async () => {
    if (!canSubmit) throw new Error("Missing stake inputs");
    if (!marketAddress) throw new Error("Missing NEXT_PUBLIC_MARKET_ADDRESS");

    const latE6 = Math.round(position!.lat * 1_000_000);
    const lonE6 = Math.round(position!.lng * 1_000_000);
    const valueWei = parseEther(amount);

    const data = encodeFunctionData({
      abi: spatialMarketAbi,
      functionName: "stakeAt",
      args: [latE6, lonE6],
    });

    return [{ to: marketAddress, data, value: valueWei }];
  }, [amount, canSubmit, marketAddress, position]);

  const handleOnStatus = useCallback((status: LifecycleStatus) => {
    if (status.statusName === "error") {
      const err = (status.statusData as any) ?? {};
      setError(err?.shortMessage || err?.message || "Transaction failed");
      setSubmitting(false);
      return;
    }
    if (
      status.statusName === "buildingTransaction" ||
      status.statusName === "transactionPending"
    ) {
      setError(null);
      setSubmitting(true);
      return;
    }
    if (
      status.statusName === "success" ||
      status.statusName === "transactionLegacyExecuted" ||
      status.statusName === "transactionIdle"
    ) {
      setSubmitting(false);
    }
  }, []);

  return (
    <form onSubmit={(e) => e.preventDefault()} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
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
          Stake amount (ETH)
        </label>
        <input
          id="stakeAmount"
          type="number"
          min="0"
          step="0.000001"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          placeholder="e.g. 0.01"
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

      <Transaction
        chainId={baseSepolia.id}
        calls={calls}
        onStatus={handleOnStatus}
        isSponsored={isSponsored}
      >
        <TransactionButton disabled={!canSubmit || submitting} className="ock-button" />
        {isSponsored && <TransactionSponsor />}
        <TransactionToast>
          <TransactionToastIcon />
          <TransactionToastLabel />
          <TransactionToastAction />
        </TransactionToast>
      </Transaction>

      {error && (
        <div style={{ color: "#b00020", fontSize: 14 }}>{error}</div>
      )}
    </form>
  );
}


