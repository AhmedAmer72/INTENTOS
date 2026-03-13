import { z } from "zod";
import { AddressSchema, Bytes32Schema, HexSchema, RiskClassSchema } from "./primitives.js";

export const ActionParamsSchema = z.object({
  protocol: z.string().min(1),
  capital: z.number().nonnegative(),
  currency: z.string().min(1),
  asset: z.string().min(1).optional(),
  durationDays: z.number().nonnegative().optional(),
  leverage: z.union([z.boolean(), z.number()]),
  protocolAudited: z.boolean(),
  riskClass: RiskClassSchema,
  counterparty: AddressSchema.optional(),
  stepId: z.string().min(1).optional(),
});

export const AgentPlanSchema = z.object({
  strategyName: z.string().min(1),
  summary: z.string().min(1),
  steps: z.array(z.string()).default([]),
});

export const EstimatedOutcomeSchema = z.object({
  apy: z.number().optional(),
  description: z.string().min(1),
});

export const SettlementCallSchema = z.object({
  target: AddressSchema,
  calldata: HexSchema,
  valueWei: z.string().regex(/^\d+$/),
});

export const ProposedActionSchema = z.object({
  agentId: Bytes32Schema,
  intentId: z.string().min(1),
  actionType: z.string().min(1),
  params: ActionParamsSchema,
  plan: AgentPlanSchema,
  estimatedOutcome: EstimatedOutcomeSchema,
  stepId: z.string().min(1).optional(),
  settlement: SettlementCallSchema.optional(),
});

export type ActionParams = z.infer<typeof ActionParamsSchema>;
export type AgentPlan = z.infer<typeof AgentPlanSchema>;
export type EstimatedOutcome = z.infer<typeof EstimatedOutcomeSchema>;
export type SettlementCall = z.infer<typeof SettlementCallSchema>;
export type ProposedAction = z.infer<typeof ProposedActionSchema>;
