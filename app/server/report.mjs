// The whole plan as a PDF: a cover, the plan at a glance, what it recommends, every topic in
// plain words and in detail, and the person's progress. Every figure comes from the plan, as
// everywhere else in the app; the only things computed here are the geometry of the drawing.
import PDFDocument from "pdfkit";
import { projectedScore } from "../shared/score.js";

const C = {
  ink: "#1d1d1f",
  body: "#3a3a3c",
  grey: "#6e6e73",
  line: "#e5e5ea",
  fill: "#f5f5f7",
  blue: "#0071e3",
  blueSoft: "#eef4fc",
  amberSoft: "#fff6e8",
  track: "#ececf0",
};
// Dots and bars use the app's colours; words use darker shades that read well on white paper.
const STATUS = {
  red: { word: "Room to grow", dot: "#ff3b30", text: "#c4170c" },
  amber: { word: "Almost there", dot: "#ff9f0a", text: "#a35200" },
  green: { word: "In good shape", dot: "#34c759", text: "#1f7a36" },
  neutral: { word: "For reference", dot: "#8e8e93", text: "#6e6e73" },
};
const st = (s) => STATUS[s] || STATUS.neutral;
const BAND = { critical: "Critical", vulnerable: "Vulnerable", stable: "Stable", strong: "Strong" };

const M = { l: 56, r: 56, t: 70, b: 70 };
const PAGE_W = 612; // US Letter
const W = PAGE_W - M.l - M.r;
const SANS = "Helvetica";
const BOLD = "Helvetica-Bold";
const ITALIC = "Helvetica-Oblique";

// The built-in PDF fonts cover Latin-1 and a few typographic marks. Anything else is spelled out
// or dropped, so nothing ever prints as a stray box.
function clean(s) {
  return String(s ?? "")
    .replace(/[→⟶➔]/g, "to")
    .replace(/≈/g, "about ")
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/[   ]/g, " ")
    .replace(/[^\x09\x0a\x0d\x20-\x7e\xa0-\xff–—‘’“”•…€™]/g, "")
    .trim();
}
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const pts = (p) => {
  const m = String(p || "").match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  return m ? { got: Number(m[1]), of: Number(m[2]) } : null;
};

export function buildReport(plan, state = {}) {
  const date = new Date();
  const dateText = date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const title = `${plan.label}'s financial plan`;
  const doc = new PDFDocument({
    size: "LETTER",
    margins: { top: M.t, bottom: M.b, left: M.l, right: M.r },
    bufferPages: true,
    info: { Title: title, Author: "Financial Coach", Subject: "A summary of your Sherpas plan", CreationDate: date },
  });

  const bottom = () => doc.page.height - M.b;
  const ensure = (h) => {
    if (doc.y + h > bottom()) doc.addPage();
  };
  const gap = (h) => {
    doc.y += h;
  };

  // ---- Text building blocks -----------------------------------------------------------------
  const label = (t, color = C.grey) => {
    ensure(34);
    doc.font(BOLD).fontSize(7.5).fillColor(color).text(clean(t).toUpperCase(), M.l, doc.y, { width: W, characterSpacing: 0.8 });
    gap(4);
  };
  const para = (t, { size = 10.5, color = C.body, font = SANS, x = M.l, width = W, after = 8 } = {}) => {
    const s = clean(t);
    if (!s) return;
    doc.font(font).fontSize(size).fillColor(color);
    ensure(Math.min(doc.heightOfString(s, { width, lineGap: 2.5 }), 48));
    doc.text(s, x, doc.y, { width, lineGap: 2.5 });
    gap(after);
  };
  const bullets = (items, { numbered = false, size = 10.5, x = M.l, width = W } = {}) => {
    items.map(clean).filter(Boolean).forEach((s, i) => {
      doc.font(SANS).fontSize(size);
      ensure(Math.min(doc.heightOfString(s, { width: width - 18, lineGap: 2.5 }), 40));
      const y = doc.y;
      if (numbered) doc.font(BOLD).fontSize(size).fillColor(C.blue).text(`${i + 1}.`, x, y, { width: 16, lineBreak: false });
      else doc.circle(x + 4, y + size * 0.5, 1.9).fill(C.blue);
      doc.font(SANS).fontSize(size).fillColor(C.body).text(s, x + 18, y, { width: width - 18, lineGap: 2.5 });
      gap(5);
    });
    gap(3);
  };
  // A soft box with a coloured edge, for the things the plan says not to miss.
  const callout = (heading, items, { tint = C.blueSoft, edge = C.blue } = {}) => {
    const lines = items.map(clean).filter(Boolean);
    if (!lines.length) return;
    const pad = 12;
    const iw = W - pad * 2 - 4;
    doc.font(SANS).fontSize(10);
    const bodyH = lines.reduce((h, s) => h + doc.heightOfString(lines.length > 1 ? `• ${s}` : s, { width: iw, lineGap: 2 }) + 4, 0);
    const h = pad * 2 + 14 + bodyH;
    ensure(Math.min(h, 200));
    const y = doc.y;
    doc.roundedRect(M.l, y, W, h, 6).fill(tint);
    doc.rect(M.l, y, 3.5, h).fill(edge);
    doc.font(BOLD).fontSize(9).fillColor(edge).text(clean(heading), M.l + pad + 4, y + pad, { width: iw });
    doc.y = y + pad + 15;
    for (const s of lines) {
      doc.font(SANS).fontSize(10).fillColor(C.ink).text(lines.length > 1 ? `• ${s}` : s, M.l + pad + 4, doc.y, { width: iw, lineGap: 2 });
      gap(4);
    }
    doc.y = y + h + 12;
  };

  // A table that measures every row, so long text wraps and rows never split across pages. A table
  // that fits on one page is kept whole, together with its heading (drawn by `before`).
  const table = (cols, rows, { size = 9.5, before = null, beforeH = 0 } = {}) => {
    if (!rows.length) return;
    const widths = cols.map((c) => c.w * W);
    const pad = 6;
    const total = rows.reduce((sum, row) => {
      const hs = row.map((v, i) => {
        const c = v && typeof v === "object" ? v : { text: v };
        doc.font(c.bold || cols[i].bold ? BOLD : SANS).fontSize(size);
        return doc.heightOfString(clean(c.text) || " ", { width: widths[i] - pad * 2 - (c.dot ? 11 : 0), lineGap: 1.5 });
      });
      return sum + Math.max(...hs) + pad * 2;
    }, 20 + beforeH);
    if (doc.y + total > bottom() && total < bottom() - M.t) doc.addPage();
    before?.();
    const head = () => {
      const y = doc.y;
      doc.rect(M.l, y, W, 20).fill(C.fill);
      let x = M.l;
      cols.forEach((c, i) => {
        doc.font(BOLD).fontSize(7.5).fillColor(C.grey).text(c.label.toUpperCase(), x + pad, y + 7, { width: widths[i] - pad * 2, align: c.align || "left", characterSpacing: 0.5, lineBreak: false });
        x += widths[i];
      });
      doc.y = y + 20;
    };
    ensure(50);
    head();
    for (const row of rows) {
      const cells = row.map((v) => (v && typeof v === "object" ? { ...v, text: clean(v.text) } : { text: clean(v) }));
      const font = (c, i) => (c.bold || cols[i].bold ? BOLD : SANS);
      const hs = cells.map((c, i) => {
        doc.font(font(c, i)).fontSize(size);
        return doc.heightOfString(c.text || " ", { width: widths[i] - pad * 2 - (c.dot ? 11 : 0), lineGap: 1.5 });
      });
      const h = Math.max(...hs) + pad * 2;
      if (doc.y + h > bottom()) {
        doc.addPage();
        head();
      }
      const y = doc.y;
      let x = M.l;
      cells.forEach((c, i) => {
        const off = c.dot ? 11 : 0;
        if (c.dot) doc.circle(x + pad + 3.5, y + pad + size * 0.45, 3.5).fill(c.dot);
        doc.font(font(c, i)).fontSize(size).fillColor(c.color || cols[i].color || C.ink).text(c.text, x + pad + off, y + pad, { width: widths[i] - pad * 2 - off, align: cols[i].align || "left", lineGap: 1.5 });
        x += widths[i];
      });
      doc.moveTo(M.l, y + h).lineTo(M.l + W, y + h).lineWidth(0.5).strokeColor(C.line).stroke();
      doc.y = y + h;
    }
    doc.x = M.l;
    gap(14);
  };

  // Each part opens on a fresh page with a number, a title and a short line on what it holds.
  const sections = [];
  const section = (title, intro) => {
    doc.addPage();
    sections.push({ title, page: doc.bufferedPageRange().count });
    doc.font(BOLD).fontSize(8).fillColor(C.blue).text(`PART ${sections.length}`, M.l, doc.y, { characterSpacing: 1 });
    gap(4);
    doc.font(BOLD).fontSize(24).fillColor(C.ink).text(title, M.l, doc.y, { width: W });
    gap(6);
    doc.rect(M.l, doc.y, 36, 3).fill(C.blue);
    gap(14);
    if (intro) para(intro, { size: 11, color: C.grey, after: 16 });
  };
  const subhead = (t, { size = 13, after = 6 } = {}) => {
    ensure(60);
    doc.font(BOLD).fontSize(size).fillColor(C.ink).text(clean(t), M.l, doc.y, { width: W });
    gap(after);
  };

  // ---- Drawings -------------------------------------------------------------------------------
  // The score on a 0 to 100 track, with the projected score after completed steps if it differs.
  const scoreTrack = (x, y, w, score, projected, color) => {
    doc.roundedRect(x, y, w, 9, 4.5).fill(C.track);
    if (projected > score) doc.roundedRect(x, y, (w * projected) / 100, 9, 4.5).fillOpacity(0.35).fill(C.blue).fillOpacity(1);
    doc.roundedRect(x, y, Math.max(9, (w * score) / 100), 9, 4.5).fill(color);
    doc.font(SANS).fontSize(7.5).fillColor(C.grey);
    [0, 50, 100].forEach((v) => doc.text(String(v), x + (w * v) / 100 - 10, y + 14, { width: 20, align: v === 0 ? "left" : v === 100 ? "right" : "center" }));
  };

  // Points per topic, each bar against that topic's own maximum.
  const pointsChart = (topics) => {
    const rows = topics.map((b) => ({ b, p: pts(b.points) })).filter((r) => r.p);
    if (!rows.length) return;
    const labelW = 150;
    const valW = 70;
    const barW = W - labelW - valW;
    ensure(rows.length * 24 + 30);
    for (const { b, p } of rows) {
      const y = doc.y;
      doc.font(SANS).fontSize(9.5).fillColor(C.ink).text(clean(b.title), M.l, y + 1, { width: labelW - 10, lineBreak: false, ellipsis: true });
      doc.roundedRect(M.l + labelW, y + 2, barW, 9, 4.5).fill(C.track);
      if (p.got > 0) doc.roundedRect(M.l + labelW, y + 2, Math.max(9, (barW * p.got) / p.of), 9, 4.5).fill(st(b.status).dot);
      doc.font(BOLD).fontSize(9.5).fillColor(C.ink).text(`${p.got} of ${p.of}`, M.l + labelW + barW, y + 1, { width: valW, align: "right" });
      doc.y = y + 22;
    }
    gap(10);
  };

  // What each step does to the published score: from before to after, on the same 0 to 100 scale.
  const liftChart = (moves) => {
    const rows = moves.filter((m) => Number.isFinite(m.score_before) && Number.isFinite(m.score_after));
    if (!rows.length) return;
    const labelW = 170;
    const valW = 70;
    const barW = W - labelW - valW;
    ensure(rows.length * 24 + 30);
    for (const m of rows) {
      const y = doc.y;
      const a = (barW * m.score_before) / 100;
      const b = (barW * m.score_after) / 100;
      doc.font(SANS).fontSize(9.5).fillColor(C.ink).text(clean(m.title), M.l, y + 1, { width: labelW - 10, lineBreak: false, ellipsis: true });
      doc.roundedRect(M.l + labelW, y + 2, barW, 9, 4.5).fill(C.track);
      doc.roundedRect(M.l + labelW, y + 2, Math.max(9, b), 9, 4.5).fill(STATUS.green.dot);
      doc.roundedRect(M.l + labelW, y + 2, Math.max(9, a), 9, 4.5).fill("#b8b8c0");
      const d = m.score_after - m.score_before;
      doc.font(BOLD).fontSize(9.5).fillColor(d > 0 ? STATUS.green.text : C.grey).text(`${m.score_before} to ${m.score_after}`, M.l + labelW + barW, y + 1, { width: valW, align: "right" });
      doc.y = y + 22;
    }
    doc.font(SANS).fontSize(8).fillColor(C.grey).text("Grey: the published score today. Green: the score the plan shows after that step on its own.", M.l, doc.y, { width: W });
    gap(14);
  };

  // ---- Who and what -------------------------------------------------------------------------
  const done = Object.entries(state.missions?.status || {}).filter(([, s]) => s === "done").map(([id]) => id);
  const doneMoves = done.map((id) => plan.missionPool.find((m) => m.id === id)?.moveId).filter(Boolean);
  const projected = projectedScore(plan, doneMoves).score;
  const topics = [...plan.order, ...plan.bubbles.map((b) => b.id).filter((id) => !plan.order.includes(id))]
    .map((id) => plan.bubbles.find((b) => b.id === id))
    .filter(Boolean);
  const scoreColor = st(plan.score.status);
  const person = clean(state.person) || plan.names[0];

  // ---- Cover ----------------------------------------------------------------------------------
  doc.rect(0, 0, PAGE_W, 8).fill(C.blue);
  doc.font(BOLD).fontSize(9).fillColor(C.ink).text("FINANCIAL COACH", M.l, 48, { characterSpacing: 1.6 });
  doc.font(SANS).fontSize(9).fillColor(C.grey).text(dateText, M.l, 48, { width: W, align: "right" });

  doc.y = 150;
  doc.font(BOLD).fontSize(9).fillColor(C.blue).text("FINANCIAL PLAN SUMMARY", M.l, doc.y, { characterSpacing: 1.2 });
  gap(10);
  doc.font(BOLD).fontSize(34).fillColor(C.ink).text(`${clean(plan.label)}'s plan`, M.l, doc.y, { width: W });
  gap(6);
  doc.font(SANS).fontSize(12).fillColor(C.grey).text([plan.city && plan.state ? `${clean(plan.city)}, ${clean(plan.state)}` : null, `Prepared for ${person}`, dateText].filter(Boolean).join("   ·   "), M.l, doc.y, { width: W });
  gap(18);
  if (plan.texts?.anchor) {
    const q = clean(plan.texts.anchor);
    doc.font(ITALIC).fontSize(12);
    const qh = doc.heightOfString(q, { width: W - 14, lineGap: 3 });
    const qy = doc.y;
    doc.rect(M.l, qy - 2, 2.5, qh + 2).fill(C.blue);
    doc.font(ITALIC).fontSize(12).fillColor(C.body).text(q, M.l + 14, qy, { width: W - 14, lineGap: 3 });
    gap(22);
  }

  // Score card
  const cardY = Math.max(doc.y, 330);
  const cardH = 112;
  doc.roundedRect(M.l, cardY, W, cardH, 10).fill(C.fill);
  doc.font(BOLD).fontSize(7.5).fillColor(C.grey).text("SHERPAS SCORE", M.l + 22, cardY + 20, { characterSpacing: 0.8 });
  doc.font(BOLD).fontSize(46).fillColor(C.ink).text(String(plan.score.value), M.l + 22, cardY + 34, { lineBreak: false });
  const numW = doc.widthOfString(String(plan.score.value));
  doc.font(SANS).fontSize(14).fillColor(C.grey).text("/ 100", M.l + 26 + numW, cardY + 59, { lineBreak: false });
  doc.font(BOLD).fontSize(11).fillColor(scoreColor.text).text(BAND[plan.score.band] || cap(plan.score.band || ""), M.l + 22, cardY + 86);
  const gx = M.l + 190;
  const gw = W - 190 - 24;
  doc.font(SANS).fontSize(9.5).fillColor(C.body).text(clean(plan.texts?.city || ""), gx, cardY + 20, { width: gw, lineGap: 2, height: 40, ellipsis: true });
  scoreTrack(gx, cardY + 66, gw, plan.score.value, projected, scoreColor.dot);
  if (projected !== plan.score.value) {
    doc.font(BOLD).fontSize(8.5).fillColor(C.blue).text(`Projected ${projected} after the steps you have completed`, gx, cardY + 92, { width: gw });
  }

  // Household
  doc.y = cardY + cardH + 26;
  label("Household");
  const roleWord = { client: "Client", "co-client": "Co-client", child: "Child", dependent: "Dependent" };
  table(
    [
      { label: "Name", w: 0.22, bold: true },
      { label: "Role", w: 0.16 },
      { label: "Age", w: 0.1, align: "right" },
      { label: "Retires at", w: 0.14, align: "right" },
      { label: "Work", w: 0.17 },
      { label: "Risk profile", w: 0.21 },
    ],
    (plan.household || []).map((h) => [h.first_name, roleWord[h.role] || cap(h.role || ""), h.age ?? "", h.retirement_age ?? "", h.employment ? cap(String(h.employment).toLowerCase().replace(/_/g, " ")) : "", h.risk_profile || ""]),
  );

  // Contents (page numbers are filled in at the end, once the pages exist).
  const contentsRows = [];
  const PARTS = ["Your plan at a glance", "What the plan recommends", "Topic by topic", "Your progress", "Talking to a person"];
  label("Inside this summary");
  PARTS.forEach((t, i) => {
    const y = doc.y;
    contentsRows.push(y);
    doc.font(BOLD).fontSize(10).fillColor(C.blue).text(String(i + 1), M.l, y, { width: 16 });
    doc.font(SANS).fontSize(10).fillColor(C.ink).text(t, M.l + 18, y, { width: W - 60 });
    doc.y = y + 17;
  });

  // ---- 1. At a glance ---------------------------------------------------------------------------
  section("Your plan at a glance", "What Sherpas found, in a few paragraphs, and how each area of the plan scores today.");
  if (plan.texts?.strength) callout("What is working", [plan.texts.strength], { tint: "#eef8f1", edge: STATUS.green.text });
  table(
    [
      { label: "Topic", w: 0.27, bold: true },
      { label: "Status", w: 0.18 },
      { label: "Points", w: 0.11, align: "right" },
      { label: "In one sentence", w: 0.44 },
    ],
    topics.map((b) => {
      const p = pts(b.points);
      return [{ text: b.title, bold: true, dot: st(b.status).dot }, { text: st(b.status).word, color: st(b.status).text }, p ? `${p.got} / ${p.of}` : "–", b.building];
    }),
    { size: 9, before: () => subhead("Every area of the plan"), beforeH: 30 },
  );
  if (topics.some((b) => pts(b.points))) {
    ensure(topics.filter((b) => pts(b.points)).length * 22 + 50);
    subhead("Points by area", { after: 10 });
    pointsChart(topics);
  }
  if (plan.summary?.length) {
    gap(4);
    subhead("What Sherpas found");
    for (const s of plan.summary) para(s);
  }

  // ---- 2. Recommendations -------------------------------------------------------------------------
  section("What the plan recommends", "The recommendations Sherpas made, and the concrete steps that move your score. Nothing here is new advice: it is your plan, laid out.");
  if (plan.recommendations?.length) {
    label("Recommendations, in order");
    bullets(plan.recommendations, { numbered: true });
    gap(6);
  }
  if (plan.moves?.length) {
    subhead("Steps that raise your score", { after: 10 });
    liftChart(plan.moves);
    plan.moves.forEach((m) => {
      ensure(120);
      const y = doc.y;
      doc.font(BOLD).fontSize(11.5).fillColor(C.ink).text(clean(m.title), M.l, y, { width: W - 130 });
      const after = doc.y;
      const meta = [m.effort ? `${cap(m.effort)} effort` : null, Number.isFinite(m.score_after) ? `Score ${m.score_before} to ${m.score_after}` : null].filter(Boolean).join("  ·  ");
      doc.font(SANS).fontSize(8.5).fillColor(C.grey).text(meta, M.l + W - 160, y + 2, { width: 160, align: "right" });
      doc.y = Math.max(after, y + 14);
      gap(3);
      if (m.action) para(m.action, { size: 10, color: C.ink, after: 4 });
      if (m.why) para(`Why: ${m.why}`, { size: 10, color: C.grey, after: 6 });
      if (m.steps?.length) bullets(m.steps, { numbered: true, size: 9.5, x: M.l + 8, width: W - 8 });
      doc.moveTo(M.l, doc.y).lineTo(M.l + W, doc.y).lineWidth(0.5).strokeColor(C.line).stroke();
      gap(12);
    });
  }
  if (plan.combinedMoves?.length) {
    table(
      [
        { label: "Together", w: 0.62 },
        { label: "Score after", w: 0.18, align: "right", bold: true },
        { label: "From today", w: 0.2, align: "right" },
      ],
      plan.combinedMoves.map((c) => [c.moves.join(" + "), String(c.score_after), `+${c.score_after - plan.score.value}`]),
      { before: () => subhead("Steps that work better together"), beforeH: 30 },
    );
  }

  // ---- 3. Topic by topic -------------------------------------------------------------------------
  section("Topic by topic", "Each area of the plan: first in plain words, then in detail with every figure, what Sherpas' analysis says and what not to miss.");
  topics.forEach((b, i) => {
    if (i > 0) {
      ensure(220);
      gap(6);
      doc.moveTo(M.l, doc.y).lineTo(M.l + W, doc.y).lineWidth(1).strokeColor(C.line).stroke();
      gap(18);
    }
    ensure(220);
    const s = st(b.status);
    const y = doc.y;
    doc.circle(M.l + 6, y + 9, 6).fill(s.dot);
    doc.font(BOLD).fontSize(17).fillColor(C.ink).text(clean(b.title), M.l + 20, y, { width: W - 20 });
    gap(3);
    const p = pts(b.points);
    const meta = [b.pillar && clean(b.pillar) !== clean(b.title) ? clean(b.pillar) : null, p ? `${p.got} of ${p.of} points` : null].filter(Boolean);
    const my = doc.y;
    doc.font(BOLD).fontSize(9).fillColor(s.text).text(s.word, M.l + 20, my, { continued: meta.length > 0 });
    if (meta.length) doc.font(SANS).fillColor(C.grey).text(`   ·   ${meta.join("   ·   ")}`);
    gap(10);
    if (b.building) para(b.building, { size: 11.5, color: C.ink, font: BOLD, after: 10 });
    if (b.emotion?.stakes) para(b.emotion.stakes, { size: 10, color: C.grey, font: ITALIC, after: 10 });
    if (b.floor?.plain) {
      label("In plain words");
      para(b.floor.plain);
    }
    if (b.floor?.standard && b.floor.standard !== b.floor.plain) {
      label("In detail");
      para(b.floor.standard);
    }
    if (b.desks?.length) {
      gap(2);
      table(
        [
          { label: "Figure", w: 0.45 },
          { label: "Value", w: 0.29, align: "right", bold: true },
          { label: "Note", w: 0.26, color: C.grey },
        ],
        b.desks.map((d) => [d.label, d.value, d.note || ""]),
        { size: 9, before: () => label("Key figures"), beforeH: 16 },
      );
    }
    if (b.analysis?.length) {
      label("What Sherpas' analysis says");
      bullets(b.analysis, { size: 10 });
    }
    if (b.mustKnow?.length) callout("Must know", b.mustKnow.map((m) => (typeof m === "string" ? m : m.text)));
    if (b.lookInto) callout("Worth looking into with a person", [b.lookInto], { tint: C.amberSoft, edge: STATUS.amber.text });
  });

  // ---- 4. Progress -------------------------------------------------------------------------------
  section("Your progress", "Where you are with this month's steps, and what you asked to pass on to your advisor's firm.");
  const ms = state.missions || {};
  const active = (ms.active || []).map((id) => plan.missionPool.find((m) => m.id === id)).filter(Boolean);
  const explored = Object.keys(state.explored || {}).filter((id) => plan.bubbles.some((b) => b.id === id)).length;
  const stats = [
    ["Published score", String(plan.score.value)],
    ["Projected score", projected !== plan.score.value ? String(projected) : "Same as published"],
    ["Steps done", `${active.filter((m) => ms.status?.[m.id] === "done").length} of ${active.length}`],
    ["Topics explored", `${explored} of ${plan.bubbles.length}`],
  ];
  ensure(70);
  const sy = doc.y;
  const sw = (W - 3 * 10) / 4;
  stats.forEach(([k, v], i) => {
    const x = M.l + i * (sw + 10);
    doc.roundedRect(x, sy, sw, 58, 8).fill(C.fill);
    doc.font(BOLD).fontSize(7).fillColor(C.grey).text(k.toUpperCase(), x + 12, sy + 12, { width: sw - 24, characterSpacing: 0.6 });
    doc.font(BOLD).fontSize(v.length > 8 ? 11 : 18).fillColor(C.ink).text(v, x + 12, sy + 28, { width: sw - 24 });
  });
  doc.y = sy + 58 + 20;
  if (projected !== plan.score.value) para("The projected score becomes your real score when your next Sherpas update confirms the steps you completed.", { size: 9, color: C.grey, after: 12 });

  subhead(`Month ${ms.month || 1}: your steps`);
  if (active.length) {
    const statusWord = (s) => (s === "done" ? { text: "Done", color: STATUS.green.text, bold: true } : s === "active" || s === "in_progress" ? { text: "In progress", color: C.blue } : { text: "Not started", color: C.grey });
    table(
      [
        { label: "Step", w: 0.42, bold: true },
        { label: "Why", w: 0.36, color: C.body },
        { label: "Status", w: 0.22 },
      ],
      active.map((m) => {
        const w = statusWord(ms.status?.[m.id]);
        const when = ms.when?.[m.id];
        return [m.title, m.why || "", { ...w, text: when && w.text !== "Done" ? `${w.text}, planned for ${String(when).toLowerCase()}` : w.text }];
      }),
      { size: 9 },
    );
  } else para("No steps chosen yet. They are picked at the end of the walk-through.", { color: C.grey });

  const notes = state.notes || {};
  const noteText = (n) => (typeof n === "string" ? n : n?.text);
  const groups = [
    ["Changes to pass on to your advisor's firm", notes.intakeChanges],
    ["Things you said you worry about", notes.worries],
    ["Asked for a person to follow up", notes.humanFlags],
  ].filter(([, list]) => list?.length);
  if (groups.length) {
    subhead("Notes for your advisor");
    for (const [h, list] of groups) {
      label(h);
      bullets(list.map(noteText), { size: 10 });
    }
  }

  // ---- 5. A person ------------------------------------------------------------------------------
  section("Talking to a person", null);
  para("This summary explains your plan. It does not replace a person for big or hard-to-undo decisions, like buying insurance, changing retirement accounts or moving large sums.", { size: 11.5, color: C.ink });
  para("A person at your advisor's firm can go through any part of it with you. In the app, use “Talk to a person” at the top of any screen, or just ask for one in the chat.", { size: 11.5, color: C.ink, after: 22 });
  callout("About this document", [
    "Every figure in this summary comes from your Sherpas plan. Nothing has been recalculated, rounded or added.",
    "It explains recommendations the plan already makes. It is not new financial, tax, legal or investment advice.",
    `Prepared on ${dateText}. If your situation has changed since your plan was made, the figures may no longer apply.`,
  ], { tint: C.fill, edge: C.grey });

  // ---- Page furniture: running header, footer, page numbers, and the contents page numbers -------
  const range = doc.bufferedPageRange();
  const total = range.count;
  for (let i = 0; i < total; i++) {
    doc.switchToPage(i);
    const keep = doc.page.margins;
    doc.page.margins = { top: 0, bottom: 0, left: 0, right: 0 };
    const H = doc.page.height;
    if (i > 0) {
      doc.font(BOLD).fontSize(7.5).fillColor(C.grey).text("FINANCIAL COACH", M.l, 36, { characterSpacing: 1.2, lineBreak: false });
      doc.font(SANS).fontSize(7.5).fillColor(C.grey).text(`${clean(plan.label)}'s plan`, M.l, 36, { width: W, align: "right", lineBreak: false });
    }
    doc.moveTo(M.l, H - 46).lineTo(M.l + W, H - 46).lineWidth(0.5).strokeColor(C.line).stroke();
    doc.font(SANS).fontSize(7.5).fillColor(C.grey).text("Explains your Sherpas plan. Not new advice.", M.l, H - 36, { lineBreak: false });
    doc.text(`Page ${i + 1} of ${total}`, M.l, H - 36, { width: W, align: "right", lineBreak: false });
    doc.page.margins = keep;
  }
  doc.switchToPage(0);
  const keep0 = doc.page.margins;
  doc.page.margins = { top: 0, bottom: 0, left: 0, right: 0 };
  sections.forEach((s, i) => {
    doc.font(SANS).fontSize(10).fillColor(C.grey).text(String(s.page), M.l, contentsRows[i], { width: W, align: "right", lineBreak: false });
  });
  doc.page.margins = keep0;

  return doc;
}

export function reportFileName(plan) {
  const slug = clean(plan.label).replace(/&/g, "and").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${slug}-financial-plan-${new Date().toISOString().slice(0, 10)}.pdf`;
}
