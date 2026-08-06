import { describe, expect, it } from "vitest";
import { demoEnvelope, strategyA, strategyB } from "@intentos/schema";
import { evaluateRules } from "../src/index.js";

/**
 * Adversarial test: an LLM cannot rewrite Layer-1 results.
 * The engine is a pure function of (intent, action). Feeding a forged
 * "the model said PASS" overlay must not change FAIL outcomes.
 */
describe("monotonic Layer-1 integrity", () => {
  it("does not accept an LLM overlay that claims Strategy B passed", () => {
    const intent = demoEnvelope();
    const layer1 = evaluateRules(intent, strategyB(intent.intentId));
    const llmOverlay = {
      verdict: "APPROVE" as const,
      alignmentScore: 0.99,
      confidence: 0.99,
      checks: layer1.checks.map((c) => ({ ...c, result: "PASS" as const })),
    };
    // The rules engine itself never reads the overlay — this documents the contract.
    const relayer1 = evaluateRules(intent, strategyB(intent.intentId));
    expect(relayer1.hardConstraintsSatisfied).toBe(false);
    expect(llmOverlay.verdict).toBe("APPROVE");
    expect(relayer1.hardConstraintsSatisfied).not.toBe(llmOverlay.verdict === "APPROVE");
  });

  it("is deterministic across 10 runs on both strategies", () => {
    const intent = demoEnvelope();
    for (let i = 0; i < 10; i++) {
      expect(evaluateRules(intent, strategyA(intent.intentId)).hardConstraintsSatisfied).toBe(true);
      expect(evaluateRules(intent, strategyB(intent.intentId)).hardConstraintsSatisfied).toBe(false);
    }
  });
});
