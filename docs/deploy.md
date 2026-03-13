# Deploy INTENTOS (Vercel + Render)

Web → **Vercel**. API → **Render**. Do not put private keys in git.

## 1. Render (API)

1. [render.com](https://render.com) → New → Blueprint → this repo (`render.yaml`).
2. Set `ZEROG_NETWORK=mainnet` (blueprint default). Fill every `sync: false` env var from the Aristotle table in this file.
3. Confirm `API_HOST=0.0.0.0`. Render injects `PORT`.
4. Wait for `GET /ready` to return `{ "ok": true, "chainId": 16661 }`.
5. Copy the public origin, e.g. `https://intentos-api-y6bp.onrender.com` — no trailing slash.

SQLite (`file:./prisma/prod.db`) is ephemeral on the free plan. Redeploys reset local rows; chain state does not.

## 2. Vercel (web)

1. [vercel.com](https://vercel.com) → Add New → Project → this repo.
2. **Root Directory:** leave empty (repository root). Do not set it to `apps/web` unless you want `apps/web/vercel.json` to drive the build.
3. **Framework Preset:** Other / leave unset. `vercel.json` sets `"framework": null` so Vercel does not look for a root `dist`.
4. **Output Directory:** leave empty so `vercel.json` can set `apps/web/dist`. A dashboard value of `dist` is what produced “No Output Directory named dist”.
5. Environment variables (Production + Preview):

| Name | Value |
| --- | --- |
| `VITE_API_URL` | Render origin from step 1 (no trailing slash) |
| `VITE_CHAIN_ID` | `16661` |

Vite inlines these at **build** time. After changing them, trigger a Vercel redeploy. Do not leave `16602` if Render is on Aristotle.

6. Deploy. Client routes (`/studio`, `/market`, `/console`, `/proof/:hash`) rewrite to `index.html`.

## 3. Aristotle env values (paste into dashboards)

Do not put private keys in git. Copy `DEPLOYER_PRIVATE_KEY`, `VERIFIER_ORACLE_PRIVATE_KEY`, and `ZEROG_ROUTER_API_KEY` from local `.env` only.

### Render — replace these

| Name | Value |
| --- | --- |
| `ZEROG_NETWORK` | `mainnet` |
| `ZEROG_MAINNET_RPC` | `https://evmrpc.0g.ai` |
| `ZEROG_STORAGE_UPLOAD` | `1` |
| `VERIFY_PRICE_WEI` | `100000000000000` |
| `CHALLENGE_DELAY_SECONDS` | `900` |
| `INTENT_REGISTRY_ADDRESS` | `0x8FB1A3CFf48EC873Ef0526A902425813979c7b9e` |
| `DEMO_VAULT_ADDRESS` | `0xcf6a53b0A22989Ad6B1834C7844CfB9B0d3A9125` |
| `VERIFICATION_METER_ADDRESS` | `0xaBfbe94121DC9BD17056642b9Cf79d93498bfA8A` |
| `CERTIFICATE_CONSUMER_ADDRESS` | `0x95F9098bB17A79a7be6100D269a668DEf40527EE` |
| `AGENTIC_ID_ADDRESS` | `0x1BF7e38D0670C856f64326bc4Fc4D9C281e5F087` |
| `AGENTIC_ID_TOKEN` | `1` |
| `INTENT_EXECUTOR_ADDRESS` | `0x22535C947Fd951bbC6C03f8D8A1159ad3a159c46` |
| `SETTLEMENT_TARGET_ADDRESS` | `0x744E0ba6660E98074f30ef8Ad267aF914e222f7a` |
| `INTENT_BOUNTY_ADDRESS` | `0xE8814DC8a9d5c37beC6AeBD232815cEaeCAE753F` |
| `AGENTIC_ID_V2_ADDRESS` | `0x29d376Fa105333946d8Aa989C66579f55223De32` |
| `AGENTIC_ID_V2_TOKEN` | `1` |
| `AGENT_ID` | `0x000000000000000000000000000000000000000000000000000000000035fb7a` |
| `REQUIREMENT_AGENT_ID` | `0x000000000000000000000000000000000000000000000000000000000035fb7f` |
| `ZEROG_ROUTER_MODEL` | `qwen3.8-flash` |
| `ZEROG_ROUTER_URL_MAINNET` | `https://router-api.0g.ai/v1` |
| `ZEROG_ROUTER_API_KEY` | mainnet `sk-` from local `.env` (pc.0g.ai) |
| `DEPLOYER_PRIVATE_KEY` | funded Aristotle deployer from local `.env` |
| `VERIFIER_ORACLE_PRIVATE_KEY` | same oracle key (already has `VERIFIER_ROLE`) |
| `API_HOST` | `0.0.0.0` |

Use the official mainnet Router. A Galileo `sk-` gets `401` here.

Restart the Render service. Confirm `https://intentos-api-y6bp.onrender.com/ready` is `"network":"mainnet","chainId":16661`.

### Vercel — replace these (Production + Preview)

| Name | Value |
| --- | --- |
| `VITE_API_URL` | `https://intentos-api-y6bp.onrender.com` |
| `VITE_CHAIN_ID` | `16661` |

Then **Redeploy** the web (Vite bakes these in at build time).

## 4. CORS

The API allows any origin (`@fastify/cors` `origin: true`). The browser calls `VITE_API_URL` directly.

## 5. Local check before you ship

```bash
pnpm install
cp .env.example .env
pnpm --filter @intentos/api db:generate
pnpm --filter @intentos/api db:push
pnpm --filter @intentos/web build
API_HOST=0.0.0.0 pnpm --filter @intentos/api start
```
