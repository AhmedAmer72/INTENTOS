import { describe, expect, it } from "vitest";
import { merkleRootOf } from "../src/storage.js";

describe("0G Storage merkle root (offline)", () => {
  it("is stable for the same bytes", async () => {
    const data = new TextEncoder().encode('{"hello":"intentos"}');
    const a = await merkleRootOf(data);
    const b = await merkleRootOf(data);
    expect(a).toBe(b);
    expect(a.startsWith("0x") || /^[0-9a-fA-F]+$/.test(a)).toBe(true);
  });

  it("changes when the payload changes", async () => {
    const a = await merkleRootOf(new TextEncoder().encode("alpha"));
    const b = await merkleRootOf(new TextEncoder().encode("beta"));
    expect(a).not.toBe(b);
  });
});
