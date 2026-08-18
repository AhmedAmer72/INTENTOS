import { afterAll, describe, expect, it, vi } from "vitest";
import { DEMO_INTENT_TEXT, demoEnvelope } from "@intentos/schema";

vi.stubEnv("ZEROG_ROUTER_API_KEY", "");
vi.stubEnv("AGENT_ID", "");
vi.stubEnv("ZEROG_STORAGE_UPLOAD", "");
vi.stubEnv("INTENT_REGISTRY_ADDRESS", "");
vi.stubEnv("DEMO_VAULT_ADDRESS", "");
vi.stubEnv("DEPLOYER_PRIVATE_KEY", "");
vi.stubEnv("VERIFIER_ORACLE_PRIVATE_KEY", "");
vi.resetModules();

const { buildServer } = await import("../src/app.js");

describe("API fail-closed without live 0G", () => {
  const appP = buildServer();

  afterAll(async () => {
    const app = await appP;
    await app.close();
  });

  it("GET /ready reports missing live dependencies", async () => {
    const app = await appP;
    const res = await app.inject({ method: "GET", url: "/ready" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.ok).toBe(false);
    expect(Array.isArray(body.checks)).toBe(true);
    expect(body.checks.some((c: { id: string }) => c.id === "router_key")).toBe(true);
  });

  it("POST /compile without a principal is 400", async () => {
    const app = await appP;
    const res = await app.inject({
      method: "POST",
      url: "/compile",
      payload: { text: DEMO_INTENT_TEXT },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("principal_required");
  });

  it("POST /compile with a fake 0x1111 principal is 400", async () => {
    const app = await appP;
    const res = await app.inject({
      method: "POST",
      url: "/compile",
      payload: {
        text: DEMO_INTENT_TEXT,
        principal: "0x1111111111111111111111111111111111111111",
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("principal_required");
  });

  it("POST /compile with a wallet still refuses without Router / AGENT_ID", async () => {
    const app = await appP;
    const res = await app.inject({
      method: "POST",
      url: "/compile",
      payload: {
        text: DEMO_INTENT_TEXT,
        principal: "0x66d0251da78C3905E25ABa98c0198DFaD1BDC7CF",
      },
    });
    expect([503, 502]).toContain(res.statusCode);
    expect(typeof res.json().code).toBe("string");
  });

  it("POST /agent/propose refuses canned Strategy A/B without Router", async () => {
    const app = await appP;
    const res = await app.inject({
      method: "POST",
      url: "/agent/propose",
      payload: {
        mode: "greedy",
        intent: demoEnvelope(),
      },
    });
    expect(res.statusCode).toBe(503);
    expect(res.json().code).toBe("missing_router_key");
  });

  it("POST /verify refuses without Router / storage", async () => {
    const app = await appP;
    const res = await app.inject({
      method: "POST",
      url: "/verify",
      payload: { intent: {}, action: {} },
    });
    expect([400, 503]).toContain(res.statusCode);
  });
});
