// Monthly missions: three at a time, taken from the plan's own moves. Game-like feedback
// (a ring that closes, a projected score), but nothing is hidden or locked behind it, there
// are no rankings or daily streaks, and no mission starts without its decision card.
import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { usd } from "../format.js";
import { ScoreRing } from "../miniapps/index.jsx";
import { useStore } from "../store.js";
import { MustKnow } from "./Panels.jsx";

const TYPE = { quick: "Quick", important: "Important", understand: "Understand" };

export function Ring({ statuses, size = 44 }) {
  const n = Math.max(1, statuses.length);
  const r = 17;
  const c = 2 * Math.PI * r;
  const gap = 5;
  const seg = c / n - gap;
  return (
    <svg viewBox="0 0 44 44" width={size} height={size} role="img" aria-label={`${statuses.filter((s) => s === "done").length} of ${n} missions done`}>
      {statuses.map((st, i) => (
        <circle
          key={i}
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke={st === "done" ? "#34C759" : st === "active" || st === "in_progress" ? "#0071E3" : "#E5E5EA"}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${seg} ${c - seg}`}
          strokeDashoffset={-(i * (c / n)) - gap / 2}
          transform="rotate(-90 22 22)"
          style={{ transition: "stroke .5s" }}
        />
      ))}
    </svg>
  );
}

export function useMissions() {
  const active = useStore((s) => s.missions.active);
  const status = useStore((s) => s.missions.status);
  const month = useStore((s) => s.missions.month);
  const pool = useStore((s) => s.plan.missionPool);
  return useMemo(() => {
    const list = active.map((id) => pool.find((m) => m.id === id)).filter(Boolean);
    return { list, statuses: list.map((m) => status[m.id] || "todo"), month };
  }, [active, status, month, pool]);
}

export function MissionChip() {
  const { list, statuses, month } = useMissions();
  const score = useStore((s) => s.plan.score.value);
  const proj = useStore((s) => s.projected().score);
  const open = useStore((s) => s.setMissionsOpen);
  const journeyDone = useStore((s) => s.journeyDone);
  if (!journeyDone || !list.length) return null;
  const done = statuses.filter((s) => s === "done").length;
  return (
    <button className="glass mission-chip" onClick={() => open(true)}>
      <Ring statuses={statuses} />
      <span>
        <b>Month {month} missions</b>
        <span className="mute block">
          {done} of {list.length} done · score {score}
          {proj !== score ? ` → ${proj} projected` : ""}
        </span>
      </span>
    </button>
  );
}

export function MissionRow({ m, status, onOpen }) {
  return (
    <button className={`mission ${status}`} onClick={onOpen}>
      <span className={`m-check ${status}`}>{status === "done" ? "✓" : ""}</span>
      <span className="m-body">
        <span className="m-type">
          {TYPE[m.type]} · about {m.minutes} min
        </span>
        <b>{m.title}</b>
        {m.score_after != null && (
          <span className="mute block">
            {m.score_after !== m.score_before ? `Score ${m.score_before} → ${m.score_after}, according to your plan` : "Scored together with your other steps"}
          </span>
        )}
      </span>
      <span className="m-go">{status === "done" ? "Done" : status === "active" || status === "in_progress" ? "In progress" : "Open"}</span>
    </button>
  );
}

export function MissionsPanel() {
  const openState = useStore((s) => s.missionsOpen);
  const { list, statuses, month } = useMissions();
  const score = useStore((s) => s.plan.score.value);
  const proj = useStore(useShallow((s) => s.projected()));
  const { setMissionsOpen, openDecision, setPhase } = useStore.getState();
  if (!openState) return null;
  const done = statuses.filter((s) => s === "done").length;
  return (
    <div className="sheet-wrap" onClick={() => setMissionsOpen(false)}>
      <aside className="glass sheet missions" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="This month's missions">
        <header className="sheet-head">
          <div>
            <div className="eyebrow">Month {month}</div>
            <h2>Your three missions</h2>
          </div>
          <button className="icon-btn" onClick={() => setMissionsOpen(false)} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="missions-top">
          <ScoreRing score={score} projected={proj.score} size={112} />
          <div>
            <p>
              <b>
                {done} of {list.length}
              </b>{" "}
              done this month.
            </p>
            <p className="mute small">
              Published score: {score}.{proj.score !== score ? ` Projected: ${proj.score}. It becomes real when your next Sherpas update confirms it.` : " Complete a mission to see the projected score."}
            </p>
            {proj.basis === "best-single" && <p className="mute small">Sherpas has not published a combined score for these steps, so the projection shows the best single one.</p>}
          </div>
        </div>
        <div className="mission-list">
          {list.map((m, i) => (
            <MissionRow key={m.id} m={m} status={statuses[i]} onOpen={() => openDecision(m.id)} />
          ))}
        </div>
        <p className="fine">Each one comes from your plan. Nothing happens until you confirm it on its decision card. Missions you do not finish carry over, with no penalty.</p>
        <button
          className="btn"
          onClick={() => {
            setMissionsOpen(false);
            useStore.getState().openMonth();
          }}
        >
          Go to the month-end review
        </button>
      </aside>
    </div>
  );
}

export function Quiz({ quiz, onPass, context }) {
  const [pick, setPick] = useState(null);
  const log = useStore((s) => s.log);
  const right = pick === quiz.correct;
  return (
    <div className="quiz">
      <div className="quiz-q">
        <span className="eyebrow">Quick check</span>
        {quiz.q}
      </div>
      <div className="quiz-options">
        {quiz.options.map((o, i) => (
          <button
            key={i}
            className={`quiz-opt ${pick === i ? (i === quiz.correct ? "right" : "wrong") : ""}`}
            onClick={() => {
              setPick(i);
              log({ type: "quiz_answer", context, correct: i === quiz.correct });
              if (i === quiz.correct) onPass?.();
            }}
          >
            {o}
          </button>
        ))}
      </div>
      {pick != null && (
        <p className={`quiz-fb ${right ? "ok" : ""}`}>
          {right ? "That is it. " : "Not quite, and that is fine. Here it is again, more simply: "}
          {quiz.explain}
        </p>
      )}
    </div>
  );
}

export function DecisionCard() {
  const id = useStore((s) => s.decision);
  const m = useStore((s) => (s.decision ? s.plan.missionPool.find((x) => x.id === s.decision) : null));
  const status = useStore((s) => (s.decision ? s.missions.status[s.decision] || "todo" : "todo"));
  const bubble = useStore((s) => (m ? s.plan.bubbles.find((b) => b.id === m.bubbleId) : null));
  const move = useStore((s) => (m?.moveId ? s.plan.moves.find((x) => x.id === m.moveId) : null));
  const [passed, setPassed] = useState(false);
  const { closeDecision, setMissionStatus, enter, setHumanOpen, markUnderstood, setMissionsOpen } = useStore.getState();
  if (!id || !m) return null;
  const close = () => {
    setPassed(false);
    closeDecision();
  };
  const understood = passed || status !== "todo";
  return (
    <div className="modal-wrap" onClick={close}>
      <div className="glass modal decision" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Decision card">
        <header className="sheet-head">
          <div>
            <div className="eyebrow">
              {TYPE[m.type]} mission · about {m.minutes} min
            </div>
            <h2>{m.title}</h2>
          </div>
          <button className="icon-btn" onClick={close} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="modal-body" data-ask>
          {move ? (
            <dl className="decision-grid">
              <dt>What you would do</dt>
              <dd>{move.action}.</dd>
              <dt>Why</dt>
              <dd>{m.why}</dd>
              <dt>What changes</dt>
              <dd>
                {move.score_after !== move.score_before
                  ? `Your Sherpas score would move from ${move.score_before} to ${move.score_after}.`
                  : `On its own, your score stays at ${move.score_before}. It counts together with your other steps.`}
                {move.lifts_a_cap ? " It also lifts a cap that is holding your score down." : ""}
              </dd>
              <dt>What it costs, what you risk</dt>
              <dd>The cost is not in your plan, so it is not shown here. Get the real figure before you commit.</dd>
              <dt>Your other options</dt>
              <dd>Leave it for now, or talk it through with a person first.</dd>
            </dl>
          ) : (
            <p>{m.why}</p>
          )}
          <h3>How</h3>
          <ol className="steps">
            {m.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          {bubble && <MustKnow items={bubble.mustKnow} />}
          {status !== "done" && <Quiz quiz={m.quiz} context={m.id} onPass={() => setPassed(true)} />}
          {status === "done" && <p className="quiz-fb ok">Marked as done. Your projected score updates right away. It becomes your real score when your next Sherpas update confirms it.</p>}
        </div>
        <footer className="modal-foot">
          <button
            className="btn"
            onClick={() => {
              close();
              setMissionsOpen(false);
              enter(m.bubbleId);
            }}
          >
            Open the bubble
          </button>
          <button
            className="btn"
            onClick={() => {
              close();
              setHumanOpen(true);
            }}
          >
            Talk to a person
          </button>
          <span className="grow" />
          {m.type === "understand" ? (
            status !== "done" && (
              <button
                className="btn primary"
                disabled={!passed}
                onClick={() => {
                  markUnderstood(m.bubbleId);
                  setMissionStatus(m.id, "done", { via: "quiz" });
                }}
              >
                {passed ? "Mark as understood" : "Answer the check first"}
              </button>
            )
          ) : status === "todo" ? (
            <button className="btn primary" disabled={!understood} onClick={() => setMissionStatus(m.id, "active", { decision_confirmed: true })}>
              {understood ? "I will do this" : "Answer the check first"}
            </button>
          ) : status !== "done" ? (
            <button className="btn primary" onClick={() => setMissionStatus(m.id, "done", { self_reported: true })}>
              Mark as done
            </button>
          ) : (
            <button className="btn" onClick={() => setMissionStatus(m.id, "active", { undone: true })}>
              Not done after all
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

export { usd };
