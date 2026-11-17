// "This month": the home of the monthly rhythm, apart from the plan itself. A returning visit
// can come straight here for its missions, the days left and the month-end meeting, without
// walking through the bubbles again.
// "Month-end meeting": the review as a short agenda. Nothing is decided in it except the next
// month's missions, and every mission still opens its decision card first.
import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { sfx, speak, stopSpeaking } from "../audio.js";
import { ScoreRing } from "../miniapps/index.jsx";
import { daysLeftText, monthInfo } from "../month.js";
import { useStore } from "../store.js";
import { MissionRow, Ring, useMissions } from "./Missions.jsx";
import { TalkItThrough } from "./LiveCheckin.jsx";
import { Picker, Podcast } from "./Month.jsx";

const AGENDA = [
  { id: "listen", title: "Listen to your month", minutes: 3 },
  { id: "checkin", title: "Check in", minutes: 4 },
  { id: "advisor", title: "For your advisor", minutes: 1 },
  { id: "next", title: "Next month's missions", minutes: 2 },
];

// The check-in, top half: this month's missions, to tick off. What is ticked here is what the
// check-in below knows; what is said below can tick a mission here.
function TickList() {
  const plan = useStore((s) => s.plan);
  const when = useStore((s) => s.missions.when);
  const { list, statuses } = useMissions();
  const proj = useStore(useShallow((s) => s.projected()));
  const done = statuses.filter((s) => s === "done").length;
  const toggle = (m, isDone) => {
    const st = useStore.getState();
    if (isDone) st.setMissionStatus(m.id, st.missions.when?.[m.id] ? "active" : "todo", { via: "tick", undone: true });
    else {
      st.setMissionStatus(m.id, "done", { via: "tick", quiet: true });
      sfx("ding");
    }
  };
  return (
    <div className="ticks">
      <div className="ticks-head">
        <Ring statuses={statuses} size={44} />
        <div>
          <b>
            {done} of {list.length} missions done
          </b>
          <span className="mute block small">
            Score {plan.score.value}
            {proj.score !== plan.score.value ? `, ${proj.score} projected once Sherpas confirms what you did` : ""}
          </span>
        </div>
      </div>
      <p className="ticks-hint">Tick what you did this month.</p>
      <ul className="tick-list">
        {list.map((m, i) => {
          const isDone = statuses[i] === "done";
          return (
            <li key={m.id}>
              <label className={`tick-row ${isDone ? "on" : ""}`}>
                <input type="checkbox" checked={isDone} onChange={() => toggle(m, isDone)} />
                <span className="tick-box" aria-hidden="true">
                  <svg viewBox="0 0 16 16">
                    <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="tick-body">
                  <b>{m.title}</b>
                  <span className="mute small">
                    {isDone ? "Done" : when?.[m.id] ? `Planned for ${when[m.id].toLowerCase()}` : `About ${m.minutes} min`}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function useMonthNotes() {
  const plan = useStore((s) => s.plan);
  const month = useStore((s) => s.missions.month);
  const asked = useStore((s) => s.asked);
  const notes = useStore((s) => s.notes);
  const questions = Object.entries(asked).flatMap(([bid, qs]) => qs.filter((q) => q.month === month).map((q) => ({ ...q, title: plan.bubbles.find((b) => b.id === bid)?.title })));
  const changes = (notes.intakeChanges || []).filter((n) => n.month === month);
  const worries = (notes.worries || []).filter((n) => n.month === month);
  return { questions, changes, worries };
}

function upcomingGoals(plan) {
  const year = new Date().getFullYear();
  return (plan.bubbles.find((b) => b.id === "retirement")?.miniapp.data.goals || [])
    .filter((g) => (g.endYear || g.year) >= year)
    .sort((a, b) => a.year - b.year)
    .slice(0, 3);
}

// ---- This month --------------------------------------------------------------------------------

export function MonthPage() {
  const plan = useStore((s) => s.plan);
  const person = useStore((s) => s.person);
  const history = useStore((s) => s.missions.history);
  const when = useStore((s) => s.missions.when);
  const { list, statuses, month } = useMissions();
  const proj = useStore(useShallow((s) => s.projected()));
  const { openDecision, openMeeting, setHumanOpen } = useStore.getState();
  const info = monthInfo();
  const done = statuses.filter((s) => s === "done").length;
  const next = list.find((m, i) => statuses[i] !== "done" && when?.[m.id]) || list.find((m, i) => statuses[i] !== "done");
  const { questions, changes, worries } = useMonthNotes();
  const goals = upcomingGoals(plan);
  const heading = useRef();
  useEffect(() => {
    heading.current?.focus();
    const parts = [`${daysLeftText(info.daysLeft)}.`, list.length ? `${done} of ${list.length} missions done.` : ""];
    if (next) parts.push(when?.[next.id] ? `Next up: ${next.title}, planned for ${when[next.id].toLowerCase()}.` : `Next up: ${next.title}.`);
    speak(`${person ? `Hi ${person}. ` : ""}${parts.join(" ")}`);
    return () => stopSpeaking();
  }, []);
  return (
    <main className="month-page" aria-labelledby="month-title">
      <div className="mp-col">
        <header className="mp-head">
          <h1 id="month-title" ref={heading} tabIndex={-1}>
            Month {month} <span className="mp-cal">· {info.name}</span>
          </h1>
          <p className="mp-lede">
            {daysLeftText(info.daysLeft)}, on {info.meetingDate}.
          </p>
        </header>

        <section className="mp-stats" aria-label="This month at a glance">
          <div className="mp-stat days">
            <span className="mp-big">{info.daysLeft}</span>
            <span className="mp-label">{info.daysLeft === 1 ? "day left" : "days left"} this month</span>
            <span className="mp-track" aria-hidden="true">
              <i style={{ width: `${Math.round(info.progress * 100)}%` }} />
            </span>
            <span className="mp-fine">
              Day {info.day} of {info.daysInMonth}
            </span>
          </div>
          <div className="mp-stat">
            <Ring statuses={statuses} size={64} />
            <span className="mp-label">
              <b>
                {done} of {list.length}
              </b>{" "}
              missions done
            </span>
          </div>
          <div className="mp-stat">
            <ScoreRing score={plan.score.value} projected={proj.score} size={84} />
            <span className="mp-label">
              {proj.score !== plan.score.value ? (
                <>
                  Score <b>{plan.score.value}</b>, <b>{proj.score}</b> projected
                </>
              ) : (
                <>
                  Score <b>{plan.score.value}</b> of 100
                </>
              )}
            </span>
          </div>
        </section>

        <section className="mp-section" aria-labelledby="mp-missions">
          <h2 id="mp-missions">Your missions</h2>
          {list.length ? (
            <div className="mission-list">
              {list.map((m, i) => (
                <MissionRow key={m.id} m={m} status={statuses[i]} onOpen={() => openDecision(m.id)} />
              ))}
            </div>
          ) : (
            <p className="mute">No missions this month yet. You choose them in the month-end meeting.</p>
          )}
          <p className="mp-fine">Missions you do not finish carry over. Your projected score becomes real when your next Sherpas update confirms what you did.</p>
        </section>

        <section className="mp-section mp-meeting" aria-labelledby="mp-meet">
          <div className="mp-meet-head">
            <div>
              <h2 id="mp-meet">Your month-end meeting</h2>
              <p className="mute">
                {info.meetingDate} · about 10 minutes, with your voice guide. {info.meetingDue ? "It is time." : "You can hold it early if you like."}
              </p>
            </div>
            <button className={`btn ${info.meetingDue ? "primary big" : ""}`} onClick={openMeeting}>
              {info.meetingDue ? "Start the meeting ›" : "Hold it now ›"}
            </button>
          </div>
          <ol className="mp-agenda">
            {AGENDA.map((a) => (
              <li key={a.id}>
                <span>{a.title}</span>
                <span className="mp-fine">{a.minutes} min</span>
              </li>
            ))}
          </ol>
        </section>

        {(questions.length > 0 || changes.length > 0 || worries.length > 0) && (
          <section className="mp-section" aria-labelledby="mp-notes">
            <h2 id="mp-notes">Noted this month</h2>
            <ul className="analysis">
              {questions.slice(-5).map((q, i) => (
                <li key={`q${i}`}>
                  <span className="mute">You asked about {q.title}:</span> {q.q}
                </li>
              ))}
              {changes.map((n, i) => (
                <li key={`c${i}`}>
                  <span className="mute">For your advisor's firm, update the intake:</span> {n.text}
                </li>
              ))}
              {worries.map((n, i) => (
                <li key={`w${i}`}>
                  <span className="mute">On your mind:</span> {n.text}
                </li>
              ))}
            </ul>
          </section>
        )}

        {goals.length > 0 && (
          <section className="mp-section" aria-labelledby="mp-goals">
            <h2 id="mp-goals">Coming up in your plan</h2>
            <ul className="mp-goals">
              {goals.map((g) => (
                <li key={g.name}>
                  <b>{g.year}</b> {g.name}
                </li>
              ))}
            </ul>
          </section>
        )}

        {history.length > 0 && (
          <section className="mp-section" aria-labelledby="mp-past">
            <h2 id="mp-past">Past months</h2>
            <ul className="mp-goals">
              {history
                .slice()
                .reverse()
                .map((h) => (
                  <li key={h.month}>
                    <b>Month {h.month}</b> {h.done.length} of {h.ids.length} missions done
                  </li>
                ))}
            </ul>
          </section>
        )}

        <p className="mp-fine center">
          Something feels off, or you would rather talk it through?{" "}
          <button className="link" onClick={() => setHumanOpen(true)}>
            Talk to a person
          </button>
        </p>
      </div>
    </main>
  );
}

// ---- Month-end meeting ----------------------------------------------------------------------------

export function Meeting() {
  const plan = useStore((s) => s.plan);
  const { list, statuses, month } = useMissions();
  const proj = useStore(useShallow((s) => s.projected()));
  const { openDecision, openMonthPage, setHumanOpen } = useStore.getState();
  const [step, setStep] = useState(0);
  const [seen, setSeen] = useState([0]);
  const info = monthInfo();
  const done = statuses.filter((s) => s === "done").length;
  const { questions, changes, worries } = useMonthNotes();
  const heading = useRef();
  const go = (k) => {
    stopSpeaking();
    setStep(k);
    setSeen((s) => (s.includes(k) ? s : [...s, k]));
  };
  useEffect(() => {
    heading.current?.focus();
  }, [step]);
  useEffect(() => () => stopSpeaking(), []);
  const a = AGENDA[step];
  return (
    <main className="meeting" aria-labelledby="meeting-title">
      <div className="mt-col">
        <header className="mt-head">
          <button className="btn" onClick={openMonthPage}>
            ‹ This month
          </button>
          <div>
            <h1 id="meeting-title">Month {month} meeting</h1>
            <p className="mute">
              {info.meetingDate} · about 10 minutes
            </p>
          </div>
        </header>
        <div className="mt-body">
          <nav className="mt-agenda" aria-label="Agenda">
            <ol>
              {AGENDA.map((x, k) => (
                <li key={x.id}>
                  <button className={`${k === step ? "on" : ""} ${seen.includes(k) && k !== step ? "seen" : ""}`} aria-current={k === step ? "step" : undefined} onClick={() => go(k)}>
                    <span className="mt-num" aria-hidden="true">
                      {seen.includes(k) && k !== step ? "✓" : k + 1}
                    </span>
                    <span>
                      {x.title}
                      <span className="mp-fine block">{x.minutes} min</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>
          <section className="mt-content" aria-labelledby="mt-step">
            <h2 id="mt-step" ref={heading} tabIndex={-1}>
              {a.title}
            </h2>
            {a.id === "listen" && <Podcast onDone={() => go(1)} />}
            {a.id === "checkin" && (
              <>
                <TickList />
                <h3 className="ticks-talk">Then talk it through</h3>
                <TalkItThrough onDone={() => go(2)} />
              </>
            )}
            {a.id === "advisor" && (
              <div className="review">
                {questions.length > 0 && (
                  <>
                    <h3>What you asked this month</h3>
                    <ul className="analysis">
                      {questions.slice(-5).map((q, i) => (
                        <li key={`q${i}`}>
                          <span className="mute">{q.title}:</span> {q.q}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {changes.length || worries.length ? (
                  <ul className="analysis">
                    {changes.map((n, i) => (
                      <li key={`c${i}`}>
                        <span className="mute">Update the intake:</span> {n.text}
                      </li>
                    ))}
                    {worries.map((n, i) => (
                      <li key={`w${i}`}>
                        <span className="mute">On your mind:</span> {n.text}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mute">Nothing to pass on this month. Anything you tell the check-in about changes in your life shows up here, ready for your advisor's firm.</p>
                )}
                <p>If something in your plan no longer fits your life, a person can look at it with you. Nothing changes until you decide.</p>
                <div>
                  <button className="btn" onClick={() => setHumanOpen(true)}>
                    Talk to a person
                  </button>
                </div>
              </div>
            )}
            {a.id === "next" && <Picker />}
          </section>
        </div>
        <footer className="mt-foot">
          {step > 0 ? (
            <button className="btn" onClick={() => go(step - 1)}>
              ‹ {AGENDA[step - 1].title}
            </button>
          ) : (
            <span />
          )}
          {step < AGENDA.length - 1 && (
            <button className="btn primary" onClick={() => go(step + 1)}>
              {AGENDA[step + 1].title} ›
            </button>
          )}
        </footer>
      </div>
    </main>
  );
}
