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
