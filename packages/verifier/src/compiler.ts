import {
  ConstraintSchema,
  IntentEnvelopeSchema,
  SCHEMA_VERSION,
  type Constraint,
  type IntentEnvelope,
  toBytes32AgentId,
} from "@intentos/schema";
import {
  chatComplete,
  FailClosedError,
  listTeeModels,
  pickChatRouterModel,
  routerModelsFromList,
  type RouterConfig,
} from "@intentos/zerog";

export const COMPILER_SYSTEM = `You extract a structured intent envelope from a human request.
Return JSON only matching this shape:
{
  "objective": { "type": string, "description": string },
  "hard": Constraint[],
  "soft": Constraint[],
  "allowedActions": string[],
  "riskProfile": { "maxRisk": "LOW"|"MEDIUM"|"HIGH" },
  "unresolvedTerms": string[]
}
Constraint types: max_capital, max_duration, no_leverage, audited_contract_only, allowed_actions, max_risk_class, counterparty_allowlist, preferred_yield.
Each constraint has id, type, severity ("hard"|"soft"), label, and type-specific fields:
- max_capital: value (number), currency (string)
- max_duration: value (number), unit ("seconds"|"minutes"|"hours"|"days")
- max_risk_class: value ("LOW"|"MEDIUM"|"HIGH")
- preferred_yield: minimum (number)
- allowed_actions: actions (string[])
- no_leverage / audited_contract_only: no extra fields
NEVER invent constraints the user did not state. Put ambiguous words in unresolvedTerms.
If a quantity is missing (e.g. "invest some money"), do not guess a number — list it in unresolvedTerms.`;

const AMBIGUOUS = [
  /\bsome\b/i,
  /\bbest\b/i,
  /\bgood\b/i,
  /\breasonable\b/i,
  /\bsoon\b/i,
  /\bcheap\b/i,
  /\bmaybe\b/i,
  /\bwhatever\b/i,
  /\ba bit\b/i,
];

export type CompileResult = {
  envelope: IntentEnvelope;
  unresolvedTerms: string[];
  sourceText: string;
  usedModel?: string;
  challenge: boolean;
  challengeReason?: string;
};

export function detectAmbiguity(text: string): string[] {
  const hits: string[] = [];
  for (const re of AMBIGUOUS) {
    const m = text.match(re);
    if (m?.[0]) hits.push(m[0].toLowerCase());
  }
  const hasAmount = /\$\s*[\d,]+|\d[\d,]*\s*(usdc|usd|dollars?)/i.test(text);
  if (!hasAmount && /\b(invest|deploy|buy|spend|allocate)\b/i.test(text)) {
    hits.push("unspecified amount");
  }
  return [...new Set(hits)];
}

function parsedConstraint(raw: unknown): Constraint | undefined {
  const result = ConstraintSchema.safeParse(raw);
  return result.success ? result.data : undefined;
}

/** Regex-extracted quantities win when the model omits or zeros them. */
function preferDeterministicQuantities(llm: Constraint, det: Constraint): Constraint {
  if (llm.type !== det.type) return llm;
  const patch: Record<string, unknown> = { ...llm };
  if ("value" in det && typeof det.value === "number" && det.value > 0) patch.value = det.value;
  if ("currency" in det) patch.currency = det.currency;
  if ("unit" in det) patch.unit = det.unit;
  if ("minimum" in det && typeof det.minimum === "number") patch.minimum = det.minimum;
  if ("actions" in det && det.actions.length && (!("actions" in llm) || llm.actions.length === 0)) {
    patch.actions = det.actions;
  }
  return parsedConstraint(patch) ?? det;
}

/** Fill incomplete LLM constraints from the deterministic extract; keep extra valid LLM types. */
export function mergeCompiledConstraints(llm: unknown, deterministic: Constraint[]): Constraint[] {
  const byType = new Map<string, Constraint>();
  for (const c of deterministic) byType.set(c.type, c);
  if (!Array.isArray(llm)) return [...byType.values()];
  for (const item of llm) {
    const direct = parsedConstraint(item);
    if (direct) {
      const fallback = deterministic.find((c) => c.type === direct.type);
      byType.set(direct.type, fallback ? preferDeterministicQuantities(direct, fallback) : direct);
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const type = (item as { type?: unknown }).type;
    if (typeof type !== "string") continue;
    const fallback = deterministic.find((c) => c.type === type);
    if (!fallback) continue;
    const filled = parsedConstraint({ ...fallback, ...item, type: fallback.type, id: fallback.id });
    if (filled) byType.set(filled.type, filled);
  }
  return [...byType.values()];
}

export function compileDeterministic(
  text: string,
  ctx: {
    principal: `0x${string}`;
    agentId: `0x${string}`;
    chainId: number;
    nonce?: number;
    now?: number;
  },
): CompileResult {
  const now = ctx.now ?? Math.floor(Date.now() / 1000);
  const unresolved = detectAmbiguity(text);
  const hard: Constraint[] = [];
  const soft: Constraint[] = [];

  const money = text.match(/\$\s*([\d,]+(?:\.\d+)?)|([\d,]+(?:\.\d+)?)\s*(USDC|USD|dollars?)/i);
  const currency = /USDC/i.test(text) ? "USDC" : "USD";
  if (money) {
    const raw = (money[1] ?? money[2] ?? "0").replace(/,/g, "");
    hard.push({
      id: "c-max-capital",
      type: "max_capital",
      severity: "hard",
      label: `Capital must not exceed ${raw} ${currency}`,
      value: Number(raw),
      currency,
    });
  }

  const days = text.match(/(\d+)\s*days?/i);
  if (days) {
    hard.push({
      id: "c-max-duration",
      type: "max_duration",
      severity: "hard",
      label: `Duration must not exceed ${days[1]} days`,
      value: Number(days[1]),
      unit: "days",
    });
  }

  if (/no leverage|without leverage|don't use leverage|do not use leverage/i.test(text)) {
    hard.push({
      id: "c-no-leverage",
      type: "no_leverage",
      severity: "hard",
      label: "Leverage is forbidden",
    });
  }

  if (/unaudited|audited/i.test(text) && /not.*unaudited|don't.*unaudited|do not.*unaudited|audited contracts? only/i.test(text)) {
    hard.push({
      id: "c-audited",
      type: "audited_contract_only",
      severity: "hard",
      label: "Only audited contracts",
    });
  } else if (/don't buy refurbished|not refurbished|new only/i.test(text)) {
    /* procurement condition — encoded as a label-only risk signal via allowed actions */
  }

  if (/low[- ]risk/i.test(text)) {
    hard.push({
      id: "c-risk",
      type: "max_risk_class",
      severity: "hard",
      label: "Risk class at most LOW",
      value: "LOW",
    });
  } else if (/high[- ]risk/i.test(text)) {
    hard.push({
      id: "c-risk",
      type: "max_risk_class",
      severity: "hard",
      label: "Risk class at most HIGH",
      value: "HIGH",
    });
  }

  const ram = text.match(/(\d+)\s*GB\s*RAM/i);
  const price = text.match(/under\s*\$?\s*([\d,]+)/i);
  if (ram || price) {
    /* keep financial constraint types; describe extras in the objective */
  }

  const yieldPref = text.match(/(\d+(?:\.\d+)?)\s*%/);
  if (yieldPref) {
    soft.push({
      id: "c-yield",
      type: "preferred_yield",
      severity: "soft",
      label: `Prefer at least ${yieldPref[1]}% yield`,
      minimum: Number(yieldPref[1]),
    });
  }

  const isPurchase = /\bbuy\b|\bpurchase\b/i.test(text);
  const allowedActions = isPurchase ? ["purchase"] : ["deposit", "withdraw", "claim"];
  if (!isPurchase) {
    hard.push({
      id: "c-actions",
      type: "allowed_actions",
      severity: "hard",
      label: `Only ${allowedActions.join(", ")}`,
      actions: allowedActions,
    });
  }

  const envelope: IntentEnvelope = {
    schemaVersion: SCHEMA_VERSION,
    intentId: crypto.randomUUID(),
    nonce: ctx.nonce ?? 0,
    chainId: ctx.chainId,
    createdAt: now,
    expiresAt: now + 14 * 86400,
    principal: { wallet: ctx.principal },
    agent: { agenticId: toBytes32AgentId(ctx.agentId) },
    objective: {
      type: isPurchase ? "procurement" : "financial",
      description: text.trim(),
    },
    constraints: { hard, soft },
    allowedActions,
    riskProfile: { maxRisk: /low[- ]risk/i.test(text) ? "LOW" : "MEDIUM" },
    status: "DRAFT",
  };

  const parsed = IntentEnvelopeSchema.parse(envelope);
  const challenge = unresolved.length > 0;
  return {
    envelope: parsed,
    unresolvedTerms: unresolved,
    sourceText: text,
    challenge,
    challengeReason: challenge
      ? `Ambiguous terms must be clarified, not guessed: ${unresolved.join(", ")}`
      : undefined,
  };
}

export async function compileIntent(
  text: string,
  ctx: {
    principal: `0x${string}`;
    agentId: `0x${string}`;
    chainId: number;
    nonce?: number;
  },
  router?: RouterConfig,
): Promise<CompileResult> {
  if (!router?.apiKey) {
    throw new FailClosedError(
      "missing_router_key",
      "Compile requires ZEROG_ROUTER_API_KEY. Create an sk- key at https://pc.testnet.0g.ai (Galileo) or https://pc.0g.ai (mainnet).",
      503,
    );
  }

  const deterministic = compileDeterministic(text, ctx);

  let completion;
  try {
    completion = await chatComplete(
      router,
      [
        { role: "system", content: COMPILER_SYSTEM },
        { role: "user", content: text },
      ],
      { json: true, temperature: 0 },
    );
  } catch (err) {
    let hint = "";
    try {
      const listed = await listTeeModels(router);
      const ids = routerModelsFromList(listed).map((m) => m.id);
      const chat = pickChatRouterModel(listed);
      hint = ids.length
        ? ` Available models: ${ids.join(", ")}.${chat ? ` Set ZEROG_ROUTER_MODEL=${chat}` : ""}`
        : "";
    } catch {
      /* listing failed — keep the original Router error */
    }
    throw new FailClosedError(
      "compiler_inference_failed",
      `0G Router compile failed: ${err instanceof Error ? err.message : String(err)}.${hint}`,
      502,
    );
  }

  let draft: {
    objective?: { type?: string; description?: string };
    hard?: Constraint[];
    soft?: Constraint[];
    allowedActions?: string[];
    riskProfile?: { maxRisk?: "LOW" | "MEDIUM" | "HIGH" };
    unresolvedTerms?: string[];
  };
  try {
    draft = JSON.parse(completion.content) as typeof draft;
  } catch {
    throw new FailClosedError(
      "compiler_non_json",
      "0G Router compile returned non-JSON. Refusing to fall back to regex-only extraction.",
      502,
    );
  }

  const unresolved = [
    ...new Set([...(draft.unresolvedTerms ?? []), ...deterministic.unresolvedTerms]),
  ];
  const envelope: IntentEnvelope = {
    ...deterministic.envelope,
    objective: {
      type: draft.objective?.type ?? deterministic.envelope.objective.type,
      description: draft.objective?.description ?? deterministic.envelope.objective.description,
    },
    constraints: {
      hard: mergeCompiledConstraints(draft.hard, deterministic.envelope.constraints.hard),
      soft: mergeCompiledConstraints(draft.soft, deterministic.envelope.constraints.soft),
    },
    allowedActions: draft.allowedActions?.length
      ? draft.allowedActions
      : deterministic.envelope.allowedActions,
    riskProfile: {
      maxRisk: draft.riskProfile?.maxRisk ?? deterministic.envelope.riskProfile.maxRisk,
    },
  };
  const parsed = IntentEnvelopeSchema.safeParse(envelope);
  if (!parsed.success) {
    throw new FailClosedError(
      "compiler_invalid_envelope",
      `0G Router compile produced an invalid envelope: ${parsed.error.message}`,
      502,
    );
  }
  return {
    envelope: parsed.data,
    unresolvedTerms: unresolved,
    sourceText: text,
    usedModel: router.model,
    challenge: unresolved.length > 0,
    challengeReason:
      unresolved.length > 0
        ? `Ambiguous terms must be clarified, not guessed: ${unresolved.join(", ")}`
        : undefined,
  };
}
