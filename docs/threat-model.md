# Threat model

Wave 3 mitigations. Residual risk is listed, not hidden.

## Malicious agent

The agent proposes an action that violates the intent (greedy 0G Compute mode in the demo).

**Mitigation.** Layer 1 evaluates hard constraints deterministically. `DemoVault.deposit` reverts with `IntentNotApproved` unless a matching `APPROVE` attestation exists for that `actionHash`.

## Prompt injection

Agent plan text or protocol metadata tries to rewrite the verifier prompt.

**Mitigation.** Layer 2 wraps agent content in `BEGIN_ACTION_JSON` / `END_ACTION_JSON`. The system prompt states that the user message is data, not instructions. Agent text is never concatenated into the system prompt.

## Intent poisoning

The envelope is altered after the human signed it.

**Mitigation.** `registerIntent` recovers the principal from an EIP-712 signature over `intentHash`. Any edit changes the JCS canonicalization and the hash. Intents are immutable; a change is a new `intentId`.

## Evidence tampering

Someone swaps the stored evidence after verification.

**Mitigation.** `evidenceRoot` is anchored on-chain. The proof page re-downloads (or re-hashes the indexed copy) and compares. A 0G Storage merkle root cannot be silently replaced without a new on-chain record.

## Replay

An old valid intent or attestation is reused.

**Mitigation.** EIP-712 domain binds `chainId` + `verifyingContract`. Per-principal `principalNonce` on register. Per-intent `intentNonce` on verify. `expiresAt` on every intent. Attestation `expiry`.

## Hash substitution

The action shown to the verifier differs from the one settled.

**Mitigation.** Settlement is keyed on `actionHash` (keccak of the full `ProposedAction`, which includes capital, duration, leverage, protocol). `DemoVault` additionally requires `settlementBinding == keccak256(abi.encode(intentId, actionHash, msg.value))` as attested by the oracle. Changing `msg.value` after approval reverts `BindingMismatch`. `IntentExecutor` uses a different binding: `keccak256(abi.encode(intentId, actionHash, target, keccak256(calldata), value))`. One verify = one binding (vault **or** executor). Executor also waits `challengeDelay` (900s) so the principal can `invalidateIntent`.

## Semantic manipulation

The model is induced to treat a violated constraint as aligned.

**Mitigation.** Monotonic veto: if any hard constraint `FAIL`s, verdict is `REJECT` regardless of Layer 2 scores. Covered by `packages/verifier/test/verdict.test.ts`.

## Oracle compromise

The `VERIFIER_ROLE` key signs a dishonest `APPROVE`.

**Residual.** Acknowledged. Wave 3 does not make the oracle trustless. Detectability: TEE evidence + the evidence bundle let a third party replay Layer 1 locally and see the contradiction. Path forward: move attestation inside attested 0G Compute.

## Agent identity substitution

A different agent acts under another id.

**Mitigation.** Envelope binds `agent.agenticId`. Verification attestation binds the same `agentId`. Registry rejects a mismatch (`HashMismatch`). Ids come from ERC-8004 IdentityRegistry, not a homemade NFT.

## Human ambiguity

The request cannot be compiled without guessing.

**Mitigation.** Ambiguous terms (`some`, `best`, missing amounts) produce `CHALLENGE` and `unresolvedTerms`. The compiler must not invent a `max_capital` the user never stated.

## LLM authorizing funds

**Mitigation.** Principle 1. `DemoVault` and `IntentExecutor` never read model output. Only `IntentRegistry.isApproved` plus the attested binding. Layer 2 without TEE evidence never reaches `recordVerification`.

## Agentic ID transfer / 7857 re-encryption

**Mitigation (v2).** `IntentosAgenticIdV2` requires an oracle EIP-712 proof for `transfer` and `clone`. v1 on Galileo is left as historical.

**Residual.** Full TEE re-encryption of the AES key on transfer is still out of scope. Same URI/hash is allowed when no new key is issued. The oracle can still attest a dishonest transfer.

## Intent envelope substitution

**Mitigation.** Compile uploads `intentHashPayload(envelope)` to 0G Storage. `GET /envelope/:intentId` re-hashes the blob against `intentHash`. Evidence bundles include `envelopeRoot`.

## Self-feedback on ERC-8004

The agent owner cannot `giveFeedback` on their own agent. Studio refuses when the connected wallet is the IdentityRegistry owner of that token id.
