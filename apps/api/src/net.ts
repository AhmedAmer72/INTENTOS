import net from "node:net";

/**
 * Node 20+ dials IPv6 and IPv4 in parallel and abandons an attempt after
 * `autoSelectFamilyAttemptTimeout`, which defaults to 250ms. Every outbound call
 * this service makes — 0G Compute Router, 0G Storage indexer, 0G RPC — goes through
 * undici, so on any link whose TCP+TLS handshake exceeds 250ms the whole pipeline
 * fails with an opaque `AggregateError: ETIMEDOUT` surfaced as "Connection error.".
 *
 * Measured against router-api.0g.ai: 0/3 requests succeeded at 250ms, 3/3 succeeded
 * at 5000ms (542-1264ms each).
 */
export function widenConnectionAttemptTimeout() {
  const configured = Number(process.env.NET_FAMILY_ATTEMPT_TIMEOUT_MS ?? "5000");
  const timeout = Number.isFinite(configured) && configured > 0 ? configured : 5000;
  net.setDefaultAutoSelectFamilyAttemptTimeout(timeout);
  return timeout;
}
