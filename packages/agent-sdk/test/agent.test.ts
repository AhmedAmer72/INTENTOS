import { beforeEach, describe, expect, it, vi } from "vitest";
import { demoEnvelope, hashUtf8, strategyB } from "@intentos/schema";

vi.mock("@intentos/zerog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@intentos/zerog")>();
  return {
    ...actual,
    chatComplete: vi.fn(),
  };
});

import { chatComplete } from "@intentos/zerog";
import { clampReplanToEnvelope, proposeAction } from "../src/index.js";

const mocked = vi.mocked(chatComplete);

const router = { network: "galileo" as const, apiKey: "sk-test", model: "test-model" };

describe("live 0G agent", () => {
  beforeEach(() => {
    mocked.mockReset();
  });

  it("refuses to propose without a Router key", async () => {
    const intent = demoEnvelope();
    await expect(
      proposeAction(intent, "greedy", { ...router, apiKey: "" }),
    ).rejects.toMatchObject({ name: "FailClosedError", code: "missing_router_key" });
    expect(mocked).not.toHaveBeenCalled();
  });

  it("parses a Router JSON proposal and stamps intent/agent ids", async () => {
    const intent = demoEnvelope();
    const template = strategyB(intent.intentId, intent.agent.agenticId);
    mocked.mockResolvedValue({
      content: JSON.stringify({
        actionType: template.actionType,
        params: template.params,
        plan: template.plan,
        estimatedOutcome: template.estimatedOutcome,
      }),
      evidence: {
        model: "test-model",
        teeAttested: false,
        promptHash: hashUtf8("p"),
        responseHash: hashUtf8("r"),
      },
      raw: {},
    });
    const out = await proposeAction(intent, "greedy", router);
    expect(out.mode).toBe("greedy");
    expect(out.action.params.capital).toBe(8000);
    expect(out.action.intentId).toBe(intent.intentId);
    expect(out.action.agentId).toBe(intent.agent.agenticId);
    expect(mocked).toHaveBeenCalledTimes(1);
  });

  it("clamps a replan that still violates hard caps", async () => {
    const intent = demoEnvelope();
    const template = strategyB(intent.intentId, intent.agent.agenticId);
    mocked.mockResolvedValue({
      content: JSON.stringify({
        actionType: "leverage",
        params: { ...template.params, capital: 80_000, leverage: true, riskClass: "HIGH", durationDays: 90 },
        plan: template.plan,
        estimatedOutcome: template.estimatedOutcome,
      }),
      evidence: {
        model: "test-model",
        teeAttested: false,
        promptHash: hashUtf8("p"),
        responseHash: hashUtf8("r"),
      },
      raw: {},
    });
    const out = await proposeAction(intent, "replan", router);
    expect(out.mode).toBe("replan");
    expect(out.action.params.capital).toBe(5000);
    expect(out.action.params.leverage).toBe(false);
    expect(out.action.params.riskClass).toBe("LOW");
    expect(out.action.params.durationDays).toBe(14);
    expect(out.action.actionType).toBe("deposit");
    expect(clampReplanToEnvelope(intent, template).params.capital).toBe(5000);
  });
});
