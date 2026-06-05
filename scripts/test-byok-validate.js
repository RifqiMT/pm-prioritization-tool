/**
 * BYOK key normalization tests (shared logic with api/_lib/byok-validate.js).
 */
const { normalizeApiKey, formatHint } = require("../api/_lib/byok-validate");

function assert(condition, message) {
  if (!condition) throw new Error(message || "Assertion failed");
}

assert(normalizeApiKey("  gsk_abc123  ") === "gsk_abc123", "trim spaces");
assert(normalizeApiKey('Bearer gsk_abc123') === "gsk_abc123", "strip Bearer");
assert(normalizeApiKey('"tvly-demo"') === "tvly-demo", "strip quotes");
assert(normalizeApiKey("gsk_ab\n cd") === "gsk_abcd", "remove internal whitespace");
assert(formatHint("groq", "bad") !== "", "groq format hint");
assert(formatHint("groq", "gsk_realkey123") === "", "valid groq prefix");
assert(formatHint("tavily", "tvly-abc") === "", "valid tavily prefix");

console.log("OK: BYOK validation helper tests passed");
