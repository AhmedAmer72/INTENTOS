#!/usr/bin/env node
/**
 * Generate DEPLOYER and VERIFIER_ORACLE wallets.
 * Writes gitignored .wallets.json and merges keys into .env if missing.
 */
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const walletsPath = resolve(root, ".wallets.json");
const envPath = resolve(root, ".env");

function loadOrCreate() {
  if (existsSync(walletsPath)) {
    const existing = JSON.parse(readFileSync(walletsPath, "utf8"));
    if (!existing.deployer?.address && existing.deployer?.privateKey) {
      existing.deployer.address = privateKeyToAccount(existing.deployer.privateKey).address;
    }
    if (!existing.oracle?.address && existing.oracle?.privateKey) {
      existing.oracle.address = privateKeyToAccount(existing.oracle.privateKey).address;
    }
    writeFileSync(walletsPath, JSON.stringify(existing, null, 2) + "\n", { mode: 0o600 });
    console.log("Existing wallets found at .wallets.json — addresses refreshed.");
    return existing;
  }
  const deployerKey = generatePrivateKey();
  const oracleKey = generatePrivateKey();
  const deployer = privateKeyToAccount(deployerKey);
  const oracle = privateKeyToAccount(oracleKey);
  const payload = {
    createdAt: new Date().toISOString(),
    deployer: { address: deployer.address, privateKey: deployerKey },
    oracle: { address: oracle.address, privateKey: oracleKey },
  };
  writeFileSync(walletsPath, JSON.stringify(payload, null, 2) + "\n", { mode: 0o600 });
  console.log("Wrote .wallets.json (gitignored).");
  return payload;
}

function upsertEnv(wallets) {
  let env = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  if (!env) {
    env = readFileSync(resolve(root, ".env.example"), "utf8");
  }
  const replacements = {
    DEPLOYER_PRIVATE_KEY: wallets.deployer.privateKey,
    VERIFIER_ORACLE_PRIVATE_KEY: wallets.oracle.privateKey,
  };
  for (const [key, value] of Object.entries(replacements)) {
    const re = new RegExp(`^${key}=.*$`, "m");
    if (re.test(env)) {
      env = env.replace(re, `${key}=${value}`);
    } else {
      env += `\n${key}=${value}\n`;
    }
  }
  writeFileSync(envPath, env, { mode: 0o600 });
  console.log("Updated .env with wallet keys.");
}

const wallets = loadOrCreate();
upsertEnv(wallets);

console.log(`
INTENTOS wallets
----------------
DEPLOYER:         ${wallets.deployer.address}
VERIFIER_ORACLE:  ${wallets.oracle.address}

Next steps (do these now — token acquisition is the long pole):

1. Add 0G Galileo Testnet to MetaMask
   Chain ID  16602
   RPC       https://evmrpc-testnet.0g.ai
   Explorer  https://chainscan-galileo.0g.ai
   Symbol    0G

2. Claim testnet 0G
   https://faucet.0g.ai  (0.1 0G / day — start the drip today)
   https://cloud.google.com/application/web3/faucet/0g/galileo

3. Acquire mainnet 0G (Wave 3 requires a mainnet contract)
   Guided:  https://get.0g.ai
   Bridge:  https://xswap.link/bridge?toChain=16661
   Chain ID 16661  RPC https://evmrpc.0g.ai  Explorer https://chainscan.0g.ai

4. Compute Router API keys (separate balances per network)
   Testnet: https://pc.testnet.0g.ai  → deposit → API Keys → sk-...
   Mainnet: https://pc.0g.ai          → deposit → API Keys → sk-...
   Put the key in ZEROG_ROUTER_API_KEY

5. Recheck balances:  pnpm balances
`);
