// "Your way forward" for a bubble. When the plan has a step for this topic, the line is built
// from that step and its own score change, never from generated wording (a generated line
// could tie a score change to the wrong step). Otherwise the warm, generated line is used.
export function hopeFor(b, plan) {
  const move = plan.moves.find((m) => m.bubbleId === b.id);
  if (move) {
    return move.score_after !== move.score_before
      ? `${move.title}: your score goes from ${move.score_before} to ${move.score_after}.`
      : `${move.title}. It is one of the steps your plan suggests, and it counts together with the others.`;
  }
  return b.emotion?.hope || null;
}
