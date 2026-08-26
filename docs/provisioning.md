# Provisioning 0G resources

INTENTOS cannot ship a Wave 3 submission without **mainnet** 0G for gas, storage, and Compute Router deposits. Start this on day one. Development proceeds on Galileo testnet in parallel.

## 1. Wallets

Two dedicated keypairs. Never reuse a personal wallet.

```bash
pnpm provision
```

This writes gitignored `.wallets.json` and fills `DEPLOYER_PRIVATE_KEY` / `VERIFIER_ORACLE_PRIVATE_KEY` in `.env`.

| Role | Purpose |
| --- | --- |
| `DEPLOYER` | Contract owner, `DEFAULT_ADMIN_ROLE` |
| `VERIFIER_ORACLE` | Signs EIP-712 verification attestations; granted `VERIFIER_ROLE` |

Check balances:

```bash
pnpm balances
```

## 2. Galileo testnet (chain 16602)

Add to MetaMask:

| Field | Value |
| --- | --- |
| Network | 0G Galileo Testnet |
| Chain ID | `16602` (`0x40DA`) |
| RPC | `https://evmrpc-testnet.0g.ai` |
| Symbol | `0G` |
| Explorer | `https://chainscan-galileo.0g.ai` |

Faucets:

- https://faucet.0g.ai — 0.1 0G / day. Start the daily drip immediately.
- https://cloud.google.com/application/web3/faucet/0g/galileo — larger Google Cloud grant.

Import both private keys into a throwaway MetaMask profile to claim.

## 3. Mainnet Aristotle (chain 16661)

Wave 3 requires a **mainnet contract address** and explorer activity.

| Field | Value |
| --- | --- |
| Network | 0G Mainnet |
| Chain ID | `16661` (`0x4115`) |
| RPC | `https://evmrpc.0g.ai` |
| Symbol | `0G` |
| Explorer | `https://chainscan.0g.ai` |

Acquire 0G:

1. Interactive guide: https://get.0g.ai
2. CEX withdraw to network **"0G Chain" / "0G Mainnet"**
3. Bridge: https://xswap.link/bridge?toChain=16661

Budget a small amount of native 0G for:

- contract deploy + a handful of register/verify/settle txs
- 0G Storage uploads (intent + evidence blobs)
- Compute Router deposit at https://pc.0g.ai

## 4. Compute Router API keys

Mainnet and testnet are **separate** balances and keys.

| Network | UI | API |
| --- | --- | --- |
| Testnet | https://pc.testnet.0g.ai | `https://router-api-testnet.integratenetwork.work/v1` |
| Mainnet | https://pc.0g.ai | `https://router-api.0g.ai/v1` |

Connect wallet → Deposit 0G → Dashboard → API Keys → create an `sk-` key with inference permission.

Put it in `ZEROG_ROUTER_API_KEY`. Pin a TEE-attested model via `GET /v1/models` into `ZEROG_ROUTER_MODEL`.

Without a key, `GET /ready` is red and `POST /compile`, `/agent/propose`, and `/verify` return **503**. There is no regex-only or skipped-Layer-2 demo.

## 5. ERC-8004 agent registration

Identity registries are already deployed by 0G. After the deployer wallet is funded:

```bash
pnpm --filter @intentos/contracts register-agent:galileo
pnpm --filter @intentos/contracts register-agent:mainnet
```

Copy the returned `agentId` into `AGENT_ID`.

## 6. Acceptance

T1 is complete when:

- [x] Two fresh wallets exist and are gitignored
- [ ] Both funded on Galileo
- [ ] Deployer funded on mainnet
- [ ] Router `sk-` keys created (testnet for dev, mainnet for the demo)
- [ ] Env vars documented in `.env.example` and filled locally
