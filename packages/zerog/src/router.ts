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
  });
  return client;
}

export async function chatComplete(
  cfg: RouterConfig,
  messages: ChatMessage[],
  opts?: { json?: boolean; temperature?: number },
): Promise<RouterCompletion> {
  const client = createRouterClient(cfg);
  const completion = await client.chat.completions.create({
    model: cfg.model,
    temperature: opts?.temperature ?? 0,
    messages,
    ...(opts?.json ? { response_format: { type: "json_object" as const } } : {}),
  });
  const content = completion.choices[0]?.message?.content ?? "";
  const raw = completion as unknown as Record<string, unknown>;
  const trace = extractTrace(raw);
  const headers =
    (raw._request_id as string | undefined) ??
    (typeof completion.id === "string" ? completion.id : undefined);

  const providerAddress = trace.provider_address ?? trace.provider;
  const requestId = trace.request_id ?? headers;
  const teeFlag = trace.tee_verified ?? trace.tee_attested;
  const teeAttested = typeof teeFlag === "boolean" ? teeFlag : Boolean(providerAddress);

  const prompt = messages.map((m) => `${m.role}: ${m.content}`).join("\n");
  const evidence: ComputeEvidence = {
    providerAddress,
    model: cfg.model,
    requestId,
    zgResKey: (raw.zg_res_key as string | undefined) ?? undefined,
    teeAttested,
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
};

export function routerModelsFromList(raw: unknown): RouterModelInfo[] {
  if (!raw || typeof raw !== "object") return [];
  const data = (raw as { data?: unknown }).data;
  if (!Array.isArray(data)) return [];
  return data.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const id = (item as { id?: unknown }).id;
    if (typeof id !== "string" || !id) return [];
    const type = (item as { type?: unknown }).type;
    const tee = (item as { tee_attested?: unknown }).tee_attested;
    return [
      {
        id,
        type: typeof type === "string" ? type : undefined,
        tee_attested: typeof tee === "boolean" ? tee : undefined,
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
