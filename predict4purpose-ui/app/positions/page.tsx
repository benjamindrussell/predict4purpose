"use client";
import { useAccount } from "wagmi";
import { baseSepolia } from "viem/chains";
import { createPublicClient, http } from "viem";
import { useEffect, useMemo, useState } from "react";
import { spatialMarketAbi } from "@/app/lib/abi/SpatialMarket";

type Position = { id: bigint; latE6: number; lonE6: number; balance: bigint };

export default function PositionsPage() {
  const { address } = useAccount();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const marketAddress = process.env.NEXT_PUBLIC_MARKET_ADDRESS as `0x${string}` | undefined;
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia.base.org";

  const client = useMemo(() => createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) }), [rpcUrl]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!address || !marketAddress) return;
      setLoading(true);
      setError(null);
      try {
        // Simple strategy: scan last N blocks for stakes and compute balances
        const currentBlock = await client.getBlockNumber();
        const maxRange = BigInt(50000);
        const fromBlock = currentBlock > maxRange ? currentBlock - maxRange : BigInt(0);
        const stakeEvent = {
          type: "event",
          name: "Stake",
          inputs: [
            { name: "staker", type: "address", indexed: true },
            { name: "id", type: "uint256", indexed: true },
            { name: "latE6", type: "int32", indexed: false },
            { name: "lonE6", type: "int32", indexed: false },
            { name: "amount", type: "uint256", indexed: false },
          ],
        } as const;

        const logs = await client.getLogs({ address: marketAddress, event: stakeEvent, args: { staker: address }, fromBlock, toBlock: currentBlock });
        const ids = Array.from(new Set(logs.map((l: any) => l.args.id as bigint)));
        const balances = await Promise.all(ids.map((id) => client.readContract({ address: marketAddress, abi: spatialMarketAbi, functionName: "balanceOf", args: [address, id] }) as Promise<bigint>));
        const withBal = ids
          .map((id, i) => ({ id, balance: balances[i] }))
          .filter((x) => x.balance > BigInt(0));

        const latLonById = new Map<bigint, { latE6: number; lonE6: number }>();
        for (const lg of logs as any[]) {
          const id = lg.args.id as bigint;
          if (!latLonById.has(id)) {
            latLonById.set(id, { latE6: Number(lg.args.latE6), lonE6: Number(lg.args.lonE6) });
          }
        }

        const result: Position[] = withBal.map(({ id, balance }) => ({ id, balance, ...(latLonById.get(id) || { latE6: 0, lonE6: 0 }) }));
        if (!cancelled) setPositions(result);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load positions");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [address, client, marketAddress]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800 }}>Your positions</h1>
      {!address && <div style={{ color: "var(--gray-60)" }}>Connect your wallet to view positions.</div>}
      {loading && <div>Loading...</div>}
      {error && <div style={{ color: "#b00020" }}>{error}</div>}
      <div style={{ display: "grid", gap: 8 }}>
        {positions.map((p) => (
          <div key={p.id.toString()} style={{ border: "1px solid var(--gray-15)", borderRadius: 8, padding: "0.75rem 0.9rem" }}>
            <div style={{ fontWeight: 700 }}>ID #{p.id.toString()}</div>
            <div style={{ color: "var(--gray-60)", fontSize: 14 }}>
              lat {(p.latE6 / 1_000_000).toFixed(4)}, lng {(p.lonE6 / 1_000_000).toFixed(4)}
            </div>
            <div style={{ marginTop: 4 }}>Balance: {p.balance.toString()}</div>
          </div>
        ))}
        {positions.length === 0 && address && !loading && !error && (
          <div style={{ color: "var(--gray-60)" }}>No positions found.</div>
        )}
      </div>
    </div>
  );
}


