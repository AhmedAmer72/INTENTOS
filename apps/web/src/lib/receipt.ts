import type { Hash, PublicClient, TransactionReceipt } from "viem";

export async function waitForReceipt(
  client: PublicClient,
  hash: Hash,
  opts?: { timeoutMs?: number; intervalMs?: number },
): Promise<TransactionReceipt> {
  const timeoutMs = opts?.timeoutMs ?? 180_000;
  const intervalMs = opts?.intervalMs ?? 2_000;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const receipt = await client.getTransactionReceipt({ hash });
      if (receipt) return receipt;
    } catch {
      /* 0G RPC often has not indexed the hash yet */
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(
    `0G RPC has not indexed this transaction yet. Check the explorer, wait a few seconds, then retry.`,
  );
}
