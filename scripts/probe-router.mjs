// Diagnostic: test whether Node's happy-eyeballs attempt timeout is what kills
// Router connections on a slow link.
import { config as loadEnv } from "dotenv";
import net from "node:net";

loadEnv();

const baseURL = process.env.ZEROG_ROUTER_URL_MAINNET ?? "https://router-api.0g.ai/v1";
const apiKey = process.env.ZEROG_ROUTER_API_KEY;

console.log("default autoSelectFamilyAttemptTimeout:", net.getDefaultAutoSelectFamilyAttemptTimeout?.());

async function tryModels(label) {
  const t = Date.now();
  try {
    const res = await fetch(`${baseURL}/models`, { headers: { authorization: `Bearer ${apiKey}` } });
    console.log(`  ${label}: HTTP ${res.status} in ${Date.now() - t}ms`);
    await res.text();
    return true;
  } catch (err) {
    console.log(`  ${label}: FAILED ${err.cause?.code ?? err.message} in ${Date.now() - t}ms`);
    return false;
  }
}

console.log("\nwith default (250ms):");
for (let i = 0; i < 3; i++) await tryModels(`attempt ${i + 1}`);

net.setDefaultAutoSelectFamilyAttemptTimeout(5000);
console.log("\nafter setDefaultAutoSelectFamilyAttemptTimeout(5000):");
for (let i = 0; i < 3; i++) await tryModels(`attempt ${i + 1}`);
