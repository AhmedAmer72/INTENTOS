import type { IntentEnvelope } from "./intent.js";
import type { ProposedAction } from "./action.js";
import { ZERO_BYTES32 } from "./ids.js";

export const DEMO_INTENT_TEXT =
  "Deploy $5,000 USDC into a low-risk yield opportunity for 14 days. No leverage.";

export const DEMO_CHAIN_ID = 16602;

export function demoEnvelope(overrides?: Partial<IntentEnvelope>): IntentEnvelope {
  const now = 1_750_000_000;
  return {
    schemaVersion: "1.0",
    intentId: "11111111-1111-1111-1111-111111111111",
    nonce: 0,
    chainId: DEMO_CHAIN_ID,
    createdAt: now,
    expiresAt: now + 14 * 86400,
    principal: { wallet: "0x1111111111111111111111111111111111111111" },
    agent: { agenticId: ZERO_BYTES32 },
    objective: {
      type: "financial",
      description: "Generate low-risk yield on USDC for 14 days",
    },
    constraints: {
      hard: [
        {
          id: "c-max-capital",
          type: "max_capital",
          severity: "hard",
          label: "Capital must not exceed 5000 USDC",
          value: 5000,
          currency: "USDC",
        },
        {
          id: "c-max-duration",
          type: "max_duration",
          severity: "hard",
          label: "Duration must not exceed 14 days",
          value: 14,
          unit: "days",
        },
        {
          id: "c-no-leverage",
          type: "no_leverage",
          severity: "hard",
          label: "Leverage is forbidden",
        },
        {
          id: "c-audited",
          type: "audited_contract_only",
          severity: "hard",
          label: "Only audited contracts",
        },
        {
          id: "c-risk",
          type: "max_risk_class",
          severity: "hard",
          label: "Risk class at most LOW",
          value: "LOW",
        },
        {
          id: "c-actions",
          type: "allowed_actions",
          severity: "hard",
          label: "Only deposit, withdraw, claim",
          actions: ["deposit", "withdraw", "claim"],
        },
      ],
      soft: [
        {
          id: "c-yield",
          type: "preferred_yield",
          severity: "soft",
          label: "Prefer at least 5% APY",
          minimum: 5,
        },
      ],
    },
    allowedActions: ["deposit", "withdraw", "claim"],
    riskProfile: { maxRisk: "LOW" },
    status: "ACTIVE",
    ...overrides,
  };
}

export function strategyB(intentId: string, agentId = ZERO_BYTES32): ProposedAction {
  return {
    agentId,
    intentId,
    actionType: "deposit",
    params: {
      protocol: "Vault-X-Levered",
      capital: 8000,
      currency: "USDC",
      asset: "USDC",
      durationDays: 45,
      leverage: 3,
      protocolAudited: false,
      riskClass: "HIGH",
    },
    plan: {
      strategyName: "Strategy B",
      summary: "Maximize yield with 3x leveraged vault for 45 days.",
      steps: ["Allocate 8000 USDC", "Open 3x position", "Hold 45 days"],
    },
    estimatedOutcome: {
      apy: 18.4,
      description: "High-yield leveraged vault, unaudited",
    },
  };
}

export function strategyA(intentId: string, agentId = ZERO_BYTES32): ProposedAction {
  return {
    agentId,
    intentId,
    actionType: "deposit",
    params: {
      protocol: "Vault-X",
      capital: 5000,
      currency: "USDC",
      asset: "USDC",
      durationDays: 14,
      leverage: false,
      protocolAudited: true,
      riskClass: "LOW",
    },
    plan: {
      strategyName: "Strategy A",
      summary: "Low-risk audited USDC yield vault for 14 days, no leverage.",
      steps: ["Allocate 5000 USDC", "Deposit into audited vault", "Hold 14 days"],
    },
    estimatedOutcome: {
      apy: 7.1,
      description: "Low-risk audited USDC vault",
    },
  };
}
