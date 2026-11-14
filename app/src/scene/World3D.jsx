// The 3D world. One bubble at a time: it forms from droplets in the middle of the screen,
// you step inside it (the camera goes through the glass until the bubble fills the whole
// screen), you play with its toy, you go deeper for the figures, and when you are done the
// next bubble takes its place. Text stays in the HTML layer so it can be selected and read.
import { Environment, Html, Lightformer } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { easing } from "maath";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { sfx } from "../audio.js";
import { STATUS_COLOR } from "../format.js";
import { computeLayout, DECOR } from "../layout.js";
import { useStore } from "../store.js";
import Toy, { bursts, FactOrbs } from "./Toys.jsx";

const FOV = 35;
const TAN = Math.tan((FOV * Math.PI) / 360);
const R = 2; // every plan bubble has the same size: each one is its own world
const INSIDE = { 2: 0.62, 1: 0.5 }; // camera distance from the centre, in bubble radii
const formClock = { t: 9 };

function useCanvasTexture(draw, w = 256, h = 256) {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
}

function Backdrop() {
  const tex = useCanvasTexture(
    (g, w, h) => {
      g.fillStyle = "#ffffff";
      g.fillRect(0, 0, w, h);
      const blob = (x, y, r, color) => {
        const grd = g.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, color);
        grd.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = grd;
        g.fillRect(0, 0, w, h);
      };
      blob(260, 200, 300, "rgba(158,193,255,0.85)");
      blob(760, 190, 280, "rgba(255,194,217,0.75)");
      blob(330, 480, 270, "rgba(182,240,216,0.8)");
      blob(740, 470, 260, "rgba(255,225,168,0.8)");
      blob(520, 320, 200, "rgba(217,200,255,0.55)");
    },
    1024,
    640,
  );
  const ref = useRef();
  useFrame((st) => {
    if (useStore.getState().reduced) return;
    const t = st.clock.elapsedTime;
    ref.current.position.x = Math.sin(t * 0.07) * 1.6;
    ref.current.position.y = Math.cos(t * 0.05) * 0.9;
  });
  return (
    <mesh ref={ref} position={[0, 0, -9]}>
      <planeGeometry args={[64, 40]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}

function Glass({ r }) {
  return (
    <meshPhysicalMaterial color="#ffffff" transmission={1} thickness={r * 0.9} roughness={0.03} ior={1.17} dispersion={3} clearcoat={1} clearcoatRoughness={0.06} iridescence={0.18} iridescenceIOR={1.2} envMapIntensity={0.85} toneMapped={false} />
  );
}

function Shadow({ r, hidden }) {
  const tex = useCanvasTexture((g) => {
    const grd = g.createRadialGradient(128, 128, 40, 128, 128, 128);
    grd.addColorStop(0, "rgba(40,60,110,0.34)");
    grd.addColorStop(0.55, "rgba(40,60,110,0.12)");
    grd.addColorStop(1, "rgba(40,60,110,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
  });
  return (
    <mesh position={[0, -r * 0.16, -r * 0.5]} visible={!hidden}>
      <planeGeometry args={[r * 2.7, r * 2.7]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

// ---- Camera -----------------------------------------------------------------------------

function Rig({ layout }) {
  const { camera, size } = useThree();
  const look = useRef(new THREE.Vector3());
  useFrame((_, dt) => {
    const s = useStore.getState();
    const aspect = size.width / size.height;
    let p;
    let l;
    if (!s.plan) {
      const d = (Math.max(layout.halfH / TAN, layout.halfW / (TAN * aspect)) * 1.16 + 0.8) * 1.05;
      const shift = aspect > 1.2 ? -layout.halfW * 0.85 : 0;
      p = [shift, 0, d];
      l = [shift, 0, 0];
    } else if (s.level >= 3 || s.phase === "forming" || s.phase === "calibrate") {
      const fill = s.phase === "calibrate" ? 0.86 : s.phase === "forming" ? 0.5 : 0.62;
      const d = Math.max(R / (TAN * fill), R / (TAN * aspect * 0.9));
      const lift = s.phase === "forming" ? -0.9 : s.phase === "calibrate" ? 0 : -0.35;
      p = [0, lift, d];
      l = [0, lift, 0];
    } else {
      p = [0, 0, R * INSIDE[s.level]];
      l = [0, 0, -R];
    }
    p[2] -= s.nudge * 1.2;
    easing.damp3(camera.position, p, s.reduced ? 0.0001 : 0.42, dt);
    easing.damp3(look.current, l, s.reduced ? 0.0001 : 0.32, dt);
    camera.lookAt(look.current);
  });
  return null;
}

// ---- Things that live inside the bubble -----------------------------------------------------

function MicroBubbles({ visible }) {
  const ref = useRef();
  const count = 46;
  const seeds = useMemo(() => Array.from({ length: count }, (_, i) => ({ x: Math.sin(i * 12.9898) * 1.5, y: ((i * 0.37) % 1) * 3 - 1.5, z: -0.3 - ((i * 0.61) % 1) * 1.3, s: 0.012 + ((i * 7) % 10) * 0.004, v: 0.04 + ((i * 3) % 7) * 0.012 })), []);
  const d = useMemo(() => new THREE.Object3D(), []);
  useFrame((st) => {
    ref.current.visible = visible;
    if (!visible) return;
    const t = st.clock.elapsedTime;
    seeds.forEach((b, i) => {
      const y = ((b.y + t * b.v + 1.5) % 3) - 1.5;
      d.position.set(b.x + Math.sin(t * 0.6 + i) * 0.05, y, b.z);
      d.scale.setScalar(b.s);
      d.updateMatrix();
      ref.current.setMatrixAt(i, d.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[null, null, count]} frustumCulled={false}>
      <sphereGeometry args={[1, 16, 16]} />
      <meshPhysicalMaterial color="#ffffff" transparent opacity={0.55} roughness={0.05} clearcoat={1} depthWrite={false} toneMapped={false} />
    </instancedMesh>
  );
}

function Interior({ bubble }) {
  const level = useStore((s) => s.level);
  const { size } = useThree();
  const group = useRef();
  const aspect = size.width / size.height;
  const fit = Math.min(1, aspect / 1.3);
  useFrame((_, dt) => {
    const s = useStore.getState();
    const unit = ((R * INSIDE[Math.min(2, Math.max(1, s.level))] * TAN) / 3.3) * fit;
    easing.damp3(group.current.scale, [unit, unit, unit], s.reduced ? 0.0001 : 0.3, dt);
    group.current.position.y = unit * 0.05;
  });
  return (
    <group ref={group} scale={0.0001}>
      {level === 2 && <Toy bubble={bubble} key={`toy-${bubble.id}`} />}
      {level === 1 && <FactOrbs desks={bubble.desks} key={`facts-${bubble.id}`} />}
    </group>
  );
}

function Bursts() {
  const ref = useRef();
  const count = 220;
  const parts = useRef([]);
  const d = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);
  useFrame((_, dt) => {
    for (const b of bursts.queue.splice(0)) {
      for (let i = 0; i < b.n; i++) {
        const a = Math.random() * Math.PI * 2;
        const e = Math.random() * Math.PI - Math.PI / 2;
        const v = 0.25 + Math.random() * 0.45;
        parts.current.push({ p: b.p.clone(), v: new THREE.Vector3(Math.cos(a) * Math.cos(e) * v, Math.sin(e) * v + 0.12, Math.sin(a) * Math.cos(e) * v * 0.4), life: 0.7 + Math.random() * 0.4, age: 0, color: Math.random() > 0.35 ? b.color : "#ffffff", s: 0.006 + Math.random() * 0.012 });
      }
    }
    parts.current = parts.current.filter((p) => p.age < p.life).slice(-count);
    for (let i = 0; i < count; i++) {
      const p = parts.current[i];
      if (!p) {
        d.scale.setScalar(0);
        d.updateMatrix();
        ref.current.setMatrixAt(i, d.matrix);
        continue;
      }
      p.age += dt;
      p.v.y -= dt * 0.25;
      p.p.addScaledVector(p.v, dt);
      d.position.copy(p.p);
      d.scale.setScalar(p.s * (1 - p.age / p.life));
      d.updateMatrix();
      ref.current.setMatrixAt(i, d.matrix);
      ref.current.setColorAt(i, col.set(p.color));
    }
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[null, null, count]} frustumCulled={false}>
      <sphereGeometry args={[1, 10, 10]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

function Droplets() {
  const ref = useRef();
  const count = 70;
  const seeds = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const a = i * 2.39996;
        return { sx: Math.cos(a) * (5 + (i % 5)), sy: Math.sin(a) * (4 + (i % 4)) + 1, sz: Math.cos(i * 4.1) * 1.5, tx: Math.cos(a) * 0.5, ty: Math.sin(a) * 0.5, delay: (i % 24) * 0.02, size: 0.06 + ((i * 13) % 10) * 0.012 };
      }),
    [],
  );
  const d = useMemo(() => new THREE.Object3D(), []);
  useFrame((_, dt) => {
    const s = useStore.getState();
    formClock.t += s.reduced ? 10 : dt;
    const on = s.plan && formClock.t < 1.9;
    ref.current.visible = on;
    if (!on) return;
    seeds.forEach((q, i) => {
      const k = Math.min(1, Math.max(0, (formClock.t - q.delay) / 1.1));
      const e = 1 - Math.pow(1 - k, 3);
      d.position.set(q.sx + (q.tx - q.sx) * e, q.sy + (q.ty - q.sy) * e, q.sz * (1 - e));
      d.scale.setScalar(Math.max(0.0001, q.size * (k < 0.8 ? 1 : (1 - k) / 0.2)));
      d.updateMatrix();
      ref.current.setMatrixAt(i, d.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[null, null, count]} frustumCulled={false}>
      <sphereGeometry args={[1, 20, 20]} />
      <meshPhysicalMaterial color="#e8f0ff" roughness={0.1} clearcoat={1} envMapIntensity={1.3} toneMapped={false} />
    </instancedMesh>
  );
}

// ---- The bubble -----------------------------------------------------------------------------

function PlanBubble({ id }) {
  const group = useRef();
  const inner = useRef();
  const ring = useRef();
  const [hovered, setHovered] = useState(false);
  const bubble = useStore((s) => s.bubble(id).title) && useStore.getState().bubble(id);
  const focus = useStore((s) => s.focus);
  const level = useStore((s) => s.level);
  const phase = useStore((s) => s.phase);
  const stepHere = useStore((s) => s.journeyDone && s.currentMission()?.bubbleId === id);
  const active = focus === id;
  const browsing = phase === "journey" || phase === "cloud";
  const inside = active && browsing && level <= 2;

  useFrame((st, dt) => {
    const s = useStore.getState();
    const t = st.clock.elapsedTime;
    let target = 0.0001;
    if (active && s.phase !== "month") {
      const k = Math.min(1, Math.max(0, (formClock.t - 0.55) / 0.8));
      target = Math.max(0.0001, k * k * (3 - 2 * k)) * (hovered && s.level === 3 ? 1.03 : 1);
    }
    easing.damp3(group.current.scale, [target, target, target], s.reduced ? 0.0001 : active ? 0.2 : 0.14, dt);
    const float = inside || s.reduced ? 0 : 1;
    group.current.position.set(Math.cos(t * 0.45) * 0.04 * float, Math.sin(t * 0.6) * 0.07 * float, 0);
    easing.damp(inner.current.material, "opacity", inside ? 0.42 : 0, 0.25, dt);
    if (ring.current) {
      const pulse = 1 + Math.sin(t * 2.2) * 0.012;
      ring.current.scale.set(pulse, pulse, pulse);
      ring.current.visible = s.level === 3;
    }
  });

  const clickable = active && level === 3 && browsing;
  return (
    <group ref={group} scale={0.0001}>
      <mesh
        onClick={(e) => {
          if (!clickable) return;
          e.stopPropagation();
          sfx("whoosh");
          useStore.getState().enter(id);
        }}
        onPointerOver={() => {
          if (!clickable) return;
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "";
        }}
      >
        <sphereGeometry args={[R, 80, 80]} />
        <Glass r={R} />
      </mesh>
      <mesh ref={inner} scale={0.985}>
        <sphereGeometry args={[R, 48, 48]} />
        <meshBasicMaterial color="#ffffff" side={THREE.BackSide} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
      <Shadow r={R} hidden={inside} />
      {stepHere && active && (
        <mesh ref={ring}>
          <torusGeometry args={[R * 1.07, 0.022, 12, 120]} />
          <meshBasicMaterial color="#0071E3" transparent opacity={0.75} toneMapped={false} />
        </mesh>
      )}
      {active && level === 3 && browsing && (
        <Html center zIndexRange={[4, 0]} style={{ pointerEvents: "none" }}>
          <div className="b-label big">
            <div className="b-title">
              {bubble.status !== "neutral" && <i className="dot" style={{ background: STATUS_COLOR[bubble.status] }} />}
              {bubble.title}
            </div>
            <div className="b-sub" data-ask>
              {bubble.building}
            </div>
            {stepHere && <div className="b-step">Your next step is in here</div>}
          </div>
        </Html>
      )}
      <MicroBubbles visible={inside} />
      {inside && <Interior bubble={bubble} />}
    </group>
  );
}

function DecorBubble({ node, index }) {
  const group = useRef();
  useFrame((st, dt) => {
    const t = st.clock.elapsedTime;
    const float = useStore.getState().reduced ? 0 : 1;
    easing.damp3(group.current.scale, [1, 1, 1], 0.3, dt);
    group.current.position.set(node.x + Math.cos(t * 0.45 + index) * 0.045 * float, node.y + Math.sin(t * 0.6 + index * 1.7) * 0.07 * float, node.z);
  });
  return (
    <group ref={group} scale={0.0001}>
      <mesh>
        <sphereGeometry args={[node.r, 64, 64]} />
        <Glass r={node.r} />
      </mesh>
      <Shadow r={node.r} />
    </group>
  );
}

function Scene() {
  const plan = useStore((s) => s.plan);
  const focus = useStore((s) => s.focus);
  const { size } = useThree();
  const layout = useMemo(() => computeLayout(DECOR, size.width / size.height < 0.85), [size.width < size.height * 0.85]);
  const ids = useMemo(() => (plan ? [...plan.bubbles.map((b) => b.id), "steps"] : []), [plan]);
  // Every time a new bubble takes the stage, it forms again from droplets.
  useEffect(() => {
    if (!plan) return;
    formClock.t = 0;
    sfx("pop");
  }, [focus, plan]);
  return (
    <>
      <color attach="background" args={["#ffffff"]} />
      <Backdrop />
      <Environment resolution={256} frames={1}>
        <mesh scale={50}>
          <sphereGeometry args={[1, 32, 32]} />
          <meshBasicMaterial color="#c3cde0" side={THREE.BackSide} />
        </mesh>
        <Lightformer form="circle" intensity={5} color="#ffffff" position={[-3, 9, 5]} scale={7} target={[0, 0, 0]} />
        <Lightformer form="circle" intensity={0.8} color="#ffffff" position={[0, 0, 12]} scale={26} target={[0, 0, 0]} />
        <Lightformer form="circle" intensity={2.2} color="#cfe0ff" position={[-10, 1, 1]} scale={6} target={[0, 0, 0]} />
        <Lightformer form="circle" intensity={2.2} color="#ffd6e6" position={[10, -1, 1]} scale={6} target={[0, 0, 0]} />
        <Lightformer form="circle" intensity={1.6} color="#dafbea" position={[2, -9, 3]} scale={6} target={[0, 0, 0]} />
      </Environment>
      <Rig layout={layout} />
      {!plan && layout.nodes.map((n, i) => <DecorBubble key={n.id} node={n} index={i} />)}
      {plan && ids.map((id) => <PlanBubble key={`${plan.family}-${id}`} id={id} />)}
      {plan && <Droplets />}
      <Bursts />
    </>
  );
}

export default function World3D() {
  const wheel = useRef({ acc: 0, last: 0 });
  const pinch = useRef(null);
  const act = (dir) => {
    const s = useStore.getState();
    if (!s.plan || (s.phase !== "cloud" && s.phase !== "journey") || s.chat.open) return;
    if (dir > 0) {
      if (s.level === 3) s.enter(s.focus);
      else if (s.level === 2) s.deeper();
    } else if (s.level < 3) s.setLevel(s.level + 1);
  };
  return (
    <div
      className="world"
      onWheel={(e) => {
        const w = wheel.current;
        const now = performance.now();
        if (now - w.last < 650) return;
        w.acc += e.deltaY;
        if (Math.abs(w.acc) > 90) {
          act(w.acc < 0 ? 1 : -1);
          w.acc = 0;
          w.last = now;
        }
      }}
      onTouchStart={(e) => {
        if (e.touches.length === 2) pinch.current = { d: Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY), fired: false };
      }}
      onTouchMove={(e) => {
        if (e.touches.length !== 2 || !pinch.current || pinch.current.fired) return;
        const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        const ratio = d / pinch.current.d;
        useStore.getState().setNudge(Math.max(-1, Math.min(1, (ratio - 1) * 1.5)));
        if (ratio > 1.3 || ratio < 0.75) {
          pinch.current.fired = true;
          useStore.getState().setNudge(0);
          act(ratio > 1 ? 1 : -1);
        }
      }}
      onTouchEnd={() => {
        pinch.current = null;
        useStore.getState().setNudge(0);
      }}
    >
      <Canvas flat dpr={[1, 1.75]} camera={{ fov: FOV, position: [0, 0, 26], near: 0.02, far: 120 }} gl={{ antialias: true, powerPreference: "high-performance" }}>
        <Scene />
      </Canvas>
    </div>
  );
}
