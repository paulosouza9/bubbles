// Does this message ask for a real person? Used by the chat (to open "Talk to a person" at
// once, without waiting for the model) and by the server (so the answer always offers it).
const WHO = "(?:real|actual|live)\\s+(?:person|human|people|advisor|adviser|planner)|human(?:\\s+being)?|person|someone|somebody|anyone|my\\s+(?:advisor|adviser|planner)|an?\\s+(?:advisor|adviser|planner|agent|representative)|the\\s+(?:advisor|adviser|planner)";
const PATTERNS = [
  // "Can I talk with a real person", "speak to someone", "chat with a human"
  new RegExp(`\\b(?:talk|speak|chat|meet)\\s+(?:to|with)\\s+(?:a\\s+|an\\s+)?(?:${WHO})\\b`, "i"),
  // "I want a real person", "I need a human"
  new RegExp(`\\b(?:want|need|prefer|get|reach|contact|call)\\s+(?:a\\s+|an\\s+|to\\s+(?:a\\s+)?)?(?:real|actual|live)\\s+(?:person|human|advisor|adviser)\\b`, "i"),
  new RegExp(`\\b(?:want|need|prefer)\\s+(?:a|to\\s+talk\\s+to\\s+a)\\s+human\\b`, "i"),
  // "contact my advisor", "call my planner", "reach an advisor"
  /\b(?:contact|call|reach|email|phone)\s+(?:my|an?|the)\s+(?:advisor|adviser|planner|agent|representative)\b/i,
  // "Is there a human?", "are you a real person", "a real person please"
  /\b(?:real|actual|live)\s+(?:person|human)\b/i,
  /\bhuman\s+(?:help|support|advisor|adviser|please)\b/i,
];

export function wantsHuman(text) {
  const t = String(text || "");
  return PATTERNS.some((p) => p.test(t));
}
