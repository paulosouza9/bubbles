// The guided path through a plan: three bubbles instead of all of them.
//   1. What's working   the strongest area
//   2. What needs you   the area where the plan's first step does the most
//   3. Your next steps  the missions
// Every other topic stays one zoom away, in "All topics".
export function pathOf(plan) {
  if (!plan) return [];
  const byId = Object.fromEntries(plan.bubbles.map((b) => [b.id, b]));
  const best = plan.order[0];
  const gain = (id) => Math.max(0, ...plan.moves.filter((m) => m.bubbleId === id).map((m) => m.score_after - m.score_before));
  const candidates = plan.order.filter((id) => id !== best && id !== "score" && byId[id]);
  const sev = (id) => ({ red: 2, amber: 1, green: 0 })[byId[id].status] ?? 0;
  const needs = [...candidates].sort((a, b) => gain(b) - gain(a) || sev(b) - sev(a))[0];
  return [best, needs, "steps"].filter(Boolean);
}

export const ROLE = { 0: "What's working", 1: "What needs you most", 2: "Your plan of action" };
