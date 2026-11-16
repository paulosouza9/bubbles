// Shared look for every glass bubble: the material and the soft studio light that gives
// the glass its pastel rims. The plan world and the dashboard both use these.
import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";

export function Glass({ r }) {
  return (
    <meshPhysicalMaterial color="#ffffff" transmission={1} thickness={r * 0.9} roughness={0.03} ior={1.17} dispersion={3} clearcoat={1} clearcoatRoughness={0.06} iridescence={0.18} iridescenceIOR={1.2} envMapIntensity={0.85} toneMapped={false} />
  );
}

export function Studio() {
  return (
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
  );
}
