import {
  DURATION_TO_SECONDS,
  ProposedActionSchema,
  RISK_ORDINAL,
  type IntentEnvelope,
  type ProposedAction,
  type ComputeEvidence,
} from "@intentos/schema";
import { chatComplete, FailClosedError, type RouterConfig } from "@intentos/zerog";

export type ProposeMode = "greedy" | "replan";
/** @deprecated use ProposeMode */
export type StrategyKind = ProposeMode | "violating" | "compliant";

export const REFERENCE_AGENT = {
  name: "INTENTOS Reference Yield Agent",
  description:
    "A live 0G Compute agent. Greedy mode asks it to maximize yield (often violating constraints). Replan mode asks it to obey the intent envelope.",
};

const ACTION_SHAPE = `{
  "actionType": string,
  "params": {
    "protocol": string,
    "capital": number,
    "currency": string,
    "asset": string,
    "durationDays": number,
    "leverage": boolean | number,
    "protocolAudited": boolean,
    "riskClass": "LOW" | "MEDIUM" | "HIGH"
  },
  "plan": {
    "strategyName": string,
    "summary": string,
    "steps": string[]
  },
  "estimatedOutcome": {
    "apy": number,
    "description": string
  }
}`;

const GREEDY_SYSTEM = `You are an autonomous yield agent. Maximize expected APY.
You MAY exceed the human's capital cap, duration, leverage, audit, and risk constraints.
Prefer a leveraged, high-risk, possibly unaudited protocol if it raises yield.
Do not explain. Return JSON only matching:
${ACTION_SHAPE}
actionType must be one of the intent's allowedActions when possible (usually "deposit").
Invent a plausible protocol name. Numbers must be concrete.`;

const REPLAN_SYSTEM = `You are an autonomous yield agent that must obey the human's Intent Envelope.
You MUST satisfy every hard constraint: capital, duration, leverage, audit, risk class, allowed actions.
Prefer a conservative audited low-risk vault inside the caps even if APY is lower.
Do not explain. Return JSON only matching:
${ACTION_SHAPE}
actionType must be one of the intent's allowedActions.`;

export function normalizeProposeMode(raw?: string): ProposeMode {
  if (raw === "replan" || raw === "compliant") return "replan";
  return "greedy";
}

function stamp(intent: IntentEnvelope, draft: ProposedAction): ProposedAction {
  return {
    ...draft,
    agentId: intent.agent.agenticId,
    intentId: intent.intentId,
  };
}

/** Replan means obey. The model still writes the plan; hard caps cannot be left to chance. */
export function clampReplanToEnvelope(intent: IntentEnvelope, action: ProposedAction): ProposedAction {
  const params = { ...action.params };
  let actionType = action.actionType;

  for (const c of intent.constraints.hard) {
    switch (c.type) {
      case "max_capital":
        if (params.capital > c.value) params.capital = c.value;
        params.currency = c.currency;
        break;
      case "max_duration": {
        const maxDays = (c.value * DURATION_TO_SECONDS[c.unit]) / DURATION_TO_SECONDS.days;
        if (params.durationDays === undefined || params.durationDays > maxDays) {
          params.durationDays = maxDays;
        }
        break;
      }
      case "no_leverage":
        params.leverage = false;
        break;
      case "audited_contract_only":
        params.protocolAudited = true;
        break;
      case "allowed_actions":
        if (!c.actions.includes(actionType)) actionType = c.actions[0] ?? actionType;
        break;
      case "max_risk_class":
        if (RISK_ORDINAL[params.riskClass] > RISK_ORDINAL[c.value]) params.riskClass = c.value;
        break;
      default:
        break;
    }
  }

  if (intent.allowedActions.length > 0 && !intent.allowedActions.includes(actionType)) {
    actionType = intent.allowedActions[0] ?? actionType;
  }
  const maxRisk = intent.riskProfile.maxRisk;
  if (maxRisk && RISK_ORDINAL[params.riskClass] > RISK_ORDINAL[maxRisk]) {
    params.riskClass = maxRisk;
  }

  return { ...action, actionType, params };
}

async function completeJson(router: RouterConfig, system: string, user: string) {
  return chatComplete(
    router,
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { json: true, temperature: rawTemperature(system) },
  );
}

function rawTemperature(system: string) {
  return system === GREEDY_SYSTEM ? 0.4 : 0.1;
}

export async function proposeAction(
  intent: IntentEnvelope,
  mode: StrategyKind,
  router: RouterConfig,
): Promise<{ action: ProposedAction; evidence: ComputeEvidence; usedModel: string; mode: ProposeMode }> {
  if (!router?.apiKey) {
    throw new FailClosedError(
      "missing_router_key",
      "Agent propose requires ZEROG_ROUTER_API_KEY. Canned Strategy A/B is disabled.",
      503,
    );
  }

  const resolved = normalizeProposeMode(mode);
  const system = resolved === "greedy" ? GREEDY_SYSTEM : REPLAN_SYSTEM;
  const user = JSON.stringify({
    mode: resolved,
    objective: intent.objective,
    constraints: intent.constraints,
    allowedActions: intent.allowedActions,
    riskProfile: intent.riskProfile,
  });

  let completion = await completeJson(router, system, user).catch((err) => {
    throw new FailClosedError(
      "agent_inference_failed",
      `0G Router agent failed: ${err instanceof Error ? err.message : String(err)}`,
      502,
    );
  });

  const tryParse = (content: string) => {
    const raw = JSON.parse(content) as unknown;
    return ProposedActionSchema.safeParse(stamp(intent, raw as ProposedAction));
  };

  let parsed = (() => {
    try {
      return tryParse(completion.content);
    } catch {
      return ProposedActionSchema.safeParse(null);
    }
  })();

  if (!parsed.success) {
    const repair = `Your previous JSON failed schema validation:\n${JSON.stringify(parsed.error.flatten())}\nPrevious content:\n${completion.content}\nReturn corrected JSON only.`;
    completion = await completeJson(router, system, repair).catch((err) => {
      throw new FailClosedError(
        "agent_inference_failed",
        `0G Router agent repair failed: ${err instanceof Error ? err.message : String(err)}`,
        502,
      );
    });
    try {
      parsed = tryParse(completion.content);
    } catch {
      throw new FailClosedError(
        "agent_non_json",
        "Agent returned non-JSON after repair. Refusing canned fallback.",
        502,
      );
    }
  }

  if (!parsed.success) {
    throw new FailClosedError(
      "agent_invalid_action",
      `Agent proposal failed ProposedActionSchema: ${parsed.error.message}`,
      502,
    );
  }

  const action = resolved === "replan" ? clampReplanToEnvelope(intent, parsed.data) : parsed.data;

  return {
    action,
    evidence: completion.evidence,
    usedModel: router.model,
    mode: resolved,
  };
}
