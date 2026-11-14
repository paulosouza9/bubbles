// App state. One store, persisted per family in localStorage (the cloud, the profile, the
// missions and the notes survive a reload, like the idea asks).
import { create } from "zustand";
import { projectedScore } from "../shared/score.js";
import { api } from "./api.js";
import { setServerVoice, stopSpeaking, voice } from "./audio.js";

export const PROFILES = {
  novice: { label: "New to this", style: "plain", enter: 2, blurb: "Short sentences and everyday comparisons." },
  action: { label: "Tell me what to do", style: "plain", enter: 2, blurb: "Straight to the actions." },
  understand: { label: "Help me understand", style: "standard", enter: 2, blurb: "The why, without jargon." },
  expert: { label: "Show me the figures", style: "standard", enter: 1, blurb: "Exact figures and metrics." },
};

const key = (family) => `burbuja:${family}`;
const PERSIST = ["person", "profiles", "easy", "journeyDone", "missions", "understood", "notes", "asked", "day", "tutorialDone"];

function load(family) {
  try {
    return JSON.parse(localStorage.getItem(key(family)) || "null");
  } catch {
    return null;
  }
}

const freshFamilyState = () => ({
  person: null,
  profiles: {},
  easy: false,
  journeyDone: false,
  tutorialDone: false,
  missions: { month: 1, active: [], status: {}, history: [], when: {} },
  understood: {},
  notes: { intakeChanges: [], worries: [], humanRequests: 0 },
  asked: {},
  day: 0,
});

export const useStore = create((set, get) => ({
  status: null,
  families: [],
  loadError: null,
  plan: null,
  family: null,
  via: null,
  phase: "landing", // landing | forming | calibrate | journey | cloud | month
  level: 3,
  focus: null,
  journeyIndex: 0,
  simple: false, // true when the flat 2D view is used (no WebGL, or 3D switched off in the menu)
  reduced: false, // the system asks for less motion: keep the 3D world but cut instead of travel
  muted: false,
  chat: { open: false, messages: [], quote: null, pending: false },
  decision: null,
  celebrate: null, // { title, from, to, kind } shown after a step is done
  actReady: false, // the action moment is on screen: the toy makes room for it
  missionsOpen: false,
  humanOpen: false,
  toast: null,
  nudge: 0,
  tutorial: null, // null | "enter" | "back": the one-time zoom lesson
  setTutorial(tutorial) {
    set({ tutorial });
  },
  ...freshFamilyState(),

  // ---- boot ----
  async init() {
    try {
      const [status, fam] = await Promise.all([api.status(), api.families()]);
      setServerVoice(status.voice?.tts === "elevenlabs");
      set({ status: { ...status, data: fam.source || status.data }, families: fam.families });
    } catch (e) {
      set({ loadError: String(e.message || e) });
    }
  },
  async refreshStatus() {
    try {
      const status = await api.status();
      setServerVoice(status.voice?.tts === "elevenlabs");
      set({ status });
    } catch {
      /* keep the old one */
    }
  },

  async openFamily(id, via = "intake") {
    stopSpeaking();
    const plan = await api.plan(id);
    const saved = load(id) || {};
    const base = { ...freshFamilyState(), ...saved };
    if (!base.missions.active.length) base.missions = { ...base.missions, active: plan.firstMissions };
    if (!base.person) base.person = plan.names[0];
    set({
      plan,
      family: id,
      via,
      ...base,
      focus: base.journeyDone ? "steps" : plan.order[0],
      level: 3,
      fact: null,
      monthTab: "missions",
      journeyIndex: 0,
      chat: { open: false, messages: [], quote: null, pending: false },
      phase: base.journeyDone ? "cloud" : "forming",
    });
    get().refreshStatus();
    get().log({ type: "open_plan", via });
  },
  leave() {
    stopSpeaking();
    set({ plan: null, family: null, phase: "landing", focus: null, level: 3 });
  },
  reset() {
    const { family } = get();
    if (family) localStorage.removeItem(key(family));
    get().leave();
  },

  // ---- profile ----
  profile() {
    const s = get();
    return s.profiles[s.person] || { kind: s.plan?.persona?.suggestedProfile || "understand", style: PROFILES[s.plan?.persona?.suggestedProfile || "understand"].style };
  },
  setProfile(kind, person) {
    const who = person || get().person;
    set((s) => ({ profiles: { ...s.profiles, [who]: { kind, style: PROFILES[kind].style, simplerCount: 0 } } }));
  },
  setPerson(person) {
    set({ person });
  },
  setEasy(easy) {
    set({ easy });
    get().log({ type: "easy_mode", on: easy });
  },
  setMuted(muted) {
    voice.muted = muted;
    if (muted) stopSpeaking();
    set({ muted });
  },

  // ---- zoom ----
  setPhase(phase) {
    set({ phase });
  },
  // One bubble at a time. Each bubble is its own little world with three zoom stops:
  // 3 outside (one sentence), 2 inside (explained, with its toy), 1 deep (the figures).
  flat() {
    const s = get();
    return s.easy || s.simple;
  },
  seq() {
    const s = get();
    const base = [...s.plan.order, ...s.plan.bubbles.map((b) => b.id).filter((id) => !s.plan.order.includes(id))];
    return s.flat() ? base : [...base, "steps"];
  },
  bubble(id) {
    const s = get();
    if (id !== "steps") return s.plan?.bubbles.find((b) => b.id === id);
    return {
      id: "steps",
      title: "Your next steps",
      status: "neutral",
      building: `Three missions for month ${s.missions.month}, straight from your plan.`,
      floor: { plain: "", standard: "" },
      mustKnow: [{ text: "Nothing is decided here. Every mission opens its decision card first.", source: "General" }],
      desks: [],
      analysis: [],
      miniapp: { template: "steps", data: {} },
    };
  },
  go(dir) {
    const s = get();
    const seq = s.seq();
    const i = Math.max(0, Math.min(seq.length - 1, seq.indexOf(s.focus) + dir));
    get().jump(seq[i]);
  },
  jump(id, level = 3) {
    const s = get();
    stopSpeaking();
    const last = id === "steps" || id === s.plan.order.at(-1);
    set({ focus: id, level, fact: null, journeyDone: s.journeyDone || last, phase: s.phase === "journey" && last ? "cloud" : s.phase });
    get().logView();
  },
  setFact(fact) {
    set({ fact });
  },
  setMonthTab(monthTab) {
    stopSpeaking();
    set({ monthTab });
  },
  openMonth() {
    const s = get();
    if (s.flat()) return set({ phase: "month" });
    set({ focus: "steps", level: 2, monthTab: "podcast", journeyDone: true, phase: "cloud" });
  },
  enter(id) {
    const p = PROFILES[get().profile().kind];
    // In the bubble world, stepping inside always lands on the simple version first.
    set({ focus: id, level: id === "steps" || !get().flat() ? 2 : p.enter, fact: null });
    get().logView();
  },
  // The wording each zoom stop uses. In the bubble world: inside = simple, deeper = detailed.
  styleNow() {
    const s = get();
    if (!s.flat()) return s.level <= 1 ? "standard" : "plain";
    return s.profile().style;
  },
  setLevel(level) {
    const s = get();
    let focus = s.focus;
    if (!s.flat()) {
      level = Math.min(3, level);
      if (focus === "steps") level = Math.max(2, level);
    }
    if (level <= 2 && !focus) focus = s.currentMission()?.bubbleId || s.plan.order[0];
    if (level >= 3) stopSpeaking();
    set({ level, focus, fact: null });
    if (level <= 2) get().logView();
  },
  back() {
    const s = get();
    if (s.level === 1) get().setLevel(2);
    else if (s.level === 2 && (s.phase !== "journey" || !s.flat())) get().setLevel(3);
    else if (s.level === 3 && s.flat()) get().setLevel(4);
  },
  // "Simpler" and "More detail" move through wording first, then through floors.
  simpler() {
    const s = get();
    const pr = s.profile();
    if (s.level === 1) return get().setLevel(2);
    if (!s.flat()) return s.level === 2 ? get().setLevel(3) : null;
    if (s.level === 2 && pr.style === "standard") {
      const count = (pr.simplerCount || 0) + 1;
      set({ profiles: { ...s.profiles, [s.person]: { ...pr, style: "plain", simplerCount: count, kind: count >= 2 && pr.kind !== "action" ? "novice" : pr.kind } } });
      return get().logView();
    }
    if (s.level === 2 && (s.phase !== "journey" || !s.flat())) return get().setLevel(3);
    if (s.level === 3) return get().setLevel(4);
  },
  deeper() {
    const s = get();
    const pr = s.profile();
    if (s.level === 4) return get().setLevel(3);
    if (s.level === 3) return get().enter(s.focus);
    if (!s.flat()) return s.level === 2 && s.focus !== "steps" ? get().setLevel(1) : null;
    if (s.level === 2 && pr.style === "plain") {
      set({ profiles: { ...s.profiles, [s.person]: { ...pr, style: "standard" } } });
      return get().logView();
    }
    if (s.level === 2) {
      const deep = (pr.deepCount || 0) + 1;
      set({ profiles: { ...s.profiles, [s.person]: { ...pr, deepCount: deep, kind: deep >= 3 ? "expert" : pr.kind } } });
      return get().setLevel(1);
    }
  },
  logView() {
    const s = get();
    const b = s.plan?.bubbles.find((x) => x.id === s.focus);
    if (!b) return;
    get().log({ type: "view", bubble: b.id, level: s.level, style: s.styleNow(), must_know_shown: b.mustKnow.map((m) => m.text) });
  },

  // ---- journey ----
  startJourney() {
    const s = get();
    const first = s.plan.order[0];
    set({ phase: "journey", journeyIndex: 0, focus: first, fact: null, level: s.flat() ? PROFILES[s.profile().kind].enter : 3 });
    get().logView();
  },
  journeyNext() {
    const s = get();
    const i = s.journeyIndex + 1;
    if (i >= s.plan.order.length) {
      stopSpeaking();
      set({ phase: "cloud", journeyDone: true, focus: null, level: 3, missionsOpen: true });
      return;
    }
    set({ journeyIndex: i, focus: s.plan.order[i], level: PROFILES[s.profile().kind].enter });
    get().logView();
  },
  journeyPrev() {
    const s = get();
    const i = Math.max(0, s.journeyIndex - 1);
    set({ journeyIndex: i, focus: s.plan.order[i], level: PROFILES[s.profile().kind].enter });
  },
  skipJourney() {
    stopSpeaking();
    const s = get();
    set({ phase: "cloud", journeyDone: true, focus: s.flat() ? null : "steps", level: 3 });
  },

  // ---- missions ----
  mission(id) {
    return get().plan?.missionPool.find((m) => m.id === id);
  },
  activeMissions() {
    const s = get();
    return s.missions.active.map((id) => s.mission(id)).filter(Boolean);
  },
  currentMission() {
    const s = get();
    return s.activeMissions().find((m) => s.missions.status[m.id] !== "done") || null;
  },
  doneMoveIds() {
    const s = get();
    return Object.entries(s.missions.status)
      .filter(([, st]) => st === "done")
      .map(([id]) => s.mission(id)?.moveId)
      .filter(Boolean);
  },
  projected() {
    const s = get();
    return projectedScore(s.plan, s.doneMoveIds());
  },
  setMissionStatus(id, status, extra = {}) {
    const before = get().projected().score;
    set((s) => ({ missions: { ...s.missions, status: { ...s.missions.status, [id]: status } } }));
    get().log({ type: "mission_status", mission: id, status, ...extra });
    if (status === "done" && !extra.undone) {
      const m = get().mission(id);
      set({ celebrate: { title: m?.title, kind: m?.type === "understand" ? "understand" : "done", bubbleId: m?.bubbleId, from: before, to: get().projected().score } });
    }
  },
  setMissionWhen(id, when) {
    set((s) => ({ missions: { ...s.missions, when: { ...(s.missions.when || {}), [id]: when } } }));
    get().log({ type: "mission_when", mission: id, when });
  },
  addMission(id) {
    set((s) => (s.missions.active.includes(id) ? {} : { missions: { ...s.missions, active: [...s.missions.active, id] } }));
  },
  setCelebrate(celebrate) {
    set({ celebrate });
  },
  openDecision(id) {
    set({ decision: id });
  },
  closeDecision() {
    set({ decision: null });
  },
  setMissionsOpen(open) {
    const s = get();
    if (open && !s.flat()) return set({ focus: "steps", level: 2, monthTab: "missions", journeyDone: true, phase: "cloud" });
    set({ missionsOpen: open });
  },
  startNextMonth(ids) {
    set((s) => ({
      missions: {
        month: s.missions.month + 1,
        active: ids,
        status: s.missions.status,
        history: [...s.missions.history, { month: s.missions.month, ids: s.missions.active, done: s.missions.active.filter((id) => s.missions.status[id] === "done") }],
      },
      day: 0,
      phase: "cloud",
      level: s.easy || s.simple ? 3 : 2,
      focus: s.easy || s.simple ? null : "steps",
      monthTab: "missions",
    }));
    get().log({ type: "month_start", missions: ids });
  },
  setDay(day) {
    set({ day });
  },
  addNote(kind, text) {
    set((s) => ({ notes: { ...s.notes, [kind]: [...(s.notes[kind] || []), { text, month: s.missions.month }] } }));
  },

  // ---- chat ----
  openChat(quote = null) {
    stopSpeaking();
    set((s) => ({ chat: { ...s.chat, open: true, quote } }));
  },
  closeChat() {
    set((s) => ({ chat: { ...s.chat, open: false, quote: null } }));
  },
  async ask(question) {
    const s = get();
    const b = s.plan.bubbles.find((x) => x.id === s.focus);
    const quote = s.chat.quote;
    const userMsg = { role: "user", text: question, quote };
    set({ chat: { ...s.chat, open: true, quote: null, pending: true, messages: [...s.chat.messages, userMsg] } });
    if (b) set((st) => ({ asked: { ...st.asked, [b.id]: [...(st.asked[b.id] || []), { q: question, quote, month: st.missions.month }] } }));
    let reply;
    try {
      reply = await api.ask({
        family: s.family,
        person: s.person,
        profile: s.profile().kind,
        zoom: { 4: "city", 3: "building", 2: "floor", 1: "desk" }[s.level],
        easy_mode: s.easy,
        selection: quote,
        question,
        screen: b ? { bubble_id: b.id, bubble_title: b.title, status: b.status, miniapp: b.miniapp.template, text_on_screen: s.level <= 2 ? b.floor[s.styleNow()] : b.building } : { view: s.phase },
        history: s.chat.messages.slice(-6).map((m) => ({ role: m.role, text: m.text })),
      });
    } catch {
      reply = { text: "I could not reach the plan helper just now. Please try again in a moment.", actions: [] };
    }
    set((st) => ({ chat: { ...st.chat, pending: false, messages: [...st.chat.messages, { role: "assistant", text: reply.text, actions: reply.actions || [] }] } }));
    return reply;
  },
  runAction(a) {
    if (a.type === "go_to_bubble") {
      get().closeChat();
      if (get().phase === "journey") set({ phase: "cloud", journeyDone: true });
      get().enter(a.bubble);
    } else if (a.type === "zoom_in") get().deeper();
    else if (a.type === "zoom_out") get().simpler();
    else if (a.type === "talk_to_human") set({ humanOpen: true });
  },
  setHumanOpen(open) {
    set({ humanOpen: open });
  },
  markUnderstood(id) {
    set((s) => ({ understood: { ...s.understood, [id]: true } }));
  },
  showToast(toast) {
    set({ toast });
  },
  setNudge(nudge) {
    set({ nudge });
  },
  setSimple(simple) {
    set({ simple });
  },
  setReduced(reduced) {
    set({ reduced });
  },

  log(event) {
    const s = get();
    if (!s.family) return;
    api.log({ family: s.family, person: s.person, month: s.missions.month, easy: s.easy, ...event });
  },
}));

// Persist the per-family slice.
useStore.subscribe((s) => {
  if (!s.family) return;
  const slice = Object.fromEntries(PERSIST.map((k) => [k, s[k]]));
  try {
    localStorage.setItem(key(s.family), JSON.stringify(slice));
  } catch {
    /* private mode: nothing to do */
  }
});
