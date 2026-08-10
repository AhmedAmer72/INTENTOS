import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import hre from "hardhat";

async function main() {
  const file = resolve(__dirname, "../deployments", `${hre.network.name}.json`);
  const deployment = JSON.parse(readFileSync(file, "utf8")) as {
    IntentRegistry: string;
    DemoVault: string;
    deployer: string;
    oracle: string;
  };

  await hre.run("verify:verify", {
    address: deployment.IntentRegistry,
    constructorArguments: [deployment.deployer, deployment.oracle],
  });
  await hre.run("verify:verify", {
    address: deployment.DemoVault,
    constructorArguments: [deployment.IntentRegistry],
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
