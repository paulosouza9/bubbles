// Getting in: the dashboard (the four plans in front of one big glass bubble, and a glass
// plus to add documents), the bubbles forming, and the short calibration that sets the
// starting level and teaches the zoom once.
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { speak, stopSpeaking } from "../audio.js";
import { useStore } from "../store.js";

const DashWorld = lazy(() => import("../scene/DashWorld.jsx"));

const BAND = {
  critical: { color: "#ff3b30", label: "Needs attention" },
  vulnerable: { color: "#ff9f0a", label: "Vulnerable" },
  stable: { color: "#0071e3", label: "Stable" },
  strong: { color: "#34c759", label: "Strong" },
};
const bandOf = (f) => BAND[f.band] || { color: "#8e8e93", label: "Plan ready" };

function ScoreRing({ score, color }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, Number(score) || 0));
  return (
    <svg className="score-ring" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(29,29,31,0.08)" strokeWidth="5" />
      <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} transform="rotate(-90 32 32)" />
      <text x="32" y="38" textAnchor="middle" fontSize="18" fontWeight="650" fill="currentColor">
        {score ?? "–"}
      </text>
    </svg>
  );
}

function PlanCard({ f, onOpen, onHot, disabled }) {
  const band = bandOf(f);
  const initials = f.label
    .split(" & ")
    .map((n) => n[0])
    .join("");
  const hot = () => onHot(f.id);
  const cold = () => onHot(null);
  return (
    <li>
      <button
        className="glass plan-card"
        onClick={onOpen}
        onPointerEnter={hot}
        onPointerLeave={cold}
        onFocus={hot}
        onBlur={cold}
        disabled={disabled}
        aria-label={`Open ${f.label} ${f.lastName}'s plan. Health score ${f.score} out of 100, ${band.label}.`}
        style={{ "--band": band.color }}
      >
        <span className="plan-top">
          <span className="plan-avatar" aria-hidden="true">
            {initials}
          </span>
          <ScoreRing score={f.score} color={band.color} />
        </span>
        <span className="plan-name">
          <b>{f.label}</b>
          <span>{f.lastName}</span>
        </span>
        <span className="plan-meta">
          {f.city}
          {f.people ? ` · ${f.people} ${f.people === 1 ? "person" : "people"}` : ""}
        </span>
        <span className="plan-foot">
          <span className="band-pill">
            <span className="dot" />
            {band.label}
          </span>
          <span className="arrow">
            Open
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>
          </span>
        </span>
      </button>
    </li>
  );
}

function FlatPlus() {
  return (
    <svg className="plus-flat" viewBox="0 0 120 120" aria-hidden="true">
      <rect x="44" y="10" width="32" height="100" rx="12" fill="currentColor" />
      <rect x="10" y="44" width="100" height="32" rx="12" fill="currentColor" />
    </svg>
  );
}

export function go(path) {
  if (location.pathname !== path) history.pushState({}, "", path);
}

export function Landing() {
  const families = useStore((s) => s.families);
  const loadError = useStore((s) => s.loadError);
  const openFamily = useStore((s) => s.openFamily);
  const simple = useStore((s) => s.simple || s.easy);
  const reduced = useStore((s) => s.reduced);
  const [drag, setDrag] = useState(false);
  const [hover, setHover] = useState(false);
  const [hot, setHot] = useState(null);
  const [busy, setBusy] = useState("");
  const [miss, setMiss] = useState(false);
  const [openError, setOpenError] = useState("");
  const input = useRef();
  const grid = useRef();
  const bubbleSpot = useRef();
  const plusSpot = useRef();
  const plusState = useRef({ hover: false, over: false, busy: false });
  plusState.current = { hover, over: drag, busy: Boolean(busy) };
  const orbs = families.map((f) => ({ id: f.id, color: bandOf(f).color }));

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
    <main className={`landing dash ${simple ? "is-flat" : ""}`}>
      {!simple && (
        <Suspense fallback={null}>
          <DashWorld bubbleAnchor={grid} bubbleSpot={bubbleSpot} plusAnchor={plusSpot} plusState={plusState} orbs={orbs} hot={hot} reduced={reduced} />
        </Suspense>
      )}
      <header className="brand-row">
        <span className="brand">FINANCIAL COACH</span>
        <span className="brand-note">Your Sherpas plan, explained at your level</span>
      </header>

      <section className="dash-head">
        <h1>Choose a plan to explore.</h1>
        <p className="lede">A voice walks you through it, one bubble at a time. Step inside for detail, or step back out for the simple version.</p>
      </section>

      {!simple && <div className="bubble-spot" ref={bubbleSpot} aria-hidden="true" />}

      <section className="plans" aria-label="Plans ready to open" aria-busy={Boolean(busy)}>
        {loadError && (
          <div className="warn" role="alert">
            Households could not be loaded.{" "}
            <button className="link" onClick={() => window.location.reload()}>
              Try again
            </button>
          </div>
        )}
        {openError && (
          <div className="warn" role="alert">
            {openError}
          </div>
        )}
        <ul className="plan-grid" ref={grid}>
          {!families.length && !loadError
            ? [0, 1, 2, 3].map((i) => <li key={i} className="glass plan-card skeleton" aria-hidden="true" />)
            : families.map((f) => <PlanCard key={f.id} f={f} onOpen={() => open(f.id, "intake")} onHot={setHot} disabled={Boolean(busy)} />)}
        </ul>
      </section>

      <section className="add" aria-label="Add your documents">
        <button
          type="button"
          className={`add-drop ${drag ? "over" : ""} ${busy ? "is-busy" : ""}`}
          onClick={() => input.current.click()}
          disabled={Boolean(busy)}
          onPointerEnter={() => setHover(true)}
          onPointerLeave={() => setHover(false)}
          onFocus={() => setHover(true)}
          onBlur={() => setHover(false)}
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
          aria-describedby="add-help"
        >
          {/* The glass plus is drawn by the 3D layer right behind this spot; flat mode draws it here. */}
          <span className="add-visual" ref={plusSpot}>
            {simple && <FlatPlus />}
          </span>
          <span className="add-copy">
            <b>{drag ? "Drop to add your files" : "Add your documents"}</b>
            <span id="add-help" className="mute small">
              Drop statements or a plan report here, or click to choose. We match them to the plan Sherpas prepared for you.
            </span>
          </span>
        </button>
        <input ref={input} type="file" multiple hidden accept=".pdf,.json,.md,.txt,.csv" onChange={(e) => onFiles(e.target.files)} />
        <div className="add-status" aria-live="polite">
          {busy && (
            <div className="busy" role="status">
              {busy}
            </div>
          )}
          {miss && (
            <div className="warn" role="alert">
              We could not match those documents to a plan. Choose your household above instead.
            </div>
          )}
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
