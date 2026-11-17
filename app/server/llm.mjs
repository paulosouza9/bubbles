// AI proxy calls (text, speech, transcription) with a hard spending cap and disk caches.
// Everything the model writes is checked against the plan: a figure that is not in the
// plan's own text is rejected (see numbersOk).
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { APP_DIR, config } from "./env.mjs";

// ---- Spend tracking -------------------------------------------------------------

const usageFile = join(APP_DIR, "data", "usage.json");
const usage = existsSync(usageFile)
  ? JSON.parse(readFileSync(usageFile, "utf8"))
  : { textUsd: 0, ttsUsd: 0, sttUsd: 0, calls: 0 };
const AI_BUDGET_USD = Number(process.env.AI_BUDGET_USD || 3);
const PRICES = {
  "gpt-5-mini": [0.25, 2.0],
  "deepseek-flash": [0.3, 1.2],
  "gemini-3.5-flash-lite": [0.3, 2.5],
};
const TTS_PRICE_PER_1K = { "eleven-flash-v2.5": 0.04, "eleven-multilingual-v2": 0.08, "eleven-v3": 0.08 };

function saveUsage() {
  mkdirSync(join(APP_DIR, "data"), { recursive: true });
  writeFileSync(usageFile, JSON.stringify(usage, null, 1));
}
export function spend() {
  const total = usage.textUsd + usage.ttsUsd + usage.sttUsd;
  return {
    ...usage,
    realtimeUsd: usage.realtimeUsd || 0,
    totalUsd: total,
    capUsd: AI_BUDGET_USD,
    ttsCapUsd: config.ttsBudgetUsd,
    realtimeCapUsd: config.realtimeBudgetUsd,
    left: AI_BUDGET_USD - total,
  };
}
const overBudget = () => spend().totalUsd >= AI_BUDGET_USD;

// ---- Realtime voice (the live month-end check-in) ---------------------------------
// Kept apart from the text and speech budget: it has its own cap, and the live check-in
// falls back to the typed one once the cap is reached.
// Estimated USD per million tokens [text in, audio in, text out, audio out], used only
// when the proxy reports no cost of its own.
const REALTIME_PRICES = {
  "gpt-realtime-2.1-mini": [0.6, 10, 2.4, 20],
  "gpt-realtime-2.1": [4, 32, 16, 64],
};
export const realtimeLeft = () => config.realtimeBudgetUsd - (usage.realtimeUsd || 0);
export function addRealtimeSpend(model, u = {}) {
  let cost;
  if (typeof u.cost === "number" && u.cost > 0) cost = u.cost;
  else {
    const [ti, ai, to, ao] = REALTIME_PRICES[model] || REALTIME_PRICES["gpt-realtime-2.1"];
    const inD = u.input_token_details || {};
    const outD = u.output_token_details || {};
    const inAudio = inD.audio_tokens ?? 0;
    const inText = inD.text_tokens ?? Math.max(0, (u.input_tokens || 0) - inAudio);
    const outAudio = outD.audio_tokens ?? 0;
    const outText = outD.text_tokens ?? Math.max(0, (u.output_tokens || 0) - outAudio);
    cost = (inText * ti + inAudio * ai + outText * to + outAudio * ao) / 1e6;
  }
  usage.realtimeUsd = (usage.realtimeUsd || 0) + cost;
  saveUsage();
  return cost;
}
// Transcribing what the person says is billed by the minute on top of the model.
export function addRealtimeSeconds(seconds) {
  usage.realtimeUsd = (usage.realtimeUsd || 0) + (seconds / 60) * 0.003;
  usage.realtimeSeconds = (usage.realtimeSeconds || 0) + seconds;
  saveUsage();
}

// ---- Text -----------------------------------------------------------------------

export async function chatJson({ system, user, messages, effort = "minimal", model = config.textModel, maxTokens }) {
  if (!config.teamKey) throw new Error("TEAM_KEY not set");
  if (overBudget()) throw new Error("AI budget reached");
  const body = {
    model,
    response_format: { type: "json_object" },
    messages: messages || [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
  if (model.startsWith("gpt-5")) body.reasoning_effort = effort;
  if (maxTokens) body.max_tokens = maxTokens;
  const r = await fetch(`${config.proxyUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.teamKey}`, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90_000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`LLM ${r.status}: ${JSON.stringify(j.error || j).slice(0, 200)}`);
  const u = j.usage || {};
  const [pi, po] = PRICES[model] || [0.3, 2.5];
  const cost = typeof u.cost === "number" && u.cost > 0 ? u.cost : ((u.prompt_tokens || 0) * pi + (u.completion_tokens || 0) * po) / 1e6;
  usage.textUsd += cost;
  usage.calls += 1;
  saveUsage();
  // The app shows no emojis anywhere: strip any that slip into a reply.
  const text = (j.choices?.[0]?.message?.content || "").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE0F}\u{200D}]/gu, "");
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error("LLM returned no JSON");
  }
}

// ---- Number guard ---------------------------------------------------------------

// Normalises "$1,177,586", "34%", "5.6%", "$1M", "1.6 million" to plain numeric strings.
function tokens(text) {
  const out = [];
  const re = /(\$)?(\d[\d,]*(?:\.\d+)?)(\s?(?:million|m|k)\b)?(%)?/gi;
  let m;
  while ((m = re.exec(String(text)))) {
    let n = Number(m[2].replace(/,/g, ""));
    const suffix = (m[3] || "").trim().toLowerCase();
    if (suffix === "million" || suffix === "m") n *= 1e6;
    else if (suffix === "k") n *= 1e3;
    if (!Number.isFinite(n)) continue;
    out.push({ n, money: Boolean(m[1]), pct: Boolean(m[4]), decimal: m[2].includes("."), raw: m[0] });
  }
  return out;
}
const key = (n) => String(Math.round(n * 100) / 100);

export function numberSet(corpus) {
  const set = new Set();
  for (const t of tokens(corpus)) {
    set.add(key(t.n));
    set.add(key(Math.round(t.n))); // "$113,508.60" may be said as "$113,509"
  }
  return set;
}
// True when every money amount, percentage, decimal or number >= 1000 in `text` is in the plan.
export function numbersOk(text, allowed) {
  for (const t of tokens(text)) {
    const mustCheck = t.money || t.pct || t.decimal || t.n >= 1000;
    if (!mustCheck) continue;
    if (t.n >= 1900 && t.n <= 2100 && !t.money && !t.pct && !t.decimal && allowed.has(key(t.n))) continue;
    if (!allowed.has(key(t.n))) return false;
  }
  return true;
}

// ---- Speech (ElevenLabs through the proxy), cached on disk ----------------------

let ttsDownUntil = 0;
let ttsDownReason = "";
let sttDownUntil = 0;
export const voiceStatus = () => ({
  tts: Date.now() < ttsDownUntil ? "browser" : "elevenlabs",
  ttsReason: Date.now() < ttsDownUntil ? ttsDownReason : "",
  stt: Date.now() < sttDownUntil ? "browser" : "elevenlabs",
});

export async function tts(text, voice = config.voiceMain) {
  const clean = String(text || "").trim().slice(0, 900);
  if (!clean) throw new Error("empty text");
  mkdirSync(config.audioDir, { recursive: true });
  const hash = createHash("sha1").update(`${config.ttsModel}|${voice}|${clean}`).digest("hex").slice(0, 20);
  const file = join(config.audioDir, `${hash}.mp3`);
  if (existsSync(file)) return { buffer: readFileSync(file), cached: true };
  if (Date.now() < ttsDownUntil) throw new Error(`TTS unavailable: ${ttsDownReason}`);
  const cost = (clean.length / 1000) * (TTS_PRICE_PER_1K[config.ttsModel] || 0.08);
  if (usage.ttsUsd + usage.sttUsd + cost > config.ttsBudgetUsd || overBudget()) {
    ttsDownUntil = Date.now() + 3600_000;
    ttsDownReason = "voice budget reached";
    throw new Error(`TTS unavailable: ${ttsDownReason}`);
  }
  const r = await fetch(`${config.proxyUrl}/v1/audio/speech`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.teamKey}`, "content-type": "application/json" },
    body: JSON.stringify({ model: config.ttsModel, voice, input: clean, response_format: "mp3" }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) {
    const detail = (await r.text()).slice(0, 160);
    ttsDownUntil = Date.now() + 10 * 60_000;
    ttsDownReason = `proxy answered ${r.status}`;
    throw new Error(`TTS ${r.status}: ${detail}`);
  }
  const buffer = Buffer.from(await r.arrayBuffer());
  writeFileSync(file, buffer);
  usage.ttsUsd += cost;
  saveUsage();
  return { buffer, cached: false };
}

// One tiny request to each voice endpoint at start-up, so the app knows straight away whether
// to use ElevenLabs or the browser's own voice. A working answer is cached, so it costs once.
export async function probeVoice() {
  try {
    await tts("Hi.");
  } catch {
    /* status is recorded by tts() */
  }
  try {
    const sr = 16000;
    const n = sr / 2;
    const b = Buffer.alloc(44 + n * 2);
    b.write("RIFF", 0);
    b.writeUInt32LE(36 + n * 2, 4);
    b.write("WAVEfmt ", 8);
    b.writeUInt32LE(16, 16);
    b.writeUInt16LE(1, 20);
    b.writeUInt16LE(1, 22);
    b.writeUInt32LE(sr, 24);
    b.writeUInt32LE(sr * 2, 28);
    b.writeUInt16LE(2, 32);
    b.writeUInt16LE(16, 34);
    b.write("data", 36);
    b.writeUInt32LE(n * 2, 40);
    await stt(b, "audio/wav");
  } catch {
    /* status is recorded by stt() */
  }
  return voiceStatus();
}

export async function stt(buffer, mime = "audio/webm") {
  if (Date.now() < sttDownUntil) throw new Error("STT unavailable");
  if (overBudget() || usage.ttsUsd + usage.sttUsd > config.ttsBudgetUsd) throw new Error("voice budget reached");
  const ext = mime.includes("wav") ? "wav" : mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm";
  const fd = new FormData();
  fd.append("model", config.sttModel);
  fd.append("language", "en");
  fd.append("file", new Blob([buffer], { type: mime }), `speech.${ext}`);
  const r = await fetch(`${config.proxyUrl}/v1/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.teamKey}` },
    body: fd,
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) {
    sttDownUntil = Date.now() + 10 * 60_000;
    throw new Error(`STT ${r.status}: ${(await r.text()).slice(0, 160)}`);
  }
  const j = await r.json();
  usage.sttUsd += 0.22 / 360; // about 10 seconds of audio
  saveUsage();
  return String(j.text || "").trim();
}
