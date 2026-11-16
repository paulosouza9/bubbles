// The dashboard's 3D layer, fixed behind the page. One big glass bubble, the same glass as
// the plan world, sits behind the four plan cards so their frosted panes have something to
// blur; inside it one orb per household floats in that household's colour. Below, a glass
// plus sits behind the "add your documents" target. Both follow their HTML anchors as the
// page scrolls and resizes, so the 3D and the cards never drift apart.
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { easing } from "maath";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Glass, Studio } from "./studio.jsx";

const FOV = 35;
const CAM_Z = 10;
const VIEW_H = 2 * CAM_Z * Math.tan((FOV * Math.PI) / 360); // world units visible top to bottom at z = 0

// Where an element sits on screen, in world units at z = 0.
function place(el, size) {
  const r = el.getBoundingClientRect();
  const u = VIEW_H / size.height;
  return { r, u, x: (r.left + r.width / 2 - size.width / 2) * u, y: -(r.top + r.height / 2 - size.height / 2) * u };
}

// One orb per household, resting in the bubble's lower curve below the cards and in the
// same left-to-right order. The orb of the card under the pointer rises and comes forward.
function Orb({ i, n, color, hot, reduced }) {
  const ref = useRef();
  const mat = useRef();
  useFrame(({ clock }, dt) => {
    const t = reduced ? 0 : clock.elapsedTime;
    const x = (i - (n - 1) / 2) * 0.17;
    const bob = Math.sin(t * 0.9 + i * 1.7) * 0.018;
    easing.damp3(ref.current.position, [x, (hot ? -0.48 : -0.55) + bob, hot ? 0.28 : 0], reduced ? 0.0001 : 0.3, dt);
    easing.damp3(ref.current.scale, hot ? 0.1 : 0.07, reduced ? 0.0001 : 0.25, dt);
    easing.damp(mat.current, "emissiveIntensity", hot ? 0.3 : 0.06, 0.25, dt);
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[1, 40, 28]} />
      <meshPhysicalMaterial ref={mat} color={color} emissive={color} emissiveIntensity={0.08} roughness={0.14} clearcoat={1} clearcoatRoughness={0.05} envMapIntensity={1.1} toneMapped={false} />
    </mesh>
  );
}

function Fizz({ reduced }) {
  const ref = useRef();
  const count = 28;
  const seeds = useMemo(() => Array.from({ length: count }, (_, i) => ({ x: Math.sin(i * 12.9898) * 0.62, y: ((i * 0.37) % 1) * 1.6 - 0.8, z: -0.45 + ((i * 0.61) % 1) * 0.6, s: 0.008 + ((i * 7) % 10) * 0.0022, v: 0.03 + ((i * 3) % 7) * 0.008 })), []);
  const d = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }) => {
    const t = reduced ? 0 : clock.elapsedTime;
    seeds.forEach((b, i) => {
      const y = ((b.y + t * b.v + 0.8) % 1.6) - 0.8;
      // Keep every fleck inside the sphere it rises through.
      const lim = Math.sqrt(Math.max(0, 0.72 - y * y));
      d.position.set(Math.max(-lim, Math.min(lim, b.x + Math.sin(t * 0.6 + i) * 0.02)), y, b.z);
      d.scale.setScalar(b.s);
      d.updateMatrix();
      ref.current.setMatrixAt(i, d.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[null, null, count]} frustumCulled={false}>
      <sphereGeometry args={[1, 12, 12]} />
      <meshPhysicalMaterial color="#ffffff" transparent opacity={0.6} roughness={0.05} clearcoat={1} depthWrite={false} toneMapped={false} />
    </instancedMesh>
  );
}

function BigBubble({ anchor, spot, below, orbs, hot, reduced }) {
  const group = useRef();
  const { size } = useThree();
  useFrame(({ clock }) => {
    const t = reduced ? 0 : clock.elapsedTime;
    let x, cy, dPx, u;
    if (spot.current?.offsetHeight) {
      // Stacked cards (tablet, phone): the bubble gets its own space above them, whole.
      const p = place(spot.current, size);
      u = p.u;
      x = p.x;
      cy = p.r.top + p.r.height / 2;
      dPx = Math.min(p.r.height, size.width * 0.86);
    } else {
      // One row of cards: the bubble sits behind them, filling the room between the top of
      // the page and the glass plus, so it is never clipped at rest and never touches the plus.
      const el = anchor.current;
      if (!el) return;
      const p = place(el, size);
      u = p.u;
      x = p.x;
      const scrollTop = el.closest(".landing")?.scrollTop || 0;
      cy = p.r.top + p.r.height / 2;
      const rest = cy + scrollTop;
      const plusTop = below.current ? below.current.getBoundingClientRect().top + scrollTop : Infinity;
      dPx = Math.max(280, Math.min(600, size.width * 0.92, 2 * (rest - 56), 2 * (plusTop - rest - 12)));
    }
    group.current.position.set(x, -(cy - size.height / 2) * u + Math.sin(t * 0.5) * 0.04, 0);
    group.current.scale.setScalar((dPx / 2) * u);
    group.current.rotation.y = reduced ? 0 : Math.sin(t * 0.15) * 0.2;
  });
  return (
    <group ref={group}>
      {orbs.map((o, i) => (
        <Orb key={o.id} i={i} n={orbs.length} color={o.color} hot={hot === o.id} reduced={reduced} />
      ))}
      <Fizz reduced={reduced} />
      <mesh>
        <sphereGeometry args={[1, 96, 64]} />
        <Glass r={1} />
      </mesh>
    </group>
  );
}

function plusShape(a = 0.34, l = 1, c = 0.12) {
  const s = new THREE.Shape();
  const pts = [
    [-a, l], [a, l], [a, a], [l, a], [l, -a], [a, -a], [a, -l], [-a, -l], [-a, -a], [-l, -a], [-l, a], [-a, a],
  ];
  // Round the eight outer corners (the arm ends); the four inner corners stay crisp.
  const outer = new Set([0, 1, 3, 4, 6, 7, 9, 10]);
  pts.forEach((p, i) => {
    const prev = pts[(i + pts.length - 1) % pts.length];
    const next = pts[(i + 1) % pts.length];
    if (!outer.has(i)) return i === 0 ? s.moveTo(...p) : s.lineTo(...p);
    const toward = (q) => [p[0] + Math.sign(q[0] - p[0]) * c, p[1] + Math.sign(q[1] - p[1]) * c];
    const inP = toward(prev);
    const outP = toward(next);
    i === 0 ? s.moveTo(...inP) : s.lineTo(...inP);
    s.quadraticCurveTo(p[0], p[1], ...outP);
  });
  s.closePath();
  return s;
}

function GlassPlus({ anchor, state, pointer, reduced }) {
  const group = useRef();
  const mat = useRef();
  const spin = useRef(0);
  const { size } = useThree();
  const geometry = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(plusShape(), { depth: 0.42, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.11, bevelSegments: 12, curveSegments: 18 });
    g.center();
    return g;
  }, []);
  const blue = useMemo(() => new THREE.Color("#0a6cff"), []);
  const green = useMemo(() => new THREE.Color("#1fae4b"), []);
  useFrame(({ clock }, dt) => {
    const el = anchor.current;
    if (!el) return;
    const { r, u, x, y } = place(el, size);
    const { hover, over, busy } = state.current;
    const active = over || busy;
    const t = reduced ? 0 : clock.elapsedTime;
    spin.current += dt * (reduced ? 0 : active ? 2.4 : hover ? 0.8 : 0);
    const base = (Math.min(r.width, r.height) / 2) * u * 0.78;
    group.current.position.set(x, y + Math.sin(t * 1.1) * base * 0.04, 0.5);
    easing.damp3(group.current.scale, base * (active ? 1.12 : hover ? 1.06 : 1), 0.2, dt);
    const p = pointer.current;
    easing.damp(group.current.rotation, "y", spin.current + (reduced ? 0 : Math.sin(t * 0.6) * 0.3 + p.x * 0.3), 0.25, dt);
    easing.damp(group.current.rotation, "x", reduced ? 0 : Math.cos(t * 0.5) * 0.1 - p.y * 0.22, 0.25, dt);
    easing.dampC(mat.current.color, active ? green : blue, 0.25, dt);
  });
  return (
    <group ref={group}>
      {/* Glass outside, colour inside: a clear glass plus around a smaller solid one. */}
      <mesh geometry={geometry} scale={[0.64, 0.64, 0.45]}>
        <meshPhysicalMaterial ref={mat} color="#0a6cff" roughness={0.16} clearcoat={1} clearcoatRoughness={0.05} envMapIntensity={1.1} toneMapped={false} />
      </mesh>
      <mesh geometry={geometry}>
        <meshPhysicalMaterial color="#ffffff" transmission={1} thickness={0.7} roughness={0.03} ior={1.24} dispersion={2} clearcoat={1} clearcoatRoughness={0.04} iridescence={0.22} iridescenceIOR={1.2} envMapIntensity={1} toneMapped={false} />
      </mesh>
    </group>
  );
}

export default function DashWorld({ bubbleAnchor, bubbleSpot, plusAnchor, plusState, orbs, hot, reduced }) {
  const pointer = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const move = (e) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, []);
  return (
    <div className="dash-world" aria-hidden="true">
      <Canvas dpr={[1, 1.75]} camera={{ fov: FOV, position: [0, 0, CAM_Z] }} gl={{ antialias: true }}>
        <color attach="background" args={["#ffffff"]} />
        <Studio />
        <BigBubble anchor={bubbleAnchor} spot={bubbleSpot} below={plusAnchor} orbs={orbs} hot={hot} reduced={reduced} />
        <GlassPlus anchor={plusAnchor} state={plusState} pointer={pointer} reduced={reduced} />
      </Canvas>
    </div>
  );
}
