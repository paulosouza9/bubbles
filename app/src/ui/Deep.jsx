// The 3D experience, one bubble at a time. No cards: the bubble is the container.
//   3 Outside  the bubble floats in front of you with its one sentence
//   2 Inside   the bubble fills the screen: the voice, one sentence at a time, and a toy to play with
//   1 Deeper   every figure is a small bubble you can tap
import { useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { sfx, speak, stopSpeaking } from "../audio.js";
import { STATUS_COLOR, STATUS_WORD, sentences, usdShort } from "../format.js";
import MiniApp from "../miniapps/index.jsx";
import { fresh, heard, outsideLine } from "../repeat.js";
import { useStore } from "../store.js";
import { MissionChip } from "./Missions.jsx";
import { StepsInside } from "./Month.jsx";
import { hopeFor } from "../hope.js";
import Detail from "./Detail.jsx";
import { ActionMoment } from "./Moments.jsx";
import { Dot, FlatStage } from "./Panels.jsx";

// A full-screen "bubble" for longer reading: it grows from the middle until no edge is left.
export function BubbleScreen({ title, eyebrow, onClose, children, foot }) {
  return (
    <div className="bubble-screen" role="dialog" aria-label={title}>
      <button className="icon-btn bs-close" onClick={onClose} aria-label="Close">
        ✕
      </button>
      <div className="bs-col">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        {title && <h2>{title}</h2>}
        <div className="bs-body" data-ask>
          {children}
        </div>
        {foot && <div className="bs-foot">{foot}</div>}
      </div>
    </div>
  );
}

// Must-knows are never hidden: the first one is always on screen, the rest one tap away.
export function MustLine({ items }) {
  const [open, setOpen] = useState(false);
  if (!items?.length) return null;
  return (
    <div className="must-line" data-ask>
      <span className="i">i</span>
      <span>
        <b>Must know.</b> {items[0].text}
        {open && items.slice(1).map((m, k) => <span key={k}> {m.text}</span>)}
        {items.length > 1 && (
          <button className="link" onClick={() => setOpen(!open)}>
            {open ? "less" : `+${items.length - 1} more`}
          </button>
        )}
      </span>
    </div>
  );
}

// Reads the parts of `text` the person has not already heard in this bubble, one sentence
// at a time. "Listen again" reads everything, on request.
function useKaraoke(bubbleId, text, voiceText) {
  // The voice reads its own layered script when there is one (it never restates the level
  // before), filtered once more against everything already said in this bubble.
  const spoken = voiceText ?? text;
  const f = useMemo(() => {
    const r = fresh(bubbleId, spoken);
    return { ...r, display: sentences(text), mapped: spoken === text };
  }, [bubbleId, spoken, text]);
  const [cur, setCur] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [mode, setMode] = useState("fresh");
  const run = (which) => {
    const list = which === "all" ? f.all : f.parts;
    const said = list.join(" ");
    if (!said) return;
    setMode(which);
    setPlaying(true);
    setCur(0);
    heard(bubbleId, said);
    speak(said, {
      onProgress: (p) => {
        let acc = 0;
        const at = p * said.length;
        for (let k = 0; k < list.length; k++) {
          acc += list[k].length + 1;
          if (at <= acc) return setCur(k);
        }
      },
      onEnd: () => setPlaying(false),
    });
  };
  const stop = () => {
    stopSpeaking();
    setPlaying(false);
  };
  useEffect(() => {
    if (f.parts.length) run("fresh");
    return stop;
  }, [f]);
  const parts = mode === "all" ? f.all : f.parts;
  // Position of the sentence being read, within the text on screen (when they are the same text).
  const curInAll = playing && f.mapped ? (mode === "all" ? cur : f.index[cur]) : -1;
  return { parts, all: f.display, cur, curInAll, playing, play: () => run("all"), stop, nothingNew: !f.parts.length };
}

function SeqNav() {
  const seq = useStore(useShallow((s) => s.seq()));
  const focus = useStore((s) => s.focus);
  const { go, jump, bubble } = useStore.getState();
  const i = seq.indexOf(focus);
  return (
    <>
      <nav className="seq" aria-label="Bubbles">
        {seq.map((id) => {
          const b = bubble(id);
          return <button key={id} className={id === focus ? "now" : ""} style={{ "--c": STATUS_COLOR[b.status] }} title={b.title} aria-label={b.title} aria-current={id === focus} onClick={() => jump(id)} />;
        })}
      </nav>
      {i > 0 && (
        <button className="glass nav-arrow prev" onClick={() => go(-1)} aria-label="Previous bubble">
          ‹
        </button>
      )}
      {i < seq.length - 1 && (
        <button className="glass nav-arrow next" onClick={() => go(1)} aria-label="Next bubble">
          ›
        </button>
      )}
    </>
  );
}

function NextButton() {
  const more = useStore((s) => {
    const seq = s.seq();
    return seq.indexOf(s.focus) < seq.length - 1;
  });
  const go = useStore((s) => s.go);
  if (!more) return null;
  return (
    <button className="btn primary" onClick={() => go(1)}>
      Next bubble ›
    </button>
  );
}

// What waits inside each kind of bubble, said in a way that makes you want to look.
const TEASER = {
  buckets: "Pour your income in and watch where every dollar goes.",
  tank: "See how many months your cash would last if the paychecks stopped.",
  timeline: "Travel through the years of your plan and see how long your savings last.",
  debts: "Line up your debts by what they really cost you.",
  coverage: "See who your cover protects today, and grow the umbrella.",
  college: "See how far each child's college fund has to go.",
  allocation: "Turn your mix of investments around and compare it with the target.",
  score: "Switch on the steps in your plan and watch your score climb.",
  assumptions: "Check the few things your whole plan takes for granted.",
  steps: "Your three missions this month, and your month-end review.",
};

// The one number that matters most for this bubble, straight from the plan.
function hero(b, plan, missions) {
  const d = b.miniapp.data || {};
  if (b.id === "steps") {
    const done = missions.active.filter((id) => missions.status[id] === "done").length;
    return { big: `${done}/${missions.active.length}`, small: "missions done this month", bar: missions.active.length ? done / missions.active.length : 0 };
  }
  if (b.miniapp.template === "score") return { big: String(d.score), small: `out of 100 · ${plan.score.band}`, bar: d.score / 100 };
  if (b.miniapp.template === "timeline") {
    return d.runsOutAge
      ? { big: String(d.runsOutAge), small: `the age your savings run out. Your plan runs to ${d.endAge}.` }
      : { big: String(d.endAge), small: "your savings last to the end of the plan" };
  }
  if (b.miniapp.template === "college") return { big: usdShort(d.totalGap), small: "still to fund for college" };
  if (b.miniapp.template === "assumptions") return { big: String(d.items?.length || 0), small: "things your plan takes for granted" };
  if (b.points) {
    const [got, of] = String(b.points).split("/").map(Number);
    return { big: b.points, small: "points in your Sherpas score", bar: of ? got / of : null };
  }
  return null;
}

function Outside({ b }) {
  const enter = useStore((s) => s.enter);
  const plan = useStore((s) => s.plan);
  const missions = useStore((s) => s.missions);
  const stepHere = useStore((s) => s.journeyDone && s.currentMission()?.bubbleId === b.id);
  const h = hero(b, plan, missions);
  // Every concern comes with its way forward, right next to it.
  const hope = hopeFor(b, plan);
  useEffect(() => {
    const t = setTimeout(() => {
      const line = fresh(b.id, [outsideLine(b.title, b.building), b.emotion?.stakes, hope].filter(Boolean).join(" ")).parts.join(" ");
      if (!line) return;
      heard(b.id, line);
      speak(line);
    }, 900);
    return () => {
      clearTimeout(t);
      stopSpeaking();
    };
  }, [b.id]);
  const go = () => {
    sfx("whoosh");
    enter(b.id);
  };
  return (
    <div className="outside" key={b.id}>
      <div className="out-panel">
        <span className="out-status">
          {b.status !== "neutral" && <Dot status={b.status} />} {STATUS_WORD[b.status]}
          {stepHere && <span className="b-step">Your next step is in here</span>}
        </span>
        <h1 className="out-title">{b.title}</h1>
        {h && (
          <div className={`out-hero s-${b.status}`}>
            <b>{h.big}</b>
            <span>{h.small}</span>
            {h.bar != null && (
              <i className="out-bar">
                <i style={{ width: `${Math.max(2, h.bar * 100)}%` }} />
              </i>
            )}
          </div>
        )}
        <p className="out-lede" data-ask>
          {b.building}
        </p>
        {b.emotion?.stakes && (
          <p className="out-stakes" data-ask>
            {b.emotion.stakes}
          </p>
        )}
        {hope && (
          <div className="out-step">
            <span className="eyebrow">Your way forward</span>
            <p data-ask>{hope}</p>
          </div>
        )}
        <div className="out-cta">
          <button className="btn primary big" onClick={go}>
            Step inside ›
          </button>
          <span className="mute small">{TEASER[b.miniapp.template] || "A short explanation, something to play with and the detailed charts."}</span>
        </div>
      </div>
    </div>
  );
}

function Inside({ b }) {
  const kind = useStore((s) => s.profile().kind);
  const chatOpen = useStore((s) => s.chat.open);
  const move = useStore((s) => s.plan.moves.find((m) => m.bubbleId === b.id));
  const mission = useStore((s) => s.activeMissions().find((m) => m.bubbleId === b.id && s.missions.status[m.id] !== "done"));
  const { simpler, deeper, openDecision } = useStore.getState();
  // Inside is always the simple version. The detailed one is one level deeper.
  const text = b.floor.plain;
  const k = useKaraoke(b.id, text, b.voice?.inside);
  // The moment to act comes once the explanation has landed.
  const [ready, setReady] = useState(false);
  const wasPlaying = useRef(false);
  useEffect(() => {
    if (k.playing) wasPlaying.current = true;
    else if (wasPlaying.current || k.nothingNew) {
      const t = setTimeout(() => setReady(true), 400);
      return () => clearTimeout(t);
    }
  }, [k.playing, k.nothingNew]);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 14000);
    return () => {
      clearTimeout(t);
      useStore.setState({ actReady: false });
    };
  }, []);
  useEffect(() => {
    useStore.setState({ actReady: ready });
  }, [ready]);
  useEffect(() => {
    if (chatOpen) k.stop();
  }, [chatOpen]);
  return (
    <div className="inside">
      <header className="in-head">
        <h2>
          <Dot status={b.status} /> {b.title}
        </h2>
        <span className="mute small">
          {STATUS_WORD[b.status]}
          {b.points ? ` · ${b.points} points in your score` : ""}
        </span>
      </header>
      <p className={`in-line ${k.playing ? "karaoke" : ""}`} data-ask key={k.playing ? k.cur : "all"}>
        {k.playing ? k.parts[k.cur] : text}
      </p>
      {k.playing && k.parts.length > 1 && (
        <div className="in-dots" aria-hidden="true">
          {k.parts.map((_, i) => (
            <i key={i} className={i === k.cur ? "now" : i < k.cur ? "done" : ""} />
          ))}
        </div>
      )}
      {b.miniapp.template === "assumptions" && (
        <div className="in-free bare">
          <MiniApp bubble={b} />
        </div>
      )}
      <div className="in-bottom">
        {kind === "action" && move && (
          <p className="in-do" data-ask>
            <b>What your plan suggests:</b> {move.title}.
          </p>
        )}
        <ActionMoment b={b} ready={ready} />
        <MustLine items={b.mustKnow} />
        <div className="in-ctl">
          <button className="btn" onClick={k.playing ? k.stop : k.play}>
            {k.playing ? "Pause" : "Listen again"}
          </button>
          <button className="btn" onClick={simpler}>
            ‹ Step out
          </button>
          <button
            className="btn"
            onClick={() => {
              sfx("whoosh");
              deeper();
            }}
          >
            In more detail ›
          </button>
          <NextButton />
        </div>
      </div>
    </div>
  );
}

function Deeper({ b }) {
  const setLevel = useStore((s) => s.setLevel);
  const chatOpen = useStore((s) => s.chat.open);
  const [open, setOpen] = useState(false);
  const text = b.floor.standard;
  const k = useKaraoke(b.id, text, b.voice?.deeper);
  useEffect(() => {
    if (chatOpen) k.stop();
  }, [chatOpen]);
  return (
    <div className="inside deeper">
      <header className="in-head">
        <h2>
          <Dot status={b.status} /> {b.title}
        </h2>
        <span className="mute small">In more detail</span>
      </header>
      <div className="detail-scroll">
        <p className="d-text" data-ask>
          {k.all.map((p, i) => (
            <span key={i} className={i === k.curInAll ? "now" : ""}>
              {p}{" "}
            </span>
          ))}
        </p>
        <div className="detail-grid" data-ask>
          <Detail bubble={b} />
        </div>
      </div>
      <div className="in-bottom">
        <MustLine items={b.mustKnow} />
        <div className="in-ctl">
          <button className="btn" onClick={k.playing ? k.stop : k.play}>
            {k.playing ? "Pause" : "Listen"}
          </button>
          <button
            className="btn"
            onClick={() => {
              sfx("whoosh");
              setLevel(2);
            }}
          >
            ‹ Simpler
          </button>
          {b.analysis.length > 0 && (
            <button className="btn" onClick={() => setOpen(true)}>
              What Sherpas' analysis says
            </button>
          )}
          <NextButton />
        </div>
      </div>
      {open && (
        <BubbleScreen eyebrow={b.title} title="What Sherpas' analysis says" onClose={() => setOpen(false)}>
          <ul className="analysis">
            {b.analysis.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
          {b.lookInto && (
            <p>
              <b>Worth looking into with a person:</b> {b.lookInto}
            </p>
          )}
        </BubbleScreen>
      )}
    </div>
  );
}

function Zoomer() {
  const level = useStore((s) => s.level);
  const focus = useStore((s) => s.focus);
  const { setLevel, enter } = useStore.getState();
  const stops = [
    [3, "Outside", "One sentence"],
    [2, "Inside", "The simple version"],
    [1, "Deeper", "In more detail"],
  ];
  return (
    <nav className="seg zoomer" aria-label="Zoom">
      {stops.map(([l, name, hint]) => (
        <button key={l} className={level === l ? "on" : ""} disabled={focus === "steps" && l === 1} onClick={() => (l === 2 && level === 3 ? enter(focus) : setLevel(l))} aria-current={level === l} title={hint}>
          {name}
        </button>
      ))}
    </nav>
  );
}

export function Stage() {
  const flat = useStore((s) => s.easy || s.simple);
  const level = useStore((s) => s.level);
  const focus = useStore((s) => s.focus);
  const month = useStore((s) => s.missions.month);
  if (flat) return <FlatStage />;
  const b = useStore.getState().bubble(focus || "steps");
  if (!b) return null;
  return (
    <div className={`stage deep level-${level}`} data-month={month}>
      <SeqNav />
      {level >= 3 && <Outside b={b} key={`o-${b.id}`} />}
      {level === 2 && (b.id === "steps" ? <StepsInside /> : <Inside b={b} key={`i-${b.id}`} />)}
      {level === 1 && <Deeper b={b} key={`d-${b.id}`} />}
      <Zoomer />
      {b.id !== "steps" && level >= 3 && <MissionChip />}
    </div>
  );
}
