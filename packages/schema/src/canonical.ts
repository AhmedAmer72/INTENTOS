import canonicalize from "canonicalize";
import { keccak256, stringToBytes } from "viem";

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
