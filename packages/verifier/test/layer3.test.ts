import { describe, expect, it } from "vitest";
import { demoEnvelope, strategyA, strategyB } from "@intentos/schema";
import { evaluateConsistency } from "../src/layer3.js";

describe("layer 3 consistency", () => {
  it("does not flag Strategy A as drifted on amount", () => {
    const intent = demoEnvelope();
    const result = evaluateConsistency(intent, strategyA(intent.intentId));
    expect(result.driftedFields).not.toContain("amount");
  });

  it("flags plan/action amount drift", () => {
    const intent = demoEnvelope();
    const action = strategyA(intent.intentId);
    action.plan.summary = "Allocate 8000 USDC into the vault";
    action.params.capital = 5000;
    const result = evaluateConsistency(intent, action);
    expect(result.driftedFields).toContain("amount");
    expect(result.alignmentScore).toBeLessThan(1);
  });

  it("records Strategy B fields without crashing", () => {
    const intent = demoEnvelope();
    const result = evaluateConsistency(intent, strategyB(intent.intentId));
    expect(result.fields.length).toBeGreaterThan(3);
    expect(result.driftedFields).toEqual(expect.arrayContaining(["leverage", "risk"]));
  });
});
