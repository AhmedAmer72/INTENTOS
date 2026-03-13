# Deploy INTENTOS (Vercel + Render)

Web → **Vercel**. API → **Render**. Do not put private keys in git.

## 1. Render (API)

1. [render.com](https://render.com) → New → Blueprint → this repo (`render.yaml`).
2. Fill every `sync: false` env var from your local `.env` (Router key, oracle key, contract addresses, agent ids).
3. Confirm `API_HOST=0.0.0.0`. Render injects `PORT`.
4. Wait for `GET /health` to return `{ ok: true }`.
5. Copy the public origin, e.g. `https://intentos-api.onrender.com` — no trailing slash.

SQLite (`file:./prisma/prod.db`) is ephemeral on the free plan. Redeploys reset local rows; chain state does not.

## 2. Vercel (web)

1. [vercel.com](https://vercel.com) → Add New → Project → this repo.
2. **Root Directory:** leave empty (repository root). Do not set it to `apps/web` unless you want `apps/web/vercel.json` to drive the build.
3. **Framework Preset:** Other / leave unset. `vercel.json` sets `"framework": null` so Vercel does not look for a root `dist`.
4. **Output Directory:** leave empty so `vercel.json` can set `apps/web/dist`. A dashboard value of `dist` is what produced “No Output Directory named dist”.
5. Environment variables (Production + Preview):

| Name | Value |
| --- | --- |
| `VITE_API_URL` | Render origin from step 1 |
| `VITE_CHAIN_ID` | `16602` (Galileo) |

6. Deploy. Client routes (`/studio`, `/market`, `/console`, `/proof/:hash`) rewrite to `index.html`.

## 3. CORS

The API allows any origin (`@fastify/cors` `origin: true`). The browser calls `VITE_API_URL` directly.

## 4. Local check before you ship

```bash
pnpm install
cp .env.example .env
pnpm --filter @intentos/api db:generate
pnpm --filter @intentos/api db:push
pnpm --filter @intentos/web build
API_HOST=0.0.0.0 pnpm --filter @intentos/api start
```
