import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import hre from "hardhat";

loadEnv({ path: resolve(__dirname, "../../../.env") });

const IDENTITY = {
  galileo: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
  mainnet: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
} as const;

const ABI = [
  "function register(string tokenURI) returns (uint256)",
  "event Registered(uint256 indexed agentId, string tokenURI, address indexed owner)",
];

async function main() {
  const name = hre.network.name as keyof typeof IDENTITY;
  const address = IDENTITY[name];
  if (!address) throw new Error(`No ERC-8004 IdentityRegistry for network ${name}`);
  const [signer] = await hre.ethers.getSigners();
  const uri = process.env.AGENT_TOKEN_URI ?? "https://intentos.ai/agent/reference.json";
  const registry = new hre.ethers.Contract(address, ABI, signer);
  console.log("Registering agent on", name, "from", signer.address);
  const tx = await registry.register(uri);
  const receipt = await tx.wait();
  let agentId: string | undefined;
  for (const log of receipt.logs) {
    try {
      const parsed = registry.interface.parseLog(log);
      if (parsed?.name === "Registered") {
        agentId = parsed.args.agentId.toString();
      }
    } catch {
      /* ignore */
    }
  }
  console.log("tx     ", receipt.hash);
  console.log("agentId", agentId);
  console.log("Set AGENT_ID=0x" + BigInt(agentId ?? "0").toString(16).padStart(64, "0"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
