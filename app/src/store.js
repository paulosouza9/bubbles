// App state. One store, persisted per family in localStorage (the cloud, the profile, the
// missions and the notes survive a reload, like the idea asks).
import { create } from "zustand";
import { wantsHuman } from "../shared/human.js";
import { projectedScore } from "../shared/score.js";
import { api } from "./api.js";
import { setServerVoice, sfx, stopSpeaking, voice } from "./audio.js";

export const PROFILES = {
  novice: { label: "New to this", style: "plain", enter: 2, blurb: "Short sentences and everyday comparisons." },
  action: { label: "Tell me what to do", style: "plain", enter: 2, blurb: "Straight to the actions." },
  understand: { label: "Help me understand", style: "standard", enter: 2, blurb: "The why, without jargon." },
  expert: { label: "Show me the figures", style: "standard", enter: 1, blurb: "Exact figures and metrics." },
};

const key = (family) => `burbuja:${family}`;
const PERSIST = ["person", "profiles", "easy", "journeyDone", "missions", "understood", "notes", "asked", "day", "tutorialDone", "hinted", "zoomHinted", "visited", "lastFocus", "explored", "guessed", "tourDone"];

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
  hinted: false,
  zoomHinted: false,
  tourDone: false, // the four-step "learn by doing" tour on the first bubble
  visited: {},
  lastFocus: null,
  explored: {}, // bubbles stepped into: they light up in the cloud
  guessed: {}, // "guess before you see" answers
  missions: { month: 1, active: [], status: {}, history: [], when: {} },
  understood: {},
  notes: { intakeChanges: [], worries: [], humanRequests: 0 },
  asked: {},
  day: 0,
});

// Moving between bubbles and pages goes into the browser history, so the back button (and a
// phone's back gesture) returns to the bubble you were on instead of leaving the app.
let restoring = false;
function pushNav(entry) {
  if (restoring || typeof history === "undefined") return;
  const cur = history.state || {};
  if (cur.b === entry.b && cur.v === entry.v) return;
  history.pushState(entry, "", location.pathname);
}
function replaceNav(entry) {
  if (typeof history !== "undefined") history.replaceState(entry, "", location.pathname);
}
export function restoreNav(entry) {
  const s = useStore.getState();
  if (!s.plan || !entry) return;
  restoring = true;
  try {
    if (entry.b && (entry.b === "steps" || s.plan.bubbles.some((b) => b.id === entry.b))) {
      if (s.phase === "month" || s.phase === "meeting") useStore.setState({ phase: "cloud" });
      s.jump(entry.b);
    } else if (entry.v === "home") s.goHome();
    else if (entry.v === "month") s.openMonthPage();
    else if (entry.v === "meeting") s.openMeeting();
  } finally {
    restoring = false;
  }
}

export const useStore = create((set, get) => ({
  trail: [], // the bubbles visited before this one, this session: "Back to …"
  lit: null, // the bubble that has just lit up (a short pulse)
  tourStep: 0,
  setTourStep(tourStep) {
    set({ tourStep });
  },
  endTour() {
    set({ tourDone: true, hinted: true, zoomHinted: true, tourStep: 0 });
    get().log({ type: "tour_done" });
  },
  allLit: false, // every area explored: the whole-cloud celebration
  status: null,
  families: [],
  loadError: null,
  plan: null,
  family: null,
  via: null,
  phase: "landing", // landing | forming | calibrate | journey | cloud | month | meeting
  home: false, // the cloud of every bubble: where a returning visit starts
  level: 3,
  focus: null,
  journeyIndex: 0,
  simple: false, // true when the flat 2D view is used (no WebGL, or 3D switched off in the menu)
  reduced: false, // the system asks for less motion: keep the 3D world but cut instead of travel
  muted: false,
  chat: { open: false, messages: [], quote: null, pending: false, support: false },
  decision: null,
  celebrate: null, // { title, from, to, kind } shown after a step is done
  actReady: false, // the action moment is on screen: the toy makes room for it
  missionsOpen: false,
  humanOpen: false,
  toast: null,
  nudge: 0,
  tutorial: null, // null | "enter" | "back": the one-time zoom lesson
  overview: false, // "All topics": every bubble, one zoom out from the guided path
  overlayClose: null, // closes the reading overlay on Escape
  setOverview(overview) {
    set({ overview });
  },
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
    if (!base.missions.startedAt) base.missions = { ...base.missions, startedAt: new Date().toISOString().slice(0, 10) };
    if (!base.missions.when) base.missions = { ...base.missions, when: {} };
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
      // Once the walk-through is done, every visit opens on the cloud of bubbles.
      home: Boolean(base.journeyDone),
      overview: false,
      trail: [],
    });
    replaceNav(base.journeyDone ? { v: "home" } : { b: plan.order[0] });
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
    const s = get();
    // The flat view has no "steps" bubble: land on its map instead of an empty screen.
    if (easy && s.focus === "steps") set({ easy, focus: null, level: 3, overview: false });
    // Back to the bubbles: there must always be one bubble in focus, or the screen stays empty.
    else if (!easy && !s.simple && (!s.focus || s.level === 4)) set({ easy, level: 3, overview: false, focus: s.focus || (s.journeyDone ? "steps" : s.plan.order[0]) });
    else if (!easy && s.level === 4) set({ easy, level: 3 });
    else set({ easy, overview: false });
    get().log({ type: "easy_mode", on: easy });
  },
  setMuted(muted) {
    voice.muted = muted;
    // Muting finishes the current line instead of cancelling it, so nothing waits forever.
    if (muted) stopSpeaking("mute");
    set({ muted });
  },

  // ---- zoom ----
  setPhase(phase) {
    set({ phase });
  },
  // The three places of a returning visit: the cloud (your plan), this month, the meeting.
  goHome() {
    const s = get();
    stopSpeaking();
    if (s.flat()) return set({ phase: "cloud", home: true, focus: null, level: 3, overview: false, missionsOpen: false });
    set({ phase: "cloud", home: true, level: 3, overview: false, missionsOpen: false, focus: s.focus && s.focus !== "steps" ? s.focus : s.plan.order[0] });
    pushNav({ v: "home" });
  },
  // "Back to …": the bubble you were on before this one.
  backToLast() {
    const s = get();
    const prev = s.trail.at(-1);
    if (!prev) return;
    if (typeof history !== "undefined" && history.state?.b) history.back();
    else get().jump(prev);
  },
  // Zoom: All topics ‹ Outside ‹ Inside ‹ In detail. "In" goes one stop deeper, "out" one wider.
  stepIn() {
    const s = get();
    set({ zoomHinted: true });
    if (s.overview) return set({ overview: false });
    if (s.home) return get().jump(s.focus);
    if (s.level === 3) return get().enter(s.focus);
    if (s.level === 2 && s.focus !== "steps") return get().setLevel(1);
  },
  stepOut() {
    const s = get();
    set({ zoomHinted: true });
    if (s.level === 1) return get().setLevel(2);
    if (s.level === 2) return get().setLevel(3);
    if (s.level === 3 && !s.home && !s.overview) return s.journeyDone ? get().goHome() : set({ overview: true });
  },
  dismissZoomHint() {
    set({ zoomHinted: true });
  },
  openMonthPage() {
    stopSpeaking();
    set({ phase: "month", home: false, overview: false, missionsOpen: false, journeyDone: true });
    pushNav({ v: "month" });
    get().log({ type: "open_month" });
  },
  openMeeting() {
    stopSpeaking();
    set({ phase: "meeting", home: false, overview: false, missionsOpen: false, journeyDone: true });
    pushNav({ v: "meeting" });
    get().log({ type: "open_meeting" });
  },
  // One bubble at a time. Each bubble is its own little world with three zoom stops:
  // 3 outside (one sentence), 2 inside (explained, with its toy), 1 deep (the figures).
  flat() {
    const s = get();
    return s.easy || s.simple;
  },
  seq() {
    const s = get();
    // The walk-through visits every bubble, then ends on the plan of action.
    return s.flat() ? s.allTopics() : [...s.allTopics(), "steps"];
  },
  // Every topic, in walk order.
  allTopics() {
    const s = get();
    return [...s.plan.order, ...s.plan.bubbles.map((b) => b.id).filter((id) => !s.plan.order.includes(id))];
  },
  bubble(id) {
    const s = get();
    if (id !== "steps") return s.plan?.bubbles.find((b) => b.id === id);
    return {
      id: "steps",
      title: "Your next steps",
      status: "neutral",
      building: `${s.missions.active.length === 1 ? "Your mission" : `Your ${s.missions.active.length} missions`} for month ${s.missions.month}, straight from your plan.`,
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
    // The trail: where you came from. Going back pops it instead of growing it.
    let trail = s.trail;
    if (restoring) trail = trail.at(-1) === id ? trail.slice(0, -1) : trail;
    else if (s.focus && s.focus !== id && !s.home && (s.phase === "cloud" || s.phase === "journey")) trail = [...trail, s.focus].slice(-20);
    set({
      focus: id,
      level,
      fact: null,
      overview: false,
      home: false,
      trail,
      visited: { ...s.visited, [id]: true },
      lastFocus: id === "steps" ? s.lastFocus : id,
      journeyDone: s.journeyDone || last,
      phase: s.phase === "journey" && last ? "cloud" : s.phase,
    });
    pushNav({ b: id });
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
    get().openMeeting();
  },
  enter(id) {
    const p = PROFILES[get().profile().kind];
    // In the bubble world, stepping inside always lands on the simple version first.
    set({ focus: id, level: id === "steps" || !get().flat() ? 2 : p.enter, fact: null, home: false });
    get().markExplored(id);
    get().logView();
  },
  // Stepping into a bubble lights it up. All of them lit: the whole cloud celebrates.
  markExplored(id) {
    const s = get();
    if (!id || id === "steps" || s.explored[id]) return;
    const explored = { ...s.explored, [id]: true };
    const all = s.allTopics().every((t) => explored[t]);
    set({ explored, lit: id, allLit: all });
    sfx("ding");
    get().log({ type: "explored", bubble: id, count: Object.keys(explored).length });
    setTimeout(() => get().lit === id && set({ lit: null }), 1800);
  },
  setGuess(id, value) {
    set((s) => ({ guessed: { ...s.guessed, [id]: value } }));
    get().log({ type: "guess", bubble: id, value });
  },
  closeAllLit() {
    set({ allLit: false });
  },
  // The wording each zoom stop uses. In the bubble world: inside = simple, deeper = detailed.
  styleNow() {
    const s = get();
    // Bubble world and easy mode: the explanation is the simple one; the detail is a level down.
    if (!s.flat() || s.easy) return s.level <= 1 ? "standard" : "plain";
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
    set({ level, focus, fact: null, ...(level <= 2 ? { home: false } : {}) });
    if (level <= 2) get().markExplored(focus);
    if (level <= 2) get().logView();
  },
  back() {
    const s = get();
    if (s.phase === "meeting") return get().openMonthPage();
    if (s.phase === "month") return get().goHome();
    if (s.home) return;
    // After the walk-through, stepping back out of a bubble lands on the cloud.
    if (s.level === 3 && !s.flat() && s.journeyDone && s.phase === "cloud") return get().goHome();
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
    // Easy mode always explains simply: "simpler" only steps back out, never rewrites the text.
    if (s.easy) return s.level === 2 && s.phase !== "journey" ? get().setLevel(3) : s.level === 3 ? get().setLevel(4) : null;
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
    if (s.easy) return s.level === 2 ? get().setLevel(1) : null;
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
    set({ phase: "journey", journeyIndex: 0, focus: first, fact: null, level: s.flat() ? PROFILES[s.profile().kind].enter : 3, visited: { ...s.visited, [first]: true }, lastFocus: first, trail: [] });
    replaceNav({ b: first });
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
    // The step the person committed to comes first; then any started one; then the next open one.
    const open = s.activeMissions().filter((m) => s.missions.status[m.id] !== "done");
    return open.find((m) => s.missions.status[m.id] === "active" && s.missions.when?.[m.id]) || open.find((m) => s.missions.status[m.id] === "active") || open[0] || null;
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
    if (status === "done" && !extra.undone && !extra.quiet) {
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
    if (open) return get().openMonthPage();
    set({ missionsOpen: open });
  },
  startNextMonth(ids) {
    set((s) => ({
      missions: {
        month: s.missions.month + 1,
        active: ids,
        status: s.missions.status,
        history: [...s.missions.history, { month: s.missions.month, ids: s.missions.active, done: s.missions.active.filter((id) => s.missions.status[id] === "done") }],
        when: {},
        startedAt: new Date().toISOString().slice(0, 10),
      },
      day: 0,
      // The new month opens on its own page.
      phase: "month",
      home: false,
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
    set((s) => ({ chat: { ...s.chat, open: false, quote: null, support: false } }));
  },
  // The headset button: the chat opens as a help desk, and every answer ends by asking whether
  // it is all clear or the person would rather speak with someone.
  openSupport() {
    stopSpeaking();
    const greeting = { role: "assistant", greeting: true, text: "Hi, I am here to help. What would you like to know about your plan?" };
    set((s) => {
      const last = s.chat.messages.at(-1);
      return { chat: { ...s.chat, open: true, quote: null, support: true, messages: last?.greeting ? s.chat.messages : [...s.chat.messages, greeting] } };
    });
    get().log({ type: "support_open" });
  },
  answerFollowUp(index, choice) {
    set((s) => ({ chat: { ...s.chat, messages: s.chat.messages.map((m, i) => (i === index ? { ...m, followUp: choice } : m)) } }));
    get().log({ type: "support_follow_up", choice });
    if (choice === "human") set({ humanOpen: true });
  },
  async ask(question) {
    const s = get();
    const b = s.plan.bubbles.find((x) => x.id === s.focus);
    const quote = s.chat.quote;
    const userMsg = { role: "user", text: question, quote };
    set({ chat: { ...s.chat, open: true, quote: null, pending: true, messages: [...s.chat.messages, userMsg] } });
    if (b) set((st) => ({ asked: { ...st.asked, [b.id]: [...(st.asked[b.id] || []), { q: question, quote, month: st.missions.month }] } }));
    // Asking for a person never waits on the model: the way to reach one opens straight away.
    if (wantsHuman(question)) {
      const reply = { text: "Of course. A person at your advisor's firm can talk this through with you. I have opened the way to reach them.", actions: [{ type: "talk_to_human", label: "Talk to a person" }] };
      set((st) => ({ humanOpen: true, chat: { ...st.chat, pending: false, messages: [...st.chat.messages, { role: "assistant", ...reply }] } }));
      return reply;
    }
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
        history: s.chat.messages.filter((m) => !m.greeting).slice(-6).map((m) => ({ role: m.role, text: m.text })),
      });
    } catch {
      reply = { text: "I could not reach the plan helper just now. Please try again in a moment.", actions: [] };
    }
    // From the headset button, the answer ends with "all clear, or a person?" (which already
    // offers the person, so a second "Talk to a person" button is left out).
    const support = get().chat.support;
    const actions = (reply.actions || []).filter((a) => !support || a.type !== "talk_to_human");
    set((st) => ({ chat: { ...st.chat, pending: false, messages: [...st.chat.messages, { role: "assistant", text: reply.text, actions, ...(support ? { followUp: "open" } : {}) }] } }));
    return support ? { ...reply, followUp: true } : reply;
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
    if (typeof document !== "undefined") document.documentElement.classList.toggle("calm-motion", reduced);
  },
  // "auto" follows the system setting; "full" and "calm" are the person's own choice.
  motion: (() => {
    try {
      return localStorage.getItem("burbuja:motion") || "auto";
    } catch {
      return "auto";
    }
  })(),
  setMotion(motion) {
    try {
      localStorage.setItem("burbuja:motion", motion);
    } catch {}
    const os = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    set({ motion });
    get().setReduced(motion === "calm" || (motion === "auto" && os));
  },

  // The whole plan as a PDF, with this person's progress, saved straight to their device.
  reportBusy: false,
  async downloadReport() {
    const s = get();
    if (!s.family || s.reportBusy) return;
    set({ reportBusy: true });
    try {
      const { blob, name } = await api.report({ family: s.family, person: s.person, missions: s.missions, notes: s.notes, explored: s.explored });
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), { href: url, download: name });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      get().showToast({ text: `Saved ${name} to your downloads.` });
    } catch {
      get().showToast({ text: "The PDF could not be made just now. Please try again in a moment." });
    } finally {
      set({ reportBusy: false });
    }
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
