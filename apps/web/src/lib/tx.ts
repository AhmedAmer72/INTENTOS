import type { PublicClient, WalletClient } from "viem";
import { TARGET_CHAIN_ID, targetChain } from "@/lib/chains";

/** 0G Aristotle (16661) rejects tips below 2 gwei — RPC 0x4115. */
export const MIN_PRIORITY_FEE_WEI = TARGET_CHAIN_ID === 16661 ? 2_000_000_000n : 0n;

export async function targetTxFees(publicClient: PublicClient) {
  let maxPriorityFeePerGas = MIN_PRIORITY_FEE_WEI;
  try {
    const suggested = await publicClient.estimateMaxPriorityFeePerGas();
    if (suggested > maxPriorityFeePerGas) maxPriorityFeePerGas = suggested;
  } catch {
    if (maxPriorityFeePerGas === 0n) maxPriorityFeePerGas = 1_500_000_000n;
  }
  const block = await publicClient.getBlock({ blockTag: "latest" });
  const base = block.baseFeePerGas ?? 0n;
  const floorBase = base === 0n ? 1_000_000_000n : base;
  const maxFeePerGas = floorBase * 2n + maxPriorityFeePerGas;
  return { maxFeePerGas, maxPriorityFeePerGas };
}

export function explainTxError(err: unknown): string {
  const text =
    err && typeof err === "object" && "shortMessage" in err
      ? `${String((err as { shortMessage: unknown }).shortMessage)} ${err instanceof Error ? err.message : ""}`
      : err instanceof Error
        ? err.message
        : String(err);
  if (/gas tip cap|minimum needed 2000000000|0x4115/i.test(text)) {
    return "0G Mainnet needs a gas tip of at least 2 gwei. Confirm the wallet prompt again.";
  }
  return text;
}

export async function writeTargetContract(
  client: WalletClient,
  publicClient: PublicClient,
  args: Record<string, unknown>,
): Promise<`0x${string}`> {
  const fees = await targetTxFees(publicClient);
  return client.writeContract({
    chain: targetChain,
    ...args,
    ...fees,
  } as never);
}
