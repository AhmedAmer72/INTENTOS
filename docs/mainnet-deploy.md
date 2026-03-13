# Mainnet deployment (Aristotle, chain 16661)

Galileo (`16602`) is the live demo. This file is the Aristotle runbook. **Do not run the commands below until you intend to spend mainnet 0G.** There is no mainnet registry yet — `packages/contracts/deployments/mainnet.json` is a stub.

Do **not** point these scripts at the live Galileo registry. Set `ZEROG_NETWORK=mainnet` and leave Galileo addresses out of the session.

## Prerequisites

- [ ] Deployer funded with about **1 0G** on chain 16661 (registry + vault is cheap; leave headroom for wave 4–6, storage, and meter). See [provisioning.md](provisioning.md).
- [ ] Mainnet Router `sk-` key from https://pc.0g.ai
- [ ] `.env` for this session:
  - `ZEROG_NETWORK=mainnet`
  - `ZEROG_MAINNET_RPC=https://evmrpc.0g.ai`
  - `DEPLOYER_PRIVATE_KEY` / `VERIFIER_ORACLE_PRIVATE_KEY`
  - `ZEROG_ROUTER_API_KEY` (mainnet)
  - `ZEROG_STORAGE_UPLOAD=1`
  - `VERIFY_PRICE_WEI=100000000000000`
  - `CHALLENGE_DELAY_SECONDS=900`
- [ ] `AGENT_ID` and `REQUIREMENT_AGENT_ID` empty until step 6 (mainnet 8004 ids are not 361/362)

## Order of operations

From the repo root, with the mainnet `.env` loaded:

```bash
pnpm contracts:compile

# 1. Registry + DemoVault only. Writes packages/contracts/deployments/mainnet.json
pnpm contracts:deploy:mainnet

# 2. Copy IntentRegistry / DemoVault into .env, then:
pnpm contracts:deploy:wave45:mainnet

# 3. Executor, SettlementTarget, Bounty, Agentic ID v2. Never deploys registry/vault.
pnpm contracts:deploy:wave6:mainnet

# 4. ERC-8004 identity on the official mainnet registry
pnpm --filter @intentos/contracts register-agent:mainnet
# Set AGENT_ID (Agent B) and a second REQUIREMENT_AGENT_ID (Agent A)

# 5. Mint Agentic ID v2. Metadata must include the mainnet agentId from step 4.
pnpm --filter @intentos/contracts mint-agentic-id-v2:mainnet

# 6. Source verify on chainscan (skips addresses not in mainnet.json)
pnpm --filter @intentos/contracts verify:mainnet
```

Then set:

```
INTENT_REGISTRY_ADDRESS=0x...
DEMO_VAULT_ADDRESS=0x...
VERIFICATION_METER_ADDRESS=0x...
CERTIFICATE_CONSUMER_ADDRESS=0x...
AGENTIC_ID_ADDRESS=0x...
AGENTIC_ID_TOKEN=1
INTENT_EXECUTOR_ADDRESS=0x...
SETTLEMENT_TARGET_ADDRESS=0x...
INTENT_BOUNTY_ADDRESS=0x...
AGENTIC_ID_V2_ADDRESS=0x...
AGENTIC_ID_V2_TOKEN=1
CHALLENGE_DELAY_SECONDS=900
VITE_CHAIN_ID=16661
ZEROG_NETWORK=mainnet
```

`GET /ready` must be `"ok": true` on mainnet RPC before you cut the hosted API over.

## Hosting cutover (after contracts exist)

Render (API):

- `ZEROG_NETWORK=mainnet`
- `ZEROG_MAINNET_RPC=https://evmrpc.0g.ai`
- Mainnet Router key and all new contract addresses
- Restart the service. Confirm `https://<render>/ready` → `"ok": true`, `chainId: 16661`

Vercel (web):

- `VITE_API_URL` = Render origin (no trailing slash)
- `VITE_CHAIN_ID=16661`
- Redeploy the web so the client bundle picks up the new chain

Do not mix Galileo addresses with `VITE_CHAIN_ID=16661`.

## Five explorer transactions judges expect

1. `registerIntent` for the demo envelope
2. `recordVerification` REJECT for the greedy proposal (optional but good)
3. `DemoVault.deposit` **revert** `IntentNotApproved` for that action — the spoken demo
4. `recordVerification` APPROVE for the replanned proposal
5. `DemoVault.deposit` success

Optional: meter `Debited`, `IntentExecutor.execute` after the 900s delay, `IntentBounty` fund/claim, Agentic ID v2 transfer.

Paste tx hashes into the README "Live on 0G" table after they land.

## Constructor args (manual chainscan)

If the Blockscout plugin fails, verify at https://chainscan.0g.ai. Compiler `0.8.24`, EVM `cancun`, optimizer 200, `viaIR`.

- `IntentRegistry(admin, oracle)`
- `DemoVault(registry)`
- `VerificationMeter(admin, settler, priceWei)`
- `CertificateConsumer(registry)`
- `IntentosAgenticId()`
- `IntentExecutor(registry, challengeDelay)`
- `SettlementTarget()`
- `IntentBounty(registry)`
- `IntentosAgenticIdV2(oracle)`
