# Architecture

INTENTOS is an intent-verification layer. It does not replace wallets, policy engines, or agent runtimes. It answers one question:

> Did this autonomous action satisfy the human's original objective and constraints?

```
Natural language
    → Intent compiler (0G Compute Router, structured output)
    → Intent Envelope (canonical JSON, keccak256)
    → EIP-712 signature by the principal
    → IntentRegistry on 0G Chain (hash only)
    → Live 0G Compute agent proposes an action (greedy or replan)
    → Layer 1 deterministic rules (no LLM)
    → Layer 2 semantic alignment (0G Router, TEE)
    → Layer 3 intent→plan→action consistency
    → Verdict: APPROVE | REJECT | CHALLENGE
    → Evidence blob on 0G Storage
    → Oracle attestation on IntentRegistry
    → DemoVault.deposit() gated by isApproved
       or IntentExecutor.execute() after challenge delay (Wave 6)
    → Intent Certificate
    → optional: meter debit, IntentBounty claim, ERC-8004 giveFeedback, CertificateConsumer.accept
```

## Packages

| Package | Role |
| --- | --- |
| `@intentos/schema` | Zod schemas, RFC 8785 JCS, keccak hashing, EIP-712 types |
| `@intentos/rules-engine` | Pure deterministic constraint evaluators |
| `@intentos/verifier` | Compiler, layers 2–3, monotonic verdict engine |
| `@intentos/zerog` | Storage, Compute Router, chain clients |
| `@intentos/agent-sdk` | Reference agent + HTTP client |
| `@intentos/contracts` | IntentRegistry, DemoVault, VerificationMeter, CertificateConsumer, IntentosAgenticId, IntentExecutor, IntentBounty, IntentosAgenticIdV2 |
| `@intentos/api` | Fastify compile / verify / certificate |
| `@intentos/web` | Vite + Tailwind studio + public proof page |

## Trust model (Wave 3)

Not fully trustless. Stated so judges are not sold a fiction.

| Layer | Trust |
| --- | --- |
| Hard constraints | None — pure functions, unit-tested |
| Intent commitment | Cryptographic (EIP-712 + keccak of JCS) |
| Evidence integrity | 0G Storage merkle root, re-hashable client-side |
| Semantic alignment | TEE-attested 0G Compute inference; captured as evidence |
| Verdict posting | Known `VERIFIER_ROLE` oracle key |
| Settlement | On-chain `isApproved` + `settlementBinding` (DemoVault) or executor binding (IntentExecutor) |

The LLM **cannot** authorize funds. `DemoVault` and `IntentExecutor` read the registry, not the model. Layer 1 hard failures are a terminal `REJECT`; Layer 2 may only downgrade `APPROVE` → `CHALLENGE`. Verify refuses to `recordVerification` unless Layer 2 `computeEvidence.teeAttested` is true (0G `provider_address` counts as TEE when the Router omits the boolean).

Compiled envelopes are uploaded to 0G Storage (`envelopeRoot`). `GET /envelope/:intentId` re-downloads and re-hashes the JCS payload against `intentHash`.

## Why 0G DA is not used

DA blob submission requires a self-hosted DA Client + GPU Encoder + Retriever. No mainnet `DAEntrance` is published. Execution traces that outgrow chain state are batched onto 0G Storage instead. See the Wave 4 note in the README.

## Why ERC-8004 plus a thin ERC-7857 minter

IdentityRegistry is already live on Galileo (`0x8004A818BFB912233c491871b3d84c89A494BD9e`) and mainnet. INTENTOS binds `principal + agentId + intentHash` to that registry (agent `361` on Galileo).

0G’s example Agentic ID (`0x2700F6A3e505402C9daB154C5c6ab9cAEC98EF1F`) has owner-only `mint`, so Galileo Wave 4–5 deploys **IntentosAgenticId** (v1, historical). Wave 6 adds **IntentosAgenticIdV2** with oracle-gated `transfer` / `clone`. Do not upgrade v1. Metadata must include ERC-8004 `agentId: 361`.

## Wave 4–5 surfaces (Galileo only)

Do **not** redeploy live `IntentRegistry` (`0xfdDe66249e140aCbF36B65a801A9de58bF8a7Fb9`) or `DemoVault` (`0x8F0F527c299bA7085AE258fdB5D32b4E52AE6Cf6`). Deploy only `VerificationMeter`, `CertificateConsumer`, and `IntentosAgenticId` via `pnpm contracts:deploy:wave45:galileo`.

| Surface | Role |
| --- | --- |
| `/studio` | Human gate + meter deposit + reputation + present |
| `/market` | Agent A requirement → Agent B greedy REJECT → replan APPROVE |
| `/playbook` | Two-step intent; step 2 blocked until step 1 isApproved |
| `/console` | Usage index + append-only Storage batch log |
| `examples/sdk-a2a.mts` | Same A2A path without the UI |

## Wave 6 surfaces (Galileo only)

Do **not** redeploy live `IntentRegistry` or `DemoVault`. Do **not** redeploy Wave 4–5 meter / consumer / Agentic ID v1.

```bash
pnpm contracts:deploy:wave6:galileo
pnpm --filter @intentos/contracts mint-agentic-id-v2:galileo
```

That script requires `INTENT_REGISTRY_ADDRESS` and deploys only `IntentExecutor`, `SettlementTarget`, `IntentBounty`, and `IntentosAgenticIdV2`. Merge addresses into `packages/contracts/deployments/galileo.json` and `.env`.

| Surface | Role |
| --- | --- |
| Studio Verify checkbox | Optional `execute: true` binds `executorBinding` instead of DemoVault |
| Studio Proof | Deposit stays the judge demo; Execute appears when `verify.executor` is set |
| `/market` | IntentBounty fund after verify, claim after A2A APPROVE (A2A Pay). Router deposit remains Payment Layer |
| `/console` | Agentic ID v2 oracle-gated transfer |
| `GET /envelope/:id` | Re-download compiled JCS envelope and compare to `intentHash` |
| `POST /agentic/v2/proof` | Oracle EIP-712 proof for v2 transfer/clone |

DemoVault.deposit remains the spoken judge demo (greedy `IntentNotApproved` revert). IntentExecutor is the generic settlement rail: one APPROVE binding unlocks one `target.call` after a 900s challenge delay.

## Solidity

Contracts compile with **0.8.24 + `evmVersion: cancun` + `viaIR`**. solc 0.8.19 cannot encode Cancun; 0G Chain is Cancun. `viaIR` is required to compile `IntentRegistry.recordVerification` without a stack-too-deep error.
