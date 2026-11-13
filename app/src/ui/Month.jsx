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
import { MissionRow, Ring, useMissions } from "./Missions.jsx";

function nextIds(s) {
  // Unfinished missions carry over; then the plan's remaining moves; then topics to understand.
  const carry = s.missions.active.filter((id) => s.missions.status[id] !== "done");
  const rest = s.plan.missionPool.filter((m) => s.missions.status[m.id] !== "done" && !carry.includes(m.id));
  const moves = rest.filter((m) => m.moveId).map((m) => m.id);
  const under = rest.filter((m) => !m.moveId).map((m) => m.id);
  return [...carry, ...moves, ...under].slice(0, 3);
}

function Podcast({ onDone }) {
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
    navigator.mediaSession.metadata = new MediaMetadata({ title: `Your money, month ${month}`, artist: `Burbuja for ${names}`, album: "Monthly review" });
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

function Checkin({ onDone }) {
  const family = useStore((s) => s.family);
  const person = useStore((s) => s.person);
  const { list } = useMissions();
  const [msgs, setMsgs] = useState([]);
  const [next, setNext] = useState(null);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [finished, setFinished] = useState(false);
  const box = useRef();
  const missions = list.map((m) => ({ id: m.id, title: m.title }));
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
        st.setMissionStatus(r.updates.mission.id, map[r.updates.mission.status], { via: "checkin", blocker: r.updates.mission.blocker });
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

function Picker() {
  const pool = useStore(useShallow((s) => s.plan.missionPool.filter((m) => s.missions.status[m.id] !== "done")));
  const suggested = useStore(useShallow((s) => nextIds(s)));
  const month = useStore((s) => s.missions.month);
  const [sel, setSel] = useState(suggested);
  const start = useStore((s) => s.startNextMonth);
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
                {m.type === "understand" ? "Understand" : m.type === "quick" ? "Quick" : "Important"} · about {m.minutes} min
              </span>
              <b>{m.title}</b>
            </span>
          </label>
        ))}
      </div>
      <button className="btn primary" disabled={!sel.length} onClick={() => start(sel)}>
        Start month {month + 1} with {sel.length} mission{sel.length === 1 ? "" : "s"}
      </button>
    </div>
  );
}

export function Month() {
  const plan = useStore((s) => s.plan);
  const { list, statuses, month } = useMissions();
  const proj = useStore(useShallow((s) => s.projected()));
  const asked = useStore((s) => s.asked);
  const notes = useStore((s) => s.notes);
  const { setPhase, openDecision } = useStore.getState();
  const [tab, setTab] = useState("review");
  const [checked, setChecked] = useState(false);
  const year = new Date().getFullYear();
  const upcoming = (plan.bubbles.find((b) => b.id === "retirement")?.miniapp.data.goals || [])
    .filter((g) => (g.endYear || g.year) >= year)
    .sort((a, b) => a.year - b.year)
    .slice(0, 3);
  const questions = Object.entries(asked).flatMap(([bid, qs]) => qs.filter((q) => q.month === month).map((q) => ({ ...q, title: plan.bubbles.find((b) => b.id === bid)?.title })));
  const done = statuses.filter((s) => s === "done").length;
  return (
    <div className="month-wrap">
      <section className="glass month" aria-label="Month-end review">
        <header className="sheet-head">
          <div>
            <div className="eyebrow">Month {month} in review</div>
            <h2>
              {done === list.length && list.length ? "You closed the ring." : done ? `${done} of ${list.length} missions done.` : "Here is where things stand."}
            </h2>
          </div>
          <button className="btn" onClick={() => setPhase("cloud")}>
            Back to the map
          </button>
        </header>
        <div className="seg wide" role="tablist">
          {[
            ["review", "Review"],
            ["podcast", "Listen as a podcast"],
            ["checkin", "Check-in"],
            ["next", "Next month"],
          ].map(([v, label]) => (
            <button key={v} role="tab" aria-selected={tab === v} className={tab === v ? "on" : ""} onClick={() => { stopSpeaking(); setTab(v); }}>
              {label}
            </button>
          ))}
        </div>
        <div className="month-body">
          {tab === "review" && (
            <div className="review">
              <div className="review-top">
                <ScoreRing score={plan.score.value} projected={proj.score} size={128} />
                <div>
                  <div className="ring-row">
                    <Ring statuses={statuses} size={52} />
                    <b>
                      {done} of {list.length} missions done
                    </b>
                  </div>
                  <p className="mute small">
                    Published score {plan.score.value}.{proj.score !== plan.score.value ? ` Projected ${proj.score}, once your next Sherpas update confirms what you did.` : " No change projected yet."}
                  </p>
                </div>
              </div>
              <h3>Your missions</h3>
              <div className="mission-list">
                {list.map((m, i) => (
                  <MissionRow key={m.id} m={m} status={statuses[i]} onOpen={() => openDecision(m.id)} />
                ))}
              </div>
              {questions.length > 0 && (
                <>
                  <h3>What you asked this month</h3>
                  <ul className="analysis">
                    {questions.slice(-5).map((q, i) => (
                      <li key={i}>
                        <span className="mute">{q.title}:</span> {q.quote ? `“${q.quote}” ` : ""}
                        {q.q}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {(notes.intakeChanges?.length > 0 || notes.worries?.length > 0) && (
                <>
                  <h3>Noted for your advisor's firm</h3>
                  <ul className="analysis">
                    {notes.intakeChanges?.map((n, i) => (
                      <li key={`c${i}`}>
                        <span className="mute">Update the intake:</span> {n.text}
                      </li>
                    ))}
                    {notes.worries?.map((n, i) => (
                      <li key={`w${i}`}>
                        <span className="mute">On your mind:</span> {n.text}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {upcoming.length > 0 && (
                <>
                  <h3>Coming up in your plan</h3>
                  <div className="legend">
                    {upcoming.map((g) => (
                      <span key={g.name} className="chip static">
                        <i style={{ background: "#FF9F0A" }} />
                        {g.name} · {g.year}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          {tab === "podcast" && <Podcast onDone={() => setTab("checkin")} />}
          {tab === "checkin" && <Checkin onDone={() => setChecked(true)} />}
          {tab === "next" && <Picker />}
        </div>
        {tab === "checkin" && checked && (
          <footer className="modal-foot">
            <span className="grow" />
            <button className="btn primary" onClick={() => setTab("next")}>
              Choose next month's missions
            </button>
          </footer>
        )}
      </section>
    </div>
  );
}
