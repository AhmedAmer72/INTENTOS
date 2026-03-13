import { useEffect, useState } from "react";
import { BaseError } from "viem";
import { useWallet } from "@/wallet/WalletProvider";
import { api } from "@/lib/api";
import { waitForReceipt } from "@/lib/receipt";
import { ERC8004_IDENTITY_ABI, ERC8004_REPUTATION_ABI } from "@/lib/abi";
import { writeTargetContract } from "@/lib/tx";
import { Button } from "@/components/ui/button";
import { short } from "@/lib/api";

function tokenId(agentId?: string | null): bigint | null {
  if (!agentId) return null;
  try {
    return BigInt(agentId);
  } catch {
    return null;
  }
}

export function GiveFeedback({
  agentId,
  verdict,
  actionHash,
  evidenceHash,
  identityRegistry,
  reputationRegistry,
  explorer,
}: {
  agentId?: string | null;
  verdict?: string;
  actionHash?: string;
  evidenceHash?: string;
  identityRegistry?: `0x${string}`;
  reputationRegistry?: `0x${string}`;
  explorer?: string;
}) {
  const { address, isConnected, connect, client, publicClient, ensureChain } = useWallet();
  const [owner, setOwner] = useState<`0x${string}` | null>(null);
  const [tx, setTx] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = tokenId(agentId);

  useEffect(() => {
    if (!id || !identityRegistry) return;
    publicClient
      .readContract({
        address: identityRegistry,
        abi: ERC8004_IDENTITY_ABI,
        functionName: "ownerOf",
        args: [id],
      })
      .then((o) => setOwner(o as `0x${string}`))
      .catch(() => setOwner(null));
  }, [id, identityRegistry, publicClient]);

  if (!reputationRegistry || !id || !verdict || !actionHash || !evidenceHash) return null;

  const self = Boolean(address && owner && address.toLowerCase() === owner.toLowerCase());
  const value = verdict === "APPROVE" ? 1n : verdict === "REJECT" ? -1n : 0n;

  const submit = async () => {
    if (!isConnected || !address) {
      await connect();
      return;
    }
    if (self) {
      setErr("This wallet owns the agent. ERC-8004 rejects self-feedback — switch to the principal wallet.");
      return;
    }
    if (!client) return;
    setBusy(true);
    setErr(null);
    try {
      await ensureChain();
      const hash = await writeTargetContract(client, publicClient, {
        account: address,
        address: reputationRegistry,
        abi: ERC8004_REPUTATION_ABI,
        functionName: "giveFeedback",
        args: [
          id,
          value,
          0,
          "intentos",
          verdict,
          "",
          `/proof/${actionHash}`,
          evidenceHash as `0x${string}`,
        ],
      });
      const receipt = await waitForReceipt(publicClient, hash);
      setTx(hash);
      if (receipt.status !== "success") throw new Error("giveFeedback reverted on-chain.");
      await api("/reputation", {
        method: "POST",
        body: JSON.stringify({ actionHash, reputationTx: hash }),
      }).catch(() => undefined);
    } catch (e) {
      const text = e instanceof BaseError ? `${e.shortMessage} ${e.message}` : String(e);
      if (/self/i.test(text) || /owner/i.test(text)) {
        setErr("This wallet owns the agent. Use a different wallet for giveFeedback.");
      } else {
        setErr(text);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      {self ? (
        <p className="text-xs text-challenge">
          Connected wallet owns agent #{id.toString()}. Use a different wallet to giveFeedback.
        </p>
      ) : (
        <Button className="w-full" variant="outline" loading={busy} onClick={submit}>
          Give ERC-8004 feedback ({verdict} {value > 0n ? "+1" : value < 0n ? "−1" : "0"})
        </Button>
      )}
      {tx && explorer && (
        <a className="block text-center text-xs text-primary underline" href={`${explorer}/tx/${tx}`} target="_blank" rel="noreferrer">
          reputation {short(tx)}
        </a>
      )}
      {err && <p className="text-xs text-destructive">{err}</p>}
    </div>
  );
}
