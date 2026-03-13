import { formatEther, type PublicClient, type WalletClient } from "viem";
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

/** Rough ceiling for the writes this app makes; only used to reserve gas headroom. */
const GAS_HEADROOM = 400_000n;

function formatOg(wei: bigint) {
  return `${formatEther(wei)} ${targetChain.nativeCurrency.symbol}`;
}

/**
 * Wallets surface "insufficient funds" only after the user has already opened
 * and read the confirmation. Checking first keeps the failure in the app, where
 * we can say which balance is short and by how much.
 */
async function assertFunds(
  publicClient: PublicClient,
  account: `0x${string}`,
  value: bigint,
  maxFeePerGas: bigint,
) {
  const balance = await publicClient.getBalance({ address: account });
  const reserve = maxFeePerGas * GAS_HEADROOM;
  if (balance < value) {
    throw new Error(
      `Insufficient ${targetChain.nativeCurrency.symbol}. This transaction sends ${formatOg(value)} but ${account} holds ${formatOg(balance)} on ${targetChain.name}.`,
    );
  }
  if (balance < value + reserve) {
    throw new Error(
      `Not enough ${targetChain.nativeCurrency.symbol} left for gas. Sending ${formatOg(value)} leaves ${formatOg(balance - value)}, and this call can cost up to about ${formatOg(reserve)} in fees on ${targetChain.name}.`,
    );
  }
}

export async function writeTargetContract(
  client: WalletClient,
  publicClient: PublicClient,
  args: Record<string, unknown>,
): Promise<`0x${string}`> {
  const fees = await targetTxFees(publicClient);
  const account = args.account as `0x${string}` | undefined;
  if (account) {
    const value = typeof args.value === "bigint" ? args.value : 0n;
    await assertFunds(publicClient, account, value, fees.maxFeePerGas);
  }
  return client.writeContract({
    chain: targetChain,
    ...args,
    ...fees,
  } as never);
}
