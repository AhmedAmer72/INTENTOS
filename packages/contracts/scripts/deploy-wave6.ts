import { config as loadEnv } from "dotenv";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import hre from "hardhat";
import { waitDeployed } from "./wait-deployed";

loadEnv({ path: resolve(__dirname, "../../../.env") });

async function main() {
  const registry = process.env.INTENT_REGISTRY_ADDRESS;
  if (!registry) {
    throw new Error(
      "INTENT_REGISTRY_ADDRESS is required. Wave 6 must not deploy IntentRegistry or DemoVault.",
    );
  }

  const [deployer] = await hre.ethers.getSigners();
  const delay = BigInt(process.env.CHALLENGE_DELAY_SECONDS ?? "900");
  const oracleKey = process.env.VERIFIER_ORACLE_PRIVATE_KEY;
  const oracle = oracleKey ? new hre.ethers.Wallet(oracleKey).address : deployer.address;

  console.log("Deployer", deployer.address);
  console.log("Oracle  ", oracle);
  console.log("Registry", registry, "(reuse — not redeployed)");
  console.log("Network ", hre.network.name, hre.network.config.chainId);
  console.log("Delay   ", delay.toString(), "seconds");

  const Executor = await hre.ethers.getContractFactory("IntentExecutor");
  const executor = await Executor.deploy(registry, delay);
  const executorAddress = await waitDeployed(executor, "IntentExecutor");
  console.log("IntentExecutor", executorAddress);

  const Target = await hre.ethers.getContractFactory("SettlementTarget");
  const target = await Target.deploy();
  const targetAddress = await waitDeployed(target, "SettlementTarget");
  console.log("SettlementTarget", targetAddress);

  const Bounty = await hre.ethers.getContractFactory("IntentBounty");
  const bounty = await Bounty.deploy(registry);
  const bountyAddress = await waitDeployed(bounty, "IntentBounty");
  console.log("IntentBounty", bountyAddress);

  const Agentic = await hre.ethers.getContractFactory("IntentosAgenticIdV2");
  const agentic = await Agentic.deploy(oracle);
  const agenticAddress = await waitDeployed(agentic, "IntentosAgenticIdV2");
  console.log("IntentosAgenticIdV2", agenticAddress);

  const dir = resolve(__dirname, "../deployments");
  mkdirSync(dir, { recursive: true });
  const file = resolve(dir, `${hre.network.name}.json`);
  const prev = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  const payload = {
    ...prev,
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    deployer: deployer.address,
    IntentRegistry: prev.IntentRegistry ?? registry,
    DemoVault: prev.DemoVault,
    IntentExecutor: executorAddress,
    SettlementTarget: targetAddress,
    IntentBounty: bountyAddress,
    IntentosAgenticIdV2: agenticAddress,
    challengeDelaySeconds: delay.toString(),
    wave6At: new Date().toISOString(),
    executorTx: executor.deploymentTransaction()?.hash,
    settlementTargetTx: target.deploymentTransaction()?.hash,
    bountyTx: bounty.deploymentTransaction()?.hash,
    agenticV2Tx: agentic.deploymentTransaction()?.hash,
  };
  writeFileSync(file, JSON.stringify(payload, null, 2) + "\n");
  console.log("Wrote", file);
  console.log("Set INTENT_EXECUTOR_ADDRESS=" + executorAddress);
  console.log("Set SETTLEMENT_TARGET_ADDRESS=" + targetAddress);
  console.log("Set INTENT_BOUNTY_ADDRESS=" + bountyAddress);
  console.log("Set AGENTIC_ID_V2_ADDRESS=" + agenticAddress);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
