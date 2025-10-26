"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { baseSepolia } from "viem/chains";
import { createPublicClient, http } from "viem";
import { spatialMarketAbi } from "@/app/lib/abi/SpatialMarket";

type Position = {
  id: bigint;
  latE6: number;
  lonE6: number;
  balance: bigint;
  source?: "real" | "fake";
  marketSlug?: string; // e.g. "wildfires"
};

const markets = [
  {
    slug: "wildfires",
    name: "Wildfires",
    description: "Predict wildfire occurrences",
    emoji: "🔥",
    color: "#ef4444",
    accentBg: "rgba(239, 68, 68, 0.08)",
  },
  {
    slug: "floods",
    name: "Floods",
    description: "Predict flood events",
    emoji: "🌊",
    color: "#3b82f6",
    accentBg: "rgba(59, 130, 246, 0.08)",
  },
  {
    slug: "earthquakes",
    name: "Earthquakes",
    description: "Predict seismic events",
    emoji: "🌎",
    color: "#f59e0b",
    accentBg: "rgba(245, 158, 11, 0.10)",
  },
  {
    slug: "drought",
    name: "Drought",
    description: "Predict drought severity",
    emoji: "🌵",
    color: "#10b981",
    accentBg: "rgba(16, 185, 129, 0.08)",
  },
  {
    slug: "hurricanes",
    name: "Hurricanes",
    description: "Predict hurricane landfalls",
    emoji: "🌀",
    color: "#8b5cf6",
    accentBg: "rgba(139, 92, 246, 0.10)",
  },
];

function formatEth(wei: bigint): string {
  const denom = BigInt("1000000000000000000"); // 1e18 without BigInt literal for older targets
  const integer = wei / denom;
  const frac = wei % denom;
  const fracStr = frac.toString().padStart(18, "0").slice(0, 4);
  return `${integer.toString()}.${fracStr}`;
}

function MarketCard({
  market,
  staked,
  ends,
  status,
}: {
  market: any;
  staked: string;
  ends: string;
  status: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      href={`/markets/${market.slug}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        border: "1px solid var(--gray-15)",
        borderRadius: 12,
        padding: "1rem",
        background: "var(--gray-0)",
        borderLeft: `4px solid ${market.color}`,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        transition: "box-shadow 140ms ease, transform 140ms ease",
        boxShadow: hovered ? "0 8px 20px rgba(0,0,0,0.06)" : "none",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        minHeight: 148,
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              display: "grid",
              placeItems: "center",
              background: market.accentBg,
              fontSize: 22,
            }}
          >
            {market.emoji}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{market.name}</div>
            <div style={{ color: "var(--gray-60)", fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{market.description}</div>
          </div>
        </div>
        <div
          style={{
            color: market.color,
            fontWeight: 700,
            fontSize: 28,
            transition: "transform 140ms ease",
            transform: hovered ? "translateX(2px)" : "translateX(0)",
          }}
        >
          &rarr;
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr) auto", gap: 8, marginTop: "auto" }}>
        <div
          style={{
            background: market.accentBg,
            color: market.color,
            fontWeight: 700,
            borderRadius: 9999,
            padding: "0 10px",
            fontSize: 12,
            height: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            boxSizing: "border-box",
          }}
          title={`Staked ${staked} ETH`}
        >
          Staked {staked} ETH
        </div>
        <div
          style={{
            background: "var(--gray-10)",
            color: "var(--gray-70)",
            borderRadius: 9999,
            padding: "0 10px",
            fontSize: 12,
            height: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            boxSizing: "border-box",
          }}
          title={`Ends ${ends}`}
        >
          Ends {ends}
        </div>
        <div
          style={{
            background: "var(--gray-10)",
            color: status === "Open" ? market.color : "var(--gray-70)",
            borderRadius: 9999,
            padding: "0 12px",
            fontSize: 11,
            fontWeight: 700,
            height: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            boxSizing: "border-box",
            minWidth: 64,
          }}
          title={status}
        >
          {status}
        </div>
      </div>
    </Link>
  );
}

export default function MarketsPage() {
  const { address } = useAccount();
  const [wildfireStaked, setWildfireStaked] = useState<string | null>(null);
  const [wildfireEndsIn, setWildfireEndsIn] = useState<string | null>(null);
  const [wildfireStatus, setWildfireStatus] = useState<string | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [positionsError, setPositionsError] = useState<string | null>(null);

  const marketAddress = process.env.NEXT_PUBLIC_MARKET_ADDRESS as `0x${string}` | undefined;
  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia.base.org";
  const client = useMemo(() => createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) }), [rpcUrl]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!marketAddress) return;
      try {
        const [total, closeTs] = await Promise.all([
          client.readContract({ address: marketAddress, abi: spatialMarketAbi, functionName: "totalStaked" }) as Promise<bigint>,
          client.readContract({ address: marketAddress, abi: spatialMarketAbi, functionName: "tradingClose" }) as Promise<bigint>,
        ]);
        if (cancelled) return;
        setWildfireStaked(formatEth(total));
        const now = Math.floor(Date.now() / 1000);
        const close = Number(closeTs);
        if (Number.isFinite(close)) {
          if (now < close) {
            const remaining = close - now;
            const days = Math.floor(remaining / 86400);
            const hours = Math.floor((remaining % 86400) / 3600);
            setWildfireEndsIn(`${days}d ${hours}h`);
            setWildfireStatus("Open");
          } else {
            setWildfireEndsIn("Closed");
            setWildfireStatus("Closed");
          }
        }
      } catch (e) {
        // Swallow errors for the card; keep page resilient
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [client, marketAddress]);

  useEffect(() => {
    let cancelled = false;
    async function loadPositions() {
      if (!address || !marketAddress) return;
      setPositionsLoading(true);
      setPositionsError(null);
      try {
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
        const ids = Array.from(new Set((logs as any[]).map((l: any) => l.args.id as bigint)));
        const balances = await Promise.all(
          ids.map((id) => client.readContract({ address: marketAddress, abi: spatialMarketAbi, functionName: "balanceOf", args: [address, id] }) as Promise<bigint>)
        );
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

        const realPositions: Position[] = withBal.map(({ id, balance }) => ({
          id,
          balance,
          ...(latLonById.get(id) || { latE6: 0, lonE6: 0 }),
          source: "real",
          marketSlug: "wildfires",
        }));

        const demoPositions: Position[] = [
          {
            id: BigInt(900001),
            latE6: 34052200, // 34.0522
            lonE6: -118243700, // -118.2437
            balance: BigInt("420000000000000000"), // 0.42 ETH
            source: "fake",
            marketSlug: "earthquakes",
          },
          {
            id: BigInt(900002),
            latE6: 29760400, // 29.7604
            lonE6: -95369800, // -95.3698
            balance: BigInt("870000000000000000"), // 0.87 ETH
            source: "fake",
            marketSlug: "floods",
          },
          {
            id: BigInt(900003),
            latE6: 33448400, // 33.4484
            lonE6: -112074000, // -112.0740
            balance: BigInt("150000000000000000"), // 0.15 ETH
            source: "fake",
            marketSlug: "drought",
          },
          {
            id: BigInt(900004),
            latE6: 25761700, // 25.7617
            lonE6: -80191800, // -80.1918
            balance: BigInt("1250000000000000000"), // 1.25 ETH
            source: "fake",
            marketSlug: "hurricanes",
          },
          {
            id: BigInt(900005),
            latE6: 40712600, // 40.7126
            lonE6: -74006000, // -74.0060
            balance: BigInt("50000000000000000"), // 0.05 ETH
            source: "fake",
            marketSlug: "floods",
          },
        ];

        if (!cancelled) setPositions([...realPositions, ...demoPositions]);
      } catch (e: any) {
        if (!cancelled) setPositionsError(e?.message || "Failed to load positions");
      } finally {
        if (!cancelled) setPositionsLoading(false);
      }
    }
    loadPositions();
    return () => {
      cancelled = true;
    };
  }, [address, client, marketAddress]);

  const fakeStats: Record<string, { staked: string; endsIn: string; status: string }> = {
    floods: { staked: "12.3", endsIn: "3d 4h", status: "Open" },
    earthquakes: { staked: "8.1", endsIn: "5d 0h", status: "Open" },
    drought: { staked: "2.4", endsIn: "8d 6h", status: "Open" },
    hurricanes: { staked: "18.9", endsIn: "1d 2h", status: "Open" },
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1.2fr)",
          gap: 16,
          alignItems: "start",
          maxWidth: 1500,
          margin: "0 auto",
          width: "100%",
        }}
      >
        {/* Left column: markets grid */}
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <h2 style={{ fontSize: 20, fontWeight: 800 }}>Markets</h2>
          </div>
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
              width: "100%",
            }}
          >
            {markets.map((m) => {
              const isWildfires = m.slug === "wildfires";
              const staked = isWildfires ? wildfireStaked ?? "—" : fakeStats[m.slug as keyof typeof fakeStats]?.staked ?? "—";
              const ends = isWildfires ? wildfireEndsIn ?? "—" : fakeStats[m.slug as keyof typeof fakeStats]?.endsIn ?? "—";
              const status = isWildfires ? wildfireStatus ?? "—" : fakeStats[m.slug as keyof typeof fakeStats]?.status ?? "—";
              return (
                <MarketCard key={m.slug} market={m} staked={staked} ends={ends} status={status} />
              );
            })}
          </div>
        </div>

        {/* Right column: positions list */}
        <div style={{ display: "grid", gap: 12, borderLeft: "1px solid var(--gray-15)", paddingLeft: 16 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <h2 style={{ fontSize: 20, fontWeight: 800 }}>Your positions</h2>
          </div>
          {!address && <div style={{ color: "var(--gray-60)" }}>Connect your wallet to view positions.</div>}
          {positionsLoading && <div>Loading...</div>}
          {positionsError && <div style={{ color: "#b00020" }}>{positionsError}</div>}
          <div style={{ display: "grid", gap: 10, maxHeight: "calc(100vh - 180px)", overflowY: "auto", paddingRight: 6 }}>
            {positions.map((p) => (
              <div
                key={p.id.toString()}
                style={{
                  border: "1px solid var(--gray-15)",
                  borderRadius: 12,
                  padding: "0.9rem 1rem",
                  background: "var(--gray-0)",
                  display: "grid",
                gap: 8,
                position: "relative",
                }}
              >
              <div
                style={{
                  position: "absolute",
                  top: 8,
                  right: 10,
                  fontSize: 11,
                  color: "var(--gray-60)",
                  fontWeight: 600,
                }}
                title={`ID #${p.id.toString()}`}
              >
                #{p.id.toString()}
              </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  {(() => {
                    const mk = p.marketSlug ? markets.find((m) => m.slug === p.marketSlug) : undefined;
                    const label = mk?.name || (p.marketSlug ? p.marketSlug.charAt(0).toUpperCase() + p.marketSlug.slice(1) : "");
                    const bg = mk?.accentBg || "var(--gray-10)";
                    const color = mk?.color || "var(--gray-70)";
                    return (
                      <div
                        style={{
                          background: bg,
                          color,
                          borderRadius: 9999,
                          padding: "0 10px",
                          fontSize: 12,
                          height: 24,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                        }}
                        title={p.source === "real" ? "Real position" : "Demo position"}
                      >
                        {label}
                      </div>
                    );
                  })()}
                </div>

                <div style={{ display: "grid", gridAutoFlow: "column", gridAutoColumns: "max-content", gap: 8 }}>
                  <div
                    style={{
                      background: "var(--gray-10)",
                      color: "var(--gray-70)",
                      borderRadius: 9999,
                      padding: "0 12px",
                      fontSize: 12,
                      height: 26,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    title={`Latitude ${(p.latE6 / 1_000_000).toFixed(4)}`}
                  >
                    lat {(p.latE6 / 1_000_000).toFixed(4)}
                  </div>
                  <div
                    style={{
                      background: "var(--gray-10)",
                      color: "var(--gray-70)",
                      borderRadius: 9999,
                      padding: "0 12px",
                      fontSize: 12,
                      height: 26,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    title={`Longitude ${(p.lonE6 / 1_000_000).toFixed(4)}`}
                  >
                    lng {(p.lonE6 / 1_000_000).toFixed(4)}
                  </div>
                  <div
                    style={{
                      background: "rgba(59, 130, 246, 0.10)",
                      color: "#3b82f6",
                      fontWeight: 700,
                      borderRadius: 9999,
                      padding: "0 12px",
                      fontSize: 12,
                      height: 26,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    title={`Balance ${formatEth(p.balance)} ETH`}
                  >
                    Balance {formatEth(p.balance)} ETH
                  </div>
                </div>

                {/* ID moved to top-right badge */}
              </div>
            ))}
            {positions.length === 0 && address && !positionsLoading && !positionsError && (
              <div style={{ color: "var(--gray-60)" }}>No positions found.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}



