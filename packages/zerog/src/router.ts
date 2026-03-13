import OpenAI from "openai";
import type { ComputeEvidence } from "@intentos/schema";
import { hashUtf8 } from "@intentos/schema";
import { resolveNetwork, type ZeroGNetworkName } from "./networks.js";

export type RouterConfig = {
  network: ZeroGNetworkName;
  apiKey: string;
  model: string;
  baseUrl?: string;
};

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type RouterCompletion = {
  content: string;
  evidence: ComputeEvidence;
  raw: unknown;
};

type Trace = {
  provider?: string;
  provider_address?: string;
  request_id?: string;
  tee_verified?: boolean;
  tee_attested?: boolean;
};

/**
 * The Router publishes TEE attestation per model on GET /models. Chat completions
 * currently carry no TEE flag, so the registry is the authoritative source. Cached
 * briefly so a verify does not add a second round-trip per inference call.
 */
const MODEL_REGISTRY_TTL_MS = 5 * 60_000;
const modelRegistryCache = new Map<string, { at: number; models: RouterModelInfo[] }>();

async function registryAttestation(cfg: RouterConfig): Promise<RouterModelInfo | undefined> {
  const net = resolveNetwork(cfg.network);
  const key = `${cfg.baseUrl ?? net.routerUrl}|${cfg.apiKey.slice(-6)}`;
  const hit = modelRegistryCache.get(key);
  let models = hit && Date.now() - hit.at < MODEL_REGISTRY_TTL_MS ? hit.models : undefined;
  if (!models) {
    try {
      models = routerModelsFromList(await listTeeModels(cfg));
      modelRegistryCache.set(key, { at: Date.now(), models });
    } catch {
      // Registry unreachable: fall through with no attestation rather than assuming one.
      models = hit?.models;
    }
  }
  return models?.find((m) => m.id === cfg.model);
}

function extractTrace(raw: unknown): Trace {
  if (!raw || typeof raw !== "object") return {};
  const rec = raw as Record<string, unknown>;
  const t = (rec.x_0g_trace ?? rec.x0gTrace ?? rec.trace) as Trace | undefined;
  return t ?? {};
}

export function createRouterClient(cfg: RouterConfig) {
  const net = resolveNetwork(cfg.network);
  const client = new OpenAI({
    apiKey: cfg.apiKey,
    baseURL: cfg.baseUrl ?? net.routerUrl,
    // Fail before the browser's own request timeout so the user sees a real reason.
    timeout: Number(process.env.ZEROG_ROUTER_TIMEOUT_MS ?? "90000"),
    maxRetries: 2,
  });
  return client;
}

/** The OpenAI SDK collapses every transport failure into "Connection error." */
export function describeRouterError(err: unknown, baseUrl: string): string {
  const message = err instanceof Error ? err.message : String(err);
  const codes = new Set<string>();
  let cause: unknown = (err as { cause?: unknown })?.cause;
  for (let depth = 0; cause && depth < 6; depth += 1) {
    const c = cause as { code?: unknown; errors?: unknown[]; cause?: unknown };
    if (typeof c.code === "string") codes.add(c.code);
    for (const inner of Array.isArray(c.errors) ? c.errors : []) {
      const code = (inner as { code?: unknown })?.code;
      if (typeof code === "string") codes.add(code);
    }
    cause = c.cause;
  }
  if (codes.has("ETIMEDOUT") || codes.has("ECONNREFUSED") || codes.has("ENOTFOUND")) {
    return (
      `${message} (${[...codes].join(", ")}) — could not reach the 0G Router at ${baseUrl}. ` +
      `If this is intermittent, raise NET_FAMILY_ATTEMPT_TIMEOUT_MS; Node abandons a connection ` +
      `attempt after 250ms by default.`
    );
  }
  return codes.size ? `${message} (${[...codes].join(", ")})` : message;
}

export async function chatComplete(
  cfg: RouterConfig,
  messages: ChatMessage[],
  opts?: { json?: boolean; temperature?: number },
): Promise<RouterCompletion> {
  const client = createRouterClient(cfg);
  let completion;
  try {
    completion = await client.chat.completions.create({
      model: cfg.model,
      temperature: opts?.temperature ?? 0,
      messages,
      ...(opts?.json ? { response_format: { type: "json_object" as const } } : {}),
    });
  } catch (err) {
    throw new Error(describeRouterError(err, cfg.baseUrl ?? resolveNetwork(cfg.network).routerUrl));
  }
  const content = completion.choices[0]?.message?.content ?? "";
  const raw = completion as unknown as Record<string, unknown>;
  const trace = extractTrace(raw);
  const headers =
    (raw._request_id as string | undefined) ??
    (typeof completion.id === "string" ? completion.id : undefined);

  const providerAddress = trace.provider_address ?? trace.provider;
  const requestId = trace.request_id ?? headers;

  // A provider address is not evidence of a TEE. Trust only an explicit per-request
  // flag, or the Router's published attestation for this model.
  const teeFlag = trace.tee_verified ?? trace.tee_attested;
  let teeAttested = false;
  let teeSource: ComputeEvidence["teeSource"] = "none";
  let registered: RouterModelInfo | undefined;
  if (typeof teeFlag === "boolean") {
    teeAttested = teeFlag;
    teeSource = "request_trace";
  } else {
    registered = await registryAttestation(cfg);
    if (registered?.tee_attested === true) {
      teeAttested = true;
      teeSource = "model_registry";
    }
  }

  const prompt = messages.map((m) => `${m.role}: ${m.content}`).join("\n");
  const evidence: ComputeEvidence = {
    providerAddress,
    model: cfg.model,
    requestId,
    zgResKey: (raw.zg_res_key as string | undefined) ?? undefined,
    teeAttested,
    teeSource,
    teeType: registered?.tee_type,
    teeVerifier: registered?.tee_verifier,
    verifiability: registered?.verifiability,
    promptHash: hashUtf8(prompt),
    responseHash: hashUtf8(content),
    x0gTrace: trace,
  };

  return { content, evidence, raw: completion };
}

export type RouterModelInfo = {
  id: string;
  type?: string;
  tee_attested?: boolean;
  tee_type?: string;
  tee_verifier?: string;
  verifiability?: string;
};

export function routerModelsFromList(raw: unknown): RouterModelInfo[] {
  if (!raw || typeof raw !== "object") return [];
  const data = (raw as { data?: unknown }).data;
  if (!Array.isArray(data)) return [];
  return data.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const id = (item as { id?: unknown }).id;
    if (typeof id !== "string" || !id) return [];
    const rec = item as Record<string, unknown>;
    const str = (key: string) => (typeof rec[key] === "string" ? (rec[key] as string) : undefined);
    return [
      {
        id,
        type: str("type"),
        tee_attested: typeof rec.tee_attested === "boolean" ? rec.tee_attested : undefined,
        tee_type: str("tee_type"),
        tee_verifier: str("tee_verifier"),
        verifiability: str("verifiability"),
      },
    ];
  });
}

/** Chat / JSON models only — skip image-edit endpoints. */
export function pickChatRouterModel(raw: unknown, preferred?: string): string | undefined {
  const models = routerModelsFromList(raw);
  const chat = models.filter((m) => m.type !== "image-editing" && !m.id.includes("image"));
  const pool = chat.length > 0 ? chat : models;
  if (preferred && pool.some((m) => m.id === preferred)) return preferred;
  return pool[0]?.id;
}

export async function listTeeModels(cfg: RouterConfig): Promise<unknown> {
  const net = resolveNetwork(cfg.network);
  const url = `${cfg.baseUrl ?? net.routerUrl}/models`;
  const res = await fetch(url, {
    headers: cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {},
  });
  if (!res.ok) throw new Error(`GET /models ${res.status}`);
  return res.json();
}
