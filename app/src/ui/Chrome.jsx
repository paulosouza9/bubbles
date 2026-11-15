// The frame around everything: top bar with the "where am I" path, the menu, the toast and
// the "talk to a person" dialog.
import { useEffect, useState } from "react";
import { speak } from "../audio.js";
import { LEVEL_HINT } from "../format.js";
import { PROFILES, useStore } from "../store.js";
import { go } from "./Start.jsx";

export function TopBar() {
  const plan = useStore((s) => s.plan);
  const level = useStore((s) => s.level);
  const focus = useStore((s) => s.focus);
  const phase = useStore((s) => s.phase);
  const easy = useStore((s) => s.easy);
  const muted = useStore((s) => s.muted);
  const person = useStore((s) => s.person);
  const kind = useStore((s) => s.profile().kind);
  const journeyDone = useStore((s) => s.journeyDone);
  const home = useStore((s) => s.home);
  const motion = useStore((s) => s.motion);
  const { goHome, openMonthPage, openMeeting } = useStore.getState();
  const inMonth = phase === "month" || phase === "meeting";
  const { setLevel, back, setEasy, setMuted, setPerson, setProfile, setPhase, leave, reset, setDay, showToast, startJourney } = useStore.getState();
  const [menu, setMenu] = useState(false);
  const [sure, setSure] = useState(false);
  const toggleMenu = (open) => {
    setMenu(open);
    setSure(false);
  };
  // The "jump ahead in time" shortcuts are for presenting the demo: open the app with ?demo.
  const demo = typeof location !== "undefined" && new URLSearchParams(location.search).has("demo");
  const b = focus ? useStore.getState().bubble(focus) : null;
  const inStage = phase === "cloud" || phase === "journey";
  const canBack = inStage && level < 3 && !home;
  const trailTop = useStore((s) => s.trail.at(-1));
  const seqPrev = useStore((s) => {
    const q = s.plan && !s.flat() ? s.seq() : [];
    return q[q.indexOf(s.focus) - 1];
  });
  const backTo = inStage && level === 3 && !home && trailTop && trailTop !== seqPrev && trailTop !== focus ? useStore.getState().bubble(trailTop) : null;
  // The nudge is about the step the person committed to, if there is one.
  const quick = useStore((s) => s.currentMission());

  const day3 = () => {
    setMenu(false);
    if (!quick) return showToast({ text: "All of this month's missions are done. Nothing to nudge." });
    setDay(3);
    const planned = useStore.getState().missions.when?.[quick.id];
    const text = `Hi ${person}. ${planned ? `You planned this for ${planned.toLowerCase()}` : "One small thing from your plan"}: ${quick.title}. It takes about ${quick.minutes} minutes. Want to look at it now?`;
    showToast({ text, voice: true, mission: quick.id, title: "Day 3 · a short voice note" });
    speak(text);
  };

  return (
    <header className={`topbar ${journeyDone ? "with-sections" : ""}`}>
      <div className="top-left">
        <button
          className="brand"
          onClick={() => {
            go("/");
            leave();
          }}
          title="Back to the start"
        >
          Burbuja
        </button>
        {inMonth && (
          <nav className="crumbs" aria-label="Where you are">
            <button className="crumb" onClick={openMonthPage}>
              This month
            </button>
            {phase === "meeting" && (
              <>
                <span className="sep">›</span>
                <span className="crumb here">Month-end meeting</span>
              </>
            )}
          </nav>
        )}
        {inStage && (
          <nav className="crumbs" aria-label="Where you are">
            {canBack && (
              <button className="btn back" onClick={back}>
                ‹ Back
              </button>
            )}
            {backTo && (
              <button className="btn back" onClick={() => useStore.getState().backToLast()}>
                ‹ Back to {backTo.title}
              </button>
            )}
            <button className="crumb" onClick={() => (journeyDone ? goHome() : setLevel(3))}>
              {plan.label}'s money
            </button>
            {!home && journeyDone && level === 3 && b && phase === "cloud" && !useStore.getState().flat() && (
              <>
                <span className="sep">›</span>
                <span className="crumb here">{b.title}</span>
              </>
            )}
            {!home && level <= 2 && b && (
              <>
                <span className="sep">›</span>
                <button className="crumb" onClick={() => setLevel(2)}>
                  {b.title}
                </button>
              </>
            )}
            {level === 1 && (
              <>
                <span className="sep">›</span>
                <span className="crumb here">In detail</span>
              </>
            )}
            {level === 4 && (
              <>
                <span className="sep">›</span>
                <span className="crumb here">{LEVEL_HINT[4]}</span>
              </>
            )}
          </nav>
        )}
      </div>
      <div className="top-right">
        {journeyDone && (inStage || inMonth) && (
          <nav className="seg top-sections" aria-label="Sections">
            <button className={!inMonth ? "on" : ""} aria-current={!inMonth ? "page" : undefined} onClick={goHome}>
              Your plan
            </button>
            <button className={inMonth ? "on" : ""} aria-current={inMonth ? "page" : undefined} onClick={openMonthPage}>
              This month
            </button>
          </nav>
        )}
        {plan.names.length > 1 && (
          <div className="seg small" role="tablist" aria-label="Who is here">
            {plan.names.map((n) => (
              <button key={n} role="tab" aria-selected={person === n} className={person === n ? "on" : ""} onClick={() => setPerson(n)}>
                {n}
              </button>
            ))}
          </div>
        )}
        <button className={`btn toggle ${easy ? "on" : ""}`} onClick={() => setEasy(!easy)} aria-pressed={easy} title="Larger text, simpler steps, no gestures">
          Easy mode
        </button>
        <button className="icon-btn" onClick={() => setMuted(!muted)} aria-label={muted ? "Turn the voice on" : "Turn the voice off"} title={muted ? "Voice is off" : "Voice is on"}>
          {/* Drawn icons, not emoji: the same line style as the rest of the app. */}
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M4 10v4h4l5 4V6L8 10H4z" fill="currentColor" />
            {muted ? (
              <path d="M16.5 9.5l5 5M21.5 9.5l-5 5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
            ) : (
              <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
            )}
          </svg>
        </button>
        <button className="icon-btn" onClick={() => toggleMenu(!menu)} aria-label="Menu" aria-expanded={menu}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></svg>
        </button>
        {menu && (
          <div className="glass menu" role="menu">
            <div className="menu-title">Explain it to me like…</div>
            {Object.entries(PROFILES).map(([k, p]) => (
              <button key={k} role="menuitemradio" aria-checked={kind === k} className={kind === k ? "on" : ""} onClick={() => { setProfile(k); setMenu(false); }}>
                <b>{p.label}</b>
                <span className="mute block">{p.blurb}</span>
              </button>
            ))}
            {journeyDone && demo && (
              <>
                <div className="menu-title">Jump ahead in time (demo)</div>
                <button role="menuitem" onClick={day3}>
                  Day 3: play the voice note
                </button>
                <button role="menuitem" onClick={() => { setMenu(false); openMeeting(); }}>
                  Month end: the meeting
                </button>
              </>
            )}
            <div className="menu-title">Animations</div>
            {[
              ["full", "Full", "Bubbles, particles and smooth zooms."],
              ["calm", "Calm", "Short fades, nothing flying around."],
              ["auto", "Follow my device", "Uses your system's motion setting."],
            ].map(([k, label, blurb]) => (
              <button key={k} role="menuitemradio" aria-checked={motion === k} className={motion === k ? "on" : ""} onClick={() => useStore.getState().setMotion(k)}>
                <b>{label}</b>
                <span className="mute block">{blurb}</span>
              </button>
            ))}
            <div className="menu-title">Plan</div>
            <button role="menuitem" onClick={() => { setMenu(false); startJourney(); }}>
              Replay the walk-through
            </button>
            <button role="menuitem" onClick={() => { setMenu(false); go("/"); leave(); }}>
              Switch household
            </button>
            {sure ? (
              <button role="menuitem" className="danger" autoFocus onClick={() => { toggleMenu(false); go("/"); reset(); }}>
                Yes, forget it all: missions, notes and answers
              </button>
            ) : (
              <button role="menuitem" className="danger-soft" onClick={() => setSure(true)}>
                Forget my progress for this household…
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

export function Toast() {
  const toast = useStore((s) => s.toast);
  const { showToast, openDecision } = useStore.getState();
  useEffect(() => {
    if (!toast || toast.mission) return;
    const t = setTimeout(() => showToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);
  if (!toast) return null;
  return (
    <div className="glass toast" role="status">
      {toast.title && <div className="eyebrow">{toast.title}</div>}
      <p>{toast.text}</p>
      <div className="options">
        {toast.voice && (
          <button className="btn small" onClick={() => speak(toast.text)}>
            Play again
          </button>
        )}
        {toast.mission && (
          <button
            className="btn small primary"
            onClick={() => {
              openDecision(toast.mission);
              showToast(null);
            }}
          >
            Open it
          </button>
        )}
        <button className="btn small" onClick={() => showToast(null)}>
          {toast.mission ? "Later" : "Close"}
        </button>
      </div>
    </div>
  );
}

export function HumanModal() {
  const open = useStore((s) => s.humanOpen);
  const focusTitle = useStore((s) => s.plan.bubbles.find((b) => b.id === s.focus)?.title);
  const { setHumanOpen, log } = useStore.getState();
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  if (!open) return null;
  const close = () => {
    setHumanOpen(false);
    setSent(false);
    setNote("");
  };
  return (
    <div className="modal-wrap" onClick={close}>
      <div className="glass modal human" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Talk to a person">
        <header className="sheet-head">
          <div>
            <div className="eyebrow">Talk to a person</div>
            <h2>Some decisions deserve a human.</h2>
          </div>
          <button className="icon-btn" onClick={close} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="modal-body">
          {sent ? (
            <p>
              Your request is saved{focusTitle ? `, with a note that you were looking at “${focusTitle}”` : ""}. In this demo it is written to the app's audit log. With a real firm, it goes to your advisor's team.
            </p>
          ) : (
            <>
              <p>This app explains your plan. It does not replace a person for big or hard-to-undo decisions, like buying insurance, changing retirement accounts or moving large sums.</p>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What would you like to talk about? (optional)" rows={3} />
            </>
          )}
        </div>
        <footer className="modal-foot">
          <span className="grow" />
          {sent ? (
            <button className="btn primary" onClick={close}>
              Done
            </button>
          ) : (
            <button
              className="btn primary"
              onClick={() => {
                log({ type: "human_request", about: focusTitle || null, note });
                useStore.getState().addNote("humanFlags", note || focusTitle || "Asked to talk to a person");
                setSent(true);
              }}
            >
              Ask for a call
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
