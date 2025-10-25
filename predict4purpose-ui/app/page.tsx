"use client";
import styles from "./page.module.css";
import { Wallet } from "@coinbase/onchainkit/wallet";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

const MapPicker = dynamic(() => import("./components/MapPicker"), {
  ssr: false,
});
const StakeForm = dynamic(() => import("./components/StakeForm"), {
  ssr: false,
});

export default function Home() {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [amount, setAmount] = useState<string>("");
  const radiusMeters = useMemo(() => {
    const env = process.env.NEXT_PUBLIC_RADIUS_METERS;
    const parsed = env ? Number(env) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 5000;
  }, []);

  return (
    <div className={styles.container}>
      <header className={styles.headerWrapper}>
        <div className={styles.siteTitle}>Predict4Purpose</div>
        <Wallet />
      </header>

      <div className={styles.content}>
        <div className={`${styles.panel} ${styles.mapPanel}`}>
          <MapPicker value={position} onChange={setPosition} radiusMeters={radiusMeters} />
        </div>
        <div className={`${styles.panel} ${styles.formPanel}`}>
          <StakeForm
            amount={amount}
            onAmountChange={setAmount}
            radiusMeters={radiusMeters}
            position={position}
          />
        </div>
      </div>
    </div>
  );
}
