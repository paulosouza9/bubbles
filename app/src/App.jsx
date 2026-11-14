import { lazy, Suspense, useEffect } from "react";
import { stopSpeaking } from "./audio.js";
import { useStore } from "./store.js";
import { AskPopover, ChatBar } from "./ui/Chat.jsx";
import { HumanModal, Toast, TopBar } from "./ui/Chrome.jsx";
import { DecisionCard, MissionsPanel } from "./ui/Missions.jsx";
import { Month } from "./ui/Month.jsx";
import { Stage } from "./ui/Deep.jsx";
import { Calibration, Forming, Landing } from "./ui/Start.jsx";

const World3D = lazy(() => import("./scene/World3D.jsx"));

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function App() {
  const phase = useStore((s) => s.phase);
  const plan = useStore((s) => s.plan);
  const easy = useStore((s) => s.easy);
  const simple = useStore((s) => s.simple);

  useEffect(() => {
    const s = useStore.getState();
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    s.setSimple(!hasWebGL());
    s.setReduced(Boolean(reduced));
    const route = () => {
      const m = location.pathname.match(/^\/f\/([a-z0-9-]+)/);
      if (m && useStore.getState().family !== m[1]) useStore.getState().openFamily(m[1], "intake").catch(() => history.replaceState({}, "", "/"));
      if (!m && useStore.getState().family) useStore.getState().leave();
    };
    s.init().then(route);
    window.addEventListener("popstate", route);
    const esc = (e) => {
      if (e.key !== "Escape") return;
      const st = useStore.getState();
      if (st.decision) st.closeDecision();
      else if (st.humanOpen) st.setHumanOpen(false);
      else if (st.missionsOpen) st.setMissionsOpen(false);
      else if (st.chat.open) st.closeChat();
      else if (st.plan) st.back();
    };
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("popstate", route);
      window.removeEventListener("keydown", esc);
      stopSpeaking();
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("easy", easy);
  }, [easy]);

  const flat = easy || simple;
  return (
    <div className={`app phase-${phase} ${easy ? "easy" : ""} ${flat ? "flat" : "deep"}`}>
      {flat ? (
        <div className="flat-bg" aria-hidden="true" />
      ) : (
        <Suspense fallback={<div className="flat-bg" aria-hidden="true" />}>
          <World3D />
        </Suspense>
      )}
      {phase === "landing" && <Landing />}
      {plan && phase !== "landing" && (
        <>
          <TopBar />
          {phase === "forming" && <Forming />}
          {phase === "calibrate" && <Calibration />}
          {(phase === "journey" || phase === "cloud") && <Stage />}
          {phase === "month" && <Month />}
          {phase !== "forming" && phase !== "calibrate" && <ChatBar />}
          <AskPopover />
          <MissionsPanel />
          <DecisionCard />
          <HumanModal />
          <Toast />
        </>
      )}
    </div>
  );
}
