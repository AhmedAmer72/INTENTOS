import { encodeAbiParameters, keccak256, stringToHex } from "viem";

export const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

export function toBytes32AgentId(value: string): `0x${string}` {
  if (/^0x[0-9a-fA-F]{64}$/.test(value)) return value as `0x${string}`;
  if (/^\d+$/.test(value)) {
    return `0x${BigInt(value).toString(16).padStart(64, "0")}` as `0x${string}`;
  }
  return keccak256(stringToHex(value));
}

export function intentIdBytes32(intentId: string): `0x${string}` {
  if (/^0x[0-9a-fA-F]{64}$/.test(intentId)) return intentId as `0x${string}`;
  return keccak256(stringToHex(intentId));
}

export function settlementBinding(args: {
  intentId: `0x${string}`;
  actionHash: `0x${string}`;
  amount: bigint;
}): `0x${string}` {
  return keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "bytes32" }, { type: "uint256" }],
      [args.intentId, args.actionHash, args.amount],
    ),
  );
}

export function executorBinding(args: {
  intentId: `0x${string}`;
  actionHash: `0x${string}`;
  target: `0x${string}`;
  calldata: `0x${string}`;
  value: bigint;
}): `0x${string}` {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "address" },
        { type: "bytes32" },
        { type: "uint256" },
      ],
      [args.intentId, args.actionHash, args.target, keccak256(args.calldata), args.value],
    ),
  );
}
