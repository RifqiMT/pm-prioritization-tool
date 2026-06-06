/**
 * Roadmap 5 Why Framework helpers (no test runner required).
 */
const assert = require("assert");
const path = require("path");
const fs = require("fs");
const vm = require("vm");

const modulePath = path.join(__dirname, "../src/modules/roadmap-5why-framework.js");
const source = fs.readFileSync(modulePath, "utf8");
const sandbox = { globalThis: {}, URL };
vm.runInNewContext(source, sandbox);
const {
  FIVE_WHY_MAX_LEVELS,
  getNextWhyLevel,
  getWhyGenerateButtonLabel,
  normalizePreviousWhys,
  buildWhyPrompt,
  parseWhyResponse,
  normalizeWhyQuestion,
  ensureWhyQuestionEnds,
  getWhyLevelLens,
  getWhyLevelFocus,
  getWhyLevelLensLabel,
  buildAnalyticalLensSection,
  buildFallbackWhyQuestion,
  collectPrioritizationFacts,
  hasPrioritizationData,
  buildPrioritizationPromptSection,
  detectWhyQuestionRedundancy,
  buildWhyRedundancyRetryHint,
  computeWhyQuestionSimilarity,
  collectWhyAnchorTerms,
  renderWhyParagraphHtml,
  formatMissingFiveWhyKeyMessage,
  hasTavilyResearch,
  computeGroqPacingWaitMs,
  computeTavilyPacingWaitMs,
  resetGroqTokenBudgetForTests,
  resetTavilyPacingForTests
} = sandbox.globalThis.RoadmapFiveWhyFramework;

const context = { title: "Checkout revamp", moscowCategory: "Must Have", roadmapPeriod: "Q3" };

assert.strictEqual(FIVE_WHY_MAX_LEVELS, 5);

assert.strictEqual(getNextWhyLevel([]), 1);
assert.strictEqual(
  getNextWhyLevel([
    { level: 1, question: "Q1?" },
    { level: 2, question: "Q2?" },
    { level: 3, question: "Q3?" },
    { level: 4, question: "Q4?" },
    { level: 5, question: "Q5?" }
  ]),
  null
);

const normalized = normalizePreviousWhys([
  { level: 2, question: "Why two?" },
  { text: "Legacy question?" }
]);
assert.strictEqual(normalized.length, 2);

const whyField = parseWhyResponse('{"why":"Why does checkout need a revamp?"}');
assert.strictEqual(whyField.question, "Why does checkout need a revamp?");

const prompt1 = buildWhyPrompt(context, 1, [], { searchBrief: "Brief", linkExtracts: [] });
assert.ok(prompt1.includes("WHY 1"));
assert.ok(prompt1.includes("plain English"));
assert.ok(prompt1.includes("No jargon"));

const richContext = {
  title: "Checkout revamp",
  moscowCategory: "Must Have",
  kanoCategory: "Performance",
  riceScore: 42,
  reachValue: 5000,
  impactValue: 3,
  effortValue: 2
};

const prompt2 = buildWhyPrompt(richContext, 2, [{ level: 1, question: "Why was checkout added?" }], {
  searchBrief: "Brief",
  linkExtracts: []
});
assert.ok(prompt2.includes("PRIORITIZATION"));
assert.ok(prompt2.includes("Must Have"));
assert.ok(prompt2.includes("Performance"));
assert.ok(prompt2.includes("score 42"));

const facts = collectPrioritizationFacts(richContext);
assert.ok(hasPrioritizationData(richContext));
assert.strictEqual(facts.moscow, "Must Have");
assert.strictEqual(facts.kano, "Performance");
assert.ok(facts.riceSummary.includes("score 42"));
assert.ok(
  buildFallbackWhyQuestion(2, richContext, [{ level: 1, question: "Why was checkout added?" }]).question.includes(
    "Must Have"
  )
);

const prompt4 = buildWhyPrompt(
  context,
  4,
  [
    { level: 1, question: "Why does checkout revamp exist on the roadmap?" },
    { level: 2, question: "Why is checkout revamp Must Have this quarter?" },
    { level: 3, question: "Why do checkout task dependencies block release?" }
  ],
  { searchBrief: "Brief", linkExtracts: [] }
);
assert.ok(prompt4.includes("WHY 4"));
assert.ok(prompt4.includes("ANGLE FOR WHY 4"));

const duplicateIssues = detectWhyQuestionRedundancy(
  "Why was checkout revamp prioritized as Must Have this quarter?",
  [{ level: 1, question: "Why was checkout revamp prioritized as Must Have this quarter?" }],
  2,
  context
);
assert.ok(duplicateIssues.some((issue) => /duplicate/i.test(issue)));

const distinctLevel4 = detectWhyQuestionRedundancy(
  "Why must RACI owners approve checkout revamp before Q3 delivery?",
  [
    { level: 1, question: "Why does checkout revamp exist on the roadmap?" },
    { level: 2, question: "Why is checkout revamp Must Have this quarter?" },
    { level: 3, question: "Why do checkout task dependencies block the release?" }
  ],
  4,
  context
);
assert.strictEqual(distinctLevel4.length, 0);

const sharedTitleSimilarity = computeWhyQuestionSimilarity(
  "Why does checkout revamp exist on the roadmap?",
  "Why must RACI owners approve checkout revamp before Q3 delivery?",
  context
);
assert.ok(sharedTitleSimilarity < 0.74);

const adjacentSimilarity = detectWhyQuestionRedundancy(
  "Why is checkout revamp prioritized as Must Have for this quarter?",
  [{ level: 3, question: "Why is checkout revamp prioritized as Must Have this quarter?" }],
  4,
  context
);
assert.ok(adjacentSimilarity.length > 0);

const fallback = buildFallbackWhyQuestion(5, context, [
  { level: 1, question: "Why does checkout revamp exist on the roadmap?" },
  { level: 2, question: "Why is checkout revamp Must Have this quarter?" },
  { level: 3, question: "Why do checkout task dependencies block the release?" },
  { level: 4, question: "Why must RACI owners approve checkout revamp before Q3 delivery?" }
]);
assert.ok(fallback.question.endsWith("?"));

assert.ok(getWhyLevelLensLabel(1) === "Why is this on the roadmap?");
assert.ok(getWhyLevelLensLabel(5) === "What is the real reason underneath?");
assert.ok(getWhyLevelFocus(4).includes("people"));
assert.ok(collectWhyAnchorTerms(context).has("checkout"));
assert.ok(buildAnalyticalLensSection(3, true).includes("work"));
assert.ok(buildWhyRedundancyRetryHint(["duplicate of WHY 1"], [{ level: 1, question: "Why now?" }], 2).includes("Try again"));
assert.ok(buildFallbackWhyQuestion(3, context, []).question.includes("tasks"));

assert.strictEqual(
  formatMissingFiveWhyKeyMessage(["Groq", "Tavily"]),
  "5 Why Framework requires Groq and Tavily API keys. Add Groq and Tavily via header → API keys."
);

assert.strictEqual(hasTavilyResearch({ searchBrief: "context", linkExtracts: [] }), true);
assert.strictEqual(renderWhyParagraphHtml("<b>?</b>"), "&lt;b&gt;?&lt;/b&gt;");

resetGroqTokenBudgetForTests();
resetTavilyPacingForTests();
assert.strictEqual(computeGroqPacingWaitMs(100), 0);
assert.strictEqual(computeTavilyPacingWaitMs(), 0);

console.log("test-roadmap-5why-framework.js: all assertions passed");
