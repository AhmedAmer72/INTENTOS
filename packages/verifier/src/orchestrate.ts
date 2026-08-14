import { evaluateRules } from "@intentos/rules-engine";
import {
  hashCanonical,
  type EvidenceBundle,
  type IntentEnvelope,
  type ProposedAction,
  type VerificationResult,
} from "@intentos/schema";
import { FailClosedError, type RouterConfig } from "@intentos/zerog";
import { detectAmbiguity } from "./compiler.js";
import { evaluateSemantic } from "./layer2.js";
import { evaluateConsistency } from "./layer3.js";
import { decideVerdict } from "./verdict.js";

export async function verifyAction(args: {
  intent: IntentEnvelope;
  action: ProposedAction;
  router?: RouterConfig;
  sourceText?: string;
}): Promise<{ result: VerificationResult; evidence: EvidenceBundle }> {
  if (!args.router?.apiKey) {
    throw new FailClosedError(
      "missing_router_key",
      "Verify requires ZEROG_ROUTER_API_KEY. Layer 2 cannot be skipped.",
      503,
    );
  }

  const layer1 = evaluateRules(args.intent, args.action);
  const layer3 = evaluateConsistency(args.intent, args.action);
  const semantic = await evaluateSemantic(args.intent, args.action, args.router);
  if (semantic.result.skipped) {
    throw new FailClosedError(
      "layer2_skipped",
      semantic.result.skipReason ?? "Layer 2 skipped; refusing synthetic confidence",
      502,
    );
  }
  const actionHash = hashCanonical(args.action);
  const unresolvedTerms = args.sourceText ? detectAmbiguity(args.sourceText) : [];

  const decided = decideVerdict({
    intentId: args.intent.intentId,
    actionHash,
    layer1,
    layer2: semantic.result,
    layer3,
    unresolvedTerms,
  });

  decided.computeEvidence = semantic.evidence;

  const result: VerificationResult = {
    ...decided,
    actionHash,
  };

  const evidence: EvidenceBundle = {
    version: "1.0",
    intent: args.intent,
    action: args.action,
    verification: result,
    compiler: args.sourceText
      ? { sourceText: args.sourceText, unresolvedTerms }
      : undefined,
    layer2: semantic.result.skipped
      ? undefined
      : {
          prompt: semantic.prompt,
          rawResponse: semantic.rawResponse,
        },
    createdAt: Math.floor(Date.now() / 1000),
  };

  return { result, evidence };
}
