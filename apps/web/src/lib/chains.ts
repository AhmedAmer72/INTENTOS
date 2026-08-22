import { defineChain, type Chain } from "viem";

export const galileo = defineChain({
  id: 16602,
  name: "0G Galileo Testnet",
  nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
  rpcUrls: { default: { http: ["https://evmrpc-testnet.0g.ai"] } },
  blockExplorers: { default: { name: "Chainscan", url: "https://chainscan-galileo.0g.ai" } },
});

export const aristotle = defineChain({
  id: 16661,
  name: "0G Mainnet",
  nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
  rpcUrls: { default: { http: ["https://evmrpc.0g.ai"] } },
  blockExplorers: { default: { name: "Chainscan", url: "https://chainscan.0g.ai" } },
});

export const TARGET_CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID ?? 16602);

export const targetChain = TARGET_CHAIN_ID === 16661 ? aristotle : galileo;

export function hexChainId(id: number): `0x${string}` {
  return `0x${id.toString(16)}`;
}

/** EIP-3085 payload so the wallet can prompt “Add this network?” */
export function addChainParams(chain: Chain) {
  return {
    chainId: hexChainId(chain.id),
    chainName: chain.name,
    nativeCurrency: {
      name: chain.nativeCurrency.name,
      symbol: chain.nativeCurrency.symbol,
      decimals: chain.nativeCurrency.decimals,
    },
    rpcUrls: [...chain.rpcUrls.default.http],
    blockExplorerUrls: chain.blockExplorers?.default.url ? [chain.blockExplorers.default.url] : [],
  };
}
