"use client";
import { useMemo } from "react";

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

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        alert(
          `Pinned at (lat: ${position!.lat.toFixed(4)}, lng: ${position!.lng.toFixed(
            4
          )}) with radius ${radiusKm} km and stake ${amount}`
        );
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
        disabled={!canSubmit}
        style={{
          background: canSubmit ? "var(--blue)" : "var(--gray-50)",
          color: "white",
          border: 0,
          borderRadius: 8,
          padding: "0.75rem 1rem",
          cursor: canSubmit ? "pointer" : "not-allowed",
          fontWeight: 600,
        }}
      >
        Stake prediction
      </button>
    </form>
  );
}


