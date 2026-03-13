export async function waitDeployed(
  contract: { waitForDeployment: () => Promise<unknown>; getAddress: () => Promise<string> },
  label: string,
): Promise<string> {
  for (let i = 0; i < 8; i++) {
    try {
      await contract.waitForDeployment();
      return contract.getAddress();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/no matching receipts|potential data corruption/i.test(msg) || i === 7) throw err;
      console.log(label, "receipt retry", i + 1);
      await new Promise((r) => setTimeout(r, 4000 * (i + 1)));
    }
  }
  return contract.getAddress();
}
