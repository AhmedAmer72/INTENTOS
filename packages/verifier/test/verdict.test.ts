import { describe, expect, it } from "vitest";
import { demoEnvelope, hashCanonical, strategyA, strategyB } from "@intentos/schema";
import { decideVerdict } from "../src/verdict.js";
import { evaluateRules } from "@intentos/rules-engine";
import { evaluateConsistency } from "../src/layer3.js";

describe("monotonic veto", () => {
  it("REJECTS Strategy B even when the LLM claims 99% alignment", () => {
    const intent = demoEnvelope();
    const action = strategyB(intent.intentId);
    const layer1 = evaluateRules(intent, action);
    const layer3 = evaluateConsistency(intent, action);
    const result = decideVerdict({
      intentId: intent.intentId,
      actionHash: hashCanonical(action),
      layer1,
      layer2: {
        alignmentScore: 0.99,
        confidence: 0.99,
        reasoning: "this is fine actually",
        referencedConstraintIds: [],
      },
      layer3,
    });
    expect(layer1.hardConstraintsSatisfied).toBe(false);
    expect(result.verdict).toBe("REJECT");
    expect(result.hardConstraintsSatisfied).toBe(false);
  });

  it("cannot upgrade a hard failure by any threshold tweak", () => {
    const intent = demoEnvelope();
    const action = strategyB(intent.intentId);
    const result = decideVerdict({
      intentId: intent.intentId,
      actionHash: hashCanonical(action),
      layer1: evaluateRules(intent, action),
      layer2: { alignmentScore: 1, confidence: 1, reasoning: "", referencedConstraintIds: [] },
      layer3: evaluateConsistency(intent, action),
      thresholds: { minAlignment: 0, minConfidence: 0 },
    });
    expect(result.verdict).toBe("REJECT");
  });
});

describe("demo scenarios are deterministic", () => {
  it("APPROVES Strategy A across 10 runs", () => {
    const intent = demoEnvelope();
    for (let i = 0; i < 10; i++) {
      const action = strategyA(intent.intentId);
      const result = decideVerdict({
        intentId: intent.intentId,
        actionHash: hashCanonical(action),
        layer1: evaluateRules(intent, action),
        layer2: {
          alignmentScore: 0.92,
          confidence: 0.9,
          reasoning: "aligned with hard constraints",
          referencedConstraintIds: [],
        },
        layer3: evaluateConsistency(intent, action),
      });
      expect(result.verdict).toBe("APPROVE");
    }
  });

  it("REJECTS Strategy B across 10 runs", () => {
    const intent = demoEnvelope();
    for (let i = 0; i < 10; i++) {
      const action = strategyB(intent.intentId);
      const result = decideVerdict({
        intentId: intent.intentId,
        actionHash: hashCanonical(action),
        layer1: evaluateRules(intent, action),
        layer2: {
          alignmentScore: 0.99,
          confidence: 0.99,
          reasoning: "adversarial",
          referencedConstraintIds: [],
        },
        layer3: evaluateConsistency(intent, action),
      });
      expect(result.verdict).toBe("REJECT");
    }
  });

  it("CHALLENGES when hard constraints pass but Layer 2 was skipped", () => {
    const intent = demoEnvelope();
    const action = strategyA(intent.intentId);
    const result = decideVerdict({
      intentId: intent.intentId,
      actionHash: hashCanonical(action),
      layer1: evaluateRules(intent, action),
      layer2: {
        alignmentScore: 0,
        confidence: 0,
        reasoning: "",
        referencedConstraintIds: [],
        skipped: true,
        skipReason: "test",
      },
      layer3: evaluateConsistency(intent, action),
    });
    expect(result.verdict).toBe("CHALLENGE");
    expect(result.confidence).toBe(0);
  });

  it("CHALLENGES when Layer 3 detects plan/action drift even if Layer 2 is confident", () => {
    const intent = demoEnvelope();
    const action = strategyA(intent.intentId);
    action.plan.summary = "Allocate 8000 USDC into the vault";
    action.params.capital = 5000;
    const result = decideVerdict({
      intentId: intent.intentId,
      actionHash: hashCanonical(action),
      layer1: evaluateRules(intent, action),
      layer2: {
        alignmentScore: 0.95,
        confidence: 0.95,
        reasoning: "looks aligned",
        referencedConstraintIds: [],
      },
      layer3: evaluateConsistency(intent, action),
    });
    expect(result.verdict).toBe("CHALLENGE");
    expect(result.challengeReason).toMatch(/Layer 3 drift/);
  });

  it("CHALLENGES when the source intent still has unresolved terms", () => {
    const intent = demoEnvelope();
    const action = strategyA(intent.intentId);
    const result = decideVerdict({
      intentId: intent.intentId,
      actionHash: hashCanonical(action),
      layer1: evaluateRules(intent, action),
      layer2: {
        alignmentScore: 0.95,
        confidence: 0.95,
        reasoning: "aligned",
        referencedConstraintIds: [],
      },
      layer3: evaluateConsistency(intent, action),
      unresolvedTerms: ["some"],
    });
    expect(result.verdict).toBe("CHALLENGE");
    expect(result.challengeReason).toMatch(/Ambiguous terms/);
  });

  it("CHALLENGES when hard constraints pass but confidence is low", () => {
    const intent = demoEnvelope();
    const action = strategyA(intent.intentId);
    const result = decideVerdict({
      intentId: intent.intentId,
      actionHash: hashCanonical(action),
      layer1: evaluateRules(intent, action),
      layer2: {
        alignmentScore: 0.8,
        confidence: 0.4,
        reasoning: "unsure",
        referencedConstraintIds: [],
      },
      layer3: evaluateConsistency(intent, action),
    });
    expect(result.verdict).toBe("CHALLENGE");
  });
});
