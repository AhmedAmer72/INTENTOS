import { z } from "zod";
import { hashCanonical } from "./canonical.js";
import { ConstraintSchema } from "./constraints.js";
import { AddressSchema, Bytes32Schema, IntentStatusSchema, RiskClassSchema } from "./primitives.js";

export const SCHEMA_VERSION = "1.0" as const;

export const ObjectiveSchema = z.object({
  type: z.string().min(1),
  description: z.string().min(1),
});

export const PrincipalSchema = z.object({
  wallet: AddressSchema,
});

export const AgentBindingSchema = z.object({
  agenticId: Bytes32Schema,
});

export const IntentEnvelopeSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  intentId: z.string().min(1),
  nonce: z.number().int().nonnegative(),
  chainId: z.number().int().positive(),
  createdAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().positive(),
  principal: PrincipalSchema,
  agent: AgentBindingSchema,
  objective: ObjectiveSchema,
  constraints: z.object({
    hard: z.array(ConstraintSchema),
    soft: z.array(ConstraintSchema),
  }),
  allowedActions: z.array(z.string().min(1)),
  riskProfile: z.object({
    maxRisk: RiskClassSchema,
  }),
  status: IntentStatusSchema,
  steps: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        actionType: z.string().min(1),
        required: z.boolean(),
      }),
    )
    .optional(),
  integrity: z
    .object({
      contentHash: Bytes32Schema,
    })
    .optional(),
});

export const PLAYBOOK_STEPS = [
  { id: "allocate", label: "Allocate inside caps", actionType: "deposit", required: true },
  { id: "settle", label: "Settle the approved allocation", actionType: "deposit", required: true },
] as const;

export type IntentEnvelope = z.infer<typeof IntentEnvelopeSchema>;
export type Objective = z.infer<typeof ObjectiveSchema>;

/** Fields hashed into intentHash. `integrity` is excluded so the hash can be written back. */
export function intentHashPayload(envelope: IntentEnvelope): Omit<IntentEnvelope, "integrity"> {
  const { integrity: _integrity, ...rest } = envelope;
  return rest;
}

/** On-chain intentId is always the keccak of the envelope, never keccak(uuid). */
export function canonicalIntentId(envelope: IntentEnvelope): `0x${string}` {
  return (envelope.integrity?.contentHash ?? hashCanonical(intentHashPayload(envelope))) as `0x${string}`;
}
