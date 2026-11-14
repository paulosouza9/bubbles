// "Disintegrate": going deeper, the simple toy breaks into coloured particles that drift
// apart and settle into a flat sheet where the detailed charts are drawn. Coming back up,
// the sheet breaks apart and gathers into the middle while the simple toy grows back.
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const MAX = 900;
const queue = [];

const v = new THREE.Vector3();
const m4 = new THREE.Matrix4();
const im = new THREE.Matrix4();
const col = new THREE.Color();

// World-space points (and their colours) on everything visible inside `root`.
export function samplePoints(root, max = 700) {
  if (!root) return { points: [], colors: [] };
  root.updateWorldMatrix(true, true);
  const parts = [];
  let total = 0;
  root.traverse((o) => {
    if (!o.isMesh || !o.visible || !o.geometry?.attributes?.position) return;
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!mat || (mat.transparent && mat.opacity < 0.05)) return;
    let hidden = false;
    for (let p = o; p; p = p.parent) if (!p.visible) hidden = true;
    if (hidden) return;
    const n = o.geometry.attributes.position.count * (o.isInstancedMesh ? o.count : 1);
    parts.push({ o, mat, n });
    total += n;
  });
  const points = [];
  const colors = [];
  if (!total) return { points, colors };
  const stride = Math.max(1, Math.floor(total / max));
  for (const { o, mat } of parts) {
    const pos = o.geometry.attributes.position;
    const base = mat.color ? mat.color.clone() : new THREE.Color("#ffffff");
    if (mat.transparent && mat.opacity < 0.5) base.lerp(new THREE.Color("#ffffff"), 0.6);
    const instances = o.isInstancedMesh ? o.count : 1;
    for (let k = 0; k < instances; k++) {
      if (o.isInstancedMesh) {
        o.getMatrixAt(k, im);
        m4.multiplyMatrices(o.matrixWorld, im);
      } else m4.copy(o.matrixWorld);
      let c = base;
      if (o.isInstancedMesh && o.instanceColor) {
        o.getColorAt(k, col);
        c = col.clone();
      }
      // A random offset per mesh keeps the sampling from lining up into stripes.
      for (let i = Math.floor(Math.random() * stride); i < pos.count; i += stride) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m4);
        points.push(v.clone());
        colors.push(c);
      }
    }
  }
  // Keep it under the cap, evenly.
  if (points.length > max) {
    const keep = max / points.length;
    const p2 = [];
    const c2 = [];
    points.forEach((p, i) => {
      if (Math.random() < keep) {
        p2.push(p);
        c2.push(colors[i]);
      }
    });
    return { points: p2, colors: c2 };
  }
  return { points, colors };
}

// mode "out": from the toy to the chart sheet. mode "in": from the sheet to the middle.
export function dissolve(mode, sample) {
  if (import.meta.env.DEV) window.__dissolve = { mode, points: sample.points.length };
  queue.push({ mode, ...sample });
}

const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const easeOut = (k) => 1 - Math.pow(1 - k, 3);

export function DissolveParticles() {
  const ref = useRef();
  const { camera, size } = useThree();
  const parts = useRef([]);
  const d = useMemo(() => new THREE.Object3D(), []);
  const palette = useMemo(() => ["#0071E3", "#5856D6", "#30B0C7", "#AF52DE", "#FF9F0A", "#34C759"].map((c) => new THREE.Color(c)), []);

  // A point on the sheet where the charts appear, in front of the camera.
  const sheetPoint = (out) => {
    const dist = Math.max(0.6, camera.position.length() * 0.9);
    const h = Math.tan((camera.fov * Math.PI) / 360) * dist;
    const w = h * (size.width / size.height);
    out.set((Math.random() - 0.5) * w * 1.5, (Math.random() - 0.62) * h * 1.25, -dist).applyMatrix4(camera.matrixWorld);
    return out;
  };

  useFrame((_, dt) => {
    for (const job of queue.splice(0)) {
      parts.current = [];
      if (job.mode === "out") {
        const center = job.points.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / Math.max(1, job.points.length));
        job.points.forEach((p, i) => {
          const dir = p.clone().sub(center);
          if (dir.lengthSq() < 1e-6) dir.set(Math.random() - 0.5, Math.random() - 0.5, 0);
          dir.normalize().multiplyScalar(0.12 + Math.random() * 0.22);
          dir.z += (Math.random() - 0.3) * 0.12;
          parts.current.push({ from: p.clone(), drift: dir, to: sheetPoint(new THREE.Vector3()), color: job.colors[i], delay: Math.random() * 0.18, life: 1.35, size: 0.006 + Math.random() * 0.009 });
        });
      } else {
        const n = 520;
        const centre = new THREE.Vector3(0, -0.02, -Math.max(0.6, camera.position.length() * 0.9)).applyMatrix4(camera.matrixWorld);
        for (let i = 0; i < n; i++) {
          const from = sheetPoint(new THREE.Vector3());
          const to = centre.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.35, (Math.random() - 0.5) * 0.1));
          parts.current.push({ from, drift: new THREE.Vector3((Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.05, 0.04), to, color: palette[i % palette.length], delay: Math.random() * 0.15, life: 0.95, size: 0.005 + Math.random() * 0.008, gather: true });
        }
      }
    }
    const list = parts.current;
    let alive = 0;
    for (let i = 0; i < MAX; i++) {
      const p = list[i];
      if (!p) {
        d.scale.setScalar(0);
        d.updateMatrix();
        ref.current.setMatrixAt(i, d.matrix);
        continue;
      }
      p.t = (p.t || 0) + dt;
      const k = Math.min(1, Math.max(0, (p.t - p.delay) / p.life));
      if (k < 1) alive++;
      // First drift apart, then glide to the target.
      const scatter = easeOut(Math.min(1, k / 0.4));
      const glide = easeInOut(Math.min(1, Math.max(0, (k - 0.25) / 0.75)));
      d.position.copy(p.from).addScaledVector(p.drift, scatter * (1 - glide));
      d.position.lerp(p.to, glide);
      const fadeIn = Math.min(1, k / 0.08);
      const fadeOut = p.gather ? 1 - Math.pow(k, 3) : 1 - Math.pow(Math.max(0, (k - 0.55) / 0.45), 2);
      d.scale.setScalar(Math.max(0, p.size * fadeIn * fadeOut));
      d.updateMatrix();
      ref.current.setMatrixAt(i, d.matrix);
      ref.current.setColorAt(i, p.color);
    }
    if (!alive) parts.current = [];
    ref.current.visible = alive > 0;
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[null, null, MAX]} frustumCulled={false} visible={false}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}
