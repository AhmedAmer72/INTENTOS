# Mainnet deployment (Aristotle, chain 16661)

This Wave does **not** deploy to mainnet. Use this file as a checklist when you are ready. Do **not** run `pnpm contracts:deploy:mainnet` until you intend to spend mainnet 0G.

## Prerequisites

1. Fund the deployer with about **1 0G** on chain 16661 (registry + vault is ~0.008 0G; leave headroom for wave45, wave6, storage uploads, and meter). See [provisioning.md](provisioning.md).
2. `VERIFIER_ORACLE` address known. The oracle key must sign attestations and Agentic ID v2 proofs.
3. `.env` filled: `ZEROG_NETWORK=mainnet`, keys, `ZEROG_MAINNET_RPC`, Router key, `AGENT_ID` after 8004 register.

## Order of operations (when you run it)

1. `pnpm contracts:compile`
2. `pnpm contracts:deploy:mainnet` — `scripts/deploy.ts` on 16661. Writes `IntentRegistry` + `DemoVault` to `packages/contracts/deployments/mainnet.json`.
3. Copy those addresses into `.env` (`INTENT_REGISTRY_ADDRESS`, `DEMO_VAULT_ADDRESS`). Set `VITE_CHAIN_ID=16661`.
4. `pnpm --filter @intentos/contracts deploy:wave45:galileo` is Galileo-only. For mainnet, run the same script with `--network mainnet` once a `deploy:wave45:mainnet` script exists, or `hardhat run scripts/deploy-wave45.ts --network mainnet`. Requires the live registry address. Deploys meter, consumer, Agentic ID v1.
5. `hardhat run scripts/deploy-wave6.ts --network mainnet` — requires `INTENT_REGISTRY_ADDRESS`. Deploys **only** IntentExecutor, SettlementTarget, IntentBounty, IntentosAgenticIdV2. Never deploys registry/vault.
6. `pnpm --filter @intentos/contracts register-agent:mainnet` — ERC-8004 identity. Set `AGENT_ID` (and a second id for Agent A).
7. Mint Agentic ID v2 (`mint-agentic-id-v2.ts` on mainnet). Metadata **must** include `agentId` matching the 8004 token (361 on Galileo; mainnet id from step 6).
8. `pnpm --filter @intentos/contracts verify:mainnet` (or manual chainscan verify). Compiler `0.8.24`, EVM `cancun`, optimizer 200, `viaIR`.

Copy new addresses:

```
INTENT_REGISTRY_ADDRESS=0x...
DEMO_VAULT_ADDRESS=0x...
VERIFICATION_METER_ADDRESS=0x...
CERTIFICATE_CONSUMER_ADDRESS=0x...
AGENTIC_ID_ADDRESS=0x...
INTENT_EXECUTOR_ADDRESS=0x...
SETTLEMENT_TARGET_ADDRESS=0x...
INTENT_BOUNTY_ADDRESS=0x...
AGENTIC_ID_V2_ADDRESS=0x...
CHALLENGE_DELAY_SECONDS=900
VITE_CHAIN_ID=16661
ZEROG_NETWORK=mainnet
```

## Five explorer transactions judges expect

1. `registerIntent` for the demo envelope
2. `recordVerification` REJECT for the greedy proposal (optional but good)
3. `DemoVault.deposit` **revert** `IntentNotApproved` for that action — the spoken demo
4. `recordVerification` APPROVE for the replanned proposal
5. `DemoVault.deposit` success

Optional extras: meter `Debited`, `IntentExecutor.execute` after the challenge delay, `IntentBounty` fund/claim, Agentic ID v2 transfer.

Paste tx hashes into the README "Live on 0G" table after they land.

## Verify source on chainscan

```bash
pnpm --filter @intentos/contracts verify:mainnet
```

If the Blockscout API rejects the plugin, verify manually at https://chainscan.0g.ai.

Constructor args:

- `IntentRegistry(admin, oracle)`
- `DemoVault(registry)`
- `VerificationMeter(admin, settler, priceWei)`
- `CertificateConsumer(registry)`
- `IntentExecutor(registry, challengeDelay)`
- `IntentBounty(registry)`
- `IntentosAgenticIdV2(oracle)`
