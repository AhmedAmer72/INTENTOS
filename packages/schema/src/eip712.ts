export const EIP712_DOMAIN_NAME = "INTENTOS IntentRegistry";
export const EIP712_DOMAIN_VERSION = "1";

export const intentRegistrationTypes = {
  IntentRegistration: [
    { name: "intentHash", type: "bytes32" },
    { name: "principal", type: "address" },
    { name: "agentId", type: "bytes32" },
    { name: "createdAt", type: "uint64" },
    { name: "expiresAt", type: "uint64" },
    { name: "nonce", type: "uint256" },
  ],
} as const;

export const verificationAttestationTypes = {
  VerificationAttestation: [
    { name: "intentId", type: "bytes32" },
    { name: "intentHash", type: "bytes32" },
    { name: "agentId", type: "bytes32" },
    { name: "actionHash", type: "bytes32" },
    { name: "evidenceRoot", type: "bytes32" },
    { name: "verdict", type: "uint8" },
    { name: "alignmentBps", type: "uint16" },
    { name: "confidenceBps", type: "uint16" },
    { name: "nonce", type: "uint256" },
    { name: "expiry", type: "uint64" },
    { name: "settlementBinding", type: "bytes32" },
  ],
} as const;

export type IntentRegistrationMessage = {
  intentHash: `0x${string}`;
  principal: `0x${string}`;
  agentId: `0x${string}`;
  createdAt: bigint;
  expiresAt: bigint;
  nonce: bigint;
};

export type VerificationAttestationMessage = {
  intentId: `0x${string}`;
  intentHash: `0x${string}`;
  agentId: `0x${string}`;
  actionHash: `0x${string}`;
  evidenceRoot: `0x${string}`;
  verdict: number;
  alignmentBps: number;
  confidenceBps: number;
  nonce: bigint;
  expiry: bigint;
  settlementBinding: `0x${string}`;
};

export function eip712Domain(chainId: number, verifyingContract: `0x${string}`) {
  return {
    name: EIP712_DOMAIN_NAME,
    version: EIP712_DOMAIN_VERSION,
    chainId,
    verifyingContract,
  };
}
