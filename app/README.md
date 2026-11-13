# Burbuja (app)

A Sherpas plan explained at your level: glass bubbles in 3D, a voice, mini apps, a chat that knows what is on screen, monthly missions, a podcast-style review and a month-end check-in. The idea is in [`../docs/IDEA.md`](../docs/IDEA.md).

## Run it

Needs Node 22 or later and a `.env` at the repo root with `MCP_TOKEN` and `TEAM_KEY`.

```bash
cd app
npm install
npm run dev        # API on :8787, app on http://localhost:5173
```

One process, production build: `npm start`, then open http://localhost:8787.

## How it uses the keys

- **`MCP_TOKEN`**: the backend reads the four cases from the Sherpas MCP. If the token is missing or expired (72 h), it falls back to the same files in `../cases/`.
- **`TEAM_KEY`**: text (`gpt-5-mini`), speech (`eleven-flash-v2.5`) and transcription (`scribe-v2`) through the AI proxy. Keys never reach the browser.
- **Spending cap**: `AI_BUDGET_USD` (default 3) and `TTS_BUDGET_USD` (default 1.2). Spend is tracked in `data/usage.json`. Past the cap, the chat answers from the plan text and the voice falls back to the browser.
- **Caches**: wording per family in `data/generated/`, audio in `data/audio/`. Run `npm run pregen` to regenerate the wording.

## Where things are

| Path | What |
|---|---|
| `server/script.mjs` | Builds each family's script: bubbles, mini-app data, must-knows, moves, missions. Every figure comes from the plan; model-written sentences with a figure that is not in the plan are rejected |
| `server/index.mjs` | API: plan, identify documents, Ask Sherpas, speech, month review, check-in, audit log |
| `src/scene/World3D.jsx` | Three.js world: glass bubbles and the camera that travels between the four floors |
| `src/ui/` | Landing, calibration, panels per floor, chat, missions, month end |
| `src/miniapps/` | The interactive pieces inside each bubble |
| `data/logs/audit.jsonl` | What was shown and confirmed (must-knows seen, quiz answers, decisions) |
