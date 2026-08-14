import { RISK_ORDINAL, type IntentEnvelope, type Layer3Result, type ProposedAction, type RiskClass } from "@intentos/schema";

function capitalOf(intent: IntentEnvelope): number | undefined {
  const c = intent.constraints.hard.find((x) => x.type === "max_capital");
  return c && c.type === "max_capital" ? c.value : undefined;
}

function durationDaysOf(intent: IntentEnvelope): number | undefined {
  const c = intent.constraints.hard.find((x) => x.type === "max_duration");
  if (!c || c.type !== "max_duration") return undefined;
  if (c.unit === "days") return c.value;
  if (c.unit === "hours") return c.value / 24;
  return undefined;
}

function parsePlanNumber(plan: string, re: RegExp): number | undefined {
  const m = plan.match(re);
  if (!m?.[1]) return undefined;
  return Number(m[1].replace(/,/g, ""));
}

export function evaluateConsistency(intent: IntentEnvelope, action: ProposedAction): Layer3Result {
  const planText = `${action.plan.summary} ${action.plan.steps.join(" ")}`;
  const fields: Layer3Result["fields"] = [];

  const intentCapital = capitalOf(intent);
  const planCapital = parsePlanNumber(planText, /(\d[\d,]*(?:\.\d+)?)\s*USDC/i) ?? action.params.capital;
  fields.push({
    field: "amount",
    intent: intentCapital,
    plan: planCapital,
    action: action.params.capital,
    drifted: planCapital !== action.params.capital,
  });

  const intentDuration = durationDaysOf(intent);
  const planDuration =
    parsePlanNumber(planText, /(\d+)\s*days?/i) ?? action.params.durationDays;
  fields.push({
    field: "duration",
    intent: intentDuration,
    plan: planDuration,
    action: action.params.durationDays,
    drifted: planDuration !== action.params.durationDays,
  });

  const intentAsset =
    intent.constraints.hard.find((c) => c.type === "max_capital" && c.type === "max_capital") &&
    intent.constraints.hard.find((c) => c.type === "max_capital");
  const currency = intentAsset && intentAsset.type === "max_capital" ? intentAsset.currency : undefined;
  fields.push({
    field: "asset",
    intent: currency,
    plan: action.params.asset ?? action.params.currency,
    action: action.params.currency,
    drifted:
      Boolean(currency) &&
      currency!.toUpperCase() !== action.params.currency.toUpperCase(),
  });

  const noLev = intent.constraints.hard.some((c) => c.type === "no_leverage");
  const actionLev =
    typeof action.params.leverage === "boolean" ? action.params.leverage : action.params.leverage > 1;
  fields.push({
    field: "leverage",
    intent: noLev ? false : undefined,
    plan: planText.toLowerCase().includes("lever") ? true : actionLev,
    action: action.params.leverage,
    drifted: noLev && Boolean(actionLev),
  });

  const maxRisk = intent.riskProfile.maxRisk;
  const actionRisk = action.params.riskClass as RiskClass;
  fields.push({
    field: "risk",
    intent: maxRisk,
    plan: action.params.riskClass,
    action: action.params.riskClass,
    drifted: Boolean(RISK_ORDINAL[actionRisk] && RISK_ORDINAL[actionRisk] > RISK_ORDINAL[maxRisk]),
  });

  fields.push({
    field: "actionClass",
    intent: intent.allowedActions,
    plan: action.actionType,
    action: action.actionType,
    drifted: !intent.allowedActions.includes(action.actionType),
  });

  const driftedFields = fields.filter((f) => f.drifted).map((f) => f.field);
  const alignmentScore = Math.max(0, 1 - driftedFields.length * 0.2);
  return { alignmentScore, driftedFields, fields };
}
