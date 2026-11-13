// The mini apps that live inside each bubble. Solid and colourful (the glass stays outside).
// Every figure they show comes from the plan data they are given: none of them calculates
// a new financial figure. Widths and heights are only drawn in proportion.
import { useEffect, useMemo, useRef, useState } from "react";
import { projectedScore } from "../../shared/score.js";
import { pct, usd, usdShort } from "../format.js";
import { useStore } from "../store.js";

const C = { blue: "#0071E3", red: "#FF3B30", amber: "#FF9F0A", green: "#34C759", grey: "#E5E5EA", ink: "#1D1D1F", mute: "#8E8E93", purple: "#AF52DE", teal: "#30B0C7", indigo: "#5856D6" };
const PALETTE = [C.blue, C.indigo, C.teal, C.purple, C.amber, C.green];

function Seg({ options, value, onChange }) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} className={value === o.value ? "on" : ""} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---- Cash flow: where each dollar of income goes -----------------------------------
function Buckets({ data }) {
  const [sel, setSel] = useState(null);
  const [poured, setPoured] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setPoured(true), 250);
    return () => clearTimeout(t);
  }, []);
  const out = data.items.reduce((s, i) => s + i.amount, 0);
  const scale = Math.max(data.income, out);
  const short = data.free < 0;
  return (
    <div className="mini">
      <div className="mini-head">
        <b>Where your income goes</b>
        <span className="mute">this year</span>
      </div>
      <div className="bar-label">
        <span>Income</span>
        <b>{usd(data.income)}</b>
      </div>
      <div className="track">
        <div className="fill" style={{ width: `${(data.income / scale) * 100}%`, background: C.ink }} />
      </div>
      <div className="bar-label" style={{ marginTop: 12 }}>
        <span>Money going out</span>
        <b>{usd(out)}</b>
      </div>
      <div className="track stack">
        {data.items.map((it, i) => (
          <button
            key={it.name}
            className={`piece ${sel === i ? "sel" : ""}`}
            style={{ width: poured ? `${(it.amount / scale) * 100}%` : 0, background: PALETTE[i % PALETTE.length], transitionDelay: `${i * 140}ms` }}
            onClick={() => setSel(sel === i ? null : i)}
            aria-label={`${it.name}: ${usd(it.amount)} a year`}
          />
        ))}
      </div>
      <div className="legend">
        {data.items.map((it, i) => (
          <button key={it.name} className={`chip ${sel === i ? "on" : ""}`} onClick={() => setSel(sel === i ? null : i)}>
            <i style={{ background: PALETTE[i % PALETTE.length] }} />
            {it.name}
            {sel === i && <b> {usd(it.amount)} a year</b>}
          </button>
        ))}
      </div>
      <div className={`verdict ${short ? "bad" : "good"}`}>
        {short ? (
          <>
            More goes out than comes in: <b>{usd(data.free)} a year</b>
          </>
        ) : (
          <>
            Left over after everything: <b>{usd(data.free)} a year</b>
          </>
        )}
      </div>
      <p className="fine">
        Savings of {usd(data.savings)} a year ({pct(data.savingsRate, 1)} of income) include any employer match.
      </p>
    </div>
  );
}

// ---- Emergency cushion: an oxygen tank ---------------------------------------------
function Tank({ data }) {
  const [afterGoals, setAfterGoals] = useState(false);
  const hasGoals = data.nearTermGoals.length > 0 && Number.isFinite(data.monthsAfterGoals);
  const months = afterGoals ? data.monthsAfterGoals : data.months;
  const top = Math.max(data.maxMonths * 1.35, Math.min(data.months * 1.08, data.maxMonths * 3));
  const y = (m) => 150 - (Math.min(m, top) / top) * 130;
  const ok = months >= data.minMonths;
  return (
    <div className="mini">
      <div className="mini-head">
        <b>How long your cash would last</b>
        <span className="mute">with no income</span>
      </div>
      <div className="tank-row">
        <svg viewBox="0 0 150 170" className="tank" role="img" aria-label={`${months} months covered; ${data.minMonths} to ${data.maxMonths} recommended`}>
          <rect x="35" y="14" width="80" height="142" rx="26" fill="#F2F2F7" />
          <clipPath id="tankclip">
            <rect x="35" y="14" width="80" height="142" rx="26" />
          </clipPath>
          <g clipPath="url(#tankclip)">
            <rect x="35" y={y(data.maxMonths)} width="80" height={y(data.minMonths) - y(data.maxMonths)} fill={C.green} opacity="0.22" />
            <rect x="35" y={y(months)} width="80" height={156 - y(months)} fill={ok ? C.green : months > 0 ? C.amber : C.red} style={{ transition: "all .7s cubic-bezier(.3,1.3,.5,1)" }} />
          </g>
          <line x1="28" x2="122" y1={y(data.minMonths)} y2={y(data.minMonths)} stroke={C.ink} strokeDasharray="3 3" strokeWidth="1" />
          <text x="126" y={y(data.minMonths) + 4} fontSize="9.5" fill={C.ink}>
            {data.minMonths} mo
          </text>
          <text x="126" y={y(data.maxMonths) + 4} fontSize="9.5" fill={C.mute}>
            {data.maxMonths} mo
          </text>
        </svg>
        <div className="tank-side">
          <div className="big">
            {months}
            <small> months</small>
          </div>
          <div className="mute">Recommended: {data.minMonths} to {data.maxMonths} months</div>
          <div className="mute">
            Reserve of {usd(data.reserveMin)} to {usd(data.reserveMax)}
          </div>
          <div className="kv">
            <span>Cash you can reach</span>
            <b>{usd(data.cash)}</b>
          </div>
          <div className="kv">
            <span>Essential expenses</span>
            <b>{usd(data.monthlyExpenses)} a month</b>
          </div>
        </div>
      </div>
      {hasGoals && (
        <>
          <label className="switch-row">
            <input type="checkbox" checked={afterGoals} onChange={(e) => setAfterGoals(e.target.checked)} />
            <span className="switch" />
            Set aside the money for goals that are coming up
          </label>
          {afterGoals && (
            <ul className="plain-list">
              {data.nearTermGoals.map((g) => (
                <li key={g.label}>
                  <span>
                    {g.label} <span className="mute">· {g.when}</span>
                  </span>
                  <b>{usd(g.amount)}</b>
                </li>
              ))}
              <li>
                <span>Cash target with those goals</span>
                <b>
                  {usd(data.totalMin)} to {usd(data.totalMax)}
                </b>
              </li>
            </ul>
          )}
        </>
      )}
    </div>
  );
}

// ---- Retirement: scrub through the years -------------------------------------------
function Timeline({ data }) {
  const n = data.years.length;
  const retireIdx = Math.max(0, data.years.findIndex((y) => y.year >= data.retireYear));
  const [i, setI] = useState(retireIdx);
  const [playing, setPlaying] = useState(false);
  const raf = useRef(0);
  const firstAge = data.years[0].age;
  const ageAt = (k) => firstAge + k;
  const outIdx = data.runsOutAge ? data.years.findIndex((_, k) => ageAt(k) >= data.runsOutAge) : -1;
  const max = Math.max(...data.years.map((y) => Math.max(0, y.savings)));
  const W = 520;
  const H = 150;
  const x = (k) => 14 + (k / (n - 1)) * (W - 28);
  const yv = (v) => H - 8 - (Math.max(0, v) / max) * (H - 30);
  const { area, line } = useMemo(() => {
    const pts = data.years.map((y, k) => `${x(k)} ${yv(y.savings)}`);
    return { line: `M ${pts.join(" L ")}`, area: `M ${x(0)} ${H - 8} L ${pts.join(" L ")} L ${x(n - 1)} ${H - 8} Z` };
  }, [data]);
  useEffect(() => {
    if (!playing) return;
    let start = null;
    const from = 0;
    const tick = (t) => {
      if (start == null) start = t;
      const k = Math.min(n - 1, from + Math.floor(((t - start) / 6500) * (n - 1)));
      setI(k);
      if (k < n - 1) raf.current = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing]);
  const yr = data.years[i];
  const ranOut = outIdx >= 0 && i >= outIdx;
  const goalsNow = data.goals.filter((g) => g.year <= yr.year && (g.endYear ? g.endYear >= yr.year : g.year === yr.year));
  return (
    <div className="mini">
      <div className="mini-head">
        <b>Your savings, year by year</b>
        <button className="link" onClick={() => setPlaying(!playing)}>
          {playing ? "Pause" : "Play it"}
        </button>
      </div>
      <svg viewBox={`0 0 ${W} ${H + 26}`} className="chart" role="img" aria-label="Savings and investments over the years of the plan">
        {outIdx >= 0 && <rect x={x(outIdx)} y="6" width={x(n - 1) - x(outIdx)} height={H - 14} fill={C.red} opacity="0.1" rx="6" />}
        <path d={area} fill={C.blue} opacity="0.16" />
        <path d={line} fill="none" stroke={C.blue} strokeWidth="2.2" strokeLinejoin="round" />
        <line x1={x(retireIdx)} x2={x(retireIdx)} y1="10" y2={H - 8} stroke={C.ink} strokeWidth="1" strokeDasharray="3 3" />
        <text x={x(retireIdx)} y={H + 8} textAnchor="middle" fontSize="10" fill={C.ink}>
          retire
        </text>
        {outIdx >= 0 && (
          <>
            <line x1={x(outIdx)} x2={x(outIdx)} y1="10" y2={H - 8} stroke={C.red} strokeWidth="1.4" />
            <text x={x(outIdx)} y={H + 8} textAnchor="middle" fontSize="10" fontWeight="600" fill={C.red}>
              runs out at {data.runsOutAge}
            </text>
          </>
        )}
        {data.goals.map((g) => {
          const k = data.years.findIndex((y) => y.year === g.year);
          if (k < 0) return null;
          return <circle key={g.name} cx={x(k)} cy={H - 8} r="4.5" fill="#fff" stroke={C.amber} strokeWidth="2" />;
        })}
        <line x1={x(i)} x2={x(i)} y1="4" y2={H - 8} stroke={ranOut ? C.red : C.blue} strokeWidth="1.6" />
        <circle cx={x(i)} cy={yv(yr.savings)} r="5.5" fill="#fff" stroke={ranOut ? C.red : C.blue} strokeWidth="2.4" />
        <text x={x(0)} y={H + 22} fontSize="9.5" fill={C.mute}>
          age {ageAt(0)}
        </text>
        <text x={x(n - 1)} y={H + 22} textAnchor="end" fontSize="9.5" fill={C.mute}>
          age {ageAt(n - 1)}
        </text>
      </svg>
      <input
        type="range"
        min="0"
        max={n - 1}
        value={i}
        onChange={(e) => {
          setPlaying(false);
          setI(Number(e.target.value));
        }}
        aria-label="Year"
        className="scrub"
      />
      <div className={`readout ${ranOut ? "bad" : ""}`}>
        <div>
          <span className="mute">Year</span>
          <b>{yr.year}</b>
        </div>
        <div>
          <span className="mute">{data.personName}'s age</span>
          <b>{ageAt(i)}</b>
        </div>
        <div>
          <span className="mute">Savings and investments</span>
          <b>{ranOut ? "Run out" : usdShort(yr.savings)}</b>
        </div>
        <div>
          <span className="mute">Net worth, today's dollars</span>
          <b>{usdShort(yr.netWorthToday)}</b>
        </div>
      </div>
      <div className="legend">
        {data.goals.map((g) => (
          <span key={g.name} className={`chip static ${goalsNow.includes(g) ? "on" : ""}`}>
            <i style={{ background: C.amber }} />
            {g.name} · {g.year}
          </span>
        ))}
        {!data.runsOutAge && (
          <span className="chip static good">
            <i style={{ background: C.green }} />
            Savings last to the end of the plan (age {data.endAge})
          </span>
        )}
      </div>
      <p className="fine">The curve is in future dollars, as projected in your plan. {data.runsOutAge ? `About ${usd(data.unpaid)} of planned spending would go unpaid by the end of the plan.` : ""}</p>
    </div>
  );
}

// ---- Debt ----------------------------------------------------------------------------
function Debts({ data }) {
  const [sort, setSort] = useState("rate");
  const [sel, setSel] = useState(null);
  const rows = [...data.debts].sort((a, b) => (sort === "rate" ? b.rate - a.rate : b.balance - a.balance));
  const max = Math.max(1, ...data.debts.map((d) => d.balance));
  if (!data.debts.length)
    return (
      <div className="mini">
        <div className="verdict good">You have no debt in your plan.</div>
      </div>
    );
  return (
    <div className="mini">
      <div className="mini-head">
        <b>Your debts</b>
        <Seg value={sort} onChange={setSort} options={[{ value: "rate", label: "Most expensive first" }, { value: "balance", label: "Biggest first" }]} />
      </div>
      {rows.map((d) => (
        <button key={d.name} className={`debt ${sel === d.name ? "sel" : ""}`} onClick={() => setSel(sel === d.name ? null : d.name)}>
          <div className="bar-label">
            <span>
              {d.name} <span className="mute">· {d.type}</span>
            </span>
            <b>{usd(d.balance)}</b>
          </div>
          <div className="track">
            <div className="fill" style={{ width: `${(d.balance / max) * 100}%`, background: d.rate >= 0.15 ? C.red : d.rate >= 0.07 ? C.amber : C.blue }} />
          </div>
          <div className="row-meta">
            <span className={`rate ${d.rate >= 0.15 ? "hot" : ""}`}>{pct(d.rate, 1)} interest</span>
            {sel === d.name && <span>{usd(d.monthly)} a month</span>}
          </div>
        </button>
      ))}
      <div className="bar-label" style={{ marginTop: 10 }}>
        <span>Housing and debt payments, as a share of income</span>
        <b>{pct(data.dti, 2)}</b>
      </div>
      <div className="track meter">
        <div className="fill" style={{ width: `${Math.min(100, (data.dti / 0.6) * 100)}%`, background: data.dti < data.dtiThreshold ? C.green : C.red }} />
        <i className="tick" style={{ left: `${(data.dtiThreshold / 0.6) * 100}%` }} />
      </div>
      <p className="fine">
        The mark is the first threshold, {pct(data.dtiThreshold)}.{data.cardPayoff ? ` At ${usd(data.cardMonthly)} a month, the credit card is projected to be paid off by ${data.cardPayoff}.` : ""}
      </p>
    </div>
  );
}

// ---- Protection: an umbrella that grows -----------------------------------------------
function Coverage({ data }) {
  const [rec, setRec] = useState(false);
  const u = data.umbrella;
  const ratio = rec ? 1 : u.recommended ? Math.min(1, u.current / u.recommended) : 1;
  const w = 26 + ratio * 104;
  const people = [...data.people.map((p) => p.name), ...data.dependants];
  return (
    <div className="mini">
      <div className="mini-head">
        <b>What protects you today</b>
        <Seg value={rec ? "rec" : "now"} onChange={(v) => setRec(v === "rec")} options={[{ value: "now", label: "Today" }, { value: "rec", label: "Recommended" }]} />
      </div>
      <svg viewBox="0 0 300 150" className="umbrella" role="img" aria-label={`Umbrella cover: ${rec ? usd(u.recommended) : u.current ? usd(u.current) : "none"}`}>
        <path d={`M ${150 - w} 70 Q 150 ${70 - w * 0.75} ${150 + w} 70 Z`} fill={ratio >= 1 ? C.blue : ratio > 0 ? C.amber : C.grey} style={{ transition: "all .7s cubic-bezier(.3,1.4,.5,1)" }} />
        <line x1="150" x2="150" y1="70" y2="96" stroke={C.ink} strokeWidth="2" />
        {people.map((name, k) => {
          const px = 150 + (k - (people.length - 1) / 2) * 44;
          const covered = Math.abs(px - 150) <= w;
          const small = k >= data.people.length;
          return (
            <g key={name} opacity={covered ? 1 : 0.45}>
              <circle cx={px} cy={small ? 112 : 106} r={small ? 6 : 8} fill={C.ink} />
              <rect x={px - (small ? 6 : 8)} y={small ? 120 : 116} width={small ? 12 : 16} height={small ? 14 : 20} rx="6" fill={C.ink} />
              <text x={px} y="148" textAnchor="middle" fontSize="9.5" fill={C.mute}>
                {name}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="kv">
        <span>Umbrella liability cover</span>
        <b>
          {rec ? usd(u.recommended) : u.current ? usd(u.current) : "None"} <span className="mute">· plan recommends {usd(u.recommended)}</span>
        </b>
      </div>
      {data.people.map((p) => {
        const top = p.max * 1.08 || 1;
        const shown = rec ? Math.max(p.coverage, p.min) : p.coverage;
        return (
          <div key={p.name} className="life">
            <div className="bar-label">
              <span>Life insurance · {p.name}</span>
              <b>{usd(shown)}</b>
            </div>
            <div className="track meter">
              <i className="band" style={{ left: `${(p.min / top) * 100}%`, width: `${((p.max - p.min) / top) * 100}%` }} />
              <div className="fill" style={{ width: `${Math.min(100, (shown / top) * 100)}%`, background: shown >= p.min ? C.green : C.red }} />
            </div>
            <div className="row-meta">
              <span>
                Recommended {usd(p.min)} to {usd(p.max)}
              </span>
              {!rec && p.verdict && <span className="mute">{p.verdict}</span>}
            </div>
          </div>
        );
      })}
      <p className="fine">"Recommended" shows the low end of the range in your plan. What it would cost is not in your plan.</p>
    </div>
  );
}

// ---- College ---------------------------------------------------------------------------
function College({ data }) {
  const [sel, setSel] = useState(0);
  const k = data.kids[sel];
  return (
    <div className="mini">
      <div className="mini-head">
        <b>College, child by child</b>
        <Seg value={sel} onChange={setSel} options={data.kids.map((x, i) => ({ value: i, label: x.name }))} />
      </div>
      {k && (
        <>
          <div className="big">
            {usd(k.gap)}
            <small> still to fund</small>
          </div>
          <div className="mute">
            {k.name} is {k.age}. College starts {k.starts}.
          </div>
          <div className="bar-label" style={{ marginTop: 10 }}>
            <span>Saved so far</span>
            <b>
              {usd(k.saved)} <span className="mute">of {usd(k.needed)} needed, in today's dollars</span>
            </b>
          </div>
          <div className="track">
            <div className="fill" style={{ width: `${Math.min(100, (k.saved / k.needed) * 100)}%`, background: C.green }} />
          </div>
        </>
      )}
      <div className="kv" style={{ marginTop: 12 }}>
        <span>All children together</span>
        <b>{usd(data.totalGap)} still to fund</b>
      </div>
      <div className="kv">
        <span>In 529 college accounts</span>
        <b>
          {usd(data.saved)} <span className="mute">· {usd(data.yearly)} a year going in</span>
        </b>
      </div>
    </div>
  );
}

// ---- Investments --------------------------------------------------------------------
function Allocation({ data }) {
  const parts = [
    { k: "equity", label: "Stocks", color: C.blue },
    { k: "fixedIncome", label: "Bonds", color: C.teal },
    { k: "cash", label: "Cash", color: C.amber },
  ];
  const [sel, setSel] = useState(null);
  const Bar = ({ title, mix }) =>
    mix ? (
      <>
        <div className="bar-label">
          <span>{title}</span>
          <b>{parts.map((p) => `${pct(mix[p.k])} ${p.label.toLowerCase()}`).join(" · ")}</b>
        </div>
        <div className="track stack tall">
          {parts.map((p) => (
            <div key={p.k} className="piece" style={{ width: `${mix[p.k] * 100}%`, background: p.color }} />
          ))}
        </div>
      </>
    ) : null;
  const max = Math.max(1, ...data.holdings.map((h) => h.value));
  return (
    <div className="mini">
      <div className="mini-head">
        <b>Your mix today and the target</b>
      </div>
      <Bar title="Today" mix={data.current} />
      <div style={{ height: 10 }} />
      <Bar title="Target in your plan" mix={data.target} />
      <div className="legend">
        {parts.map((p) => (
          <span key={p.k} className="chip static">
            <i style={{ background: p.color }} />
            {p.label}
          </span>
        ))}
      </div>
      <div className="mini-head" style={{ marginTop: 12 }}>
        <b>Largest holdings</b>
        <span className="mute">tap one</span>
      </div>
      {data.holdings.map((h) => (
        <button key={h.ticker} className={`debt ${sel === h.ticker ? "sel" : ""}`} onClick={() => setSel(sel === h.ticker ? null : h.ticker)}>
          <div className="bar-label">
            <span>{h.ticker}</span>
            <b>{usd(h.value)}</b>
          </div>
          <div className="track">
            <div className="fill" style={{ width: `${(h.value / max) * 100}%`, background: C.indigo }} />
          </div>
          {sel === h.ticker && <div className="row-meta">{h.name}</div>}
        </button>
      ))}
    </div>
  );
}

// ---- Score and moves -----------------------------------------------------------------
export function ScoreRing({ score, projected, size = 132, label = "out of 100" }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const col = score < 60 ? C.red : score < 80 ? C.amber : C.green;
  return (
    <svg viewBox="0 0 132 132" width={size} height={size} role="img" aria-label={`Score ${score} out of 100${projected && projected !== score ? `, projected ${projected}` : ""}`}>
      <circle cx="66" cy="66" r={r} fill="none" stroke="#F2F2F7" strokeWidth="11" />
      {projected > score && (
        <circle cx="66" cy="66" r={r} fill="none" stroke={C.blue} strokeWidth="11" strokeDasharray={`${(projected / 100) * c} ${c}`} strokeLinecap="round" transform="rotate(-90 66 66)" opacity="0.28" style={{ transition: "stroke-dasharray .8s cubic-bezier(.3,1.3,.5,1)" }} />
      )}
      <circle cx="66" cy="66" r={r} fill="none" stroke={col} strokeWidth="11" strokeDasharray={`${(score / 100) * c} ${c}`} strokeLinecap="round" transform="rotate(-90 66 66)" />
      <text x="66" y="68" textAnchor="middle" fontSize="34" fontWeight="700" fill={C.ink}>
        {projected > score ? projected : score}
      </text>
      <text x="66" y="86" textAnchor="middle" fontSize="9.5" fill={C.mute}>
        {projected > score ? "projected" : label}
      </text>
    </svg>
  );
}

function Score({ data }) {
  const [on, setOn] = useState([]);
  const plan = { score: { value: data.score }, moves: data.moves, combinedMoves: data.combined };
  const proj = projectedScore(plan, on);
  const toggle = (id) => setOn((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  return (
    <div className="mini">
      <div className="mini-head">
        <b>What would move your score</b>
        <span className="mute">try the switches</span>
      </div>
      <div className="score-row">
        <ScoreRing score={data.score} projected={proj.score} />
        <div className="pillars">
          {data.pillars.map((p) => (
            <div key={p.name} className="pillar">
              <div className="bar-label">
                <span>{p.name}</span>
                <b>{p.points}</b>
              </div>
              <div className="track thin">
                <div className="fill" style={{ width: `${p.score}%`, background: p.score < 60 ? C.red : p.score < 80 ? C.amber : C.green }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      {data.moves.map((m) => (
        <label key={m.id} className="switch-row move">
          <input type="checkbox" checked={on.includes(m.id)} onChange={() => toggle(m.id)} />
          <span className="switch" />
          <span>
            <b>{m.title}</b>
            <span className="mute block">
              {m.action}. On its own: {m.score_before} to {m.score_after}.
            </span>
          </span>
        </label>
      ))}
      {proj.basis === "combined" && <p className="fine">Together, Sherpas scores these at {proj.score}. {proj.note}</p>}
      {proj.basis === "best-single" && <p className="fine">Sherpas has not published a score for this exact combination, so this shows the best single step.</p>}
      <p className="fine">These switches only preview the score. Nothing is decided here.</p>
    </div>
  );
}

// ---- What the plan assumes -------------------------------------------------------------
function Assumptions({ data }) {
  const [changed, setChanged] = useState({});
  const addNote = useStore((s) => s.addNote);
  const log = useStore((s) => s.log);
  return (
    <div className="mini">
      <div className="mini-head">
        <b>Is each of these still true?</b>
      </div>
      <ul className="assume">
        {data.items.map((it, i) => (
          <li key={i} className={changed[i] ? "changed" : ""}>
            <span>{it.text}</span>
            <button
              className="pill"
              onClick={() => {
                const next = !changed[i];
                setChanged({ ...changed, [i]: next });
                if (next) {
                  addNote("intakeChanges", `Assumption no longer true: ${it.text}`);
                  log({ type: "assumption_changed", text: it.text });
                }
              }}
            >
              {changed[i] ? "Marked as changed" : "This changed"}
            </button>
          </li>
        ))}
      </ul>
      {Object.values(changed).some(Boolean) && <div className="verdict bad">That changes your plan. It has been noted so your Sherpas Intake can be updated. Nothing is recalculated here.</div>}
    </div>
  );
}

const MAP = { buckets: Buckets, tank: Tank, timeline: Timeline, debts: Debts, coverage: Coverage, college: College, allocation: Allocation, score: Score, assumptions: Assumptions };

export default function MiniApp({ bubble }) {
  const Cmp = MAP[bubble.miniapp.template];
  if (!Cmp) return null;
  return <Cmp data={bubble.miniapp.data} key={bubble.id} />;
}
