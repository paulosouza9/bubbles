const json = async (r) => {
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
};
const post = (url, body) => fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(json);

export const api = {
  status: () => fetch("/api/status").then(json),
  families: () => fetch("/api/families").then(json),
  plan: (id) => fetch(`/api/plan/${id}`).then(json),
  identify: (file) =>
    fetch("/api/identify", { method: "POST", headers: { "content-type": "application/octet-stream", "x-filename": encodeURIComponent(file.name) }, body: file }).then(json),
  ask: (body) => post("/api/ask", body),
  month: (body) => post("/api/month", body),
  checkin: (body) => post("/api/checkin", body),
  log: (body) => post("/api/log", body).catch(() => {}),
  tts: async (text, voice) => {
    const r = await fetch("/api/tts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, voice }) });
    if (!r.ok) throw new Error("tts unavailable");
    return r.blob();
  },
  stt: async (blob) => {
    const r = await fetch("/api/stt", { method: "POST", headers: { "content-type": blob.type || "audio/webm" }, body: blob });
    if (!r.ok) throw new Error("stt unavailable");
    return (await r.json()).text;
  },
};
