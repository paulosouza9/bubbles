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
        <span className="mute small">Your Sherpas plan, made clear</span>
      </header>
      <section className="hero">
        <div className="hero-copy">
          <h1>Your plan, explained at your level.</h1>
          <p className="lede">A voice walks you through it, one bubble at a time. Step inside for more detail, or step back for the simple version.</p>
        </div>
        {!simple && (
          <Suspense fallback={<div className="plan-preview-loading" role="status">Loading the 3D preview…</div>}>
            <PlanPreview />
          </Suspense>
        )}
      </section>
      <section className="entries" aria-label="Open your plan" aria-busy={Boolean(busy)}>
        <div
          className={`drop ${drag ? "over" : ""}`}
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
          <svg className="upload-icon" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 16V3m-4 4 4-4 4 4M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" />
          </svg>
          <h2>Start with your documents</h2>
          <p className="mute">Drop your statements or plan report here. We’ll match them to the plan Sherpas has prepared for you.</p>
          <button className="btn primary" onClick={() => input.current.click()} disabled={Boolean(busy)}>
            Choose files
          </button>
          <p className="fine">PDF, JSON, Markdown, text or CSV · Up to 6 files</p>
          <input ref={input} type="file" multiple hidden accept=".pdf,.json,.md,.txt,.csv" onChange={(e) => onFiles(e.target.files)} />
          {miss && <div className="warn" role="alert">We could not match those documents to a plan. Choose your household from the list instead.</div>}
        </div>
        <div className="intake">
          <h2>Open your plan directly</h2>
          <p className="mute">If your advisor's firm already completed your intake, there is nothing to upload.</p>
          {loadError && <div className="warn" role="alert">Households could not be loaded. <button className="link" onClick={() => window.location.reload()}>Try again</button></div>}
          {!families.length && !loadError && <div className="busy" role="status">Loading households…</div>}
          <ul className="family-list">
            {families.map((f) => (
              <li key={f.id}>
                <button onClick={() => open(f.id, "intake")} disabled={Boolean(busy)} aria-label={`Open ${f.label} ${f.lastName}’s plan`}>
                  <span>
                    <b>
                      {f.label} {f.lastName}
                    </b>
                    <span className="mute block">{f.city}</span>
                  </span>
                  <span className="arrow" aria-hidden="true">Open <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14m-5-5 5 5-5 5" /></svg></span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <div className="entry-status" role="status">{busy}</div>
      {openError && <div className="warn" role="alert">{openError}</div>}
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
