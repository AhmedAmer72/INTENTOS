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
  {
    type: "function",
    name: "challengeDelay",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint64" }],
  },
  {
    type: "function",
    name: "executed",
    stateMutability: "view",
    inputs: [
      { name: "intentId", type: "bytes32" },
      { name: "actionHash", type: "bytes32" },
    ],
    outputs: [{ type: "bool" }],
  },
  { type: "error", name: "IntentNotApproved", inputs: [] },
  { type: "error", name: "ChallengePending", inputs: [] },
  { type: "error", name: "BindingMismatch", inputs: [] },
  { type: "error", name: "AlreadyExecuted", inputs: [] },
  { type: "error", name: "CallFailed", inputs: [] },
] as const;

export const SETTLEMENT_TARGET_ABI = [
  {
    type: "function",
    name: "ping",
    stateMutability: "payable",
    inputs: [{ name: "data", type: "bytes" }],
    outputs: [],
  },
  {
    type: "function",
    name: "lastCaller",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "lastValue",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
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
  {
    type: "function",
    name: "bounties",
    stateMutability: "view",
    inputs: [
      { name: "intentId", type: "bytes32" },
      { name: "actionHash", type: "bytes32" },
    ],
    outputs: [
      { name: "funder", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "claimed", type: "bool" },
    ],
  },
  { type: "error", name: "IntentNotApproved", inputs: [] },
  { type: "error", name: "RefundBlocked", inputs: [] },
  { type: "error", name: "EmptyBounty", inputs: [] },
  { type: "error", name: "AlreadyClaimed", inputs: [] },
] as const;

export const AGENTIC_ID_V2_ABI = [
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "encryptedURI", type: "string" },
      { name: "metadataHash", type: "bytes32" },
    ],
    outputs: [{ type: "uint256" }],
  },
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
  {
    type: "function",
    name: "getEncryptedURI",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "getMetadataHash",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "oracle",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "authorizeUsage",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "executor", type: "address" },
      { name: "permissions", type: "bytes" },
    ],
    outputs: [],
  },
  { type: "error", name: "BadProof", inputs: [] },
  { type: "error", name: "NotOwner", inputs: [] },
] as const;
