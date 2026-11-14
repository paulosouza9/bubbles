// The 3D experience, one bubble at a time. No cards: the bubble is the container.
//   3 Outside  the bubble floats in front of you with its one sentence
//   2 Inside   the bubble fills the screen: the voice, one sentence at a time, and a toy to play with
//   1 Deeper   every figure is a small bubble you can tap
import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { sfx, speak, stopSpeaking } from "../audio.js";
import { STATUS_COLOR, STATUS_WORD, sentences } from "../format.js";
import MiniApp from "../miniapps/index.jsx";
import { useStore } from "../store.js";
import { MissionChip } from "./Missions.jsx";
import { StepsInside } from "./Month.jsx";
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

function useKaraoke(text) {
  const parts = sentences(text);
  const [cur, setCur] = useState(0);
  const [playing, setPlaying] = useState(false);
  const play = () => {
    setPlaying(true);
    setCur(0);
    speak(text, {
      onProgress: (p) => {
        let acc = 0;
        const at = p * text.length;
        for (let k = 0; k < parts.length; k++) {
          acc += parts[k].length + 1;
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
    if (text) play();
    return stop;
  }, [text]);
  return { parts, cur, playing, play, stop };
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

function Outside({ b }) {
  const enter = useStore((s) => s.enter);
  useEffect(() => {
    const t = setTimeout(() => speak(`${b.title}. ${b.building}`), 900);
    return () => {
      clearTimeout(t);
      stopSpeaking();
    };
  }, [b.id]);
  return (
    <div className="outside">
      <button
        className="btn primary big"
        onClick={() => {
          sfx("whoosh");
          enter(b.id);
        }}
      >
        Step inside
      </button>
      <span className="mute small">or tap the bubble · scroll or pinch to zoom in and out</span>
    </div>
  );
}

function Inside({ b }) {
  const style = useStore((s) => s.profile().style);
  const kind = useStore((s) => s.profile().kind);
  const chatOpen = useStore((s) => s.chat.open);
  const move = useStore((s) => s.plan.moves.find((m) => m.bubbleId === b.id));
  const mission = useStore((s) => s.activeMissions().find((m) => m.bubbleId === b.id && s.missions.status[m.id] !== "done"));
  const { simpler, deeper, openDecision } = useStore.getState();
  const text = b.floor[style];
  const k = useKaraoke(text);
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
        <MustLine items={b.mustKnow} />
        <div className="in-ctl">
          <button className="btn" onClick={k.playing ? k.stop : k.play}>
            {k.playing ? "Pause" : "Listen again"}
          </button>
          <button className="btn" onClick={simpler}>
            {style === "standard" ? "Simpler" : "‹ Step out"}
          </button>
          <button className="btn" onClick={deeper}>
            {style === "plain" ? "More detail" : "See the figures ›"}
          </button>
          {mission && (
            <button className="btn" onClick={() => openDecision(mission.id)}>
              Your step here
            </button>
          )}
          <NextButton />
        </div>
      </div>
    </div>
  );
}

function Deeper({ b }) {
  const fact = useStore((s) => s.fact);
  const setLevel = useStore((s) => s.setLevel);
  const [open, setOpen] = useState(false);
  const d = fact != null ? b.desks[fact] : null;
  return (
    <div className="inside deeper">
      <header className="in-head">
        <h2>
          <Dot status={b.status} /> {b.title}
        </h2>
        <span className="mute small">The figures. Each bubble is one figure from your plan.</span>
      </header>
      <div className="fact-read" data-ask key={fact ?? "none"}>
        {d ? (
          <>
            <span className="fact-label">{d.label}</span>
            <span className="fact-value">{d.value}</span>
            {d.note && <span className="fact-note">{d.note}</span>}
          </>
        ) : (
          <span className="fact-label">Tap a bubble to see what it is.</span>
        )}
      </div>
      <div className="in-bottom">
        <MustLine items={b.mustKnow} />
        <div className="in-ctl">
          <button className="btn" onClick={() => setLevel(2)}>
            ‹ Back to the explanation
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
    [2, "Inside", "Explained"],
    [1, "Deeper", "The figures"],
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
