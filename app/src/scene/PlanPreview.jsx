import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { easing } from "maath";
import { useRef, useState } from "react";
import { useStore } from "../store.js";

// A small, self-contained view of the same glass world as the plan. The shapes
// describe savings, growth and protection; they never stand in for plan figures.
function PreviewBubble({ position, radius, color, reduced, phase, children }) {
  const group = useRef();
  useFrame(({ clock }, dt) => {
    const t = reduced ? 0 : clock.elapsedTime;
    easing.damp(group.current.position, "y", position[1] + Math.sin(t * 0.5 + phase) * (reduced ? 0 : 0.07), 0.3, dt);
    group.current.rotation.y = reduced ? 0 : Math.sin(t * 0.2 + phase) * 0.12;
  });
  return (
    <group ref={group} position={position}>
      {children}
      <mesh>
        <sphereGeometry args={[radius, 48, 32]} />
        <meshPhysicalMaterial color={color} transmission={0.94} thickness={0.35} attenuationColor={color} attenuationDistance={0.7} roughness={0.08} ior={1.12} clearcoat={1} iridescence={0.24} envMapIntensity={1.1} />
      </mesh>
    </group>
  );
}

function CoinStack({ x, count }) {
  return Array.from({ length: count }, (_, i) => (
    <mesh key={i} position={[x, -0.55 + i * 0.13, 0]}>
      <cylinderGeometry args={[0.24, 0.24, 0.09, 40]} />
      <meshStandardMaterial color="#407d67" metalness={0.5} roughness={0.26} />
    </mesh>
  ));
}

function Sculpture({ turn, reduced }) {
  const group = useRef();
  useFrame((_, dt) => {
    easing.damp(group.current.rotation, "y", turn, reduced ? 0.0001 : 0.25, dt);
  });
  return (
    <group ref={group}>
      <PreviewBubble position={[0, 0.1, 0]} radius={1.08} color="#effaf6" reduced={reduced} phase={0}>
        <group rotation={[0, -0.4, 0]}>
          <CoinStack x={-0.3} count={4} />
          <CoinStack x={0.3} count={7} />
        </group>
      </PreviewBubble>
      <PreviewBubble position={[-1.65, -0.28, 0.32]} radius={0.68} color="#edf4ff" reduced={reduced} phase={2}>
        <group rotation={[0, -0.25, 0]}>
          {[0.28, 0.48, 0.75].map((height, i) => (
            <mesh key={i} position={[(i - 1) * 0.23, -0.28 + height / 2, 0]}>
              <boxGeometry args={[0.15, height, 0.2]} />
              <meshStandardMaterial color="#497bb3" metalness={0.2} roughness={0.24} />
            </mesh>
          ))}
        </group>
      </PreviewBubble>
      <PreviewBubble position={[1.5, 0.65, -0.28]} radius={0.62} color="#fff7eb" reduced={reduced} phase={4}>
        <group rotation={[0.25, -0.4, 0]}>
          {[0.19, 0.34].map((radius) => (
            <mesh key={radius}>
              <torusGeometry args={[radius, 0.045, 12, 48]} />
              <meshStandardMaterial color="#ad7940" metalness={0.5} roughness={0.28} />
            </mesh>
          ))}
          <mesh>
            <sphereGeometry args={[0.075, 20, 16]} />
            <meshStandardMaterial color="#ad7940" metalness={0.5} roughness={0.28} />
          </mesh>
        </group>
      </PreviewBubble>
    </group>
  );
}

export default function PlanPreview() {
  const reduced = useStore((s) => s.reduced);
  const [turn, setTurn] = useState(0);
  return (
    <figure className="plan-preview" aria-label="Interactive 3D preview: glass bubbles containing savings, growth and protection symbols">
      <div className="preview-canvas" aria-hidden="true">
        <Canvas dpr={[1, 1.5]} camera={{ fov: 34, position: [0, 0.5, 5.6] }} gl={{ antialias: true, alpha: true }}>
          <ambientLight intensity={0.7} />
          <Environment resolution={128} frames={1}>
            <Lightformer form="rect" intensity={4} position={[-3, 4, 4]} scale={[4, 5, 1]} target={[0, 0, 0]} />
            <Lightformer form="rect" intensity={2} position={[4, 1, 2]} scale={[2, 4, 1]} target={[0, 0, 0]} />
            <Lightformer form="circle" intensity={1} color="#e2efff" position={[0, 3, -3]} scale={5} target={[0, 0, 0]} />
          </Environment>
          <Sculpture turn={turn} reduced={reduced} />
          <ContactShadows position={[0, -1.1, 0]} opacity={0.18} scale={8} blur={2.5} far={4} resolution={128} frames={1} />
          <OrbitControls enableZoom={false} enablePan={false} minPolarAngle={Math.PI / 3} maxPolarAngle={Math.PI / 1.9} />
        </Canvas>
      </div>
      <figcaption>
        <span>Drag to explore your plan’s world</span>
        <div className="preview-controls">
          {[-1, 1].map((direction) => (
            <button key={direction} className="icon-btn" onClick={() => setTurn((value) => value + direction * Math.PI / 4)} aria-label={`Rotate preview ${direction < 0 ? "left" : "right"}`}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={direction < 0 ? "m10 5-7 7 7 7M3 12h18" : "m14 5 7 7-7 7M21 12H3"} />
              </svg>
            </button>
          ))}
        </div>
      </figcaption>
    </figure>
  );
}
