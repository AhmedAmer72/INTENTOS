import { defineChain } from "viem";

export type ZeroGNetworkName = "galileo" | "mainnet";

export const NETWORKS = {
  galileo: {
    name: "galileo" as const,
    chainId: 16602,
    rpc: "https://evmrpc-testnet.0g.ai",
    explorer: "https://chainscan-galileo.0g.ai",
    storageIndexer: "https://indexer-storage-testnet-turbo.0g.ai",
    routerUrl: "https://router-api-testnet.integratenetwork.work/v1",
    routerUi: "https://pc.testnet.0g.ai",
    identityRegistry: "0x8004A818BFB912233c491871b3d84c89A494BD9e" as const,
    reputationRegistry: "0x8004B663056A597Dffe9eCcC1965A193B7388713" as const,
    nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
  },
  mainnet: {
    name: "mainnet" as const,
    chainId: 16661,
    rpc: "https://evmrpc.0g.ai",
    explorer: "https://chainscan.0g.ai",
    storageIndexer: "https://indexer-storage-turbo.0g.ai",
    routerUrl: "https://router-api.0g.ai/v1",
    routerUi: "https://pc.0g.ai",
    identityRegistry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as const,
    reputationRegistry: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63" as const,
    nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
  },
};

export function resolveNetwork(name?: string) {
  if (name === "mainnet") return NETWORKS.mainnet;
  return NETWORKS.galileo;
}

export function viemChain(name?: ZeroGNetworkName) {
  const n = resolveNetwork(name);
  return defineChain({
    id: n.chainId,
    name: n.name === "mainnet" ? "0G Mainnet" : "0G Galileo Testnet",
    nativeCurrency: n.nativeCurrency,
    rpcUrls: { default: { http: [n.rpc] } },
    blockExplorers: { default: { name: "Chainscan", url: n.explorer } },
  });
}

export function explorerTx(network: keyof typeof NETWORKS, hash: string) {
  return `${NETWORKS[network].explorer}/tx/${hash}`;
}

export function explorerAddress(network: keyof typeof NETWORKS, address: string) {
  return `${NETWORKS[network].explorer}/address/${address}`;
}
