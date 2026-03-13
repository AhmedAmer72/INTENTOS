// Reads the live 0G chain and checks that every configured contract exists and
// that its on-chain wiring matches what the app assumes. Read-only.
import { config as loadEnv } from "dotenv";
import { createPublicClient, http, defineChain, keccak256, toBytes } from "viem";

loadEnv();

const NETWORK = process.env.ZEROG_NETWORK ?? "mainnet";
const isMainnet = NETWORK === "mainnet";
const chain = defineChain({
  id: isMainnet ? 16661 : 16602,
  name: isMainnet ? "0G Mainnet" : "0G Galileo Testnet",
  nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        (isMainnet ? process.env.ZEROG_MAINNET_RPC : process.env.ZEROG_TESTNET_RPC) ??
          (isMainnet ? "https://evmrpc.0g.ai" : "https://evmrpc-testnet.0g.ai"),
      ],
    },
  },
});

const client = createPublicClient({ chain, transport: http(chain.rpcUrls.default.http[0]) });

const targets = {
  IntentRegistry: process.env.INTENT_REGISTRY_ADDRESS,
  DemoVault: process.env.DEMO_VAULT_ADDRESS,
  VerificationMeter: process.env.VERIFICATION_METER_ADDRESS,
  CertificateConsumer: process.env.CERTIFICATE_CONSUMER_ADDRESS,
  IntentExecutor: process.env.INTENT_EXECUTOR_ADDRESS,
  SettlementTarget: process.env.SETTLEMENT_TARGET_ADDRESS,
  IntentBounty: process.env.INTENT_BOUNTY_ADDRESS,
  AgenticId: process.env.AGENTIC_ID_ADDRESS,
  AgenticIdV2: process.env.AGENTIC_ID_V2_ADDRESS,
  ERC8004Identity: isMainnet
    ? "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"
    : "0x8004A818BFB912233c491871b3d84c89A494BD9e",
  ERC8004Reputation: isMainnet
    ? "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63"
    : "0x8004B663056A597Dffe9eCcC1965A193B7388713",
};

const abi = {
  registryOf: [
    { type: "function", name: "registry", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  ],
  hasRole: [
    {
      type: "function",
      name: "hasRole",
      stateMutability: "view",
      inputs: [{ type: "bytes32" }, { type: "address" }],
      outputs: [{ type: "bool" }],
    },
  ],
  priceWei: [
    { type: "function", name: "priceWei", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  ],
  challengeDelay: [
    { type: "function", name: "challengeDelay", stateMutability: "view", inputs: [], outputs: [{ type: "uint64" }] },
  ],
  eip712Domain: [
    {
      type: "function",
      name: "eip712Domain",
      stateMutability: "view",
      inputs: [],
      outputs: [
        { type: "bytes1" },
        { type: "string" },
        { type: "string" },
        { type: "uint256" },
        { type: "address" },
        { type: "bytes32" },
        { type: "uint256[]" },
      ],
    },
  ],
  oracle: [
    { type: "function", name: "oracle", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  ],
};

let failures = 0;
const fail = (m) => {
  failures += 1;
  console.log(`  FAIL  ${m}`);
};
const pass = (m) => console.log(`  ok    ${m}`);

console.log(`\nnetwork=${NETWORK} chainId=${chain.id} rpc=${chain.rpcUrls.default.http[0]}`);

const liveChainId = await client.getChainId();
if (liveChainId !== chain.id) fail(`RPC reports chainId ${liveChainId}, expected ${chain.id}`);
else pass(`RPC chainId ${liveChainId}`);

console.log("\n-- bytecode --");
for (const [name, address] of Object.entries(targets)) {
  if (!address) {
    fail(`${name}: address not configured`);
    continue;
  }
  const code = await client.getCode({ address });
  if (!code || code === "0x") fail(`${name} ${address}: NO BYTECODE`);
  else pass(`${name} ${address} (${(code.length - 2) / 2} bytes)`);
}

console.log("\n-- wiring --");
for (const name of ["DemoVault", "CertificateConsumer", "IntentExecutor", "IntentBounty"]) {
  const address = targets[name];
  if (!address) continue;
  try {
    const wired = await client.readContract({ address, abi: abi.registryOf, functionName: "registry" });
    if (wired.toLowerCase() === targets.IntentRegistry.toLowerCase()) {
      pass(`${name}.registry -> IntentRegistry`);
    } else {
      fail(`${name}.registry = ${wired}, expected ${targets.IntentRegistry}`);
    }
  } catch (err) {
    fail(`${name}.registry read failed: ${err.shortMessage ?? err.message}`);
  }
}

try {
  const domain = await client.readContract({
    address: targets.IntentRegistry,
    abi: abi.eip712Domain,
    functionName: "eip712Domain",
  });
  const [, dName, dVersion, dChainId, dVerifying] = domain;
  const expected = { name: "INTENTOS IntentRegistry", version: "1" };
  if (dName !== expected.name) fail(`EIP-712 domain name "${dName}" != "${expected.name}"`);
  else pass(`EIP-712 domain name "${dName}"`);
  if (dVersion !== expected.version) fail(`EIP-712 version "${dVersion}" != "1"`);
  else pass(`EIP-712 version "${dVersion}"`);
  if (Number(dChainId) !== chain.id) fail(`EIP-712 chainId ${dChainId} != ${chain.id}`);
  else pass(`EIP-712 chainId ${dChainId}`);
  if (dVerifying.toLowerCase() !== targets.IntentRegistry.toLowerCase()) {
    fail(`EIP-712 verifyingContract ${dVerifying} != registry`);
  } else pass(`EIP-712 verifyingContract matches registry`);
} catch (err) {
  fail(`eip712Domain read failed: ${err.shortMessage ?? err.message}`);
}

console.log("\n-- roles --");
const oracleAddr = process.env.ORACLE_ADDRESS ?? null;
try {
  const { privateKeyToAccount } = await import("viem/accounts");
  const oracle = privateKeyToAccount(process.env.VERIFIER_ORACLE_PRIVATE_KEY);
  const deployer = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY);
  const verifierRole = keccak256(toBytes("VERIFIER_ROLE"));
  const settlerRole = keccak256(toBytes("SETTLER_ROLE"));
  const hasVerifier = await client.readContract({
    address: targets.IntentRegistry,
    abi: abi.hasRole,
    functionName: "hasRole",
    args: [verifierRole, oracle.address],
  });
  hasVerifier
    ? pass(`oracle ${oracle.address} holds VERIFIER_ROLE`)
    : fail(`oracle ${oracle.address} missing VERIFIER_ROLE`);
  const hasSettler = await client.readContract({
    address: targets.VerificationMeter,
    abi: abi.hasRole,
    functionName: "hasRole",
    args: [settlerRole, deployer.address],
  });
  hasSettler
    ? pass(`deployer ${deployer.address} holds SETTLER_ROLE`)
    : fail(`deployer ${deployer.address} missing SETTLER_ROLE`);

  const v2Oracle = await client.readContract({
    address: targets.AgenticIdV2,
    abi: abi.oracle,
    functionName: "oracle",
  });
  v2Oracle.toLowerCase() === oracle.address.toLowerCase()
    ? pass(`AgenticIdV2.oracle matches VERIFIER_ORACLE key`)
    : fail(`AgenticIdV2.oracle ${v2Oracle} != oracle ${oracle.address}`);
} catch (err) {
  fail(`role checks failed: ${err.shortMessage ?? err.message}`);
}

console.log("\n-- parameters --");
try {
  const price = await client.readContract({
    address: targets.VerificationMeter,
    abi: abi.priceWei,
    functionName: "priceWei",
  });
  const configured = BigInt(process.env.VERIFY_PRICE_WEI ?? "0");
  price === configured
    ? pass(`VerificationMeter.priceWei ${price} matches VERIFY_PRICE_WEI`)
    : fail(`on-chain priceWei ${price} != VERIFY_PRICE_WEI ${configured}`);
} catch (err) {
  fail(`priceWei read failed: ${err.shortMessage ?? err.message}`);
}
try {
  const delay = await client.readContract({
    address: targets.IntentExecutor,
    abi: abi.challengeDelay,
    functionName: "challengeDelay",
  });
  const configured = BigInt(process.env.CHALLENGE_DELAY_SECONDS ?? "900");
  delay === configured
    ? pass(`IntentExecutor.challengeDelay ${delay}s matches CHALLENGE_DELAY_SECONDS`)
    : fail(`on-chain challengeDelay ${delay} != CHALLENGE_DELAY_SECONDS ${configured}`);
} catch (err) {
  fail(`challengeDelay read failed: ${err.shortMessage ?? err.message}`);
}

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
