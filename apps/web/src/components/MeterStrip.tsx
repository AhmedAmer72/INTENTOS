import { useCallback, useEffect, useState } from "react";
import { formatEther, parseEther } from "viem";
import { useWallet } from "@/wallet/WalletProvider";
import { api } from "@/lib/api";
import { waitForReceipt } from "@/lib/receipt";
import { VERIFICATION_METER_ABI } from "@/lib/abi";
import { targetChain } from "@/lib/chains";
import { Button } from "@/components/ui/button";
import type { MeterInfo } from "@/lib/types";

export function MeterStrip({
  address,
  onBusy,
  onError,
  onCredits,
}: {
  address?: `0x${string}`;
  onBusy?: (label: string | null) => void;
  onError?: (msg: string) => void;
  onCredits?: (info: MeterInfo) => void;
}) {
  const { client, publicClient, ensureChain } = useWallet();
  const [meter, setMeter] = useState<MeterInfo | null>(null);

  const refresh = useCallback(() => {
    if (!address) return;
    api<MeterInfo>(`/meter/${address}`)
      .then((info) => {
        setMeter(info);
        onCredits?.(info);
      })
      .catch(() => setMeter(null));
  }, [address, onCredits]);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 12000);
    return () => window.clearInterval(id);
  }, [refresh]);

  if (!address) return null;

  const credits = BigInt(meter?.credits ?? "0");
  const price = BigInt(meter?.priceWei ?? "0");
  const short = meter?.configured ? `${formatEther(credits)} 0G` : "not deployed";

  const deposit = async () => {
    if (!client || !meter?.address) {
      onError?.("VerificationMeter is not configured.");
      return;
    }
    onBusy?.("Depositing meter credits");
    try {
      await ensureChain();
      const hash = await client.writeContract({
        account: address,
        address: meter.address,
        abi: VERIFICATION_METER_ABI,
        functionName: "deposit",
        value: price > 0n ? price * 20n : parseEther("0.002"),
        chain: targetChain,
      });
      if (publicClient) await waitForReceipt(publicClient, hash);
      refresh();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : String(err));
    } finally {
      onBusy?.(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-full border border-border bg-black/20 px-3 py-1.5 text-[11px] text-muted-foreground">
      <span>Meter {short}</span>
      {meter?.configured && price > 0n && <span>· fee {formatEther(price)} 0G</span>}
      {meter?.configured && credits < price && <span className="text-challenge">deposit required</span>}
      {meter?.configured && (
        <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={deposit}>
          Deposit
        </Button>
      )}
    </div>
  );
}
