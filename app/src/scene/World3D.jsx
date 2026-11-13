// The 3D world: liquid-glass bubbles on white, pastel light behind them, and a real camera
// that travels between four fixed "floors" (city, building, floor, desk). All text and the
// mini apps live in the HTML layer above this canvas, so they stay selectable and readable.
import { Environment, Html, Lightformer, Line } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { easing } from "maath";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { STATUS_COLOR } from "../format.js";
import { computeLayout, DECOR } from "../layout.js";
import { useStore } from "../store.js";

const FOV = 35;
const TAN = Math.tan((FOV * Math.PI) / 360);
const formClock = { t: 0 };
const hover = { id: null };

function buildingDistance(layout, aspect) {
  const dV = layout.halfH / TAN;
  const dH = layout.halfW / (TAN * aspect);
  return Math.max(dV, dH) * 1.16 + 0.8;
}

function useBackdropTexture() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 640;
    const g = c.getContext("2d");
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, c.width, c.height);
    const blob = (x, y, r, color) => {
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, color);
      grd.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grd;
      g.fillRect(0, 0, c.width, c.height);
    };
    blob(260, 200, 300, "rgba(158,193,255,0.85)");
    blob(760, 190, 280, "rgba(255,194,217,0.75)");
    blob(330, 480, 270, "rgba(182,240,216,0.8)");
    blob(740, 470, 260, "rgba(255,225,168,0.8)");
    blob(520, 320, 200, "rgba(217,200,255,0.55)");
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
}

function Backdrop() {
  const tex = useBackdropTexture();
  const ref = useRef();
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    if (useStore.getState().reduced) return;
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

function Rig({ layout, decor }) {
  const { camera, size } = useThree();
  const look = useRef(new THREE.Vector3());
  useFrame((_, dt) => {
    const s = useStore.getState();
    const aspect = size.width / size.height;
    const d3 = buildingDistance(layout, aspect);
    const b = !decor && s.focus ? layout.byId[s.focus] : null;
    let p;
    let l;
    if (decor || s.level >= 3 || !b) {
      const d = decor ? d3 * 1.05 : s.level === 4 ? d3 * 1.85 : d3;
      const shift = decor && aspect > 1.2 ? -layout.halfW * 0.85 : 0;
      const early = s.phase === "calibrate" || s.phase === "forming";
      const lift = early ? -0.75 : s.level === 3 && !decor ? -0.5 : 0;
      p = [shift, lift, early ? d * 1.12 : d];
      l = [shift, lift, 0];
    } else if (s.level === 2) {
      const fill = aspect < 0.8 ? 0.7 : 0.9;
      const d = Math.max(b.r / (TAN * fill), b.r / (TAN * aspect * 0.98));
      p = [b.x, b.y, b.z + d];
      l = [b.x, b.y, b.z];
    } else {
      p = [b.x, b.y, b.z + b.r * 0.3];
      l = [b.x, b.y, b.z - b.r];
    }
    p[2] -= s.nudge * 1.4;
    easing.damp3(camera.position, p, s.reduced ? 0.0001 : 0.38, dt);
    easing.damp3(look.current, l, s.reduced ? 0.0001 : 0.3, dt);
    camera.lookAt(look.current);
  });
  return null;
}

function useShadowTexture() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(128, 128, 40, 128, 128, 128);
    grd.addColorStop(0, "rgba(40,60,110,0.34)");
    grd.addColorStop(0.55, "rgba(40,60,110,0.12)");
    grd.addColorStop(1, "rgba(40,60,110,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }, []);
}

function Glass({ r }) {
  return (
    <meshPhysicalMaterial
      color="#ffffff"
      transmission={1}
      thickness={r * 0.9}
      roughness={0.03}
      ior={1.17}
      dispersion={3}
      clearcoat={1}
      clearcoatRoughness={0.06}
      iridescence={0.18}
      iridescenceIOR={1.2}
      envMapIntensity={0.85}
      toneMapped={false}
    />
  );
}

function Bubble({ node, bubble, index, labelPx, labelFactor }) {
  const group = useRef();
  const inner = useRef();
  const ring = useRef();
  const shadow = useRef();
  const [hovered, setHovered] = useState(false);
  const phase = useStore((s) => s.phase);
  const level = useStore((s) => s.level);
  const focus = useStore((s) => s.focus);
  const tutorial = useStore((s) => s.tutorial);
  const missionBubble = useStore((s) => (s.plan && s.journeyDone ? s.currentMission()?.bubbleId : null));
  const clickable = bubble && level >= 3 && (phase === "cloud" || (phase === "calibrate" && tutorial === "enter"));
  const isStep = bubble && missionBubble === node.id;

  useFrame((st, dt) => {
    const s = useStore.getState();
    const t = st.clock.elapsedTime;
    const inside = s.level <= 2 && s.focus && s.plan;
    const focused = s.focus === node.id;
    let target = 1;
    if (s.phase === "forming") {
      const k = Math.min(1, Math.max(0, (formClock.t - 0.9 - index * 0.14) / 0.9));
      target = k * k * (3 - 2 * k) || 0.0001;
    } else if (inside && !focused) target = 0.0001;
    else if (hovered && clickable) target = 1.05;
    if (isStep && s.day >= 3 && s.level >= 3) target *= 0.86;
    easing.damp3(group.current.scale, [target, target, target], s.reduced ? 0.0001 : inside ? 0.22 : 0.3, dt);
    const float = inside || s.reduced ? 0 : 1;
    group.current.position.set(node.x + Math.cos(t * 0.45 + index) * 0.045 * float, node.y + Math.sin(t * 0.6 + index * 1.7) * 0.07 * float, node.z);
    if (inner.current) easing.damp(inner.current.material, "opacity", s.level === 1 && focused ? 0.55 : 0, 0.25, dt);
    if (shadow.current) shadow.current.visible = !(s.level === 1 && focused);
    if (ring.current) {
      const pulse = 1 + Math.sin(t * 2.2) * 0.012;
      ring.current.scale.set(pulse, pulse, pulse);
      ring.current.visible = s.level >= 3 && s.phase === "cloud";
    }
  });

  const shadowTex = useShadowTexture();
  const showLabel = bubble && level === 3 && (phase === "cloud" || phase === "calibrate");
  const px = node.r * labelPx;
  return (
    <group ref={group} position={[node.x, node.y, node.z]} scale={0.0001}>
      <mesh
        onClick={(e) => {
          if (!clickable) return;
          e.stopPropagation();
          useStore.getState().enter(node.id);
        }}
        onPointerOver={(e) => {
          if (!clickable) return;
          e.stopPropagation();
          setHovered(true);
          hover.id = node.id;
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          if (hover.id === node.id) hover.id = null;
          document.body.style.cursor = "";
        }}
      >
        <sphereGeometry args={[node.r, 72, 72]} />
        <Glass r={node.r} />
      </mesh>
      <mesh ref={shadow} position={[0, -node.r * 0.16, -node.r * 0.5]}>
        <planeGeometry args={[node.r * 2.7, node.r * 2.7]} />
        <meshBasicMaterial map={shadowTex} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={inner} scale={0.985}>
        <sphereGeometry args={[node.r, 48, 48]} />
        <meshBasicMaterial color="#ffffff" side={THREE.BackSide} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
      {isStep && (
        <mesh ref={ring}>
          <torusGeometry args={[node.r * 1.09, 0.022, 12, 120]} />
          <meshBasicMaterial color="#0071E3" transparent opacity={0.75} toneMapped={false} />
        </mesh>
      )}
      {showLabel && (
        <Html center distanceFactor={labelFactor} zIndexRange={[4, 0]} style={{ pointerEvents: "none" }}>
          <div className="b-label" style={{ width: px * 1.5, fontSize: Math.max(11.5, Math.min(17, px / 6.6)) }}>
            <div className="b-title">
              <i className="dot" style={{ background: STATUS_COLOR[bubble.status] }} />
              {bubble.title}
            </div>
            {px > 70 && <div className="b-sub">{bubble.building}</div>}
            {isStep && <div className="b-step">Your next step</div>}
          </div>
        </Html>
      )}
    </group>
  );
}

function Droplets({ layout }) {
  const ref = useRef();
  const count = 90;
  const seeds = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const n = layout.nodes[i % layout.nodes.length];
        const a = i * 2.39996;
        return {
          sx: Math.sin(i * 12.9898) * 7,
          sy: 7 + ((i * 7) % 11) * 0.35,
          sz: Math.cos(i * 4.1) * 1.5,
          tx: n.x + Math.cos(a) * n.r * 0.35,
          ty: n.y + Math.sin(a) * n.r * 0.35,
          tz: n.z,
          delay: (i % 30) * 0.035,
          size: 0.07 + ((i * 13) % 10) * 0.012,
        };
      }),
    [layout],
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame((_, dt) => {
    const s = useStore.getState();
    if (s.phase !== "forming") {
      ref.current.visible = false;
      return;
    }
    formClock.t += s.reduced ? 10 : dt;
    ref.current.visible = true;
    seeds.forEach((d, i) => {
      const k = Math.min(1, Math.max(0, (formClock.t - d.delay) / 1.5));
      const e = 1 - Math.pow(1 - k, 3);
      dummy.position.set(d.sx + (d.tx - d.sx) * e, d.sy + (d.ty - d.sy) * e - Math.sin(k * Math.PI) * 0.8, d.sz + (d.tz - d.sz) * e);
      const sc = d.size * (k < 0.85 ? 1 : Math.max(0, (1 - k) / 0.15));
      dummy.scale.setScalar(Math.max(sc, 0.0001));
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
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

function Links({ layout, links }) {
  const level = useStore((s) => s.level);
  const phase = useStore((s) => s.phase);
  if (level !== 3 || phase !== "cloud") return null;
  return links.map(([a, b]) => {
    const A = layout.byId[a];
    const B = layout.byId[b];
    if (!A || !B) return null;
    return <Line key={`${a}-${b}`} points={[[A.x, A.y, A.z - 0.2], [B.x, B.y, B.z - 0.2]]} color="#D3D8E2" lineWidth={1.1} dashed dashSize={0.14} gapSize={0.12} />;
  });
}

function Scene() {
  const plan = useStore((s) => s.plan);
  const { size } = useThree();
  const portrait = size.width / size.height < 0.85;
  const layout = useMemo(() => computeLayout(plan ? plan.bubbles : DECOR, portrait), [plan, portrait]);
  const d3 = buildingDistance(layout, size.width / size.height);
  const labelFactor = 2 * TAN * d3;
  const labelPx = size.height / (2 * TAN * d3);
  const phase = useStore((s) => s.phase);
  useEffect(() => {
    if (phase === "forming") formClock.t = 0;
  }, [phase, plan]);
  const byId = plan ? Object.fromEntries(plan.bubbles.map((b) => [b.id, b])) : {};
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
      <Rig layout={layout} decor={!plan} />
      {layout.nodes.map((n, i) => (
        <Bubble key={`${plan?.family || "decor"}-${n.id}`} node={n} bubble={byId[n.id]} index={i} labelPx={labelPx} labelFactor={labelFactor} />
      ))}
      {plan && <Links layout={layout} links={plan.links} />}
      {plan && <Droplets layout={layout} />}
    </>
  );
}

export default function World3D() {
  const wheel = useRef({ acc: 0, last: 0 });
  const pinch = useRef(null);
  const act = (dir) => {
    const s = useStore.getState();
    if (!s.plan || (s.phase !== "cloud" && s.phase !== "journey")) return;
    if (dir > 0) {
      if (s.level === 3 && hover.id) s.enter(hover.id);
      else if (s.level > 1) s.setLevel(s.level - 1);
    } else if (s.level < 4 && !(s.phase === "journey" && s.level >= 2)) s.setLevel(s.level + 1);
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
      <Canvas flat dpr={[1, 1.75]} camera={{ fov: FOV, position: [0, 0, 26], near: 0.05, far: 120 }} gl={{ antialias: true, powerPreference: "high-performance" }}>
        <Scene />
      </Canvas>
    </div>
  );
}
