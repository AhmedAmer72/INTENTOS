/** EIP-1193 helpers for injected wallets (MetaMask, Rabby, …). */

export type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
  providers?: EthereumProvider[];
};

export function getInjectedProvider(): EthereumProvider | undefined {
  const eth = window.ethereum;
  if (!eth) return undefined;
  if (Array.isArray(eth.providers) && eth.providers.length > 0) {
    return eth.providers.find((p) => p.isMetaMask) ?? eth.providers[0];
  }
  return eth;
}

function rpcCode(err: unknown): number | undefined {
  if (!err || typeof err !== "object") return undefined;
  const e = err as {
    code?: unknown;
    data?: { originalError?: { code?: unknown }; code?: unknown };
    error?: { code?: unknown };
  };
  const raw = e.code ?? e.data?.originalError?.code ?? e.data?.code ?? e.error?.code;
  if (typeof raw === "number") return raw;
  if (typeof raw === "string" && /^-?\d+$/.test(raw)) return Number(raw);
  return undefined;
}

function rpcMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  return String(err ?? "");
}

export function isUserRejected(err: unknown): boolean {
  const code = rpcCode(err);
  return code === 4001 || code === 4100;
}

export function isRequestAlreadyPending(err: unknown): boolean {
  return rpcCode(err) === -32002;
}

/** True when the wallet does not know the target chain (EIP-3085 add is required). */
export function isUnknownChain(err: unknown): boolean {
  const code = rpcCode(err);
  if (code === 4902) return true;
  const msg = rpcMessage(err).toLowerCase();
  return (
    msg.includes("unrecognized chain") ||
    msg.includes("wallet_addethereumchain") ||
    msg.includes("chain not added") ||
    msg.includes("unknown chain") ||
    // MetaMask wraps 4902 as Internal JSON-RPC error (-32603)
    (code === -32603 && (msg.includes("chain") || msg.includes("internal json-rpc")))
  );
}

export function shouldOfferAddNetwork(err: unknown): boolean {
  if (isUserRejected(err) || isRequestAlreadyPending(err)) return false;
  return isUnknownChain(err) || rpcCode(err) === -32603;
}

export function normalizeChainId(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `0x${value.toString(16)}`;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^0x[0-9a-f]+$/i.test(trimmed)) return trimmed.toLowerCase();
    const n = Number(trimmed);
    if (Number.isFinite(n)) return `0x${n.toString(16)}`;
  }
  return "";
}
