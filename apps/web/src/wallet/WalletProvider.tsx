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
  /** Chain the injected wallet is currently on, or undefined while unknown. */
  chainId?: number;
  /** Connected but pointed at a chain other than the one this build targets. */
  wrongNetwork: boolean;
  /** True until the initial silent reconnect check has finished. */
  restoring: boolean;
  hasProvider: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  ensureChain: () => Promise<void>;
  client: WalletClient | null;
  publicClient: PublicClient;
};

const Ctx = createContext<WalletState | null>(null);

const NO_WALLET = `No injected wallet. Install MetaMask — Connect will offer to add ${targetChain.name} for you.`;

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

/** Wallets that have been authorised before expose accounts without prompting. */
const DISCONNECTED_KEY = "intentos.wallet.disconnected";

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<`0x${string}` | undefined>();
  const [chainId, setChainId] = useState<number | undefined>();
  const [restoring, setRestoring] = useState(true);
  const hasProvider = typeof window !== "undefined" && Boolean(getInjectedProvider());

  const publicClient = useMemo(
    () =>
      createPublicClient({
        chain: targetChain,
        transport: http(targetChain.rpcUrls.default.http[0] ?? "https://evmrpc.0g.ai", {
          timeout: 30_000,
          retryCount: 5,
          retryDelay: 1_200,
        }),
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
    window.localStorage.removeItem(DISCONNECTED_KEY);
    setAddress(next);

    await addOrSwitchChain();
  }, []);

  const disconnect = useCallback(async () => {
    // Remembered so a refresh does not silently reconnect a wallet the user dropped.
    window.localStorage.setItem(DISCONNECTED_KEY, "1");
    setAddress(undefined);
    const eth = getInjectedProvider();
    if (!eth) return;
    try {
      await eth.request({
        method: "wallet_revokePermissions",
        params: [{ eth_accounts: {} }],
      });
    } catch {
      // Older wallets have no revoke. Local disconnect is enough for the UI.
    }
  }, []);

  // Restore an already-authorised session on reload, and track chain/account changes.
  useEffect(() => {
    const eth = getInjectedProvider();
    if (!eth) {
      setRestoring(false);
      return;
    }

    let live = true;

    const readChain = async () => {
      try {
        const raw = await eth.request({ method: "eth_chainId" });
        const hex = normalizeChainId(raw);
        if (live) setChainId(hex ? Number.parseInt(hex, 16) : undefined);
      } catch {
        if (live) setChainId(undefined);
      }
    };

    void (async () => {
      await readChain();
      try {
        if (window.localStorage.getItem(DISCONNECTED_KEY) !== "1") {
          // eth_accounts never prompts — it only reports existing permission.
          const accounts = (await eth.request({ method: "eth_accounts" })) as `0x${string}`[];
          if (live && accounts?.[0]) setAddress(accounts[0]);
        }
      } catch {
        /* wallet locked or permission withdrawn — stay disconnected */
      } finally {
        if (live) setRestoring(false);
      }
    })();

    if (!eth.on) return () => { live = false; };

    const onAccounts = (...args: unknown[]) => {
      const accounts = args[0];
      const next = Array.isArray(accounts) ? (accounts[0] as `0x${string}` | undefined) : undefined;
      if (!next) window.localStorage.setItem(DISCONNECTED_KEY, "1");
      setAddress(next);
    };
    const onChain = (...args: unknown[]) => {
      const hex = normalizeChainId(args[0]);
      setChainId(hex ? Number.parseInt(hex, 16) : undefined);
    };

    eth.on("accountsChanged", onAccounts);
    eth.on("chainChanged", onChain);
    return () => {
      live = false;
      eth.removeListener?.("accountsChanged", onAccounts);
      eth.removeListener?.("chainChanged", onChain);
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
      chainId,
      wrongNetwork: Boolean(address && chainId !== undefined && chainId !== targetChain.id),
      restoring,
      hasProvider,
      connect,
      disconnect,
      ensureChain,
      client,
      publicClient,
    }),
    [address, chainId, restoring, hasProvider, connect, disconnect, ensureChain, client, publicClient],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWallet outside WalletProvider");
  return ctx;
}
