import { describe, expect, it } from "vitest";
import { hashUtf8 } from "@intentos/schema";
import type { ComputeEvidence } from "@intentos/schema";

describe("router evidence capture shape", () => {
  it("hashes prompt and response independently of provider headers", () => {
    const prompt = "system: x\nuser: y";
    const response = '{"alignmentScore":0.9}';
    const evidence: ComputeEvidence = {
      model: "test-model",
      teeAttested: true,
      promptHash: hashUtf8(prompt),
      responseHash: hashUtf8(response),
      providerAddress: "0xabc",
      requestId: "req_1",
      zgResKey: "zg-key",
    };
    expect(evidence.promptHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(evidence.responseHash).not.toBe(evidence.promptHash);
    expect(evidence.teeAttested).toBe(true);
  });
});
