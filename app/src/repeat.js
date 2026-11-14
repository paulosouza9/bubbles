// Keeps the voice from saying the same thing twice inside one bubble. Outside, inside and
// deeper each have their own text, and they often restate one another ("Your score is 26").
// Everything the voice has said in the current bubble is remembered; a later sentence that
// says nothing new (same figures, mostly the same words) is not spoken again.
import { sentences } from "./format.js";

const STOP = new Set(
  "a an the and or but so of to in on at for by with from as is are was were be been being it its this that these those you your yours we our they their there here than then which who what when where how not no yes do does did have has had will would can could should may might must about into over under more most less very just also only still out up down if because while each per all any some such own same too".split(" "),
);

function tokens(text) {
  const words = [];
  const nums = [];
  for (const raw of String(text).toLowerCase().match(/\$?[\d][\d,.]*%?|[a-z][a-z'’-]*/g) || []) {
    if (/^\$?\d/.test(raw)) {
      const n = raw.replace(/[$,]/g, "").replace(/\.$/, "");
      nums.push(n);
      words.push(n);
    } else {
      const w = raw.replace(/['’]s$/, "").replace(/(ing|ed|es|s)$/, "");
      if (w.length > 2 && !STOP.has(raw)) words.push(w);
    }
  }
  return { words: new Set(words), nums: new Set(nums) };
}

// True when `sentence` adds nothing to what `heard` already covers.
function isRepeat(sentence, heard) {
  const t = tokens(sentence);
  if (!t.words.size) return true;
  let shared = 0;
  for (const w of t.words) if (heard.words.has(w)) shared++;
  const overlap = shared / t.words.size;
  const numbersKnown = [...t.nums].every((n) => heard.nums.has(n));
  // A sentence whose figures were all said already is a recap, unless it is mostly new words.
  if (t.nums.size > 0 && numbersKnown) return overlap >= 0.3;
  return overlap >= 0.8 || (overlap >= 0.62 && t.nums.size === 0);
}

const memory = { bubble: null, words: new Set(), nums: new Set() };

function remember(text) {
  const t = tokens(text);
  t.words.forEach((w) => memory.words.add(w));
  t.nums.forEach((n) => memory.nums.add(n));
}

// Start remembering for a bubble. Called when a bubble takes the stage.
export function enterBubble(id) {
  if (memory.bubble === id) return;
  memory.bubble = id;
  memory.words = new Set();
  memory.nums = new Set();
}

// The sentences of `text` the voice has not effectively said yet in this bubble.
// Returns { parts, all, index } where index[i] is the position of parts[i] in all.
export function fresh(id, text) {
  enterBubble(id);
  const all = sentences(text);
  const parts = [];
  const index = [];
  const local = { words: new Set(memory.words), nums: new Set(memory.nums) };
  all.forEach((s, i) => {
    if (isRepeat(s, local)) return;
    parts.push(s);
    index.push(i);
    const t = tokens(s);
    t.words.forEach((w) => local.words.add(w));
    t.nums.forEach((n) => local.nums.add(n));
  });
  return { parts, all, index };
}

// Mark text as heard (call when it is actually spoken).
export function heard(id, text) {
  enterBubble(id);
  remember(text);
}

// What to say when a bubble first appears: its title only if the sentence does not already
// say the same thing ("Your score: 26" before "Your overall score is 26, ..." is dropped).
export function outsideLine(title, building) {
  const tt = tokens(title);
  const tb = tokens(building);
  let shared = 0;
  for (const w of tt.words) if (tb.words.has(w)) shared++;
  const covered = tt.words.size === 0 || shared / tt.words.size >= 0.5;
  return covered ? building : `${title}. ${building}`;
}
