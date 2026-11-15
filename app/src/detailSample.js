// Where the detailed view is drawn on screen, as points with colours: every bar, band, line,
// big figure and the text. The 3D particles fly to these points when the simple toy turns
// into the charts, and start from them when the charts turn back into the toy.
// (Plain DOM, no three.js, so the page can use it without loading the 3D code.)
let cache = [];
export const getDetailCache = () => cache;

const SHAPES = ".detail-grid svg rect, .detail-grid svg path, .detail-grid svg circle, .detail-grid svg line, .detail-grid svg polygon, .detail-grid svg polyline";
const TEXTS = ".detail-grid svg text, .detail-grid .dbig b, .d-text";

function visibleColour(c) {
  return c && c !== "none" && !/rgba\([^)]*,\s*0\)$/.test(c) && c !== "transparent";
}

export function sampleDetail(max = 760, freeze = true) {
  const root = document.querySelector(".inside.deeper");
  const scroll = root?.querySelector(".detail-scroll");
  if (!scroll) return [];
  // Measure the final layout: entrance animations (bars growing, fades) are switched off for
  // the instant of measuring, then switched back on.
  // (Only while they are still running: switching them off later would replay them.)
  if (freeze) {
    root.classList.add("measuring");
    void root.offsetHeight;
  }
  const view = scroll.getBoundingClientRect();
  const items = [];
  for (const el of scroll.querySelectorAll(`${SHAPES}, ${TEXTS}`)) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 && r.height < 1) continue;
    if (r.bottom < view.top || r.top > view.bottom) continue;
    const svgShape = el instanceof SVGGeometryElement;
    const cs = getComputedStyle(el);
    const fill = svgShape || el instanceof SVGTextElement ? cs.fill : cs.color;
    const hasFill = visibleColour(fill);
    const hasStroke = svgShape && visibleColour(cs.stroke) && parseFloat(cs.strokeWidth) > 0;
    if (!hasFill && !hasStroke) continue;
    // Skip backgrounds that fill the whole chart.
    if (r.width * r.height > view.width * view.height * 0.5) continue;
    const isText = !svgShape;
    const area = Math.max(60, r.width * r.height) * (isText ? 0.12 : 1);
    items.push({ el, r, area, svgShape, hasFill, colour: hasFill ? fill : cs.stroke });
  }
  const out = [];
  const total = items.reduce((a, b) => a + b.area, 0);
  if (total) {
    for (const it of items) pointsOf(it, Math.max(2, Math.round((it.area / total) * max)), out, view);
  }
  if (freeze) root.classList.remove("measuring");
  if (out.length) cache = out;
  return out;
}

function pointsOf(it, n, out, view) {
  const { el, r } = it;
  const push = (x, y) => {
    if (y >= view.top && y <= view.bottom) out.push({ x, y, colour: it.colour });
  };
  const m = it.svgShape ? el.getScreenCTM() : null;
  if (m) {
    // Lines and outlines: points along the stroke. Shapes: points inside the fill.
    if (!it.hasFill && el.getTotalLength) {
      const L = el.getTotalLength();
      for (let i = 0; i < n; i++) {
        const p = el.getPointAtLength(Math.random() * L).matrixTransform(m);
        push(p.x, p.y);
      }
      return;
    }
    const b = el.getBBox();
    let got = 0;
    for (let tries = 0; got < n && tries < n * 6; tries++) {
      const x = b.x + Math.random() * b.width;
      const y = b.y + Math.random() * b.height;
      if (el.isPointInFill && !el.isPointInFill(new DOMPoint(x, y))) continue;
      const p = new DOMPoint(x, y).matrixTransform(m);
      push(p.x, p.y);
      got++;
    }
    return;
  }
  for (let i = 0; i < n; i++) push(r.left + Math.random() * r.width, r.top + Math.random() * r.height);
}

// Kept up to date while the detail is open, so the way back starts from what was on screen.
export function refreshDetailCache() {
  sampleDetail(760, false);
}
