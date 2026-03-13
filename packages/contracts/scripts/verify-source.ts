import { config as loadEnv } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import hre from "hardhat";

loadEnv({ path: resolve(__dirname, "../../../.env") });

type Deployment = {
  IntentRegistry?: string;
  DemoVault?: string;
  VerificationMeter?: string;
  CertificateConsumer?: string;
  IntentosAgenticId?: string;
  IntentExecutor?: string;
  SettlementTarget?: string;
  IntentBounty?: string;
  IntentosAgenticIdV2?: string;
  deployer?: string;
  oracle?: string;
  verifyPriceWei?: string;
  challengeDelaySeconds?: string;
};

async function verifyOne(label: string, address: string | undefined, args: unknown[]) {
  if (!address) {
    console.log("skip", label, "(no address)");
    return;
  }
  try {
    await hre.run("verify:verify", { address, constructorArguments: args });
    console.log("verified", label, address);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/already verified/i.test(msg)) {
      console.log("already verified", label, address);
      return;
    }
    throw err;
  }
}

async function main() {
  const file = resolve(__dirname, "../deployments", `${hre.network.name}.json`);
  if (!existsSync(file)) throw new Error(`Missing ${file}. Deploy this network first.`);
  const d = JSON.parse(readFileSync(file, "utf8")) as Deployment;
  if (!d.IntentRegistry || !d.DemoVault || !d.deployer || !d.oracle) {
    throw new Error(`${file} is missing IntentRegistry / DemoVault / deployer / oracle.`);
  }

  const price = d.verifyPriceWei ?? process.env.VERIFY_PRICE_WEI ?? "100000000000000";
  const delay = Number(d.challengeDelaySeconds ?? process.env.CHALLENGE_DELAY_SECONDS ?? "900");

  await verifyOne("IntentRegistry", d.IntentRegistry, [d.deployer, d.oracle]);
  await verifyOne("DemoVault", d.DemoVault, [d.IntentRegistry]);
  await verifyOne("VerificationMeter", d.VerificationMeter, [d.deployer, d.deployer, price]);
  await verifyOne("CertificateConsumer", d.CertificateConsumer, [d.IntentRegistry]);
  await verifyOne("IntentosAgenticId", d.IntentosAgenticId, []);
  await verifyOne("IntentExecutor", d.IntentExecutor, [d.IntentRegistry, delay]);
  await verifyOne("SettlementTarget", d.SettlementTarget, []);
  await verifyOne("IntentBounty", d.IntentBounty, [d.IntentRegistry]);
  await verifyOne("IntentosAgenticIdV2", d.IntentosAgenticIdV2, [d.oracle]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
