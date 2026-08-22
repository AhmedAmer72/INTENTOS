import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  type PublicClient,
  type WalletClient,
} from "viem";
import { addChainParams, targetChain } from "@/lib/chains";
import { getInjectedProvider, isRequestAlreadyPending, isUserRejected, normalizeChainId } from "@/wallet/eip1193";

type WalletState = {
  address?: `0x${string}`;
  isConnected: boolean;
  connect: () => Promise<void>;
  ensureChain: () => Promise<void>;
  client: WalletClient | null;
  publicClient: PublicClient;
};

const Ctx = createContext<WalletState | null>(null);

const NO_WALLET = "No injected wallet. Install MetaMask — Connect will offer to add 0G Galileo for you.";

async function addOrSwitchChain() {
  const eth = getInjectedProvider();
  if (!eth) throw new Error(NO_WALLET);

  const params = addChainParams(targetChain);
  const wanted = params.chainId as `0x${string}`;

  const current = normalizeChainId(await eth.request({ method: "eth_chainId" }));
  if (current === wanted.toLowerCase()) return;

  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: wanted }],
    });
    return;
  } catch (err) {
    if (isUserRejected(err) || isRequestAlreadyPending(err)) throw err;
  }

  // EIP-3085: MetaMask / Rabby prompt “Add this network?” (or “Switch?” if it already exists).
  await eth.request({
    method: "wallet_addEthereumChain",
    params: [params],
  });

  const after = normalizeChainId(await eth.request({ method: "eth_chainId" }));
  if (after === wanted.toLowerCase()) return;

  await eth.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: wanted }],
  });
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<`0x${string}` | undefined>();

  const publicClient = useMemo(
    () =>
      createPublicClient({
        chain: targetChain,
        transport: http(targetChain.rpcUrls.default.http[0] ?? "https://evmrpc-testnet.0g.ai"),
      }),
    [],
  );

  const ensureChain = useCallback(async () => {
    await addOrSwitchChain();
  }, []);

  const connect = useCallback(async () => {
    const eth = getInjectedProvider();
    if (!eth) throw new Error(NO_WALLET);

    // Permission first — some wallets ignore add/switch until the site is connected.
    const accounts = (await eth.request({
      method: "eth_requestAccounts",
    })) as `0x${string}`[];
    const next = accounts[0];
    if (!next) throw new Error("No account returned");
    setAddress(next);

    await addOrSwitchChain();
  }, []);

  useEffect(() => {
    const eth = getInjectedProvider();
    if (!eth?.on) return;

    const onAccounts = (...args: unknown[]) => {
      const accounts = args[0];
      const next = Array.isArray(accounts) ? (accounts[0] as `0x${string}` | undefined) : undefined;
      setAddress(next);
    };

    eth.on("accountsChanged", onAccounts);
    return () => {
      eth.removeListener?.("accountsChanged", onAccounts);
    };
  }, []);

  const client = useMemo(() => {
    const eth = getInjectedProvider();
    if (!eth || !address) return null;
    return createWalletClient({
      account: address,
      chain: targetChain,
      transport: custom(eth as Parameters<typeof custom>[0]),
    });
  }, [address]);

  const value = useMemo<WalletState>(
    () => ({
      address,
      isConnected: Boolean(address),
      connect,
      ensureChain,
      client,
      publicClient,
    }),
    [address, connect, ensureChain, client, publicClient],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWallet outside WalletProvider");
  return ctx;
}
