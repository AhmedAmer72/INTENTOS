#!/usr/bin/env node
import { createPublicClient, formatEther, http } from "viem";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const walletsPath = resolve(root, ".wallets.json");

if (!existsSync(walletsPath)) {
  console.error("No .wallets.json — run pnpm provision first.");
  process.exit(1);
}

const wallets = JSON.parse(readFileSync(walletsPath, "utf8"));

const networks = [
  {
    name: "galileo",
    chainId: 16602,
    url: "https://evmrpc-testnet.0g.ai",
    explorer: "https://chainscan-galileo.0g.ai",
    faucet: "https://faucet.0g.ai",
  },
  {
    name: "mainnet",
    chainId: 16661,
    url: "https://evmrpc.0g.ai",
    explorer: "https://chainscan.0g.ai",
    faucet: "https://get.0g.ai",
  },
];

const accounts = [
  ["DEPLOYER", wallets.deployer.address],
  ["ORACLE  ", wallets.oracle.address],
];

for (const net of networks) {
  const client = createPublicClient({ transport: http(net.url) });
  console.log(`\n${net.name} (chain ${net.chainId})  ${net.explorer}`);
  for (const [label, address] of accounts) {
    try {
      const wei = await client.getBalance({ address });
      const eth = formatEther(wei);
      const flag = Number(eth) === 0 ? "  ← UNFUNDED" : "";
      console.log(`  ${label}  ${address}  ${eth} 0G${flag}`);
    } catch (err) {
      console.log(`  ${label}  ${address}  error: ${err.message}`);
    }
  }
  console.log(`  fund: ${net.faucet}`);
}
