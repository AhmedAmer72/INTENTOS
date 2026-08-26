# 0G integration

Live documentation as of August 2026. Do not use deprecated package names.

## Chain

| | Galileo | Mainnet |
| --- | --- | --- |
| Chain ID | 16602 | 16661 |
| RPC | https://evmrpc-testnet.0g.ai | https://evmrpc.0g.ai |
| Explorer | https://chainscan-galileo.0g.ai | https://chainscan.0g.ai |
| Solidity | 0.8.24, `evmVersion: cancun` | same |

solc 0.8.19 does not implement `cancun`. 0G Chain is Cancun; we pin **0.8.24 + cancun** so explorer verification matches the live EVM. Avoid Prague/Osaka.

Live Galileo (do **not** redeploy): `IntentRegistry` `0xfdDe66249e140aCbF36B65a801A9de58bF8a7Fb9`, `DemoVault` `0x8F0F527c299bA7085AE258fdB5D32b4E52AE6Cf6`.

Wave 4–5 (Galileo only) deploys `VerificationMeter`, `CertificateConsumer`, `IntentosAgenticId`:

```bash
pnpm contracts:deploy:wave45:galileo
pnpm --filter @intentos/contracts mint-agentic-id:galileo
```

Do not run `pnpm contracts:deploy:galileo` again — that script redeploys the live registry and vault.

## Storage

Package: `@0gfoundation/0g-storage-ts-sdk` (not `@0gfoundation/0g-ts-sdk` for new work — both exist; this repo uses the documented storage SDK).

Indexers:

- Testnet turbo: `https://indexer-storage-testnet-turbo.0g.ai`
- Mainnet turbo: `https://indexer-storage-turbo.0g.ai`

Upload path: `MemData` / indexer `upload` with an ethers signer. Evidence blobs and compiled envelopes.

## Compute

Prefer the **Router** (OpenAI-compatible), not the deprecated `@0glabs/0g-serving-broker`.

| | Testnet | Mainnet |
| --- | --- | --- |
| UI | https://pc.testnet.0g.ai | https://pc.0g.ai |
| API | https://router-api-testnet.integratenetwork.work/v1 | https://router-api.0g.ai/v1 |

Capture on every call: `x_0g_trace` (provider address, request id, tee flags), `ZG-Res-Key` when present, `X-Request-ID`. Persist as `ComputeEvidence`.

Pin `ZEROG_ROUTER_MODEL` to a `tee_attested` model from `GET /v1/models`.

## Agentic ID / ERC-8004

- Galileo IdentityRegistry `0x8004A818BFB912233c491871b3d84c89A494BD9e`
- Galileo ReputationRegistry `0x8004B663056A597Dffe9eCcC1965A193B7388713`
- Mainnet IdentityRegistry `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- Mainnet ReputationRegistry `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`

Agent B (offer) is `AGENT_ID=361`. Register a second identity for Agent A:

```bash
pnpm --filter @intentos/contracts register-agent:galileo
# copy the returned id to REQUIREMENT_AGENT_ID
```

Encrypted Agentic ID metadata is minted on our `IntentosAgenticId` (not the official owner-only example). `giveFeedback` must be sent by the **principal wallet**, not the agent owner.

```bash
pnpm --filter @intentos/contracts mint-agentic-id:galileo
```

## DA

Not used. Requires a self-hosted encoder (GPU) and has no published mainnet `DAEntrance`. Execution logs go to 0G Storage.

## Payment Layer

There is no standalone "0G Pay" SDK. Billing for Compute uses the shared Payment Layer vault via Router deposits. Per-verification metering is `VerificationMeter.sol` (Wave 4).
