import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

/**
 * Compile, propose, and verify each spend real money: 0G Compute inference on the
 * operator's Router key, a 0G Storage upload, and an on-chain attestation paid by
 * the oracle wallet. The API is public and unauthenticated, so a fixed-window
 * per-IP cap is the cheapest thing standing between the deploy and a drained
 * oracle. Deliberately in-process: one API instance, no shared cache to operate.
 */
type Window = { count: number; resetAt: number };

const WINDOW_MS = 60_000;

export type RateLimitOptions = {
  /** Requests per minute per IP on the paid routes. */
  limit: number;
  /** Routes exempt from the cap, e.g. loopback smoke tests. */
  exemptIps?: string[];
};

export function rateLimitOptionsFromEnv(): RateLimitOptions {
  const raw = Number(process.env.RATE_LIMIT_PER_MIN ?? "30");
  const limit = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 30;
  const exemptIps = (process.env.RATE_LIMIT_EXEMPT_IPS ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  return { limit, exemptIps };
}

const PAID_ROUTES = [
  "/compile",
  "/agent/propose",
  "/verify",
  "/a2a/verify",
  "/playbook/verify",
  "/agentic-id/transfer",
];

function isPaidRoute(url: string) {
  const path = url.split("?")[0] ?? url;
  return PAID_ROUTES.includes(path);
}

export function registerRateLimit(app: FastifyInstance, options: RateLimitOptions) {
  const windows = new Map<string, Window>();

  // Bounded memory: a window is only kept while it is live.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, win] of windows) if (win.resetAt <= now) windows.delete(key);
  }, WINDOW_MS).unref?.();
  void sweep;

  app.addHook("onRequest", async (req: FastifyRequest, reply: FastifyReply) => {
    if (req.method !== "POST" || !isPaidRoute(req.url)) return;
    const ip = req.ip;
    if (options.exemptIps?.includes(ip)) return;

    const now = Date.now();
    const key = ip;
    const win = windows.get(key);
    if (!win || win.resetAt <= now) {
      windows.set(key, { count: 1, resetAt: now + WINDOW_MS });
      return;
    }
    win.count += 1;
    if (win.count > options.limit) {
      const retryAfter = Math.max(1, Math.ceil((win.resetAt - now) / 1000));
      reply.header("retry-after", String(retryAfter));
      return reply.code(429).send({
        error: `Too many verification requests from this address. Retry in ${retryAfter}s.`,
        code: "rate_limited",
      });
    }
  });
}
