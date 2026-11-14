// The narrator. First choice: ElevenLabs through our backend (cached on disk there, and in
// memory here). If that is unavailable, the browser's own speech synthesis takes over, so the
// app never goes silent. Everything spoken is also on screen: the voice never blocks.
import { api } from "./api.js";

const urls = new Map();
let serverDownUntil = 0;
let current = null; // { stop }
let token = 0;

export const voice = {
  muted: false,
  rate: 1,
  serverAvailable: true,
};

export function setServerVoice(available) {
  voice.serverAvailable = available;
  if (!available) serverDownUntil = Date.now() + 10 * 60_000;
}

// ---- How loud the voice is right now (0..1), so the bubble can "speak" -------------
// ElevenLabs audio is measured for real with an analyser. The browser's own voice cannot be
// measured, so it gets a speech-like envelope driven by its word boundaries.
const speech = { mode: "off", analyser: null, buf: null, kick: 0, start: 0, smooth: 0 };
let actx = null;
function audioCtx() {
  actx = actx || new (window.AudioContext || window.webkitAudioContext)();
  if (actx.state === "suspended") actx.resume().catch(() => {});
  return actx;
}

// Called every frame by several things: computed once per frame, then cached.
let lastAt = -1;
export function speechLevel() {
  const now = performance.now() / 1000;
  if (now - lastAt < 0.006) return speech.smooth;
  const dt = lastAt < 0 ? 0.016 : Math.min(0.1, now - lastAt);
  lastAt = now;
  let target = 0;
  if (speech.mode === "audio" && speech.analyser) {
    speech.analyser.getByteTimeDomainData(speech.buf);
    let sum = 0;
    for (let i = 0; i < speech.buf.length; i++) {
      const v = (speech.buf[i] - 128) / 128;
      sum += v * v;
    }
    target = Math.min(1, Math.sqrt(sum / speech.buf.length) * 3.2);
  } else if (speech.mode === "synthetic") {
    const t = now - speech.start;
    // Phrase-like swells (about one every second and a half), not syllable flicker.
    const phrase = 0.5 + 0.3 * Math.sin(t * 4.1) + 0.2 * Math.sin(t * 1.7 + 0.8);
    const word = Math.exp(-(now - speech.kick) * 3);
    target = Math.min(1, 0.3 + phrase * 0.35 + word * 0.15);
  }
  // Time-based easing: about a fifth of a second to rise, half a second to settle.
  const tau = target > speech.smooth ? 0.2 : 0.5;
  speech.smooth += (target - speech.smooth) * (1 - Math.exp(-dt / tau));
  return speech.smooth;
}
export const isSpeaking = () => speech.mode !== "off";

export function stopSpeaking() {
  token++;
  if (current) current.stop();
  current = null;
  speech.mode = "off";
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
}

function pickBrowserVoice(kind) {
  const all = speechSynthesis.getVoices().filter((v) => v.lang?.startsWith("en"));
  if (!all.length) return null;
  const us = all.filter((v) => v.lang === "en-US");
  const pool = us.length ? us : all;
  const prefer = kind === "cohost" ? /(Guy|David|Mark|Male|Daniel|Google UK English Male)/i : /(Aria|Jenny|Samantha|Zira|Google US English|Female)/i;
  return pool.find((v) => prefer.test(v.name)) || (kind === "cohost" ? pool[pool.length - 1] : pool[0]);
}

// speak(text, { voice: "main" | "cohost", rate, onProgress(0..1), onEnd(finished) })
export function speak(text, opts = {}) {
  stopSpeaking();
  const my = ++token;
  const clean = String(text || "").trim();
  const done = (finished) => {
    if (my === token) {
      current = null;
      speech.mode = "off";
    }
    opts.onEnd?.(finished);
  };
  const synthetic = () => {
    speech.mode = "synthetic";
    speech.start = performance.now() / 1000;
    speech.kick = speech.start;
  };
  if (!clean) return done(true);
  if (voice.muted) {
    // Keep timed flows moving at reading speed, without sound. The bubble still "talks".
    synthetic();
    const t = setTimeout(() => my === token && done(true), Math.min(9000, 900 + clean.length * 38));
    current = { stop: () => clearTimeout(t) };
    return;
  }
  const rate = (opts.rate || 1) * voice.rate;

  const browser = () => {
    if (typeof speechSynthesis === "undefined") return done(false);
    const u = new SpeechSynthesisUtterance(clean);
    const v = pickBrowserVoice(opts.voice);
    if (v) u.voice = v;
    u.lang = "en-US";
    u.rate = Math.min(1.4, Math.max(0.6, rate * 0.98));
    u.pitch = opts.voice === "cohost" ? 0.85 : 1;
    u.onstart = () => my === token && synthetic();
    u.onboundary = (e) => {
      speech.kick = performance.now() / 1000;
      opts.onProgress?.(Math.min(1, e.charIndex / clean.length));
    };
    u.onend = () => my === token && done(true);
    u.onerror = () => my === token && done(false);
    current = { stop: () => speechSynthesis.cancel() };
    speechSynthesis.speak(u);
  };

  const playUrl = (url) => {
    const a = new Audio(url);
    a.playbackRate = rate;
    a.ontimeupdate = () => a.duration && opts.onProgress?.(Math.min(1, a.currentTime / a.duration));
    a.onended = () => my === token && done(true);
    a.onerror = () => my === token && browser();
    try {
      const ctx = audioCtx();
      const src = ctx.createMediaElementSource(a);
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      an.connect(ctx.destination);
      speech.analyser = an;
      speech.buf = new Uint8Array(an.fftSize);
    } catch {
      speech.analyser = null;
    }
    a.onplaying = () => my === token && (speech.analyser ? (speech.mode = "audio") : synthetic());
    current = {
      stop: () => {
        a.pause();
        a.src = "";
      },
    };
    a.play().catch(() => my === token && browser());
  };

  const cacheKey = `${opts.voice || "main"}|${clean}`;
  if (urls.has(cacheKey)) return playUrl(urls.get(cacheKey));
  if (!voice.serverAvailable || Date.now() < serverDownUntil) return browser();
  current = { stop: () => {} };
  api
    .tts(clean, opts.voice || "main")
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      urls.set(cacheKey, url);
      if (my === token) playUrl(url);
    })
    .catch(() => {
      serverDownUntil = Date.now() + 10 * 60_000;
      if (my === token) browser();
    });
}

// Speak several lines one after another. Returns a controller.
export function speakQueue(lines, { onLine, onEnd } = {}) {
  let i = 0;
  let stopped = false;
  const next = () => {
    if (stopped) return;
    if (i >= lines.length) return onEnd?.();
    const line = lines[i];
    onLine?.(i, line);
    speak(line.text, {
      voice: line.speaker === "cohost" ? "cohost" : "main",
      onEnd: (finished) => {
        if (stopped) return;
        i++;
        if (finished !== false || true) next();
      },
    });
  };
  next();
  return {
    stop: () => {
      stopped = true;
      stopSpeaking();
    },
    jump: (index) => {
      i = Math.max(0, Math.min(lines.length, index));
      stopped = false;
      next();
    },
    get index() {
      return i;
    },
  };
}

// ---- Listening --------------------------------------------------------------------

const Recognition = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
export const canListen = () => Boolean(Recognition) || Boolean(navigator.mediaDevices?.getUserMedia);

// Starts listening. Returns { stop() } and resolves onText(text) once. Uses the backend
// transcription when it is up, otherwise the browser's speech recognition.
export function listen({ serverStt, onText, onError, onState }) {
  stopSpeaking();
  if (serverStt && navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined") {
    let rec;
    let stream;
    const chunks = [];
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((s) => {
        stream = s;
        rec = new MediaRecorder(s);
        rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        rec.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          onState?.("thinking");
          try {
            const text = await api.stt(new Blob(chunks, { type: rec.mimeType || "audio/webm" }));
            onText(text);
          } catch (e) {
            onError?.(e);
          }
        };
        rec.start();
        onState?.("listening");
      })
      .catch((e) => onError?.(e));
    return { stop: () => rec?.state === "recording" && rec.stop() };
  }
  if (Recognition) {
    const r = new Recognition();
    r.lang = "en-US";
    r.interimResults = false;
    r.maxAlternatives = 1;
    let got = false;
    r.onresult = (e) => {
      got = true;
      onText(e.results[0][0].transcript);
    };
    r.onerror = (e) => onError?.(new Error(e.error || "speech recognition failed"));
    r.onend = () => !got && onState?.("idle");
    r.start();
    onState?.("listening");
    return { stop: () => r.stop() };
  }
  onError?.(new Error("This browser cannot listen. Please type instead."));
  return { stop: () => {} };
}

// ---- Tiny sound effects (synthesised, no files). They follow the voice mute switch. ----
export function sfx(kind = "pop") {
  if (voice.muted) return;
  try {
    const actx = audioCtx();
    const t = actx.currentTime;
    const notes = kind === "ding" ? [[660, 990, 0.18], [990, 1320, 0.22]] : kind === "pop" ? [[440, 150, 0.11]] : kind === "whoosh" ? [[180, 520, 0.25]] : [[560, 560, 0.04]];
    notes.forEach(([f1, f2, d], i) => {
      const o = actx.createOscillator();
      const g = actx.createGain();
      const at = t + i * 0.09;
      o.type = "sine";
      o.frequency.setValueAtTime(f1, at);
      o.frequency.exponentialRampToValueAtTime(f2, at + d);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.11, at + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, at + d);
      o.connect(g).connect(actx.destination);
      o.start(at);
      o.stop(at + d + 0.02);
    });
    navigator.vibrate?.(kind === "ding" ? [12, 30, 18] : 8);
  } catch {
    /* sound is a nicety */
  }
}
