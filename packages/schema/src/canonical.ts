import canonicalizeExport from "canonicalize";
import { keccak256, stringToBytes } from "viem";

type Canonicalize = (input: unknown) => string | undefined;

// canonicalize is CJS (`module.exports = fn`) but ships an ESM-shaped `.d.ts`.
// Under NodeNext the default import therefore lands on the namespace object,
// while bundlers hand back the function itself. Accept both.
const canonicalize: Canonicalize =
  typeof canonicalizeExport === "function"
    ? (canonicalizeExport as Canonicalize)
    : ((canonicalizeExport as { default: Canonicalize }).default);

/** RFC 8785 JCS canonical JSON. Throws if canonicalize returns undefined. */
export function canonicalJson(value: unknown): string {
  const out = canonicalize(value);
  if (typeof out !== "string") {
    throw new Error("canonicalize produced no output");
  }
  return out;
}

/**
 * keccak256(utf8(JCS(value)))
 * This is the only hashing function used for intent/action/evidence hashes.
 */
export function hashCanonical(value: unknown): `0x${string}` {
  return keccak256(stringToBytes(canonicalJson(value)));
}

export function hashUtf8(text: string): `0x${string}` {
  return keccak256(stringToBytes(text));
}
