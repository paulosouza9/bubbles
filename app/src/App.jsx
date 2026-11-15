import { lazy, Suspense, useEffect } from "react";
import { stopSpeaking } from "./audio.js";
import { restoreNav, useStore } from "./store.js";
import { AskPopover, ChatBar } from "./ui/Chat.jsx";
import { HumanModal, Toast, TopBar } from "./ui/Chrome.jsx";
import { DecisionCard, MissionsPanel } from "./ui/Missions.jsx";
import { AllLit, Celebration } from "./ui/Moments.jsx";
import { Meeting, MonthPage } from "./ui/MonthPage.jsx";
import { Stage } from "./ui/Deep.jsx";
import { Forming, Landing } from "./ui/Start.jsx";

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
  const chatOpen = useStore((s) => s.chat.open);

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
    // Back and forward move between bubbles and pages of the same household.
    const onPop = (e) => {
      const m = location.pathname.match(/^\/f\/([a-z0-9-]+)/);
      const st = useStore.getState();
      if (m && st.family === m[1] && st.plan && (e.state?.b || e.state?.v)) {
        if (st.decision) st.closeDecision();
        if (st.chat.open) st.closeChat();
        return restoreNav(e.state);
      }
      route();
    };
    s.init().then(route);
    window.addEventListener("popstate", onPop);
    const esc = (e) => {
      // + and - zoom, like a map, unless the person is typing.
      if ((e.key === "+" || e.key === "=" || e.key === "-") && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) {
        const z = useStore.getState();
        if (z.plan && (z.phase === "cloud" || z.phase === "journey")) {
          if (z.decision || z.chat.open || z.easy || z.simple) return;
          e.key === "-" ? z.stepOut() : z.stepIn();
        }
        return;
      }
      if (e.key !== "Escape") return;
      const st = useStore.getState();
      if (st.allLit) st.closeAllLit();
      else if (st.celebrate) st.setCelebrate(null);
      else if (st.decision) st.closeDecision();
      else if (st.overlayClose) st.overlayClose();
      else if (st.humanOpen) st.setHumanOpen(false);
      else if (st.missionsOpen) st.setMissionsOpen(false);
      else if (st.chat.open) st.closeChat();
      else if (st.plan) st.back();
    };
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", esc);
      stopSpeaking();
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("easy", easy);
  }, [easy]);

  const flat = easy || simple;
  return (
    <div className={`app phase-${phase} ${easy ? "easy" : ""} ${flat ? "flat" : "deep"} ${chatOpen ? "chat-open" : ""}`}>
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
          {(phase === "journey" || phase === "cloud") && <Stage />}
          {phase === "month" && <MonthPage />}
          {phase === "meeting" && <Meeting />}
          {phase !== "forming" && phase !== "calibrate" && <ChatBar />}
          <AskPopover />
          <MissionsPanel />
          <DecisionCard />
          <Celebration />
          <AllLit />
          <HumanModal />
          <Toast />
        </>
      )}
    </div>
  );
}
