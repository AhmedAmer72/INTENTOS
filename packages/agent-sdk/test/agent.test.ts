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
import { proposeAction } from "../src/index.js";

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
});
