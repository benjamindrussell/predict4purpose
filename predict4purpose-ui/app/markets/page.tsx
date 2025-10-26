import Link from "next/link";

const markets = [
  { slug: "wildfires", name: "Wildfires", description: "Predict wildfire occurrences", working: true },
  { slug: "floods", name: "Floods", description: "Predict flood events", working: false },
  { slug: "earthquakes", name: "Earthquakes", description: "Predict seismic events", working: false },
  { slug: "drought", name: "Drought", description: "Predict drought severity", working: false },
  { slug: "hurricanes", name: "Hurricanes", description: "Predict hurricane landfalls", working: false },
];

export default function MarketsPage() {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800 }}>Markets</h1>
      <div style={{ display: "grid", gap: 12 }}>
        {markets.map((m) => (
          <Link
            key={m.slug}
            href={`/markets/${m.slug}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              border: "1px solid var(--gray-15)",
              borderRadius: 10,
              padding: "0.9rem 1rem",
              background: "var(--gray-0)",
            }}
          >
            <div>
              <div style={{ fontWeight: 700 }}>{m.name} {m.working ? "(working)" : "(demo)"}</div>
              <div style={{ color: "var(--gray-60)", fontSize: 14 }}>{m.description}</div>
            </div>
            <div style={{ color: "var(--blue)", fontWeight: 700 }}>&rarr;</div>
          </Link>
        ))}
      </div>
    </div>
  );
}


