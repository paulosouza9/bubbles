<p align="center">
  <img src="assets/banner.png" alt="Bring the plan to life. Sherpas x UPV Sigma Data Club, 12 to 19 November 2026" width="100%">
</p>

# Financial Advisor / Coach

**A Sherpas financial plan, explained at your level, and a coach that stays with you every month.**

Built for the **Sherpas x UPV Sigma Data Club hackathon** (12 to 19 November 2026), challenge *"Bring the plan to life"*. The original brief is in [`docs/HACKATHON-BRIEF.md`](docs/HACKATHON-BRIEF.md).

> Internal codename: **Burbuja** ("bubble"). You will see it in the code and in [`docs/IDEA.md`](docs/IDEA.md).

---

## The problem

[Sherpas Wealth](https://sherpaswealth.com) already does two of an advisor's three jobs for every new client:

| | Job | Today |
|---|---|---|
| 1 | Collect the data | Done by Sherpas (**Intake**) |
| 2 | Do the math | Done by Sherpas (**Paraplanner**, **Portfolio analyst**) |
| 3 | **Explain the plan** | Still done by hand, one meeting at a time. **This is what we built.** |

A good plan sent as a PDF is still too much at once: new vocabulary, a few seconds of attention, and nobody beside you to explain it again. We design for families who may **never** meet an advisor, so the plan has to land on its own. For high-impact decisions, a real person is always one tap away.

## What it does

1. **Start from documents or from an existing Intake.** Drop your documents and they dissolve into bubbles, or open a personal link and skip the upload entirely.
2. **Calibrate in 20 seconds.** Three questions (by voice or buttons) set how deep and how technical the explanation should be. Easy mode is offered to everyone.
3. **One bubble at a time.** Glass bubbles in 3D (cash flow, emergency fund, home, debt, protection, children, retirement). A voice narrates each one, and inside is a small interactive **mini app** to play with the numbers.
4. **Zoom = depth of knowledge.** Like entering a building floor by floor: city (one sentence for your whole financial life) → building (one line per bubble) → floor (the explanation and mini app) → desk (exact figures). A real Three.js camera travels through the glass. Buttons and keyboard work too.
5. **Ask at any moment.** A chat at the bottom knows what is on screen. Select any text and **Ask Sherpas** appears.
6. **Nothing important is hidden.** "Must know" facts appear at every zoom level, and a decision card with a quick comprehension check comes before any action.
7. **Every month, a cycle.** Three missions taken from the plan's top moves, a monthly review you can explore or listen to like a podcast, and a **live voice check-in** at month end to see how it went.
8. **Take it with you.** Once the walk-through is done, download the whole plan as a PDF: plan at a glance, recommendations, every topic in plain words and in detail, and your progress.

## Rules we never break

- **No invented numbers.** Every figure comes from the family's plan in [`cases/`](cases/). Model-written sentences containing a figure that is not in the plan are rejected. If something is not in the plan, the app says so.
- **The model chooses and explains; it never calculates.** Projections and scenarios are always the plan's own.
- **Simplify the language, never the content.**
- **Voice never blocks.** Everything spoken is also on screen and can be muted.
- **Keys live only on the backend.** The team AI key and the MCP token never reach the browser.
- **For any age.** Every gesture has a button and a voice alternative.

## The cases

Four US households from Sherpas, read from the Sherpas MCP (with a local fallback to [`cases/`](cases/)):

| Family | Score | Why it is interesting |
|---|---|---|
| [Michael Carter](cases/michael-carter/) | 26 · critical | Saves 23.9% of income, but the money goes in the wrong order. **Our demo case.** |
| [Daniel & Emily Johnson](cases/daniel-emily-johnson/) | 52 · vulnerable | Two kids, two incomes, almost no protection |
| [Timothy & Melanie Weah](cases/timothy-melanie-weah/) | 60 · capped | High-rate card debt and low life cover cap the score |
| [Samantha Lewis](cases/samantha-lewis/) | 82 · strong | A good score that hides savings running out at 73 |

## Run it

Needs **Node 22 or later** and a `.env` file at the repo root:

```env
MCP_TOKEN=your-personal-mcp-token
TEAM_KEY=your-team-ai-key
```

Both come from the [hackathon access page](https://mcp-hackathon.sherpaswealth.com/personal-token). Without `MCP_TOKEN` (or once it expires after 72 h) the app reads the same data from `cases/`.

```bash
cd app
npm install
npm run dev        # API on :8787, app on http://localhost:5173
```

Single process, production build:

```bash
cd app
npm start          # builds, then serves everything on http://localhost:8787
```

To regenerate each family's wording: `npm run pregen`.

### Optional settings

| Variable | Default | What |
|---|---|---|
| `TEXT_MODEL` | `gpt-5-mini` | Script, chat and month review |
| `TTS_MODEL` | `eleven-flash-v2.5` | Narration voice (ElevenLabs) |
| `STT_MODEL` | `scribe-v2` | Voice input transcription |
| `REALTIME_MODEL` | `gpt-realtime-2.1-mini` | Live month-end check-in |
| `REALTIME_VOICE` | `marin` | Voice for the live check-in |
| `REALTIME_MAX_SECONDS` | `480` | Max length of a live check-in |
| `AI_BUDGET_USD` | `3` | Text spending cap |
| `TTS_BUDGET_USD` | `1.2` | Speech spending cap (team ElevenLabs limit is $1.40) |
| `REALTIME_BUDGET_USD` | `3` | Live check-in spending cap |
| `PORT` | `8787` | API port |

Spend is tracked in `app/data/usage.json`. Past a cap the app degrades gracefully: the chat answers from the plan text, narration falls back to the browser's built-in voice, and the live check-in becomes a typed one. `GET /api/status` shows which mode is active.

## How it works

```
 Browser (React + Three.js)                     Backend (Node + Express)                External
 ───────────────────────────                     ────────────────────────                ────────
 3D bubbles, floors, mini apps  ── /api/plan ──▶  script.mjs  builds bubbles,   ──▶  Sherpas MCP (cases)
 Chat + "Ask Sherpas"           ── /api/ask  ──▶  must-knows, missions;              └▶ local cases/ fallback
 Narration, voice input         ── /api/tts, /api/stt ──▶ checks every figure  ──▶  Sherpas AI proxy
 Missions + month review        ── /api/month, /api/checkin                          (gpt-5-mini, ElevenLabs,
 Live check-in (mic stream)     ── ws /api/realtime ──▶ realtime.mjs relay      ──▶   scribe, realtime)
 Plan PDF                       ── /api/report ──▶ report.mjs (pdfkit)
```

- **Frontend:** React 19, Vite, Three.js via `@react-three/fiber` and `drei`, Zustand. Respects `prefers-reduced-motion` and has a non-WebGL fallback.
- **Backend:** Express 5, the MCP SDK for case data, `ws` for the realtime relay, `pdfkit` for the report, `unpdf` to identify uploaded documents.
- **Caches:** generated wording per family in `app/data/generated/` (committed, so the demo runs without spending), audio in `app/data/audio/` (local only).
- **Audit log:** `app/data/logs/audit.jsonl` records what was shown and confirmed (must-knows seen, quiz answers, decisions).

## Repository layout

| Path | What |
|---|---|
| [`app/`](app/) | The application. More detail in [`app/README.md`](app/README.md) |
| `app/server/script.mjs` | Builds each family's script and rejects any figure not in the plan |
| `app/server/realtime.mjs` | Relay for the live check-in: instructions, tools, checks, time and budget limits |
| `app/server/report.mjs` | The full plan as a PDF |
| `app/src/scene/` | Three.js world: glass bubbles and the camera that travels between floors |
| `app/src/ui/` | Landing, calibration, panels per floor, chat, missions, month end |
| `app/src/miniapps/` | The interactive pieces inside each bubble |
| [`cases/`](cases/) | The four households: plan JSON, investment analysis, persona, report |
| [`docs/`](docs/) | Product idea and decisions ([`IDEA.md`](docs/IDEA.md), Spanish), hand-in summary, hackathon brief |
| [`examples/voice/`](examples/voice/) | Starter voice example from the hackathon template |

## What we left out, on purpose

- **A chat or realtime voice as the whole product.** Sherpas already has one; our chat accompanies the journey.
- **Recalculating the plan ourselves.** Sherpas already does the math, and we would risk inventing figures. Document upload is the visual entry, not the engine.
- **A video avatar advisor.** Expensive, slow and feels fake.
- **Consumer-app gamification** (leaderboards, daily streaks, rewards for investing). It creates anxiety and carries regulatory risk.
- **Turning on Easy mode by age.** Paternalistic. It is offered to everyone.

## Disclaimer

Hackathon prototype. All households are fictional Sherpas test cases. Nothing here is financial advice.
