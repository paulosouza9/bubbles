// Loads the repo-root .env (MCP_TOKEN, TEAM_KEY) and exposes config. Keys never leave the server.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const APP_DIR = resolve(here, "..");
export const REPO_DIR = resolve(APP_DIR, "..");

for (const file of [join(REPO_DIR, ".env"), join(APP_DIR, ".env")]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

export const config = {
  port: Number(process.env.PORT || 8787),
  mcpUrl: process.env.MCP_URL || "https://mcp-hackathon.sherpaswealth.com/mcp",
  mcpToken: process.env.MCP_TOKEN || "",
  proxyUrl: (process.env.LLM_PROXY_URL || "https://llm-hackathon.sherpaswealth.com").replace(/\/$/, ""),
  teamKey: process.env.TEAM_KEY || "",
  textModel: process.env.TEXT_MODEL || "gpt-5-mini",
  ttsModel: process.env.TTS_MODEL || "eleven-flash-v2.5",
  sttModel: process.env.STT_MODEL || "scribe-v2",
  voiceMain: process.env.TTS_VOICE || "alloy",
  voiceCohost: process.env.TTS_VOICE_COHOST || "echo",
  // ElevenLabs is capped at $1.40 per team. We stop generating new audio before that and the
  // browser falls back to its built-in speech synthesis.
  ttsBudgetUsd: Number(process.env.TTS_BUDGET_USD || 1.2),
  casesDir: resolve(REPO_DIR, "cases"),
  generatedDir: join(APP_DIR, "data", "generated"),
  audioDir: join(APP_DIR, "data", "audio"),
  logsDir: join(APP_DIR, "data", "logs"),
};
