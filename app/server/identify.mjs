// Entry A: work out which family a dropped document belongs to. We do not re-read statements
// or redo the maths (Sherpas Intake and Paraplanner already do that): we only match the
// document to a plan that already exists.
import { extractText, getDocumentProxy } from "unpdf";
import { getCase, listCaseIds } from "./cases.mjs";

export async function identify(buffer, filename = "") {
  const ids = await listCaseIds();
  const name = filename.toLowerCase();
  let text = "";
  try {
    if (buffer.subarray(0, 5).toString() === "%PDF-") {
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      text = (await extractText(pdf, { mergePages: true })).text.slice(0, 60_000);
    } else {
      text = buffer.toString("utf8", 0, Math.min(buffer.length, 400_000));
    }
  } catch {
    text = "";
  }
  const hay = `${name}\n${text}`.toLowerCase();
  let best = null;
  for (const id of ids) {
    const c = await getCase(id);
    const adults = c.financialHealth.case.household.filter((p) => p.role !== "child").map((p) => p.first_name.toLowerCase());
    const last = id.split("-").at(-1);
    let score = 0;
    if (hay.includes(id)) score += 5;
    for (const first of adults) {
      if (hay.includes(`${first} ${last}`)) score += 4;
      else if (hay.includes(first) && hay.includes(last)) score += 2;
    }
    if (adults.length > 1 && adults.every((a) => hay.includes(a))) score += 2;
    if (score > 0 && (!best || score > best.score)) best = { family: id, score };
  }
  return best && best.score >= 2 ? best : null;
}
