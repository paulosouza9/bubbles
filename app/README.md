# Financial Coach (app)

A Sherpas plan explained at your level: glass bubbles in 3D, a voice, mini apps, a chat that knows what is on screen, monthly missions, a podcast-style review and a month-end check-in. The idea is in [`../docs/IDEA.md`](../docs/IDEA.md).

## Run it

Needs Node 22 or later and a `.env` at the repo root with `MCP_TOKEN` and `TEAM_KEY`.

```bash
cd app
npm install
npm run dev        # API on :8787, app on http://localhost:5173
```

One process, production build: `npm start`, then open http://localhost:8787.

## Interface and 3D preview

The app keeps the original pill buttons, circular icon buttons, glass surfaces, typography and page layouts. The larger top bubble strip includes its current-topic label and horizontal scrolling on phones. The added Three.js preview supports dragging and keyboard rotation, respects reduced motion and uses the existing non-WebGL fallback. Household plans, document upload, voice, chat, missions and monthly review remain available.

Validation: production build, rendered desktop and phone layouts, keyboard rotation, household opening, upload and server error recovery, bubble detail navigation, monthly navigation and Easy mode. Browser checks use synthetic households and intercept audit and speech requests.

## How it uses the keys

- **`MCP_TOKEN`**: the backend reads the four cases from the Sherpas MCP. If the token is missing or expired (72 h), it falls back to the same files in `../cases/`.
- **`TEAM_KEY`**: text (`gpt-5-mini`), speech (`eleven-flash-v2.5`) and transcription (`scribe-v2`) through the AI proxy. Keys never reach the browser.
- **Spending cap**: `AI_BUDGET_USD` (default 3) and `TTS_BUDGET_USD` (default 1.2). Spend is tracked in `data/usage.json`. Past the cap, the chat answers from the plan text and the voice falls back to the browser.
- **Caches**: wording per family in `data/generated/`, audio in `data/audio/`. Run `npm run pregen` to regenerate the wording.

## Live month-end check-in

In the month-end meeting, "Then talk it through" is a live voice conversation with the coach (`gpt-realtime-2.1-mini` through the AI proxy's `/v1/realtime`). The browser streams the microphone to `/api/realtime` on this server, which holds the key, writes the coach's instructions, this household's brief and its tools, and passes audio both ways. When the coach records something (a mission's status, a life change, a worry, a flag for a person, the end of the check-in) the server checks it against this month's missions before the page applies it, as the typed check-in does. The person can also type a line during the conversation.

- **Settings** (in `.env`): `REALTIME_MODEL` (default `gpt-realtime-2.1-mini`, or `gpt-realtime-2.1`), `REALTIME_VOICE` (default `marin`), `REALTIME_MAX_SECONDS` (default 480) and `REALTIME_BUDGET_USD` (default 3, estimated from token counts, tracked as `realtimeUsd` in `data/usage.json`).
- **Fallback:** the typed check-in takes over in Easy mode, without a microphone, past the budget, or for 5 minutes after the voice service refuses the connection. `/api/status` shows which (`realtime`).

## Where things are

| Path | What |
|---|---|
| `server/script.mjs` | Builds each family's script: bubbles, mini-app data, must-knows, moves, missions. Every figure comes from the plan; model-written sentences with a figure that is not in the plan are rejected |
| `server/report.mjs` | The whole plan as a PDF (`POST /api/report`): cover, plan at a glance, recommendations, every topic in plain words and in detail, the person's progress. Offered once the walk-through is done |
| `server/realtime.mjs` | Relay for the live check-in: session, coach instructions, tools and their checks, time limit and budget |
| `server/index.mjs` | API: plan, identify documents, Ask Sherpas, speech, month review, check-in, audit log |
| `src/scene/World3D.jsx` | Three.js world: glass bubbles and the camera that travels between the four floors |
| `src/ui/` | Landing, calibration, panels per floor, chat, missions, month end |
| `src/miniapps/` | The interactive pieces inside each bubble |
| `data/logs/audit.jsonl` | What was shown and confirmed (must-knows seen, quiz answers, decisions) |
