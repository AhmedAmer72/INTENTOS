# INTENTOS

**The intent-verification layer for autonomous AI.**

> Agents decide how. Humans decide what. INTENTOS verifies the difference.

Humans write a natural-language objective. INTENTOS compiles it into a cryptographically committed **Intent Envelope**. An agent remains free to choose *how*. Before a protected action settles, INTENTOS checks whether that action satisfies the original intent — deterministically first, then with TEE-backed semantic inference on 0G Compute. Evidence lives on 0G Storage. The verdict is anchored on 0G Chain. A transaction that is technically valid but intent-violating **reverts**.

This is not a wallet, a firewall, a trading bot, or a policy dashboard.

## Live on 0G (Wave 3)

Fill after mainnet deploy ([docs/mainnet-deploy.md](docs/mainnet-deploy.md)):

| Artifact | Value |
| --- | --- |
| Network | 0G Mainnet (Aristotle, chain 16661) |
| IntentRegistry | _pending deploy_ |
| DemoVault | _pending deploy_ |
| Explorer | https://chainscan.0g.ai |
| ERC-8004 IdentityRegistry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| Rejected settlement tx | _the `IntentNotApproved` revert_ |
| Approved settlement tx | _pending_ |

Testnet (Galileo, 16602) is used for development. Wave 3 submission uses mainnet.

## Galileo Wave 4–5

Do **not** redeploy the live registry or vault. New contracts: VerificationMeter, CertificateConsumer, IntentosAgenticId.

| Artifact | Value |
| --- | --- |
| Network | 0G Galileo (16602) |
| IntentRegistry | `0xfdDe66249e140aCbF36B65a801A9de58bF8a7Fb9` |
| DemoVault | `0x8F0F527c299bA7085AE258fdB5D32b4E52AE6Cf6` |
| Studio / Market / Console | `/studio` `/market` `/console` `/playbook` |
| ERC-8004 Identity | `0x8004A818BFB912233c491871b3d84c89A494BD9e` (agent 361) |
| ERC-8004 Reputation | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |

```bash
pnpm contracts:deploy:wave45:galileo
pnpm --filter @intentos/contracts mint-agentic-id:galileo
```

## Judge path (3 minutes)

See [docs/judge-guide.md](docs/judge-guide.md) and [docs/demo-script.md](docs/demo-script.md).

1. Compile *“Deploy $5,000 USDC into a low-risk yield opportunity for 14 days. No leverage.”*
2. Live agent proposes a greedy yield plan → **REJECT**
3. `DemoVault.deposit` **reverts on-chain**
4. Agent replans to a constraint-respecting vault → **APPROVE** → settlement → certificate

## Quick start

```bash
pnpm install
cp .env.example .env
pnpm provision          # writes gitignored wallets into .env
pnpm --filter @intentos/api db:generate
pnpm --filter @intentos/api db:push
pnpm test
pnpm dev                # API :8787  web :3000
```

Fund wallets and Router keys: [docs/provisioning.md](docs/provisioning.md).

## Deploy

- **Web** — Vercel (`vercel.json`, output `apps/web/dist`). Set `VITE_API_URL` to the public API.
- **API** — Render Blueprint (`render.yaml`). Listen on `PORT` / `0.0.0.0`.

Full steps: [docs/deploy.md](docs/deploy.md).

## Trust model

Wave 3 is **not** fully trustless. Hard constraints, hashing, storage roots, and the settlement gate are cryptographic. Semantic Layer 2 and the `VERIFIER_ROLE` oracle are trusted-but-evidenced. The LLM cannot authorize funds. Details: [docs/architecture.md](docs/architecture.md), [docs/threat-model.md](docs/threat-model.md).

## Repository

```
apps/web          Vite + Tailwind studio + proof page
apps/api          Fastify compile / verify / certificate
packages/schema   Zod + JCS + keccak
packages/rules-engine
packages/verifier
packages/zerog    0G Storage, Router, chain
packages/agent-sdk
packages/contracts
docs/
```

## 0G components used

- **Chain** — IntentRegistry + DemoVault (Solidity 0.8.24, `evmVersion: cancun`; 0.8.19 cannot encode Cancun)
- **Storage** — evidence blobs via `@0gfoundation/0g-storage-ts-sdk`
- **Compute** — Router `https://router-api.0g.ai/v1` (not the deprecated serving-broker)
- **ERC-8004** — live Identity + Reputation; `giveFeedback` from the principal wallet
- **ERC-7857-shaped** — `IntentosAgenticId` (encrypted metadata on 0G Storage). Official example mint is owner-only.
- **DA** — deferred; append-only execution batches on 0G Storage (`GET /log`)
- **Pay** — `VerificationMeter` prepaid credits (Galileo)
