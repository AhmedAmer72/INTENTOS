import type { IntentEnvelope, ProposedAction, VerificationResult } from "@intentos/schema";

export type IntentosClientOptions = {
  baseUrl: string;
};

export class IntentosApiError extends Error {
  status: number;
  code?: string;
  body: string;

  constructor(path: string, status: number, body: string) {
    let code: string | undefined;
    let message = `${path} ${status}: ${body}`;
    try {
      const parsed = JSON.parse(body) as { error?: string; code?: string };
      if (parsed.error) message = parsed.error;
      code = parsed.code;
    } catch {
      /* raw */
    }
    super(message);
    this.name = "IntentosApiError";
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

export function createIntentosClient(opts: IntentosClientOptions) {
  const base = opts.baseUrl.replace(/\/$/, "");

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    });
    const text = await res.text();
    if (!res.ok) throw new IntentosApiError(path, res.status, text);
    return text ? (JSON.parse(text) as T) : ({} as T);
  }

  function post<T>(path: string, body: unknown): Promise<T> {
    return request<T>(path, { method: "POST", body: JSON.stringify(body) });
  }

  return {
    ready() {
      return request<{ ok: boolean; checks: { id: string; ok: boolean }[] }>("/ready");
    },
    compile(text: string, principal: string, extra?: { playbook?: boolean; agentId?: string }) {
      return post<{ envelope: IntentEnvelope; unresolvedTerms: string[]; challenge: boolean; intentHash: string }>(
        "/compile",
        { text, principal, ...extra },
      );
    },
    propose(intent: IntentEnvelope, mode: "greedy" | "replan" = "greedy") {
      return post<{ action: ProposedAction; mode: string }>("/agent/propose", { intent, mode });
    },
    offer(requirement: IntentEnvelope, mode: "greedy" | "replan" = "greedy") {
      return post<{ action: ProposedAction; mode: string }>("/agent/offer", { requirement, mode });
    },
    verify(args: {
      intent: IntentEnvelope;
      action: ProposedAction;
      amountWei?: string;
      payer?: string;
      registerTx?: string;
      sourceText?: string;
    }) {
      return post<{ result: VerificationResult; attest?: { ok: boolean; txHash?: string }; meter?: { ok: boolean } }>(
        "/verify",
        args,
      );
    },
    verifyA2A(args: {
      requirement: IntentEnvelope;
      offer: ProposedAction;
      payer?: string;
      amountWei?: string;
      registerTx?: string;
    }) {
      return post<{ result: VerificationResult; attest?: { ok: boolean; txHash?: string } }>("/verify/a2a", args);
    },
    verifyStep(args: {
      intent: IntentEnvelope;
      action: ProposedAction;
      stepId: string;
      previousActionHashes?: string[];
      amountWei?: string;
      payer?: string;
    }) {
      return post<{ result: VerificationResult }>("/verify/step", args);
    },
    meter: {
      credits(address: string) {
        return request<{ credits: string; priceWei: string; address: string | null; configured: boolean }>(
          `/meter/${address}`,
        );
      },
    },
    proof(actionHash: string) {
      return request<unknown>(`/proof/${actionHash}`);
    },
    usage() {
      return request<{
        counts: Record<string, number>;
        verifications: unknown[];
        batches: { root: string; count: number }[];
      }>("/usage");
    },
  };
}

export type IntentosClient = ReturnType<typeof createIntentosClient>;
