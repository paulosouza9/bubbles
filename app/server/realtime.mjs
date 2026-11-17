// The live month-end check-in: a realtime voice conversation through the AI proxy.
//
//   browser (mic + speaker)  <->  /api/realtime (this relay)  <->  wss://<proxy>/v1/realtime
//
// The team key stays here. The relay owns the session: it writes the coach's instructions,
// the household's brief and the tools, so nothing the browser sends can change them. From the
// browser it only passes on audio, interruption events and typed lines (sent as the person's
// own words). When the model calls a tool (a
// mission's status, a life change, a worry, a flag for a person, the end of the check-in) the
// relay checks it against this month's missions before the page applies it, exactly as the
// typed check-in does. Every session has a time limit, and none opens once the realtime
// budget is spent; the page then falls back to the typed check-in.
import { WebSocket, WebSocketServer } from "ws";
import { config } from "./env.mjs";
import { addRealtimeSeconds, addRealtimeSpend, realtimeLeft } from "./llm.mjs";
import { buildPlan } from "./script.mjs";

const PATH = "/api/realtime";
// The only events the page may send upstream: audio, and what it needs to handle interruptions.
const FROM_PAGE = new Set(["input_audio_buffer.append", "conversation.item.truncate", "response.cancel"]);
const STATUS_WORD = { done: "done", active: "started", todo: "not started yet" };

// After the voice service refuses us (an expired or invalid key), the page goes straight to
// the typed check-in for a while instead of failing again in front of the person.
let downUntil = 0;
let downReason = "";
const markDown = (reason) => {
  downUntil = Date.now() + 5 * 60_000;
  downReason = reason;
  console.log(`[realtime] unavailable for 5 minutes: ${reason}`);
};

export function realtimeStatus() {
  if (!config.teamKey) return { available: false, reason: "no team key" };
  if (realtimeLeft() <= 0) return { available: false, reason: "realtime budget reached" };
  if (Date.now() < downUntil) return { available: false, reason: downReason };
  return { available: true, model: config.realtimeModel, maxSeconds: config.realtimeMaxSeconds };
}

const clip = (s, n = 200) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

function instructions(plan, name, month, missions) {
  const people = (plan.household || []).map((p) => `${p.first_name || p.name} (${p.role}${p.age ? `, ${p.age}` : ""})`).join(", ");
  const list = missions.length
    ? missions.map((m, i) => `${i + 1}. [${m.id}] "${m.title}". Status: ${STATUS_WORD[m.status] || "not started yet"}.${m.why ? ` Why it matters: ${m.why}` : ""}`).join("\n")
    : "No missions this month.";
  return `You are the Financial Coach. You are running a short, warm month-end check-in, by voice, with ${name} about their existing financial plan from Sherpas. This is the end of month ${month}.

How you talk: short, natural, spoken sentences. One question at a time, then listen. English. Calm and kind, never salesy. If they interrupt you, stop and answer what they said.

What you know. Use only these facts and figures; never invent, estimate or work out a number.
- Household: ${people || name}.
- Financial health score: ${plan.score?.value ?? "unknown"} out of 100 (${plan.score?.band ?? "unknown"}).
- This month's missions:
${list}

The agenda, in this order, about five minutes in all:
1. Greet ${name} by name and ask how the month has gone. If missions are already done, mention them warmly.
2. For each mission that is not done, ask whether they got to it, or what is in the way. Call set_mission_status with what they tell you: done, in_progress (they started) or not_done, with a short blocker if they named one. If it is not done, say it carries over with no penalty.
3. Ask whether anything changed for them this month: work, family, a big expense. If something real changed, call note_life_change and tell them you have noted it so their advisor's firm can update the plan's intake. You do not recalculate anything.
4. Ask whether anything about money is worrying them right now. If so, call note_worry.
5. Close: tell them the last step is on screen, choosing up to three missions for next month, and that nothing is decided until they confirm each one. Say goodbye, then call end_checkin.

Rules:
- You listen and explain. You never give new financial advice, never recommend a product, never recalculate the plan and never confirm a decision for them.
- If they ask for advice beyond the plan, or mention a big or hard-to-undo decision, distress, or anything outside the plan, say a person at their advisor's firm can help with that, and call flag_for_person.
- Only use the mission ids listed above with set_mission_status.
- You may get a note that ${name} ticked a mission on screen. Treat that mission as done and do not ask about it again.
- If they want to stop, close politely and call end_checkin.`;
}

function tools(missionIds) {
  const text = (description) => ({ type: "string", description });
  return [
    {
      type: "function",
      name: "set_mission_status",
      description: "Record what the person said about one of this month's missions.",
      parameters: {
        type: "object",
        properties: {
          mission_id: { type: "string", enum: missionIds.length ? missionIds : ["none"] },
          status: { type: "string", enum: ["done", "in_progress", "not_done"] },
          blocker: text("What is in the way, in a few words, if they said."),
        },
        required: ["mission_id", "status"],
      },
    },
    {
      type: "function",
      name: "note_life_change",
      description: "Note a real change in work, family or a big expense, for the advisor's firm to update the plan's intake.",
      parameters: { type: "object", properties: { summary: text("The change, in one short phrase.") }, required: ["summary"] },
    },
    {
      type: "function",
      name: "note_worry",
      description: "Note something about money that worries the person.",
      parameters: { type: "object", properties: { summary: text("The worry, in one short phrase.") }, required: ["summary"] },
    },
    {
      type: "function",
      name: "flag_for_person",
      description: "Flag that a person at the advisor's firm should follow up.",
      parameters: { type: "object", properties: { reason: text("Why, in one short phrase.") }, required: ["reason"] },
    },
    { type: "function", name: "end_checkin", description: "The check-in is over. Call it after saying goodbye.", parameters: { type: "object", properties: {} } },
  ];
}

export function attachRealtime(server, { log = () => {} } = {}) {
  const wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", (req, socket, head) => {
    if (new URL(req.url, "http://localhost").pathname !== PATH) return socket.destroy();
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  });

  wss.on("connection", (page, req) => {
    const family = new URL(req.url, "http://localhost").searchParams.get("family") || "";
    const model = config.realtimeModel;
    const toPage = (ev) => page.readyState === WebSocket.OPEN && page.send(typeof ev === "string" ? ev : JSON.stringify(ev));
    const fail = (code, message) => {
      toPage({ type: "app.error", code, message });
      page.close();
    };
    const status = realtimeStatus();
    if (!status.available) return fail("unavailable", status.reason);

    let plan = null;
    let name = "";
    let missions = []; // this month's missions: { id, title, why, status }
    let upstream = null;
    let ended = false;
    let followUp = false;
    let ready = false;
    let audioSeconds = 0;
    const timers = [];
    const opened = Date.now();

    const sendUp = (ev) => upstream?.readyState === WebSocket.OPEN && upstream.send(JSON.stringify(ev));
    const systemNote = (text) => sendUp({ type: "conversation.item.create", item: { type: "message", role: "system", content: [{ type: "input_text", text }] } });
    const closeAll = () => {
      timers.forEach(clearTimeout);
      if (upstream && upstream.readyState <= WebSocket.OPEN) upstream.close();
      if (page.readyState <= WebSocket.OPEN) page.close();
    };
    // Time or budget is up: let the coach say a short goodbye, then hang up either way.
    const windDown = (reason) => {
      if (ended) return;
      ended = true;
      systemNote("Time is up for today. In one or two sentences, thank them, remind them to choose next month's missions on screen, and say goodbye. Do not call any tool.");
      sendUp({ type: "response.create" });
      toPage({ type: "app.end", reason });
      timers.push(setTimeout(closeAll, 25_000));
    };

    // The model's tool calls, checked here before the page sees them.
    const handleCall = (callName, argsText) => {
      let args = {};
      try {
        args = JSON.parse(argsText || "{}");
      } catch {
        return { ok: false, error: "arguments were not valid JSON" };
      }
      if (callName === "set_mission_status") {
        const m = missions.find((x) => x.id === args.mission_id);
        if (!m) return { ok: false, error: "not one of this month's missions" };
        if (!["done", "in_progress", "not_done"].includes(args.status)) return { ok: false, error: "unknown status" };
        const blocker = clip(args.blocker, 140) || null;
        m.status = args.status === "done" ? "done" : args.status === "in_progress" ? "active" : m.status;
        toPage({ type: "app.update", kind: "mission", id: m.id, title: m.title, status: args.status, blocker });
        return { ok: true };
      }
      if (callName === "note_life_change" || callName === "note_worry" || callName === "flag_for_person") {
        const text = clip(args.summary ?? args.reason);
        if (!text) return { ok: false, error: "empty" };
        const kind = { note_life_change: "lifeChange", note_worry: "worry", flag_for_person: "flagHuman" }[callName];
        toPage({ type: "app.update", kind, text });
        return { ok: true };
      }
      if (callName === "end_checkin") {
        ended = true;
        toPage({ type: "app.end", reason: "done" });
        // The page hangs up once the goodbye has played; this is only a safety net.
        timers.push(setTimeout(closeAll, 30_000));
        return { ok: true };
      }
      return { ok: false, error: "unknown tool" };
    };

    const onUpstream = (data) => {
      const raw = data.toString();
      let ev;
      try {
        ev = JSON.parse(raw);
      } catch {
        return;
      }
      if (ev.type === "response.function_call_arguments.done") {
        const result = handleCall(ev.name, ev.arguments);
        log({ type: "realtime_tool", family, person: name, tool: ev.name, args: clip(ev.arguments, 300), result });
        sendUp({ type: "conversation.item.create", item: { type: "function_call_output", call_id: ev.call_id, output: JSON.stringify(result) } });
        if (ev.name !== "end_checkin") followUp = true;
        return; // the page learns about calls through app.update, not raw
      }
      if (ev.type === "session.updated" && !ready) {
        // The service accepted the session: only now is the check-in live.
        ready = true;
        sendUp({ type: "response.create" }); // the coach opens the conversation
        toPage({ type: "app.ready", model, maxSeconds: config.realtimeMaxSeconds, person: name });
        timers.push(setTimeout(() => windDown("time"), config.realtimeMaxSeconds * 1000));
        log({ type: "realtime_open", family, person: name, model, missions: missions.map((m) => `${m.id}:${m.status}`) });
        return;
      }
      if (ev.type === "error") {
        const code = ev.error?.code || ev.error?.type || "";
        if (/expired|invalid_api_key|secret_key|unauthori|forbidden|quota|billing/i.test(`${code} ${ev.error?.message || ""}`)) {
          markDown(code || "refused by the voice service");
          return fail("unavailable", "The live voice is not available right now. You can type instead.");
        }
        if (!ready) return fail("proxy", "The live voice could not start. You can type instead.");
      }
      if (ev.type === "response.done") {
        const u = ev.response?.usage;
        if (u) addRealtimeSpend(model, u);
        if (followUp && !ended) sendUp({ type: "response.create" });
        followUp = false;
        if (!ended && realtimeLeft() <= 0) windDown("budget");
      }
      toPage(raw);
    };

    const start = async (msg) => {
      try {
        plan = await buildPlan(family);
      } catch {
        return fail("unknown_family", "That household could not be found.");
      }
      name = plan.names.includes(msg.person) ? msg.person : plan.names[0];
      const month = Number(msg.month) || 1;
      // Only this plan's missions, with the status the page shows right now.
      missions = (Array.isArray(msg.missions) ? msg.missions : [])
        .map((x) => {
          const m = plan.missionPool.find((p) => p.id === x?.id);
          return m && { id: m.id, title: m.title, why: m.why, status: ["done", "active", "todo"].includes(x.status) ? x.status : "todo" };
        })
        .filter(Boolean)
        .slice(0, 6);

      upstream = new WebSocket(`${config.proxyUrl.replace(/^http/, "ws")}/v1/realtime?model=${encodeURIComponent(model)}`, {
        headers: { Authorization: `Bearer ${config.teamKey}` },
      });
      upstream.on("open", () => {
        sendUp({
          type: "session.update",
          session: {
            type: "realtime",
            instructions: instructions(plan, name, month, missions),
            tools: tools(missions.map((m) => m.id)),
            tool_choice: "auto",
            audio: {
              input: {
                format: { type: "audio/pcm", rate: 24000 },
                transcription: { model: "gpt-4o-mini-transcribe" },
                // Waits until they seem to have finished the thought, not just for a pause.
                turn_detection: { type: "semantic_vad", eagerness: "low" },
              },
              output: { format: { type: "audio/pcm", rate: 24000 }, voice: config.realtimeVoice },
            },
          },
        });
      });
      upstream.on("message", onUpstream);
      upstream.on("unexpected-response", (_req, res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          console.log(`[realtime] proxy refused: HTTP ${res.statusCode} ${body.slice(0, 200)}`);
          if (res.statusCode === 401 || res.statusCode === 403) markDown(`HTTP ${res.statusCode}`);
          fail("proxy", "The live voice is not available right now. You can type instead.");
        });
      });
      upstream.on("error", (e) => console.log(`[realtime] proxy error ${e.message}`));
      upstream.on("close", (code) => {
        // Closed by the service mid-conversation, not by us or the person: say so.
        if (!ended && page.readyState === WebSocket.OPEN) toPage({ type: "app.error", code: "closed", message: `The live conversation was cut off (${code}). You can try again or type instead.` });
        closeAll();
      });
    };

    page.on("message", (data) => {
      let ev;
      try {
        ev = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (!upstream) {
        if (ev.type === "app.start") start(ev);
        return;
      }
      if (ev.type === "app.missions" && Array.isArray(ev.missions)) {
        // A tick on screen during the conversation: tell the coach, quietly.
        for (const x of ev.missions) {
          const m = missions.find((y) => y.id === x?.id);
          if (m && x.status === "done" && m.status !== "done") {
            m.status = "done";
            systemNote(`On screen, ${name} just ticked "${m.title}" as done.`);
          }
        }
        return;
      }
      if (ev.type === "app.say") {
        // A typed line during the live check-in: always the person's own words, never instructions.
        const text = clip(ev.text, 500);
        if (!text || ended) return;
        sendUp({ type: "response.cancel" });
        sendUp({ type: "conversation.item.create", item: { type: "message", role: "user", content: [{ type: "input_text", text }] } });
        sendUp({ type: "response.create" });
        return;
      }
      if (!FROM_PAGE.has(ev.type)) return;
      if (ev.type === "input_audio_buffer.append" && typeof ev.audio === "string") audioSeconds += (ev.audio.length * 0.75) / 2 / 24000;
      sendUp(ev);
    });
    page.on("close", () => {
      closeAll();
      if (audioSeconds > 0) addRealtimeSeconds(audioSeconds);
      if (plan) log({ type: "realtime_close", family, person: name, seconds: Math.round((Date.now() - opened) / 1000) });
    });
    // The page must say who it is and what is ticked first; otherwise nothing opens.
    timers.push(setTimeout(() => !upstream && fail("no_start", "The check-in did not start."), 10_000));
  });
}
