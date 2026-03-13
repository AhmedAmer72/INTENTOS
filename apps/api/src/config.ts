import { config as loadEnv } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveNetwork, type ZeroGNetworkName } from "@intentos/zerog";

const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, "../.env") });
loadEnv({ path: resolve(here, "../../../.env"), override: true });

function req(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

const network = (req("ZEROG_NETWORK", "mainnet") as ZeroGNetworkName) || "mainnet";
const net = resolveNetwork(network);

export const config = {
  host: req("API_HOST", process.env.PORT ? "0.0.0.0" : "127.0.0.1"),
  port: Number(process.env.PORT ?? process.env.API_PORT ?? "8787"),
  network,
  chainId: net.chainId,
  rpc: network === "mainnet" ? req("ZEROG_MAINNET_RPC", net.rpc) : req("ZEROG_TESTNET_RPC", net.rpc),
  explorer: net.explorer,
  routerUi: net.routerUi,
  registry: req("INTENT_REGISTRY_ADDRESS") as `0x${string}` | "",
  vault: req("DEMO_VAULT_ADDRESS") as `0x${string}` | "",
  deployerKey: req("DEPLOYER_PRIVATE_KEY") as `0x${string}` | "",
  oracleKey: req("VERIFIER_ORACLE_PRIVATE_KEY") as `0x${string}` | "",
  storageUpload: req("ZEROG_STORAGE_UPLOAD") === "1",
  routerApiKey: req("ZEROG_ROUTER_API_KEY"),
  routerModel: req("ZEROG_ROUTER_MODEL", "qwen2.5-omni"),
  routerUrl:
    network === "mainnet"
      ? req("ZEROG_ROUTER_URL_MAINNET", net.routerUrl)
      : req("ZEROG_ROUTER_URL_TESTNET", net.routerUrl),
  agentIdRaw: req("AGENT_ID"),
  agentId: req("AGENT_ID") as `0x${string}` | "",
  requirementAgentIdRaw: req("REQUIREMENT_AGENT_ID"),
  meter: req("VERIFICATION_METER_ADDRESS") as `0x${string}` | "",
  consumer: req("CERTIFICATE_CONSUMER_ADDRESS") as `0x${string}` | "",
  agenticId: req("AGENTIC_ID_ADDRESS") as `0x${string}` | "",
  agenticToken: req("AGENTIC_ID_TOKEN"),
  executor: req("INTENT_EXECUTOR_ADDRESS") as `0x${string}` | "",
  settlementTarget: req("SETTLEMENT_TARGET_ADDRESS") as `0x${string}` | "",
  bounty: req("INTENT_BOUNTY_ADDRESS") as `0x${string}` | "",
  agenticIdV2: req("AGENTIC_ID_V2_ADDRESS") as `0x${string}` | "",
  agenticTokenV2: req("AGENTIC_ID_V2_TOKEN"),
  challengeDelay: Number(req("CHALLENGE_DELAY_SECONDS", "900") || "900"),
  verifyPriceWei: BigInt(req("VERIFY_PRICE_WEI", "100000000000000")),
  identityRegistry: net.identityRegistry,
  reputationRegistry: net.reputationRegistry,
};
