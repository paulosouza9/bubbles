// "Guess before you see": in at most two bubbles, the person guesses one everyday number before
// it is revealed. Only numbers that are taken straight from the plan, and only ones that are
// fine to discover as a game (no "when does the money run out" here).
const months = (v) => `${Number.isInteger(v) ? v : v.toFixed(1)} month${v === 1 ? "" : "s"}`;

export function guessFor(b) {
  const d = b?.miniapp?.data || {};
  if (b?.miniapp?.template === "tank" && typeof d.months === "number") {
    return {
      q: "If your pay stopped tomorrow, how many months would your cash last?",
      min: 0,
      max: 24,
      step: 0.5,
      start: 6,
      real: d.months,
      show: months,
    };
  }
  if (b?.miniapp?.template === "buckets" && typeof d.savingsRate === "number") {
    return {
      q: "Out of every $100 you earn, how much do you put aside?",
      min: 0,
      max: 50,
      step: 1,
      start: 10,
      real: Math.round(d.savingsRate * 100),
      show: (v) => `$${Math.round(v)}`,
    };
  }
  return null;
}

// Warm and honest, whatever the guess: being close is celebrated, being off is just news.
export function guessVerdict(g, value) {
  const near = Math.abs(value - g.real) <= (g.max - g.min) * 0.08;
  if (near) return { near: true, head: "Spot on!", line: `It is ${g.show(g.real)}. You know your money.` };
  if (value < g.real) return { near: false, head: "More than you guessed.", line: `It is ${g.show(g.real)}.` };
  return { near: false, head: "A bit less than you guessed.", line: `It is ${g.show(g.real)}. Step inside to see why.` };
}
