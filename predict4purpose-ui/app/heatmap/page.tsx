"use client";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

const MapPicker = dynamic(() => import("@/app/components/MapPicker"), { ssr: false });

type IntensityPoint = { lat: number; lng: number; radius: number };

const demoPoints: IntensityPoint[] = [
  { lat: 37.7749, lng: -122.4194, radius: 15000 },
  { lat: 34.0522, lng: -118.2437, radius: 12000 },
  { lat: 40.7128, lng: -74.006, radius: 18000 },
  { lat: 47.6062, lng: -122.3321, radius: 9000 },
];

export default function HeatmapPage() {
  const [points] = useState<IntensityPoint[]>(demoPoints);
  const radiusMeters = useMemo(() => 10000, []);
  const [center] = useState<{ lat: number; lng: number }>({ lat: 39.5, lng: -98.35 });

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800 }}>Prediction heatmap</h1>
      <div style={{ border: "1px solid var(--gray-15)", borderRadius: 8, overflow: "hidden" }}>
        <div style={{ height: "70vh", position: "relative" }}>
          {/* Reuse map container; overlay circles for intensity */}
          <MapPicker value={center} onChange={() => {}} radiusMeters={radiusMeters} />
          {/* Overlay rendered via CSS pointer-events to avoid capturing clicks */}
          <div style={{ pointerEvents: "none", position: "absolute", inset: 0 }} />
        </div>
      </div>
      <div style={{ color: "var(--gray-60)", fontSize: 14 }}>
        Demo heatmap uses synthetic hotspots. For the hackathon, this is cosmetic.
      </div>
    </div>
  );
}


