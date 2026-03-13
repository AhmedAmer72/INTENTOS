# Judge walkthrough

Unaided path from brief §39.

1. Open the landing page, then **Open studio**. Confirm the live-status rail: Router, Storage, Registry, Vault, Oracle, Agent ID.
2. Connect a wallet on 0G Galileo (or mainnet). Compile is refused without it.
3. Enter *Deploy $5,000 USDC into a low-risk yield opportunity for 14 days. No leverage.* Compile. Inspect hard vs soft constraints.
4. Sign & `registerIntent`.
5. **Greedy — maximize yield** (live 0G Compute, not canned JSON).
6. Verify → REJECT, per-constraint failures, 0G Storage evidence root.
7. Attempt `DemoVault.deposit` → transaction reverts `IntentNotApproved` on 0G. That revert is the product. Leave the Studio executor checkbox **unchecked** for this beat.
8. **Replan — obey constraints**. Verify → APPROVE. Oracle `recordVerification` posts automatically.
9. Deposit succeeds. Open the certificate / proof page.
10. Confirm intent hash, envelope root, evidence content re-hash, and verification record against [chainscan](https://chainscan.0g.ai) (mainnet) or [Galileo](https://chainscan-galileo.0g.ai).
11. Deposit meter credits if the rail shows Meter. Verify writes a `Debited` tx on VerificationMeter.
12. On the certificate page, **Present certificate** (second click reverts `AlreadyConsumed`). Give ERC-8004 feedback from a wallet that does **not** own agent 361.

Optional Wave 6: check **Bind IntentExecutor** on a later verify. Proof shows Execute (900s challenge delay). DemoVault.deposit on that attestation reverts `BindingMismatch`. `/market` can fund/claim `IntentBounty` after A2A APPROVE. `/console` can transfer Agentic ID v2 with an oracle proof.

## Second beat — agent-to-agent (`/market`)

1. Compile the same intent as Agent A (`REQUIREMENT_AGENT_ID`).
2. Register the envelope.
3. Ask Agent B greedy → Verify A2A → REJECT.
4. Replan → APPROVE, meter debit, certificate.
5. Or run the SDK with no UI: `pnpm --filter @intentos/agent-sdk example:a2a` (set `PRINCIPAL`).

## Multi-step (`/playbook`)

Step 2 Verify stays disabled until step 1 is APPROVE on-chain. `DemoVault.deposit` only on the final step.

`/console` lists both runs and the latest 0G Storage batch root. DA is deferred; the batch log is the append-only execution log.

## Copy-paste verification (no UI)

```bash
# from repo root, API running on :8787
curl -s http://127.0.0.1:8787/ready
curl -s http://127.0.0.1:8787/health
```

`/ready` must be `"ok": true` before the rest will succeed.

```bash
PRINCIPAL=0xYourConnectedWallet

curl -s http://127.0.0.1:8787/compile -H 'content-type: application/json' \
  -d "{\"text\":\"Deploy \$5,000 USDC into a low-risk yield opportunity for 14 days. No leverage.\",\"principal\":\"$PRINCIPAL\"}"
```

Take `envelope` from that response.

```bash
# greedy (usually REJECT)
curl -s http://127.0.0.1:8787/agent/propose -H 'content-type: application/json' \
  -d '{"intent":ENVELOPE,"mode":"greedy"}'

# POST /verify with intent + action + amountWei → verdict REJECT

# replan (usually APPROVE)
curl -s http://127.0.0.1:8787/agent/propose -H 'content-type: application/json' \
  -d '{"intent":ENVELOPE,"mode":"replan"}'

# POST /verify → verdict APPROVE, storageUploaded true, attest.txHash set
```

## What is not mocked

- 0G Compute Router for compile, agent propose, and Layer 2
- 0G Storage evidence upload
- Constraint evaluation
- Verdict monotonicity (Layer 1 hard FAIL is terminal REJECT)
- Contract gate (`IntentNotApproved`)
- EIP-712 register + oracle `recordVerification`
- Hashing (JCS + keccak, matched in Solidity `HashProbe`)

There is no offline demo. Missing keys or contracts surface as 503/502 and a red status rail.
