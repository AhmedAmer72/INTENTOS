import { describe, expect, it } from "vitest";
import { compileDeterministic, compileIntent, detectAmbiguity, mergeCompiledConstraints } from "../src/compiler.js";
import { DEMO_INTENT_TEXT } from "@intentos/schema";

const ctx = {
  principal: "0x1111111111111111111111111111111111111111" as const,
  agentId: "0x0000000000000000000000000000000000000000000000000000000000000001" as const,
  chainId: 16602,
  now: 1_750_000_000,
};

describe("intent compiler", () => {
  it("extracts hard constraints from the demo sentence", () => {
    const { envelope, challenge } = compileDeterministic(DEMO_INTENT_TEXT, ctx);
    const types = envelope.constraints.hard.map((c) => c.type);
    expect(types).toContain("max_capital");
    expect(types).toContain("max_duration");
    expect(types).toContain("no_leverage");
    expect(types).toContain("max_risk_class");
    const cap = envelope.constraints.hard.find((c) => c.type === "max_capital");
    expect(cap && cap.type === "max_capital" && cap.value).toBe(5000);
    expect(challenge).toBe(false);
  });

  it("does not challenge a stated amount without vague words", () => {
    const { challenge, unresolvedTerms, envelope } = compileDeterministic("Deploy 500 USDC", ctx);
    expect(challenge).toBe(false);
    expect(unresolvedTerms).toEqual([]);
    expect(envelope.constraints.hard.some((c) => c.type === "max_capital")).toBe(true);
  });

  it("does not invent an amount for an ambiguous prompt — CHALLENGE instead", () => {
    const text = "Invest some money in the best yield farm soon";
    const { envelope, challenge, unresolvedTerms } = compileDeterministic(text, ctx);
    expect(challenge).toBe(true);
    expect(unresolvedTerms.length).toBeGreaterThan(0);
    expect(envelope.constraints.hard.some((c) => c.type === "max_capital")).toBe(false);
  });

  it("detects refurbished / best laptop ambiguity without guessing a brand", () => {
    const terms = detectAmbiguity("Buy me the best laptop under $1500");
    expect(terms).toContain("best");
  });

  it("fills incomplete LLM constraints from the deterministic extract", () => {
    const { envelope } = compileDeterministic(DEMO_INTENT_TEXT, ctx);
    const merged = mergeCompiledConstraints(
      [
        { id: "x", type: "max_capital", severity: "hard", label: "cap" },
        { id: "y", type: "max_duration", severity: "hard", label: "time" },
        { id: "z", type: "no_leverage", severity: "hard", label: "No leverage" },
      ],
      envelope.constraints.hard,
    );
    const cap = merged.find((c) => c.type === "max_capital");
    const dur = merged.find((c) => c.type === "max_duration");
    expect(cap && cap.type === "max_capital" && cap.value).toBe(5000);
    expect(dur && dur.type === "max_duration" && dur.unit).toBe("days");
    expect(merged.some((c) => c.type === "no_leverage")).toBe(true);

    const zeroCap = mergeCompiledConstraints(
      [{ id: "x", type: "max_capital", severity: "hard", label: "cap", value: 0, currency: "USDC" }],
      envelope.constraints.hard,
    );
    const filled = zeroCap.find((c) => c.type === "max_capital");
    expect(filled && filled.type === "max_capital" && filled.value).toBe(5000);
  });

  it("refuses to compile without a Router API key", async () => {
    await expect(compileIntent(DEMO_INTENT_TEXT, ctx)).rejects.toMatchObject({
      name: "FailClosedError",
      code: "missing_router_key",
    });
  });
});
