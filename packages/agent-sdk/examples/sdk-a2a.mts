/**
 * Judge-facing SDK proof: Agent B greedy-rejects then replans against Agent A's envelope.
 *
 *   pnpm --filter @intentos/agent-sdk exec tsx examples/sdk-a2a.mts
 */
import { createIntentosClient } from "../src/index.js";

const API = process.env.INTENTOS_API ?? "http://127.0.0.1:8787";
const PRINCIPAL = process.env.PRINCIPAL as `0x${string}` | undefined;

async function main() {
  const client = createIntentosClient({ baseUrl: API });
  const ready = await client.ready();
  console.log("ready", ready.ok);
  if (!ready.ok) {
    console.log(ready.checks.filter((c) => !c.ok));
    throw new Error("API /ready is not ok — fix the status rail first");
  }
  if (!PRINCIPAL) {
    console.log("Set PRINCIPAL=0xYourWallet to compile a live envelope. Stopping after ready().");
    return;
  }
  const compiled = await client.compile(
    "Deploy $5,000 USDC into a low-risk yield opportunity for 14 days. No leverage.",
    PRINCIPAL,
  );
  console.log("compiled", compiled.intentHash, "challenge", compiled.challenge);
  const greedy = await client.offer(compiled.envelope, "greedy");
  const reject = await client.verifyA2A({
    requirement: compiled.envelope,
    offer: greedy.action,
    payer: PRINCIPAL,
    amountWei: "100000000000000",
  });
  console.log("greedy verdict", reject.result.verdict);
  const replan = await client.offer(compiled.envelope, "replan");
  const approve = await client.verifyA2A({
    requirement: compiled.envelope,
    offer: replan.action,
    payer: PRINCIPAL,
    amountWei: "100000000000000",
  });
  console.log("replan verdict", approve.result.verdict);
  console.log("attest", approve.attest);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
