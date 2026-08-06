import { describe, expect, it } from "vitest";
import { demoEnvelope, strategyA, strategyB } from "@intentos/schema";
import { evaluateRules } from "../src/index.js";

const intent = demoEnvelope();

describe("deterministic rules engine", () => {
  it("passes every hard constraint on Strategy A", () => {
    const result = evaluateRules(intent, strategyA(intent.intentId));
    expect(result.hardConstraintsSatisfied).toBe(true);
    const hardFails = result.checks.filter((c) => c.severity === "hard" && c.result === "FAIL");
    expect(hardFails).toEqual([]);
  });

  it("fails capital, duration, leverage, audit, and risk on Strategy B", () => {
    const result = evaluateRules(intent, strategyB(intent.intentId));
    expect(result.hardConstraintsSatisfied).toBe(false);
    const failed = result.checks
      .filter((c) => c.result === "FAIL")
      .map((c) => c.constraint)
      .sort();
    expect(failed).toEqual(
      ["audited_contract_only", "max_capital", "max_duration", "max_risk_class", "no_leverage"].sort(),
    );
  });

  it("treats 1x leverage as no leverage", () => {
    const action = strategyA(intent.intentId);
    action.params.leverage = 1;
    const result = evaluateRules(intent, action);
    const lev = result.checks.find((c) => c.constraint === "no_leverage");
    expect(lev?.result).toBe("PASS");
  });

  it("fails currency mismatch on max_capital", () => {
    const action = strategyA(intent.intentId);
    action.params.currency = "ETH";
    action.params.asset = "ETH";
    const result = evaluateRules(intent, action);
    const cap = result.checks.find((c) => c.constraint === "max_capital");
    expect(cap?.result).toBe("FAIL");
  });

  it("fails disallowed action types", () => {
    const action = strategyA(intent.intentId);
    action.actionType = "swap";
    const result = evaluateRules(intent, action);
    expect(result.hardConstraintsSatisfied).toBe(false);
  });

  it("fails counterparty not on allowlist", () => {
    const env = demoEnvelope();
    env.constraints.hard.push({
      id: "c-cp",
      type: "counterparty_allowlist",
      severity: "hard",
      label: "Allowlist",
      addresses: ["0x2222222222222222222222222222222222222222"],
    });
    const action = strategyA(env.intentId);
    action.params.counterparty = "0x3333333333333333333333333333333333333333";
    const result = evaluateRules(env, action);
    const cp = result.checks.find((c) => c.constraint === "counterparty_allowlist");
    expect(cp?.result).toBe("FAIL");
  });

  it("marks preferred_yield as soft FAIL without blocking hard satisfaction", () => {
    const action = strategyA(intent.intentId);
    action.estimatedOutcome.apy = 1;
    const result = evaluateRules(intent, action);
    expect(result.hardConstraintsSatisfied).toBe(true);
    const y = result.checks.find((c) => c.constraint === "preferred_yield");
    expect(y?.result).toBe("FAIL");
    expect(y?.severity).toBe("soft");
  });

  it("covers duration NOT_APPLICABLE when missing", () => {
    const action = strategyA(intent.intentId);
    delete action.params.durationDays;
    const result = evaluateRules(intent, action);
    const d = result.checks.find((c) => c.constraint === "max_duration");
    expect(d?.result).toBe("NOT_APPLICABLE");
  });
});
