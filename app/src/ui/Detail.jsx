// The detailed version of each bubble: specialised charts that build up after the simple toy
// has broken apart. Every figure comes from the plan; nothing is calculated here except the
// geometry of the drawing (widths, heights, positions).
import { useMemo, useState } from "react";
import { pct, usd, usdShort } from "../format.js";
import MiniApp from "../miniapps/index.jsx";

const C = { blue: "#0071E3", red: "#FF3B30", amber: "#FF9F0A", green: "#34C759", ink: "#1D1D1F", grey: "#8E8E93", line: "#E5E5EA", teal: "#30B0C7", indigo: "#5856D6", purple: "#AF52DE" };
const PALETTE = [C.blue, C.indigo, C.teal, C.purple, C.amber, C.green];

function Chart({ i = 0, title, sub, children, wide }) {
  return (
    <section className={`dchart ${wide ? "wide" : ""}`} style={{ "--i": i }}>
      <h3>{title}</h3>
      {sub && <p className="dsub">{sub}</p>}
      {children}
    </section>
  );
}

// A bar that grows from its left edge when the chart appears.
const Bar = ({ x, y, w, h, fill, delay = 0, rx = 4, title, opacity }) => (
  <rect className="grow" x={x} y={y} width={Math.max(0, w)} height={h} rx={Math.min(rx, h / 2)} fill={fill} opacity={opacity} style={{ "--dl": `${delay}s` }}>
    {title && <title>{title}</title>}
  </rect>
);

// ---- Cash flow: where the income goes, as a flow diagram ---------------------------------
function CashflowDetail({ data }) {
  const W = 640;
  const H = 230;
  const items = data.items;
  const out = items.reduce((s, i) => s + i.amount, 0);
  const total = Math.max(data.income, out);
  const gap = 8;
  const usable = H - 20 - gap * (items.length - 1);
  const k = usable / total;
  const leftX = 90;
  const rightX = 400;
  const nodeW = 14;
  let ly = 10;
  let ry = 10;
  const flows = items.map((it, i) => {
    const h = it.amount * k;
    const f = { it, i, l0: ly, r0: ry, h };
    ly += h;
    ry += h + gap;
    return f;
  });
  const incomeH = data.income * k;
  const short = Math.max(0, out - data.income) * k;
  return (
    <Chart i={0} wide title="Where every dollar of income goes" sub={`One year of your plan. Income ${usd(data.income)}.`}>
      <svg viewBox={`0 0 ${W} ${H}`} className="dsvg">
        <Bar x={leftX - nodeW} y={10} w={nodeW} h={incomeH} fill={C.ink} rx={3} delay={0.1} title={`Income ${usd(data.income)}`} />
        {short > 0 && <Bar x={leftX - nodeW} y={10 + incomeH} w={nodeW} h={short} fill={C.red} rx={3} delay={0.2} title="More goes out than comes in" />}
        <text x={leftX - nodeW - 8} y={10 + incomeH / 2} textAnchor="end" className="dl strong">
          Income
        </text>
        <text x={leftX - nodeW - 8} y={10 + incomeH / 2 + 15} textAnchor="end" className="dl">
          {usdShort(data.income)}
        </text>
        {short > 0 && (
          <text x={leftX - nodeW - 8} y={10 + incomeH + short / 2 + 4} textAnchor="end" className="dl bad">
            short
          </text>
        )}
        {flows.map(({ it, i, l0, r0, h }) => {
          const c = PALETTE[i % PALETTE.length];
          const mid = (leftX + rightX) / 2;
          const d = `M ${leftX} ${10 + l0 - 10 + 10} C ${mid} ${10 + l0}, ${mid} ${r0 + 10}, ${rightX} ${r0 + 10} L ${rightX} ${r0 + 10 + h} C ${mid} ${r0 + 10 + h}, ${mid} ${10 + l0 + h}, ${leftX} ${10 + l0 + h} Z`;
          return (
            <g key={it.name}>
              <path d={d} fill={c} className="flow" style={{ "--dl": `${0.25 + i * 0.12}s` }}>
                <title>{`${it.name}: ${usd(it.amount)} a year`}</title>
              </path>
              <Bar x={rightX} y={r0 + 10} w={nodeW} h={Math.max(2, h)} fill={c} rx={3} delay={0.3 + i * 0.12} />
              <text x={rightX + nodeW + 10} y={r0 + 10 + h / 2 + 4} className="dl">
                <tspan className="strong">{it.name}</tspan> {usd(it.amount)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="dkeys">
        <span className={data.free < 0 ? "bad" : "good"}>
          Net cash flow <b>{usd(data.free)} a year</b>
        </span>
        <span>
          Savings <b>{usd(data.savings)} a year</b> ({pct(data.savingsRate, 1)} of income, employer match included)
        </span>
      </div>
    </Chart>
  );
}

// ---- Emergency cushion: cash against the two targets ------------------------------------------
function CushionDetail({ data }) {
  const W = 640;
  const max = Math.max(data.cash, data.totalMax || 0, data.reserveMax) * 1.06;
  const x = (v) => 20 + (v / max) * (W - 40);
  const rows = [
    { label: "Emergency reserve (recommended)", min: data.reserveMin, maxv: data.reserveMax, color: C.green },
    data.totalMin && { label: "Reserve plus goals coming up", min: data.totalMin, maxv: data.totalMax, color: C.amber },
  ].filter(Boolean);
  const goals = data.nearTermGoals || [];
  const mMax = Math.max(data.maxMonths * 1.4, data.months * 1.1);
  const mx = (m) => 20 + (m / mMax) * (W - 40);
  return (
    <>
      <Chart i={0} wide title="Your cash against the targets" sub="The blue line is the cash you can reach today.">
        <svg viewBox={`0 0 ${W} ${60 + rows.length * 46}`} className="dsvg">
          {rows.map((r, i) => (
            <g key={r.label}>
              <text x={20} y={22 + i * 46} className="dl">
                {r.label}: <tspan className="strong">{usd(r.min)} to {usd(r.maxv)}</tspan>
              </text>
              <Bar x={20} y={30 + i * 46} w={x(r.maxv) - 20} h={12} fill="#F2F2F7" delay={0.1} />
              <Bar x={x(r.min)} y={30 + i * 46} w={x(r.maxv) - x(r.min)} h={12} fill={r.color} opacity={0.75} delay={0.3 + i * 0.15} />
            </g>
          ))}
          <line x1={x(data.cash)} x2={x(data.cash)} y1={8} y2={44 + rows.length * 46} stroke={C.blue} strokeWidth="2.5" className="draw-y" />
          <text x={x(data.cash) + 6} y={52 + rows.length * 46} className="dl strong blue">
            {usd(data.cash)} today
          </text>
        </svg>
      </Chart>
      {goals.length > 0 && data.totalMin && (
        <Chart i={1} title="What the target is made of" sub="The low end of the target, piece by piece, as your plan builds it.">
          <svg viewBox="0 0 640 96" className="dsvg">
            {(() => {
              const parts = [{ label: "Emergency reserve", v: data.reserveMin, c: C.green }, ...goals.map((g, i) => ({ label: g.label, v: g.amount, c: [C.amber, C.purple, C.teal][i % 3] }))];
              const tx = (v) => (v / data.totalMin) * 600;
              let acc = 20;
              return parts.map((p, i) => {
                const w = tx(p.v);
                const el = (
                  <g key={p.label}>
                    <Bar x={acc} y={10} w={w - 2} h={26} fill={p.c} rx={5} delay={0.2 + i * 0.15} title={`${p.label}: ${usd(p.v)}`} />
                    {w > 70 && (
                      <text x={acc + 4} y={56} className="dl">
                        <tspan className="strong">{p.label}</tspan>
                        <tspan x={acc + 4} dy="15">
                          {usd(p.v)}
                        </tspan>
                      </text>
                    )}
                  </g>
                );
                acc += w;
                return el;
              });
            })()}
          </svg>
          <p className="dnote">Total: {usd(data.totalMin)} to {usd(data.totalMax)}.</p>
        </Chart>
      )}
      <Chart i={2} title="Months your cash would last" sub={`Essential expenses: ${usd(data.monthlyExpenses)} a month.`}>
        <svg viewBox="0 0 640 92" className="dsvg">
          <Bar x={mx(data.minMonths)} y={22} w={mx(data.maxMonths) - mx(data.minMonths)} h={18} fill={C.green} opacity={0.3} delay={0.1} />
          <line x1={20} x2={W - 20} y1={31} y2={31} stroke={C.line} strokeWidth="2" />
          <circle cx={mx(data.months)} cy={31} r="9" fill={C.blue} className="pop" />
          <text x={mx(data.months)} y={66} textAnchor="middle" className="dl strong">
            {data.months} today
          </text>
          {Number.isFinite(data.monthsAfterGoals) && goals.length > 0 && (
            <>
              <circle cx={mx(data.monthsAfterGoals)} cy={31} r="7" fill="#fff" stroke={C.red} strokeWidth="3" className="pop" style={{ "--dl": "0.5s" }} />
              <text x={mx(data.monthsAfterGoals)} y={84} textAnchor="start" className="dl bad">
                {data.monthsAfterGoals} after the goals
              </text>
            </>
          )}
          <text x={(mx(data.minMonths) + mx(data.maxMonths)) / 2} y={14} textAnchor="middle" className="dl">
            {data.minMonths} to {data.maxMonths} recommended
          </text>
        </svg>
      </Chart>
    </>
  );
}

// ---- Retirement: the full projection, with a cursor -------------------------------------------
function RetirementDetail({ data }) {
  const W = 640;
  const H = 230;
  const n = data.years.length;
  const [hover, setHover] = useState(null);
  const maxS = Math.max(...data.years.map((y) => Math.max(0, y.savings)));
  const maxN = Math.max(...data.years.map((y) => Math.max(0, y.netWorthToday)));
  const top = Math.max(maxS, maxN);
  const x = (k) => 44 + (k / (n - 1)) * (W - 64);
  const y = (v) => H - 26 - (Math.max(0, v) / top) * (H - 46);
  const firstAge = data.years[0].age;
  const retireIdx = Math.max(0, data.years.findIndex((yy) => yy.year >= data.retireYear));
  const outIdx = data.runsOutAge ? data.years.findIndex((_, k) => firstAge + k >= data.runsOutAge) : -1;
  const sPath = useMemo(() => data.years.map((yy, k) => `${k ? "L" : "M"} ${x(k)} ${y(yy.savings)}`).join(" "), [data]);
  const nPath = useMemo(() => data.years.map((yy, k) => `${k ? "L" : "M"} ${x(k)} ${y(yy.netWorthToday)}`).join(" "), [data]);
  const area = `${sPath} L ${x(n - 1)} ${H - 26} L ${x(0)} ${H - 26} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => top * f);
  const d = data.detail || {};
  const bars = [
    d.need != null && { label: "Yearly spending need", v: d.need, c: C.ink },
    d.guaranteed != null && { label: "Guaranteed income (Social Security, pensions)", v: d.guaranteed, c: C.green },
    d.fromSavings != null && { label: "Paid from savings", v: d.fromSavings, c: C.amber },
  ].filter(Boolean);
  const bMax = Math.max(...bars.map((b) => b.v), 1);
  const h = hover != null ? data.years[hover] : null;
  return (
    <>
      <Chart i={0} wide title="Your money, year by year" sub="Move across the chart. Blue: savings and investments, as projected. Dashed: net worth in today's dollars.">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="dsvg interactive"
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const px = ((e.clientX - r.left) / r.width) * W;
            setHover(Math.max(0, Math.min(n - 1, Math.round(((px - 44) / (W - 64)) * (n - 1)))));
          }}
          onMouseLeave={() => setHover(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={44} x2={W - 20} y1={y(t)} y2={y(t)} stroke={C.line} strokeWidth="1" />
              <text x={38} y={y(t) + 4} textAnchor="end" className="dl tiny">
                {usdShort(t)}
              </text>
            </g>
          ))}
          {outIdx >= 0 && <rect x={x(outIdx)} y={14} width={x(n - 1) - x(outIdx)} height={H - 40} fill={C.red} opacity="0.07" />}
          <path d={area} fill={C.blue} opacity="0.12" className="fadein" />
          <path d={sPath} fill="none" stroke={C.blue} strokeWidth="2.5" pathLength="1" className="draw" />
          <path d={nPath} fill="none" stroke={C.ink} strokeWidth="1.6" strokeDasharray="5 4" className="fadein" style={{ "--dl": "1s" }} />
          <line x1={x(retireIdx)} x2={x(retireIdx)} y1={14} y2={H - 26} stroke={C.ink} strokeDasharray="3 3" />
          <text x={x(retireIdx)} y={H - 10} textAnchor="middle" className="dl tiny strong">
            retire · {firstAge + retireIdx}
          </text>
          {outIdx >= 0 && (
            <text x={x(outIdx)} y={H - 10} textAnchor="middle" className="dl tiny bad">
              runs out · {data.runsOutAge}
            </text>
          )}
          {data.goals.map((g) => {
            const k = data.years.findIndex((yy) => yy.year === g.year);
            return k < 0 ? null : (
              <g key={g.name}>
                <circle cx={x(k)} cy={H - 26} r="4.5" fill="#fff" stroke={C.amber} strokeWidth="2" />
                <title>{`${g.name} · ${g.year}`}</title>
              </g>
            );
          })}
          <text x={x(0)} y={H - 10} className="dl tiny">
            age {firstAge}
          </text>
          <text x={x(n - 1)} y={H - 10} textAnchor="end" className="dl tiny">
            age {firstAge + n - 1}
          </text>
          {h && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={14} y2={H - 26} stroke={C.ink} strokeWidth="1" />
              <circle cx={x(hover)} cy={y(h.savings)} r="4.5" fill={C.blue} />
              <circle cx={x(hover)} cy={y(h.netWorthToday)} r="3.5" fill={C.ink} />
              <g transform={`translate(${Math.min(x(hover) + 10, W - 190)}, 18)`}>
                <rect width="178" height="58" rx="10" fill="#fff" stroke={C.line} />
                <text x="10" y="18" className="dl strong">
                  {h.year} · age {firstAge + hover}
                </text>
                <text x="10" y="34" className="dl blue">
                  Savings {outIdx >= 0 && hover >= outIdx ? "run out" : usdShort(h.savings)}
                </text>
                <text x="10" y="50" className="dl">
                  Net worth today's $ {usdShort(h.netWorthToday)}
                </text>
              </g>
            </g>
          )}
        </svg>
      </Chart>
      {bars.length > 0 && (
        <Chart i={1} title="Each year of retirement" sub="Averages over your retirement, in today's dollars.">
          <svg viewBox={`0 0 640 ${bars.length * 44 + 8}`} className="dsvg">
            {bars.map((b, i) => (
              <g key={b.label}>
                <text x={0} y={14 + i * 44} className="dl">
                  {b.label} <tspan className="strong">{usd(b.v)}</tspan>
                </text>
                <Bar x={0} y={20 + i * 44} w={(b.v / bMax) * 630} h={14} fill={b.c} delay={0.3 + i * 0.15} />
              </g>
            ))}
          </svg>
          {d.share && <p className="dnote">Income covers {d.share} of the spending need.</p>}
        </Chart>
      )}
      <Chart i={2} title="The numbers behind it">
        <div className="dbig">
          {d.withdrawal && (
            <div>
              <b>{d.withdrawal}</b>
              <span>average yearly draw from savings</span>
            </div>
          )}
          {d.accountGap && (
            <div>
              <b>{usd(d.accountGap)}</b>
              <span>retirement-account gap, today's dollars</span>
            </div>
          )}
          {d.extraSavings && (
            <div>
              <b>{usd(d.extraSavings)}</b>
              <span>more a year would close it (a projection)</span>
            </div>
          )}
          {data.runsOutAge && (
            <div className="bad">
              <b>{usd(data.unpaid)}</b>
              <span>planned spending left unpaid by the end</span>
            </div>
          )}
        </div>
      </Chart>
    </>
  );
}

// ---- Debt: balance against interest rate ---------------------------------------------------------
function DebtDetail({ data }) {
  const W = 640;
  const H = 230;
  if (!data.debts.length) return <p className="dnote">You have no debt in your plan.</p>;
  const maxR = Math.max(...data.debts.map((d) => d.rate)) * 1.2;
  const maxB = Math.max(...data.debts.map((d) => d.balance)) * 1.18;
  const maxM = Math.max(...data.debts.map((d) => d.monthly));
  const x = (r) => 56 + (r / maxR) * (W - 90);
  const y = (b) => H - 30 - (b / maxB) * (H - 50);
  const th = data.dtiThresholds?.length ? data.dtiThresholds : [data.dtiThreshold];
  const scaleTop = Math.max(0.6, data.dti * 1.2, ...th) ;
  const gx = (v) => 20 + (v / scaleTop) * (W - 40);
  return (
    <>
      <Chart i={0} wide title="What each debt costs" sub="Further right means a higher interest rate. Higher up means a bigger balance. Bubble size is the monthly payment.">
        <svg viewBox={`0 0 ${W} ${H}`} className="dsvg">
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <g key={f}>
              <line x1={56} x2={W - 20} y1={y(maxB * f)} y2={y(maxB * f)} stroke={C.line} />
              <text x={50} y={y(maxB * f) + 4} textAnchor="end" className="dl tiny">
                {usdShort(maxB * f)}
              </text>
            </g>
          ))}
          {[0, 0.5, 1].map((f) => (
            <text key={f} x={x(maxR * f)} y={H - 10} textAnchor="middle" className="dl tiny">
              {pct(maxR * f, 0)}
            </text>
          ))}
          {data.debts.map((d, i) => {
            const r = 8 + Math.sqrt(d.monthly / maxM) * 22;
            const c = d.rate >= 0.15 ? C.red : d.rate >= 0.07 ? C.amber : C.blue;
            return (
              <g key={d.name} className="pop" style={{ "--dl": `${0.3 + i * 0.15}s` }}>
                <circle cx={x(d.rate)} cy={y(d.balance)} r={r} fill={c} opacity="0.85" />
                <text x={x(d.rate) + r + 6} y={y(d.balance) - 2} className="dl strong">
                  {d.name}
                </text>
                <text x={x(d.rate) + r + 6} y={y(d.balance) + 13} className="dl">
                  {usd(d.balance)} · {pct(d.rate, 1)} · {usd(d.monthly)}/mo
                </text>
              </g>
            );
          })}
        </svg>
      </Chart>
      <Chart i={1} title="Payments as a share of income" sub="Housing and debt payments together. The marks are the thresholds lenders use.">
        <svg viewBox="0 0 640 86" className="dsvg">
          <Bar x={20} y={28} w={W - 40} h={14} fill="#F2F2F7" />
          <Bar x={20} y={28} w={gx(data.dti) - 20} h={14} fill={data.dti < th[0] ? C.green : C.red} delay={0.3} />
          {data.debtOnlyDti != null && <Bar x={20} y={46} w={gx(data.debtOnlyDti) - 20} h={6} fill={C.ink} opacity={0.5} delay={0.45} title="Debt payments only" />}
          {th.map((t, i) => (
            <g key={t}>
              <line x1={gx(t)} x2={gx(t)} y1={22} y2={56} stroke={C.ink} strokeWidth={i ? 1 : 2} strokeDasharray={i ? "3 3" : ""} />
              <text x={gx(t)} y={70} textAnchor="middle" className="dl tiny">
                {pct(t, 0)}
              </text>
            </g>
          ))}
          <text x={gx(data.dti)} y={16} textAnchor="middle" className="dl strong">
            {pct(data.dti, 2)}
          </text>
        </svg>
        {data.debtOnlyDti != null && <p className="dnote">Thin grey line: debt payments alone, {pct(data.debtOnlyDti, 2)} of income.{data.cardPayoff ? ` Card paid off by ${data.cardPayoff} at ${usd(data.cardMonthly)} a month.` : ""}</p>}
      </Chart>
    </>
  );
}

// ---- Protection: coverage against the recommended range ---------------------------------------------
function CoverageDetail({ data }) {
  const W = 640;
  const all = [...data.people.map((p) => ({ ...p, kind: "Life insurance" })), { name: "Household", coverage: data.umbrella.current, min: data.umbrella.recommended, max: data.umbrella.recommended, kind: "Umbrella liability" }];
  const top = Math.max(...all.map((p) => Math.max(p.max, p.coverage))) * 1.08;
  const x = (v) => 20 + (v / top) * (W - 40);
  return (
    <Chart i={0} wide title="Cover today against what your plan recommends" sub="Green band: the recommended range. Blue: what you have. The red bracket is the gap to the low end.">
      <svg viewBox={`0 0 ${W} ${all.length * 62 + 10}`} className="dsvg">
        {all.map((p, i) => {
          const yy = 10 + i * 62;
          const shortfall = p.coverage < p.min;
          return (
            <g key={`${p.kind}-${p.name}`}>
              <text x={20} y={yy + 12} className="dl">
                <tspan className="strong">
                  {p.kind}
                  {p.kind === "Life insurance" ? `, ${p.name}` : ""}
                </tspan>{" "}
                {usd(p.coverage)} · recommended {p.min === p.max ? usd(p.min) : `${usd(p.min)} to ${usd(p.max)}`}
              </text>
              <Bar x={20} y={yy + 22} w={W - 40} h={16} fill="#F2F2F7" />
              <Bar x={x(p.min)} y={yy + 22} w={Math.max(4, x(p.max) - x(p.min))} h={16} fill={C.green} opacity={0.35} delay={0.2 + i * 0.12} />
              <Bar x={20} y={yy + 25} w={x(p.coverage) - 20} h={10} fill={C.blue} delay={0.35 + i * 0.12} />
              {shortfall && (
                <path d={`M ${x(p.coverage)} ${yy + 46} v 6 H ${x(p.min)} v -6`} fill="none" stroke={C.red} strokeWidth="1.6" className="fadein" style={{ "--dl": `${0.7 + i * 0.12}s` }} />
              )}
            </g>
          );
        })}
      </svg>
      {data.dependants?.length > 0 && <p className="dnote">People who depend on this cover: {data.dependants.join(", ")}.</p>}
    </Chart>
  );
}

// ---- College ---------------------------------------------------------------------------------------
function CollegeDetail({ data }) {
  const W = 640;
  const top = Math.max(...data.kids.map((k) => k.needed)) * 1.05;
  const x = (v) => 110 + (v / top) * (W - 130);
  return (
    <Chart i={0} wide title="College, child by child" sub="Needed in today's dollars, what is saved and what is still to fund.">
      <svg viewBox={`0 0 ${W} ${data.kids.length * 64 + 10}`} className="dsvg">
        {data.kids.map((k, i) => {
          const yy = 10 + i * 64;
          return (
            <g key={k.name}>
              <text x={0} y={yy + 20} className="dl strong">
                {k.name}, {k.age}
              </text>
              <text x={0} y={yy + 36} className="dl tiny">
                starts {k.starts}
              </text>
              <Bar x={110} y={yy + 10} w={x(k.needed) - 110} h={20} fill="#F2F2F7" delay={0.1} />
              <Bar x={110} y={yy + 10} w={x(k.saved) - 110} h={20} fill={C.green} delay={0.3 + i * 0.12} />
              <text x={x(k.needed) + 0} y={yy + 46} textAnchor="end" className="dl">
                {usd(k.gap)} still to fund · {usd(k.saved)} saved of {usd(k.needed)}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="dnote">
        Together {usd(data.totalGap)} still to fund. {usd(data.saved)} in 529 accounts, {usd(data.yearly)} a year going in.
      </p>
    </Chart>
  );
}

// ---- Investments: the mix, and a map of the holdings -------------------------------------------------
function treemap(items, x, y, w, h) {
  // Slice-and-dice, alternating direction: simple and stable.
  const out = [];
  const total = items.reduce((s, i) => s + i.value, 0);
  let off = 0;
  const horizontal = w >= h;
  items.forEach((it) => {
    const f = it.value / total;
    if (horizontal) {
      out.push({ ...it, x: x + off * w, y, w: f * w, h });
    } else {
      out.push({ ...it, x, y: y + off * h, w, h: f * h });
    }
    off += f;
  });
  return out;
}
function AllocationDetail({ data }) {
  const W = 640;
  const parts = [
    ["equity", "Stocks", C.blue],
    ["fixedIncome", "Bonds", C.teal],
    ["cash", "Cash", C.amber],
  ];
  const rows = [
    ["Today", data.current],
    ["Target", data.target],
  ].filter((r) => r[1]);
  const holdings = data.holdings;
  const [big, ...rest] = holdings;
  const restTotal = rest.reduce((s, h) => s + h.value, 0);
  const all = holdings.reduce((s, h) => s + h.value, 0);
  const tiles = big ? [{ ...big, x: 0, y: 0, w: (big.value / all) * W, h: 170 }, ...treemap(rest, (big.value / all) * W, 0, W - (big.value / all) * W, 170)] : [];
  return (
    <>
      <Chart i={0} title="Mix today against the target">
        <svg viewBox={`0 0 ${W} ${rows.length * 52 + 10}`} className="dsvg">
          {rows.map(([label, mix], r) => {
            let acc = 70;
            return (
              <g key={label}>
                <text x={0} y={r * 52 + 30} className="dl strong">
                  {label}
                </text>
                {parts.map(([k, name, c], i) => {
                  const w = mix[k] * (W - 70);
                  const el = (
                    <g key={k}>
                      <Bar x={acc} y={r * 52 + 12} w={w - 2} h={28} fill={c} rx={6} delay={0.2 + r * 0.2 + i * 0.1} title={`${name} ${pct(mix[k])}`} />
                      {w > 54 && (
                        <text x={acc + 8} y={r * 52 + 31} className="dl white">
                          {name} {pct(mix[k])}
                        </text>
                      )}
                    </g>
                  );
                  acc += w;
                  return el;
                })}
              </g>
            );
          })}
        </svg>
      </Chart>
      {tiles.length > 0 && (
        <Chart i={1} title="Your largest holdings" sub={`Each block's area is its value. ${usd(all)} across these holdings.`}>
          <svg viewBox={`0 0 ${W} 170`} className="dsvg">
            {tiles.map((t, i) => (
              <g key={t.ticker} className="pop" style={{ "--dl": `${0.3 + i * 0.1}s` }}>
                <rect x={t.x + 2} y={t.y + 2} width={Math.max(0, t.w - 4)} height={Math.max(0, t.h - 4)} rx="10" fill={PALETTE[i % PALETTE.length]} opacity={0.88}>
                  <title>{`${t.name}: ${usd(t.value)}`}</title>
                </rect>
                {t.w > 60 && t.h > 34 && (
                  <text x={t.x + 12} y={t.y + 24} className="dl white strong">
                    {t.ticker}
                    <tspan x={t.x + 12} dy="16" className="white">
                      {usdShort(t.value)}
                    </tspan>
                  </text>
                )}
              </g>
            ))}
          </svg>
          {restTotal > 0 && <p className="dnote">Hover a block to see its full name.</p>}
        </Chart>
      )}
    </>
  );
}

// ---- Score: where the points are, and what moves them ----------------------------------------------------
function ScoreDetail({ data }) {
  const W = 640;
  const pillars = data.pillars.map((p) => {
    const [got, of] = String(p.points).split("/").map(Number);
    return { ...p, got, of };
  });
  const maxOf = Math.max(...pillars.map((p) => p.of || 0), 1);
  const unit = (W - 230) / maxOf;
  const sx = (v) => 30 + (v / 100) * (W - 60);
  return (
    <>
      <Chart i={0} title="Where your points come from" sub="Each bar is as long as the points that area can give. The colour is what you have.">
        <svg viewBox={`0 0 ${W} ${pillars.length * 38 + 6}`} className="dsvg">
          {pillars.map((p, i) => (
            <g key={p.name}>
              <text x={0} y={i * 38 + 22} className="dl">
                {p.name}
              </text>
              <Bar x={210} y={i * 38 + 10} w={(p.of || 0) * unit} h={16} fill="#F2F2F7" />
              <Bar x={210} y={i * 38 + 10} w={(p.got || 0) * unit} h={16} fill={p.score < 60 ? C.red : p.score < 80 ? C.amber : C.green} delay={0.25 + i * 0.1} />
              <text x={210 + (p.of || 0) * unit + 8} y={i * 38 + 23} className="dl strong">
                {p.points}
              </text>
            </g>
          ))}
        </svg>
      </Chart>
      <Chart i={1} title="What each step would do to the score" sub="From today's score to the score Sherpas gives each step on its own.">
        <svg viewBox={`0 0 ${W} ${data.moves.length * 46 + 34}`} className="dsvg">
          {[0, 25, 50, 75, 100].map((t) => (
            <g key={t}>
              <line x1={sx(t)} x2={sx(t)} y1={6} y2={data.moves.length * 46 + 10} stroke={C.line} />
              <text x={sx(t)} y={data.moves.length * 46 + 26} textAnchor="middle" className="dl tiny">
                {t}
              </text>
            </g>
          ))}
          {data.moves.map((m, i) => {
            const yy = 18 + i * 46;
            return (
              <g key={m.id}>
                <text x={sx(m.score_before)} y={yy - 4} className="dl">
                  <tspan className="strong">{m.title}</tspan>
                </text>
                <line x1={sx(m.score_before)} x2={sx(m.score_after)} y1={yy + 8} y2={yy + 8} stroke={C.green} strokeWidth="4" strokeLinecap="round" pathLength="1" className="draw" style={{ "--dl": `${0.3 + i * 0.15}s` }} />
                <circle cx={sx(m.score_before)} cy={yy + 8} r="5" fill={C.ink} />
                <circle cx={sx(m.score_after)} cy={yy + 8} r="7" fill={C.green} className="pop" style={{ "--dl": `${0.7 + i * 0.15}s` }} />
                <text x={sx(m.score_after) + 12} y={yy + 12} className="dl strong">
                  {m.score_after}
                </text>
              </g>
            );
          })}
        </svg>
        {data.combined?.length > 0 && <p className="dnote">Together, Sherpas scores some combinations higher: up to {Math.max(...data.combined.map((c) => c.score_after))}.</p>}
      </Chart>
    </>
  );
}

const MAP = { buckets: CashflowDetail, tank: CushionDetail, timeline: RetirementDetail, debts: DebtDetail, coverage: CoverageDetail, college: CollegeDetail, allocation: AllocationDetail, score: ScoreDetail };

export default function Detail({ bubble }) {
  const Cmp = MAP[bubble.miniapp.template];
  if (!Cmp) {
    // Topics without a dedicated chart (what the plan assumes) keep their list here.
    return (
      <section className="dchart wide" style={{ "--i": 0 }}>
        <MiniApp bubble={bubble} />
      </section>
    );
  }
  return <Cmp data={bubble.miniapp.data} />;
}
