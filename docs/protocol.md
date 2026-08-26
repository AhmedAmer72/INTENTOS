# Protocol

## Hashes

All document hashes:

```
keccak256(utf8(RFC8785_JCS(object)))
```

`integrity` is excluded from the intent hash payload so the hash can be written back onto the envelope.

Golden vectors: `packages/schema/test/hash.test.ts` and Solidity `HashProbe` in `packages/contracts/test/HashVectors.ts`.

## Intent registration (EIP-712)

Domain: `INTENTOS IntentRegistry` / `1` / `chainId` / `verifyingContract`.

Type `IntentRegistration(bytes32 intentHash,address principal,bytes32 agentId,uint64 createdAt,uint64 expiresAt,uint256 nonce)`.

`intentId` on chain **is** `intentHash`.

## Verification attestation (EIP-712)

Type `VerificationAttestation(bytes32 intentId,bytes32 intentHash,bytes32 agentId,bytes32 actionHash,bytes32 evidenceRoot,uint8 verdict,uint16 alignmentBps,uint16 confidenceBps,uint256 nonce,uint64 expiry,bytes32 settlementBinding)`.

Verdict enum: `0 NONE`, `1 APPROVE`, `2 REJECT`, `3 CHALLENGE`.

`settlementBinding = keccak256(abi.encode(intentId, actionHash, amount))`.

## Settlement

`DemoVault.deposit(intentId, actionHash) payable`:

1. `registry.isApproved(intentId, actionHash)` else `IntentNotApproved`
2. `keccak256(abi.encode(intentId, actionHash, msg.value))` equals stored binding else `BindingMismatch`
3. one-shot per `(intentId, actionHash)`

## Verdict engine

```
if any hard FAIL → REJECT   // terminal, LLM cannot override
else
  alignment = L2.skipped ? L3.alignment : L2.alignment
  confidence = L2.skipped ? (L3 clean ? 0.85 : 0.5) : L2.confidence
  if alignment < 0.75 or confidence < 0.7 → CHALLENGE
  else APPROVE
```

Thresholds live in `DEFAULT_VERDICT_THRESHOLDS` only.
