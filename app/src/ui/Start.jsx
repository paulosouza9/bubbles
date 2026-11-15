// Getting in: the landing page (two entries), the bubbles forming, and the short calibration
// that sets the starting level and teaches the zoom once.
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { speak, stopSpeaking } from "../audio.js";
import { useStore } from "../store.js";

const PlanPreview = lazy(() => import("../scene/PlanPreview.jsx"));

export function go(path) {
  if (location.pathname !== path) history.pushState({}, "", path);
}

export function Landing() {
  const families = useStore((s) => s.families);
  const loadError = useStore((s) => s.loadError);
  const openFamily = useStore((s) => s.openFamily);
  const simple = useStore((s) => s.simple || s.easy);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState("");
  const [miss, setMiss] = useState(false);
  const [openError, setOpenError] = useState("");
  const input = useRef();

  const open = async (id, via) => {
    setOpenError("");
    setBusy("Opening your plan…");
    try {
      await openFamily(id, via);
      go(`/f/${id}`);
    } catch {
      setBusy("");
      setOpenError("Your plan could not be opened. Please try again.");
    }
  };
  const onFiles = async (files) => {
    if (!files?.length || busy) return;
    setMiss(false);
    setOpenError("");
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
        <div className="hero-copy">
          <h1>Your plan, explained at your level.</h1>
          <p className="lede">A voice walks you through it, one bubble at a time. Step inside any bubble for more detail, or step back out for the simple version.</p>
        </div>
        {!simple && (
          <Suspense fallback={<div className="plan-preview-loading" role="status">Loading the 3D preview?</div>}>
            <PlanPreview />
          </Suspense>
        )}
      </section>
      <section className="entries" aria-label="Open your plan" aria-busy={Boolean(busy)}>
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
          <svg className="drop-art" viewBox="0 0 240 120" aria-hidden="true">
            <defs>
              <radialGradient id="dropBubble" cx="38%" cy="32%" r="70%">
                <stop offset="0" stopColor="#fff" />
                <stop offset="0.7" stopColor="#EAF3FF" />
                <stop offset="1" stopColor="#CFE3FF" />
              </radialGradient>
            </defs>
            <g fill="#fff" stroke="#D1D1D6" strokeWidth="1.5">
              <rect x="22" y="30" width="58" height="74" rx="7" transform="rotate(-8 51 67)" />
              <rect x="40" y="22" width="58" height="74" rx="7" />
            </g>
            <g stroke="#E5E5EA" strokeWidth="4" strokeLinecap="round">
              <path d="M52 40h34M52 52h26M52 64h30M52 76h20" />
            </g>
            <path d="M110 60h26" stroke="#C7C7CC" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 6" />
            <circle cx="182" cy="60" r="40" fill="url(#dropBubble)" stroke="#B9D6FF" strokeWidth="1.5" />
            <circle cx="168" cy="72" r="7" fill="#34C759" opacity="0.85" />
            <circle cx="190" cy="50" r="10" fill="#0071E3" opacity="0.8" />
            <circle cx="198" cy="76" r="5" fill="#FF9F0A" opacity="0.85" />
          </svg>
          <button className="btn primary" onClick={() => input.current.click()} disabled={Boolean(busy)}>
            Choose files
          </button>
          <input ref={input} type="file" multiple hidden accept=".pdf,.json,.md,.txt,.csv" onChange={(e) => onFiles(e.target.files)} />
          {busy && <div className="busy" role="status">{busy}</div>}
          {miss && <div className="warn" role="alert">We could not match those documents to a plan. Choose your household from the list instead.</div>}
        </div>
        <div className="glass intake">
          <div className="eyebrow">Sherpas already has your details?</div>
          <h2>Open your plan directly</h2>
          <p className="mute">If your advisor's firm already completed your intake, there is nothing to upload.</p>
          {loadError && <div className="warn" role="alert">Households could not be loaded. <button className="link" onClick={() => window.location.reload()}>Try again</button></div>}
          {openError && <div className="warn" role="alert">{openError}</div>}
          {!families.length && !loadError && <div className="busy">Loading households…</div>}
          <ul className="family-list">
            {families.map((f) => (
              <li key={f.id}>
                <button onClick={() => open(f.id, "intake")} disabled={Boolean(busy)} aria-label={`Open ${f.label} ${f.lastName}?s plan`}>
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
        <span className="block">These are fictional households built for the Sherpas hackathon. This app explains an existing plan. It does not give new financial advice.</span>
      </footer>
    </main>
  );
}

export function Forming() {
  const plan = useStore((s) => s.plan);
  const via = useStore((s) => s.via);
  const [step, setStep] = useState(0);
  // Straight from the greeting into the first bubble: no questions first.
  const begin = () => {
    useStore.setState({ tutorialDone: true });
    useStore.getState().startJourney();
  };
  useEffect(() => {
    let alive = true;
    const t0 = performance.now();
    const t1 = setTimeout(() => alive && setStep(1), 1500);
    const finish = () => {
      const wait = Math.max(0, 3600 - (performance.now() - t0));
      setTimeout(() => alive && begin(), wait);
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
      <p className="forming-note">Larger text or simpler words? Easy mode, at the top, works at any moment.</p>
      <button className="link skip" onClick={begin}>
        Skip
      </button>
    </div>
  );
}
