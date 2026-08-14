import {
  DEFAULT_VERDICT_THRESHOLDS,
  type Layer1Result,
  type Layer2Result,
  type Layer3Result,
  type Verdict,
  type VerificationResult,
} from "@intentos/schema";

export type VerdictInput = {
  intentId: string;
  actionHash: `0x${string}`;
  layer1: Layer1Result;
  layer2: Layer2Result;
  layer3: Layer3Result;
  unresolvedTerms?: string[];
  thresholds?: { minAlignment: number; minConfidence: number };
};

/**
 * Load-bearing security property: Layer 1 hard failures are a terminal REJECT.
 * The LLM (Layer 2) may only downgrade APPROVE → CHALLENGE, never upgrade REJECT.
 */
export function decideVerdict(input: VerdictInput): VerificationResult {
  const thresholds = input.thresholds ?? DEFAULT_VERDICT_THRESHOLDS;
  const { layer1, layer2, layer3 } = input;

  if (!layer1.hardConstraintsSatisfied) {
    return {
      intentId: input.intentId,
      actionHash: input.actionHash,
      alignmentScore: Math.min(layer2.alignmentScore, layer3.alignmentScore, 0.4),
      confidence: Math.max(layer2.confidence, 0.9),
      hardConstraintsSatisfied: false,
      checks: layer1.checks,
      verdict: "REJECT",
      challengeReason: undefined,
      layerResults: { layer1, layer2, layer3 },
      computeEvidence: undefined,
    };
  }

  const alignment = layer2.skipped
    ? 0
    : Math.min(layer2.alignmentScore, layer3.alignmentScore);
  const confidence = layer2.skipped ? 0 : layer2.confidence;

  const reasons: string[] = [];
  if (input.unresolvedTerms && input.unresolvedTerms.length > 0) {
    reasons.push(`Ambiguous terms must be clarified, not guessed: ${input.unresolvedTerms.join(", ")}`);
  }
  if (layer3.driftedFields.length > 0) {
    reasons.push(`Layer 3 drift on ${layer3.driftedFields.join(", ")}`);
  }
  if (alignment < thresholds.minAlignment || confidence < thresholds.minConfidence) {
    reasons.push(
      alignment < thresholds.minAlignment
        ? `Alignment ${alignment.toFixed(2)} below ${thresholds.minAlignment}`
        : `Confidence ${confidence.toFixed(2)} below ${thresholds.minConfidence}`,
    );
  }

  const verdict: Verdict = reasons.length > 0 ? "CHALLENGE" : "APPROVE";
  const challengeReason = reasons.length > 0 ? reasons.join(" · ") : undefined;

  return {
    intentId: input.intentId,
    actionHash: input.actionHash,
    alignmentScore: alignment,
    confidence,
    hardConstraintsSatisfied: true,
    checks: layer1.checks,
    verdict,
    challengeReason,
    layerResults: { layer1, layer2, layer3 },
  };
}
