// The month-end check-in as a live voice conversation with the coach (a realtime model,
// through the server's /api/realtime relay). Same agenda and same effects as the typed
// check-in: what the person says can tick a mission, note a life change or a worry for the
// advisor's firm, or flag that a person should follow up. The relay checks each of those
// before it reaches this page. The typed check-in stays one tap away, and takes over on its
// own in Easy mode, without a microphone, or when the live voice is not available.
import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { stopSpeaking } from "../audio.js";
import { useStore } from "../store.js";
import { Checkin } from "./Month.jsx";
import { useMissions } from "./Missions.jsx";

const RATE = 24000;

export function TalkItThrough({ onDone }) {
  const easy = useStore((s) => s.easy);
  const [live, setLive] = useState(null); // null while asking the server, then false or { maxSeconds }
  const [typed, setTyped] = useState(false);
  useEffect(() => {
    let alive = true;
    api
      .status()
      .then((s) => alive && setLive(s.realtime?.available ? s.realtime : false))
      .catch(() => alive && setLive(false));
    return () => {
      alive = false;
    };
  }, []);
  const canLive = live && !easy && typeof window.AudioWorkletNode === "function" && navigator.mediaDevices?.getUserMedia;
  if (live === null) return <p className="busy">Getting your coach ready…</p>;
  if (typed || !canLive) return <Checkin onDone={onDone} />;
  return <LiveCheckin maxSeconds={live.maxSeconds} onDone={onDone} onTyped={() => setTyped(true)} />;
}

const b64 = (buf) => {
  let s = "";
  const u = new Uint8Array(buf);
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, "0")}`;
const NOTE = {
  done: (m) => `Ticked: ${m.title}`,
  in_progress: (m) => `Started: ${m.title}`,
  not_done: (m) => `Carries over: ${m.title}`,
};

function LiveCheckin({ maxSeconds = 480, onDone, onTyped }) {
  const family = useStore((s) => s.family);
  const person = useStore((s) => s.person);
  const { list, statuses, month } = useMissions();
  const [phase, setPhase] = useState("idle"); // idle, connecting, live, closing, ended, error
  const [error, setError] = useState("");
  const [msgs, setMsgs] = useState([]);
  const [talking, setTalking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [level, setLevel] = useState(0);
  const [left, setLeft] = useState(maxSeconds);
  const [text, setText] = useState("");
  const box = useRef();
  const rt = useRef({}); // the live session: socket, audio graph, playback queue
  const mutedRef = useRef(false);
  mutedRef.current = muted;

  const add = (m) => setMsgs((ms) => [...ms, m]);
  const patch = (key, fn) => setMsgs((ms) => ms.map((m) => (m.key === key ? fn(m) : m)));

  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  // ---- Playback: the coach's voice arrives as base64 PCM16 at 24 kHz, faster than it plays.
  const play = (base64) => {
    const r = rt.current;
    const bin = atob(base64);
    const n = bin.length >> 1;
    const pcm = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8);
      if (v >= 0x8000) v -= 0x10000;
      pcm[i] = v / 0x8000;
    }
    const buf = r.ctx.createBuffer(1, n, RATE);
    buf.copyToChannel(pcm, 0);
    const src = r.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(r.ctx.destination);
    r.head = Math.max(r.head || 0, r.ctx.currentTime + 0.05);
    const startAt = r.head;
    src.start(r.head);
    r.head += buf.duration;
    r.playing.push(src);
    src.onended = () => (r.playing = r.playing.filter((x) => x !== src));
    return { startAt, seconds: buf.duration };
  };
  const stopPlayback = () => {
    const r = rt.current;
    for (const s of r.playing || []) {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    }
    r.playing = [];
    r.head = r.ctx?.currentTime ?? 0;
  };
  const audioPending = () => rt.current.ctx && rt.current.head > rt.current.ctx.currentTime + 0.02;
  // The person spoke over the coach: stop the voice and tell the model how much was heard.
  const cutReply = () => {
    const r = rt.current;
    const last = r.reply;
    if (!last || last.cut || !audioPending()) return;
    last.cut = true;
    const heard = Math.max(0, Math.min(last.seconds, r.ctx.currentTime - last.startAt));
    stopPlayback();
    if (last.itemId) send({ type: "conversation.item.truncate", item_id: last.itemId, content_index: 0, audio_end_ms: Math.floor(heard * 1000) });
  };
  const send = (ev) => rt.current.ws?.readyState === 1 && rt.current.ws.send(JSON.stringify(ev));

  // ---- What the relay says the coach recorded: applied exactly like the typed check-in.
  const apply = (u) => {
    const st = useStore.getState();
    if (u.kind === "mission") {
      const cur = st.missions.status[u.id];
      const map = { done: "done", in_progress: "active", not_done: cur === "done" ? "done" : cur || "todo" };
      st.setMissionStatus(u.id, map[u.status], { via: "checkin-live", blocker: u.blocker, quiet: true });
      add({ role: "note", text: NOTE[u.status]?.(u) || u.title });
    } else if (u.kind === "lifeChange") {
      st.addNote("intakeChanges", u.text);
      add({ role: "note", text: `Noted for your advisor: ${u.text}` });
    } else if (u.kind === "worry") {
      st.addNote("worries", u.text);
      add({ role: "note", text: `Noted: ${u.text}` });
    } else if (u.kind === "flagHuman") {
      st.addNote("humanFlags", u.text);
      add({ role: "note", text: "Flagged for a person at your advisor's firm" });
    }
  };

  const onEvent = (ev) => {
    const r = rt.current;
    const t = ev.type || "";
    if (t === "app.error") {
      setError(ev.message || "The live check-in could not start.");
      setPhase("error");
      return;
    }
    if (t === "app.ready") {
      setPhase("live");
      r.startedAt = performance.now();
      return;
    }
    if (t === "app.update") return apply(ev);
    if (t === "app.end") {
      r.endReason = ev.reason;
      setPhase("closing");
      return;
    }
    if (t === "error") {
      // Errors about a single event (an interruption that came too late) are not fatal.
      if (!/truncate|cancel/i.test(ev.error?.message || "")) console.warn("[realtime]", ev.error);
      return;
    }
    if (t === "input_audio_buffer.speech_started") cutReply();
    // The person's words: a placeholder when their turn ends, filled in by the transcript.
    if (t === "input_audio_buffer.committed" && !r.userKey) {
      r.userKey = `u${Date.now()}`;
      add({ key: r.userKey, role: "user", text: "…" });
    }
    if (t === "conversation.item.input_audio_transcription.completed") {
      const text = (ev.transcript || "").trim();
      const key = r.userKey;
      r.userKey = null;
      if (key) text ? patch(key, (m) => ({ ...m, text })) : setMsgs((ms) => ms.filter((m) => m.key !== key));
    }
    if (t === "response.created") {
      r.botKey = `b${Date.now()}`;
      r.reply = { itemId: null, startAt: 0, seconds: 0, cut: false };
    }
    if ((t === "response.output_audio.delta" || t === "response.audio.delta") && ev.delta && r.ctx) {
      const chunk = play(ev.delta);
      if (r.reply) {
        if (!r.reply.seconds) r.reply.startAt = chunk.startAt;
        r.reply.seconds += chunk.seconds;
        r.reply.itemId ??= ev.item_id ?? null;
      }
    }
    if ((t === "response.output_audio_transcript.delta" || t === "response.audio_transcript.delta") && ev.delta && r.botKey) {
      const key = r.botKey;
      setMsgs((ms) => (ms.some((m) => m.key === key) ? ms.map((m) => (m.key === key ? { ...m, text: m.text + ev.delta } : m)) : [...ms, { key, role: "assistant", text: ev.delta }]));
    }
  };

  const hangUp = () => {
    const r = rt.current;
    clearInterval(r.tick);
    stopPlayback();
    r.mic?.getTracks().forEach((t) => t.stop());
    try {
      r.ws?.close();
    } catch {
      /* already closed */
    }
    r.ctx?.close().catch(() => {});
    rt.current = {};
    setTalking(false);
    setLevel(0);
  };

  const start = async () => {
    stopSpeaking();
    setError("");
    setPhase("connecting");
    const r = { playing: [], head: 0 };
    rt.current = r;
    try {
      r.ctx = new AudioContext({ sampleRate: RATE }); // the browser resamples the mic to 24 kHz
      r.mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
      await r.ctx.audioWorklet.addModule("/mic-worklet.js");
      r.node = new AudioWorkletNode(r.ctx, "mic-frames");
      r.ctx.createMediaStreamSource(r.mic).connect(r.node);
    } catch {
      hangUp();
      setError("Your microphone is not available. Allow it in the browser, or type instead.");
      setPhase("error");
      return;
    }
    r.ws = new WebSocket(`${location.origin.replace(/^http/, "ws")}/api/realtime?family=${encodeURIComponent(family)}`);
    r.ws.onopen = () => send({ type: "app.start", person, month, missions: list.map((m, i) => ({ id: m.id, status: statuses[i] })) });
    r.ws.onmessage = (m) => {
      try {
        onEvent(JSON.parse(m.data));
      } catch {
        /* a malformed event is skipped */
      }
    };
    r.ws.onclose = () => {
      if (rt.current !== r) return;
      // Let the goodbye finish playing before everything is put away.
      const wait = Math.max(0, ((r.head || 0) - (r.ctx?.currentTime || 0)) * 1000);
      setTimeout(() => {
        if (rt.current !== r) return;
        const reason = r.endReason;
        hangUp();
        if (!reason) {
          // Closed without the coach ending it: an error the relay explained, or a dropped line.
          setError((e) => e || "The live conversation was cut off. You can try again or type instead.");
          setPhase("error");
          return;
        }
        setPhase((p) => (p === "error" ? p : "ended"));
        onDone?.();
      }, wait + 300);
    };
    let sum = 0;
    let frames = 0;
    r.node.port.onmessage = (e) => {
      const frame = new Int16Array(e.data);
      let s = 0;
      for (let i = 0; i < frame.length; i++) s += frame[i] * frame[i];
      sum += Math.sqrt(s / frame.length) / 32768;
      frames++;
      if (mutedRef.current || r.ws.readyState !== 1 || !r.startedAt) return;
      send({ type: "input_audio_buffer.append", audio: b64(e.data) });
    };
    r.tick = setInterval(() => {
      setTalking(audioPending());
      setLevel(frames ? Math.min(1, (sum / frames) * 12) : 0);
      sum = 0;
      frames = 0;
      if (r.startedAt) setLeft(maxSeconds - (performance.now() - r.startedAt) / 1000);
      // The coach said goodbye and has finished speaking: hang up.
      if (r.endReason === "done" && !audioPending() && r.ws?.readyState === 1 && performance.now() - (r.endAt ??= performance.now()) > 1200) r.ws.close();
    }, 200);
  };

  // A tick on screen during the conversation reaches the coach too.
  useEffect(() => {
    if (phase === "live") send({ type: "app.missions", missions: list.map((m, i) => ({ id: m.id, status: statuses[i] })) });
  }, [statuses.join(",")]);
  useEffect(() => () => hangUp(), []);

  const on = phase === "live" || phase === "closing";
  return (
    <div className="checkin live-checkin">
      {phase === "idle" || phase === "error" ? (
        <div className="live-start">
          <p>Talk it through with your coach, out loud. About five minutes: how the month went, anything that changed, anything on your mind.</p>
          {error && (
            <p className="warn" role="alert">
              {error}
            </p>
          )}
          <div className="live-actions">
            <button className="btn primary" onClick={start}>
              {phase === "error" ? "Try again" : "Start talking"}
            </button>
            <button className="btn" onClick={onTyped}>
              Type instead
            </button>
          </div>
          <p className="fine">Headphones help: the coach hears you, not itself. It only records what you tell it. It does not change your plan or confirm any decision.</p>
        </div>
      ) : (
        <>
          <div className={`live-bar ${talking ? "coach" : "you"}`} role="status" aria-live="polite">
            <span className="live-dot" style={{ "--level": muted || talking ? 0 : level }} aria-hidden="true" />
            <span className="live-state">
              {phase === "connecting" ? "Connecting…" : phase === "ended" ? "Check-in finished" : talking ? "Your coach is talking" : muted ? "Microphone off" : "Listening"}
            </span>
            {on && <span className="live-left mute">{clock(left)} left</span>}
            {on && (
              <button className="btn small" onClick={() => setMuted((m) => !m)} aria-pressed={muted}>
                {muted ? "Unmute" : "Mute"}
              </button>
            )}
            {(on || phase === "connecting") && (
              <button
                className="btn small"
                onClick={() => {
                  hangUp();
                  setPhase("ended");
                }}
              >
                End
              </button>
            )}
          </div>
          <div className="chat-list" ref={box} aria-label="What you and your coach said">
            {msgs.map((m, i) => (
              <div key={m.key || i} className={`msg ${m.role}`}>
                <div className="bubble-msg">{m.text}</div>
              </div>
            ))}
          </div>
          {phase === "live" && (
            <form
              className="checkin-input"
              onSubmit={(e) => {
                e.preventDefault();
                const line = text.trim();
                if (!line) return;
                cutReply();
                stopPlayback();
                add({ role: "user", text: line });
                send({ type: "app.say", text: line });
                setText("");
              }}
            >
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Or type here" aria-label="Type to your coach" />
              <button className="btn primary" disabled={!text.trim()}>
                Send
              </button>
            </form>
          )}
          {phase === "ended" && (
            <div className="live-actions">
              <button className="btn" onClick={() => setPhase("idle")}>
                Talk again
              </button>
              <button className="btn" onClick={onTyped}>
                Type instead
              </button>
            </div>
          )}
          <p className="fine">This check-in only records what you tell it. It does not change your plan or confirm any decision.</p>
        </>
      )}
    </div>
  );
}
