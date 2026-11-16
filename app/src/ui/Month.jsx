// Month end: the review (interactive, or as a podcast), the short check-in, and choosing the
// next three missions. Nothing is decided in the podcast or the check-in: they only record
// what the person says. Decisions always go through a decision card.
import { useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { api } from "../api.js";
import { speak, speakQueue, stopSpeaking, voice } from "../audio.js";
import { ScoreRing } from "../miniapps/index.jsx";
import { useStore } from "../store.js";
import { MicButton } from "./Chat.jsx";
import { BubbleScreen } from "./Deep.jsx";
import { MissionRow, Ring, useMissions } from "./Missions.jsx";

function nextIds(s) {
  // Unfinished missions carry over; then the plan's remaining moves; then topics to understand.
  const carry = s.missions.active.filter((id) => s.missions.status[id] !== "done");
  const rest = s.plan.missionPool.filter((m) => s.missions.status[m.id] !== "done" && !carry.includes(m.id));
  const moves = rest.filter((m) => m.moveId).map((m) => m.id);
  const under = rest.filter((m) => !m.moveId).map((m) => m.id);
  return [...carry, ...moves, ...under].slice(0, 3);
}

export function Podcast({ onDone }) {
  const family = useStore((s) => s.family);
  const names = useStore((s) => s.plan.label);
  const month = useStore((s) => s.missions.month);
  const done = useStore(useShallow((s) => s.missions.active.filter((id) => s.missions.status[id] === "done")));
  const next = useStore(useShallow((s) => nextIds(s)));
  const [lines, setLines] = useState(null);
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const q = useRef(null);
  useEffect(() => {
    api.month({ family, done, month, next }).then((r) => setLines(r.lines));
    return () => {
      q.current?.stop();
      voice.rate = 1;
    };
  }, [family]);
  const chapters = useMemo(() => {
    const out = [];
    (lines || []).forEach((l, k) => {
      if (!out.length || out.at(-1).name !== l.chapter) out.push({ name: l.chapter, start: k });
    });
    return out;
  }, [lines]);
  const play = (from = i) => {
    q.current?.stop();
    setPlaying(true);
    const rest = lines.slice(from);
    q.current = speakQueue(rest, {
      onLine: (k) => setI(from + k),
      onEnd: () => {
        setPlaying(false);
        setI(0);
        onDone?.();
      },
    });
  };
  const pause = () => {
    q.current?.stop();
    setPlaying(false);
  };
  useEffect(() => {
    if (!("mediaSession" in navigator) || !lines) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: `Your money, month ${month}`, artist: `Financial Coach for ${names}`, album: "Monthly review" });
    navigator.mediaSession.setActionHandler("play", () => play());
    navigator.mediaSession.setActionHandler("pause", pause);
    navigator.mediaSession.setActionHandler("nexttrack", () => skip(1));
    navigator.mediaSession.setActionHandler("previoustrack", () => skip(-1));
  }, [lines, i]);
  const chapterIdx = chapters.findLastIndex((c) => c.start <= i);
  const skip = (dir) => {
    const c = chapters[Math.max(0, Math.min(chapters.length - 1, chapterIdx + dir))];
    if (!c) return;
    setI(c.start);
    if (playing) play(c.start);
  };
  if (!lines) return <div className="busy">Preparing your episode…</div>;
  const line = lines[i];
  return (
    <div className="podcast">
      <div className="pod-top">
        <div className="pod-art" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div>
          <div className="eyebrow">Podcast mode · eyes-free</div>
          <h3>Your money, month {month}</h3>
          <div className="mute small">
            {chapters.length} chapters · two voices · nothing to tap while you drive
          </div>
        </div>
      </div>
      <div className="pod-line" aria-live="polite">
        <span className="pod-speaker">{line.speaker === "cohost" ? "Co-host" : "Your coach"}</span>
        {line.text}
      </div>
      <div className="pod-controls">
        <button className="btn" onClick={() => skip(-1)} aria-label="Previous chapter">
          ⏮
        </button>
        <button className="btn primary big" onClick={playing ? pause : () => play()} aria-label={playing ? "Pause" : "Play"}>
          {playing ? "Pause" : "Play"}
        </button>
        <button className="btn" onClick={() => skip(1)} aria-label="Next chapter">
          ⏭
        </button>
        <button
          className="btn"
          onClick={() => {
            const r = rate === 1 ? 1.25 : 1;
            setRate(r);
            voice.rate = r;
            if (playing) play(i);
          }}
        >
          {rate}×
        </button>
      </div>
      <ol className="pod-chapters">
        {chapters.map((c, k) => (
          <li key={c.name}>
            <button
              className={k === chapterIdx ? "on" : ""}
              onClick={() => {
                setI(c.start);
                play(c.start);
              }}
            >
              {c.name}
            </button>
          </li>
        ))}
      </ol>
      <p className="fine">Must-knows are read out loud too. No decision is ever confirmed in podcast mode.</p>
    </div>
  );
}

export function Checkin({ onDone }) {
  const family = useStore((s) => s.family);
  const person = useStore((s) => s.person);
  const { list, statuses } = useMissions();
  const [msgs, setMsgs] = useState([]);
  const [next, setNext] = useState(null);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [finished, setFinished] = useState(false);
  const box = useRef();
  // What is ticked right now travels with every message, so the AI always knows.
  const missions = list.map((m, i) => ({ id: m.id, title: m.title, status: statuses[i] }));
  const ticks = useRef(null);
  useEffect(() => {
    // A tick (or untick) during the conversation shows up in it, as a quiet note.
    const now = Object.fromEntries(list.map((m, i) => [m.id, statuses[i] === "done"]));
    const prev = ticks.current;
    ticks.current = now;
    if (!prev) return;
    const changed = list.filter((m) => prev[m.id] !== undefined && prev[m.id] !== now[m.id]);
    if (changed.length) setMsgs((ms) => [...ms, ...changed.map((m) => ({ role: "note", text: now[m.id] ? `Ticked: ${m.title}` : `Unticked: ${m.title}` }))]);
  }, [statuses.join(",")]);
  const sayAll = (arr) => {
    setMsgs((m) => [...m, ...arr.map((t) => ({ role: "assistant", text: t }))]);
    speak(arr.join(" "));
  };
  useEffect(() => {
    api.checkin({ family, person, stage: "start", missions }).then((r) => {
      sayAll(r.say);
      setNext(r.next);
    });
    return () => stopSpeaking();
  }, []);
  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" });
  }, [msgs.length]);
  const send = async (value) => {
    const answer = (value ?? text).trim();
    if (!answer || busy || !next) return;
    setText("");
    setBusy(true);
    setMsgs((m) => [...m, { role: "user", text: answer }]);
    try {
      const r = await api.checkin({ family, person, stage: next.stage, index: next.index, answer, missions });
      const st = useStore.getState();
      if (r.updates?.mission) {
        const map = { done: "done", in_progress: "active", not_done: st.missions.status[r.updates.mission.id] === "done" ? "done" : st.missions.status[r.updates.mission.id] || "todo" };
        st.setMissionStatus(r.updates.mission.id, map[r.updates.mission.status], { via: "checkin", blocker: r.updates.mission.blocker, quiet: true });
      }
      if (r.updates?.intakeChange) st.addNote("intakeChanges", r.updates.intakeChange);
      if (r.updates?.worry) st.addNote("worries", r.updates.worry);
      if (r.updates?.flagHuman) st.addNote("humanFlags", answer);
      sayAll(r.say);
      setNext(r.next);
      if (r.done) {
        setFinished(true);
        onDone?.();
      }
    } catch {
      sayAll(["I lost the connection for a moment. Please say that again."]);
    }
    setBusy(false);
  };
  return (
    <div className="checkin">
      <div className="chat-list" ref={box}>
        {msgs.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            <div className="bubble-msg">{m.text}</div>
          </div>
        ))}
        {busy && (
          <div className="msg assistant">
            <div className="bubble-msg typing">
              <i />
              <i />
              <i />
            </div>
          </div>
        )}
      </div>
      {!finished && (
        <form
          className="checkin-input"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type your answer, or use the microphone" aria-label="Your answer" />
          <MicButton onText={(t) => send(t)} />
          <button className="btn primary" disabled={!text.trim() || busy}>
            Send
          </button>
        </form>
      )}
      <p className="fine">This check-in only records what you tell it. It does not change your plan or confirm any decision.</p>
    </div>
  );
}

export function Picker() {
  const pool = useStore(useShallow((s) => s.plan.missionPool.filter((m) => s.missions.status[m.id] !== "done")));
  const suggested = useStore(useShallow((s) => nextIds(s)));
  const month = useStore((s) => s.missions.month);
  const [sel, setSel] = useState(suggested);
  const [confirm, setConfirm] = useState(false);
  const start = useStore((s) => s.startNextMonth);
  const carry = useStore(useShallow((s) => s.missions.active.filter((id) => s.missions.status[id] !== "done")));
  const toggle = (id) => setSel((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < 3 ? [...cur, id] : cur));
  return (
    <div className="picker">
      <p className="mute">Pick up to three. The ones your plan points to first are already selected.</p>
      <div className="mission-list">
        {pool.map((m) => (
          <label key={m.id} className={`pick ${sel.includes(m.id) ? "on" : ""}`}>
            <input type="checkbox" checked={sel.includes(m.id)} onChange={() => toggle(m.id)} />
            <span>
              <span className="m-type">
                {{ understand: "Understand", quick: "Quick", important: "Important", practical: "Practical" }[m.type] || "Mission"} · about {m.minutes} min
              </span>
              <b>{m.title}</b>
            </span>
          </label>
        ))}
      </div>
      {/* Starting a month closes this one, so it asks once before it happens. */}
      {confirm ? (
        <div className="confirm-row" role="group" aria-label="Confirm the new month">
          <p>
            This closes month {month}.{carry.length ? ` ${carry.length === 1 ? "One unfinished mission comes" : `${carry.length} unfinished missions come`} with you if you keep ${carry.length === 1 ? "it" : "them"} selected.` : ""}
          </p>
          <button className="btn" onClick={() => setConfirm(false)}>
            Not yet
          </button>
          <button className="btn primary" autoFocus onClick={() => start(sel)}>
            Start month {month + 1}
          </button>
        </div>
      ) : (
        <button className="btn primary" disabled={!sel.length} onClick={() => setConfirm(true)}>
          Start month {month + 1} with {sel.length} mission{sel.length === 1 ? "" : "s"}
        </button>
      )}
    </div>
  );
}

// Inside the last bubble: this month's missions around the score ring, and the month-end
// review as a podcast, a check-in and the choice of next month's missions.
export function StepsInside() {
  const tab = "missions";
  const setTab = useStore((s) => s.setMonthTab);
  const plan = useStore((s) => s.plan);
  const { list, statuses, month } = useMissions();
  const proj = useStore((s) => s.projected().score);
  const asked = useStore((s) => s.asked);
  const notes = useStore((s) => s.notes);
  const [notesOpen, setNotesOpen] = useState(false);
  const done = statuses.filter((s) => s === "done").length;
  const questions = Object.entries(asked).flatMap(([bid, qs]) => qs.filter((q) => q.month === month).map((q) => ({ ...q, title: plan.bubbles.find((b) => b.id === bid)?.title })));
  const tabs = [];
  const { openMonthPage, openMeeting } = useStore.getState();
  return (
    <div className={`inside steps tab-${tab}`}>
      <header className="in-head">
        <div>
          <div className="eyebrow">Month {month}</div>
          <h1>Your plan of action</h1>
        </div>

      </header>
      {tab === "missions" && plan.texts?.anchor && <p className="anchor-line">{plan.texts.anchor}</p>}
      {tab === "missions" && (
        <p className="in-line small-line">
          {!list.length
            ? "No missions this month yet. Choose them in Next month."
            : done === list.length
              ? "You closed the ring."
              : `${list.length === 1 ? "One step" : `${list.length} steps`} for this month, ${done} done. Tap one to open it.`}
        </p>
      )}
      {tab === "podcast" && (
        <div className="in-free low">
          <Podcast onDone={() => setTab("checkin")} />
        </div>
      )}
      {tab === "checkin" && (
        <div className="in-free">
          <Checkin onDone={() => {}} />
        </div>
      )}
      {tab === "next" && (
        <div className="in-free">
          <Picker />
        </div>
      )}
      <div className="in-bottom">
        {tab === "missions" && (
          <>
            <p className="fine center">
              Published score {plan.score.value}.{proj !== plan.score.value ? ` Projected ${proj}. It becomes real when your next Sherpas update confirms what you did.` : " Complete a mission to see the projected score."} Missions you do not finish carry over.
            </p>
            <div className="in-ctl">
              <button className="btn" onClick={() => setNotesOpen(true)}>
                What I noted this month
              </button>
              <button className="btn" onClick={openMeeting}>
                Month-end meeting
              </button>
              <button className="btn primary" onClick={openMonthPage}>
                Open this month ›
              </button>
            </div>
          </>
        )}
        {tab === "checkin" && (
          <div className="in-ctl">
            <button className="btn primary" onClick={() => setTab("next")}>
              Choose next month's missions ›
            </button>
          </div>
        )}
      </div>
      {notesOpen && (
        <BubbleScreen eyebrow={`Month ${month}`} title="What I noted this month" onClose={() => setNotesOpen(false)}>
          {!questions.length && !notes.intakeChanges?.length && !notes.worries?.length && <p className="mute">Nothing yet. Your questions and anything you tell the check-in will appear here.</p>}
          <ul className="analysis">
            {questions.slice(-6).map((q, i) => (
              <li key={`q${i}`}>
                <span className="mute">You asked about {q.title}:</span> {q.q}
              </li>
            ))}
            {notes.intakeChanges?.map((n, i) => (
              <li key={`c${i}`}>
                <span className="mute">For your advisor's firm, update the intake:</span> {n.text}
              </li>
            ))}
            {notes.worries?.map((n, i) => (
              <li key={`w${i}`}>
                <span className="mute">On your mind:</span> {n.text}
              </li>
            ))}
          </ul>
        </BubbleScreen>
      )}
    </div>
  );
}
