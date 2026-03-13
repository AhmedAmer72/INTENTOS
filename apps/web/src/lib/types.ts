export type ReadyCheck = {
  id: string;
  ok: boolean;
  required: boolean;
  detail: string;
  hint?: string;
};

export type Ready = {
  ok: boolean;
  network: string;
  chainId: number;
  explorer: string;
  routerUi: string;
  checks: ReadyCheck[];
};

export type Constraint = {
  id: string;
  type: string;
  severity: "hard" | "soft";
  label: string;
  value?: unknown;
  currency?: string;
  unit?: string;
};

export type Envelope = {
  intentId: string;
  objective: { type: string; description: string };
  constraints: { hard: Constraint[]; soft: Constraint[] };
  allowedActions: string[];
  riskProfile: { maxRisk: string };
  principal: { wallet: string };
  agent: { agenticId: `0x${string}` };
  integrity?: { contentHash: `0x${string}` };
  createdAt: number;
  expiresAt: number;
  nonce: number;
  chainId: number;
  status: string;
  steps?: { id: string; label: string; actionType: string; required: boolean }[];
};

export type Eip712 = {
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: `0x${string}`;
  };
  types: {
    IntentRegistration: { name: string; type: string }[];
  };
  primaryType: "IntentRegistration";
  message: {
    intentHash: `0x${string}`;
    principal: `0x${string}`;
    agentId: `0x${string}`;
    createdAt: string;
    expiresAt: string;
    nonce: string;
  };
};

export type CompileOut = {
  envelope: Envelope;
  unresolvedTerms: string[];
  challenge: boolean;
  challengeReason?: string;
  usedModel?: string;
  intentHash: `0x${string}`;
  envelopeRoot?: string | null;
  eip712: Eip712 | null;
};

export type Action = {
  agentId: string;
  intentId: string;
  actionType: string;
  params: {
    protocol: string;
    capital: number;
    currency: string;
    durationDays?: number;
    leverage: boolean | number;
    protocolAudited: boolean;
    riskClass: string;
    stepId?: string;
  };
  plan: { strategyName: string; summary: string; steps?: string[] };
  estimatedOutcome: { apy?: number; description: string };
  stepId?: string;
};

export type Check = {
  constraintId?: string;
  constraint: string;
  severity: string;
  result: string;
  message: string;
};

export type VerifyOut = {
  result: {
    verdict: "APPROVE" | "REJECT" | "CHALLENGE";
    alignmentScore: number;
    confidence: number;
    checks: Check[];
    actionHash: `0x${string}`;
    evidenceRoot?: `0x${string}`;
    hardConstraintsSatisfied: boolean;
    challengeReason?: string;
    layerResults?: {
      layer2?: { reasoning?: string; alignmentScore?: number; confidence?: number };
      layer3?: { driftedFields?: string[]; alignmentScore?: number };
    };
    computeEvidence?: {
      model?: string;
      teeAttested?: boolean;
      requestId?: string;
      providerAddress?: string;
    };
  };
  evidenceRoot: `0x${string}`;
  contentHash?: `0x${string}`;
  envelopeRoot?: string | null;
  storageUploaded: boolean;
  certificate: { serial: number; actionHash: string };
  attest?: { ok: boolean; txHash?: string; explorer?: string; error?: string; code?: string } | null;
  vault: {
    address: `0x${string}` | null;
    approved: boolean;
    call: { intentId: `0x${string}`; actionHash: `0x${string}`; valueWei: string };
  };
  executor?: {
    address: `0x${string}`;
    approved: boolean;
    executeAfter: number;
    challengeDelay: number;
    call: {
      intentId: `0x${string}`;
      actionHash: `0x${string}`;
      target: `0x${string}`;
      data: `0x${string}`;
      valueWei: string;
    };
  };
  meter?: { ok: boolean; skipped?: boolean; txHash?: string; amount?: string };
};

export type Meta = {
  chainId: number;
  network: string;
  registry: `0x${string}` | null;
  vault: `0x${string}` | null;
  meter: `0x${string}` | null;
  consumer: `0x${string}` | null;
  agenticId: `0x${string}` | null;
  agenticToken: string | null;
  executor?: `0x${string}` | null;
  settlementTarget?: `0x${string}` | null;
  bounty?: `0x${string}` | null;
  agenticIdV2?: `0x${string}` | null;
  agenticTokenV2?: string | null;
  challengeDelay?: number;
  explorer: string;
  routerUi?: string;
  agentId: string | null;
  requirementAgentId: string | null;
  reputationRegistry?: `0x${string}`;
  identityRegistry?: `0x${string}`;
  demoIntent: string;
  verifyPriceWei?: string;
};

export type MeterInfo = {
  address: `0x${string}` | null;
  credits: string;
  priceWei: string;
  configured: boolean;
  explorer?: string;
};

export const DEMO_PLACEHOLDER =
  "Deploy $5,000 USDC into a low-risk yield opportunity for 14 days. No leverage.";
