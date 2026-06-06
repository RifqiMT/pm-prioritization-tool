/**
 * Roadmap LLM summary helpers (no test runner required).
 */
const assert = require("assert");
const path = require("path");
const fs = require("fs");
const vm = require("vm");

const modulePath = path.join(__dirname, "../src/modules/roadmap-llm-summary.js");
const source = fs.readFileSync(modulePath, "utf8");
const sandbox = { globalThis: {}, URL };
vm.runInNewContext(source, sandbox);
const {
  parseThreeParagraphs,
  parseSummaryResponse,
  buildStorytellingPrompt,
  ensureLinksInSummaryVariant,
  linkifyRoadmapSummaryText,
  renderRoadmapSummaryParagraphText,
  sanitizeSummaryVariantLinks,
  normalizeSummaryLinks,
  normalizeRedirectLinkUrl,
  prepareSummaryContext,
  buildProfessionalPrompt,
  countSentences,
  enforceParagraphSentenceCounts,
  getTargetSentenceCount,
  dedupeSummaryVariantContext,
  compactContextForPrompt,
  parseGroqRetryDelayMs,
  formatGroqErrorForUser,
  normalizeSummaryParagraph,
  normalizeSentenceSpacing,
  repairEmptyQuotedPhrases,
  stripAnchorMention,
  finalizeSummaryVariant,
  buildTavilySearchQuery,
  parseTavilySearchPayload,
  parseTavilyExtractPayload,
  hasTavilyResearch,
  buildResearchPromptSection,
  deriveSimplifiedFromProfessional,
  pickSpreadSentences,
  buildParagraphExclusiveRules,
  formatMissingSummaryKeyMessage,
  parseGroqRateLimitDetails,
  estimateGroqRequestTokens,
  computeTpmPacingWaitMs,
  resetGroqTokenBudgetForTests,
  resetTavilyPacingForTests,
  recordGroqTokenUsage,
  recordTavilyUsage,
  getSummaryApiCooldownStatus,
  compressRedundantSummary,
  detectSummaryRedundancy,
  detectSummaryCohesionIssues,
  sentenceOpensWithBridge,
  buildCohesionRetryHint,
  enforceParagraphFieldExclusivity,
  dedupeGlobalSentences,
  compactRaciForPrompt,
  compactTasksForPrompt,
  compactFinancialForPrompt,
  compactStringListForPrompt,
  shouldReuseCachedTavilyResearch,
  buildLocalSimplifiedVariant,
  formatCooldownWaitLabel,
  repairSummaryParagraphStructure,
  finalizeSummaryVariantForTone
} = sandbox.globalThis.RoadmapLlmSummary;

const threePara = parseThreeParagraphs("Opening chapter.\n\nMiddle chapter.\n\nClosing chapter.");
assert.strictEqual(threePara.paragraph1, "Opening chapter.");
assert.strictEqual(threePara.paragraph2, "Middle chapter.");
assert.strictEqual(threePara.paragraph3, "Closing chapter.");

const twoPara = parseThreeParagraphs("Opening chapter.\n\nClosing chapter.");
assert.strictEqual(twoPara.paragraph1, "Opening chapter.");
assert.strictEqual(twoPara.paragraph2, "Closing chapter.");
assert.strictEqual(twoPara.paragraph3, "");

const singleLine = parseThreeParagraphs("Opening.\nMiddle.\nClosing.");
assert.strictEqual(singleLine.paragraph1, "Opening.");
assert.strictEqual(singleLine.paragraph2, "Middle.");
assert.strictEqual(singleLine.paragraph3, "Closing.");

const jsonParsed = parseSummaryResponse('{"paragraph1":"One.","paragraph2":"Two.","paragraph3":"Three."}');
assert.strictEqual(jsonParsed.paragraph1, "One.");
assert.strictEqual(jsonParsed.paragraph2, "Two.");
assert.strictEqual(jsonParsed.paragraph3, "Three.");

const fencedJson = parseSummaryResponse(
  '```json\n{"paragraph1":"A","paragraph2":"B","paragraph3":"C"}\n```'
);
assert.strictEqual(fencedJson.paragraph3, "C");

const storytellingPrompt = buildStorytellingPrompt({
  paragraph1: "Professional one.",
  paragraph2: "Professional two.",
  paragraph3: "Professional three."
});
assert.ok(storytellingPrompt.includes("PROFESSIONAL:"));
assert.ok(storytellingPrompt.includes("simplified storytelling"));
assert.ok(storytellingPrompt.includes("paragraph1, paragraph2, paragraph3"));
assert.ok(storytellingPrompt.includes("do not add/remove/change information"));
assert.ok(storytellingPrompt.includes("paragraph1: plain setup"));
assert.ok(storytellingPrompt.includes("Preserve paragraph bridges"));
assert.ok(!storytellingPrompt.includes("AVAILABLE FIELDS"));

const compactRaci = compactRaciForPrompt({
  responsible: [{ name: "Alex", domain: "Business" }],
  accountable: [{ name: "Sam", domain: "Tech" }],
  consulted: [],
  informed: []
});
assert.ok(compactRaci.responsible[0].includes("Alex"));
assert.ok(compactRaci.accountable[0].includes("Tech"));

const compactTasks = compactTasksForPrompt([
  { title: "Ship checkout", status: "In progress" },
  { title: "QA pass", status: "Todo" }
]);
assert.strictEqual(compactTasks.length, 2);
assert.ok(compactTasks[0].includes("In progress"));

const splitBySentence = parseThreeParagraphs("One. Two. Three. Four. Five. Six. Seven. Eight. Nine.");
assert.ok(splitBySentence.paragraph1.length > 0);
assert.ok(splitBySentence.paragraph2.length > 0);
assert.ok(splitBySentence.paragraph3.length > 0);

const single = parseThreeParagraphs("   ");
assert.strictEqual(single.paragraph1, "");
assert.strictEqual(single.paragraph2, "");
assert.strictEqual(single.paragraph3, "");

const enriched = ensureLinksInSummaryVariant(
  {
    paragraph1: "Intro.",
    paragraph2: "Prioritize.",
    paragraph3: "Close."
  },
  [{ label: "Spec", url: "https://example.com/doc" }]
);
assert.ok(enriched.paragraph3.includes("Spec"));
assert.ok(enriched.paragraph3.includes("To support delivery"));
assert.ok(!enriched.paragraph3.includes("https://example.com/doc"));

const sanitized = sanitizeSummaryVariantLinks(
  {
    paragraph1: "Intro.",
    paragraph2: "Prioritize.",
    paragraph3: "See Spec (https://example.com/doc) for details."
  },
  [{ label: "Spec", url: "https://example.com/doc" }]
);
assert.ok(sanitized.paragraph3.includes("Spec"));
assert.ok(!sanitized.paragraph3.includes("https://example.com/doc"));

const linkHtml = renderRoadmapSummaryParagraphText(
  "See Spec (https://example.com/doc) for details.",
  [{ label: "Spec", url: "https://example.com/doc" }]
);
assert.ok(linkHtml.includes('class="roadmap-summary-link"'));
assert.ok(linkHtml.includes('href="https://example.com/doc"'));
assert.ok(linkHtml.includes(">Spec<"));
assert.strictEqual((linkHtml.match(/roadmap-summary-link/g) || []).length, 1);

const deduped = dedupeSummaryVariantContext(
  {
    paragraph1: "Spec is noted early.",
    paragraph2: "Middle context.",
    paragraph3: "See Spec again. Related resources: Spec, Design, Spec."
  },
  [
    { label: "Spec", url: "https://example.com/doc" },
    { label: "Design", url: "https://example.com/design" }
  ]
);
const dedupedCombined = [deduped.paragraph1, deduped.paragraph2, deduped.paragraph3].join(" ");
assert.strictEqual((dedupedCombined.match(/Spec/gi) || []).length, 1);
assert.strictEqual((dedupedCombined.match(/Design/gi) || []).length, 1);
assert.ok(!deduped.paragraph1.includes("Spec"));
assert.ok(deduped.paragraph3.includes("Spec"));

const prepared = prepareSummaryContext({
  title: "Payments revamp",
  description: "Improve checkout",
  createdAt: "2024-01-15T10:00:00.000Z",
  modifiedAt: "2025-06-01T14:30:00.000Z",
  roadmapType: null,
  moscowCategory: "",
  financialImpactFramework: "custom",
  financialImpactValue: 0,
  riceScore: 0,
  reachValue: null,
  kanoFunctionality: 2,
  raci: { responsible: [], accountable: [], consulted: [], informed: [] },
  links: []
});
assert.strictEqual(prepared.title, "Payments revamp");

const research = {
  searchBrief: "Product prioritization patterns for checkout improvements.",
  linkExtracts: [{ label: "Spec", url: "https://example.com/doc", snippet: "Checkout scope." }]
};

const promptWithRaci = buildProfessionalPrompt(
  prepareSummaryContext({
    title: "Payments revamp",
    description: "Improve checkout",
    raci: {
      responsible: [{ name: "Alex", domain: "Business" }],
      accountable: [],
      consulted: [],
      informed: []
    }
  }),
  [],
  research
);
assert.ok(promptWithRaci.includes("Alex (Business)"));
assert.ok(promptWithRaci.includes("Narrative:"));
assert.ok(promptWithRaci.includes("paragraph3: weave delivery"));
assert.ok(promptWithRaci.includes("Mention the roadmap title at most once"));

const compactFinancial = compactFinancialForPrompt({
  financialImpactValue: 1200000,
  financialImpactCurrency: "USD",
  financialImpactFramework: "CLV"
});
assert.ok(compactFinancial.includes("1200000"));
assert.ok(compactFinancial.includes("CLV"));

const compactLabels = compactStringListForPrompt(["Platform", "Checkout"]);
assert.strictEqual(compactLabels, "Platform, Checkout");

const financialPrompt = buildProfessionalPrompt(
  prepareSummaryContext({
    title: "Payments revamp",
    description: "Improve checkout",
    financialImpactValue: 500000,
    financialImpactCurrency: "USD",
    financialImpactFramework: "operational"
  }),
  [],
  research
);
assert.ok(financialPrompt.includes('"financialImpact":"500000 USD (operational)"'));

assert.strictEqual(sentenceOpensWithBridge("With that context, prioritization signals are clear."), true);
assert.strictEqual(sentenceOpensWithBridge("RICE 42 confirms urgency."), false);

const weakCohesion = detectSummaryCohesionIssues({
  paragraph1: "Payments revamp improves checkout conversion for the quarter. The work targets measurable uplift.",
  paragraph2: "RICE 42 confirms Must have urgency. Impact and reach remain strong across segments.",
  paragraph3: "Delivery tasks and RACI ownership follow next. Reference materials include Spec."
});
assert.ok(weakCohesion.some((issue) => issue.includes("paragraph2")));

const strongCohesion = detectSummaryCohesionIssues({
  paragraph1: "Payments revamp improves checkout conversion for the quarter. The work targets measurable uplift.",
  paragraph2: "With that context, RICE 42 confirms Must have urgency. Impact and reach remain strong across segments.",
  paragraph3: "From this prioritization, delivery tasks and RACI ownership follow next. Reference materials include Spec."
});
assert.strictEqual(strongCohesion.length, 0);

const cohesionHint = buildCohesionRetryHint(["weak bridge between paragraph1 and paragraph2"]);
assert.ok(cohesionHint.includes("Improve cohesion"));

assert.strictEqual(shouldReuseCachedTavilyResearch(research), true);
assert.strictEqual(shouldReuseCachedTavilyResearch({ searchBrief: "", linkExtracts: [] }), false);

const cooldownLabel = formatCooldownWaitLabel(getSummaryApiCooldownStatus("simplified"));
assert.ok(cooldownLabel.includes("Waiting"));

const prompt = buildProfessionalPrompt(
  prepareSummaryContext({
    title: "Payments revamp",
    description: "Improve checkout",
    moscowCategory: "Must have",
    links: [{ label: "Spec", url: "https://example.com/doc" }]
  }),
  [{ label: "Spec", url: "https://example.com/doc" }],
  research
);
assert.ok(prompt.includes("paragraph1, paragraph2, paragraph3"));
assert.ok(prompt.includes("paragraph1 ONLY"));
assert.ok(prompt.includes("paragraph2 ONLY"));
assert.ok(prompt.includes("paragraph3 ONLY: links"));
assert.ok(prompt.includes("at most once across all three paragraphs"));
assert.ok(prompt.includes("exactly 8 sentences"));
assert.ok(storytellingPrompt.includes("exactly 5 sentences"));

const eightLine = Array.from({ length: 8 }, (_, i) => `Point ${i + 1}.`).join(" ");

const contextForDedupe = prepareSummaryContext({
  title: "Payments revamp",
  description: "Improve checkout conversion",
  riceScore: 42,
  moscowCategory: "Must have"
});

const simplifiedDerived = deriveSimplifiedFromProfessional({
  paragraph1: eightLine,
  paragraph2: eightLine,
  paragraph3: eightLine
});
assert.strictEqual(countSentences(simplifiedDerived.paragraph1), 5);
assert.strictEqual(countSentences(simplifiedDerived.paragraph2), 5);
assert.strictEqual(countSentences(simplifiedDerived.paragraph3), 5);

const localSimplified = buildLocalSimplifiedVariant(
  {
    paragraph1: eightLine,
    paragraph2: eightLine,
    paragraph3: eightLine
  },
  contextForDedupe,
  []
);
assert.strictEqual(countSentences(localSimplified.paragraph1), 5);
assert.strictEqual(countSentences(localSimplified.paragraph3), 5);

const exclusive = enforceParagraphFieldExclusivity(
  {
    paragraph1: "Payments revamp improves checkout conversion with strong reach.",
    paragraph2: "Payments revamp scores 42 on RICE as a Must have item.",
    paragraph3: "Delivery tasks follow next."
  },
  contextForDedupe
);
assert.ok(!exclusive.paragraph2.includes("Payments revamp"));
assert.ok(exclusive.paragraph2.includes("42"));

const quotedAnchorStripped = enforceParagraphFieldExclusivity(
  {
    paragraph1: "Payments revamp improves checkout conversion.",
    paragraph2: "It is categorized as 'Payments revamp' with RICE 42 for the quarter.",
    paragraph3: "Delivery tasks follow next."
  },
  contextForDedupe
);
assert.ok(!quotedAnchorStripped.paragraph2.includes("''"));
assert.ok(!quotedAnchorStripped.paragraph2.includes("'Payments"));
assert.ok(quotedAnchorStripped.paragraph2.includes("42"));

assert.strictEqual(repairEmptyQuotedPhrases("It is listed as '' in the plan."), "It is in the plan.");
assert.ok(!repairEmptyQuotedPhrases("It is listed as '' in the plan.").includes("''"));
assert.strictEqual(
  normalizeSentenceSpacing(stripAnchorMention("Rated as 'Must have' for Q3.", "Must have")),
  "Rated for Q3."
);
assert.ok(!repairEmptyQuotedPhrases("Priority is '' and reach stays strong.").includes("''"));

const sentenceDeduped = dedupeGlobalSentences({
  paragraph1: "The team aligns on scope.",
  paragraph2: "The team aligns on scope.",
  paragraph3: ""
});
assert.strictEqual(countSentences(sentenceDeduped.paragraph1), 1);
assert.strictEqual(countSentences(sentenceDeduped.paragraph2), 1);

const withinParagraphDeduped = dedupeGlobalSentences({
  paragraph1: "The team aligns on scope. The team aligns on scope.",
  paragraph2: "",
  paragraph3: ""
});
assert.strictEqual(countSentences(withinParagraphDeduped.paragraph1), 1);

const compressed = compressRedundantSummary(
  {
    paragraph1: "Payments revamp targets checkout uplift. Payments revamp frames the quarter.",
    paragraph2: "RICE 42 signals Must have priority. RICE 42 confirms urgency.",
    paragraph3: "See Spec. Related resources: Spec, Design, Spec."
  },
  contextForDedupe,
  [
    { label: "Spec", url: "https://example.com/doc" },
    { label: "Design", url: "https://example.com/design" }
  ]
);
const compressedCombined = [compressed.paragraph1, compressed.paragraph2, compressed.paragraph3].join(" ");
assert.ok((compressedCombined.match(/Payments revamp/gi) || []).length <= 1);
assert.ok((compressedCombined.match(/RICE 42/gi) || []).length <= 1);
assert.strictEqual((compressedCombined.match(/Spec/gi) || []).length, 1);
assert.strictEqual(detectSummaryRedundancy(compressed, contextForDedupe, []).length, 0);

const rateLimitMessage =
  "Rate limit reached for org. TPM Limit: 6,000 Tokens Used: 5,732 Tokens Requested: 1,882 Please try again in 16.14s.";
assert.strictEqual(parseGroqRetryDelayMs(rateLimitMessage), 16540);

resetGroqTokenBudgetForTests();
resetTavilyPacingForTests();
assert.strictEqual(computeTpmPacingWaitMs(2000, Date.now()), 0);
assert.strictEqual(getSummaryApiCooldownStatus("simplified").ready, true);

recordTavilyUsage(Date.now());
const tavilyCooldown = getSummaryApiCooldownStatus("simplified");
assert.ok(!tavilyCooldown.ready);
assert.ok(tavilyCooldown.tavilyWaitMs > 0);

const eightSentences = Array.from({ length: 8 }, (_, i) => `Sentence ${i + 1}.`).join(" ");
const enforced = enforceParagraphSentenceCounts(
  {
    paragraph1: `${eightSentences} Extra sentence.`,
    paragraph2: eightSentences,
    paragraph3: eightSentences
  },
  "professional"
);
assert.strictEqual(countSentences(enforced.paragraph1), 8);
assert.strictEqual(countSentences(enforced.paragraph2), 8);
assert.strictEqual(countSentences(enforced.paragraph3), 8);

const repaired = repairSummaryParagraphStructure(
  { paragraph1: "Context only.", paragraph2: "Middle one. Middle two. Middle three.", paragraph3: "" },
  "professional"
);
assert.ok(repaired.paragraph3.length > 0);

const rebalanced = finalizeSummaryVariantForTone(
  {
    paragraph1: "One. Two. Three.",
    paragraph2: "Four. Five.",
    paragraph3: "Six. Seven. Eight. Nine."
  },
  {
    paragraph1: "One. Two. Three. Four. Five. Six. Seven. Eight.",
    paragraph2: "Four. Five. Six. Seven. Eight. Alpha. Beta. Gamma.",
    paragraph3: "Six. Seven. Eight. Nine. Ten. Eleven. Twelve."
  },
  "professional"
);
assert.strictEqual(countSentences(rebalanced.paragraph1), 8);
assert.ok(countSentences(rebalanced.paragraph2) >= 5);
assert.ok(countSentences(rebalanced.paragraph3) >= 5);

const gluedJson = parseSummaryResponse('{"paragraph1":"One.Two.","paragraph2":"Three.Four.","paragraph3":"Five.Six."}');
assert.strictEqual(gluedJson.paragraph1, "One. Two.");
assert.strictEqual(gluedJson.paragraph2, "Three. Four.");
assert.strictEqual(gluedJson.paragraph3, "Five. Six.");

console.log("test-roadmap-llm-summary.js: all assertions passed");
