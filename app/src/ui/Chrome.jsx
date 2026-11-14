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
  const { setLevel, back, setEasy, setMuted, setPerson, setProfile, setPhase, leave, reset, setDay, showToast, startJourney } = useStore.getState();
  const [menu, setMenu] = useState(false);
  const b = focus ? useStore.getState().bubble(focus) : null;
  const inStage = phase === "cloud" || phase === "journey";
  const canBack = inStage && level < 3;
  const quick = useStore((s) => s.activeMissions().find((m) => s.missions.status[m.id] !== "done"));

  const day3 = () => {
    setMenu(false);
    if (!quick) return showToast({ text: "All of this month's missions are done. Nothing to nudge." });
    setDay(3);
    const text = `Hi ${person}. One small thing from your plan: ${quick.title}. It takes about ${quick.minutes} minutes. Want to look at it now?`;
    showToast({ text, voice: true, mission: quick.id, title: "Day 3 · a short voice note" });
    speak(text);
  };

  return (
    <header className="topbar">
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
        {inStage && (
          <nav className="crumbs" aria-label="Where you are">
            {canBack && (
              <button className="btn back" onClick={back}>
                ‹ Back
              </button>
            )}
            <button className="crumb" onClick={() => setLevel(3)}>
              {plan.label}'s money
            </button>
            {level <= 2 && b && (
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
                <span className="crumb here">{useStore.getState().flat() ? "The figures" : "In more detail"}</span>
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
          {muted ? "🔇" : "🔊"}
        </button>
        <button className="icon-btn" onClick={() => setMenu(!menu)} aria-label="Menu" aria-expanded={menu}>
          ⋯
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
            {journeyDone && (
              <>
                <div className="menu-title">Jump ahead in time (demo)</div>
                <button role="menuitem" onClick={day3}>
                  Day 3: play the voice note
                </button>
                <button role="menuitem" onClick={() => { setMenu(false); useStore.getState().openMonth(); }}>
                  Month end: review, podcast, check-in
                </button>
              </>
            )}
            <div className="menu-title">Plan</div>
            <button role="menuitem" onClick={() => { setMenu(false); startJourney(); }}>
              Replay the walk-through
            </button>
            <button role="menuitem" onClick={() => { setMenu(false); go("/"); leave(); }}>
              Switch household
            </button>
            <button role="menuitem" onClick={() => { setMenu(false); go("/"); reset(); }}>
              Forget my progress for this household
            </button>
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
