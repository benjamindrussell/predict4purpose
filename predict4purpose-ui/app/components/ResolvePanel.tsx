"use client";
import { useAccount } from "wagmi";
import { useCallback, useEffect, useMemo, useState } from "react";
import { baseSepolia } from "viem/chains";
import { createPublicClient, encodeAbiParameters, http, keccak256 } from "viem";
import {
  Transaction,
  TransactionButton,
  TransactionToast,
  TransactionToastIcon,
  TransactionToastLabel,
  TransactionToastAction,
} from "@coinbase/onchainkit/transaction";
import { encodeFunctionData } from "viem";
import { spatialMarketAbi } from "@/app/lib/abi/SpatialMarket";

export default function ResolvePanel() {
  const { address } = useAccount();
  const [lat, setLat] = useState<string>("");
  const [lng, setLng] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isResolver, setIsResolver] = useState(false);

  const marketAddress = process.env.NEXT_PUBLIC_MARKET_ADDRESS as `0x${string}` | undefined;
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia.base.org";
  const client = useMemo(() => createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) }), [rpcUrl]);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        if (!marketAddress || !address) {
          if (!cancelled) setIsResolver(false);
          return;
        }
        const resolver = (await client.readContract({ address: marketAddress, abi: spatialMarketAbi, functionName: "resolver", args: [] })) as `0x${string}`;
        if (!cancelled) setIsResolver(resolver?.toLowerCase() === address.toLowerCase());
      } catch {
        if (!cancelled) setIsResolver(false);
      }
    }
    check();
    return () => { cancelled = true; };
  }, [address, client, marketAddress]);

  const canSubmit = useMemo(() => {
    const latNum = Number(lat);
    const lngNum = Number(lng);
    return isResolver && Number.isFinite(latNum) && Number.isFinite(lngNum);
  }, [isResolver, lat, lng]);

  const calls = useCallback(async () => {
    if (!marketAddress) throw new Error("Missing NEXT_PUBLIC_MARKET_ADDRESS");
    const latE6 = Math.round(Number(lat) * 1_000_000);
    const lonE6 = Math.round(Number(lng) * 1_000_000);

    const id = (await client.readContract({ address: marketAddress, abi: spatialMarketAbi, functionName: "cellIdFor", args: [latE6, lonE6] })) as bigint;
    const totalStaked = (await client.readContract({ address: marketAddress, abi: spatialMarketAbi, functionName: "totalStaked" })) as bigint;
    const winStake = (await client.readContract({ address: marketAddress, abi: spatialMarketAbi, functionName: "totalStakedPerId", args: [id] })) as bigint;

    const leafBytes = encodeAbiParameters(
      [{ type: "uint256" }, { type: "uint256" }],
      [id, totalStaked]
    );
    const merkleRoot = keccak256(leafBytes);

    const closeData = encodeFunctionData({ abi: spatialMarketAbi, functionName: "closeMarket" });
    const setResData = encodeFunctionData({ abi: spatialMarketAbi, functionName: "setResolution", args: [merkleRoot, winStake, latE6, lonE6] });

    return [
      { to: marketAddress, data: closeData },
      { to: marketAddress, data: setResData },
    ];
  }, [client, lat, lng, marketAddress]);

  const onStatus = useCallback((status: any) => {
    if (status.statusName === "error") {
      const err = (status.statusData as any) ?? {};
      setError(err?.shortMessage || err?.message || "Transaction failed");
    }
  }, []);

  if (!isResolver) return null;

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="lat (e.g. 38.8977)" style={{ flex: 1, padding: "0.5rem", border: "1px solid var(--gray-15)", borderRadius: 8 }} />
        <input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="lng (e.g. -77.0365)" style={{ flex: 1, padding: "0.5rem", border: "1px solid var(--gray-15)", borderRadius: 8 }} />
      </div>
      <Transaction chainId={baseSepolia.id} calls={calls} onStatus={onStatus}>
        <TransactionButton disabled={!canSubmit} className="ock-button" />
        <TransactionToast>
          <TransactionToastIcon />
          <TransactionToastLabel />
          <TransactionToastAction />
        </TransactionToast>
      </Transaction>
      {error && <div style={{ color: "#b00020", fontSize: 14 }}>{error}</div>}
    </div>
  );
}


