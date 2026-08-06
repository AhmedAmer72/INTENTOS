import { z } from "zod";
import { Bytes32Schema, ConstraintResultSchema, HexSchema, VerdictSchema } from "./primitives.js";

export const ConstraintCheckSchema = z.object({
  constraintId: z.string(),
  constraint: z.string(),
  severity: z.enum(["hard", "soft"]),
  result: ConstraintResultSchema,
  compared: z
    .object({
      expected: z.unknown().optional(),
      actual: z.unknown().optional(),
    })
    .optional(),
  message: z.string(),
});

export type ConstraintCheck = z.infer<typeof ConstraintCheckSchema>;

export const Layer1ResultSchema = z.object({
  hardConstraintsSatisfied: z.boolean(),
  checks: z.array(ConstraintCheckSchema),
});

export const Layer2ResultSchema = z.object({
  alignmentScore: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  referencedConstraintIds: z.array(z.string()),
  skipped: z.boolean().optional(),
  skipReason: z.string().optional(),
});

export const ConsistencyFieldSchema = z.object({
  field: z.string(),
  intent: z.unknown(),
  plan: z.unknown(),
  action: z.unknown(),
  drifted: z.boolean(),
});

export const Layer3ResultSchema = z.object({
  alignmentScore: z.number().min(0).max(1),
  driftedFields: z.array(z.string()),
  fields: z.array(ConsistencyFieldSchema),
});

export const ComputeEvidenceSchema = z.object({
  providerAddress: z.string().optional(),
  model: z.string(),
  requestId: z.string().optional(),
  zgResKey: z.string().optional(),
  teeAttested: z.boolean(),
  promptHash: Bytes32Schema,
  responseHash: Bytes32Schema,
  x0gTrace: z.unknown().optional(),
});

export type ComputeEvidence = z.infer<typeof ComputeEvidenceSchema>;
export type Layer1Result = z.infer<typeof Layer1ResultSchema>;
export type Layer2Result = z.infer<typeof Layer2ResultSchema>;
export type Layer3Result = z.infer<typeof Layer3ResultSchema>;

export const VerificationResultSchema = z.object({
  intentId: z.string(),
  actionHash: Bytes32Schema,
  alignmentScore: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  hardConstraintsSatisfied: z.boolean(),
  checks: z.array(ConstraintCheckSchema),
  verdict: VerdictSchema,
  challengeReason: z.string().optional(),
  evidenceRoot: HexSchema.optional(),
  computeProof: HexSchema.optional(),
  layerResults: z.object({
    layer1: Layer1ResultSchema,
    layer2: Layer2ResultSchema,
    layer3: Layer3ResultSchema,
  }),
  computeEvidence: ComputeEvidenceSchema.optional(),
});

export type VerificationResult = z.infer<typeof VerificationResultSchema>;

export const VerdictThresholdsSchema = z.object({
  minAlignment: z.number(),
  minConfidence: z.number(),
});

export const DEFAULT_VERDICT_THRESHOLDS = {
  minAlignment: 0.75,
  minConfidence: 0.7,
} as const;
