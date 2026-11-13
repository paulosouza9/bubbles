// Case data. First choice: the Sherpas MCP (MCP_TOKEN). If the token is missing or expired
// (it lasts 72 h), fall back to the same JSON files in the repo's cases/ folder.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { config } from "./env.mjs";

let mcpPromise = null;
let mcpDisabledUntil = 0;
export const sourceStatus = { source: "unknown", detail: "" };

async function mcp() {
  if (!config.mcpToken) throw new Error("MCP_TOKEN not set");
  if (Date.now() < mcpDisabledUntil) throw new Error("MCP temporarily disabled after a failure");
  if (!mcpPromise) {
    mcpPromise = (async () => {
      const client = new Client({ name: "burbuja", version: "0.1.0" });
      await client.connect(
        new StreamableHTTPClientTransport(new URL(config.mcpUrl), {
          requestInit: { headers: { Authorization: `Bearer ${config.mcpToken}` } },
        }),
      );
      return client;
    })().catch((e) => {
      mcpPromise = null;
      mcpDisabledUntil = Date.now() + 5 * 60_000;
      throw e;
    });
  }
  return mcpPromise;
}

async function mcpCall(name, args) {
  const client = await mcp();
  try {
    const r = await client.callTool({ name, arguments: args });
    if (r.isError) throw new Error(r.content?.[0]?.text || "MCP tool error");
    const text = r.content?.[0]?.text ?? "";
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } catch (e) {
    mcpPromise = null;
    mcpDisabledUntil = Date.now() + 5 * 60_000;
    throw e;
  }
}

function localIds() {
  if (!existsSync(config.casesDir)) return [];
  return readdirSync(config.casesDir)
    .filter((id) => existsSync(join(config.casesDir, id, "financial-health.json")))
    .sort();
}
function localCase(id) {
  const dir = join(config.casesDir, id);
  const read = (f) => (existsSync(join(dir, f)) ? readFileSync(join(dir, f), "utf8") : null);
  const fh = read("financial-health.json");
  if (!fh) return null;
  const ia = read("investment-analysis.json");
  return {
    id,
    financialHealth: JSON.parse(fh),
    investmentAnalysis: ia ? JSON.parse(ia) : null,
    persona: read("persona.md") || "",
  };
}

const unwrap = (r) => (r && typeof r === "object" && "value" in r ? r.value : r);
const cache = new Map();

export async function listCaseIds() {
  try {
    const r = unwrap(await mcpCall("list_cases", {}));
    const list = Array.isArray(r) ? r : r?.cases;
    const ids = (list || []).map((c) => c.caseId || c.id || c.slug).filter(Boolean);
    if (ids.length) return ids.sort();
  } catch {
    /* fall through to local */
  }
  return localIds();
}

export async function getCase(id) {
  if (cache.has(id)) return cache.get(id);
  let data = null;
  try {
    const [fh, ia, persona] = await Promise.all([
      mcpCall("get_case", { caseId: id, part: "financial-health" }),
      mcpCall("get_case", { caseId: id, part: "investment-analysis" }),
      mcpCall("get_case", { caseId: id, part: "persona" }),
    ]);
    const f = unwrap(fh);
    if (!f?.score || !f?.key_metrics) throw new Error("unexpected MCP payload");
    const p = unwrap(persona);
    data = {
      id,
      financialHealth: f,
      investmentAnalysis: unwrap(ia),
      persona: typeof p === "string" ? p : p?.text || p?.markdown || JSON.stringify(p),
      source: "mcp",
    };
    sourceStatus.source = "mcp";
    sourceStatus.detail = "Sherpas MCP";
  } catch (e) {
    const local = localCase(id);
    if (!local) throw new Error(`Unknown case ${id}`);
    data = { ...local, source: "local" };
    sourceStatus.source = "local";
    sourceStatus.detail = `cases/ folder (MCP unavailable: ${String(e.message || e).slice(0, 120)})`;
  }
  cache.set(id, data);
  return data;
}
