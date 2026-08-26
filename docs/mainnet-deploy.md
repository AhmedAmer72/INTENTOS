# Mainnet deployment (Wave 3)

Wave 3 judging requires a **0G mainnet** contract address, explorer activity, and verified source.

## Prerequisites

1. `DEPLOYER` funded on chain 16661 — see [provisioning.md](provisioning.md)
2. `VERIFIER_ORACLE` address known (does not need gas if the deployer submits attestations, but the oracle key must sign)
3. `.env` filled: `ZEROG_NETWORK=mainnet`, keys, `ZEROG_MAINNET_RPC`

## Deploy

```bash
pnpm contracts:compile
pnpm contracts:deploy:mainnet
```

This writes `packages/contracts/deployments/mainnet.json` with `IntentRegistry` and `DemoVault`.

Copy addresses into root `.env`:

```
INTENT_REGISTRY_ADDRESS=0x...
DEMO_VAULT_ADDRESS=0x...
VITE_CHAIN_ID=16661
ZEROG_NETWORK=mainnet
```

## Verify source on chainscan

```bash
pnpm --filter @intentos/contracts verify:mainnet
```

If the Blockscout API rejects the plugin, verify manually at https://chainscan.0g.ai:

- Compiler: `0.8.24`
- EVM: `cancun`
- Optimizer: yes, 200 runs
- Constructor args: `IntentRegistry(admin, oracle)`, `DemoVault(registry)`

## Required on-chain activity for judges

1. `registerIntent` for the demo envelope
2. `recordVerification` REJECT for the greedy proposal (optional but good)
3. `DemoVault.deposit` **revert** `IntentNotApproved` for that action — the most important screenshot
4. `recordVerification` APPROVE for the replanned proposal
5. `DemoVault.deposit` success

Paste tx hashes into the README "Live on 0G" table after they land.

## ERC-8004 agent

```bash
pnpm --filter @intentos/contracts register-agent:mainnet
```

Set `AGENT_ID` to the returned bytes32.
