// The 3D experience, one bubble at a time. No cards: the bubble is the container.
//   Outside    the bubble floats beside its story: the key number, why it matters, the way forward
//   Inside     the camera is inside the bubble: the simple explanation, a toy, then the first step
//   In detail  the toy breaks apart into the detailed explanation and its charts
// The guided path is three bubbles (what's working, what needs you, your next steps). Every
// other topic is one zoom out, in "All topics".
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useShallow } from "zustand/react/shallow";
import { sfx, speak, stopSpeaking } from "../audio.js";
import { STATUS_COLOR, STATUS_WORD, sentences, usdShort } from "../format.js";
import { hopeFor } from "../hope.js";
import { refreshDetailCache } from "../detailSample.js";
import { guessFor, guessVerdict } from "../guess.js";
import MiniApp from "../miniapps/index.jsx";
import { pathOf, ROLE } from "../path.js";
import { fresh, heard, outsideLine } from "../repeat.js";
import { useStore } from "../store.js";
import Detail from "./Detail.jsx";
import { DownloadPlanButton } from "./Chrome.jsx";
import { MissionChip } from "./Missions.jsx";
import { ActionMoment } from "./Moments.jsx";
import { StepsInside } from "./Month.jsx";
import { Dot, FlatStage } from "./Panels.jsx";

// While an overlay is open, Escape closes it and nothing else.
function useOverlayEscape(onClose) {
  useEffect(() => {
    useStore.setState({ overlayClose: onClose });
    return () => useStore.setState((s) => (s.overlayClose === onClose ? { overlayClose: null } : {}));
  }, [onClose]);
}

// A full-screen "bubble" for longer reading: it grows from the middle until no edge is left.
// Drawn at the top of the page (a portal), so no panel it opens from can tuck the zoom rail,
// the arrows or the top bar over it.
export function BubbleScreen({ title, eyebrow, onClose, children, foot }) {
  const close = useRef();
  useOverlayEscape(onClose);
  useEffect(() => close.current?.focus(), []);
  return createPortal(
    <div className="bubble-screen" role="dialog" aria-modal="true" aria-label={title}>
      <button ref={close} className="icon-btn bs-close" onClick={onClose} aria-label="Close">
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
    </div>,
    document.body,
  );
}

// Must-knows are never hidden: the first one is always on screen, the rest one tap away.
export function MustLine({ items }) {
  const [open, setOpen] = useState(false);
  if (!items?.length) return null;
  return (
    <div className="must-line" data-ask>
      <span className="i" aria-hidden="true">
        i
      </span>
      <span>
        <b>Must know.</b> {items[0].text}
        {open && items.slice(1).map((m, k) => <span key={k}> {m.text}</span>)}
        {items.length > 1 && (
          <button className="link" onClick={() => setOpen(!open)} aria-expanded={open}>
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
  const curInAll = playing && f.mapped ? (mode === "all" ? cur : f.index[cur]) : -1;
  return { parts, all: f.display, cur, curInAll, playing, play: () => run("all"), stop, nothingNew: !f.parts.length };
}

function ListenButton({ k }) {
  return (
    <button className="icon-btn listen" onClick={k.playing ? k.stop : k.play} aria-label={k.playing ? "Pause the voice" : "Listen again"} title={k.playing ? "Pause" : "Listen again"}>
      {k.playing ? (
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
          <rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
          <path d="M4 10v4h4l5 4V6L8 10H4z" fill="currentColor" />
          <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}

// ---- Navigation -----------------------------------------------------------------------

function SeqNav() {
  const nav = useRef();
  const path = useStore(useShallow((s) => s.seq()));
  const focus = useStore((s) => s.focus);
  const plan = useStore((s) => s.plan);
  const explored = useStore((s) => s.explored);
  const lit = useStore((s) => s.lit);
  const { go, jump, bubble } = useStore.getState();
  const i = path.indexOf(focus);
  useEffect(() => {
    nav.current?.querySelector('[aria-current="step"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [focus]);
  const roles = pathOf(plan);
  const short = (id) => (id === "steps" ? "Your plan of action" : bubble(id).title);
  return (
    <>
      {/* The path: where you are (named), where you have been (filled), what is left (hollow). */}
      <nav ref={nav} className="seq glass" aria-label="Your path">
        {path.map((id, k) => {
          const b = bubble(id);
          const r = roles.indexOf(id);
          const now = id === focus;
          const label = `${r >= 0 ? `${ROLE[r]}: ` : ""}${short(id)} (${k + 1} of ${path.length})${explored[id] ? ", explored" : ", not explored yet"}`;
          return (
            <button
              key={id}
              className={`${now ? "now" : ""} ${explored[id] ? "seen" : ""} ${lit === id ? "lit" : ""}`}
              style={{ "--c": STATUS_COLOR[b.status] }}
              data-label={now ? undefined : label}
              aria-label={label}
              aria-current={now ? "step" : undefined}
              onClick={() => jump(id)}
            >
              <i />
              {now && (
                <span className="seq-now">
                  <span className="seq-k">
                    {k + 1}/{path.length}
                  </span>{" "}
                  {short(id)}
                </span>
              )}
            </button>
          );
        })}
      </nav>
      {i > 0 && (
        <button className="glass nav-arrow prev" onClick={() => go(-1)} aria-label={`Previous bubble: ${short(path[i - 1])}`}>
          <span aria-hidden="true">‹</span>
          <span className="na-name">{short(path[i - 1])}</span>
        </button>
      )}
      {i >= 0 && i < path.length - 1 && (
        <button className="glass nav-arrow next" onClick={() => go(1)} aria-label={`Next bubble: ${short(path[i + 1])}`}>
          <span className="na-name">{short(path[i + 1])}</span>
          <span aria-hidden="true">›</span>
        </button>
      )}
    </>
  );
}

function NextButton({ primary = true }) {
  const path = useStore(useShallow((s) => s.seq()));
  const focus = useStore((s) => s.focus);
  const { go, jump } = useStore.getState();
  const i = path.indexOf(focus);
  // Off the path (a topic opened from "All topics"), the way on is the plan of action.
  if (i < 0)
    return (
      <button className={`btn ${primary ? "primary" : ""}`} onClick={() => jump("steps")}>
        Your next steps ›
      </button>
    );
  if (i >= path.length - 1) return null;
  return (
    <button className={`btn ${primary ? "primary" : ""}`} onClick={() => go(1)}>
      {path[i + 1] === "steps" ? "Your plan of action ›" : `Next bubble · ${i + 2} of ${path.length} ›`}
    </button>
  );
}

// "All topics": every bubble of the plan, one zoom out from the path.
function Overview() {
  const plan = useStore((s) => s.plan);
  const missions = useStore((s) => s.missions);
  const focus = useStore((s) => s.focus);
  const { jump, setOverview, allTopics, bubble } = useStore.getState();
  const path = pathOf(plan);
  const close = () => setOverview(false);
  useOverlayEscape(close);
  const first = useRef();
  useEffect(() => first.current?.focus(), []);
  const ids = [...allTopics(), "steps"];
  return (
    <div className="overview" role="dialog" aria-modal="true" aria-label="All topics">
      <button className="icon-btn bs-close" onClick={close} aria-label="Close">
        ✕
      </button>
      <div className="ov-col">
        <div className="eyebrow">{plan.label}'s money</div>
        <h2>All topics</h2>
        <p className="mute">The walk-through visits them in this order. Open any one whenever you like.</p>
        <ul className="ov-grid">
          {ids.map((id, n) => {
            const b = bubble(id);
            const h = hero(b, plan, missions);
            const k = path.indexOf(id);
            return (
              <li key={id}>
                <button ref={n === 0 ? first : undefined} className={`ov-tile ${id === focus ? "here" : ""}`} onClick={() => jump(id)}>
                  <span className="ov-orb" aria-hidden="true">
                    {h ? (
                      <>
                        <b>{h.big}</b>
                        {h.unit && <small>{h.unit}</small>}
                      </>
                    ) : null}
                  </span>
                  <span className="ov-text">
                    {k >= 0 && <span className="ov-role">{ROLE[k]}</span>}
                    <b>{b.title}</b>
                    <span className="ov-status">
                      {b.status !== "neutral" && <Dot status={b.status} />} {id === "steps" ? (h ? `${h.big.split("/")[0]} of ${h.big.split("/")[1]} ${h.small}` : "") : STATUS_WORD[b.status]}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

// ---- Outside --------------------------------------------------------------------------------

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
  steps: "Your missions this month, and your month-end review.",
};

// The one number that matters most for this bubble, straight from the plan.
export function hero(b, plan, missions) {
  const d = b.miniapp.data || {};
  if (b.id === "steps") {
    const done = missions.active.filter((id) => missions.status[id] === "done").length;
    return { big: `${done}/${missions.active.length}`, unit: "done", small: "missions done this month", bar: missions.active.length ? done / missions.active.length : 0 };
  }
  if (b.miniapp.template === "score") return { big: String(d.score), unit: "of 100", small: `out of 100 · ${plan.score.band}`, bar: d.score / 100, score: true };
  if (b.miniapp.template === "timeline") {
    return d.runsOutAge
      ? { big: String(d.runsOutAge), unit: "age", small: `the age your savings run out. Your plan runs to ${d.endAge}.` }
      : { big: String(d.endAge), unit: "age", small: "your savings last to the end of the plan" };
  }
  if (b.miniapp.template === "college") return { big: usdShort(d.totalGap), unit: "to fund", small: "still to fund for college" };
  if (b.miniapp.template === "assumptions") return { big: String(d.items?.length || 0), unit: "items", small: "things your plan takes for granted" };
  if (b.points) {
    const [got, of] = String(b.points).split("/").map(Number);
    return { big: b.points, unit: "points", small: "points in your Sherpas score", bar: of ? got / of : null, score: true };
  }
  return null;
}

function ScoreExplainer({ plan, b }) {
  const [open, setOpen] = useState(false);
  const areas = plan.bubbles.find((x) => x.id === "score")?.miniapp.data.pillars?.length || 0;
  const [, of] = String(b.points || "").split("/");
  return (
    <span className="score-help">
      <button className="q" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="What is the Sherpas score?">
        ?
      </button>
      {open && (
        <span className="score-help-text" role="note">
          Sherpas rates your plan's health from 0 to 100. Yours is {plan.score.value} today.{areas ? ` It adds up ${areas} areas` : ""}
          {of ? `; this one can give up to ${of} points.` : "."}
        </span>
      )}
    </span>
  );
}

// ---- Guess before you see -------------------------------------------------------------------
function GuessCard({ g, onDone, onSkip }) {
  const [v, setV] = useState(g.start);
  const [touched, setTouched] = useState(false);
  return (
    <div className="guess" role="group" aria-labelledby="guess-q">
      <span className="guess-tag">Before you step in, guess</span>
      <p id="guess-q" className="guess-q">
        {g.q}
      </p>
      <div className="guess-value" aria-live="polite">
        {touched ? g.show(v) : "?"}
      </div>
      <input
        className="guess-range"
        type="range"
        min={g.min}
        max={g.max}
        step={g.step}
        value={v}
        aria-label="Your guess"
        aria-valuetext={g.show(v)}
        onChange={(e) => {
          setTouched(true);
          setV(Number(e.target.value));
        }}
      />
      <div className="guess-scale" aria-hidden="true">
        <span>{g.show(g.min)}</span>
        <span>{g.show(g.max)}</span>
      </div>
      <div className="guess-ctl">
        <button className="btn primary big" disabled={!touched} onClick={() => onDone(v)}>
          {touched ? "Reveal ›" : "Move the slider to guess"}
        </button>
        <button className="link" onClick={onSkip}>
          Skip the guess
        </button>
      </div>
    </div>
  );
}

function GuessReveal({ g, r }) {
  const [shown, setShown] = useState(g.min);
  useEffect(() => {
    const t0 = performance.now();
    let raf;
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / 1100);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(g.min + (g.real - g.min) * e);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  const pct = (x) => `${((x - g.min) / (g.max - g.min)) * 100}%`;
  const value = g.step < 1 ? Math.round(shown * 10) / 10 : Math.round(shown);
  return (
    <div className={`guess-reveal ${r.near ? "near" : ""}`} aria-live="polite">
      <div className="gr-pop" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => (
          <i key={i} style={{ "--a": `${i * 36}deg`, "--d": `${(i % 3) * 0.06}s` }} />
        ))}
      </div>
      <div className="gr-num">{g.show(value)}</div>
      <div className="gr-head">{r.head}</div>
      <div className="gr-track" aria-hidden="true">
        <span className="gr-you" style={{ left: pct(r.value) }}>
          you
        </span>
        <span className="gr-real" style={{ left: pct(g.real) }} />
      </div>
      <p className="gr-line">
        You guessed {g.show(r.value)}. {r.line}
      </p>
    </div>
  );
}

function Outside({ b }) {
  const enter = useStore((s) => s.enter);
  const plan = useStore((s) => s.plan);
  const missions = useStore((s) => s.missions);
  const hinted = useStore((s) => s.hinted);
  const stepHere = useStore((s) => s.journeyDone && s.currentMission()?.bubbleId === b.id);
  const k = pathOf(plan).indexOf(b.id);
  const h = hero(b, plan, missions);
  // Every concern comes with its way forward, right next to it.
  const hope = hopeFor(b, plan);
  const g = guessFor(b);
  const guessed = useStore((s) => s.guessed[b.id]);
  const [reveal, setReveal] = useState(null);
  // Never on the first bubble of the walk-through: that one is for learning how it all works.
  const touring = useStore((s) => s.phase === "journey" && !s.tourDone);
  const first = plan.order[0] === b.id;
  const pending = Boolean(g) && guessed === undefined && !touring && !first;
  useEffect(() => {
    const t = setTimeout(() => {
      if (pending) return speak(`Before you step in, a guess. ${g.q}`);
      const line = fresh(b.id, [outsideLine(b.title, b.building), b.emotion?.stakes, hope].filter(Boolean).join(" ")).parts.join(" ");
      const lead = reveal ? `${reveal.head} ${reveal.line}` : "";
      if (!line && !lead) return;
      if (line) heard(b.id, line);
      speak([lead, line].filter(Boolean).join(" "));
    }, reveal ? 500 : 900);
    return () => {
      clearTimeout(t);
      stopSpeaking();
    };
  }, [b.id, pending]);
  const go = () => {
    sfx("whoosh");
    enter(b.id);
  };
  return (
    <div className="outside" key={b.id}>
      {!hinted && useStore.getState().tourDone && (
        <div className="out-hint" aria-hidden="true">
          Tap the bubble to step inside
        </div>
      )}
      <div className="out-panel">
        <span className="out-status">
          {k >= 0 && <span className="out-role">{ROLE[k]}</span>}
          {b.id !== "steps" && (
            <span className="out-state">
              <Dot status={b.status} /> {STATUS_WORD[b.status]}
            </span>
          )}
          {stepHere && <span className="b-step">Your next step is in here</span>}
        </span>
        <h1 className="out-title">{b.title}</h1>
        {pending ? (
          <GuessCard
            g={g}
            onDone={(value) => {
              const v = guessVerdict(g, value);
              setReveal({ ...v, value });
              sfx("ding");
              useStore.getState().setGuess(b.id, value);
            }}
            onSkip={() => useStore.getState().setGuess(b.id, null)}
          />
        ) : (
          <>
        {reveal && <GuessReveal g={g} r={reveal} />}
        {h && (
          <div className={`out-hero s-${b.status}`}>
            <b>{h.big}</b>
            <span>
              {h.small}
              {h.score && <ScoreExplainer plan={plan} b={b} />}
            </span>
            {h.bar != null && (
              <i className="out-bar" aria-hidden="true">
                <i style={{ width: `${Math.max(2, h.bar * 100)}%` }} />
              </i>
            )}
          </div>
        )}
        <p className="out-lede" data-ask>
          {b.building}
        </p>
        {b.emotion?.stakes && !reveal && (
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
          <button className="btn primary big zbtn" onClick={go}>
            <ZoomIcon dir="in" /> Step inside
          </button>
          <span className="mute small">{TEASER[b.miniapp.template] || "A short explanation, something to play with and the detailed charts."}</span>
        </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---- Inside ---------------------------------------------------------------------------------

// The free band between the text above and the controls below, where the 3D toy is drawn.
function useToyBand() {
  const ref = useRef();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const report = () => {
      const r = el.getBoundingClientRect();
      useStore.setState({ toyBand: { top: r.top, bottom: r.bottom, left: r.left, right: r.right } });
    };
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    window.addEventListener("resize", report);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", report);
      useStore.setState({ toyBand: null });
    };
  }, []);
  return ref;
}

function Inside({ b }) {
  const chatOpen = useStore((s) => s.chat.open);
  const { simpler, deeper } = useStore.getState();
  const band = useToyBand();
  // Inside is always the simple version. The detailed one is one level deeper.
  const text = b.floor.plain;
  const k = useKaraoke(b.id, text, b.voice?.inside);
  // The moment to act comes once the explanation has landed.
  const [ready, setReady] = useState(false);
  const wasPlaying = useRef(false);
  useEffect(() => {
    useStore.setState({ hinted: true });
  }, []);
  useEffect(() => {
    if (k.playing) wasPlaying.current = true;
    else if (wasPlaying.current || k.nothingNew) {
      const t = setTimeout(() => setReady(true), 400);
      return () => clearTimeout(t);
    }
  }, [k.playing, k.nothingNew]);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 14000);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (chatOpen) k.stop();
  }, [chatOpen]);
  const toyless = b.miniapp.template === "assumptions";
  return (
    <div className="inside">
      <header className="in-head">
        <h1>
          <Dot status={b.status} /> {b.title}
        </h1>
        <span className="mute small">
          {STATUS_WORD[b.status]}
          {b.points ? ` · ${b.points} points in your score` : ""}
        </span>
      </header>
      <p className={`in-line ${k.playing ? "karaoke" : ""}`} data-ask key={k.playing ? k.cur : "all"} aria-live="polite">
        {k.playing ? k.parts[k.cur] : text}
      </p>
      {k.playing && k.parts.length > 1 && (
        <div className="in-dots" aria-hidden="true">
          {k.parts.map((_, i) => (
            <i key={i} className={i === k.cur ? "now" : i < k.cur ? "done" : ""} />
          ))}
        </div>
      )}
      {toyless ? (
        <div className="in-free bare">
          <MiniApp bubble={b} />
        </div>
      ) : (
        <div className="toy-space" ref={band} aria-hidden="true" />
      )}
      <DiveHandle dir="in" />
      <div className="in-bottom">
        <ActionMoment b={b} ready={ready} />
        <MustLine items={b.mustKnow} />
        <div className="in-ctl">
          <ListenButton k={k} />
          <NextButton primary={false} />
        </div>
      </div>
    </div>
  );
}

// ---- In detail --------------------------------------------------------------------------------

function Deeper({ b }) {
  const setLevel = useStore((s) => s.setLevel);
  const chatOpen = useStore((s) => s.chat.open);
  const [open, setOpen] = useState(false);
  const text = b.floor.standard;
  const k = useKaraoke(b.id, text, b.voice?.deeper);
  useEffect(() => {
    if (chatOpen) k.stop();
  }, [chatOpen]);
  // Keep a note of where every chart is drawn, so stepping back out starts from exactly that.
  useEffect(() => {
    const sc = document.querySelector(".inside.deeper .detail-scroll");
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(refreshDetailCache);
    };
    const t = setTimeout(refreshDetailCache, 1800);
    sc?.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(raf);
      sc?.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
    };
  }, [b.id]);
  return (
    <div className="inside deeper">
      <header className="in-head">
        <h1>
          <Dot status={b.status} /> {b.title}
        </h1>
        <span className="detail-badge">
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M15 15l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          In detail<span className="detail-badge-sub"> · every figure and chart</span>
        </span>
      </header>
      <DiveHandle dir="out" />
      <div className="detail-scroll" tabIndex={0} aria-label={`${b.title}, in detail`}>
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
          <ListenButton k={k} />
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

// The cloud: a returning visit starts here. The bubbles themselves (and their labels) are
// drawn in the 3D scene; this is the words around them.
function CloudHome() {
  const plan = useStore((s) => s.plan);
  const person = useStore((s) => s.person);
  const proj = useStore((s) => s.projected().score);
  const lastFocus = useStore((s) => s.lastFocus);
  const explored = useStore((s) => s.explored);
  const total = useStore.getState().allTopics();
  const left = total.filter((id) => !explored[id]).length;
  const last = lastFocus ? plan.bubbles.find((b) => b.id === lastFocus) : null;
  const spoke = useRef(false);
  useEffect(() => {
    if (spoke.current) return;
    spoke.current = true;
    speak(`Welcome back${person ? `, ${person}` : ""}. Here is your whole plan. Tap any bubble to open it, or the blue one for this month.`);
  }, []);
  return (
    <main className="stage deep cloud-home" aria-labelledby="cloud-title">
      <header className="cloud-head">
        <h1 id="cloud-title">{plan.label}'s plan</h1>
        <p>
          Sherpas score <b>{plan.score.value}</b>
          {proj !== plan.score.value ? <> · {proj} projected</> : null} · {left ? `${total.length - left} of ${total.length} explored. Step into a dim bubble to light it up.` : "Every bubble explored. Tap any to revisit it."}
        </p>
      </header>
      <div className="cloud-actions">
        {last && (
          <button className="btn primary" onClick={() => useStore.getState().jump(last.id)}>
            Continue with {last.title} ›
          </button>
        )}
        <DownloadPlanButton />
      </div>
    </main>
  );
}

// Zoom icons: one drawn pair, used on the rail and on the buttons.
export function ZoomIcon({ dir }) {
  return (
    <svg className="zoom-ico" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="6" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M13 13l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d={dir === "in" ? "M5.6 8.5h5.8M8.5 5.6v5.8" : "M5.6 8.5h5.8"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

// ---- The first-bubble tour: learn the controls by using them ---------------------------------
// Four steps, each waiting for the real action (step in, open the figures, come back, move on).
// Nothing is dimmed or blocked, and it can be skipped at any point.
const TOUR = [
  { target: ".out-cta .btn.primary", title: "Look inside", text: "Tap the bubble, or “Step inside”, to see what it holds." },
  { target: ".dive.in", title: "In detail", text: "Want every figure and chart? Tap “See in detail”." },
  { target: ".dive.out", title: "Back up", text: "Come back to the simple view whenever you like. The zoom on the right does the same." },
  { target: ".nav-arrow.next", title: "Next bubble", text: "When you are ready, move on to the next bubble." },
];
function Tour() {
  const step = useStore((s) => s.tourStep);
  const level = useStore((s) => s.level);
  const focus = useStore((s) => s.focus);
  const { setTourStep, endTour } = useStore.getState();
  const [rect, setRect] = useState(null);
  const start = useRef(focus);
  // Each step completes when the person does the thing it shows.
  useEffect(() => {
    if (step === 0 && level === 2) setTourStep(1);
    else if (step === 1 && level === 1) setTourStep(2);
    else if (step === 2 && level >= 2) setTourStep(3);
  }, [level, step]);
  useEffect(() => {
    if (step === 3 && focus !== start.current) endTour();
  }, [focus, step]);
  // Follow the target on screen (it can move as the bubble settles).
  useEffect(() => {
    let alive = true;
    const find = () => {
      if (!alive) return;
      const el = document.querySelector(TOUR[step].target);
      const r = el?.getBoundingClientRect();
      setRect(r && r.width ? { x: r.left, y: r.top, w: r.width, h: r.height } : null);
      setTimeout(find, 250);
    };
    find();
    return () => {
      alive = false;
    };
  }, [step]);
  if (!rect) return null;
  const t = TOUR[step];
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cardW = Math.min(300, vw - 24);
  const above = rect.y > vh * 0.55;
  const left = Math.max(12, Math.min(vw - cardW - 12, rect.x + rect.w / 2 - cardW / 2));
  const arrowX = Math.max(18, Math.min(cardW - 18, rect.x + rect.w / 2 - left));
  const style = above ? { left, width: cardW, bottom: vh - rect.y + 14 } : { left, width: cardW, top: rect.y + rect.h + 14 };
  return (
    <>
      <div className="tour-ring" aria-hidden="true" style={{ left: rect.x - 6, top: rect.y - 6, width: rect.w + 12, height: rect.h + 12 }} />
      <div className={`tour-card ${above ? "above" : "below"}`} style={{ ...style, "--ax": `${arrowX}px` }} role="dialog" aria-label={`Quick tour, step ${step + 1} of ${TOUR.length}`}>
        <div className="tour-top">
          <span className="tour-k">
            {step + 1} of {TOUR.length}
          </span>
          <span className="tour-dots" aria-hidden="true">
            {TOUR.map((_, i) => (
              <i key={i} className={i < step ? "done" : i === step ? "now" : ""} />
            ))}
          </span>
        </div>
        <b className="tour-title">{t.title}</b>
        <p className="tour-text">{t.text}</p>
        <div className="tour-ctl">
          {step === TOUR.length - 1 ? (
            <button className="btn primary" onClick={endTour}>
              Got it
            </button>
          ) : (
            <span className="tour-try">Try it now</span>
          )}
          <button className="link" onClick={endTour}>
            Skip the tour
          </button>
        </div>
      </div>
    </>
  );
}

// The dive handle: under the toy it invites you down into every figure; at the top of the
// detail it brings you back up. The rail on the right does the same; this is the inviting way.
function DiveHandle({ dir }) {
  const go = () => {
    sfx("whoosh");
    const s = useStore.getState();
    dir === "in" ? s.stepIn() : s.stepOut();
  };
  const chevron = (
    <svg className="dive-chev" viewBox="0 0 16 16" aria-hidden="true">
      <path d={dir === "in" ? "M3.5 6l4.5 4.5L12.5 6" : "M3.5 10l4.5-4.5 4.5 4.5"} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  return (
    <button className={`dive ${dir}`} onClick={go} aria-label={dir === "in" ? "Step in: see every figure, in detail" : "Step out: back to the simple view"}>
      {dir === "out" && chevron}
      <span>{dir === "in" ? "See in detail" : "Back to the simple view"}</span>
      {dir === "in" && chevron}
    </button>
  );
}

// The zoom, made visible: a ladder on the right edge, deepest at the top like a map's zoom.
// Every stop is named, the current one is marked, and "Step in" / "Step out" say what they do.
const STOPS = [
  { id: 1, name: "In detail", hint: "Every figure and chart" },
  { id: 2, name: "Inside", hint: "The simple explanation" },
  { id: 3, name: "Outside", hint: "The bubble in one sentence" },
  { id: "all", name: "All topics", hint: "Every bubble at once" },
];
function ZoomRail() {
  const level = useStore((s) => s.level);
  const focus = useStore((s) => s.focus);
  const overview = useStore((s) => s.overview);
  const home = useStore((s) => s.home);
  const zoomHinted = useStore((s) => s.zoomHinted);
  const hinted = useStore((s) => s.hinted);
  const journeyDone = useStore((s) => s.journeyDone);
  const { stepIn, stepOut, setLevel, enter, setOverview, goHome, dismissZoomHint } = useStore.getState();
  const here = overview || home ? "all" : level;
  const deepest = focus === "steps" ? 2 : 1;
  const canIn = here === "all" || here > deepest;
  const canOut = here !== "all";
  const goTo = (id) => {
    dismissZoomHint();
    if (id === "all") return journeyDone ? goHome() : setOverview(true);
    setOverview(false);
    if (home) useStore.getState().jump(focus);
    if (id === 3) return setLevel(3);
    if (useStore.getState().level === 3) enter(focus);
    if (id === 1) setLevel(1);
  };
  // The hint shows once, after the first "tap the bubble" hint has been seen.
  const showHint = !zoomHinted && hinted && useStore.getState().tourDone;
  return (
    <>
      <nav className="zoom-rail glass" aria-label="Zoom">
        <button className="zr-step" onClick={() => (sfx("whoosh"), stepIn())} disabled={!canIn} aria-label="Step in: more detail">
          <ZoomIcon dir="in" />
          <span>Step in</span>
        </button>
        <ol className="zr-stops">
          {STOPS.map((st) => {
            const off = st.id === 1 && deepest === 2;
            const on = here === st.id;
            return (
              <li key={st.id}>
                <button className={on ? "on" : ""} disabled={off} aria-label={st.name} aria-current={on ? "true" : undefined} onClick={() => goTo(st.id)} title={st.hint}>
                  <span className="zr-name">{st.name}</span>
                  <i aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ol>
        <button className="zr-step" onClick={() => (sfx("whoosh"), stepOut())} disabled={!canOut} aria-label="Step out: the bigger picture">
          <ZoomIcon dir="out" />
          <span>Step out</span>
        </button>
      </nav>
      {showHint && (
        <div className="zoom-hint glass" role="note">
          <b>This is your zoom.</b> Step in for more detail, step out for the bigger picture. Pinching works too, and so does scrolling from the outside of a bubble.
          <button className="link" onClick={dismissZoomHint}>
            Got it
          </button>
        </div>
      )}
    </>
  );
}

export function Stage() {
  const flat = useStore((s) => s.easy || s.simple);
  const phase = useStore((s) => s.phase);
  const tourDone = useStore((s) => s.tourDone);
  const level = useStore((s) => s.level);
  const focus = useStore((s) => s.focus);
  const overview = useStore((s) => s.overview);
  const home = useStore((s) => s.home);
  const month = useStore((s) => s.missions.month);
  if (flat) return <FlatStage />;
  if (home) return <CloudHome />;
  const b = useStore.getState().bubble(focus || "steps");
  if (!b) return null;
  return (
    <main className={`stage deep level-${level}`} data-month={month}>
      <SeqNav />
      {level >= 3 && <Outside b={b} key={`o-${b.id}`} />}
      {level === 2 && (b.id === "steps" ? <StepsInside /> : <Inside b={b} key={`i-${b.id}`} />)}
      {level === 1 && <Deeper b={b} key={`d-${b.id}`} />}
      <ZoomRail />
      {phase === "journey" && !tourDone && <Tour />}
      {b.id !== "steps" && level >= 3 && <MissionChip />}
      {overview && <Overview />}
    </main>
  );
}
