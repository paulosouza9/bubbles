// What you see on each floor of the zoom:
//   4 City      one sentence for the whole picture
//   3 Building  the map of bubbles (labels are in the 3D scene; a list in the simple view)
//   2 Floor     the explanation, the mini app and the must-knows
//   1 Desk      every figure, each on its own "desk", plus Sherpas' own analysis
import { useEffect, useState } from "react";
import { speak, stopSpeaking } from "../audio.js";
import { LEVEL_HINT, LEVEL_NAMES, STATUS_COLOR, STATUS_WORD, sentences } from "../format.js";
import MiniApp from "../miniapps/index.jsx";
import { useStore } from "../store.js";
import { MissionChip } from "./Missions.jsx";

export function Dot({ status }) {
  return <i className="dot" style={{ background: STATUS_COLOR[status] }} title={STATUS_WORD[status]} />;
}

export function MustKnow({ items }) {
  if (!items?.length) return null;
  return (
    <aside className="must" data-ask>
      <div className="must-head">
        <span className="i">i</span> Must know
      </div>
      <ul>
        {items.map((m, k) => (
          <li key={k}>{m.text}</li>
        ))}
      </ul>
    </aside>
  );
}

function CityView() {
  const plan = useStore((s) => s.plan);
  const setLevel = useStore((s) => s.setLevel);
  useEffect(() => {
    speak(plan.texts.city);
    return () => stopSpeaking();
  }, [plan]);
  return (
    <div className="city" data-ask>
      <div className="eyebrow">The big picture</div>
      <p className="city-line">{plan.texts.city}</p>
      <div className="city-score">
        <span className="chip static">
          <Dot status={plan.score.status} /> Sherpas score {plan.score.value} · {plan.score.band}
        </span>
      </div>
      <button className="btn primary" onClick={() => setLevel(3)}>
        See your map
      </button>
    </div>
  );
}

// The simple view of the building: a list of large cards instead of floating bubbles.
function BuildingList() {
  const plan = useStore((s) => s.plan);
  const enter = useStore((s) => s.enter);
  const step = useStore((s) => s.currentMission()?.bubbleId);
  const order = [...plan.order, ...plan.bubbles.map((b) => b.id).filter((id) => !plan.order.includes(id))];
  return (
    <div className="b-list">
      <div className="eyebrow">Your map</div>
      <h2>Everything in your plan, one area at a time</h2>
      <ul>
        {order.map((id) => {
          const b = plan.bubbles.find((x) => x.id === id);
          return (
            <li key={id}>
              <button className={`glass b-card ${step === id ? "step" : ""}`} onClick={() => enter(id)}>
                <span className="b-card-title">
                  <Dot status={b.status} /> {b.title}
                  {step === id && <span className="b-step">Your next step</span>}
                </span>
                <span className="b-card-sub">{b.building}</span>
                <span className="b-card-open">Open ›</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function BuildingOverlay() {
  const easy = useStore((s) => s.easy);
  const simple = useStore((s) => s.simple);
  const asked = useStore((s) => s.asked);
  const seen = Object.keys(asked).length;
  return (
    <>
      {easy || simple ? (
        <BuildingList />
      ) : (
        <p className="hint">
          Tap a bubble to step inside. Size shows how much it matters. The dot shows how it is doing.{seen > 0 ? " You have asked questions in some of them." : ""}
        </p>
      )}
      <MissionChip />
    </>
  );
}

function useNarration(text, enabled) {
  const [cur, setCur] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const parts = sentences(text);
  const play = () => {
    setPlaying(true);
    speak(text, {
      onProgress: (p) => {
        let acc = 0;
        const at = p * text.length;
        for (let k = 0; k < parts.length; k++) {
          acc += parts[k].length + 1;
          if (at <= acc) return setCur(k);
        }
      },
      onEnd: () => {
        setPlaying(false);
        setCur(-1);
      },
    });
  };
  const stop = () => {
    stopSpeaking();
    setPlaying(false);
    setCur(-1);
  };
  useEffect(() => {
    if (enabled) play();
    return stop;
  }, [text, enabled]);
  return { parts, cur, playing, play, stop };
}

function PanelHead({ b, extra }) {
  const phase = useStore((s) => s.phase);
  const idx = useStore((s) => s.journeyIndex);
  const total = useStore((s) => s.plan.order.length);
  return (
    <header className="panel-head">
      <div>
        <h2>
          <Dot status={b.status} /> {b.title}
        </h2>
        <div className="mute small">
          {STATUS_WORD[b.status]}
          {b.points ? ` · ${b.points} points in your score` : ""}
          {phase === "journey" ? ` · bubble ${idx + 1} of ${total}` : ""}
        </div>
      </div>
      {extra}
    </header>
  );
}

function PanelFoot({ b }) {
  const phase = useStore((s) => s.phase);
  const level = useStore((s) => s.level);
  const style = useStore((s) => s.profile().style);
  const idx = useStore((s) => s.journeyIndex);
  const total = useStore((s) => s.plan.order.length);
  const { simpler, deeper, journeyNext, journeyPrev, openDecision, setMissionsOpen } = useStore.getState();
  const mission = useStore((s) => s.activeMissions().find((m) => m.bubbleId === b.id && s.missions.status[m.id] !== "done"));
  const canSimpler = level === 1 || style === "standard" || phase !== "journey";
  return (
    <footer className="panel-foot">
      <div className="foot-left">
        <button className="btn" onClick={simpler} disabled={!canSimpler}>
          {level === 1 ? "‹ Back to the explanation" : style === "standard" ? "Simpler" : "‹ Back to the map"}
        </button>
        {level === 2 && (
          <button className="btn" onClick={deeper}>
            {style === "plain" ? "More detail" : "See the figures ›"}
          </button>
        )}
      </div>
      <div className="foot-right">
        {phase === "journey" ? (
          <>
            {idx > 0 && (
              <button className="btn" onClick={journeyPrev}>
                Previous
              </button>
            )}
            <button className="btn primary" onClick={journeyNext}>
              {idx + 1 >= total ? "See your whole map" : "Next"}
            </button>
          </>
        ) : (
          mission && (
            <button
              className="btn primary"
              onClick={() => {
                setMissionsOpen(false);
                openDecision(mission.id);
              }}
            >
              Your step here
            </button>
          )
        )}
      </div>
    </footer>
  );
}

function FloorPanel({ b }) {
  const style = useStore((s) => s.profile().style);
  const kind = useStore((s) => s.profile().kind);
  const chatOpen = useStore((s) => s.chat.open);
  const move = useStore((s) => s.plan.moves.find((m) => m.bubbleId === b.id));
  const text = b.floor[style];
  const n = useNarration(text, true);
  useEffect(() => {
    if (chatOpen) n.stop();
  }, [chatOpen]);
  return (
    <section className="glass panel floor" aria-label={b.title}>
      <PanelHead
        b={b}
        extra={
          <button className="icon-btn" onClick={n.playing ? n.stop : n.play} aria-label={n.playing ? "Pause the voice" : "Play the voice"}>
            {n.playing ? "❚❚" : "▶"}
          </button>
        }
      />
      <div className="panel-body">
        <p className="explain" data-ask>
          {n.parts.map((s, k) => (
            <span key={k} className={k === n.cur ? "now" : ""}>
              {s}{" "}
            </span>
          ))}
        </p>
        {kind === "action" && move && (
          <p className="do-this" data-ask>
            <b>What your plan suggests:</b> {move.title}. {move.why}
          </p>
        )}
        <MiniApp bubble={b} />
        <MustKnow items={b.mustKnow} />
      </div>
      <PanelFoot b={b} />
    </section>
  );
}

function DeskPanel({ b }) {
  return (
    <section className="glass panel desk" aria-label={`${b.title}: the figures`}>
      <PanelHead b={b} extra={<span className="chip static">The figures</span>} />
      <div className="panel-body" data-ask>
        <div className="desks">
          {b.desks.map((d, k) => (
            <div key={k} className="desk-card">
              <div className="desk-label">{d.label}</div>
              <div className="desk-value">{d.value}</div>
              {d.note && <div className="desk-note">{d.note}</div>}
            </div>
          ))}
        </div>
        {b.analysis.length > 0 && (
          <>
            <h3>What Sherpas' analysis says</h3>
            <ul className="analysis">
              {b.analysis.map((t, k) => (
                <li key={k}>{t}</li>
              ))}
            </ul>
          </>
        )}
        {b.lookInto && (
          <p className="look">
            <b>Worth looking into with a person:</b> {b.lookInto}
          </p>
        )}
        <MustKnow items={b.mustKnow} />
      </div>
      <PanelFoot b={b} />
    </section>
  );
}

function JourneyBar() {
  const plan = useStore((s) => s.plan);
  const idx = useStore((s) => s.journeyIndex);
  const skip = useStore((s) => s.skipJourney);
  return (
    <div className="journey-bar">
      <div className="dots">
        {plan.order.map((id, k) => (
          <i key={id} className={k < idx ? "done" : k === idx ? "now" : ""} />
        ))}
      </div>
      <button className="link" onClick={skip}>
        Skip to the map
      </button>
    </div>
  );
}

export function Elevator() {
  const level = useStore((s) => s.level);
  const phase = useStore((s) => s.phase);
  const setLevel = useStore((s) => s.setLevel);
  return (
    <nav className="glass elevator" aria-label="Zoom level">
      {[4, 3, 2, 1].map((l) => {
        const locked = phase === "journey" && l >= 3;
        return (
          <button key={l} className={level === l ? "on" : ""} disabled={locked} onClick={() => setLevel(l)} aria-current={level === l} title={LEVEL_HINT[l]}>
            <span className="el-num">{l}</span>
            <span className="el-text">
              <b>{LEVEL_NAMES[l]}</b>
              <small>{LEVEL_HINT[l]}</small>
            </span>
          </button>
        );
      })}
    </nav>
  );
}

export function Stage() {
  const plan = useStore((s) => s.plan);
  const level = useStore((s) => s.level);
  const focus = useStore((s) => s.focus);
  const phase = useStore((s) => s.phase);
  const easy = useStore((s) => s.easy);
  const b = plan.bubbles.find((x) => x.id === focus);
  return (
    <div className={`stage level-${level}`}>
      {phase === "journey" && <JourneyBar />}
      {level === 4 && <CityView />}
      {level === 3 && <BuildingOverlay />}
      {level === 2 && b && <FloorPanel b={b} key={`f-${b.id}`} />}
      {level === 1 && b && <DeskPanel b={b} key={`d-${b.id}`} />}
      {!easy && <Elevator />}
    </div>
  );
}
