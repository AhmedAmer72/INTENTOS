import { config as loadEnv } from "dotenv";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import hre from "hardhat";

loadEnv({ path: resolve(__dirname, "../../../.env") });

async function main() {
  const [deployer, oracleFromAccounts] = await hre.ethers.getSigners();
  const oracleAddress =
    process.env.VERIFIER_ORACLE_ADDRESS ??
    oracleFromAccounts?.address ??
    deployer.address;

  console.log("Deployer", deployer.address);
  console.log("Oracle  ", oracleAddress);
  console.log("Network ", hre.network.name, hre.network.config.chainId);

  const Registry = await hre.ethers.getContractFactory("IntentRegistry");
  const registry = await Registry.deploy(deployer.address, oracleAddress);
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("IntentRegistry", registryAddress);

  const Vault = await hre.ethers.getContractFactory("DemoVault");
  const vault = await Vault.deploy(registryAddress);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("DemoVault     ", vaultAddress);

  const payload = {
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    deployer: deployer.address,
    oracle: oracleAddress,
    IntentRegistry: registryAddress,
    DemoVault: vaultAddress,
    deployedAt: new Date().toISOString(),
    registryTx: registry.deploymentTransaction()?.hash,
    vaultTx: vault.deploymentTransaction()?.hash,
  };
  const dir = resolve(__dirname, "../deployments");
  mkdirSync(dir, { recursive: true });
  const file = resolve(dir, `${hre.network.name}.json`);
  writeFileSync(file, JSON.stringify(payload, null, 2) + "\n");
  console.log("Wrote", file);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
