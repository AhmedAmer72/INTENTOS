# INTENTOS

**Keep the truth. Revert the rest.**

Intent verification for autonomous AI on [0G](https://0g.ai). Humans write what must remain true. Agents may choose how. Before a protected action settles, INTENTOS compiles, verifies, and either attests an `APPROVE` or lets settlement revert on-chain.

A transaction that is technically valid but intent-violating is still a violation.

INTENTOS is not a wallet, a copilot, a trading bot, a firewall, or a policy dashboard. It answers one question: **did this action satisfy the original intent?**

| | |
| --- | --- |
| **Network (live)** | 0G Galileo testnet · chain `16602` |
| **Explorer** | [chainscan-galileo.0g.ai](https://chainscan-galileo.0g.ai) |
| **Stack** | pnpm monorepo · Node 22 · TypeScript · Vite · Fastify · Prisma · Solidity 0.8.24 (Cancun) |
| **License** | MIT |

---

## What it does

1. **Compile** — Natural language becomes a structured Intent Envelope (hard/soft constraints, duration, leverage, capital). Ambiguity is a `CHALLENGE`, never a guessed number.
2. **Anchor** — The principal EIP-712-signs the envelope. Only `keccak256` of RFC 8785 canonical JSON goes on `IntentRegistry`.
3. **Plan** — A live 0G Compute agent proposes an action in `greedy` (maximize yield) or `replan` (stay inside the envelope) mode.
4. **Verify** — Four layers, fail-closed: deterministic rules, TEE-backed semantics, plan/action consistency, 0G Storage evidence. Verdict is `APPROVE`, `REJECT`, or `CHALLENGE`.
5. **Settle or revert** — `DemoVault.deposit` reads `isApproved` plus a settlement binding over intent, action, and `msg.value`. Greedy violations revert with `IntentNotApproved`. Compliant replans settle. Every verdict can mint a public certificate.

There is no regex-only or offline demo path. Missing Router, Storage, contracts, or a real principal wallet surfaces as `503` / `502` and a red Live 0G rail.

---

## Product surfaces

| Route | Role |
| --- | --- |
| `/` | Marketing landing |
| `/studio` | Human gate: compile → register → greedy REJECT → replan APPROVE → deposit → certificate |
| `/market` | Agent-to-agent. Agent A publishes a requirement; Agent B pays the same gate |
| `/playbook` | Multi-step intent. Step *N* is blocked until `1…N-1` are `isApproved` |
| `/console` | Usage index, meter debits, append-only 0G Storage batch log, Live 0G stack |
| `/proof/:hash` | Public certificate, Present (`CertificateConsumer.accept`), ERC-8004 `giveFeedback` |

---

## Live Galileo deployment

Do **not** redeploy `IntentRegistry` or `DemoVault`. Wave 4–5 added meter, consumer, and Agentic ID v1. Wave 6 adds executor, bounty, and Agentic ID v2 via `pnpm contracts:deploy:wave6:galileo` (script refuses to deploy registry/vault).

| Contract | Address |
| --- | --- |
| IntentRegistry | [`0xfdDe66249e140aCbF36B65a801A9de58bF8a7Fb9`](https://chainscan-galileo.0g.ai/address/0xfdDe66249e140aCbF36B65a801A9de58bF8a7Fb9) |
| DemoVault | [`0x8F0F527c299bA7085AE258fdB5D32b4E52AE6Cf6`](https://chainscan-galileo.0g.ai/address/0x8F0F527c299bA7085AE258fdB5D32b4E52AE6Cf6) |
| VerificationMeter | [`0x160046e7d8b6497d77F0eAdD6C20eb14A158753d`](https://chainscan-galileo.0g.ai/address/0x160046e7d8b6497d77F0eAdD6C20eb14A158753d) |
| CertificateConsumer | [`0x13B90C0563Aa98015793aC4e0F3F4379950b1208`](https://chainscan-galileo.0g.ai/address/0x13B90C0563Aa98015793aC4e0F3F4379950b1208) |
| IntentosAgenticId | [`0x4F4d5ad11616fE14dbBA1aA88A4EC800C162a4Fc`](https://chainscan-galileo.0g.ai/address/0x4F4d5ad11616fE14dbBA1aA88A4EC800C162a4Fc) token `#1` |
| IntentExecutor | [`0xDfa18235Be977759eA81432234386B8cA086Bd12`](https://chainscan-galileo.0g.ai/address/0xDfa18235Be977759eA81432234386B8cA086Bd12) |
| SettlementTarget | [`0x0066F84EADB94064F3d91624348ba2c72d303116`](https://chainscan-galileo.0g.ai/address/0x0066F84EADB94064F3d91624348ba2c72d303116) |
| IntentBounty | [`0x25cB00682e345504d4EDC146CedF4CC31fc1816E`](https://chainscan-galileo.0g.ai/address/0x25cB00682e345504d4EDC146CedF4CC31fc1816E) |
| IntentosAgenticIdV2 | [`0x197C8750560a0b925401eF0F4fDDc0182f18A971`](https://chainscan-galileo.0g.ai/address/0x197C8750560a0b925401eF0F4fDDc0182f18A971) token `#1` |
| ERC-8004 Identity (0G) | [`0x8004A818BFB912233c491871b3d84c89A494BD9e`](https://chainscan-galileo.0g.ai/address/0x8004A818BFB912233c491871b3d84c89A494BD9e) · agent **361** (Agent B), **362** (requirement / Agent A) |
| ERC-8004 Reputation (0G) | [`0x8004B663056A597Dffe9eCcC1965A193B7388713`](https://chainscan-galileo.0g.ai/address/0x8004B663056A597Dffe9eCcC1965A193B7388713) |

Verify price: `100000000000000` wei (0.0001 0G) per `/verify`, including `REJECT`.

0G Mainnet (Aristotle, `16661`) registry/vault deploy is not done. Official Identity / Reputation addresses are in `.env.example`. See [docs/mainnet-deploy.md](docs/mainnet-deploy.md).

---

## How verification works

```
Natural language
  → 0G Compute compile (structured envelope)
  → EIP-712 sign + IntentRegistry.registerIntent (hash only)
  → Agent propose (greedy | replan) on 0G Compute
  → Layer 1  deterministic hard constraints (terminal REJECT on FAIL)
  → Layer 2  TEE-backed semantics (fail-closed if not teeAttested; may only downgrade APPROVE → CHALLENGE)
  → Layer 3  intent ↔ plan ↔ action consistency
  → Envelope + evidence upload to 0G Storage (merkle roots)
  → VerificationMeter.debit (if configured)
  → Oracle recordVerification on IntentRegistry
  → DemoVault.deposit  or  IntentExecutor.execute  or  IntentNotApproved
  → Certificate · optional Present · optional ERC-8004 feedback · optional IntentBounty claim
```

**Fail-closed rules**

- No compile without Router + a real principal wallet.
- No verify without Router, Storage upload, and meter credits once the meter is configured.
- Layer 1 hard `FAIL` cannot be overruled by the model.
- `DemoVault` never reads model output. The gate is `isApproved` plus `settlementBinding = keccak256(intentId, actionHash, msg.value)`.
- `IntentExecutor` uses a different binding (`intentId, actionHash, target, keccak(calldata), value`) and a 900s challenge delay. One verify = one binding.
- Layer 2 without TEE evidence never calls `recordVerification` (`tee_required`).
- `giveFeedback` must be sent by the **principal**, not the agent owner (self-feedback reverts).
- `CertificateConsumer.accept` is one-shot; a second present reverts `AlreadyConsumed`.

---

## 0G components

| Layer | Use |
| --- | --- |
| **Chain** | IntentRegistry, DemoVault, VerificationMeter, CertificateConsumer, IntentosAgenticId, IntentExecutor, IntentBounty, IntentosAgenticIdV2. Solidity **0.8.24**, `evmVersion: cancun`, `viaIR`. |
| **Compute** | Router (`qwen2.5-omni`, TEE-attested chat). Compile, propose, Layer 2. Not the deprecated serving-broker. |
| **Storage** | Compiled envelopes, evidence blobs, and encrypted 7857 metadata via `@0gfoundation/0g-storage-ts-sdk`. |
| **ERC-8004** | Live Identity + Reputation. Agent ids 361 / 362 on Galileo. |
| **ERC-7857-shaped** | v1 historical mint. v2 oracle-gated `transfer` / `clone`. Metadata includes `agentId: 361`. |
| **Payment** | Router deposit = Payment Layer (Compute). `VerificationMeter` = per-verify prepaid 0G. `IntentBounty` = A2A Pay after APPROVE. |
| **DA** | Deferred. No published mainnet `DAEntrance`. Execution traces batch to 0G Storage (`GET /log`, flush every 3 events). |

---

## Repository

```
apps/web                 Vite + React + Tailwind  — landing, studio, market, playbook, console, proof
apps/api                 Fastify + Prisma         — compile, verify, certificates, meter, log
packages/schema          Zod, JCS, keccak, EIP-712
packages/rules-engine    Deterministic constraint evaluators
packages/verifier        Compiler, layers 2–3, monotonic verdict
packages/zerog           Storage, Router, chain clients
packages/agent-sdk       HTTP client + reference agent (`example:a2a`)
packages/contracts       Hardhat 0.8.24 + Galileo / Wave 4–5 scripts
docs/                    Architecture, threats, judge path, deploy
scripts/                 Wallet provision + balances
```

---

## HTTP API

Base URL local: `http://127.0.0.1:8787`. CORS is open (`origin: true`).

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness |
| `GET` | `/ready` | Fail-closed probe (Router, Storage, contracts, keys, meter, 7857, …) |
| `GET` | `/meta` | Network, addresses, model |
| `POST` | `/compile` | Natural language → envelope (uploads JCS payload when Storage is on) |
| `GET` | `/envelope/:intentId` | Re-download envelope root and compare to `intentHash` |
| `POST` | `/agent/propose` | Greedy or replan action |
| `POST` | `/agent/offer` | Stamp an offer with Agent B id |
| `POST` | `/verify` | Human-gated verify + attest |
| `POST` | `/verify/a2a` | Agent-to-agent verify |
| `POST` | `/verify/step` | Step *N* only if `1…N-1` are approved |
| `GET` | `/certificate/action/:actionHash` | Certificate by action |
| `GET` | `/proof/:actionHash` | Proof payload for the UI |
| `POST` | `/settle` | Record a settlement tx |
| `POST` | `/attest` | Oracle attestation helper |
| `GET` | `/meter/:address` | Prepaid credits |
| `GET` | `/usage` | Verdict counts, meter, recent verifies |
| `GET` | `/log` | Storage batch heads |
| `POST` | `/log/flush` | Force batch upload |
| `POST` | `/reputation` | Persist `giveFeedback` tx |
| `POST` | `/agentic/v2/proof` | Oracle EIP-712 proof for Agentic ID v2 transfer/clone |

SDK: `@intentos/agent-sdk` — `verify`, `verifyA2A`, `verifyStep`, `meter.credits`, `usage`, `proof`.

---

## Prerequisites

- Node.js **≥ 22** (see `.nvmrc`)
- [pnpm](https://pnpm.io) **10.28.2** (`packageManager` field; Corepack is enough)
- A browser wallet on Galileo (MetaMask will be prompted to add chain `16602`)
- 0G testnet 0G for gas, meter deposits, and Router inference ([pc.testnet.0g.ai](https://pc.testnet.0g.ai) → API keys)

---

## Quick start

```bash
git clone https://github.com/AhmedAmer72/INTENTOS.git
cd INTENTOS
pnpm install
cp .env.example .env
pnpm provision                 # writes gitignored wallets into .env
# Fund deployer + oracle; set ZEROG_ROUTER_API_KEY and AGENT_ID
# Point contract addresses at the Galileo table above (already in deployments/galileo.json)
pnpm db:generate
pnpm db:push
pnpm test
pnpm dev                       # API :8787  ·  web :3000
```

Open `http://localhost:3000`. Connect a **principal** wallet that does **not** own agent 361 if you will run `giveFeedback`.

Provisioning detail: [docs/provisioning.md](docs/provisioning.md). Never commit `.env` or `.wallets.json`.

### Demo path (studio)

1. Intent: *Deploy $5,000 USDC into a low-risk yield opportunity for 14 days. No leverage.*
2. Compile → EIP-712 register.
3. **Greedy** → verify → `REJECT` → `DemoVault.deposit` reverts `IntentNotApproved`.
4. **Replan** → verify → `APPROVE` (meter `Debited`) → deposit succeeds → certificate.
5. Present once; second present reverts. Feedback from the principal only.

Judge checklist: [docs/judge-guide.md](docs/judge-guide.md). A2A without UI: `pnpm --filter @intentos/agent-sdk example:a2a` (`PRINCIPAL` set).

---

## Scripts

| Command | Action |
| --- | --- |
| `pnpm dev` | API + web |
| `pnpm test` / `pnpm lint` | Workspace tests and typecheck |
| `pnpm provision` / `pnpm balances` | Wallet files and gas check |
| `pnpm contracts:compile` / `pnpm contracts:test` | Hardhat |
| `pnpm contracts:deploy:wave45:galileo` | Meter, consumer, Agentic ID v1 only |
| `pnpm contracts:deploy:wave6:galileo` | Executor, SettlementTarget, bounty, Agentic ID v2 (requires live registry) |
| `pnpm --filter @intentos/contracts mint-agentic-id:galileo` | Encrypt metadata, upload, mint v1 |
| `pnpm --filter @intentos/contracts mint-agentic-id-v2:galileo` | Mint v2 with ERC-8004 `agentId: 361` |
| `pnpm build:web` / `pnpm start:api` | Production web build / API start (`tsx`) |

`pnpm contracts:deploy:galileo` redeploys registry + vault. **Do not run it against the live Galileo addresses above.**

---

## Deploy

| Service | Target | Config |
| --- | --- | --- |
| Web | Vercel | Root Directory empty. `framework: null` → `apps/web/dist`. Set `VITE_API_URL`, `VITE_CHAIN_ID=16602`. |
| API | Render | `render.yaml`. `API_HOST=0.0.0.0`, Render `PORT`. SQLite on free tier is ephemeral; chain state is not. |

Full env list and steps: [docs/deploy.md](docs/deploy.md). Put Router keys and private keys only in the host’s secret store.

---

## Trust model

Not fully trustless. Stated so nobody is sold a fiction.

| Layer | Trust |
| --- | --- |
| Hard constraints | None — pure functions, unit-tested |
| Intent commitment | Cryptographic (EIP-712 + JCS keccak) |
| Evidence | 0G Storage merkle root; proof page re-hashes |
| Semantic Layer 2 | TEE-attested inference; captured as evidence |
| Verdict posting | Known `VERIFIER_ROLE` oracle |
| Settlement | On-chain `isApproved` + vault or executor binding |
| 7857 transfer | v2 oracle-gated; residual — no TEE re-encryption of the AES key |

A compromised oracle can still sign a dishonest `APPROVE`. Detectability: replay Layer 1 locally against the evidence bundle. Path forward: move attestation inside attested Compute.

Threats and mitigations: [docs/threat-model.md](docs/threat-model.md).

---

## Documentation

| Doc | Contents |
| --- | --- |
| [docs/architecture.md](docs/architecture.md) | Pipeline, packages, Wave 4–6 rules |
| [docs/protocol.md](docs/protocol.md) | Envelope and hashing |
| [docs/integration.md](docs/integration.md) | API and SDK usage |
| [docs/judge-guide.md](docs/judge-guide.md) | Unaided demo + curl |
| [docs/demo-script.md](docs/demo-script.md) | Spoken walkthrough |
| [docs/provisioning.md](docs/provisioning.md) | Keys, gas, Router |
| [docs/deploy.md](docs/deploy.md) | Vercel + Render |
| [docs/mainnet-deploy.md](docs/mainnet-deploy.md) | Aristotle checklist |
| [docs/threat-model.md](docs/threat-model.md) | Attacks and residuals |
| [docs/wallets.md](docs/wallets.md) | Role of each key |

---

## License

[MIT](LICENSE) © 2026 INTENTOS
