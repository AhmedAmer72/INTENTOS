# 3-minute demo script

Record in one take. Do not pause to explain infrastructure.

**Setup:** landing at localhost:3000. Open **studio**. Galileo in MetaMask. Live-status rail all live (Router, Storage, Registry, Vault, Oracle, Agent ID). Wallet connected.

| Time | Shot |
| --- | --- |
| 0:00–0:15 | Title. "INTENTOS — agents decide how, humans decide what." Status rail live. |
| 0:15–0:40 | Intent: *Deploy $5,000 USDC into a low-risk yield opportunity for 14 days. No leverage.* **Compile on 0G**. Constraint chips appear. |
| 0:40–0:55 | **Sign & registerIntent**. Explorer link. |
| 0:55–1:15 | **Greedy — maximize yield**. Live plan (not canned Strategy B). Likely over capital / leverage. |
| 1:15–1:40 | **Verify on 0G**. Layer 1 FAILs. Stamp **REJECT**. |
| 1:40–1:55 | **DemoVault.deposit** — wallet reverts `IntentNotApproved`. This is the product. |
| 1:55–2:20 | **Replan — obey constraints**. Verify → stamp **APPROVE**. Storage root + attestation tx. |
| 2:20–2:40 | Deposit succeeds. Open **certificate**. Point at intent hash, action hash, 0G Storage root, client re-hash MATCH. |
| 2:40–3:00 | Close: *A valid transaction that violates intent is still a violation.* Cut. |

Do not spend the video on architecture diagrams. The revert is the demo.
