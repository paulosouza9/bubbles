// Builds the "script" for a family: bubbles, the data for each mini app, the facts for the
// deepest zoom level, the must-knows, the moves and the missions.
//
// Rule of the house: structure and every figure come straight from the plan. The model only
// writes the short explanations for each zoom level, and each one is rejected if it contains
// a figure that is not in the plan (then a sentence from Sherpas' own analysis is used).
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getCase } from "./cases.mjs";
import { config } from "./env.mjs";
import { chatJson, numberSet, numbersOk } from "./llm.mjs";

const SCRIPT_VERSION = 4;

// ---- Formatting -----------------------------------------------------------------

const clean = (s) =>
  String(s ?? "")
    .replace(/â€“/g, "–")
    .replace(/â€”/g, "—")
    .replace(/â€™/g, "’")
    .replace(/\*\*/g, "")
    .trim();
export const usd = (n) => {
  const v = Math.round(Number(n) || 0);
  return `${v < 0 ? "-" : ""}$${Math.abs(v).toLocaleString("en-US")}`;
};
const pct = (x, d = 1) => `${Number((Number(x) * 100).toFixed(d))}%`;
const monthYear = (iso) => new Date(iso).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const yearOf = (iso) => new Date(iso).getUTCFullYear();
const bullets = (t) =>
  clean(t)
    .split(/\n+/)
    .map((l) => l.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);
const sentences = (t) =>
  clean(t)
    .split(/(?<=[.!?])\s+(?=[A-Z"“$])/)
    .map((s) => s.trim())
    .filter(Boolean);
const statusOf = (score) => (score < 60 ? "red" : score < 80 ? "amber" : "green");
const colourStatus = { R: "red", Y: "amber", G: "green", red: "red", yellow: "amber", green: "green" };

function fact(f, extraLabel) {
  if (!f) return null;
  let value;
  if (f.min != null && f.max != null) value = `${usd(f.min)} to ${usd(f.max)}`;
  else if (f.unit === "USD") value = usd(f.value);
  else if (f.unit === "USD/yr") value = `${usd(f.value)} a year`;
  else if (f.unit === "months") value = `${f.value} months`;
  else value = String(f.value);
  return { label: clean(extraLabel || f.label), value, note: clean(f.period || "") };
}

const CAVEAT =
  /(projection|isn['’]t in the (data|plan)|is not in the (data|plan)|not in the plan|no long-term care|holds only if|as assumed|could be higher|is unknown|uncertain|may not reflect|worth confirming|not a safe-rate|estimate)/i;
function caveats(...texts) {
  const out = [];
  for (const t of texts) {
    for (const b of bullets(t)) {
      const ss = sentences(b);
      ss.forEach((s, i) => {
        if (!CAVEAT.test(s)) return;
        // A sentence that starts with "That", "This" or "It" needs the one before it to make sense.
        const full = i > 0 && /^(That|This|It|These|Those|So) /.test(s) ? `${ss[i - 1]} ${s}` : s;
        if (full.length < 330 && !out.some((o) => o.includes(s))) out.push(full);
      });
    }
  }
  return out.slice(0, 3).map((text) => ({ text, source: "Sherpas analysis" }));
}

// ---- Deterministic structure ----------------------------------------------------

function buildBase(c) {
  const fh = c.financialHealth;
  const ia = c.investmentAnalysis;
  const km = fh.key_metrics;
  const nar = fh.narrative;
  const facts = km.facts;
  const ratios = km.ratios;
  const household = fh.case.household;
  const adults = household.filter((p) => p.role !== "child");
  const kids = household.filter((p) => p.role === "child");
  const names = adults.map((p) => p.first_name);
  const pillar = (name) => fh.score.pillars.find((p) => p.pillar.toLowerCase().startsWith(name));
  const cp = km.retirementAndOtherGoals.clientProfile;
  const dep = km.retirementAndOtherGoals.assetDepletion;
  const bubbles = [];

  // 1. Cash flow and savings
  {
    const p = pillar("savings");
    const cf = km.cashflowStatement;
    const sl = ratios.savingsLevel;
    bubbles.push({
      id: "cashflow",
      title: "Cash flow",
      pillar: p?.pillar,
      points: p?.points_shown_in_app,
      status: statusOf(p?.score ?? 50),
      analysis: bullets(nar.savings_short_observations),
      lookInto: clean(nar.savings_what_to_look_into).replace(/^We should look into:?\s*/i, ""),
      mustKnow: caveats(nar.savings_short_observations),
      desks: [
        fact(facts.retirement.netCashFlowThisYear),
        { label: "Income this year", value: usd(cf.inflows.total), note: "before taxes" },
        { label: "Yearly savings, employer match included", value: `${usd(sl.savingAmount)} (${pct(sl.ratio)} of income)`, note: "this year" },
        ...cf.outflows.items.map((i) => ({ label: `Goes to: ${clean(i.name).toLowerCase()}`, value: `${usd(i.total)} a year`, note: "" })),
      ].filter(Boolean),
      miniapp: {
        template: "buckets",
        data: {
          income: cf.inflows.total,
          items: [...cf.outflows.items].sort((a, b) => b.total - a.total).map((i) => ({ name: clean(i.name), amount: i.total })),
          free: cf.freeCashflow.total,
          savings: sl.savingAmount,
          savingsRate: sl.ratio,
        },
      },
    });
  }

  // 2. Emergency cushion
  {
    const p = pillar("liquidity");
    const ef = ratios.emergencyFund;
    const cash = facts.cash;
    bubbles.push({
      id: "cushion",
      title: "Emergency cushion",
      pillar: p?.pillar,
      points: p?.points_shown_in_app,
      status: statusOf(p?.score ?? 50),
      analysis: bullets(nar.protection_emergency_fund_short_observations),
      lookInto: "",
      mustKnow: caveats(nar.protection_emergency_fund_short_observations),
      desks: [
        fact(cash.accessibleCash),
        fact(cash.monthsCovered),
        fact(cash.emergencyReserve),
        ...(cash.nearTermGoals || []).map((g) => fact(g)),
        fact(cash.totalCashNeeded),
        fact(cash.monthsCoveredAfterNearTermGoals),
      ].filter(Boolean),
      miniapp: {
        template: "tank",
        data: {
          months: Number(cash.monthsCovered.value),
          minMonths: ef.minRecommendedEFMonths,
          maxMonths: ef.maxRecommendedEFMonths,
          cash: cash.accessibleCash.value,
          reserveMin: cash.emergencyReserve.min,
          reserveMax: cash.emergencyReserve.max,
          monthlyExpenses: ef.monthlyExpenses,
          claim: clean(ef.claim),
          nearTermGoals: (cash.nearTermGoals || []).map((g) => ({ label: clean(g.label).split(":")[0], amount: g.value, when: clean(g.period) })),
          totalMin: cash.totalCashNeeded?.min,
          totalMax: cash.totalCashNeeded?.max,
          monthsAfterGoals: Number(cash.monthsCoveredAfterNearTermGoals?.value ?? NaN),
        },
      },
    });
  }

  // 3. Retirement
  {
    const runsOut = typeof dep.ageWhenTheyRunOutOfLiquidAssets === "number" ? dep.ageWhenTheyRunOutOfLiquidAssets : null;
    const rs = ratios.retirementSavings;
    const ages = adults.map((a) => a.retirement_age);
    const years = fh.projections.yearly.map((y) => ({
      year: y.year,
      age: y.age_client ?? y.age_co_client,
      netWorthToday: y.net_worth_todays_dollars,
      savings: y.investable_assets,
    }));
    const retireYears = fh.goals.chartGoals.filter((g) => g.goalType === "RETIREMENT").map((g) => ({ name: clean(g.name), year: yearOf(g.date) }));
    const firstRetire = retireYears.length ? Math.min(...retireYears.map((r) => r.year)) : years[0].year + (ages[0] - adults[0].age);
    const r = facts.retirement;
    bubbles.push({
      id: "retirement",
      title: ages.length > 1 ? `Retirement at ${ages.join(" and ")}` : `Retirement at ${ages[0]}`,
      status: runsOut ? "red" : rs.requiredExtraSavings > 0 ? "amber" : "green",
      analysis: bullets(nar.retirement_short_observations),
      lookInto: clean(nar.retirement_what_to_look_into).replace(/^We should look into:?\s*/i, ""),
      mustKnow: [
        ...caveats(nar.retirement_short_observations).slice(0, 2),
        { text: "These are projections, not guarantees. They change if your income, spending or the markets change.", source: "General" },
      ],
      desks: [
        fact(r.savingsRunOut, runsOut ? `${clean(r.savingsRunOut.label)}: planned spending left unpaid` : null),
        fact(r.spendingNeed),
        fact(r.guaranteedIncome),
        fact(r.incomeShareOfNeed),
        fact(r.spendingGap),
        fact(r.withdrawalRateAverage),
        rs.planningGapAtRetirementAgeInTodaysDollars > 0 && {
          label: "Retirement-account gap at retirement",
          value: usd(rs.planningGapAtRetirementAgeInTodaysDollars),
          note: "today's dollars",
        },
        rs.requiredExtraSavings > 0 && { label: "Extra yearly savings that would close that gap", value: `${usd(rs.requiredExtraSavings)} a year`, note: "a projection" },
      ].filter((d) => d && !(d.label.startsWith("Savings and investments run out") && !runsOut)),
      miniapp: {
        template: "timeline",
        data: {
          years,
          retireYear: firstRetire,
          retirements: retireYears,
          endAge: cp.endOfPlanAge,
          runsOutAge: runsOut,
          unpaid: runsOut ? r.savingsRunOut.value : 0,
          personName: years[0].age === adults[0].age ? adults[0].first_name : adults.at(-1).first_name,
          goals: fh.goals.chartGoals
            .filter((g) => !String(g.goalType).startsWith("BANKRUPTCY") && g.goalType !== "RETIREMENT")
            .map((g) => ({ name: clean(g.name), type: g.goalType, year: yearOf(g.date), endYear: g.termDate ? yearOf(g.termDate) : null })),
        },
      },
    });
  }

  // 4. Debt
  {
    const p = pillar("debt");
    const dm = km.debtManagement;
    const rows = (dm.listOfDebts || []).slice(1).filter((r) => r[2] > 0);
    const cc = ratios.creditCardDebt;
    const dti = dm.debtToIncomeAndMonthlyObligations;
    bubbles.push({
      id: "debt",
      title: "Debt",
      pillar: p?.pillar,
      points: p?.points_shown_in_app,
      status: statusOf(p?.score ?? 50),
      analysis: bullets(nar.debt_short_observations),
      lookInto: clean(nar.debt_what_to_look_into).replace(/^We should look into:?\s*/i, ""),
      mustKnow: caveats(nar.debt_short_observations),
      desks: [
        { label: "Total debt", value: usd(dm.debtOverview.debtBalance), note: `${pct(dm.debtOverview.percentageOfDebtOverGrossIncome, 2)} of yearly income` },
        ...rows.map((r) => ({ label: clean(r[0]), value: usd(r[2]), note: `${pct(r[3])} interest, ${usd(r[4])} a month` })),
        { label: "Housing and debt payments as a share of income", value: pct(dti.dti, 2), note: `first threshold ${pct(dti.dtiFirstThreshold, 0)}` },
        cc.hasDebt && cc.ccPayoffDate && { label: "Credit card paid off by", value: monthYear(cc.ccPayoffDate), note: `if ${usd(cc.monthlyPayment)} a month continues` },
      ].filter(Boolean),
      miniapp: {
        template: "debts",
        data: {
          total: dm.debtOverview.debtBalance,
          debts: rows.map((r) => ({ name: clean(r[0]), type: clean(r[1]), balance: r[2], rate: r[3], monthly: r[4] })),
          dti: dti.dti,
          dtiThreshold: dti.dtiFirstThreshold,
          cardPayoff: cc.hasDebt && cc.ccPayoffDate ? monthYear(cc.ccPayoffDate) : null,
          cardMonthly: cc.monthlyPayment,
        },
      },
    });
  }

  // 5. Protection
  {
    const p = pillar("insurance");
    const li = ratios.lifeInsurance;
    const um = ratios.umbrella;
    const people = [
      { name: cp.clientName, coverage: li.clientCoverage, min: li.recommendedClientMinCoverage, max: li.recommendedClientMaxCoverage, verdict: clean(li.clientCoverageKey) },
      cp.coClientName && {
        name: cp.coClientName,
        coverage: li.coClientCoverage,
        min: li.recommendedCoClientMinCoverage,
        max: li.recommendedCoClientMaxCoverage,
        verdict: clean(li.coClientCoverageKey),
      },
    ].filter(Boolean);
    bubbles.push({
      id: "protection",
      title: "Protection",
      pillar: p?.pillar,
      points: p?.points_shown_in_app,
      status: statusOf(p?.score ?? 50),
      analysis: [...bullets(nar.protection_life_insurance_short_observations), ...bullets(nar.protection_umbrella_short_observations)],
      lookInto: "",
      mustKnow: caveats(nar.protection_umbrella_short_observations, nar.protection_life_insurance_short_observations),
      desks: [
        ...people.map((x) => ({ label: `Life insurance, ${x.name}`, value: usd(x.coverage), note: `recommended ${usd(x.min)} to ${usd(x.max)}` })),
        { label: "Umbrella liability cover", value: um.currentCoverage ? usd(um.currentCoverage) : "None", note: `recommended ${usd(um.recommendedCoverage)}` },
      ],
      miniapp: {
        template: "coverage",
        data: { people, umbrella: { current: um.currentCoverage, recommended: um.recommendedCoverage, verdict: clean(um.claim) }, dependants: kids.map((k) => k.first_name) },
      },
    });
  }

  // 6. College (only when the plan has education goals)
  const edu = ratios.educationSavings;
  if (edu.doTheyHaveEducationFundingGoals) {
    const goals = edu.goalsSummary || [];
    const about = [nar.summary_main, nar.summary_recommendations, nar.savings_short_observations, ia?.narrative?.summary_main]
      .flatMap((t) => bullets(t || ""))
      .filter((b) => /college|education|529/i.test(b))
      .slice(0, 4);
    bubbles.push({
      id: "college",
      title: `College for ${kids.map((k) => k.first_name).join(" and ") || "the kids"}`,
      status: edu.totalGAP > 0 ? (edu.current529AccountsBalance > 0 ? "amber" : "red") : "green",
      analysis: about,
      lookInto: "",
      mustKnow: [...caveats(about.join("\n")).slice(0, 2), { text: "College costs here are the amounts entered in your plan. Real costs can differ.", source: "General" }],
      desks: [
        { label: "Still to fund for college", value: usd(edu.totalGAP), note: "today's dollars" },
        { label: "Saved in 529 accounts", value: usd(edu.current529AccountsBalance), note: `${usd(edu.annualSavingsGoingTo529Accounts)} a year going in` },
        ...goals.map((g) => ({ label: clean(g.goalName), value: `${usd(g.totalGAP)} still to fund`, note: `starts ${monthYear(g.date)}` })),
      ],
      miniapp: {
        template: "college",
        data: {
          totalGap: edu.totalGAP,
          saved: edu.current529AccountsBalance,
          yearly: edu.annualSavingsGoingTo529Accounts,
          kids: goals.map((g) => ({
            name: clean(g.goalName).replace(/^College\s+/i, ""),
            age: g.kidsAge,
            starts: monthYear(g.date),
            startYear: yearOf(g.date),
            needed: g.goalRequiredAmountAtToday,
            saved: g.accountBalance,
            gap: g.totalGAP,
          })),
        },
      },
    });
  }

  // 7. Investments
  if (ia) {
    const p = pillar("investments");
    const alloc = ia.analysis?.summary?.assetAllocation || {};
    const byTicker = new Map();
    for (const pos of ia.positions || []) {
      const k = pos.ticker || "Cash";
      const cur = byTicker.get(k) || { ticker: k, name: pos.ticker ? clean(pos.name) : "Cash", value: 0 };
      cur.value += pos.value;
      byTicker.set(k, cur);
    }
    const holdings = [...byTicker.values()].sort((a, b) => b.value - a.value).slice(0, 6);
    const total = (ia.positions || []).reduce((s, x) => s + x.value, 0);
    const invBullets = bullets(ia.narrative?.summary_main || "");
    bubbles.push({
      id: "investments",
      title: "Investments",
      pillar: p?.pillar,
      points: p?.points_shown_in_app,
      status: statusOf(p?.score ?? 50),
      analysis: [...bullets(nar.assets_short_observations), ...invBullets].slice(0, 7),
      lookInto: clean(nar.assets_what_to_look_into).replace(/^We should look into:?\s*/i, ""),
      mustKnow: [
        ...caveats(nar.assets_short_observations, nar.assets_what_to_look_into).slice(0, 1),
        { text: "Past returns do not tell you what future returns will be.", source: "General" },
      ],
      desks: [
        alloc.currentEFC && { label: "Your mix today", value: `${pct(alloc.currentEFC.equity, 0)} stocks, ${pct(alloc.currentEFC.fixedIncome, 0)} bonds, ${pct(alloc.currentEFC.cash, 0)} cash`, note: "all accounts on record" },
        alloc.targetEFC && { label: "Target mix", value: `${pct(alloc.targetEFC.equity, 0)} stocks, ${pct(alloc.targetEFC.fixedIncome, 0)} bonds, ${pct(alloc.targetEFC.cash, 0)} cash`, note: "where the plan aims" },
        ...holdings.slice(0, 4).map((h) => ({ label: h.ticker === "Cash" ? "Cash in accounts" : `${h.ticker}: ${h.name}`, value: usd(h.value), note: `${pct(h.value / total, 0)} of the accounts on record` })),
      ].filter(Boolean),
      miniapp: { template: "allocation", data: { current: alloc.currentEFC, target: alloc.targetEFC, holdings, total } },
    });
  }

  // 8. Score and first step
  const moves = fh.score.top_moves.map((m, i) => ({
    id: `m${i}`,
    title: clean(m.title),
    action: clean(m.action),
    effort: m.effort,
    score_before: m.score_before,
    score_after: m.score_after,
    lifts_a_cap: m.lifts_a_cap,
    bubbleId: /umbrella|life|mortality|cover|insur/i.test(`${m.title} ${m.action}`)
      ? "protection"
      : /card|revolving|debt|loan/i.test(m.title)
        ? "debt"
        : /withdraw/i.test(m.title)
          ? "retirement"
          : /saving/i.test(m.title)
            ? "cashflow"
            : /alloc|concentr|growth|glide/i.test(m.title)
              ? "investments"
              : "score",
  }));
  let takeaways = bullets((fh.score.explainer || "").split(/\n## /)[0].replace(/^## Key takeaways\s*/i, ""));
  if (!takeaways.length) {
    const sorted = [...fh.score.pillars].sort((x, y) => y.score - x.score);
    const top = moves[0];
    takeaways = [
      `The published score is ${fh.score.published_score}, in the ${fh.score.band} band.`,
      `Your strongest area is ${clean(sorted[0].pillar).toLowerCase()} (${sorted[0].points_shown_in_app} points).`,
      `Your weakest area is ${clean(sorted.at(-1).pillar).toLowerCase()} (${sorted.at(-1).points_shown_in_app} points).`,
      top && `The top move is: ${top.action}. The published score moves from ${top.score_before} to ${top.score_after}.`,
    ].filter(Boolean);
  }
  bubbles.push({
    id: "score",
    title: `Your score: ${fh.score.published_score}`,
    status: colourStatus[fh.score.colour] || statusOf(fh.score.published_score),
    analysis: takeaways,
    lookInto: "",
    mustKnow: [
      { text: "The score is a summary. A high score can still hide a serious gap, so look at each area.", source: "General" },
      ...(fh.score.caps_applied || []).map((cap) => ({ text: `Your score is capped at ${cap.score_capped_at}: ${clean(cap.reason).toLowerCase()}.`, source: "Sherpas score" })),
    ],
    desks: fh.score.pillars.map((x) => ({ label: clean(x.pillar), value: x.points_shown_in_app, note: "points" })),
    miniapp: {
      template: "score",
      data: {
        score: fh.score.published_score,
        band: fh.score.band,
        pillars: fh.score.pillars.map((x) => ({ name: clean(x.pillar), points: x.points_shown_in_app, score: x.score })),
        moves,
        combined: (fh.score.combined_moves || []).map((cm) => ({ moves: cm.moves.map(clean), score_after: cm.score_after, note: clean(cm.note) })),
      },
    },
  });

  // 9. What the plan assumes (cloud only, not narrated in the first walk-through)
  {
    const rs = ratios.retirementSavings;
    const items = [];
    for (const a of adults) items.push({ text: `${a.first_name} retires at ${a.retirement_age}.`, source: "goals" });
    items.push({ text: `The plan runs until age ${cp.endOfPlanAge}.`, source: "plan" });
    if (rs.generalInflation > 0) items.push({ text: `Prices rise ${pct(rs.generalInflation)} a year.`, source: "plan" });
    if (rs.averagePerformance > 0) items.push({ text: `Your investments grow ${pct(rs.averagePerformance, 2)} a year on average.`, source: "plan" });
    for (const inc of fh.profile.incomes || []) {
      if (inc.type === "SALARY_AND_WAGES") items.push({ text: `${inc.owner?.[0] || "Your"}${inc.owner?.[0] ? "’s" : ""} salary of ${usd(inc.yearly)} continues until ${inc.ends}.`, source: "income" });
      if (inc.type === "SOCIAL_SECURITY") items.push({ text: `Social Security for ${inc.owner?.[0]} starts in ${inc.starts}.`, source: "income" });
    }
    for (const g of fh.goals.goalsSummary || []) items.push({ text: clean(g.value), source: "goals" });
    if (km.retirementAndOtherGoals.incomeNeedsAndWithdrawals?.ltcCostsAreEstimated)
      items.push({ text: "Long-term care costs are only an estimate, and the retirement spending figures shown here leave them out.", source: "plan" });
    items.push({ text: "Debt payments continue as entered in the plan.", source: "plan" });
    bubbles.push({
      id: "assumptions",
      title: "What your plan assumes",
      status: "neutral",
      analysis: [],
      lookInto: "",
      mustKnow: [{ text: "If one of these stops being true, the plan changes. Tell your advisor's firm so it can be updated.", source: "General" }],
      desks: items.map((x, i) => ({ label: `Assumption ${i + 1}`, value: x.text, note: "" })),
      miniapp: { template: "assumptions", data: { items } },
    });
  }

  // Weights, links and the order of the walk-through
  const weight = { red: 0.86, amber: 0.74, green: 0.62, neutral: 0.5 };
  for (const b of bubbles) b.weight = b.id === "retirement" && b.status === "red" ? 1 : b.id === "score" ? 0.8 : weight[b.status];
  const has = (id) => bubbles.some((b) => b.id === id);
  const links = [
    ["cashflow", "retirement"],
    ["cashflow", "cushion"],
    ["cashflow", "debt"],
    ["retirement", "investments"],
    ["college", "cashflow"],
    ["protection", "score"],
  ].filter(([a, b]) => has(a) && has(b));
  const walk = bubbles.filter((b) => !["score", "assumptions"].includes(b.id));
  const best = [...walk].filter((b) => b.pillar).sort((a, b) => sev(a) - sev(b))[0];
  function sev(b) {
    return { green: 0, amber: 1, red: 2 }[b.status] ?? 1;
  }
  const rest = walk.filter((b) => b !== best).sort((a, b) => sev(b) - sev(a) || b.weight - a.weight);
  const order = [best?.id, ...rest.map((b) => b.id), "score"].filter(Boolean);

  const d5 = (c.persona.match(/## D5[^\n]*\n+([A-Z][A-Z\- ]+)/) || [])[1]?.trim() || "";
  const suggestedProfile = /DELEGAT/.test(d5) ? "action" : /ANALY|VALIDAT|DIY|SELF/.test(d5) ? "expert" : "understand";

  return {
    family: c.id,
    source: c.source,
    household,
    names,
    label: names.join(" & "),
    city: fh.case.city,
    state: fh.case.state,
    score: { value: fh.score.published_score, band: fh.score.band, status: colourStatus[fh.score.colour] || "amber" },
    persona: { decisionStyle: d5, suggestedProfile },
    summary: bullets(nar.summary_main),
    recommendations: bullets(nar.summary_recommendations),
    bubbles,
    links,
    order,
    moves,
    combinedMoves: bubbles.find((b) => b.id === "score").miniapp.data.combined,
  };
}

// ---- Fallback wording (verbatim from Sherpas' analysis) ---------------------------

function fallbackTexts(base) {
  const t = { city: sentences(base.summary[0] || "")[0], strength: sentences(base.summary[0] || "")[0], bubbles: {}, moves: {} };
  for (const b of base.bubbles) {
    const first = b.analysis[0] || b.desks.map((d) => d.value).join(" ");
    t.bubbles[b.id] = {
      building: sentences(first)[0],
      plain: first,
      standard: b.analysis.slice(0, 2).join(" ") || first,
    };
  }
  if (base.bubbles.find((b) => b.id === "assumptions"))
    t.bubbles.assumptions = {
      building: "Every plan rests on a few assumptions. Here are yours.",
      plain: "Your plan rests on a few assumptions about your income, your goals and the future. If one of them changes, the plan changes too.",
      standard: "Your plan rests on a few assumptions about your income, your goals and the future. If one of them changes, the plan changes too.",
    };
  for (const m of base.moves) {
    t.moves[m.id] = {
      title: m.title,
      why: base.bubbles.find((b) => b.id === m.bubbleId)?.analysis[0] || m.action,
      steps: ["Open this area of your plan and read what it says.", `Plan step: ${m.action}.`, "Ask for a quote or the details before you commit to anything.", "Mark it as done here once it is in place."],
      quiz: {
        q: "According to your plan, what would this step change?",
        options: [`Your score would move from ${m.score_before} to ${m.score_after}.`, "It would guarantee the retirement date you chose.", "It would clear all of your debt."],
        correct: 0,
        explain: `Sherpas scores this step on its own: from ${m.score_before} to ${m.score_after}. It does not promise anything else.`,
      },
    };
  }
  return t;
}

// ---- Model-written wording, validated and cached ----------------------------------

const SYSTEM = `You write the short explanations inside a financial-plan app for a family in the United States.
You are given the family's EXISTING plan from Sherpas, topic by topic. You explain it. You never change it.

Hard rules:
- Use ONLY facts and figures that appear in the plan text you are given. Copy every figure exactly as written (same digits). Never round, add, subtract, or derive new figures.
- Never give advice that is not already in the plan. No product names that are not in the plan.
- Second person ("you", "your"), warm, direct, plain American English. No jargon unless you explain it in the same sentence. No exclamation marks. No emojis.
- Do not start by repeating the topic title.

Return JSON with this exact shape:
{
 "city": one sentence (max 22 words) that sums up this family's whole financial picture, honest but kind,
 "strength": one sentence (max 24 words) naming what they already do well, with one real figure from the plan,
 "bubbles": { "<topic id>": {
     "building": one sentence, max 20 words, the single most important thing about this topic,
     "plain": 2 or 3 short sentences for someone who knows nothing about finance. Use an everyday comparison if it helps. At most two figures,
     "standard": 3 or 4 sentences for someone who wants to understand the why. Include the key figures
 } },
 "moves": { "<move id>": {
     "title": an imperative of max 9 words that a person can actually do this month (e.g. "Get a quote for $1M of umbrella cover"),
     "why": one sentence on why the plan suggests it, grounded in the plan,
     "steps": 3 or 4 concrete how-to steps, each max 14 words, with no figures that are not in the plan,
     "quiz": { "q": one question that checks the person understood what this step is, "options": [three short answers], "correct": index of the right one, "explain": one sentence explaining the right answer in plain words }
 } }
}`;

function sourceText(base) {
  const parts = [`FAMILY: ${base.label}, ${base.city}, ${base.state}. Score ${base.score.value}/100 (${base.score.band}).`, `PLAN SUMMARY:\n- ${base.summary.join("\n- ")}`, `PLAN RECOMMENDATIONS:\n- ${base.recommendations.join("\n- ")}`];
  for (const b of base.bubbles) {
    parts.push(
      `TOPIC id="${b.id}" title="${b.title}" status=${b.status}\nAnalysis:\n- ${b.analysis.join("\n- ") || "(none)"}\nFacts:\n- ${b.desks.map((d) => `${d.label}: ${d.value}${d.note ? ` (${d.note})` : ""}`).join("\n- ")}`,
    );
  }
  for (const m of base.moves) parts.push(`MOVE id="${m.id}" title="${m.title}" effort=${m.effort}: ${m.action}. Score from ${m.score_before} to ${m.score_after}.`);
  return parts.join("\n\n");
}

async function modelTexts(base, src) {
  const fb = fallbackTexts(base);
  let out;
  try {
    out = await chatJson({ system: SYSTEM, user: src, effort: "low" });
  } catch (e) {
    return { texts: fb, generatedBy: "template", note: String(e.message || e) };
  }
  const allowed = numberSet(src);
  const ok = (s, max = 600) => typeof s === "string" && s.trim().length > 8 && s.length <= max && numbersOk(s, allowed);
  const texts = { city: ok(out.city, 220) ? clean(out.city) : fb.city, strength: ok(out.strength, 240) ? clean(out.strength) : fb.strength, bubbles: {}, moves: {} };
  let rejected = 0;
  for (const b of base.bubbles) {
    const o = out.bubbles?.[b.id] || {};
    const f = fb.bubbles[b.id];
    texts.bubbles[b.id] = {};
    for (const [k, max] of [["building", 200], ["plain", 480], ["standard", 760]]) {
      if (ok(o[k], max)) texts.bubbles[b.id][k] = clean(o[k]);
      else {
        texts.bubbles[b.id][k] = f[k];
        rejected++;
      }
    }
  }
  for (const m of base.moves) {
    const o = out.moves?.[m.id] || {};
    const f = fb.moves[m.id];
    const quizOk =
      o.quiz && ok(o.quiz.q, 240) && Array.isArray(o.quiz.options) && o.quiz.options.length === 3 && o.quiz.options.every((x) => ok(x, 160) || (typeof x === "string" && x.length > 1 && numbersOk(x, allowed))) &&
      Number.isInteger(o.quiz.correct) && o.quiz.correct >= 0 && o.quiz.correct < 3 && ok(o.quiz.explain, 320);
    texts.moves[m.id] = {
      title: ok(o.title, 90) ? clean(o.title) : f.title,
      why: ok(o.why, 300) ? clean(o.why) : f.why,
      steps: Array.isArray(o.steps) && o.steps.length >= 2 && o.steps.every((s) => typeof s === "string" && s.length > 3 && s.length < 140 && numbersOk(s, allowed)) ? o.steps.slice(0, 4).map(clean) : f.steps,
      quiz: quizOk ? { q: clean(o.quiz.q), options: o.quiz.options.map(clean), correct: o.quiz.correct, explain: clean(o.quiz.explain) } : f.quiz,
    };
  }
  return { texts, generatedBy: "model", rejected };
}

// ---- Public API -------------------------------------------------------------------

const memo = new Map();

export async function buildPlan(id, { allowModel = true } = {}) {
  if (memo.has(id)) return memo.get(id);
  const c = await getCase(id);
  const base = buildBase(c);
  const src = sourceText(base);
  const hash = createHash("sha1").update(`${SCRIPT_VERSION}|${src}`).digest("hex").slice(0, 16);
  const file = join(config.generatedDir, `${id}.json`);
  let gen = null;
  if (existsSync(file)) {
    try {
      const saved = JSON.parse(readFileSync(file, "utf8"));
      if (saved.hash === hash) gen = saved;
    } catch {
      /* regenerate */
    }
  }
  if (!gen) {
    gen = allowModel ? await modelTexts(base, src) : { texts: fallbackTexts(base), generatedBy: "template" };
    gen.hash = hash;
    if (gen.generatedBy === "model") {
      mkdirSync(config.generatedDir, { recursive: true });
      writeFileSync(file, JSON.stringify(gen, null, 1));
    }
  }
  const t = gen.texts;

  // Attach wording to the structure
  const bubbles = base.bubbles.map((b) => ({ ...b, building: t.bubbles[b.id].building, floor: { plain: t.bubbles[b.id].plain, standard: t.bubbles[b.id].standard } }));
  const byId = Object.fromEntries(bubbles.map((b) => [b.id, b]));
  const moves = base.moves.map((m) => ({ ...m, ...t.moves[m.id], planTitle: m.title }));

  // Missions: every move is a possible "quick" or "important" mission; every topic can be an "understand" mission.
  const understand = base.order
    .filter((bid) => bid !== "score")
    .map((bid, i, arr) => {
      const b = byId[bid];
      const others = arr.filter((x) => x !== bid).map((x) => byId[x].building);
      const options = [b.building, others[i % others.length], others[(i + 1) % others.length]];
      const shift = i % 3;
      const rotated = [...options.slice(shift), ...options.slice(0, shift)];
      return {
        id: `u-${bid}`,
        type: "understand",
        title: `Understand: ${b.title.toLowerCase()}`,
        why: "Two minutes now makes every later decision easier.",
        steps: ["Open this bubble and listen to it.", "Go one floor deeper to see the figures.", "Answer the check question."],
        minutes: 2,
        bubbleId: bid,
        quiz: { q: `Which of these is what your plan says about ${b.title.toLowerCase()}?`, options: rotated, correct: rotated.indexOf(b.building), explain: b.floor.plain },
      };
    });
  const moveMissions = moves.map((m) => ({
    id: m.id,
    type: m.effort === "low" ? "quick" : "important",
    title: m.title,
    why: m.why,
    steps: m.steps,
    minutes: m.effort === "low" ? 10 : 30,
    moveId: m.id,
    bubbleId: m.bubbleId,
    score_before: m.score_before,
    score_after: m.score_after,
    quiz: m.quiz,
  }));
  const quick = moveMissions.find((m) => m.type === "quick") || moveMissions[0];
  const important = [...moveMissions].filter((m) => m !== quick).sort((a, b) => b.score_after - a.score_after)[0];
  if (important) important.type = "important";
  if (quick) quick.type = "quick";
  const worst = understand.find((u) => byId[u.bubbleId].status === "red" && u.bubbleId !== quick?.bubbleId) || understand[0];

  const plan = {
    ...base,
    bubbles,
    moves,
    texts: { city: t.city, strength: t.strength, greeting: `Okay, ${base.names.join(" and ")}. I have your plan. Let me walk you through it. It takes about three minutes.` },
    missionPool: [...moveMissions, ...understand],
    firstMissions: [quick?.id, important?.id, worst?.id].filter(Boolean),
    generatedBy: gen.generatedBy,
    corpus: src,
  };
  memo.set(id, plan);
  return plan;
}

// Text the chat model may quote from: the plan corpus plus the investment narrative.
export async function planCorpus(id) {
  const plan = await buildPlan(id);
  const c = await getCase(id);
  const inv = c.investmentAnalysis?.narrative;
  const extra = inv ? `\n\nINVESTMENT ANALYSIS:\n${clean(inv.summary_main)}\n${clean(inv.recommendations_main || "")}` : "";
  const must = plan.bubbles.map((b) => `MUST KNOW (${b.id}): ${b.mustKnow.map((m) => m.text).join(" ")}`).join("\n");
  return `${plan.corpus}\n\n${must}${extra}`;
}

export function publicPlan(plan) {
  const { corpus, ...rest } = plan;
  return rest;
}
