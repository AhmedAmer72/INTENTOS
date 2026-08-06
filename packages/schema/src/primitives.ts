import { z } from "zod";

export const HexSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]+$/, "expected 0x-prefixed hex");

export const AddressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, "expected 20-byte address");

export const Bytes32Schema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/, "expected 32-byte hash");

export const SeveritySchema = z.enum(["hard", "soft"]);
export type Severity = z.infer<typeof SeveritySchema>;

export const RiskClassSchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
export type RiskClass = z.infer<typeof RiskClassSchema>;

export const DurationUnitSchema = z.enum(["seconds", "minutes", "hours", "days"]);
export type DurationUnit = z.infer<typeof DurationUnitSchema>;

export const VerdictSchema = z.enum(["APPROVE", "REJECT", "CHALLENGE"]);
export type Verdict = z.infer<typeof VerdictSchema>;

export const ConstraintResultSchema = z.enum(["PASS", "FAIL", "NOT_APPLICABLE"]);
export type ConstraintResult = z.infer<typeof ConstraintResultSchema>;

export const IntentStatusSchema = z.enum(["DRAFT", "ACTIVE", "INVALIDATED", "EXPIRED"]);
export type IntentStatus = z.infer<typeof IntentStatusSchema>;

export const CheckResultSchema = z.enum(["PASS", "FAIL"]);

export const RISK_ORDINAL: Record<RiskClass, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
};

export const DURATION_TO_SECONDS: Record<DurationUnit, number> = {
  seconds: 1,
  minutes: 60,
  hours: 3600,
  days: 86400,
};

export const VERDICT_ONCHAIN = {
  NONE: 0,
  APPROVE: 1,
  REJECT: 2,
  CHALLENGE: 3,
} as const;

export const INTENT_STATUS_ONCHAIN = {
  NONE: 0,
  ACTIVE: 1,
  INVALIDATED: 2,
} as const;
