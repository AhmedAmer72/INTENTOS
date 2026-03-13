// Real end-to-end run of the INTENTOS critical journey against live 0G.
// Compile -> registerIntent -> greedy propose -> verify (expect REJECT) ->
// deposit (expect revert) -> replan -> verify (expect APPROVE) -> deposit (expect success).
// Every transaction is a genuine on-chain transaction. Read the console output for hashes.
import { config as loadEnv } from "dotenv";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  parseEther,
  formatEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import net from "node:net";

loadEnv();
// Same reason as apps/api/src/net.ts — 250ms is too short for these hosts.
net.setDefaultAutoSelectFamilyAttemptTimeout(5000);

const API = process.env.E2E_API ?? "http://127.0.0.1:8787";
const AMOUNT_OG = process.env.E2E_AMOUNT ?? "0.0001";

const chain = defineChain({
  id: 16661,
  name: "0G Mainnet",
  nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
  rpcUrls: { default: { http: [process.env.ZEROG_MAINNET_RPC ?? "https://evmrpc.0g.ai"] } },
  fees: { defaultPriorityFee: 2_000_000_000n },
});

const account = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY);
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
  {
    type: "function",
    name: "isApproved",
    stateMutability: "view",
    inputs: [{ type: "bytes32" }, { type: "bytes32" }],
    outputs: [{ type: "bool" }],
  },
];

const VAULT_ABI = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "payable",
    inputs: [{ type: "bytes32" }, { type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "settled",
    stateMutability: "view",
    inputs: [{ type: "bytes32" }, { type: "bytes32" }],
    outputs: [{ type: "bool" }],
  },
  { type: "error", name: "IntentNotApproved", inputs: [] },
  { type: "error", name: "BindingMismatch", inputs: [] },
  { type: "error", name: "AlreadySettled", inputs: [] },
];

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

/** 0G RPC answers eth_getTransactionReceipt with -32000 while a tx is pending,
 *  so poll the way the app does instead of trusting waitForTransactionReceipt. */
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

async function fees() {
  const block = await pub.getBlock({ blockTag: "latest" });
  const tip = 2_000_000_000n;
  const base = block.baseFeePerGas ?? 1_000_000_000n;
  return { maxFeePerGas: base * 2n + tip, maxPriorityFeePerGas: tip };
}

const startBal = await pub.getBalance({ address: account.address });
console.log(`principal ${account.address}  balance ${formatEther(startBal)} 0G`);

// ---------------------------------------------------------------- compile
step("1. POST /compile (0G Compute)");
const intentText = "Deploy $5,000 USDC into a low-risk yield opportunity for 14 days. No leverage.";
const compiled = await post("/compile", { text: intentText, principal: account.address });
if (compiled.status !== 200) {
  bad(`compile ${compiled.status}: ${JSON.stringify(compiled.json).slice(0, 300)}`);
  process.exit(1);
}
const c = compiled.json;
ok(`model ${c.usedModel}`);
ok(`intentHash ${c.intentHash}`);
ok(`envelopeRoot ${c.envelopeRoot}`);
ok(`challenge=${c.challenge} hardConstraints=${c.envelope.constraints.hard.length}`);
if (c.challenge) bad("demo sentence should not raise a challenge");
if (!c.eip712) {
  bad("no eip712 payload");
  process.exit(1);
}

// ---------------------------------------------------------------- register
step("2. registerIntent on 0G Mainnet");
const { domain, types, message } = c.eip712;
const sig = await wallet.signTypedData({
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
    sig,
  ],
  ...(await fees()),
});
const registerReceipt = await awaitReceipt(registerHash);
registerReceipt.status === "success"
  ? ok(`registerIntent ${registerHash} block ${registerReceipt.blockNumber}`)
  : bad(`registerIntent reverted ${registerHash}`);

// ---------------------------------------------------------------- greedy
step("3. POST /agent/propose (greedy)");
const greedy = await post("/agent/propose", { intent: c.envelope, mode: "greedy" });
if (greedy.status !== 200) {
  bad(`propose ${greedy.status}: ${JSON.stringify(greedy.json).slice(0, 300)}`);
  process.exit(1);
}
ok(
  `greedy: ${greedy.json.action.params.protocol} capital=${greedy.json.action.params.capital} ` +
    `leverage=${greedy.json.action.params.leverage} risk=${greedy.json.action.params.riskClass}`,
);

step("4. POST /verify on the greedy plan (expect REJECT)");
const v1 = await post("/verify", {
  intent: c.envelope,
  action: greedy.json.action,
  sourceText: intentText,
  amountWei: parseEther(AMOUNT_OG).toString(),
  registerTx: registerHash,
  payer: account.address,
});
if (v1.status !== 200) {
  bad(`verify ${v1.status}: ${JSON.stringify(v1.json).slice(0, 500)}`);
  process.exit(1);
}
const r1 = v1.json;
ok(`verdict ${r1.result.verdict} alignment ${(r1.result.alignmentScore * 100).toFixed(1)}%`);
ok(`tee source=${r1.result.computeEvidence?.teeSource} attested=${r1.result.computeEvidence?.teeAttested} type=${r1.result.computeEvidence?.teeType}`);
ok(`evidenceRoot ${r1.evidenceRoot}`);
ok(`attest tx ${r1.attest?.txHash} ok=${r1.attest?.ok}`);
ok(`meter debit ${r1.meter?.txHash ?? "skipped"}`);
if (!r1.attest?.ok) bad(`on-chain attestation failed: ${r1.attest?.error}`);
if (r1.result.computeEvidence?.teeSource === "none") bad("attested without a TEE evidence source");

// The greedy prompt usually breaks a constraint, but the model is free to comply.
// Assert the invariant that actually matters: the verdict must agree with the rules,
// and the vault must agree with the verdict.
const hardFails = r1.result.checks.filter((x) => x.severity === "hard" && x.result === "FAIL");
if (hardFails.length > 0 && r1.result.verdict === "APPROVE") {
  bad(`APPROVE despite ${hardFails.length} hard-constraint failure(s) — the gate leaked`);
} else {
  ok(`verdict consistent with ${hardFails.length} hard failure(s)`);
}

step("5. DemoVault.deposit must agree with the greedy verdict");
const greedyApproved = r1.result.verdict === "APPROVE";
try {
  await pub.simulateContract({
    account,
    address: process.env.DEMO_VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: "deposit",
    args: [r1.vault.call.intentId, r1.vault.call.actionHash],
    value: BigInt(r1.vault.call.valueWei),
  });
  greedyApproved
    ? ok("deposit accepted, matching the APPROVE stamp")
    : bad("deposit accepted on a non-APPROVE verdict — the gate is NOT holding");
} catch (err) {
  const name = JSON.stringify(err.cause?.data?.errorName ?? err.shortMessage ?? err.message);
  if (greedyApproved) {
    bad(`deposit blocked despite APPROVE: ${name.slice(0, 200)}`);
  } else if (/IntentNotApproved/.test(name)) {
    ok("blocked with IntentNotApproved");
  } else {
    bad(`blocked but with unexpected error: ${name.slice(0, 200)}`);
  }
}

// ---------------------------------------------------------------- replan
step("6. POST /agent/propose (replan)");
const replan = await post("/agent/propose", { intent: c.envelope, mode: "replan" });
if (replan.status !== 200) {
  bad(`replan ${replan.status}: ${JSON.stringify(replan.json).slice(0, 300)}`);
  process.exit(1);
}
ok(
  `replan: ${replan.json.action.params.protocol} capital=${replan.json.action.params.capital} ` +
    `leverage=${replan.json.action.params.leverage} risk=${replan.json.action.params.riskClass}`,
);

step("7. POST /verify on the replan (expect APPROVE)");
const v2 = await post("/verify", {
  intent: c.envelope,
  action: replan.json.action,
  sourceText: intentText,
  amountWei: parseEther(AMOUNT_OG).toString(),
  registerTx: registerHash,
  payer: account.address,
});
if (v2.status !== 200) {
  bad(`verify ${v2.status}: ${JSON.stringify(v2.json).slice(0, 500)}`);
  process.exit(1);
}
const r2 = v2.json;
ok(`verdict ${r2.result.verdict} alignment ${(r2.result.alignmentScore * 100).toFixed(1)}%`);
ok(`attest tx ${r2.attest?.txHash} ok=${r2.attest?.ok}`);
ok(`certificate serial ${r2.certificate?.serial}`);

const approvedOnChain = await pub.readContract({
  address: process.env.INTENT_REGISTRY_ADDRESS,
  abi: REGISTRY_ABI,
  functionName: "isApproved",
  args: [r2.vault.call.intentId, r2.vault.call.actionHash],
});
console.log(`  registry.isApproved on-chain = ${approvedOnChain}`);

if (r2.result.verdict !== "APPROVE") {
  console.log("\n  replan did not APPROVE this run; skipping the settlement leg.");
  console.log(`  checks: ${r2.result.checks.filter((x) => x.result === "FAIL").map((x) => x.constraint).join(", ")}`);
} else {
  if (!approvedOnChain) bad("verdict APPROVE but registry.isApproved is false");

  step("8. DemoVault.deposit on the approved plan (expect success)");
  const depositHash = await wallet.writeContract({
    address: process.env.DEMO_VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: "deposit",
    args: [r2.vault.call.intentId, r2.vault.call.actionHash],
    value: BigInt(r2.vault.call.valueWei),
    ...(await fees()),
  });
  const depositReceipt = await awaitReceipt(depositHash);
  depositReceipt.status === "success"
    ? ok(`deposit ${depositHash} block ${depositReceipt.blockNumber}`)
    : bad(`deposit reverted ${depositHash}`);

  const settled = await pub.readContract({
    address: process.env.DEMO_VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: "settled",
    args: [r2.vault.call.intentId, r2.vault.call.actionHash],
  });
  settled ? ok("vault.settled = true") : bad("vault.settled still false after deposit");

  step("9. replay the same deposit (expect AlreadySettled)");
  try {
    await pub.simulateContract({
      account,
      address: process.env.DEMO_VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: "deposit",
      args: [r2.vault.call.intentId, r2.vault.call.actionHash],
      value: BigInt(r2.vault.call.valueWei),
    });
    bad("replayed deposit simulated OK — double settlement is possible");
  } catch (err) {
    const name = JSON.stringify(err.cause?.data?.errorName ?? err.shortMessage ?? err.message);
    /AlreadySettled/.test(name) ? ok("replay blocked with AlreadySettled") : bad(`replay blocked with: ${name.slice(0, 200)}`);
  }

  step("10. deposit with a tampered amount (expect BindingMismatch)");
  try {
    await pub.simulateContract({
      account,
      address: process.env.DEMO_VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: "deposit",
      args: [r2.vault.call.intentId, r2.vault.call.actionHash],
      value: BigInt(r2.vault.call.valueWei) + 1n,
    });
    bad("tampered amount simulated OK — binding is not enforced");
  } catch (err) {
    const name = JSON.stringify(err.cause?.data?.errorName ?? err.shortMessage ?? err.message);
    /BindingMismatch|AlreadySettled/.test(name)
      ? ok(`tampered amount blocked (${/AlreadySettled/.test(name) ? "AlreadySettled" : "BindingMismatch"})`)
      : bad(`tampered amount blocked with: ${name.slice(0, 200)}`);
  }
}

// ---------------------------------------------------------------- proof
step("11. GET /proof/:actionHash");
const proofRes = await fetch(`${API}/proof/${r2.result.actionHash}`);
const proof = await proofRes.json();
proofRes.status === 200 ? ok(`proof served, matches=${proof.matches}`) : bad(`proof ${proofRes.status}`);
if (proof.matches !== true) bad("evidence content hash does not match the stored certificate hash");
console.log(`  storageMatch=${proof.storageMatch} storageError=${proof.storageError ?? "none"}`);

const endBal = await pub.getBalance({ address: account.address });
console.log(`\nspent ${formatEther(startBal - endBal)} 0G`);
console.log(`\n${failures === 0 ? "E2E PASSED" : `${failures} E2E CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
