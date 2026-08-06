import type { IntentEnvelope, Layer1Result, ProposedAction } from "@intentos/schema";
import { evaluateConstraint } from "./evaluators.js";

export function evaluateRules(intent: IntentEnvelope, action: ProposedAction): Layer1Result {
  const all = [...intent.constraints.hard, ...intent.constraints.soft];
  const checks = all.map((c) => evaluateConstraint(c, action));

  if (intent.allowedActions.length > 0) {
    const implied = intent.constraints.hard.find((c) => c.type === "allowed_actions");
    if (!implied) {
      checks.push({
        constraintId: "allowed-actions-envelope",
        constraint: "allowed_actions",
        severity: "hard",
        result: intent.allowedActions.includes(action.actionType) ? "PASS" : "FAIL",
        message: intent.allowedActions.includes(action.actionType)
          ? `Action ${action.actionType} is allowed`
          : `Action ${action.actionType} not in envelope allowedActions`,
        compared: { expected: intent.allowedActions, actual: action.actionType },
      });
    }
  }

  if (intent.riskProfile.maxRisk) {
    const implied = intent.constraints.hard.find((c) => c.type === "max_risk_class");
    if (!implied) {
      checks.push(
        evaluateConstraint(
          {
            id: "risk-profile",
            type: "max_risk_class",
            severity: "hard",
            label: "Envelope risk profile",
            value: intent.riskProfile.maxRisk,
          },
          action,
        ),
      );
    }
  }

  const hardFails = checks.filter((c) => c.severity === "hard" && c.result === "FAIL");
  return {
    hardConstraintsSatisfied: hardFails.length === 0,
    checks,
  };
}
