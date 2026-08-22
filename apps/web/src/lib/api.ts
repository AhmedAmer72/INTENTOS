export const API = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8787";

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

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new ApiError(path, res.status, text);
  return text ? (JSON.parse(text) as T) : ({} as T);
}

export function short(v?: string | null, n = 4) {
  if (!v) return "—";
  if (v.length < 12) return v;
  return `${v.slice(0, n + 2)}…${v.slice(-n)}`;
}
