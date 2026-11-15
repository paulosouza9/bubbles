// The morph between the simple toy and the detailed charts. Going deeper, the toy breaks into
// particles that fly to the exact places where the charts are drawn (each bar, band, line and
// figure, in its own colour) and hand over to them as they land. Coming back up, the charts
// break into particles in their colours, which gather where the toy grows back.
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { getDetailCache, sampleDetail } from "../detailSample.js";
import { useStore } from "../store.js";

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

// mode "out": from the toy to the charts. mode "in": from the charts back to the toy.
export function dissolve(mode, sample) {
  if (import.meta.env.DEV) window.__dissolve = { mode, points: sample.points.length };
  // The way back starts from what the charts looked like on screen, captured while they were open.
  queue.push({ mode, ...sample, screen: mode === "in" ? getDetailCache() : null, tries: 0 });
}

const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const easeOut = (k) => 1 - Math.pow(1 - k, 3);
const SHEET = 1.0; // how far in front of the camera the charts' particles sit
const TOY = 1.24; // how far the toy is from the camera inside the bubble

export function DissolveParticles() {
  const ref = useRef();
  const { camera, size } = useThree();
  const parts = useRef([]);
  const d = useMemo(() => new THREE.Object3D(), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const palette = useMemo(() => ["#0071E3", "#5856D6", "#30B0C7", "#AF52DE", "#FF9F0A", "#34C759"].map((c) => new THREE.Color(c)), []);

  // A point on screen (CSS pixels) placed in the 3D world at a given distance from the camera.
  const toWorld = (px, py, dist, out) => {
    out.set((px / size.width) * 2 - 1, -(py / size.height) * 2 + 1, 0.5).unproject(camera);
    return out.sub(camera.position).normalize().multiplyScalar(dist).add(camera.position);
  };
  // Fallback when nothing could be measured: a loose sheet in front of the camera.
  const sheetPoint = (out) => toWorld(size.width * (0.15 + Math.random() * 0.7), size.height * (0.2 + Math.random() * 0.6), SHEET, out);
  // Chart colours, a little lighter so the dust reads soft; very dark ink becomes light grey.
  const white = useMemo(() => new THREE.Color("#ffffff"), []);
  const colour = (c) => {
    let out;
    try {
      out = new THREE.Color().setStyle(c);
    } catch {
      return palette[0].clone();
    }
    const hsl = {};
    out.getHSL(hsl);
    if (hsl.l < 0.35 && hsl.s < 0.25) return new THREE.Color("#b8b8c0");
    return out.lerp(white, 0.18);
  };

  useFrame((_, dt) => {
    if (useStore.getState().reduced) queue.length = 0;
    for (let q = queue.length - 1; q >= 0; q--) {
      const job = queue[q];
      if (job.mode === "out") {
        // The charts mount on the same click; wait a few frames for them to be laid out.
        const targets = sampleDetail();
        if (!targets.length && job.tries++ < 24) continue;
        queue.splice(q, 1);
        parts.current = [];
        const src = job.points.length ? job.points : [toWorld(size.width / 2, size.height / 2, TOY, new THREE.Vector3())];
        const n = Math.min(MAX, Math.max(targets.length, Math.min(src.length, 500)));
        const centre = src.reduce((acc, p) => acc.add(p), new THREE.Vector3()).multiplyScalar(1 / src.length);
        for (let i = 0; i < n; i++) {
          const from = src[i % src.length].clone();
          const t = targets.length ? targets[i % targets.length] : null;
          const drift = from.clone().sub(centre);
          if (drift.lengthSq() < 1e-6) drift.set(Math.random() - 0.5, Math.random() - 0.5, 0);
          drift.normalize().multiplyScalar(0.05 + Math.random() * 0.1);
          parts.current.push({
            from,
            drift,
            // Targets live on screen: they are placed again each frame, so they follow the camera.
            px: t ? t.x + (Math.random() - 0.5) * 1.5 : null,
            py: t ? t.y + (Math.random() - 0.5) * 1.5 : null,
            to: t ? null : sheetPoint(new THREE.Vector3()),
            dist: SHEET,
            color: t ? colour(t.colour) : job.colors[i % job.colors.length] || palette[i % palette.length],
            delay: Math.random() * 0.16,
            life: 1.45,
            size: 0.0014 + Math.random() * 0.0012,
          });
        }
      } else {
        queue.splice(q, 1);
        parts.current = [];
        const screen = job.screen?.length ? job.screen : null;
        const band = useStore.getState().toyBand;
        const bx = band ? band.left + (band.right - band.left) * 0.2 : size.width * 0.3;
        const bw = band ? (band.right - band.left) * 0.6 : size.width * 0.4;
        const by = band ? band.top + (band.bottom - band.top) * 0.25 : size.height * 0.35;
        const bh = band ? (band.bottom - band.top) * 0.5 : size.height * 0.3;
        const n = screen ? Math.min(MAX, screen.length) : 520;
        for (let i = 0; i < n; i++) {
          const sp = screen ? screen[i] : null;
          const from = sp ? toWorld(sp.x, sp.y, SHEET, new THREE.Vector3()) : sheetPoint(new THREE.Vector3());
          const to = toWorld(bx + Math.random() * bw, by + Math.random() * bh, TOY, new THREE.Vector3());
          parts.current.push({
            from,
            drift: new THREE.Vector3((Math.random() - 0.5) * 0.04, (Math.random() - 0.5) * 0.04, 0.03),
            to,
            color: sp ? colour(sp.colour) : palette[i % palette.length],
            delay: Math.random() * 0.12,
            life: 1.05,
            size: 0.0014 + Math.random() * 0.0012,
            gather: true,
          });
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
      // (Development only: window.__morphSlow = 8 plays the morph eight times slower, to inspect it.)
      p.t = (p.t || 0) + dt / (import.meta.env.DEV && window.__morphSlow ? window.__morphSlow : 1);
      const k = Math.min(1, Math.max(0, (p.t - p.delay) / p.life));
      if (k < 1) alive++;
      const target = p.px != null ? toWorld(p.px, p.py, p.dist, tmp) : p.to;
      if (p.gather) {
        // Back up: a short loosening, then everything gathers into the toy as it regrows.
        const scatter = easeOut(Math.min(1, k / 0.3));
        const glide = easeInOut(Math.min(1, Math.max(0, (k - 0.15) / 0.75)));
        d.position.copy(p.from).addScaledVector(p.drift, scatter * (1 - glide)).lerp(target, glide);
        const s = p.size * Math.min(1, k / 0.06) * (1 - Math.pow(Math.max(0, (k - 0.7) / 0.3), 2));
        d.scale.setScalar(Math.max(0, s));
      } else {
        // Down: loosen from the toy, glide into place (landing at about three quarters of the
        // way), hold for a beat while the charts appear underneath, then fade into them.
        const scatter = easeOut(Math.min(1, k / 0.25));
        const glide = easeInOut(Math.min(1, Math.max(0, (k - 0.12) / 0.62)));
        d.position.copy(p.from).addScaledVector(p.drift, scatter * (1 - glide)).lerp(target, glide);
        const fadeIn = Math.min(1, k / 0.06);
        const fadeOut = 1 - Math.pow(Math.max(0, (k - 0.8) / 0.2), 1.5);
        d.scale.setScalar(Math.max(0, p.size * fadeIn * fadeOut));
      }
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
