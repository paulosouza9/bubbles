// Burbuja backend. Keeps the keys, reads the cases through the Sherpas MCP, builds each
// family's script and relays text, speech and transcription to the AI proxy.
import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import express from "express";
import { projectedScore } from "../shared/score.js";
import { getCase, listCaseIds, sourceStatus } from "./cases.mjs";
import { APP_DIR, config } from "./env.mjs";
import { identify } from "./identify.mjs";
import { chatJson, numberSet, numbersOk, probeVoice, spend, stt, tts, voiceStatus } from "./llm.mjs";
import { buildPlan, planCorpus, publicPlan } from "./script.mjs";

const app = express();
app.use(express.json({ limit: "1mb" }));
const raw = express.raw({ type: () => true, limit: "30mb" });
const wrap = (fn) => (req, res) => fn(req, res).catch((e) => res.status(500).json({ error: String(e.message || e) }));

function log(event) {
  try {
    mkdirSync(config.logsDir, { recursive: true });
    appendFileSync(join(config.logsDir, "audit.jsonl"), `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`);
  } catch {
    /* logging must never break the app */
  }
}

// ---- Status, families, plan -------------------------------------------------------

app.get("/api/status", (_req, res) => {
  res.json({ data: sourceStatus, voice: voiceStatus(), spend: spend(), hasTeamKey: Boolean(config.teamKey), hasMcpToken: Boolean(config.mcpToken) });
});

app.get(
  "/api/families",
  wrap(async (_req, res) => {
    const ids = await listCaseIds();
    const out = [];
    for (const id of ids) {
      const c = await getCase(id);
      const fh = c.financialHealth;
      const adults = fh.case.household.filter((p) => p.role !== "child");
      out.push({
        id,
        label: adults.map((p) => p.first_name).join(" & "),
        lastName: id.split("-").at(-1).replace(/^./, (x) => x.toUpperCase()),
        city: `${fh.case.city}, ${fh.case.state}`,
        score: fh.score.published_score,
        band: fh.score.band,
        people: fh.case.household.length,
        hasIntake: true,
      });
    }
    res.json({ families: out, source: sourceStatus });
  }),
);

app.get(
  "/api/plan/:family",
  wrap(async (req, res) => {
    const plan = await buildPlan(req.params.family);
    res.json(publicPlan(plan));
  }),
);

app.post(
  "/api/identify",
  raw,
  wrap(async (req, res) => {
    const filename = decodeURIComponent(String(req.headers["x-filename"] || ""));
    const match = Buffer.isBuffer(req.body) && req.body.length ? await identify(req.body, filename) : null;
    log({ type: "identify", filename, family: match?.family || null });
    res.json({ family: match?.family || null });
  }),
);

// ---- Voice ------------------------------------------------------------------------

app.post(
  "/api/tts",
  wrap(async (req, res) => {
    const { text, voice } = req.body || {};
    try {
      const { buffer, cached } = await tts(text, voice === "cohost" ? config.voiceCohost : config.voiceMain);
      res.set({ "content-type": "audio/mpeg", "cache-control": "public, max-age=31536000", "x-cached": String(cached) });
      res.send(buffer);
    } catch (e) {
      res.status(503).json({ error: String(e.message || e), fallback: "browser" });
    }
  }),
);

app.post(
  "/api/stt",
  raw,
  wrap(async (req, res) => {
    try {
      res.json({ text: await stt(req.body, String(req.headers["content-type"] || "audio/webm")) });
    } catch (e) {
      res.status(503).json({ error: String(e.message || e), fallback: "browser" });
    }
  }),
);

// ---- Ask Sherpas: a chat that knows what is on screen -----------------------------

const ASK_SYSTEM = (corpus, ids) => `You are "Ask Sherpas", the helper inside an app that explains a family's EXISTING financial plan from Sherpas.

Rules:
- Answer ONLY from the PLAN below. Quote figures exactly as written. Never invent, round or derive figures, and never state general facts with figures (limits, rates, averages) that are not in the plan.
- You may explain what a financial word means in plain language, without figures.
- If the answer is not in the plan, say "That isn't in your plan" and offer the closest thing that is.
- Never give a new recommendation. Only explain the ones already in the plan.
- If the person asks about a decision that is high-impact or hard to undo (buying insurance, changing retirement accounts, moving large sums, buying a home), or anything outside the plan, say a person should be part of that decision and add the action talk_to_human.
- If the question touches a MUST KNOW, include it.
- At most 3 short sentences. Match the person's level: profile "novice" or "action" = everyday words and no jargon; "understand" = explain the why; "expert" = precise terms and figures. If easy_mode is true, use very short sentences.
- English only. No exclamation marks, no emojis.

Return JSON: {"text": string, "actions": [ {"type":"go_to_bubble","bubble":one of ${JSON.stringify(ids)},"label":string} | {"type":"zoom_in","label":string} | {"type":"zoom_out","label":string} | {"type":"talk_to_human","label":string} ]}
Use at most 2 actions, and only when they help. Action labels are short button texts (max 5 words). Never write an action name inside "text".

PLAN:
${corpus}`;

function retrieve(plan, query) {
  const words = String(query).toLowerCase().match(/[a-z0-9$%.,]{3,}/g) || [];
  let best = null;
  for (const b of plan.bubbles) {
    for (const line of [...b.analysis, ...b.desks.map((d) => `${d.label}: ${d.value}`)]) {
      const l = line.toLowerCase();
      const s = words.reduce((n, w) => n + (l.includes(w) ? 1 : 0), 0);
      if (s > 0 && (!best || s > best.s)) best = { s, line, bubble: b };
    }
  }
  return best;
}

app.post(
  "/api/ask",
  wrap(async (req, res) => {
    const { family, question, selection, screen, profile, zoom, easy_mode, person, history = [] } = req.body || {};
    const plan = await buildPlan(family);
    const corpus = await planCorpus(family);
    const ids = plan.bubbles.map((b) => b.id);
    const q = String(question || "").slice(0, 600);
    const ctx = { person, profile, zoom, easy_mode: Boolean(easy_mode), on_screen: screen || null, selected_text: selection || null };
    const messages = [
      { role: "system", content: ASK_SYSTEM(corpus, ids) },
      ...history.slice(-6).map((h) => ({ role: h.role === "assistant" ? "assistant" : "user", content: String(h.text).slice(0, 700) })),
      { role: "user", content: `CONTEXT: ${JSON.stringify(ctx)}\nQUESTION: ${q}` },
    ];
    const allowed = numberSet(corpus);
    let out = null;
    let guarded = false;
    try {
      out = await chatJson({ messages });
      if (!numbersOk(out.text, allowed)) {
        guarded = true;
        out = await chatJson({
          messages: [...messages, { role: "assistant", content: JSON.stringify(out) }, { role: "user", content: "Your answer used a figure that is not in the plan. Rewrite it using only figures that appear in the plan, or no figures at all." }],
        });
        if (!numbersOk(out.text, allowed)) out = null;
      }
    } catch {
      out = null;
    }
    if (!out?.text) {
      const hit = retrieve(plan, `${selection || ""} ${q}`);
      out = hit
        ? { text: `Here is what your plan says: ${hit.line}`, actions: [{ type: "go_to_bubble", bubble: hit.bubble.id, label: `Open ${hit.bubble.title.toLowerCase()}` }] }
        : { text: "I can only answer from your plan, and I could not find that in it. A person at your advisor's firm can help with this one.", actions: [{ type: "talk_to_human", label: "Talk to a person" }] };
      out.fromPlanOnly = true;
    }
    const actions = (Array.isArray(out.actions) ? out.actions : [])
      .filter((a) => ["go_to_bubble", "zoom_in", "zoom_out", "talk_to_human"].includes(a?.type) && (a.type !== "go_to_bubble" || ids.includes(a.bubble)))
      .slice(0, 2)
      .map((a) => ({ type: a.type, bubble: a.bubble, label: String(a.label || "").slice(0, 40) || (a.type === "talk_to_human" ? "Talk to a person" : "Show me") }));
    const text = String(out.text)
      .replace(/\s*\b(talk_to_human|go_to_bubble|zoom_in|zoom_out)\b\.?/g, "")
      .trim();
    log({ type: "ask", family, person, zoom, profile, bubble: screen?.bubble_id, selection, question: q, answer: text, guarded });
    res.json({ text, actions });
  }),
);

// ---- Month end: podcast script and check-in ---------------------------------------

app.post(
  "/api/month",
  wrap(async (req, res) => {
    const { family, done = [], month = 1, next = [] } = req.body || {};
    const plan = await buildPlan(family);
    const doneMissions = plan.missionPool.filter((m) => done.includes(m.id));
    const doneMoves = doneMissions.filter((m) => m.moveId).map((m) => m.moveId);
    const proj = projectedScore(plan, doneMoves);
    const names = plan.names.join(" and ");
    const byId = Object.fromEntries(plan.bubbles.map((b) => [b.id, b]));
    const lines = [];
    const say = (speaker, text, chapter) => lines.push({ speaker, text, chapter });
    say("host", `This is your month in review, ${names}. It is a short one.`, "Your month");
    say("cohost", "Let's start with the missions. How did the month go?", "Your month");
    if (doneMissions.length) {
      say("host", `You marked ${doneMissions.length} of your missions as done: ${doneMissions.map((m) => m.title).join("; ")}.`, "Your month");
      if (doneMoves.length && proj.score !== plan.score.value)
        say("host", `Your published score is ${plan.score.value}. Once that is confirmed, it is projected to move to ${proj.score}.`, "Your month");
      else say("host", `Your published score is ${plan.score.value}. Your next Sherpas update will confirm what changed.`, "Your month");
    } else {
      say("host", `No missions were marked as done this month, and that is okay. They carry over. Your published score is ${plan.score.value}.`, "Your month");
    }
    const focus = plan.order.filter((id) => id !== "score").map((id) => byId[id]).sort((a, b) => (b.status === "red") - (a.status === "red")).slice(0, 3);
    for (const b of focus) {
      say("cohost", `Tell me about ${b.title.toLowerCase()}.`, b.title);
      say("host", b.floor.plain, b.title);
      if (b.mustKnow[0]) {
        say("cohost", "Anything I should keep in mind there?", b.title);
        say("host", b.mustKnow[0].text, b.title);
      }
    }
    const nextMissions = plan.missionPool.filter((m) => next.includes(m.id));
    say("cohost", "So what comes next?", "Next month");
    if (nextMissions.length) say("host", `For next month, your plan points to these: ${nextMissions.map((m) => m.title).join("; ")}. You choose which ones to take on.`, "Next month");
    say("host", "Nothing is decided while you listen. When you have the screen in front of you, open the check-in and tell me how it went.", "Next month");
    res.json({ month, lines, projected: proj, doneCount: doneMissions.length });
  }),
);

const CHECKIN_SYSTEM = `You help run a short, kind month-end check-in about a family's existing financial plan.
You get the question that was asked and the person's answer. Return JSON:
{"ack": one warm, short sentence that reacts to what they said, with no figures and no advice,
 "status": "done" | "in_progress" | "not_done" | null (only when the question was about a mission; "not yet" or "no" means not_done, in_progress only if they say they started),
 "blocker": short phrase or null,
 "life_change": short phrase describing a real change in work, family or big expenses, or null,
 "worry": short phrase or null,
 "needs_human": true if they mention a big or hard-to-undo decision, distress, or something outside a plan; otherwise false}
English only. No exclamation marks.`;

function heuristic(answer, stage) {
  const a = String(answer).toLowerCase();
  const yes = /\b(yes|yep|yeah|done|did|finished|completed|got it|sorted)\b/.test(a);
  const partly = /\b(started|working on|in progress|almost|half|partly|began)\b/.test(a);
  const no = /\b(no|not yet|didn'?t|haven'?t|couldn'?t|nope)\b/.test(a);
  const nothing = /\b(no|nothing|nope|not really|none|all good)\b/.test(a) && a.length < 40;
  return {
    ack: "Thanks for telling me.",
    status: stage === "mission" ? (partly ? "in_progress" : yes && !no ? "done" : "not_done") : null,
    blocker: null,
    life_change: stage === "life" && !nothing ? String(answer).slice(0, 140) : null,
    worry: stage === "worry" && !nothing ? String(answer).slice(0, 140) : null,
    needs_human: /\b(divorce|lost my job|laid off|died|death|lawsuit|bankrupt|foreclos)\b/.test(a),
  };
}

app.post(
  "/api/checkin",
  wrap(async (req, res) => {
    const { family, stage = "start", index = 0, answer = "", missions = [], person } = req.body || {};
    const plan = await buildPlan(family);
    const name = person || plan.names[0];
    const question = (st, i) =>
      st === "open"
        ? `How has the month gone, ${name}?`
        : st === "mission"
          ? `One of your missions was: ${missions[i].title}. Were you able to do it?`
          : st === "life"
            ? "Has anything changed for you this month? Work, family, a big expense."
            : st === "worry"
              ? "Is there anything about money that is worrying you right now?"
              : "";
    if (stage === "start") return res.json({ say: [question("open")], next: { stage: "open", index: 0 }, updates: {} });

    let r;
    try {
      r = await chatJson({ system: CHECKIN_SYSTEM, user: `QUESTION: ${question(stage, index)}\nANSWER: ${String(answer).slice(0, 600)}` });
      if (typeof r.ack !== "string" || /\d{3,}|\$|%/.test(r.ack)) r.ack = "Thanks for telling me.";
    } catch {
      r = heuristic(answer, stage);
    }
    const updates = {};
    const say = [r.ack];
    let next;
    if (stage === "open") next = missions.length ? { stage: "mission", index: 0 } : { stage: "life", index: 0 };
    else if (stage === "mission") {
      const status = ["done", "in_progress", "not_done"].includes(r.status) ? r.status : "not_done";
      updates.mission = { id: missions[index].id, status, blocker: r.blocker || null };
      if (status === "not_done") say.push("That is fine. It carries over, with no penalty.");
      next = index + 1 < missions.length ? { stage: "mission", index: index + 1 } : { stage: "life", index: 0 };
    } else if (stage === "life") {
      if (r.life_change) {
        updates.intakeChange = r.life_change;
        say.push("That can change your plan. I have noted it so your Sherpas Intake gets updated. I do not recalculate anything here.");
      }
      next = { stage: "worry", index: 0 };
    } else if (stage === "worry") {
      if (r.worry) updates.worry = r.worry;
      next = { stage: "next", index: 0 };
    }
    if (r.needs_human) {
      updates.flagHuman = true;
      say.push("This sounds like something a person should help you with. I have flagged it.");
    }
    if (next.stage === "next") {
      say.push("Last thing: choose up to three missions for next month. Nothing is decided until you confirm each one on its decision card.");
      log({ type: "checkin_end", family, person: name });
      return res.json({ say, next, updates, done: true });
    }
    say.push(question(next.stage, next.index));
    log({ type: "checkin_turn", family, person: name, stage, answer: String(answer).slice(0, 300), updates });
    res.json({ say, next, updates });
  }),
);

// ---- Audit trail and "talk to a person" -------------------------------------------

app.post("/api/log", (req, res) => {
  log(req.body || {});
  res.json({ ok: true });
});

// ---- Static frontend (after `npm run build`) --------------------------------------

const dist = join(APP_DIR, "dist");
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.use((req, res, next) => (req.method === "GET" && !req.path.startsWith("/api") ? res.sendFile(join(dist, "index.html")) : next()));
}

app.listen(config.port, () => {
  console.log(`Burbuja API on http://localhost:${config.port}  (MCP token: ${config.mcpToken ? "yes" : "no"}, team key: ${config.teamKey ? "yes" : "no"})`);
  if (config.teamKey) probeVoice().then((v) => console.log(`Voice: speech=${v.tts}${v.ttsReason ? ` (${v.ttsReason})` : ""}, listening=${v.stt}`));
});
