import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { canonicalJson, hashCanonical, hashUtf8 } from "../src/canonical.js";
import { canonicalIntentId, demoEnvelope, intentHashPayload, intentIdBytes32 } from "../src/index.js";

describe("RFC 8785 canonical JSON + keccak256", () => {
  it("sorts object keys", () => {
    expect(canonicalJson({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
  });

  it("empty object is stable", () => {
    expect(canonicalJson({})).toBe("{}");
    expect(hashUtf8("{}")).toBe(hashCanonical({}));
  });

  it("does not include integrity in the intent hash payload", () => {
    const env = demoEnvelope();
    env.integrity = {
      contentHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    };
    const payload = intentHashPayload(env);
    expect("integrity" in payload).toBe(false);
    const hash = hashCanonical(payload);
    expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("canonicalIntentId uses the envelope hash, never keccak(uuid)", () => {
    const env = demoEnvelope();
    const hash = hashCanonical(intentHashPayload(env));
    env.integrity = { contentHash: hash };
    expect(canonicalIntentId(env)).toBe(hash);
    expect(canonicalIntentId(env)).not.toBe(intentIdBytes32(env.intentId));
  });

  it("is stable across two serializations", () => {
    const env = demoEnvelope();
    const a = hashCanonical(intentHashPayload(env));
    const b = hashCanonical(intentHashPayload(structuredClone(env)));
    expect(a).toBe(b);
  });

  it("writes filled golden vectors for the Solidity HashProbe", () => {
    const cases = [
      { name: "empty-object", object: {} },
      { name: "key-order", object: { b: 2, a: 1 } },
      {
        name: "nested",
        object: {
          version: "1.0",
          intentId: "11111111-1111-1111-1111-111111111111",
          constraints: { hard: [{ type: "no_leverage" }] },
        },
      },
      { name: "demo-intent", object: intentHashPayload(demoEnvelope()) },
    ].map((c) => {
      const canonical = canonicalJson(c.object);
      return {
        name: c.name,
        object: c.object,
        canonical,
        keccak256: hashUtf8(canonical),
      };
    });

    const out = {
      comment:
        "Golden vectors: hash = keccak256(utf8(JCS(object))). Solidity HashProbe.keccakUtf8(canonical) must match.",
      cases,
    };
    writeFileSync(resolve(import.meta.dirname, "vectors.generated.json"), JSON.stringify(out, null, 2));
    expect(cases[0]?.keccak256).toMatch(/^0x[0-9a-f]{64}$/);
  });
});
