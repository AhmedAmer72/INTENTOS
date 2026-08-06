import { describe, expect, it } from "vitest";
import { IntentEnvelopeSchema, ProposedActionSchema, demoEnvelope, strategyA } from "../src/index.js";

describe("schema validation", () => {
  it("accepts the demo envelope", () => {
    const parsed = IntentEnvelopeSchema.parse(demoEnvelope());
    expect(parsed.constraints.hard).toHaveLength(6);
  });

  it("rejects a mutated already-hashed envelope with a bad address", () => {
    const env = demoEnvelope();
    env.principal.wallet = "not-an-address";
    expect(() => IntentEnvelopeSchema.parse(env)).toThrow();
  });

  it("accepts strategy A", () => {
    const action = strategyA("11111111-1111-1111-1111-111111111111");
    expect(ProposedActionSchema.parse(action).params.capital).toBe(5000);
  });
});
