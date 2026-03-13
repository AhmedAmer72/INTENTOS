const configuredApi = import.meta.env.VITE_API_URL?.trim();

/**
 * A production bundle must never silently talk to the developer's loopback API.
 * Loopback stays the dev default; a misconfigured production build surfaces the
 * problem on every request instead of quietly failing against 127.0.0.1.
 */
export const API_MISCONFIGURED = !configuredApi && !import.meta.env.DEV;

export const API_CONFIG_ERROR =
  "VITE_API_URL is not set for this build. Point it at the INTENTOS API origin and redeploy — " +
  "a production bundle will not fall back to http://127.0.0.1:8787.";

export const API = configuredApi || "http://127.0.0.1:8787";

export class ApiError extends Error {
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
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

export async function api<T>(path: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  if (API_MISCONFIGURED) throw new Error(API_CONFIG_ERROR);
  const { timeoutMs = 180_000, signal: outer, ...rest } = init ?? {};
  const ac = new AbortController();
  const onAbort = () => ac.abort();
  outer?.addEventListener("abort", onAbort);
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(`${API}${path}`, {
      ...rest,
      signal: ac.signal,
      headers: { "content-type": "application/json", ...(rest.headers ?? {}) },
    });
    const text = await res.text();
    if (!res.ok) throw new ApiError(path, res.status, text);
    return text ? (JSON.parse(text) as T) : ({} as T);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(
        `${path} timed out after ${Math.round(timeoutMs / 1000)}s. Verify runs 0G Compute, Storage, and an on-chain attest — retry once. If Render is on the free plan, a 30s platform cutoff can kill the request.`,
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener("abort", onAbort);
  }
}

export function short(v?: string | null, n = 4) {
  if (!v) return "—";
  if (v.length < 12) return v;
  return `${v.slice(0, n + 2)}…${v.slice(-n)}`;
}
