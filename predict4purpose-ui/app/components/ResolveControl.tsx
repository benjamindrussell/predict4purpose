"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { baseSepolia } from "viem/chains";
import { createPublicClient, encodeFunctionData, encodeAbiParameters, keccak256, http } from "viem";
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

export default function ResolveControl() {
  const { address } = useAccount();
  const [ownerAddress, setOwnerAddress] = useState<`0x${string}` | null>(null);
  const [resolverAddress, setResolverAddress] = useState<`0x${string}` | null>(null);
  const [open, setOpen] = useState(false);
  const [lat, setLat] = useState<string>("");
  const [lon, setLon] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const marketAddress = process.env.NEXT_PUBLIC_MARKET_ADDRESS as `0x${string}` | undefined;
  const isSponsored = Boolean(process.env.NEXT_PUBLIC_CDP_PAYMASTER_URL);
  // Resolution parameters will be computed on-chain based on your provided lat/lon

  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia.base.org";
  const client = useMemo(() => createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) }), [rpcUrl]);

  useEffect(() => {
    let cancelled = false;
    async function fetchAdmin() {
      try {
        if (!marketAddress) return;
        const [own, res] = await Promise.all([
          client.readContract({ address: marketAddress, abi: spatialMarketAbi, functionName: "owner", args: [] }) as Promise<`0x${string}`>,
          client.readContract({ address: marketAddress, abi: spatialMarketAbi, functionName: "resolver", args: [] }) as Promise<`0x${string}`>,
        ]);
        if (!cancelled) {
          setOwnerAddress(own);
          setResolverAddress(res);
        }
      } catch {}
    }
    fetchAdmin();
    return () => { cancelled = true; };
  }, [client, marketAddress]);

  const isOwner = useMemo(() => Boolean(address && ownerAddress && address.toLowerCase() === ownerAddress.toLowerCase()), [address, ownerAddress]);
  const isResolver = useMemo(() => Boolean(address && resolverAddress && address.toLowerCase() === resolverAddress.toLowerCase()), [address, resolverAddress]);

  const canSubmit = useMemo(() => {
    const latNum = Number(lat);
    const lonNum = Number(lon);
    const latOk = Number.isFinite(latNum) && latNum >= -90 && latNum <= 90;
    const lonOk = Number.isFinite(lonNum) && lonNum >= -180 && lonNum <= 180;
    return Boolean(marketAddress && address && latOk && lonOk);
  }, [address, lat, lon, marketAddress]);

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
      setInfo("Submitting...");
      return;
    }
    if (
      status.statusName === "success" ||
      status.statusName === "transactionLegacyExecuted" ||
      status.statusName === "transactionIdle"
    ) {
      setSubmitting(false);
      setError(null);
      if (status.statusName === "success") {
        setInfo("Success");
      }
    }
  }, []);

  const calls = useCallback(async () => {
    if (!canSubmit) throw new Error("Missing inputs");
    if (!marketAddress) throw new Error("Missing NEXT_PUBLIC_MARKET_ADDRESS");

    const latE6 = Math.round(Number(lat) * 1_000_000);
    const lonE6 = Math.round(Number(lon) * 1_000_000);

    // Compute parameters on-chain (single-leaf tree like your CLI):
    // id = cellIdFor(lat,lon), payoutNumerator = totalStaked, payoutDenominator = totalStakedPerId(id),
    // merkleRoot = keccak256(abi.encode(id, payoutNumerator)).
    const id = (await client.readContract({
      address: marketAddress,
      abi: spatialMarketAbi,
      functionName: "cellIdFor",
      args: [latE6, lonE6],
    })) as bigint;

    const [totalStaked, winStake] = (await Promise.all([
      client.readContract({ address: marketAddress, abi: spatialMarketAbi, functionName: "totalStaked", args: [] }) as Promise<bigint>,
      client.readContract({ address: marketAddress, abi: spatialMarketAbi, functionName: "totalStakedPerId", args: [id] }) as Promise<bigint>,
    ]));

    if (totalStaked <= BigInt(0)) throw new Error("No stakes recorded");
    if (winStake <= BigInt(0)) throw new Error("No stakes for resolved cell (denominator would be zero)");

    const leafEncoded = encodeAbiParameters(
      [
        { name: "id", type: "uint256" },
        { name: "payoutNumerator", type: "uint256" },
      ],
      [id, totalStaked]
    );
    const root = keccak256(leafEncoded) as `0x${string}`;
    const denom = winStake;

    const encoded: { to: `0x${string}`; data: `0x${string}` }[] = [];
    // 1) Close market
    encoded.push({ to: marketAddress, data: encodeFunctionData({ abi: spatialMarketAbi, functionName: "closeMarket", args: [] }) });
    // 2) Resolve
    encoded.push({
      to: marketAddress,
      data: encodeFunctionData({ abi: spatialMarketAbi, functionName: "setResolution", args: [root, denom, latE6, lonE6] }),
    });
    setInfo("Closing and resolving market...");
    return encoded;
  }, [canSubmit, lat, lon, marketAddress, client]);

  if (!isOwner) return null; // only show for owner per requirements

  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          padding: "0.45rem 0.9rem",
          borderRadius: 999,
          border: "1px solid var(--blue)",
          background: "linear-gradient(90deg, #432dd7 0%, #7a5cff 100%)",
          color: "white",
          fontWeight: 700,
          boxShadow: "0 4px 10px rgba(67,45,215,0.3)",
        }}
      >
        Resolve
      </button>

      {open && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 50,
        }}>
          <div style={{
            width: "min(520px, 92vw)",
            background: "var(--background)",
            border: "1px solid var(--gray-15)",
            borderRadius: 12,
            padding: "1rem",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>Close & Resolve</div>
              <button onClick={() => setOpen(false)} style={{ border: "none", background: "transparent", fontSize: 18, cursor: "pointer" }}>×</button>
            </div>

            <div style={{ height: 8 }} />
            <div style={{ color: "var(--gray-60)", fontSize: 14 }}>
              Enter the final coordinates. This will close trading immediately. Optionally include Merkle root and a payout denominator to finalize resolution in the same action.
            </div>

            <div style={{ height: 12 }} />
            <form onSubmit={(e) => e.preventDefault()} style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label htmlFor="lat" style={{ fontWeight: 600 }}>Latitude</label>
                  <input id="lat" type="number" step="0.000001" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="e.g. 37.7749" style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--gray-15)" }} />
                </div>
                <div>
                  <label htmlFor="lon" style={{ fontWeight: 600 }}>Longitude</label>
                  <input id="lon" type="number" step="0.000001" value={lon} onChange={(e) => setLon(e.target.value)} placeholder="e.g. -122.4194" style={{ width: "100%", padding: "0.5rem 0.75rem", borderRadius: 8, border: "1px solid var(--gray-15)" }} />
                </div>
              </div>

              {!isResolver && (
                <div style={{ color: "#b06000", fontSize: 12 }}>
                  Note: Closing and resolution require resolver permissions. If your wallet is not the resolver, closing may succeed but resolution will fail.
                </div>
              )}

              <Transaction chainId={baseSepolia.id} calls={calls} onStatus={handleOnStatus} isSponsored={isSponsored}>
                <TransactionButton disabled={!canSubmit || submitting} className="ock-button" />
                {isSponsored && <TransactionSponsor />}
                <TransactionToast>
                  <TransactionToastIcon />
                  <TransactionToastLabel />
                  <TransactionToastAction />
                </TransactionToast>
              </Transaction>

              {error && <div style={{ color: "#b00020", fontSize: 14 }}>{error}</div>}
              {info && <div style={{ color: "var(--gray-60)", fontSize: 14 }}>{info}</div>}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


