// Projected score after a set of completed moves. Uses only what Sherpas published:
// a single move's score_after, or a published combination. Never interpolates.
export function projectedScore(plan, doneMoveIds) {
  const done = plan.moves.filter((m) => doneMoveIds.includes(m.id));
  const base = plan.score.value;
  if (!done.length) return { score: base, basis: "none" };
  if (done.length === 1) return { score: done[0].score_after, basis: "single" };
  const titles = done.map((m) => m.planTitle || m.title).sort().join("|");
  const combo = (plan.combinedMoves || []).find((c) => [...c.moves].sort().join("|") === titles);
  if (combo) return { score: combo.score_after, basis: "combined", note: combo.note };
  return { score: Math.max(...done.map((m) => m.score_after)), basis: "best-single" };
}
