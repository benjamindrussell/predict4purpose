"use client";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import * as L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { spatialMarketAbi } from "@/app/lib/abi/SpatialMarket";

type ChainPosition = { id: bigint; latE6: number; lonE6: number; source?: "real" | "fake"; marketSlug?: string };

function resolveImageUrl(img: unknown): string {
  if (typeof img === "string") return img;
  if (img && typeof (img as any).src === "string") return (img as any).src as string;
  return "";
}

function useDefaultIconFix() {
  useEffect(() => {
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: resolveImageUrl(markerIcon2x),
      iconUrl: resolveImageUrl(markerIcon),
      shadowUrl: resolveImageUrl(markerShadow),
    });
  }, []);
}

export default function PositionsMapPage() {
  useDefaultIconFix();

  const [positions, setPositions] = useState<ChainPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia.base.org";
  const marketAddress = process.env.NEXT_PUBLIC_MARKET_ADDRESS as `0x${string}` | undefined;
  const client = useMemo(() => createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) }), [rpcUrl]);

  // Market color mapping (match Markets page)
  const marketColors: Record<string, string> = useMemo(() => ({
    wildfires: "#ef4444",
    floods: "#3b82f6",
    earthquakes: "#f59e0b",
    drought: "#10b981",
    hurricanes: "#8b5cf6",
  }), []);

  // Cache generated icons by color
  const iconCache = useMemo(() => new Map<string, L.Icon>(), []);
  const getColorIcon = useMemo(() => {
    return (color: string) => {
      const key = color.toLowerCase();
      const cached = iconCache.get(key);
      if (cached) return cached;
      const svg = `<?xml version="1.0" encoding="UTF-8"?><svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg"><path d="M12.5 0C5.596 0 0 5.596 0 12.5c0 9.375 12.5 28.5 12.5 28.5S25 21.875 25 12.5C25 5.596 19.404 0 12.5 0zm0 18.75a6.25 6.25 0 1 1 0-12.5 6.25 6.25 0 0 1 0 12.5z" fill="${color}"/></svg>`;
      const url = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
      const icon = L.icon({
        iconRetinaUrl: url,
        iconUrl: url,
        shadowUrl: resolveImageUrl(markerShadow),
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        tooltipAnchor: [16, -28],
        shadowSize: [41, 41],
      });
      iconCache.set(key, icon);
      return icon;
    };
  }, [iconCache]);

  useEffect(() => {
    let cancelled = false;
    async function loadAllPositions() {
      if (!marketAddress) return;
      setLoading(true);
      setError(null);
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

        // Fetch all Stake logs in range (no staker filter)
        const logs = (await client.getLogs({ address: marketAddress, event: stakeEvent, fromBlock, toBlock: currentBlock })) as any[];

        // Keep first lat/lon seen per id
        const latLonById = new Map<bigint, { latE6: number; lonE6: number }>();
        for (const lg of logs) {
          const id = lg.args.id as bigint;
          if (!latLonById.has(id)) {
            latLonById.set(id, { latE6: Number(lg.args.latE6), lonE6: Number(lg.args.lonE6) });
          }
        }
        const realPositions: ChainPosition[] = Array.from(latLonById.entries()).map(([id, { latE6, lonE6 }]) => ({ id, latE6, lonE6, source: "real", marketSlug: "wildfires" }));

        const demoPositions: ChainPosition[] = [
          { id: BigInt(900002), latE6: 29760400, lonE6: -95369800, source: "fake", marketSlug: "floods" },
          { id: BigInt(900003), latE6: 33448400, lonE6: -112074000, source: "fake", marketSlug: "earthquakes" },
          { id: BigInt(900004), latE6: 25761700, lonE6: -80191800, source: "fake", marketSlug: "hurricanes" },
          { id: BigInt(900005), latE6: 40712600, lonE6: -74006000, source: "fake", marketSlug: "drought" },
        ];

        if (!cancelled) setPositions([...realPositions, ...demoPositions]);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load map positions");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadAllPositions();
    return () => {
      cancelled = true;
    };
  }, [client, marketAddress]);

  const defaultCenter = { lat: 20, lng: 0 };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800 }}>Map</h1>
      <div style={{ border: "1px solid var(--gray-15)", borderRadius: 8, overflow: "hidden" }}>
        <div style={{ height: "70vh", position: "relative" }}>
          <MapContainer center={[defaultCenter.lat, defaultCenter.lng]} zoom={2} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {positions.map((p) => {
              const color = (p.marketSlug && marketColors[p.marketSlug]) || "#432DD7";
              const icon = getColorIcon(color);
              return (
                <Marker key={p.id.toString() + (p.marketSlug || p.source || "")}
                        position={[p.latE6 / 1_000_000, p.lonE6 / 1_000_000]}
                        icon={icon}
                />
              );
            })}
          </MapContainer>
        </div>
      </div>
      {loading && <div>Loading map positions…</div>}
      {error && <div style={{ color: "#b00020", fontSize: 14 }}>{error}</div>}
    </div>
  );
}



