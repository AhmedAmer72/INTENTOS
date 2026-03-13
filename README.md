# INTENTOS

**Keep the truth. Revert the rest.**

Intent verification for autonomous AI on [0G](https://0g.ai). Humans write what must remain true. Agents may choose how. Before a protected action settles, INTENTOS compiles the intent, verifies the action, and either attests an `APPROVE` or lets settlement revert on-chain.

A transaction that is technically valid but intent-violating is still a violation. The model never authorizes funds.

INTENTOS is not a wallet, a copilot, a trading bot, a firewall, or a policy dashboard. It answers one question: **did this action satisfy the original intent?**

| | |
| --- | --- |
| **App** | [intentos-api.vercel.app](https://intentos-api.vercel.app/) |
| **Docs** | [intentos-api.vercel.app/docs](https://intentos-api.vercel.app/docs) |
| **API** | [intentos-api-y6bp.onrender.com](https://intentos-api-y6bp.onrender.com) · [`/ready`](https://intentos-api-y6bp.onrender.com/ready) |
| **Network** | 0G Aristotle mainnet · chain `16661` |
| **Explorer** | [chainscan.0g.ai](https://chainscan.0g.ai) |
| **Proof tx** | [`DemoVault.deposit` · success](https://chainscan.0g.ai/tx/0xda14aeb30aeb4b906d1bb37d0e09ae679d45f1b268753695a05efa0b1dd35101) |
| **Stack** | pnpm monorepo · Node 22 · TypeScript · Vite · Fastify · Prisma · Solidity 0.8.24 (Cancun) |
| **License** | MIT |

---

## Contents

- [What it does](#what-it-does)
- [Product surfaces](#product-surfaces)
- [Demo path](#demo-path)
- [How verification works](#how-verification-works)
- [Fail-closed rules](#fail-closed-rules)
- [Live Aristotle deployment](#live-aristotle-deployment)
- [0G components](#0g-components)
- [Repository](#repository)
- [HTTP API](#http-api)
- [Agent SDK](#agent-sdk)
- [Prerequisites](#prerequisites)
- [Quick start](#quick-start)
- [Scripts](#scripts)
- [Hosted deploy](#hosted-deploy)
- [Trust model](#trust-model)
- [Documentation](#documentation)

---

## What it does

1. **Compile** — Natural language becomes a structured Intent Envelope (hard/soft constraints, duration, leverage, capital, allowed actions). Ambiguity is a `CHALLENGE`, never a guessed number. Stated amounts can be registered even when optional fields are blank.
2. **Anchor** — The principal EIP-712-signs the envelope. Only `keccak256` of RFC 8785 canonical JSON goes on `IntentRegistry`.
3. **Plan** — A live 0G Compute agent proposes an action in `greedy` (maximize yield) or `replan` (stay inside the envelope) mode. There is no canned Strategy A/B path.
4. **Verify** — Four layers, fail-closed: deterministic rules, TEE-backed semantics, plan/action consistency, 0G Storage evidence. Verdict is `APPROVE`, `REJECT`, or `CHALLENGE`.
5. **Settle or revert** — `DemoVault.deposit` reads `isApproved` plus a settlement binding over intent, action, and `msg.value`. Greedy violations revert with `IntentNotApproved`. Compliant replans settle. Every verdict can mint a public certificate.

The same gate runs on Studio (human), Market (agent-to-agent), and Playbook (multi-step). There is no regex-only or offline demo path. Missing Router, Storage, contracts, or a real principal wallet surfaces as `503` / `502` and a red Live 0G rail.

---

## Product surfaces

| Route | Role |
| --- | --- |
| `/` | Marketing landing |
| `/docs` | In-app documentation |
| `/studio` | Human gate: compile → register → greedy REJECT → replan APPROVE → deposit → certificate |
| `/market` | Agent-to-agent. Agent A publishes a requirement; Agent B pays the same gate; `IntentBounty` pays only after APPROVE |
| `/playbook` | Multi-step intent. Step *N* is blocked until `1…N-1` are `isApproved` |
| `/console` | Usage index, meter, append-only 0G Storage batch log, Live 0G stack, optional Agentic ID v2 transfer |
| `/proof/:hash` | Public certificate, Present (`CertificateConsumer.accept`), ERC-8004 `giveFeedback` |

Wallet-gated pages share one readiness hook (`useReady`): compile and verify stay disabled until `/ready` is `"ok": true`. A wrong-network banner offers a switch to Aristotle. Changing the connected account clears in-progress session state so a register/verify cannot be submitted under the wrong principal.

---

## Demo path

Studio intent:

> Deploy $5,000 USDC into a low-risk yield opportunity for 14 days. No leverage.

1. Connect a wallet on 0G Aristotle (`16661`). Compile is refused without it.
2. Compile on live 0G Compute. Inspect hard vs soft constraints.
3. Sign and `registerIntent` (EIP-712). Only the hash is on-chain.
4. **Greedy — maximize yield** → verify → `REJECT` → `DemoVault.deposit` reverts `IntentNotApproved`. That revert is the product.
5. **Replan — obey constraints** → verify → `APPROVE` → meter `Debited` → deposit succeeds → certificate.
6. Present once on `/proof/:hash`. A second present reverts `AlreadyConsumed`.
7. ERC-8004 feedback from the **principal**, not the owner of Agent B (`3537786`).

Worked mainnet settlement: [`0xda14aeb30aeb4b906d1bb37d0e09ae679d45f1b268753695a05efa0b1dd35101`](https://chainscan.0g.ai/tx/0xda14aeb30aeb4b906d1bb37d0e09ae679d45f1b268753695a05efa0b1dd35101) (`DemoVault.deposit`, status success).

Judge checklist: [docs/judge-guide.md](docs/judge-guide.md). Spoken walkthrough: [docs/demo-script.md](docs/demo-script.md). A2A without the UI: `pnpm --filter @intentos/agent-sdk example:a2a` (set `PRINCIPAL`).

---

## How verification works

```
Natural language
  → 0G Compute compile (structured envelope)
  → EIP-712 sign + IntentRegistry.registerIntent (hash only)
  → Agent propose (greedy | replan) on 0G Compute
  → Layer 1  deterministic hard constraints (terminal REJECT on FAIL)
  → Layer 2  TEE-backed semantics (fail-closed if not teeAttested;
             may only downgrade APPROVE → CHALLENGE)
  → Layer 3  intent ↔ plan ↔ action consistency
  → Envelope + evidence upload to 0G Storage (merkle roots)
  → VerificationMeter.debit (if configured)
  → Oracle recordVerification on IntentRegistry
  → DemoVault.deposit  or  IntentExecutor.execute  or  IntentNotApproved
  → Certificate · optional Present · optional ERC-8004 feedback · optional IntentBounty claim
```

**Verdicts**

| Stamp | Meaning |
| --- | --- |
| `REJECT` | A hard rule failed. Settlement reverts. Replan, then verify again. |
| `CHALLENGE` | Meaning is unclear. Not a pass. In Console this means the verify did not settle — not the 15-minute executor delay. |
| `APPROVE` | Rules, meaning, and evidence agree. Deposit, bounty claim, or a bound executor call can proceed. |

Layer 1 hard `FAIL` cannot be overruled by the model. Layer 2 may only downgrade. `allowedActions` on the envelope is reconciled with the `allowed_actions` hard constraint so a replan cannot deadlock against its own rules.

---

## Fail-closed rules

- No compile without Router + a connected principal wallet.
- No verify without Router, Storage upload, and meter credits once the meter is configured.
- `/verify` checks that the intent is registered and that `payer` is the on-chain principal **before** Compute, Storage, or attestation spend.
- Layer 2 without TEE evidence never calls `recordVerification` (`tee_required`). TEE may come from the request trace or the model registry; it is not inferred from a model name.
- `DemoVault` never reads model output. The gate is `isApproved` plus `settlementBinding = keccak256(intentId, actionHash, msg.value)`.
- `IntentExecutor` uses a different binding (`intentId, actionHash, target, keccak(calldata), value`) and a 900s challenge delay. One verify = one binding.
- `giveFeedback` must be sent by the principal (self-feedback reverts).
- `CertificateConsumer.accept` is one-shot; a second present reverts `AlreadyConsumed`.
- Envelope upload to Storage is optional and time-bounded (`ENVELOPE_UPLOAD_TIMEOUT_MS`). Evidence upload on `/verify` is mandatory and time-bounded (`EVIDENCE_UPLOAD_TIMEOUT_MS`).
- Paid routes (`/compile`, `/agent/propose`, `/verify`, …) are rate-limited (`RATE_LIMIT_PER_MIN`, default 30/min/IP). `TRUST_PROXY` must match the hop count in front of the API (1 on Render).
- The wallet UI pre-checks native balance, waits for a success receipt before showing a success state, and refuses writes on the wrong chain.

---

## Live Aristotle deployment

0G mainnet, chain `16661`. Addresses live in [`packages/contracts/deployments/mainnet.json`](packages/contracts/deployments/mainnet.json). Do **not** mix these with Galileo `16602`.

| Contract | Address |
| --- | --- |
| IntentRegistry | [`0x8FB1A3CFf48EC873Ef0526A902425813979c7b9e`](https://chainscan.0g.ai/address/0x8FB1A3CFf48EC873Ef0526A902425813979c7b9e) |
| DemoVault | [`0xcf6a53b0A22989Ad6B1834C7844CfB9B0d3A9125`](https://chainscan.0g.ai/address/0xcf6a53b0A22989Ad6B1834C7844CfB9B0d3A9125) |
| VerificationMeter | [`0xaBfbe94121DC9BD17056642b9Cf79d93498bfA8A`](https://chainscan.0g.ai/address/0xaBfbe94121DC9BD17056642b9Cf79d93498bfA8A) |
| CertificateConsumer | [`0x95F9098bB17A79a7be6100D269a668DEf40527EE`](https://chainscan.0g.ai/address/0x95F9098bB17A79a7be6100D269a668DEf40527EE) |
| IntentosAgenticId | [`0x1BF7e38D0670C856f64326bc4Fc4D9C281e5F087`](https://chainscan.0g.ai/address/0x1BF7e38D0670C856f64326bc4Fc4D9C281e5F087) token `#1` |
| IntentExecutor | [`0x22535C947Fd951bbC6C03f8D8A1159ad3a159c46`](https://chainscan.0g.ai/address/0x22535C947Fd951bbC6C03f8D8A1159ad3a159c46) |
| SettlementTarget | [`0x744E0ba6660E98074f30ef8Ad267aF914e222f7a`](https://chainscan.0g.ai/address/0x744E0ba6660E98074f30ef8Ad267aF914e222f7a) |
| IntentBounty | [`0xE8814DC8a9d5c37beC6AeBD232815cEaeCAE753F`](https://chainscan.0g.ai/address/0xE8814DC8a9d5c37beC6AeBD232815cEaeCAE753F) |
| IntentosAgenticIdV2 | [`0x29d376Fa105333946d8Aa989C66579f55223De32`](https://chainscan.0g.ai/address/0x29d376Fa105333946d8Aa989C66579f55223De32) token `#1` |
| ERC-8004 Identity (0G) | [`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`](https://chainscan.0g.ai/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432) · agent **3537786** (Agent B), **3537791** (requirement / Agent A) |
| ERC-8004 Reputation (0G) | [`0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`](https://chainscan.0g.ai/address/0x8004BAa17C55a88189AE136b182e5fdA19dE9b63) |

| Parameter | Value |
| --- | --- |
| Verify price | `100000000000000` wei (0.0001 0G) per `/verify`, including `REJECT` |
| Challenge delay | `900` seconds |
| Router model | `qwen3.8-flash` (TEE-attested chat on [pc.0g.ai](https://pc.0g.ai)) |
| RPC | `https://evmrpc.0g.ai` |
| Storage indexer | `https://indexer-storage-turbo.0g.ai` |

Galileo (`16602`) remains deployed and must not be redeployed. Addresses: [`packages/contracts/deployments/galileo.json`](packages/contracts/deployments/galileo.json). Agent B **361**, Agent A **362**. Router model on Galileo is `qwen2.5-omni`.

Local and hosted apps: `ZEROG_NETWORK=mainnet`, `VITE_CHAIN_ID=16661`. Do not leave a Galileo chain id in a mainnet Vercel build.

---

## 0G components

| Layer | Use |
| --- | --- |
| **Chain** | IntentRegistry, DemoVault, VerificationMeter, CertificateConsumer, IntentosAgenticId, IntentExecutor, SettlementTarget, IntentBounty, IntentosAgenticIdV2. Solidity **0.8.24**, `evmVersion: cancun`, `viaIR`. Writes use a 2 gwei tip (Aristotle rejects lower). |
| **Compute** | Official Router (`qwen3.8-flash` on mainnet). Compile, propose, Layer 2. Not the deprecated serving-broker. |
| **Storage** | Compiled envelopes, evidence blobs, and encrypted 7857 metadata via `@0gfoundation/0g-storage-ts-sdk`. |
| **ERC-8004** | Live Identity + Reputation. Aristotle agents **3537786** / **3537791**. Galileo **361** / **362**. |
| **ERC-7857-shaped** | v1 historical mint. v2 oracle-gated `transfer` / `clone`. Mainnet metadata uses agent **3537786**. |
| **Payment** | Router deposit = Payment Layer (Compute). `VerificationMeter` = per-verify prepaid 0G. `IntentBounty` = A2A Pay after APPROVE. |
| **DA** | Deferred. No published mainnet `DAEntrance`. Execution traces batch to 0G Storage (`GET /log`, flush every 3 events). |

---

## Repository

```
apps/web                 Vite + React + Tailwind — landing, docs, studio, market, playbook, console, proof
apps/api                 Fastify + Prisma — compile, verify, certificates, meter, log, rate limit
packages/schema          Zod, JCS, keccak, EIP-712
packages/rules-engine    Deterministic constraint evaluators
packages/verifier        Compiler, layers 2–3, monotonic verdict
packages/zerog           Storage, Router, chain clients
packages/agent-sdk       HTTP client + reference agent (`example:a2a`)
packages/contracts       Hardhat 0.8.24 + Galileo / mainnet Wave 4–6 scripts
docs/                    Architecture, protocol, threats, judge path, deploy
scripts/                 Wallets, mainnet verify, e2e, security checks
```

---

## HTTP API

Local: `http://127.0.0.1:8787`. Hosted: `https://intentos-api-y6bp.onrender.com`.

CORS: `ALLOWED_ORIGINS` (comma-separated). Unset = any origin. Pin this in production — compile / propose / verify spend the Router key and oracle gas.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness |
| `GET` | `/ready` | Fail-closed probe (Router, Storage, contracts, keys, meter, 7857, …) |
| `GET` | `/meta` | Network, addresses, model |
| `POST` | `/compile` | Natural language → envelope (uploads JCS when Storage is on) |
| `GET` | `/envelope/:intentId` | Re-download envelope root and compare to `intentHash` |
| `POST` | `/agent/propose` | Greedy or replan action |
| `POST` | `/agent/offer` | Stamp an offer with Agent B id |
| `POST` | `/verify` | Human-gated verify + attest |
| `POST` | `/verify/a2a` | Agent-to-agent verify |
| `POST` | `/verify/step` | Step *N* only if `1…N-1` are approved |
| `GET` | `/certificate/action/:actionHash` | Certificate by action |
| `GET` | `/certificate/:intentId/:actionHash` | Certificate by intent + action |
| `GET` | `/proof/:actionHash` | Proof payload for the UI |
| `POST` | `/settle` | Record a settlement tx |
| `POST` | `/attest` | Oracle attestation helper |
| `GET` | `/meter/:address` | Prepaid credits |
| `GET` | `/usage` | Verdict counts, meter, recent verifies |
| `GET` | `/log` | Storage batch heads |
| `POST` | `/log/flush` | Force batch upload |
| `POST` | `/reputation` | Persist `giveFeedback` tx |
| `POST` | `/agentic/v2/proof` | Oracle EIP-712 proof for Agentic ID v2 transfer/clone |

---

## Agent SDK

`@intentos/agent-sdk` (workspace package — not published to npm).

```ts
import { createIntentosClient } from "@intentos/agent-sdk";

const client = createIntentosClient({ baseUrl: "https://intentos-api-y6bp.onrender.com" });

await client.ready();
const compiled = await client.compile(text, principal);
const plan = await client.propose(compiled.envelope, "replan");
const verified = await client.verify({
  intent: compiled.envelope,
  action: plan.action,
  payer: principal,
});
```

Also: `offer`, `verifyA2A`, `verifyStep`, `meter.credits`, `usage`, `proof`. Headless A2A: `pnpm --filter @intentos/agent-sdk example:a2a`.

---

## Prerequisites

- Node.js **≥ 22** (see `.nvmrc`)
- [pnpm](https://pnpm.io) **10.28.2** (`packageManager` field; Corepack is enough)
- A browser wallet on 0G Mainnet (MetaMask will be prompted to add chain `16661`)
- Mainnet 0G for gas, meter deposits, and Router inference ([pc.0g.ai](https://pc.0g.ai) → API keys)

---

## Quick start

```bash
git clone https://github.com/AhmedAmer72/INTENTOS.git
cd INTENTOS
pnpm install
cp .env.example .env
pnpm provision                 # writes gitignored wallets into .env
# Fund deployer + oracle; set ZEROG_ROUTER_API_KEY and AGENT_ID
# Point contract addresses at the Aristotle table above (already in deployments/mainnet.json)
pnpm db:generate
pnpm db:push
pnpm test
pnpm dev                       # API :8787  ·  web :3000
```

Open `http://localhost:3000`. Connect a **principal** wallet that does **not** own agent 3537786 if you will run `giveFeedback`.

Provisioning: [docs/provisioning.md](docs/provisioning.md). Never commit `.env` or `.wallets.json`. Env keys: [`.env.example`](.env.example).

---

## Scripts

| Command | Action |
| --- | --- |
| `pnpm dev` | API + web |
| `pnpm test` / `pnpm lint` / `pnpm build` | Workspace tests, typecheck, production build |
| `pnpm provision` / `pnpm balances` | Wallet files and gas check |
| `pnpm contracts:compile` / `pnpm contracts:test` | Hardhat |
| `pnpm contracts:deploy:wave45:galileo` | Meter, consumer, Agentic ID v1 (Galileo) |
| `pnpm contracts:deploy:wave6:galileo` | Executor, SettlementTarget, bounty, Agentic ID v2 |
| `pnpm contracts:deploy:wave45:mainnet` | Same Wave 4–5 set on Aristotle |
| `pnpm contracts:deploy:wave6:mainnet` | Same Wave 6 set on Aristotle |
| `pnpm --filter @intentos/contracts mint-agentic-id:galileo` | Encrypt metadata, upload, mint v1 |
| `pnpm --filter @intentos/contracts mint-agentic-id-v2:galileo` | Mint v2 with ERC-8004 `agentId: 361` |
| `pnpm build:web` / `pnpm start:api` | Production web build / API start (`tsx`) |
| `node scripts/verify-mainnet.mjs` | On-chain bytecode, wiring, roles, EIP-712 domain |
| `node scripts/e2e-mainnet.mjs` | Compile → register → greedy → replan → vault |
| `node scripts/security-checks.mjs` | Unregistered verify, payer spoof, rate limit |

`pnpm contracts:deploy:galileo` and `pnpm contracts:deploy:mainnet` redeploy registry + vault. **Do not run them against the live addresses above.**

---

## Hosted deploy

| Service | Target | Config |
| --- | --- | --- |
| Web | Vercel | Repo root. `framework: null` → `apps/web/dist`. `VITE_API_URL`, `VITE_CHAIN_ID=16661`. |
| API | Render | `render.yaml`. `API_HOST=0.0.0.0`, `TRUST_PROXY=1`, Render `PORT`. |

SQLite on Render’s free plan is ephemeral; chain state is not. Vite inlines `VITE_*` at **build** time — change them, then redeploy the web.

Full env list: [docs/deploy.md](docs/deploy.md). Aristotle checklist: [docs/mainnet-deploy.md](docs/mainnet-deploy.md). Put Router keys and private keys only in the host’s secret store.

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
