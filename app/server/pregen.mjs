// Generates and caches the wording for every family (one small model call each).
// Run once: `npm run pregen`. The result is saved in data/generated/ and reused.
import { listCaseIds } from "./cases.mjs";
import { spend } from "./llm.mjs";
import { buildPlan } from "./script.mjs";

for (const id of await listCaseIds()) {
  const plan = await buildPlan(id);
  console.log(`${id}: wording by ${plan.generatedBy}, ${plan.bubbles.length} bubbles, ${plan.missionPool.length} possible missions`);
}
console.log("Spend so far (USD):", spend().totalUsd.toFixed(4));
process.exit(0);
