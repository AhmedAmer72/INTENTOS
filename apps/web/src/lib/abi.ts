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
    name: "principalNonce",
    stateMutability: "view",
    inputs: [{ name: "principal", type: "address" }],
    outputs: [{ type: "uint256" }],
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
  { type: "error", name: "IntentNotApproved", inputs: [] },
  { type: "error", name: "BindingMismatch", inputs: [] },
  { type: "error", name: "AlreadySettled", inputs: [] },
] as const;

export const VERIFICATION_METER_ABI = [
  { type: "function", name: "deposit", stateMutability: "payable", inputs: [], outputs: [] },
  {
    type: "function",
    name: "credits",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  { type: "function", name: "priceWei", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

export const CERTIFICATE_CONSUMER_ABI = [
  {
    type: "function",
    name: "accept",
    stateMutability: "nonpayable",
    inputs: [
      { name: "intentId", type: "bytes32" },
      { name: "actionHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "consumed",
    stateMutability: "view",
    inputs: [
      { name: "intentId", type: "bytes32" },
      { name: "actionHash", type: "bytes32" },
    ],
    outputs: [{ type: "bool" }],
  },
  { type: "error", name: "IntentNotApproved", inputs: [] },
  { type: "error", name: "AlreadyConsumed", inputs: [] },
] as const;

export const INTENT_EXECUTOR_ABI = [
  {
    type: "function",
    name: "execute",
    stateMutability: "payable",
    inputs: [
      { name: "intentId", type: "bytes32" },
      { name: "actionHash", type: "bytes32" },
      { name: "target", type: "address" },
      { name: "data", type: "bytes" },
    ],
    outputs: [],
  },
  { type: "error", name: "IntentNotApproved", inputs: [] },
  { type: "error", name: "ChallengePending", inputs: [] },
  { type: "error", name: "BindingMismatch", inputs: [] },
  { type: "error", name: "AlreadyExecuted", inputs: [] },
  { type: "error", name: "CallFailed", inputs: [] },
] as const;

export const INTENT_BOUNTY_ABI = [
  {
    type: "function",
    name: "fund",
    stateMutability: "payable",
    inputs: [
      { name: "intentId", type: "bytes32" },
      { name: "actionHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [
      { name: "intentId", type: "bytes32" },
      { name: "actionHash", type: "bytes32" },
      { name: "beneficiary", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "refund",
    stateMutability: "nonpayable",
    inputs: [
      { name: "intentId", type: "bytes32" },
      { name: "actionHash", type: "bytes32" },
    ],
    outputs: [],
  },
  { type: "error", name: "IntentNotApproved", inputs: [] },
  { type: "error", name: "RefundBlocked", inputs: [] },
  { type: "error", name: "EmptyBounty", inputs: [] },
  { type: "error", name: "AlreadyClaimed", inputs: [] },
] as const;

export const AGENTIC_ID_V2_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "sealedKey", type: "bytes" },
      { name: "proof", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "clone",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "sealedKey", type: "bytes" },
      { name: "proof", type: "bytes" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
] as const;

export const ERC8004_IDENTITY_ABI = [
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
] as const;

export const ERC8004_REPUTATION_ABI = [
  {
    type: "function",
    name: "giveFeedback",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "value", type: "int128" },
      { name: "valueDecimals", type: "uint8" },
      { name: "tag1", type: "string" },
      { name: "tag2", type: "string" },
      { name: "endpoint", type: "string" },
      { name: "feedbackURI", type: "string" },
      { name: "feedbackHash", type: "bytes32" },
    ],
    outputs: [],
  },
] as const;
