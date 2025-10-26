"use client";
import { useCallback, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { baseSepolia } from "viem/chains";
import { encodeFunctionData, isHex, createPublicClient, parseAbiItem, http } from "viem";
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

export default function ClaimForm() {
  const { address } = useAccount();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const marketAddress = process.env.NEXT_PUBLIC_MARKET_ADDRESS as `0x${string}` | undefined;
  const isSponsored = Boolean(process.env.NEXT_PUBLIC_CDP_PAYMASTER_URL);
  const resolutionApi = process.env.NEXT_PUBLIC_RESOLUTION_API_URL;
  const deployBlockStr = process.env.NEXT_PUBLIC_MARKET_DEPLOY_BLOCK;
  const fromBlock = useMemo(() => {
    try {
      return deployBlockStr ? BigInt(deployBlockStr) : BigInt(0);
    } catch {
      return BigInt(0);
    }
  }, [deployBlockStr]);

  const canSubmit = useMemo(() => Boolean(marketAddress && address), [marketAddress, address]);

  const calls = useCallback(async () => {
    if (!marketAddress) throw new Error("Missing NEXT_PUBLIC_MARKET_ADDRESS");
    if (!address) throw new Error("Connect wallet to claim");
    setInfo(null);

    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia.base.org";
    const client = createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) });
    const stakeEvent = parseAbiItem(
      "event Stake(address indexed staker, uint256 indexed id, int32 latE6, int32 lonE6, uint256 amount)"
    );

    // Find user's staked ids from logs
    // Fetch logs in chunks to respect provider max range limits
    const currentBlock = await client.getBlockNumber();
    const maxRange = BigInt(100000);
    const start = fromBlock && fromBlock > BigInt(0) ? fromBlock : (currentBlock > maxRange ? currentBlock - maxRange : BigInt(0));
    const aggregatedLogs: any[] = [];
    let chunkFrom = start;
    while (chunkFrom <= currentBlock) {
      const chunkTo = (chunkFrom + (maxRange - BigInt(1))) < currentBlock ? (chunkFrom + (maxRange - BigInt(1))) : currentBlock;
      const chunk = await client.getLogs({
        address: marketAddress,
        event: stakeEvent,
        args: { staker: address },
        fromBlock: chunkFrom,
        toBlock: chunkTo,
      });
      aggregatedLogs.push(...chunk);
      if (chunkTo === currentBlock) break;
      chunkFrom = chunkTo + BigInt(1);
    }
    const uniqueIds: bigint[] = Array.from(new Set(aggregatedLogs.map((l: any) => l.args.id as bigint)));
    if (uniqueIds.length === 0) throw new Error("No stakes found for this wallet");

    // Filter to ids with current non-zero balance
    const balances = await Promise.all(
      uniqueIds.map((id) =>
        client.readContract({
          address: marketAddress,
          abi: spatialMarketAbi,
          functionName: "balanceOf",
          args: [address, id],
        }) as Promise<bigint>
      )
    );
    const heldIds: bigint[] = uniqueIds.filter((_, i) => (balances[i] as bigint) > BigInt(0));
    if (heldIds.length === 0) throw new Error("No claimable positions (zero balance)");

    if (resolutionApi) {
      // Preferred path: fetch payout info and proof for each id from resolution API
      const resolutionItems = await Promise.all(
        heldIds.map(async (id: bigint) => {
          const res = await fetch(`${resolutionApi}/id/${id.toString()}`);
          if (!res.ok) throw new Error(`Resolution API error for id ${id}`);
          const json = await res.json();
          // Expect { payoutNumerator: string | number, proof: string[] }
          const pn = BigInt(json.payoutNumerator);
          const proof = (json.proof as string[])
            .map((h) => (h.startsWith("0x") ? h : `0x${h}`))
            .filter((h) => isHex(h)) as `0x${string}`[];
          return { id, payoutNumerator: pn, proof };
        })
      );

      const winning = resolutionItems.filter((x) => x.payoutNumerator > BigInt(0) && x.proof.length > 0);
      if (winning.length === 0) throw new Error("No winnings to claim for this wallet");

      setInfo(`Claiming ${winning.length} position(s)`);

      const encoded = winning.map(({ id, payoutNumerator, proof }) =>
        encodeFunctionData({ abi: spatialMarketAbi, functionName: "claim", args: [id, payoutNumerator, proof] })
      );
      return encoded.map((data) => ({ to: marketAddress, data }));
    }

    // Fallback path: attempt with empty proof and payoutNumerator = totalStaked (matches your CLI usage)
    const totalStaked = (await client.readContract({
      address: marketAddress,
      abi: spatialMarketAbi,
      functionName: "totalStaked",
      args: [],
    })) as bigint;

    if (totalStaked <= BigInt(0)) throw new Error("Market not resolved or no stakes recorded");
    setInfo(`Attempting claim for ${heldIds.length} position(s) with empty proof...`);

    const encoded = heldIds.map((id) =>
      encodeFunctionData({ abi: spatialMarketAbi, functionName: "claim", args: [id, totalStaked, []] })
    );
    return encoded.map((data) => ({ to: marketAddress, data }));
  }, [address, fromBlock, marketAddress, resolutionApi]);

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
      setInfo("Submitting claim transaction(s)...");
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
        const receipts = (status as any).statusData?.transactionReceipts as any[] | undefined;
        const count = Array.isArray(receipts) ? receipts.length : undefined;
        setInfo(count ? `Claim successful (${count} txn${count > 1 ? "s" : ""}).` : "Claim successful.");
      }
    }
  }, []);

  return (
    <form onSubmit={(e) => e.preventDefault()} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{
        border: "1px solid var(--gray-15)",
        background: "var(--gray-10)",
        borderRadius: 8,
        padding: "0.75rem 0.9rem"
      }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Claim winnings</div>
          This will automatically discover your positions and claim winnings. If no resolution API is configured, it will attempt a claim with an empty Merkle proof and a default numerator.
      </div>

        <div style={{ color: "var(--gray-60)", fontSize: 14 }}>
        </div>

      <Transaction
        chainId={baseSepolia.id}
        calls={calls}
        onStatus={handleOnStatus}
        isSponsored={isSponsored}
      >
        <TransactionButton disabled={!canSubmit || submitting} className="ock-button" />
        {isSponsored && <TransactionSponsor />}
        <TransactionToast>
          <TransactionToastIcon />
          <TransactionToastLabel />
          <TransactionToastAction />
        </TransactionToast>
      </Transaction>

      {error && (
        <div style={{ color: "#b00020", fontSize: 14 }}>{error}</div>
      )}
      {info && (
        <div style={{ color: "var(--gray-60)", fontSize: 14 }}>{info}</div>
      )}
    </form>
  );
}


