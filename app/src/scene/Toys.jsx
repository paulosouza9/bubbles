// The 3D toys that live inside each bubble. One per kind of topic. You play with them by
// tapping and dragging the objects themselves. Every figure comes from the plan data the toy
// is given; sizes and heights are only drawn in proportion.
//
// Local space: the visible area is about x -2.6..2.6, y -1.4..1.1 (text sits above and below).
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { easing } from "maath";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { projectedScore } from "../../shared/score.js";
import { sfx } from "../audio.js";
import { pct, usd, usdShort } from "../format.js";
import { useStore } from "../store.js";

const C = { blue: "#0071E3", red: "#FF3B30", amber: "#FF9F0A", green: "#34C759", ink: "#1D1D1F", grey: "#C7C7CC", purple: "#AF52DE", teal: "#30B0C7", indigo: "#5856D6" };
const PALETTE = [C.blue, C.indigo, C.teal, C.purple, C.amber, C.green];

// ---- shared bits ---------------------------------------------------------------------

export const bursts = { queue: [] };
const tmp = new THREE.Vector3();
export function burst(obj, color = C.blue, n = 16) {
  if (!obj) return;
  obj.getWorldPosition(tmp);
  bursts.queue.push({ p: tmp.clone(), color, n });
}

function T({ p, cls = "", children }) {
  return (
    <Html center position={p} zIndexRange={[6, 0]} style={{ pointerEvents: "none" }}>
      <div className={`t3 ${cls}`}>{children}</div>
    </Html>
  );
}

function Num({ v, f = usd }) {
  const [shown, setShown] = useState(v);
  const from = useRef(v);
  useEffect(() => {
    const a = from.current;
    const t0 = performance.now();
    let raf;
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / 650);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(a + (v - a) * e);
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = v;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [v]);
  return f(shown);
}

const Solid = ({ color, ...p }) => <meshStandardMaterial color={color} roughness={0.32} metalness={0.02} toneMapped={false} {...p} />;
const GlassLite = ({ opacity = 0.26 }) => <meshPhysicalMaterial color="#ffffff" transparent opacity={opacity} roughness={0.05} clearcoat={1} depthWrite={false} toneMapped={false} />;

// A glass tube that fills with coloured liquid.
function Tube({ x, y = -0.15, level, height = 1.7, radius = 0.24, color, onTap, selected }) {
  const liquid = useRef();
  const group = useRef();
  useFrame((st, dt) => {
    const h = Math.max(0.02, level) * height;
    easing.damp(liquid.current.scale, "y", h, 0.35, dt);
    liquid.current.position.y = -height / 2 + liquid.current.scale.y / 2;
    easing.damp3(group.current.scale, selected ? [1.12, 1.12, 1.12] : [1, 1, 1], 0.15, dt);
  });
  return (
    <group
      ref={group}
      position={[x, y, 0]}
      onClick={(e) => {
        e.stopPropagation();
        burst(group.current, color, 10);
        sfx("pop");
        onTap?.();
      }}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "")}
    >
      <mesh>
        <capsuleGeometry args={[radius, height - radius, 8, 28]} />
        <GlassLite />
      </mesh>
      <mesh ref={liquid} scale={[1, 0.02, 1]}>
        <cylinderGeometry args={[radius * 0.82, radius * 0.82, 1, 28]} />
        <Solid color={color} />
      </mesh>
    </group>
  );
}

function Orb({ p, r = 0.3, color = C.blue, onTap, pulse, children, glass }) {
  const ref = useRef();
  const [hot, setHot] = useState(false);
  useFrame((st, dt) => {
    const t = st.clock.elapsedTime;
    const base = hot ? 1.1 : 1;
    const s = base * (pulse ? 1 + Math.sin(t * 4) * 0.05 : 1);
    easing.damp3(ref.current.scale, [s, s, s], 0.12, dt);
    easing.damp3(ref.current.position, [p[0], p[1] + Math.sin(t * 1.3 + p[0] * 3) * 0.03, p[2] || 0], 0.25, dt);
  });
  return (
    <group
      ref={ref}
      position={p}
      onClick={(e) => {
        if (!onTap) return;
        e.stopPropagation();
        burst(ref.current, color);
        onTap();
      }}
      onPointerOver={() => {
        if (!onTap) return;
        setHot(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHot(false);
        document.body.style.cursor = "";
      }}
    >
      <mesh>
        <sphereGeometry args={[r, 40, 40]} />
        {glass ? <GlassLite opacity={0.4} /> : <Solid color={color} />}
      </mesh>
      {children}
    </group>
  );
}

// A ring gauge from 0 to 100 that starts at the top and runs clockwise.
function Arc({ value, radius = 1, tube = 0.1, color, opacity = 1, z = 0 }) {
  const shown = useRef(0);
  const mesh = useRef();
  const [step, setStep] = useState(0);
  useFrame((_, dt) => {
    easing.damp(shown, "current", value, 0.3, dt);
    const s = Math.round(shown.current * 2) / 2;
    if (s !== step) setStep(s);
  });
  const arc = Math.max(0.001, (step / 100) * Math.PI * 2);
  const geo = useMemo(() => new THREE.TorusGeometry(radius, tube, 16, 96, arc), [arc, radius, tube]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh ref={mesh} geometry={geo} rotation={[0, 0, Math.PI / 2 - arc]} position={[0, 0, z]}>
      <Solid color={color} transparent={opacity < 1} opacity={opacity} />
    </mesh>
  );
}

function Gauge({ score, projected, y = 0, r = 0.95 }) {
  const col = score < 60 ? C.red : score < 80 ? C.amber : C.green;
  return (
    <group position={[0, y, 0]}>
      <mesh>
        <torusGeometry args={[r, 0.1, 16, 96]} />
        <Solid color="#ECECF0" />
      </mesh>
      {projected > score && <Arc value={projected} radius={r} color={C.blue} opacity={0.45} z={0.01} />}
      <Arc value={score} radius={r} color={col} z={0.02} />
      <T p={[0, 0.02, 0.1]} cls="huge">
        <Num v={projected > score ? projected : score} f={(n) => Math.round(n)} />
        <small>{projected > score ? "projected" : "out of 100"}</small>
      </T>
    </group>
  );
}

// ---- Cash flow: pour your income into tubes --------------------------------------------
function BucketsToy({ data }) {
  const [poured, setPoured] = useState(false);
  const [sel, setSel] = useState(null);
  useEffect(() => {
    const t = setTimeout(() => {
      setPoured(true);
      sfx("whoosh");
    }, 700);
    return () => clearTimeout(t);
  }, []);
  const n = data.items.length;
  const max = Math.max(...data.items.map((i) => i.amount));
  const gap = Math.min(0.95, 4.6 / n);
  const short = data.free < 0;
  return (
    <group>
      <Orb
        p={[0, 0.98, 0]}
        r={0.2}
        color={C.ink}
        onTap={() => {
          setPoured(false);
          setTimeout(() => {
            setPoured(true);
            sfx("whoosh");
          }, 350);
        }}
      />
      <T p={[0.3, 0.98, 0]} cls="left">
        <b>Income {usd(data.income)}</b>
        <small>tap the ball to pour it again</small>
      </T>
      {data.items.map((it, i) => {
        const x = (i - (n - 1) / 2) * gap;
        return (
          <group key={it.name}>
            <Tube x={x} y={-0.25} height={1.55} level={poured ? it.amount / max : 0} color={PALETTE[i % PALETTE.length]} selected={sel === i} onTap={() => setSel(sel === i ? null : i)} />
            <T p={[x, -1.22, 0]} cls={sel === i ? "on" : ""}>
              {it.name}
              <b>{poured ? <Num v={it.amount} f={sel === i ? usd : usdShort} /> : "…"}</b>
            </T>
          </group>
        );
      })}
      <T p={[0, -1.72, 0]} cls={`verdict ${short ? "bad" : "good"}`}>
        {short ? "More goes out than comes in: " : "Left over after everything: "}
        <b>{usd(data.free)} a year</b>
      </T>
    </group>
  );
}

// ---- Emergency cushion: a tank that drains when you set goals aside ----------------------
function TankToy({ data }) {
  const [after, setAfter] = useState(false);
  const liquid = useRef();
  const hasGoals = data.nearTermGoals.length > 0 && Number.isFinite(data.monthsAfterGoals);
  const months = after ? data.monthsAfterGoals : data.months;
  const top = Math.max(data.maxMonths * 1.35, Math.min(data.months * 1.08, data.maxMonths * 3));
  const H = 2.2;
  const yOf = (m) => -1.3 + (Math.min(m, top) / top) * H;
  const ok = months >= data.minMonths;
  useFrame((st, dt) => {
    const h = Math.max(0.03, (Math.min(months, top) / top) * H);
    easing.damp(liquid.current.scale, "y", h, 0.4, dt);
    liquid.current.position.y = -1.3 + liquid.current.scale.y / 2 + Math.sin(st.clock.elapsedTime * 2) * 0.008;
  });
  return (
    <group>
      <mesh position={[0, -0.1, 0]}>
        <capsuleGeometry args={[0.6, H - 0.6, 8, 32]} />
        <GlassLite />
      </mesh>
      <mesh ref={liquid} scale={[1, 0.03, 1]}>
        <cylinderGeometry args={[0.5, 0.5, 1, 32]} />
        <Solid color={ok ? C.green : months > 0 ? C.amber : C.red} />
      </mesh>
      {[data.minMonths, data.maxMonths].map((m) => (
        <mesh key={m} position={[0, yOf(m), 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.64, 0.014, 8, 64]} />
          <Solid color={C.ink} />
        </mesh>
      ))}
      <T p={[0.78, yOf(data.minMonths), 0]} cls="left small">{data.minMonths} months</T>
      <T p={[0.78, yOf(data.maxMonths), 0]} cls="left small">{data.maxMonths} months</T>
      <T p={[1.75, 0.25, 0]} cls="left">
        <span className="huge-inline">
          <Num v={months} f={(n) => n.toFixed(1).replace(/\.0$/, "")} />
        </span>
        <b>months of expenses</b>
        <small>
          recommended {data.minMonths} to {data.maxMonths} · {usd(data.cash)} you can reach
        </small>
      </T>
      {hasGoals &&
        data.nearTermGoals.map((g, i) => (
          <group key={g.label}>
            <Orb
              p={[-1.5, 0.45 - i * 0.75, 0]}
              r={0.2}
              color={after ? C.amber : C.grey}
              pulse={!after}
              onTap={() => {
                setAfter(!after);
                sfx(after ? "pop" : "whoosh");
              }}
            />
            <T p={[-1.78, 0.45 - i * 0.75, 0]} cls="right">
              {g.label}
              <b>{usd(g.amount)}</b>
            </T>
          </group>
        ))}
      {hasGoals && (
        <T p={[0, -1.72, 0]} cls={after ? "verdict bad" : "small"}>
          {after ? `With those goals set aside, your cash target is ${usd(data.totalMin)} to ${usd(data.totalMax)}.` : "Tap a goal to set its money aside and watch the tank."}
        </T>
      )}
    </group>
  );
}

// ---- Retirement: slide along the years -----------------------------------------------
function TimelineToy({ data }) {
  const n = data.years.length;
  const firstAge = data.years[0].age;
  const retireIdx = Math.max(0, data.years.findIndex((y) => y.year >= data.retireYear));
  const outIdx = data.runsOutAge ? data.years.findIndex((_, k) => firstAge + k >= data.runsOutAge) : -1;
  const [i, setI] = useState(0);
  const touched = useRef(false);
  const popped = useRef(false);
  const bars = useRef();
  const marble = useRef();
  const group = useRef();
  const max = Math.max(...data.years.map((y) => Math.max(0, y.savings)));
  const W = 4.8;
  const xOf = (k) => -W / 2 + (k / (n - 1)) * W;
  const hOf = (k) => Math.max(0.03, (Math.max(0, data.years[k].savings) / max) * 1.75);
  const base = -1.05;
  useEffect(() => {
    const d = new THREE.Object3D();
    const col = new THREE.Color();
    for (let k = 0; k < n; k++) {
      const h = hOf(k);
      d.position.set(xOf(k), base + h / 2, 0);
      d.scale.set((W / n) * 0.72, h, 0.16);
      d.updateMatrix();
      bars.current.setMatrixAt(k, d.matrix);
      bars.current.setColorAt(k, col.set(outIdx >= 0 && k >= outIdx ? C.red : k === retireIdx ? C.ink : C.blue));
    }
    bars.current.instanceMatrix.needsUpdate = true;
    bars.current.instanceColor.needsUpdate = true;
  }, [data]);
  // Plays once on its own, until you touch it.
  useEffect(() => {
    let raf;
    const t0 = performance.now() + 600;
    const tick = (t) => {
      if (touched.current) return;
      const k = Math.min(n - 1, Math.max(0, Math.floor(((t - t0) / 5200) * (n - 1))));
      setI(k);
      if (k < n - 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [data]);
  useEffect(() => {
    if (outIdx >= 0 && i >= outIdx && !popped.current) {
      popped.current = true;
      burst(marble.current, C.red, 26);
      sfx("pop");
    }
    if (outIdx >= 0 && i < outIdx) popped.current = false;
  }, [i]);
  useFrame((_, dt) => easing.damp3(marble.current.position, [xOf(i), base + hOf(i) + 0.13, 0.05], 0.08, dt));
  const scrub = (e) => {
    e.stopPropagation();
    touched.current = true;
    const local = group.current.worldToLocal(e.point.clone());
    setI(Math.max(0, Math.min(n - 1, Math.round(((local.x + W / 2) / W) * (n - 1)))));
  };
  const yr = data.years[i];
  const ranOut = outIdx >= 0 && i >= outIdx;
  return (
    <group ref={group}>
      <instancedMesh ref={bars} args={[null, null, n]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.35} toneMapped={false} />
      </instancedMesh>
      <mesh ref={marble}>
        <sphereGeometry args={[0.1, 32, 32]} />
        <Solid color={ranOut ? C.red : "#ffffff"} emissive={ranOut ? C.red : C.blue} emissiveIntensity={0.35} />
      </mesh>
      <mesh position={[0, -0.1, 0.2]} onPointerMove={scrub} onPointerDown={scrub}>
        <planeGeometry args={[W + 0.6, 2.5]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {data.goals.map((g) => {
        const k = data.years.findIndex((y) => y.year === g.year);
        return k < 0 ? null : (
          <mesh key={g.name} position={[xOf(k), base - 0.1, 0.1]}>
            <sphereGeometry args={[0.05, 16, 16]} />
            <Solid color={C.amber} />
          </mesh>
        );
      })}
      <T p={[xOf(i), base + hOf(i) + 0.55, 0]} cls={ranOut ? "bad" : ""}>
        <small>
          {yr.year} · {data.personName} is {firstAge + i}
        </small>
        <span className="big-inline">{ranOut ? "Savings have run out" : usdShort(yr.savings)}</span>
      </T>
      <T p={[xOf(retireIdx), base - 0.28, 0]} cls="small">retire</T>
      {outIdx >= 0 && <T p={[xOf(outIdx) + 0.25, base - 0.28, 0]} cls="small bad">runs out at {data.runsOutAge}</T>}
      <T p={[0, -1.72, 0]} cls="small">
        Slide across the years. Net worth here, in today's dollars: <b>{usdShort(yr.netWorthToday)}</b>
        {data.goals.filter((g) => g.year === yr.year).map((g) => ` · ${g.name}`)}
      </T>
    </group>
  );
}

// ---- Debt: the hotter the ball, the more it costs -----------------------------------------
function DebtsToy({ data }) {
  const [sel, setSel] = useState(null);
  const rows = [...data.debts].sort((a, b) => b.rate - a.rate);
  if (!rows.length)
    return (
      <group>
        <Orb p={[0, 0, 0]} r={0.7} color={C.green} />
        <T p={[0, -1.2, 0]} cls="verdict good">You have no debt in your plan.</T>
      </group>
    );
  const max = Math.max(...rows.map((d) => d.balance));
  const rs = rows.map((d) => 0.28 + 0.5 * Math.sqrt(d.balance / max));
  const total = rs.reduce((s, r) => s + r * 2 + 0.35, -0.35);
  let x = -total / 2;
  return (
    <group>
      {rows.map((d, i) => {
        const r = rs[i];
        const cx = x + r;
        x += r * 2 + 0.35;
        const color = d.rate >= 0.15 ? C.red : d.rate >= 0.07 ? C.amber : C.blue;
        return (
          <group key={d.name}>
            <Orb
              p={[cx, -0.1, 0]}
              r={r}
              color={color}
              pulse={d.rate >= 0.15}
              onTap={() => {
                setSel(sel === i ? null : i);
                sfx("pop");
              }}
            />
            <T p={[cx, -0.1, r + 0.05]} cls="onball">{pct(d.rate, 1)}</T>
            <T p={[cx, -0.1 - r - 0.38, 0]} cls={sel === i ? "on" : ""}>
              {d.name}
              <b>{usd(d.balance)}</b>
              {sel === i && <small>{usd(d.monthly)} a month</small>}
            </T>
          </group>
        );
      })}
      <T p={[0, -1.72, 0]} cls="small">
        The number on each ball is its interest rate. Size is how much you owe.{data.cardPayoff ? ` The card is projected to be paid off by ${data.cardPayoff}.` : ""}
      </T>
    </group>
  );
}

// ---- Protection: grow the umbrella ---------------------------------------------------------
function CoverageToy({ data }) {
  const [rec, setRec] = useState(false);
  const dome = useRef();
  const u = data.umbrella;
  const people = [...data.people.map((p) => ({ name: p.name, big: true })), ...data.dependants.map((name) => ({ name, big: false }))];
  const span = Math.max(0.8, (people.length * 0.6) / 2 + 0.35);
  const ratio = rec ? 1 : u.recommended ? Math.min(1, u.current / u.recommended) : 1;
  useFrame((_, dt) => {
    const s = (0.22 + ratio * 0.78) * span;
    easing.damp3(dome.current.scale, [s, s * 0.8, s], 0.3, dt);
  });
  const toggle = () => {
    setRec(!rec);
    sfx(rec ? "pop" : "ding");
    burst(dome.current, C.blue, 22);
  };
  return (
    <group position={[0, people.length <= 2 ? -0.05 : -0.15, 0]} scale={people.length <= 2 ? 1.3 : 1}>
      <mesh ref={dome} position={[0, -0.1, 0]} onClick={(e) => (e.stopPropagation(), toggle())} onPointerOver={() => (document.body.style.cursor = "pointer")} onPointerOut={() => (document.body.style.cursor = "")}>
        <sphereGeometry args={[1, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshPhysicalMaterial color={ratio >= 1 ? C.blue : ratio > 0 ? C.amber : C.grey} transparent opacity={0.42} roughness={0.1} clearcoat={1} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
      {people.map((p, k) => {
        const px = (k - (people.length - 1) / 2) * 0.6;
        const h = p.big ? 0.5 : 0.32;
        return (
          <group key={p.name} position={[px, -0.95, 0]}>
            <mesh position={[0, h / 2, 0]}>
              <capsuleGeometry args={[p.big ? 0.13 : 0.1, h - 0.2, 6, 16]} />
              <Solid color={C.ink} />
            </mesh>
            <mesh position={[0, h + 0.14, 0]}>
              <sphereGeometry args={[p.big ? 0.12 : 0.09, 20, 20]} />
              <Solid color={C.ink} />
            </mesh>
            <T p={[0, -0.16, 0]} cls="small">{p.name}</T>
          </group>
        );
      })}
      <T p={[0, 1.02, 0]}>
        <small>Umbrella liability cover · tap the umbrella</small>
        <span className="big-inline">{rec ? usd(u.recommended) : u.current ? usd(u.current) : "None"}</span>
        <small>{rec ? "what your plan recommends" : `today · plan recommends ${usd(u.recommended)}`}</small>
      </T>
      <T p={[0, -1.6, 0]} cls="small">
        {data.people.map((p) => (
          <span key={p.name} className="block">
            Life insurance, {p.name}: <b>{usd(p.coverage)}</b> · recommended {usd(p.min)} to {usd(p.max)}
          </span>
        ))}
      </T>
    </group>
  );
}

// ---- College ---------------------------------------------------------------------------------
function CollegeToy({ data }) {
  const [sel, setSel] = useState(0);
  const n = data.kids.length;
  return (
    <group>
      {data.kids.map((k, i) => {
        const x = (i - (n - 1) / 2) * 1.7;
        return (
          <group key={k.name}>
            <Tube x={x} y={-0.2} height={1.6} radius={0.3} level={Math.max(0.02, k.saved / k.needed)} color={C.green} selected={sel === i} onTap={() => setSel(i)} />
            <T p={[x, 0.95, 0]}>
              <span className="big-inline">
                <Num v={k.gap} />
              </span>
              <small>still to fund</small>
            </T>
            <T p={[x, -1.25, 0]} cls={sel === i ? "on" : ""}>
              {k.name}, {k.age}
              <small>{sel === i ? `starts ${k.starts} · ${usd(k.saved)} saved of ${usd(k.needed)}` : "tap for details"}</small>
            </T>
          </group>
        );
      })}
      <T p={[0, -1.75, 0]} cls="small">
        Together: <b>{usd(data.totalGap)}</b> still to fund · {usd(data.saved)} in 529 accounts, {usd(data.yearly)} a year going in
      </T>
    </group>
  );
}

// ---- Investments: today's mix against the target ----------------------------------------------
function Ring({ mix, radius, tube, dim }) {
  const parts = [
    ["equity", C.blue],
    ["fixedIncome", C.teal],
    ["cash", C.amber],
  ];
  let start = Math.PI / 2;
  return parts.map(([k, color]) => {
    const arc = Math.max(0.001, mix[k] * Math.PI * 2 - 0.05);
    const rot = start - arc;
    start -= mix[k] * Math.PI * 2;
    return (
      <mesh key={k} rotation={[0, 0, rot]}>
        <torusGeometry args={[radius, tube, 16, 64, arc]} />
        <Solid color={color} transparent opacity={dim ? 0.3 : 1} />
      </mesh>
    );
  });
}
function AllocationToy({ data }) {
  const [view, setView] = useState("today");
  const g = useRef();
  if (!data.current || !data.target) return null;
  const mix = view === "today" ? data.current : data.target;
  const flip = () => {
    setView(view === "today" ? "target" : "today");
    sfx("pop");
    burst(g.current, C.blue);
  };
  return (
    <group ref={g} position={[0, -0.15, 0]}>
      <group onClick={(e) => (e.stopPropagation(), flip())} onPointerOver={() => (document.body.style.cursor = "pointer")} onPointerOut={() => (document.body.style.cursor = "")}>
        <Ring mix={data.current} radius={0.82} tube={0.12} dim={view !== "today"} />
        <Ring mix={data.target} radius={1.16} tube={0.07} dim={view !== "target"} />
        <mesh>
          <circleGeometry args={[1.3, 48]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
      <T p={[0, 0, 0.1]}>
        <small>{view === "today" ? "Your mix today" : "Target in your plan"}</small>
        <span className="big-inline">{pct(mix.equity)} stocks</span>
        <small>
          {pct(mix.fixedIncome)} bonds · {pct(mix.cash)} cash
        </small>
      </T>
      <T p={[0, -1.55, 0]} cls="small">Inner ring: today. Outer ring: the target. Tap the rings to switch.</T>
    </group>
  );
}

// ---- Score: feed the ring ------------------------------------------------------------------
function ScoreToy({ data }) {
  const [on, setOn] = useState([]);
  const g = useRef();
  const plan = { score: { value: data.score }, moves: data.moves, combinedMoves: data.combined };
  const proj = projectedScore(plan, on);
  const n = data.moves.length;
  return (
    <group ref={g}>
      <Gauge score={data.score} projected={proj.score} y={0.05} r={0.9} />
      {data.moves.map((m, i) => {
        const active = on.includes(m.id);
        const x = (i - (n - 1) / 2) * 1.75;
        return (
          <group key={m.id}>
            <Orb
              p={active ? [x * 0.42, 0.05, 0.25] : [x, -1.2, 0]}
              r={active ? 0.13 : 0.2}
              color={active ? C.green : C.blue}
              pulse={!active && !on.length}
              onTap={() => {
                setOn(active ? on.filter((id) => id !== m.id) : [...on, m.id]);
                sfx(active ? "pop" : "ding");
                burst(g.current, C.green, 24);
              }}
            />
            <T p={[x, -1.58, 0]} cls={`small ${active ? "on" : ""}`}>
              <b>{m.title}</b>
              <span className="block">
                on its own: {m.score_before} to {m.score_after}
              </span>
            </T>
          </group>
        );
      })}
      {proj.basis === "combined" && <T p={[0, 1.2, 0]} cls="small">Together, Sherpas scores these at {proj.score}.</T>}
      {proj.basis === "best-single" && <T p={[0, 1.2, 0]} cls="small">Sherpas has not scored this exact combination. Showing the best single step.</T>}
    </group>
  );
}

// ---- Your next steps: the month ring and its three missions ------------------------------------
function StepsToy() {
  const tab = useStore((s) => s.monthTab);
  const plan = useStore((s) => s.plan);
  const active = useStore((s) => s.missions.active);
  const status = useStore((s) => s.missions.status);
  const openDecision = useStore((s) => s.openDecision);
  const proj = useStore((s) => s.projected().score);
  const pulse = useRef();
  useFrame((st) => {
    if (!pulse.current) return;
    pulse.current.children.forEach((m, i) => {
      const k = 1 + Math.sin(st.clock.elapsedTime * 2.4 - i * 0.7) * 0.06;
      m.scale.set(k, k, k);
    });
  });
  if (tab === "podcast")
    return (
      <group ref={pulse} position={[0, 0.25, 0]}>
        {[0.45, 0.7, 0.95].map((r, i) => (
          <mesh key={r}>
            <torusGeometry args={[r, 0.035, 12, 80]} />
            <Solid color={[C.blue, C.purple, C.teal][i]} transparent opacity={0.8 - i * 0.2} />
          </mesh>
        ))}
        <mesh>
          <sphereGeometry args={[0.22, 32, 32]} />
          <Solid color={C.ink} />
        </mesh>
      </group>
    );
  if (tab !== "missions") return null;
  const list = active.map((id) => plan.missionPool.find((m) => m.id === id)).filter(Boolean);
  const n = list.length;
  return (
    <group>
      <Gauge score={plan.score.value} projected={proj} y={0.25} r={0.78} />
      {list.map((m, i) => {
        const st = status[m.id] || "todo";
        const x = (i - (n - 1) / 2) * 1.75;
        return (
          <group key={m.id}>
            <Orb
              p={[x, -1.02, 0]}
              r={0.22}
              color={st === "done" ? C.green : st === "active" ? C.blue : C.grey}
              pulse={st !== "done" && i === list.findIndex((q) => (status[q.id] || "todo") !== "done")}
              onTap={() => {
                sfx("pop");
                openDecision(m.id);
              }}
            />
            {st === "done" && <T p={[x, -1.02, 0.25]} cls="onball">✓</T>}
            <T p={[x, -1.52, 0]} cls="small mission-t">
              <span className="kind">{m.type === "understand" ? "Understand" : m.type === "quick" ? "Quick" : "Important"} · {m.minutes} min</span>
              <b>{m.title}</b>
            </T>
          </group>
        );
      })}
    </group>
  );
}

// ---- The figures: every fact is a small bubble you can tap ---------------------------------------
export function FactOrbs({ desks }) {
  const fact = useStore((s) => s.fact);
  const setFact = useStore((s) => s.setFact);
  const n = desks.length;
  const rows = n > 10 ? 3 : n > 4 ? 2 : 1;
  const cols = Math.ceil(n / rows);
  const gx = Math.min(1.05, 5 / cols);
  const gy = rows === 3 ? 0.85 : 1.05;
  const r = Math.min(0.42, gx * 0.4, gy * 0.4);
  return (
    <group position={[0, -0.25, 0]}>
      {desks.map((d, i) => {
        const row = Math.floor(i / cols);
        const inRow = Math.min(cols, n - row * cols);
        const x = (i - row * cols - (inRow - 1) / 2) * gx;
        const y = ((rows - 1) / 2 - row) * gy;
        return (
          <group key={i}>
            <Orb
              p={[x, y, 0]}
              r={fact === i ? r * 1.15 : r}
              glass
              color={C.blue}
              onTap={() => {
                setFact(fact === i ? null : i);
                sfx("pop");
              }}
            />
            <T p={[x, y, r]} cls={`fact ${fact === i ? "on" : ""}`}>
              <span style={{ width: `${r * 36}vmin` }}>{d.value}</span>
            </T>
          </group>
        );
      })}
    </group>
  );
}

const MAP = { buckets: BucketsToy, tank: TankToy, timeline: TimelineToy, debts: DebtsToy, coverage: CoverageToy, college: CollegeToy, allocation: AllocationToy, score: ScoreToy, steps: StepsToy };

export default function Toy({ bubble }) {
  const Cmp = MAP[bubble.miniapp.template];
  return Cmp ? <Cmp data={bubble.miniapp.data} /> : null;
}
