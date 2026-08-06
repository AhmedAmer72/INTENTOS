import { z } from "zod";
import { AddressSchema, DurationUnitSchema, RiskClassSchema, SeveritySchema } from "./primitives.js";

const BaseConstraint = {
  id: z.string().min(1),
  severity: SeveritySchema,
  label: z.string().min(1),
};

export const MaxCapitalConstraintSchema = z.object({
  ...BaseConstraint,
  type: z.literal("max_capital"),
  value: z.number().nonnegative(),
  currency: z.string().min(1),
});

export const MaxDurationConstraintSchema = z.object({
  ...BaseConstraint,
  type: z.literal("max_duration"),
  value: z.number().positive(),
  unit: DurationUnitSchema,
});

export const NoLeverageConstraintSchema = z.object({
  ...BaseConstraint,
  type: z.literal("no_leverage"),
});

export const AuditedContractOnlyConstraintSchema = z.object({
  ...BaseConstraint,
  type: z.literal("audited_contract_only"),
});

export const AllowedActionsConstraintSchema = z.object({
  ...BaseConstraint,
  type: z.literal("allowed_actions"),
  actions: z.array(z.string().min(1)).min(1),
});

export const MaxRiskClassConstraintSchema = z.object({
  ...BaseConstraint,
  type: z.literal("max_risk_class"),
  value: RiskClassSchema,
});

export const CounterpartyAllowlistConstraintSchema = z.object({
  ...BaseConstraint,
  type: z.literal("counterparty_allowlist"),
  addresses: z.array(AddressSchema).min(1),
});

export const PreferredYieldConstraintSchema = z.object({
  ...BaseConstraint,
  type: z.literal("preferred_yield"),
  minimum: z.number(),
});

export const ConstraintSchema = z.discriminatedUnion("type", [
  MaxCapitalConstraintSchema,
  MaxDurationConstraintSchema,
  NoLeverageConstraintSchema,
  AuditedContractOnlyConstraintSchema,
  AllowedActionsConstraintSchema,
  MaxRiskClassConstraintSchema,
  CounterpartyAllowlistConstraintSchema,
  PreferredYieldConstraintSchema,
]);

export type Constraint = z.infer<typeof ConstraintSchema>;
export type MaxCapitalConstraint = z.infer<typeof MaxCapitalConstraintSchema>;
export type MaxDurationConstraint = z.infer<typeof MaxDurationConstraintSchema>;
export type NoLeverageConstraint = z.infer<typeof NoLeverageConstraintSchema>;
export type AuditedContractOnlyConstraint = z.infer<typeof AuditedContractOnlyConstraintSchema>;
export type AllowedActionsConstraint = z.infer<typeof AllowedActionsConstraintSchema>;
export type MaxRiskClassConstraint = z.infer<typeof MaxRiskClassConstraintSchema>;
export type CounterpartyAllowlistConstraint = z.infer<typeof CounterpartyAllowlistConstraintSchema>;
export type PreferredYieldConstraint = z.infer<typeof PreferredYieldConstraintSchema>;
