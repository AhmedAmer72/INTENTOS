// Abuse-path checks against a running INTENTOS API.
//
// These are the paths that spend the operator's money: 0G Router inference,
// a 0G Storage upload paid by the deployer key, an oracle attestation, and a
// VerificationMeter debit taken from a user's prepaid credits. Each check below
// drives the real API and asserts it refuses before spending anything.
//
// Usage: node scripts/security-checks.mjs
import { config as loadEnv } from "dotenv";
import { createPublicClient, createWalletClient, defineChain, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import net from "node:net";

loadEnv();
net.setDefaultAutoSelectFamilyAttemptTimeout(5000);

const API = process.env.E2E_API ?? "http://127.0.0.1:8787";
const account = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY);
const STRANGER = "0x000000000000000000000000000000000000dEaD";

const chain = defineChain({
  id: 16661,
  name: "0G Mainnet",
  nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
  rpcUrls: { default: { http: [process.env.ZEROG_MAINNET_RPC ?? "https://evmrpc.0g.ai"] } },
  fees: { defaultPriorityFee: 2_000_000_000n },
});
const pub = createPublicClient({ chain, transport: http(chain.rpcUrls.default.http[0]) });
const wallet = createWalletClient({ account, chain, transport: http(chain.rpcUrls.default.http[0]) });

const REGISTRY_ABI = [
  {
    type: "function",
    name: "registerIntent",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "record",
        type: "tuple",
        components: [
          { name: "intentHash", type: "bytes32" },
          { name: "principal", type: "address" },
          { name: "agentId", type: "bytes32" },
          { name: "createdAt", type: "uint64" },
          { name: "expiresAt", type: "uint64" },
          { name: "status", type: "uint8" },
        ],
      },
      { name: "nonce", type: "uint256" },
      { name: "principalSig", type: "bytes" },
    ],
    outputs: [],
  },
];

/** 0G RPC errors on a pending receipt instead of returning null. */
async function awaitReceipt(hash, timeoutMs = 240_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const receipt = await pub.getTransactionReceipt({ hash });
      if (receipt) return receipt;
    } catch {
      /* not indexed yet */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`receipt for ${hash} not indexed within ${timeoutMs}ms`);
}

let failures = 0;
const step = (m) => console.log(`\n=== ${m} ===`);
const ok = (m) => console.log(`  ok    ${m}`);
const bad = (m) => {
  failures += 1;
  console.log(`  FAIL  ${m}`);
};

async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

const intentText = "Deploy $5,000 USDC into a low-risk yield opportunity for 14 days. No leverage.";

step("1. compile an envelope that was never registered on-chain");
const compiled = await post("/compile", { text: intentText, principal: account.address });
if (compiled.status !== 200) {
  bad(`compile ${compiled.status}: ${JSON.stringify(compiled.json).slice(0, 300)}`);
  process.exit(1);
}
ok(`compiled intentHash ${compiled.json.intentHash}`);

const action = {
  actionType: "deposit",
  params: {
    protocol: "Aave v3",
    capital: 5000,
    currency: "USDC",
    asset: "USDC",
    durationDays: 14,
    leverage: false,
    protocolAudited: true,
    riskClass: "LOW",
  },
  plan: { strategyName: "Conservative", summary: "Supply USDC", steps: ["supply"] },
  estimatedOutcome: { apy: 4.1, description: "stable" },
  intentId: compiled.json.envelope.intentId,
  agentId: compiled.json.envelope.agent.agenticId,
};

step("2. /verify on an unregistered intent must not spend Compute, Storage, or gas");
const unregistered = await post("/verify", {
  intent: compiled.json.envelope,
  action,
  sourceText: intentText,
  amountWei: "100000000000000",
  payer: account.address,
});
if (unregistered.status === 409 && unregistered.json.code === "intent_not_registered") {
  ok(`refused with 409 ${unregistered.json.code}`);
} else {
  bad(`expected 409 intent_not_registered, got ${unregistered.status} ${JSON.stringify(unregistered.json).slice(0, 200)}`);
}

step("3. /verify billed to a stranger's meter must be refused");
const spoofed = await post("/verify", {
  intent: compiled.json.envelope,
  action,
  sourceText: intentText,
  amountWei: "100000000000000",
  payer: STRANGER,
});
if (
  (spoofed.status === 403 && spoofed.json.code === "payer_not_principal") ||
  (spoofed.status === 409 && spoofed.json.code === "intent_not_registered")
) {
  ok(`refused with ${spoofed.status} ${spoofed.json.code}`);
} else {
  bad(`expected a payer/registration refusal, got ${spoofed.status} ${JSON.stringify(spoofed.json).slice(0, 200)}`);
}

step("4. register the intent, then bill the verify to a stranger");
const { domain, types, message } = compiled.json.eip712;
const signature = await wallet.signTypedData({
  account,
  domain,
  types,
  primaryType: "IntentRegistration",
  message: {
    intentHash: message.intentHash,
    principal: message.principal,
    agentId: message.agentId,
    createdAt: BigInt(message.createdAt),
    expiresAt: BigInt(message.expiresAt),
    nonce: BigInt(message.nonce),
  },
});
const block = await pub.getBlock({ blockTag: "latest" });
const tip = 2_000_000_000n;
const registerHash = await wallet.writeContract({
  address: domain.verifyingContract,
  abi: REGISTRY_ABI,
  functionName: "registerIntent",
  args: [
    {
      intentHash: message.intentHash,
      principal: message.principal,
      agentId: message.agentId,
      createdAt: BigInt(message.createdAt),
      expiresAt: BigInt(message.expiresAt),
      status: 1,
    },
    BigInt(message.nonce),
    signature,
  ],
  maxFeePerGas: (block.baseFeePerGas ?? 1_000_000_000n) * 2n + tip,
  maxPriorityFeePerGas: tip,
});
const receipt = await awaitReceipt(registerHash);
if (receipt.status !== "success") {
  bad(`registerIntent reverted (${registerHash})`);
} else {
  ok(`registerIntent ${registerHash}`);
  const billed = await post("/verify", {
    intent: compiled.json.envelope,
    action,
    sourceText: intentText,
    amountWei: "100000000000000",
    payer: STRANGER,
  });
  if (billed.status === 403 && billed.json.code === "payer_not_principal") {
    ok(`refused with 403 ${billed.json.code}`);
  } else {
    bad(`expected 403 payer_not_principal, got ${billed.status} ${JSON.stringify(billed.json).slice(0, 200)}`);
  }
}

step("5. paid routes are rate limited per IP");
const limit = Number(process.env.RATE_LIMIT_PER_MIN ?? "30");
let limited = 0;
let served = 0;
for (let i = 0; i < limit + 8; i++) {
  // Deliberately malformed: the limiter runs in onRequest, so this measures the
  // cap without paying for inference on every probe.
  const res = await post("/agent/propose", {});
  if (res.status === 429) limited += 1;
  else served += 1;
  if (limited >= 2) break;
}
if (limited > 0) ok(`limiter engaged after ${served} requests in the window`);
else bad(`no 429 after ${served} requests with RATE_LIMIT_PER_MIN=${limit}`);

console.log(failures === 0 ? "\nSECURITY CHECKS PASSED\n" : `\n${failures} SECURITY CHECK(S) FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
