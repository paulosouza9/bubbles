export const usd = (n) => {
  const v = Math.round(Number(n) || 0);
  return `${v < 0 ? "-" : ""}$${Math.abs(v).toLocaleString("en-US")}`;
};
export const usdShort = (n) => {
  const v = Math.abs(Number(n) || 0);
  const sign = n < 0 ? "-" : "";
  if (v >= 1e6) return `${sign}$${Number((v / 1e6).toFixed(2))}M`;
  if (v >= 1e3) return `${sign}$${Number((v / 1e3).toFixed(v >= 1e5 ? 0 : 1))}k`;
  return `${sign}$${Math.round(v)}`;
};
export const pct = (x, d = 0) => `${Number((Number(x) * 100).toFixed(d))}%`;
export const STATUS_COLOR = { red: "#FF3B30", amber: "#FF9F0A", green: "#34C759", neutral: "#8E8E93" };
export const STATUS_WORD = { red: "Needs attention", amber: "Worth a look", green: "In good shape", neutral: "For reference" };
export const LEVEL_NAMES = { 4: "City", 3: "Building", 2: "Floor", 1: "Desk" };
export const LEVEL_HINT = { 4: "The big picture", 3: "Your map", 2: "Explained", 1: "The figures" };
export const sentences = (t) =>
  String(t || "")
    .split(/(?<=[.!?])\s+(?=[A-Z"“$])/)
    .map((s) => s.trim())
    .filter(Boolean);
