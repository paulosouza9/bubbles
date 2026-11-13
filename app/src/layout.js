// Deterministic bubble layout: biggest in the middle, the rest on a spiral, then pushed
// apart until nothing overlaps. Same input, same picture, every time.
export function computeLayout(bubbles, portrait = false) {
  const sorted = [...bubbles].sort((a, b) => b.weight - a.weight);
  const [fx, fy] = portrait ? [0.8, 1.3] : [1.25, 0.8];
  const nodes = sorted.map((b, i) => {
    const r = 0.72 + b.weight * 0.95;
    const angle = i * 2.399963;
    const dist = i === 0 ? 0 : 1.9 * Math.sqrt(i);
    return { id: b.id, r, x: Math.cos(angle) * dist * fx, y: Math.sin(angle) * dist * fy, z: ((i * 37) % 9) / 9 - 0.5 };
  });
  for (let step = 0; step < 300; step++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.001;
        const min = a.r + b.r + 0.42;
        if (d < min) {
          const push = (min - d) / 2;
          const ux = dx / d;
          const uy = dy / d;
          const wa = i === 0 ? 0.15 : 1;
          a.x -= ux * push * wa;
          a.y -= uy * push * wa;
          b.x += ux * push;
          b.y += uy * push;
        }
      }
    }
    for (const n of nodes) {
      n.x *= portrait ? 0.986 : 0.992;
      n.y *= portrait ? 0.994 : 0.988;
    }
  }
  const cx = nodes.reduce((s, n) => s + n.x, 0) / nodes.length;
  const cy = nodes.reduce((s, n) => s + n.y, 0) / nodes.length;
  for (const n of nodes) {
    n.x -= cx;
    n.y -= cy;
  }
  const radius = Math.max(...nodes.map((n) => Math.hypot(n.x, n.y) + n.r));
  const halfW = Math.max(...nodes.map((n) => Math.abs(n.x) + n.r));
  const halfH = Math.max(...nodes.map((n) => Math.abs(n.y) + n.r));
  return { nodes, byId: Object.fromEntries(nodes.map((n) => [n.id, n])), radius, halfW, halfH };
}

export const DECOR = [
  { id: "d1", weight: 1 },
  { id: "d2", weight: 0.8 },
  { id: "d3", weight: 0.7 },
  { id: "d4", weight: 0.62 },
  { id: "d5", weight: 0.55 },
  { id: "d6", weight: 0.5 },
];
