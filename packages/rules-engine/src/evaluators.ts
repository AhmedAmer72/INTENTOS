import type { Constraint, ConstraintCheck, ProposedAction } from "@intentos/schema";
import { DURATION_TO_SECONDS, RISK_ORDINAL } from "@intentos/schema";

function check(
  constraint: Constraint,
  result: ConstraintCheck["result"],
  message: string,
  compared?: ConstraintCheck["compared"],
): ConstraintCheck {
  return {
    constraintId: constraint.id,
    constraint: constraint.type,
    severity: constraint.severity,
    result,
    message,
    compared,
  };
}

function leverageEnabled(value: boolean | number): boolean {
  if (typeof value === "boolean") return value;
  return value > 1;
}

export function evaluateConstraint(
  constraint: Constraint,
  action: ProposedAction,
): ConstraintCheck {
  switch (constraint.type) {
    case "max_capital": {
      const actual = action.params.capital;
      const currencyOk =
        action.params.currency.toUpperCase() === constraint.currency.toUpperCase() ||
        (action.params.asset ?? "").toUpperCase() === constraint.currency.toUpperCase();
      if (!currencyOk) {
        return check(constraint, "FAIL", "Asset/currency mismatch", {
          expected: constraint.currency,
          actual: action.params.currency,
        });
      }
      const pass = actual <= constraint.value;
      return check(
        constraint,
        pass ? "PASS" : "FAIL",
        pass
          ? `Capital ${actual} <= ${constraint.value} ${constraint.currency}`
          : `Capital ${actual} exceeds maximum ${constraint.value} ${constraint.currency}`,
        { expected: constraint.value, actual },
      );
    }
    case "max_duration": {
      const actualDays = action.params.durationDays;
      if (actualDays === undefined) {
        return check(constraint, "NOT_APPLICABLE", "Action has no duration");
      }
      const maxSeconds = constraint.value * DURATION_TO_SECONDS[constraint.unit];
      const actualSeconds = actualDays * DURATION_TO_SECONDS.days;
      const pass = actualSeconds <= maxSeconds;
      return check(
        constraint,
        pass ? "PASS" : "FAIL",
        pass
          ? `Duration ${actualDays}d within ${constraint.value} ${constraint.unit}`
          : `Duration ${actualDays}d exceeds ${constraint.value} ${constraint.unit}`,
        { expected: `${constraint.value} ${constraint.unit}`, actual: `${actualDays} days` },
      );
    }
    case "no_leverage": {
      const enabled = leverageEnabled(action.params.leverage);
      return check(
        constraint,
        enabled ? "FAIL" : "PASS",
        enabled ? `Leverage is present (${String(action.params.leverage)})` : "No leverage",
        { expected: false, actual: action.params.leverage },
      );
    }
    case "audited_contract_only": {
      const pass = action.params.protocolAudited === true;
      return check(
        constraint,
        pass ? "PASS" : "FAIL",
        pass ? "Protocol is audited" : "Protocol is not audited",
        { expected: true, actual: action.params.protocolAudited },
      );
    }
    case "allowed_actions": {
      const pass = constraint.actions.includes(action.actionType);
      return check(
        constraint,
        pass ? "PASS" : "FAIL",
        pass
          ? `Action ${action.actionType} is allowed`
          : `Action ${action.actionType} is not in [${constraint.actions.join(", ")}]`,
        { expected: constraint.actions, actual: action.actionType },
      );
    }
    case "max_risk_class": {
      const actual = RISK_ORDINAL[action.params.riskClass];
      const max = RISK_ORDINAL[constraint.value];
      const pass = actual <= max;
      return check(
        constraint,
        pass ? "PASS" : "FAIL",
        pass
          ? `Risk ${action.params.riskClass} <= ${constraint.value}`
          : `Risk ${action.params.riskClass} exceeds ${constraint.value}`,
        { expected: constraint.value, actual: action.params.riskClass },
      );
    }
    case "counterparty_allowlist": {
      const actual = action.params.counterparty;
      if (!actual) {
        return check(constraint, "FAIL", "Action has no counterparty", {
          expected: constraint.addresses,
          actual: null,
        });
      }
      const pass = constraint.addresses.some((a) => a.toLowerCase() === actual.toLowerCase());
      return check(
        constraint,
        pass ? "PASS" : "FAIL",
        pass ? "Counterparty is allowlisted" : `Counterparty ${actual} is not allowlisted`,
        { expected: constraint.addresses, actual },
      );
    }
    case "preferred_yield": {
      const apy = action.estimatedOutcome.apy;
      if (apy === undefined) {
        return check(constraint, "NOT_APPLICABLE", "No APY in estimated outcome");
      }
      const pass = apy >= constraint.minimum;
      return check(
        constraint,
        pass ? "PASS" : "FAIL",
        pass
          ? `APY ${apy}% meets preferred ${constraint.minimum}%`
          : `APY ${apy}% is below preferred ${constraint.minimum}%`,
        { expected: constraint.minimum, actual: apy },
      );
    }
    default: {
      const _exhaustive: never = constraint;
      return _exhaustive;
    }
  }
}
