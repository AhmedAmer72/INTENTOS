import { config as loadEnv } from "dotenv";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import hre from "hardhat";

loadEnv({ path: resolve(__dirname, "../../../.env") });

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const registry = process.env.INTENT_REGISTRY_ADDRESS;
  if (!registry) throw new Error("INTENT_REGISTRY_ADDRESS is required — do not redeploy the live registry");

  const price = BigInt(process.env.VERIFY_PRICE_WEI ?? "100000000000000");
  console.log("Deployer", deployer.address);
  console.log("Registry", registry);
  console.log("Network ", hre.network.name, hre.network.config.chainId);
  console.log("Price   ", price.toString());

  const Meter = await hre.ethers.getContractFactory("VerificationMeter");
  const meter = await Meter.deploy(deployer.address, deployer.address, price);
  await meter.waitForDeployment();
  const meterAddress = await meter.getAddress();
  console.log("VerificationMeter", meterAddress);

  const Consumer = await hre.ethers.getContractFactory("CertificateConsumer");
  const consumer = await Consumer.deploy(registry);
  await consumer.waitForDeployment();
  const consumerAddress = await consumer.getAddress();
  console.log("CertificateConsumer", consumerAddress);

  const Agentic = await hre.ethers.getContractFactory("IntentosAgenticId");
  const agentic = await Agentic.deploy();
  await agentic.waitForDeployment();
  const agenticAddress = await agentic.getAddress();
  console.log("IntentosAgenticId", agenticAddress);

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
    VerificationMeter: meterAddress,
    CertificateConsumer: consumerAddress,
    IntentosAgenticId: agenticAddress,
    verifyPriceWei: price.toString(),
    wave45At: new Date().toISOString(),
    meterTx: meter.deploymentTransaction()?.hash,
    consumerTx: consumer.deploymentTransaction()?.hash,
    agenticTx: agentic.deploymentTransaction()?.hash,
  };
  writeFileSync(file, JSON.stringify(payload, null, 2) + "\n");
  console.log("Wrote", file);
  console.log("Set VERIFICATION_METER_ADDRESS=" + meterAddress);
  console.log("Set CERTIFICATE_CONSUMER_ADDRESS=" + consumerAddress);
  console.log("Set AGENTIC_ID_ADDRESS=" + agenticAddress);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
