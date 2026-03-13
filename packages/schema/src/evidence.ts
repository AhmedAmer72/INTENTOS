import { z } from "zod";
import { IntentEnvelopeSchema } from "./intent.js";
import { ProposedActionSchema } from "./action.js";
import { ComputeEvidenceSchema, VerificationResultSchema } from "./verification.js";
import { Bytes32Schema, HexSchema } from "./primitives.js";

export const EvidenceBundleSchema = z.object({
  version: z.literal("1.0"),
  intent: IntentEnvelopeSchema,
  action: ProposedActionSchema,
  verification: VerificationResultSchema,
  compiler: z
    .object({
      sourceText: z.string(),
      unresolvedTerms: z.array(z.string()),
      model: z.string().optional(),
      prompt: z.string().optional(),
      rawResponse: z.string().optional(),
    })
    .optional(),
  layer2: z
    .object({
      prompt: z.string(),
      rawResponse: z.string(),
      computeEvidence: ComputeEvidenceSchema.optional(),
    })
    .optional(),
  envelopeRoot: z.string().min(1).optional(),
  createdAt: z.number().int(),
});

export type EvidenceBundle = z.infer<typeof EvidenceBundleSchema>;

export const CertificateSchema = z.object({
  serial: z.number().int().nonnegative(),
  intentId: z.string(),
  intentHash: Bytes32Schema,
  actionHash: Bytes32Schema,
  decisionHash: Bytes32Schema,
  evidenceRoot: z.string().min(1),
  principal: z.string(),
  agentId: z.string(),
  objective: z.string(),
  requestedCapital: z.string(),
  actualCapital: z.string(),
  requestedDuration: z.string(),
  actualDuration: z.string(),
  leverage: z.string(),
  risk: z.string(),
  alignmentScore: z.number(),
  confidence: z.number(),
  hardViolations: z.number(),
  verdict: z.string(),
  timestamp: z.number().int(),
  chainId: z.number().int(),
  registerTxHash: HexSchema.optional(),
  verifyTxHash: HexSchema.optional(),
  settleTxHash: HexSchema.optional(),
  reputationTx: HexSchema.optional(),
  meterTx: HexSchema.optional(),
  explorerUrl: z.string().url().optional(),
  storageRoot: z.string().min(1).optional(),
  computeProvider: z.string().optional(),
  teeAttested: z.boolean().optional(),
  teeSource: z.string().optional(),
  teeType: z.string().optional(),
  agenticToken: z.string().optional(),
  agenticUri: z.string().optional(),
});

export type Certificate = z.infer<typeof CertificateSchema>;
