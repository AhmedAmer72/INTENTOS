import { useState } from "react";
import { BaseError } from "viem";
import { useWallet } from "@/wallet/WalletProvider";
import { CERTIFICATE_CONSUMER_ABI } from "@/lib/abi";
import { waitForReceipt } from "@/lib/receipt";
import { writeTargetContract } from "@/lib/tx";
import { Button } from "@/components/ui/button";
import { short } from "@/lib/api";

export function PresentCertificate({
  consumer,
  intentId,
  actionHash,
  explorer,
  disabled,
}: {
  consumer?: `0x${string}` | null;
  intentId?: string;
  actionHash?: string;
  explorer?: string;
  disabled?: boolean;
}) {
  const { address, isConnected, connect, client, publicClient, ensureChain } = useWallet();
  const [tx, setTx] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!consumer || !intentId || !actionHash) return null;

  const present = async () => {
    if (!isConnected || !address) {
      await connect();
      return;
    }
    if (!client) return;
    setBusy(true);
    setErr(null);
    try {
      await ensureChain();
      const hash = await writeTargetContract(client, publicClient, {
        account: address,
        address: consumer,
        abi: CERTIFICATE_CONSUMER_ABI,
        functionName: "accept",
        args: [intentId as `0x${string}`, actionHash as `0x${string}`],
      });
      const receipt = await waitForReceipt(publicClient, hash);
      setTx(hash);
      if (receipt.status !== "success") {
        throw new Error("CertificateConsumer.accept reverted on-chain.");
      }
    } catch (e) {
      const text = e instanceof BaseError ? `${e.shortMessage} ${e.message}` : String(e);
      if (/AlreadyConsumed/i.test(text)) {
        setErr("Already presented — CertificateConsumer reverts on the second accept.");
      } else if (/IntentNotApproved/i.test(text)) {
        setErr("Not approved on IntentRegistry. Present only works after an APPROVE attestation.");
      } else {
        setErr(text);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button className="w-full" variant="outline" disabled={disabled} loading={busy} onClick={present}>
        Present certificate
      </Button>
      {tx && explorer && (
        <a className="block text-center text-xs text-primary underline" href={`${explorer}/tx/${tx}`} target="_blank" rel="noreferrer">
          presented {short(tx)}
        </a>
      )}
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}
