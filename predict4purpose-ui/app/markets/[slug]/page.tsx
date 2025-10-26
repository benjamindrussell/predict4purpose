import type { Metadata } from "next";
import WildfiresClient from "./wildfiresClient";

export const metadata: Metadata = {
  title: "Market | Predict4Purpose",
};

export default function MarketDetail({ params }: { params: { slug: string } }) {
  const { slug } = params;
  if (slug === "wildfires") {
    return <WildfiresClient />;
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800 }}>{slug[0].toUpperCase() + slug.slice(1)}</h1>
      <div style={{
        border: "1px solid var(--gray-15)",
        background: "var(--gray-10)",
        borderRadius: 8,
        padding: "0.75rem 0.9rem",
      }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Demo only</div>
        <div style={{ color: "var(--gray-60)", fontSize: 14 }}>
          This market is a cosmetic placeholder for the demo. Please use the Wildfires market to try staking and claiming.
        </div>
      </div>
    </div>
  );
}


