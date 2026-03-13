# Mainnet deployment (Aristotle, chain 16661)

**Deployed.** Live addresses are in `packages/contracts/deployments/mainnet.json` and the README Aristotle table.

Do **not** point these scripts at the live Galileo registry (`0xfdDe…7Fb9`). Do **not** redeploy the Aristotle registry/vault unless you intend a new stack.

| Contract | Address |
| --- | --- |
| IntentRegistry | `0x8FB1A3CFf48EC873Ef0526A902425813979c7b9e` |
| DemoVault | `0xcf6a53b0A22989Ad6B1834C7844CfB9B0d3A9125` |
| VerificationMeter | `0xaBfbe94121DC9BD17056642b9Cf79d93498bfA8A` |
| CertificateConsumer | `0x95F9098bB17A79a7be6100D269a668DEf40527EE` |
| IntentosAgenticId | `0x1BF7e38D0670C856f64326bc4Fc4D9C281e5F087` token `#1` |
| IntentExecutor | `0x22535C947Fd951bbC6C03f8D8A1159ad3a159c46` |
| SettlementTarget | `0x744E0ba6660E98074f30ef8Ad267aF914e222f7a` |
| IntentBounty | `0xE8814DC8a9d5c37beC6AeBD232815cEaeCAE753F` |
| IntentosAgenticIdV2 | `0x29d376Fa105333946d8Aa989C66579f55223De32` token `#1` |
| ERC-8004 Agent B | `3537786` (`0x…35fb7a`) |
| ERC-8004 Agent A | `3537791` (`0x…35fb7f`) |

Local wire: `ZEROG_NETWORK=mainnet`, `VITE_CHAIN_ID=16661`, plus the addresses above.

## Re-run (only for a new stack)

```bash
pnpm contracts:compile
pnpm contracts:deploy:mainnet
pnpm contracts:deploy:wave45:mainnet
pnpm contracts:deploy:wave6:mainnet
pnpm --filter @intentos/contracts register-agent:mainnet
pnpm --filter @intentos/contracts mint-agentic-id-v2:mainnet
pnpm --filter @intentos/contracts verify:mainnet
```

Wave 6 refuses to deploy registry/vault. Mainnet 8004 ids are not Galileo 361/362.

## Compute

Official mainnet Router is `https://router-api.0g.ai/v1` (`qwen3.8-flash` is TEE-attested there). A Galileo `sk-` key can list models but **cannot** complete. Create a key + deposit at https://pc.0g.ai, then set:

```
ZEROG_ROUTER_URL_MAINNET=https://router-api.0g.ai/v1
ZEROG_ROUTER_MODEL=qwen3.8-flash
ZEROG_ROUTER_API_KEY=sk-…
```

Until that key exists, local compile/verify can keep using the Galileo Router URL with the existing testnet `sk-`.

## Hosting cutover

Render (API):

- `ZEROG_NETWORK=mainnet`
- `ZEROG_MAINNET_RPC=https://evmrpc.0g.ai`
- All Aristotle addresses and agent ids from the table
- Router key (mainnet `sk-` when you have one)
- Restart. Confirm `GET /ready` → `"ok": true`, `chainId: 16661`

Vercel (web):

- `VITE_API_URL` = Render origin (no trailing slash)
- `VITE_CHAIN_ID=16661`
- Redeploy the web so the client bundle picks up the new chain

Do not mix Galileo addresses with `VITE_CHAIN_ID=16661`.

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
