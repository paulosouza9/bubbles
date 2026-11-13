// Getting in: the landing page (two entries), the bubbles forming, and the short calibration
// that sets the starting level and teaches the zoom once.
import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { speak, stopSpeaking } from "../audio.js";
import { PROFILES, useStore } from "../store.js";

export function go(path) {
  if (location.pathname !== path) history.pushState({}, "", path);
}

export function Landing() {
  const families = useStore((s) => s.families);
  const status = useStore((s) => s.status);
  const loadError = useStore((s) => s.loadError);
  const openFamily = useStore((s) => s.openFamily);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState("");
  const [miss, setMiss] = useState(false);
  const input = useRef();

  const open = async (id, via) => {
    setBusy(via === "documents" ? "Building your bubbles…" : "Opening your plan…");
    try {
      go(`/f/${id}`);
      await openFamily(id, via);
    } catch (e) {
      setBusy("");
      setMiss(true);
    }
  };
  const onFiles = async (files) => {
    if (!files?.length) return;
    setMiss(false);
    setBusy("Reading your documents…");
    for (const f of [...files].slice(0, 6)) {
      try {
        const r = await api.identify(f);
        if (r.family) return open(r.family, "documents");
      } catch {
        /* try the next file */
      }
    }
    setBusy("");
    setMiss(true);
  };

  return (
    <main className="landing">
      <header className="brand-row">
        <span className="brand">Burbuja</span>
        <span className="mute small">A new way to understand your Sherpas plan</span>
      </header>
      <section className="hero">
        <h1>Your plan, explained at your level.</h1>
        <p className="lede">A voice walks you through it, one bubble at a time. Step inside any bubble for more detail, or step back out for the simple version.</p>
      </section>
      <section className="entries">
        <div
          className={`glass drop ${drag ? "over" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            onFiles(e.dataTransfer.files);
          }}
        >
          <div className="eyebrow">Start with your documents</div>
          <h2>Drop your statements or your plan report here</h2>
          <p className="mute">We match them to the plan Sherpas has prepared for you. Your figures come from that plan, never from a guess.</p>
          <button className="btn primary" onClick={() => input.current.click()} disabled={Boolean(busy)}>
            Choose files
          </button>
          <input ref={input} type="file" multiple hidden accept=".pdf,.json,.md,.txt,.csv" onChange={(e) => onFiles(e.target.files)} />
          {busy && <div className="busy">{busy}</div>}
          {miss && <div className="warn">We could not match those documents to a plan. Pick your household on the right.</div>}
        </div>
        <div className="glass intake">
          <div className="eyebrow">Sherpas already has your details?</div>
          <h2>Open your plan directly</h2>
          <p className="mute">If your advisor's firm already completed your intake, there is nothing to upload.</p>
          {loadError && <div className="warn">Could not reach the server: {loadError}</div>}
          {!families.length && !loadError && <div className="busy">Loading households…</div>}
          <ul className="family-list">
            {families.map((f) => (
              <li key={f.id}>
                <button onClick={() => open(f.id, "intake")} disabled={Boolean(busy)}>
                  <span>
                    <b>
                      {f.label} {f.lastName}
                    </b>
                    <span className="mute block">{f.city}</span>
                  </span>
                  <span className="arrow">Open</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <footer className="landing-foot mute small">
        {status && (
          <>
            Plan data: {status.data?.source === "mcp" ? "live from the Sherpas MCP" : "the cases folder in this repo"} · Voice: {status.voice?.tts === "elevenlabs" ? "ElevenLabs" : "your browser's voice (ElevenLabs is not answering right now)"}
          </>
        )}
        <span className="block">These are fictional households built for the Sherpas hackathon. This app explains an existing plan. It does not give new financial advice.</span>
      </footer>
    </main>
  );
}

export function Forming() {
  const plan = useStore((s) => s.plan);
  const via = useStore((s) => s.via);
  const setPhase = useStore((s) => s.setPhase);
  const [step, setStep] = useState(0);
  useEffect(() => {
    let alive = true;
    const t0 = performance.now();
    const t1 = setTimeout(() => alive && setStep(1), 1500);
    const finish = () => {
      const wait = Math.max(0, 3600 - (performance.now() - t0));
      setTimeout(() => alive && setPhase("calibrate"), wait);
    };
    const t2 = setTimeout(
      () =>
        speak(plan.texts.greeting, {
          onEnd: () => {
            if (!alive) return;
            setStep(2);
            speak(plan.texts.strength, { onEnd: () => alive && finish() });
          },
        }),
      1500,
    );
    return () => {
      alive = false;
      clearTimeout(t1);
      clearTimeout(t2);
      stopSpeaking();
    };
  }, [plan]);
  return (
    <div className="forming">
      {step === 0 && <p className="forming-small">{via === "documents" ? "Turning your documents into bubbles…" : "Sherpas already has your plan. Opening it…"}</p>}
      {step === 1 && <p className="forming-big">{plan.texts.greeting}</p>}
      {step === 2 && (
        <p className="forming-big">
          <span className="mute block small">First, the good part.</span>
          {plan.texts.strength}
        </p>
      )}
      <button className="link skip" onClick={() => setPhase("calibrate")}>
        Skip
      </button>
    </div>
  );
}

const Q = {
  familiar: {
    q: "How familiar does “401(k)” sound to you?",
    options: [
      { v: 0, label: "Never heard of it" },
      { v: 1, label: "I have heard of it" },
      { v: 2, label: "I know it well" },
    ],
  },
  prefer: {
    q: "What would you rather get?",
    options: [
      { v: "do", label: "Just tell me what to do" },
      { v: "why", label: "Help me understand why" },
    ],
  },
  figures: {
    q: "Exact figures, or the main ideas?",
    options: [
      { v: "ideas", label: "The main ideas" },
      { v: "exact", label: "Exact figures" },
    ],
  },
  easy: {
    q: "Would you like larger text and simpler steps?",
    options: [
      { v: true, label: "Yes, make it simpler" },
      { v: false, label: "No, this is fine" },
    ],
  },
};

function profileFrom(a) {
  if (a.familiar === 2 && a.figures === "exact") return "expert";
  if (a.prefer === "do") return "action";
  if (a.familiar === 0) return "novice";
  return "understand";
}

export function Calibration() {
  const plan = useStore((s) => s.plan);
  const via = useStore((s) => s.via);
  const simple = useStore((s) => s.simple);
  const level = useStore((s) => s.level);
  const tutorial = useStore((s) => s.tutorial);
  const { setProfile, setPerson, setEasy, setTutorial, setLevel, startJourney } = useStore.getState();
  const couple = plan.names.length > 1;
  const suggested = plan.persona.suggestedProfile;
  const [step, setStep] = useState(couple ? "who" : via === "intake" ? "suggest" : "familiar");
  const [a, setA] = useState({});

  const prompt =
    step === "who"
      ? "Who is here right now?"
      : step === "suggest"
        ? `From your Sherpas intake, we would start you here: ${PROFILES[suggested].label.toLowerCase()}. Is that right?`
        : step === "tutorial"
          ? tutorial === "back"
            ? "You are inside. Zooming in always means going deeper. Now press Back to step out."
            : "One thing before we start. Tap any bubble to step inside it."
          : Q[step]?.q;
  useEffect(() => {
    if (prompt) speak(prompt);
    return () => stopSpeaking();
  }, [prompt]);

  // The zoom lesson: done once, by doing it.
  useEffect(() => {
    if (step !== "tutorial") return;
    if (tutorial === "enter" && level <= 2) setTutorial("back");
    if (tutorial === "back" && level >= 3) finishAll();
  }, [step, tutorial, level]);

  const finishAll = () => {
    setTutorial(null);
    useStore.setState({ tutorialDone: true });
    startJourney();
  };
  const afterEasy = (easy) => {
    setEasy(easy);
    if (easy || simple) return finishAll();
    setLevel(3);
    setTutorial("enter");
    setStep("tutorial");
  };
  const answer = (k, v) => {
    const next = { ...a, [k]: v };
    setA(next);
    if (k === "familiar") setStep("prefer");
    else if (k === "prefer") setStep("figures");
    else if (k === "figures") {
      setProfile(profileFrom(next));
      setStep("easy");
    }
  };

  return (
    <div className={`calib ${step === "tutorial" ? "tutorial" : ""}`}>
      {step === "tutorial" && tutorial === "enter" && <div className="ghost-hand" aria-hidden="true" />}
      <div className="glass calib-card" role="dialog" aria-label="Getting started">
        <p className="calib-q">{prompt}</p>
        {step === "who" && (
          <div className="options">
            {plan.names.map((n) => (
              <button
                key={n}
                className="btn"
                onClick={() => {
                  setPerson(n);
                  setStep(via === "intake" ? "suggest" : "familiar");
                }}
              >
                {n}
              </button>
            ))}
            <button
              className="btn"
              onClick={() => {
                setPerson(plan.names[0]);
                setStep(via === "intake" ? "suggest" : "familiar");
              }}
            >
              Both of us
            </button>
          </div>
        )}
        {step === "suggest" && (
          <div className="options">
            <button
              className="btn primary"
              onClick={() => {
                setProfile(suggested);
                setStep("easy");
              }}
            >
              Yes, start there
            </button>
            <button className="btn" onClick={() => setStep("familiar")}>
              Let me choose
            </button>
          </div>
        )}
        {["familiar", "prefer", "figures"].includes(step) && (
          <div className="options">
            {Q[step].options.map((o) => (
              <button key={String(o.v)} className="btn" onClick={() => answer(step, o.v)}>
                {o.label}
              </button>
            ))}
          </div>
        )}
        {step === "easy" && (
          <div className="options">
            {Q.easy.options.map((o) => (
              <button key={String(o.v)} className="btn" onClick={() => afterEasy(o.v)}>
                {o.label}
              </button>
            ))}
          </div>
        )}
        {step === "tutorial" && (
          <div className="options">
            {tutorial === "back" && (
              <button className="btn primary" onClick={() => setLevel(3)}>
                ‹ Back
              </button>
            )}
            <button className="link" onClick={finishAll}>
              Skip this
            </button>
          </div>
        )}
        {step !== "tutorial" && <p className="fine">You can change this at any time. Nothing here is a test.</p>}
      </div>
    </div>
  );
}
