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

  it("accepts an optional executor settlement call", () => {
    const action = strategyA("11111111-1111-1111-1111-111111111111");
    const parsed = ProposedActionSchema.parse({
      ...action,
      settlement: {
        target: "0x1111111111111111111111111111111111111111",
        calldata: "0x01",
        valueWei: "1000",
      },
    });
    expect(parsed.settlement?.target).toMatch(/^0x/i);
  });
});
