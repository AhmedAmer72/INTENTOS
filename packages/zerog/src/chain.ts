import {
  createPublicClient,
  createWalletClient,
  http,
  type Hex,
  type Account,
  type Hash,
  type PublicClient,
  type TransactionReceipt,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  eip712Domain,
  intentRegistrationTypes,
  verificationAttestationTypes,
  type IntentRegistrationMessage,
  type VerificationAttestationMessage,
} from "@intentos/schema";
import { resolveNetwork, viemChain, type ZeroGNetworkName } from "./networks.js";

export const INTENT_REGISTRY_ABI = [
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
    name: "recordVerification",
    stateMutability: "nonpayable",
    inputs: [
      { name: "intentId", type: "bytes32" },
      {
        name: "v",
        type: "tuple",
        components: [
          { name: "actionHash", type: "bytes32" },
          { name: "evidenceRoot", type: "bytes32" },
          { name: "verdict", type: "uint8" },
          { name: "alignmentBps", type: "uint16" },
          { name: "confidenceBps", type: "uint16" },
          { name: "timestamp", type: "uint64" },
          { name: "settlementBinding", type: "bytes32" },
        ],
      },
      { name: "nonce", type: "uint256" },
      { name: "expiry", type: "uint64" },
      { name: "intentHash", type: "bytes32" },
      { name: "agentId", type: "bytes32" },
      { name: "oracleSig", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "invalidateIntent",
    stateMutability: "nonpayable",
    inputs: [{ name: "intentId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "isApproved",
    stateMutability: "view",
    inputs: [
      { name: "intentId", type: "bytes32" },
      { name: "actionHash", type: "bytes32" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "getSettlementBinding",
    stateMutability: "view",
    inputs: [
      { name: "intentId", type: "bytes32" },
      { name: "actionHash", type: "bytes32" },
    ],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "getVerification",
    stateMutability: "view",
    inputs: [
      { name: "intentId", type: "bytes32" },
      { name: "actionHash", type: "bytes32" },
    ],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "actionHash", type: "bytes32" },
          { name: "evidenceRoot", type: "bytes32" },
          { name: "verdict", type: "uint8" },
          { name: "alignmentBps", type: "uint16" },
          { name: "confidenceBps", type: "uint16" },
          { name: "timestamp", type: "uint64" },
          { name: "settlementBinding", type: "bytes32" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "principalNonce",
    stateMutability: "view",
    inputs: [{ name: "principal", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "getIntent",
    stateMutability: "view",
    inputs: [{ name: "intentId", type: "bytes32" }],
    outputs: [
      {
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
    ],
  },
  {
    type: "function",
    name: "intentNonce",
    stateMutability: "view",
    inputs: [{ name: "intentId", type: "bytes32" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "hasRole",
    stateMutability: "view",
    inputs: [
      { name: "role", type: "bytes32" },
      { name: "account", type: "address" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "event",
    name: "IntentRegistered",
    inputs: [
      { name: "intentId", type: "bytes32", indexed: true },
      { name: "intentHash", type: "bytes32", indexed: false },
      { name: "principal", type: "address", indexed: true },
      { name: "agentId", type: "bytes32", indexed: false },
      { name: "expiresAt", type: "uint64", indexed: false },
    ],
  },
  {
    type: "event",
    name: "VerificationRecorded",
    inputs: [
      { name: "intentId", type: "bytes32", indexed: true },
      { name: "actionHash", type: "bytes32", indexed: true },
      { name: "verdict", type: "uint8", indexed: false },
      { name: "evidenceRoot", type: "bytes32", indexed: false },
      { name: "settlementBinding", type: "bytes32", indexed: false },
    ],
  },
] as const;

export const DEMO_VAULT_ABI = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "payable",
    inputs: [
      { name: "intentId", type: "bytes32" },
      { name: "actionHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "error",
    name: "IntentNotApproved",
    inputs: [],
  },
  {
    type: "error",
    name: "BindingMismatch",
    inputs: [],
  },
  {
    type: "error",
    name: "AlreadySettled",
    inputs: [],
  },
  {
    type: "event",
    name: "Settled",
    inputs: [
      { name: "intentId", type: "bytes32", indexed: true },
      { name: "actionHash", type: "bytes32", indexed: true },
      { name: "caller", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

export function publicClient(network: ZeroGNetworkName, rpcUrl?: string) {
  const net = resolveNetwork(network);
  const chain = viemChain(network);
  return createPublicClient({
    chain,
    transport: http(rpcUrl ?? net.rpc, { timeout: 30_000, retryCount: 5, retryDelay: 1_200 }),
  });
}

/** Galileo RPCs often lag getTransactionReceipt after writeContract. Poll instead of failing once. */
export async function waitForReceipt(
  client: PublicClient,
  hash: Hash,
  opts?: { timeoutMs?: number; intervalMs?: number },
): Promise<TransactionReceipt> {
  const timeoutMs = opts?.timeoutMs ?? 180_000;
  const intervalMs = opts?.intervalMs ?? 2_000;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const receipt = await client.getTransactionReceipt({ hash });
      if (receipt) return receipt;
    } catch {
      /* not indexed yet */
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(
    `0G RPC has not indexed ${hash} yet. Open the explorer, wait for the block, then retry verify.`,
  );
}

export function walletFromKey(privateKey: Hex, network: ZeroGNetworkName, rpcUrl?: string) {
  const net = resolveNetwork(network);
  const chain = viemChain(network);
  const account = privateKeyToAccount(privateKey);
  const wallet = createWalletClient({
    account,
    chain,
    transport: http(rpcUrl ?? net.rpc, { timeout: 30_000, retryCount: 5, retryDelay: 1_200 }),
  });
  return { account, wallet, chain, chainId: net.chainId };
}

export async function signIntentRegistration(
  account: Account,
  chainId: number,
  verifyingContract: Hex,
  message: IntentRegistrationMessage,
) {
  if (!account.signTypedData) throw new Error("account cannot sign typed data");
  return account.signTypedData({
    domain: eip712Domain(chainId, verifyingContract),
    types: intentRegistrationTypes,
    primaryType: "IntentRegistration",
    message,
  });
}

export async function signVerificationAttestation(
  account: Account,
  chainId: number,
  verifyingContract: Hex,
  message: VerificationAttestationMessage,
) {
  if (!account.signTypedData) throw new Error("account cannot sign typed data");
  return account.signTypedData({
    domain: eip712Domain(chainId, verifyingContract),
    types: verificationAttestationTypes,
    primaryType: "VerificationAttestation",
    message,
  });
}
