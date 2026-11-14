// The moments that turn understanding into action:
//   ActionMoment  at the end of each bubble: what the first step changes, and the step itself
//   Celebration   when a step is done: the score climbs, the month ring fills
// Honest by design: only the plan's own figures, no countdowns, no guilt.
import { useEffect, useMemo, useRef, useState } from "react";
import { sfx, speak, stopSpeaking } from "../audio.js";
import { ScoreRing } from "../miniapps/index.jsx";
import { fresh, heard } from "../repeat.js";
import { hopeFor } from "../hope.js";
import { useStore } from "../store.js";
import { Ring, useMissions } from "./Missions.jsx";

function stepFor(b, s) {
  const pool = s.plan.missionPool;
  const st = (id) => s.missions.status[id] || "todo";
  const active = s.missions.active.map((id) => pool.find((m) => m.id === id)).find((m) => m?.bubbleId === b.id);
  if (active) return { m: active, status: st(active.id), inPlan: true };
  const move = pool.find((m) => m.moveId && m.bubbleId === b.id && st(m.id) !== "done");
  if (move) return { m: move, status: st(move.id), inPlan: false };
  const understand = pool.find((m) => m.id === `u-${b.id}`);
  if (understand) return { m: understand, status: st(understand.id), inPlan: false };
  return null;
}

export function ActionMoment({ b, ready }) {
  // Read stable slices of state, then work out the step (a selector that builds a new
  // object on every read would make React re-render forever).
  const plan = useStore((s) => s.plan);
  const missions = useStore((s) => s.missions);
  const step = useMemo(() => stepFor(b, { plan, missions }), [b, plan, missions]);
  const when = step ? missions.when?.[step.m.id] : null;
  const move = step?.m.moveId ? plan.moves.find((x) => x.id === step.m.moveId) : null;
  const { openDecision, addMission } = useStore.getState();
  const spoke = useRef(false);
  const hope = hopeFor(b, plan) || "Understanding this is the first step to deciding what to do about it.";
  useEffect(() => {
    if (!ready || spoke.current) return;
    spoke.current = true;
    const line = fresh(b.id, hope).parts.join(" ");
    if (line) {
      heard(b.id, line);
      speak(line);
    }
  }, [ready]);
  if (!ready || !step) return null;
  const done = step.status === "done";
  const label = done
    ? step.m.type === "understand"
      ? "You've got this one"
      : "Done this month"
    : step.status === "active"
      ? when
        ? `Your step, planned for ${when.toLowerCase()}`
        : "Open your step"
      : step.m.type === "understand"
        ? `Check you've got it · ${step.m.minutes} min`
        : `Take the first step · about ${step.m.minutes} min`;
  return (
    <div className={`act ${done ? "done" : ""}`}>
      <p className="act-hope" data-ask>
        {hope}
      </p>
      <button
        className={`btn ${done ? "" : "primary big"} act-btn`}
        disabled={done}
        onClick={() => {
          sfx("pop");
          if (!step.inPlan && step.m.type !== "understand") addMission(step.m.id);
          openDecision(step.m.id);
        }}
      >
        {done ? `✓ ${label}` : `${label} ›`}
      </button>
    </div>
  );
}

function CountUp({ from, to, ms = 1400 }) {
  const [v, setV] = useState(from);
  useEffect(() => {
    let raf;
    const t0 = performance.now() + 500;
    const tick = (t) => {
      const k = Math.min(1, Math.max(0, (t - t0) / ms));
      const e = 1 - Math.pow(1 - k, 3);
      setV(Math.round(from + (to - from) * e));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [from, to]);
  return v;
}

export function Celebration() {
  const c = useStore((s) => s.celebrate);
  const plan = useStore((s) => s.plan);
  const { statuses, list } = useMissions();
  const close = () => {
    stopSpeaking();
    useStore.getState().setCelebrate(null);
  };
  const bubble = c ? plan?.bubbles.find((b) => b.id === c.bubbleId) : null;
  const climbs = c && c.to > c.from;
  const done = statuses.filter((s) => s === "done").length;
  const headline = c?.kind === "understand" ? "Now you know." : "One step done.";
  const line = !c
    ? ""
    : c.kind === "understand"
      ? `You understand ${bubble?.title?.toLowerCase() || "this part of your plan"} now.`
      : climbs
        ? `Your projected score goes from ${c.from} to ${c.to}.`
        : "It counts together with your other steps in your Sherpas score.";
  const dots = useMemo(() => Array.from({ length: 22 }, (_, i) => ({ left: (i * 37) % 100, size: 10 + ((i * 13) % 34), delay: (i % 9) * 0.18, dur: 3.2 + ((i * 7) % 10) * 0.25 })), []);
  useEffect(() => {
    if (!c) return;
    sfx("ding");
    const t = setTimeout(() => speak(`${headline} ${line}`), 350);
    return () => clearTimeout(t);
  }, [c]);
  if (!c) return null;
  return (
    <div className="celebrate" role="dialog" aria-label={headline} onClick={close}>
      <div className="cel-bubbles" aria-hidden="true">
        {dots.map((d, i) => (
          <i key={i} style={{ left: `${d.left}%`, width: d.size, height: d.size, animationDelay: `${d.delay}s`, animationDuration: `${d.dur}s` }} />
        ))}
      </div>
      <div className="cel-col" onClick={(e) => e.stopPropagation()}>
        {climbs ? (
          <div className="cel-ring">
            <ScoreRing score={c.from} projected={c.to} size={190} />
            <span className="cel-count">
              <CountUp from={c.from} to={c.to} />
            </span>
          </div>
        ) : (
          <div className="cel-ring small">
            <Ring statuses={statuses} size={120} />
          </div>
        )}
        <h2 className="cel-title">{headline}</h2>
        <p className="cel-what">{c.title}</p>
        <p className="cel-line">{line}</p>
        <div className="cel-month">
          <Ring statuses={statuses} size={34} />
          <span>
            {done} of {list.length} steps done this month
          </span>
        </div>
        {plan?.texts?.anchor && <p className="cel-anchor">{plan.texts.anchor}</p>}
        {climbs && <p className="fine">It becomes your real score when your next Sherpas update confirms it.</p>}
        <button className="btn primary big" onClick={close}>
          Keep going
        </button>
      </div>
    </div>
  );
}
