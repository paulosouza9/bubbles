// The dashboard's 3D layer, fixed behind the page: a few glass bubbles drifting at the edges,
// the same glass as the plan world. Behind each plan card waits a small bubble in that
// household's colour that rises over the card when it is hovered or focused. Below the cards,
// the add button is a glass bubble with a blue plus inside it. Card bubbles and the add bubble
// follow their HTML anchors as the page scrolls and resizes, so 3D and cards never drift apart.
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { easing } from "maath";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Glass, Studio } from "./studio.jsx";

// The page colour; .phase-landing > .flat-bg uses the same value so canvas and page meet without a seam.
const DASH_BG = "#f0f3f8";

const FOV = 35;
const CAM_Z = 10;
const VIEW_H = 2 * CAM_Z * Math.tan((FOV * Math.PI) / 360); // world units visible top to bottom at z = 0

// Where an element sits on screen, in world units at z = 0.
function place(el, size) {
  const r = el.getBoundingClientRect();
  const u = VIEW_H / size.height;
  return { r, u, x: (r.left + r.width / 2 - size.width / 2) * u, y: -(r.top + r.height / 2 - size.height / 2) * u };
}

// ---- The drifting field ------------------------------------------------------------------

// Screen position (-1..1 left to right, -1..1 bottom to top), radius as a share of the screen
// height, and depth (0 near, 1 far). Far bubbles move less with scroll and pointer.
// Kept to the outer edges, away from all text: a few quiet bubbles, not a crowd.
const FIELD = [
  { x: -0.88, y: 0.38, r: 0.12, d: 0.6 },
  { x: -0.74, y: -0.66, r: 0.06, d: 0.4 },
  { x: 0.9, y: -0.56, r: 0.09, d: 0.45 },
]

function FieldBubble({ b, i, scroll, pointer, reduced }) {
  const ref = useRef();
  const { size } = useThree();
  useFrame(({ clock }, dt) => {
    const t = reduced ? 0 : clock.elapsedTime;
    const halfH = VIEW_H / 2;
    const halfW = halfH * (size.width / size.height);
    const near = 1 - b.d;
    const p = pointer.current;
    // Content scrolls at full speed; the field moves slower the further back it is.
    const sy = reduced ? 0 : scroll.current * (VIEW_H / size.height) * (0.12 + near * 0.3);
    const x = b.x * halfW + (reduced ? 0 : Math.sin(t * 0.13 + i * 2.1) * 0.12 + p.x * 0.18 * near);
    const y = b.y * halfH + sy + (reduced ? 0 : Math.sin(t * 0.21 + i * 1.3) * 0.16 + p.y * 0.12 * near);
    easing.damp3(ref.current.position, [x, y, -b.d * 2], reduced ? 0.0001 : 0.5, dt);
    // Sized to the screen height, but held back on portrait screens so a phone isn't all bubble.
    const fit = Math.max(0.45, Math.min(1, size.width / size.height / 1.4));
    ref.current.scale.setScalar(b.r * VIEW_H * (1 + b.d * 0.2) * fit);
    // A phone has no free margins: the field would only sit behind text, so it stays away.
    ref.current.visible = size.width > 560;
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[1, 64, 48]} />
      <Glass r={1} />
    </mesh>
  );
}

// ---- A bubble for the plan under the pointer ---------------------------------------------

// Each household has a small glass bubble with its colour inside, hidden behind its card.
// Hovering or focusing the card lifts it up through the frosted pane until it peeks over the
// top edge: the plan is about to become the bubble you step into. Leaving lets it sink back.
function CardBubble({ id, color, grid, hot, reduced }) {
  const group = useRef();
  const orb = useRef();
  const lift = useRef(0);
  const { size } = useThree();
  useFrame(({ clock }, dt) => {
    const card = grid.current?.querySelector(`[data-plan="${id}"]`);
    if (!card) return;
    easing.damp(lift, "current", hot ? 1 : 0, reduced ? 0.0001 : 0.22, dt);
    const k = lift.current;
    group.current.visible = k > 0.01;
    if (!group.current.visible) return;
    const { r, u, x } = place(card, size);
    const dPx = Math.min(110, r.width * 0.36);
    const t = reduced ? 0 : clock.elapsedTime;
    // From the middle of the card to half above its top edge.
    const cy = r.top + r.height / 2 + (r.top - dPx * 0.08 - (r.top + r.height / 2)) * k;
    group.current.position.set(x, -(cy - size.height / 2) * u + Math.sin(t * 1.2) * 0.02 * k, 0);
    group.current.scale.setScalar((dPx / 2) * u * (0.3 + 0.7 * k));
    group.current.rotation.y = reduced ? 0 : Math.sin(t * 0.4) * 0.25;
    orb.current.position.y = 0.22 + (reduced ? 0 : Math.sin(t * 1.6) * 0.05);
  });
  return (
    <group ref={group} visible={false}>
      <mesh ref={orb} scale={0.42}>
        <sphereGeometry args={[1, 40, 28]} />
        <meshPhysicalMaterial color={color} emissive={color} emissiveIntensity={0.12} roughness={0.14} clearcoat={1} clearcoatRoughness={0.05} envMapIntensity={1.1} toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[1, 64, 48]} />
        <Glass r={1} />
      </mesh>
    </group>
  );
}

// Flecks rising through a unit sphere.
function Fizz({ count = 24, reduced }) {
  const ref = useRef();
  const seeds = useMemo(() => Array.from({ length: count }, (_, i) => ({ x: Math.sin(i * 12.9898) * 0.6, y: ((i * 0.37) % 1) * 1.6 - 0.8, z: -0.45 + ((i * 0.61) % 1) * 0.7, s: 0.01 + ((i * 7) % 10) * 0.0024, v: 0.04 + ((i * 3) % 7) * 0.01 })), [count]);
  const d = useMemo(() => new THREE.Object3D(), []);
  useFrame(({ clock }) => {
    const t = reduced ? 0 : clock.elapsedTime;
    seeds.forEach((b, i) => {
      const y = ((b.y + t * b.v + 0.8) % 1.6) - 0.8;
      const lim = Math.sqrt(Math.max(0, 0.7 - y * y - b.z * b.z));
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
      <meshPhysicalMaterial color="#ffffff" transparent opacity={0.65} roughness={0.05} clearcoat={1} depthWrite={false} toneMapped={false} />
    </instancedMesh>
  );
}

// ---- The add bubble ------------------------------------------------------------------------

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

function AddBubble({ anchor, state, pointer, reduced }) {
  const group = useRef();
  const core = useRef();
  const mat = useRef();
  const spin = useRef(0);
  const { size } = useThree();
  const geometry = useMemo(() => {
    const g = new THREE.ExtrudeGeometry(plusShape(), { depth: 0.4, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 10, curveSegments: 16 });
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
    const radius = (Math.min(r.width, r.height) / 2) * u * 0.94;
    group.current.position.set(x, y + Math.sin(t * 1.1) * radius * 0.03, 0.5);
    // The bubble swells when files are dragged over it; the plus inside turns and goes green.
    easing.damp3(group.current.scale, radius * (active ? 1.1 : hover ? 1.05 : 1), 0.2, dt);
    spin.current += dt * (reduced ? 0 : active ? 2.4 : hover ? 0.9 : 0);
    const p = pointer.current;
    easing.damp(core.current.rotation, "y", spin.current + (reduced ? 0 : Math.sin(t * 0.6) * 0.35 + p.x * 0.3), 0.25, dt);
    easing.damp(core.current.rotation, "x", reduced ? 0 : Math.cos(t * 0.5) * 0.12 - p.y * 0.25, 0.25, dt);
    easing.dampC(mat.current.color, active ? green : blue, 0.25, dt);
  });
  return (
    <group ref={group}>
      <group ref={core}>
        <mesh geometry={geometry} scale={0.42}>
          <meshPhysicalMaterial ref={mat} color="#0a6cff" roughness={0.14} clearcoat={1} clearcoatRoughness={0.05} envMapIntensity={1.1} toneMapped={false} />
        </mesh>
      </group>
      <Fizz count={14} reduced={reduced} />
      <mesh>
        <sphereGeometry args={[1, 96, 64]} />
        <Glass r={1} />
      </mesh>
    </group>
  );
}

export default function DashWorld({ bubbleAnchor, plusAnchor, plusState, orbs, hot, reduced }) {
  const pointer = useRef({ x: 0, y: 0 });
  const scroll = useRef(0);
  useEffect(() => {
    const page = document.querySelector(".landing.dash");
    const move = (e) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    const onScroll = () => (scroll.current = page?.scrollTop || 0);
    window.addEventListener("pointermove", move, { passive: true });
    page?.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("pointermove", move);
      page?.removeEventListener("scroll", onScroll);
    };
  }, []);
  return (
    <div className="dash-world" aria-hidden="true">
      <Canvas dpr={[1, 1.75]} camera={{ fov: FOV, position: [0, 0, CAM_Z] }} gl={{ antialias: true }}>
        <color attach="background" args={[DASH_BG]} />
        <Studio />
        {FIELD.map((b, i) => (
          <FieldBubble key={i} b={b} i={i} scroll={scroll} pointer={pointer} reduced={reduced} />
        ))}
        {orbs.map((o) => (
          <CardBubble key={o.id} id={o.id} color={o.color} grid={bubbleAnchor} hot={hot === o.id} reduced={reduced} />
        ))}
        <AddBubble anchor={plusAnchor} state={plusState} pointer={pointer} reduced={reduced} />
      </Canvas>
    </div>
  );
}
