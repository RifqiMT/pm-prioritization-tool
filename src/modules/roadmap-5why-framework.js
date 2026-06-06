/**
 * Roadmap 5 Why Framework — iterative WHY 1→5 questions via Tavily + Groq (client-side BYOK).
 * Structured analysis behind the scenes; user-facing output is plain English only.
 * Asks clarity/reason/essence questions from roadmap DATA only; never answers or assumes.
 * Independent from RoadmapLlmSummary generation; shares only Groq/Tavily API keys.
 */
(function (global) {
  const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
  const GROQ_MODEL = "llama-3.1-8b-instant";
  const TAVILY_SEARCH_URL = "https://api.tavily.com/search";
  const TAVILY_EXTRACT_URL = "https://api.tavily.com/extract";
  const TAVILY_MAX_LINK_EXTRACTS = 3;
  const TAVILY_EXTRACT_MAX_CHARS = 280;
  const TAVILY_SEARCH_MAX_CHARS = 340;
  const TAVILY_SEARCH_MAX_RESULTS = 2;
  const TAVILY_MIN_GAP_MS = 8000;
  const FIVE_WHY_MAX_LEVELS = 5;
  const FIVE_WHY_CONTEXT_MAX_CHARS = 380;
  const FIVE_WHY_MAX_ARRAY_ITEMS = 5;
  const GROQ_MAX_OUTPUT_TOKENS = 128;
  const GROQ_TPM_LIMIT = 6000;
  const GROQ_TPM_WINDOW_MS = 60000;
  const GROQ_TPM_BUFFER = 250;
  const GROQ_DEFAULT_RETRY_DELAY_MS = 12000;
  const GROQ_RATE_LIMIT_RETRY_ATTEMPTS = 4;
  const FIVE_WHY_REDUNDANCY_RETRY_ATTEMPTS = 5;
  const FIVE_WHY_SIMILARITY_STRICT = 0.84;
  const FIVE_WHY_SIMILARITY_ADJACENT = 0.74;
  const FIVE_WHY_COMPACT_PROMPT_FROM_LEVEL = 3;
  const FIVE_WHY_FORBIDDEN_RECENT_COUNT = 2;
  const WHY_QUESTION_STOP_WORDS = new Set([
    "why",
    "is",
    "are",
    "the",
    "a",
    "an",
    "this",
    "that",
    "these",
    "those",
    "does",
    "do",
    "did",
    "was",
    "were",
    "for",
    "of",
    "in",
    "to",
    "and",
    "or",
    "it",
    "its",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "we",
    "our",
    "about",
    "with",
    "on",
    "at",
    "from",
    "as",
    "by",
    "what",
    "how",
    "when",
    "where",
    "which",
    "who",
    "must",
    "should",
    "need",
    "needs"
  ]);
  const WHY_LEVEL_LENS = [
    {
      dmaic: "Define",
      plainLabel: "Why is this on the roadmap?",
      plainFocus: "why this item exists and why it was started",
      plainGuide: "Ask in simple words why this roadmap was added and why it matters.",
      meceBucket: "existence and purpose",
      guide: "Ask why this roadmap was started using facts from the saved fields."
    },
    {
      dmaic: "Measure",
      plainLabel: "Why is it a priority?",
      plainFocus: "why its priority category, scores, or customer value rating justify its place",
      plainGuide:
        "Ask why the saved MoSCoW, RICE, or KANO fields support this roadmap's priority — use plain words, not acronyms.",
      meceBucket: "prioritization and evidence",
      guide: "Ask why MoSCoW, RICE, or KANO data in the saved plan justify this roadmap's priority."
    },
    {
      dmaic: "Analyze",
      plainLabel: "What is driving the need?",
      plainFocus: "what work, steps, or blockers create the need",
      plainGuide: "Ask what tasks, dependencies, or delivery factors are pushing this forward.",
      meceBucket: "drivers and dependencies",
      guide: "Ask what process, task, or dependency details explain why action is needed."
    },
    {
      dmaic: "Improve",
      plainLabel: "Who is affected and why does it matter?",
      plainFocus: "who is involved and what business impact is at stake",
      plainGuide: "Ask who is affected and why the business or team outcome matters.",
      meceBucket: "people and business impact",
      guide: "Ask why the people involved, roles, or business impact make this roadmap necessary."
    },
    {
      dmaic: "Control",
      plainLabel: "What is the real reason underneath?",
      plainFocus: "the deepest reason this must happen",
      plainGuide: "Ask for the clearest root reason in plain words — the essence underneath it all.",
      meceBucket: "root reason and clarity",
      guide: "Ask for the deepest, clearest reason this roadmap must exist."
    }
  ];

  const groqTokenUsageEntries = [];
  let lastTavilyFinishedAt = 0;

  function formatMissingFiveWhyKeyMessage(missingProviders) {
    const missing = Array.isArray(missingProviders) ? missingProviders.filter(Boolean) : [];
    if (!missing.length) return "";
    return `5 Why Framework requires Groq and Tavily API keys. Add ${missing.join(" and ")} via header → API keys.`;
  }

  async function resolveFiveWhyApiKeys() {
    if (typeof ByokApiKeys === "undefined") {
      return { ok: false, message: "API keys are not available. Reload the app and try again." };
    }
    const groqKey = await ByokApiKeys.getStoredKey("groq");
    const tavilyKey = await ByokApiKeys.getStoredKey("tavily");
    const missing = [];
    if (!groqKey) missing.push("Groq");
    if (!tavilyKey) missing.push("Tavily");
    if (missing.length) {
      return { ok: false, message: formatMissingFiveWhyKeyMessage(missing) };
    }
    return {
      ok: true,
      provider: "groq",
      apiKey: groqKey,
      groqApiKey: groqKey,
      tavilyApiKey: tavilyKey
    };
  }

  function normalizeRedirectLinkUrl(url) {
    const trimmed = String(url || "").trim();
    if (!trimmed) return null;
    let candidate = trimmed;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(candidate)) {
      candidate = "https://" + candidate;
    }
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
      return parsed.href;
    } catch {
      return null;
    }
  }

  function normalizeSummaryLinks(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    const seen = new Set();
    raw.forEach((item) => {
      if (!item || typeof item !== "object") return;
      const label = String(item.label != null ? item.label : item.name || item.text || "").trim();
      const url = normalizeRedirectLinkUrl(item.url || item.href || item.link || "");
      if (!label || !url) return;
      const key = label + "\0" + url;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ label, url });
    });
    return out;
  }

  function pruneValue(value) {
    if (value == null) return undefined;
    if (Array.isArray(value)) {
      const items = value.map(pruneValue).filter((item) => item !== undefined);
      return items.length ? items : undefined;
    }
    if (typeof value === "object") {
      const out = {};
      Object.keys(value).forEach((key) => {
        const next = pruneValue(value[key]);
        if (next !== undefined) out[key] = next;
      });
      return Object.keys(out).length ? out : undefined;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed ? trimmed : undefined;
    }
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : undefined;
    }
    return value;
  }

  function compactContextForPrompt(context) {
    if (!context || typeof context !== "object") return "{}";
    const out = {};
    Object.keys(context).forEach((key) => {
      const value = context[key];
      if (typeof value === "string") {
        out[key] =
          value.length > FIVE_WHY_CONTEXT_MAX_CHARS
            ? `${value.slice(0, FIVE_WHY_CONTEXT_MAX_CHARS)}...`
            : value;
        return;
      }
      if (Array.isArray(value)) {
        out[key] = value.slice(0, FIVE_WHY_MAX_ARRAY_ITEMS);
        return;
      }
      if (typeof value === "object" && value !== null) {
        const pruned = pruneValue(value);
        if (pruned !== undefined) out[key] = pruned;
        return;
      }
      out[key] = value;
    });
    return JSON.stringify(out);
  }

  function collectPrioritizationFacts(context) {
    const source = context && typeof context === "object" ? context : {};
    const facts = { moscow: null, kano: null, riceSummary: null, riceScore: null, sources: [] };

    const moscow = String(source.moscowCategory || "").trim();
    if (moscow) {
      facts.moscow = moscow;
      facts.sources.push("MoSCoW");
    }

    const kano = String(source.kanoCategory || "").trim();
    if (kano) {
      facts.kano = kano;
      facts.sources.push("KANO");
    }

    const riceParts = [];
    if (source.riceScore != null && Number.isFinite(Number(source.riceScore))) {
      facts.riceScore = Number(source.riceScore);
      riceParts.push(`score ${facts.riceScore}`);
    }
    ["reach", "impact", "confidence", "effort"].forEach((dim) => {
      const value = source[`${dim}Value`];
      if (value != null && Number.isFinite(Number(value))) {
        riceParts.push(`${dim} ${value}`);
      }
    });
    if (riceParts.length) {
      facts.riceSummary = riceParts.join(", ");
      if (!facts.sources.includes("RICE")) facts.sources.push("RICE");
    }

    return facts;
  }

  function hasPrioritizationData(context) {
    const facts = collectPrioritizationFacts(context);
    return facts.sources.length > 0;
  }

  function buildPrioritizationPromptSection(context, level) {
    if (Number(level) !== 2) return "";
    const facts = collectPrioritizationFacts(context);
    if (!facts.sources.length) {
      return (
        "PRIORITIZATION: No MoSCoW, RICE, or KANO fields are saved for this roadmap. " +
        "If timing or plan placement exists in DATA, you may ask about that in plain English.\n\n"
      );
    }
    const lines = [
      "PRIORITIZATION (anchor WHY 2 on saved roadmap scoring — plain English in the question):"
    ];
    if (facts.moscow) lines.push(`- Plan category: ${facts.moscow}`);
    if (facts.kano) lines.push(`- Customer value type: ${facts.kano}`);
    if (facts.riceSummary) lines.push(`- Reach / impact / score: ${facts.riceSummary}`);
    lines.push(
      "- Use these saved values to ask why this priority makes sense.",
      "- Do not name MoSCoW, RICE, or KANO in the question — use everyday words (e.g. Must Have, reach score)."
    );
    return `${lines.join("\n")}\n\n`;
  }

  function buildTavilySearchQuery(context) {
    const parts = [];
    if (context.title) parts.push(String(context.title).trim());
    if (context.description) parts.push(String(context.description).trim().slice(0, 140));
    const facts = collectPrioritizationFacts(context);
    if (facts.moscow) parts.push(facts.moscow);
    if (facts.kano) parts.push(facts.kano);
    if (facts.riceScore != null) parts.push(`priority score ${facts.riceScore}`);
    parts.push("why priority clarity product roadmap");
    return parts.filter(Boolean).join(" — ").slice(0, 240);
  }

  function compactTavilySnippet(text, maxChars) {
    const collapsed = String(text || "")
      .replace(/\s+/g, " ")
      .trim();
    if (!collapsed) return "";
    if (collapsed.length <= maxChars) return collapsed;
    return `${collapsed.slice(0, maxChars)}...`;
  }

  function parseTavilySearchPayload(payload) {
    const answer = compactTavilySnippet(payload && payload.answer, TAVILY_SEARCH_MAX_CHARS);
    const snippets = [];
    const results = payload && Array.isArray(payload.results) ? payload.results : [];
    results.forEach((item) => {
      const snippet = compactTavilySnippet(item && (item.content || item.raw_content), 160);
      if (snippet) snippets.push(snippet);
    });
    return compactTavilySnippet([answer, ...snippets].filter(Boolean).join(" "), TAVILY_SEARCH_MAX_CHARS);
  }

  function parseTavilyExtractPayload(payload, links) {
    const labelByUrl = new Map();
    normalizeSummaryLinks(links).forEach((link) => labelByUrl.set(link.url, link.label));
    const out = [];
    const results = payload && Array.isArray(payload.results) ? payload.results : [];
    results.forEach((item) => {
      const url = normalizeRedirectLinkUrl(item && item.url);
      const snippet = compactTavilySnippet(item && (item.raw_content || item.content), TAVILY_EXTRACT_MAX_CHARS);
      if (!url || !snippet) return;
      out.push({ label: labelByUrl.get(url) || url, url, snippet });
    });
    return out.slice(0, TAVILY_MAX_LINK_EXTRACTS);
  }

  function hasTavilyResearch(research) {
    return !!(
      research &&
      (research.searchBrief || (Array.isArray(research.linkExtracts) && research.linkExtracts.length))
    );
  }

  function recordTavilyUsage(at) {
    lastTavilyFinishedAt = at || Date.now();
  }

  function resetTavilyPacingForTests() {
    lastTavilyFinishedAt = 0;
  }

  function computeTavilyPacingWaitMs(now) {
    if (!lastTavilyFinishedAt) return 0;
    const elapsed = (now || Date.now()) - lastTavilyFinishedAt;
    return Math.max(0, TAVILY_MIN_GAP_MS - elapsed);
  }

  async function callTavilySearch(apiKey, query) {
    const response = await fetch(TAVILY_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: TAVILY_SEARCH_MAX_RESULTS,
        include_answer: true,
        search_depth: "basic"
      })
    });
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (!response.ok) {
      const detail =
        payload && payload.error && payload.error.message
          ? String(payload.error.message)
          : `Tavily search failed (${response.status}).`;
      throw new Error(detail);
    }
    return parseTavilySearchPayload(payload);
  }

  async function callTavilyExtract(apiKey, links) {
    const urls = normalizeSummaryLinks(links)
      .map((link) => link.url)
      .slice(0, TAVILY_MAX_LINK_EXTRACTS);
    if (!urls.length) return [];
    const response = await fetch(TAVILY_EXTRACT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({ api_key: apiKey, urls })
    });
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (!response.ok) {
      const detail =
        payload && payload.error && payload.error.message
          ? String(payload.error.message)
          : `Tavily extract failed (${response.status}).`;
      throw new Error(detail);
    }
    return parseTavilyExtractPayload(payload, links);
  }

  async function gatherFiveWhyTavilyResearch(context, links, tavilyApiKey, onProgress) {
    const research = { searchBrief: "", linkExtracts: [] };
    const normalizedLinks = normalizeSummaryLinks(links);
    let searchError = null;

    if (normalizedLinks.length) {
      if (onProgress) onProgress("Gathering link context for WHY questions (step 1 of 2)…");
      try {
        research.linkExtracts = await callTavilyExtract(tavilyApiKey, normalizedLinks);
      } catch (err) {
        console.warn("5 Why Tavily extract failed:", err);
      }
    }

    const query = buildTavilySearchQuery(context);
    if (!query) {
      throw new Error("Add a title or description to this roadmap before asking WHY questions.");
    }

    if (onProgress) {
      onProgress(
        normalizedLinks.length
          ? "Gathering background context for WHY questions (step 2 of 2)…"
          : "Gathering background context for WHY questions (step 1 of 2)…"
      );
    }
    try {
      research.searchBrief = await callTavilySearch(tavilyApiKey, query);
    } catch (err) {
      searchError = err;
      console.warn("5 Why Tavily search failed:", err);
    }

    if (!hasTavilyResearch(research)) {
      const detail =
        searchError && searchError.message
          ? searchError.message
          : "Tavily returned no usable context for this roadmap.";
      throw new Error(`Could not gather background context: ${detail}`);
    }
    recordTavilyUsage();
    return research;
  }

  function buildResearchPromptSection(research) {
    if (!hasTavilyResearch(research)) return "";
    const parts = [];
    if (research.searchBrief) parts.push(`SEARCH_BRIEF:${JSON.stringify(research.searchBrief)}`);
    if (research.linkExtracts && research.linkExtracts.length) {
      parts.push(
        `LINK_EXTRACTS:${JSON.stringify(
          research.linkExtracts.map((item) => ({ label: item.label, snippet: item.snippet }))
        )}`
      );
    }
    return (
      "BACKGROUND NOTES (wording ideas only — facts must come from saved roadmap fields):\n" +
      `${parts.join("\n")}\n` +
      "- Do not add external facts from RESEARCH.\n\n"
    );
  }

  function normalizePreviousWhys(previousWhys) {
    if (!Array.isArray(previousWhys)) return [];
    return previousWhys
      .map((entry, index) => {
        const level = Number(entry && entry.level) || index + 1;
        let question = String((entry && (entry.question || entry.why_question)) || "").trim();
        if (!question) {
          const legacy = String((entry && (entry.text || entry.why)) || "").trim();
          if (legacy.endsWith("?")) question = legacy;
        }
        if (!question) return null;
        return { level, question: ensureWhyQuestionEnds(question) };
      })
      .filter(Boolean)
      .slice(0, FIVE_WHY_MAX_LEVELS);
  }

  function getNextWhyLevel(previousWhys) {
    const chain = normalizePreviousWhys(previousWhys);
    if (chain.length >= FIVE_WHY_MAX_LEVELS) return null;
    return chain.length + 1;
  }

  function getWhyGenerateButtonLabel(previousWhys) {
    const next = getNextWhyLevel(previousWhys);
    if (!next) return "Framework complete";
    return `Ask WHY ${next}`;
  }

  function getWhyLevelLens(level) {
    const index = Math.max(0, Math.min(Number(level) - 1, WHY_LEVEL_LENS.length - 1));
    return WHY_LEVEL_LENS[index];
  }

  function getWhyLevelFocus(level) {
    const lens = getWhyLevelLens(level);
    return lens ? lens.meceBucket : "";
  }

  function getWhyLevelLensLabel(level) {
    const lens = getWhyLevelLens(level);
    if (!lens) return "";
    return lens.plainLabel || "";
  }

  function buildAnalyticalLensSection(level, compact) {
    const lens = getWhyLevelLens(level);
    if (!lens) return "";
    if (compact) {
      return `ANGLE FOR WHY ${level}: ${lens.plainFocus}. ${lens.plainGuide}\n\n`;
    }
    return (
      `WHAT TO ASK (WHY ${level}):\n` +
      `- Main angle: ${lens.plainFocus}\n` +
      `- Reader-friendly goal: ${lens.plainLabel}\n` +
      `- Guidance: ${lens.plainGuide}\n` +
      `- Use everyday words. No jargon or framework names in the question.\n\n`
    );
  }

  function collectWhyAnchorTerms(context) {
    const terms = new Set();
    const source = context && typeof context === "object" ? context : {};
    [
      source.title,
      source.moscowCategory,
      source.roadmapType,
      source.roadmapPeriod,
      source.roadmapStatus,
      source.tshirtSize
    ].forEach((value) => {
      if (!value) return;
      String(value)
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((word) => word.length > 2)
        .forEach((word) => terms.add(word));
    });
    return terms;
  }

  function tokenizeWhyQuestionDistinct(question, anchorTerms) {
    const anchors = anchorTerms instanceof Set ? anchorTerms : collectWhyAnchorTerms(anchorTerms);
    return tokenizeWhyQuestion(question).filter((token) => !anchors.has(token.toLowerCase()));
  }

  function buildMeceUsedBucketsSection(previousWhys) {
    const chain = normalizePreviousWhys(previousWhys);
    if (!chain.length) return "";
    const used = chain
      .map((entry) => `WHY ${entry.level}=${getWhyLevelLens(entry.level).meceBucket}`)
      .join("; ");
    return `TOPICS ALREADY COVERED: ${used}. Pick a fresh angle for this WHY.\n\n`;
  }

  function normalizeQuestionForCompare(question) {
    return String(question || "")
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function tokenizeWhyQuestion(question) {
    return normalizeQuestionForCompare(question)
      .split(" ")
      .filter((word) => word.length > 2 && !WHY_QUESTION_STOP_WORDS.has(word));
  }

  function computeWhyQuestionSimilarity(questionA, questionB, context) {
    const anchors = collectWhyAnchorTerms(context);
    const tokensA = tokenizeWhyQuestionDistinct(questionA, anchors);
    const tokensB = tokenizeWhyQuestionDistinct(questionB, anchors);
    if (!tokensA.length && !tokensB.length) {
      return normalizeQuestionForCompare(questionA) === normalizeQuestionForCompare(questionB) ? 1 : 0;
    }
    if (!tokensA.length || !tokensB.length) return 0;
    const setA = new Set(tokensA);
    const setB = new Set(tokensB);
    let intersection = 0;
    setA.forEach((token) => {
      if (setB.has(token)) intersection += 1;
    });
    const union = setA.size + setB.size - intersection;
    return union === 0 ? 0 : intersection / union;
  }

  function isNearDuplicateSubstring(normalizedA, normalizedB) {
    if (!normalizedA || !normalizedB) return false;
    const short = normalizedA.length <= normalizedB.length ? normalizedA : normalizedB;
    const long = normalizedA.length <= normalizedB.length ? normalizedB : normalizedA;
    if (short.length < 24) return false;
    if (!long.includes(short)) return false;
    return short.length / long.length >= 0.82;
  }

  function getWhyQuestionOpening(question) {
    return normalizeQuestionForCompare(question)
      .replace(/^why\s+/, "")
      .split(" ")
      .slice(0, 6)
      .join(" ");
  }

  function detectWhyQuestionRedundancy(newQuestion, previousWhys, level, context) {
    const issues = [];
    const normalizedNew = normalizeQuestionForCompare(newQuestion);
    const openingNew = getWhyQuestionOpening(newQuestion);
    const chain = normalizePreviousWhys(previousWhys);
    const targetLevel = Number(level) || chain.length + 1;

    if (!normalizedNew) return issues;

    chain.forEach((entry) => {
      const prior = entry.question;
      const normalizedPrior = normalizeQuestionForCompare(prior);
      if (!normalizedPrior) return;

      const isAdjacent = entry.level === targetLevel - 1;

      if (normalizedNew === normalizedPrior) {
        issues.push(`duplicate of WHY ${entry.level}`);
        return;
      }

      if (isNearDuplicateSubstring(normalizedNew, normalizedPrior)) {
        issues.push(`near-duplicate of WHY ${entry.level}`);
      }

      const similarity = computeWhyQuestionSimilarity(newQuestion, prior, context);
      const similarityThreshold = isAdjacent ? FIVE_WHY_SIMILARITY_ADJACENT : FIVE_WHY_SIMILARITY_STRICT;
      if (similarity >= similarityThreshold) {
        issues.push(`overlaps WHY ${entry.level} (${Math.round(similarity * 100)}% similar)`);
      }

      if (isAdjacent) {
        const openingPrior = getWhyQuestionOpening(prior);
        if (openingNew.length > 12 && openingNew === openingPrior) {
          issues.push(`same opening as WHY ${entry.level}`);
        }
      }
    });

    return [...new Set(issues)];
  }

  function buildForbiddenQuestionSection(previousWhys, recentCount) {
    const chain = normalizePreviousWhys(previousWhys);
    if (!chain.length) return "";
    const limit = Number(recentCount) > 0 ? Number(recentCount) : chain.length;
    const recent = chain.slice(-limit);
    const omitted = chain.length > recent.length ? chain.length - recent.length : 0;
    return (
      "DO NOT REPEAT these earlier questions:\n" +
      `${recent.map((entry) => `- WHY ${entry.level}: ${entry.question}`).join("\n")}\n` +
      (omitted
        ? `- Also use different words from WHY 1${omitted > 1 ? `–${omitted}` : ""}.\n`
        : "") +
      "- Ask about a new angle in plain English.\n\n"
    );
  }

  function buildPrioritizationFallbackQuestions(level, context, title) {
    if (Number(level) !== 2) return [];
    const facts = collectPrioritizationFacts(context);
    const period = context && context.roadmapPeriod ? String(context.roadmapPeriod).trim() : "";
    const candidates = [];
    if (facts.moscow) {
      candidates.push(`Why is ${title} marked as ${facts.moscow} on the plan?`);
    }
    if (facts.kano) {
      candidates.push(`Why does the ${facts.kano} customer value rating support ${title} as a priority?`);
    }
    if (facts.riceScore != null) {
      candidates.push(`Why does a priority score of ${facts.riceScore} fit ${title}?`);
    }
    if (facts.riceSummary && facts.riceScore == null) {
      candidates.push(`Why do the reach and impact numbers for ${title} justify its priority?`);
    }
    if (period) {
      candidates.push(`Why does ${title} need to happen in ${period}?`);
    }
    if (!candidates.length) {
      candidates.push(`Why is ${title} treated as a priority on this roadmap?`);
    }
    return candidates;
  }

  function buildFallbackWhyQuestion(level, context, previousWhys) {
    const lens = getWhyLevelLens(level);
    const title = String((context && context.title) || "this roadmap").trim() || "this roadmap";
    const bucket = lens ? lens.meceBucket : `WHY ${level}`;

    const plainFocus = lens && lens.plainFocus ? lens.plainFocus : bucket;
    const candidates = [
      level === 1 ? `Why was ${title} added to this roadmap?` : "",
      ...buildPrioritizationFallbackQuestions(level, context, title),
      level === 3 ? `Why do the tasks behind ${title} make it needed right now?` : "",
      level === 4 ? `Why do the people involved need ${title} to happen?` : "",
      level === 5 ? `What is the deepest reason ${title} must happen?` : "",
      `Why does ${plainFocus} for ${title} need a clearer answer at step ${level}?`
    ].filter(Boolean);

    for (let index = 0; index < candidates.length; index += 1) {
      const question = ensureWhyQuestionEnds(candidates[index]);
      const issues = detectWhyQuestionRedundancy(question, previousWhys, level, context);
      if (!issues.length) return { question };
    }

    return {
      question: ensureWhyQuestionEnds(
        `Why does ${plainFocus} for ${title} still need a plain answer at step ${level}?`
      )
    };
  }

  function buildWhyRedundancyRetryHint(issues, previousWhys, level) {
    const chain = normalizePreviousWhys(previousWhys);
    const issueText = issues.length ? issues.join("; ") : "redundant wording";
    const prior = chain[chain.length - 1];
    const lens = getWhyLevelLens(level);
    return (
      `Try again: WHY ${level} was too similar (${issueText}). ` +
      `Focus on: ${lens ? lens.plainFocus : getWhyLevelFocus(level)}. ` +
      `Use simple, different words. ` +
      `Do not repeat WHY ${prior ? prior.level : level - 1} ("${prior && prior.question ? prior.question.slice(0, 100) : "prior question"}").`
    );
  }

  function buildWhyPrompt(context, level, previousWhys, research, retryHint) {
    const chain = normalizePreviousWhys(previousWhys).map((entry) => ({
      level: entry.level,
      question: entry.question,
      meceBucket: getWhyLevelFocus(entry.level)
    }));
    const compact = level >= FIVE_WHY_COMPACT_PROMPT_FROM_LEVEL;
    const chainJson = compact
      ? JSON.stringify(chain.slice(-FIVE_WHY_FORBIDDEN_RECENT_COUNT))
      : JSON.stringify(chain);
    const prior = chain[chain.length - 1];
    const lens = getWhyLevelLens(level);
    const levelGuide =
      level === 1
        ? "WHY 1: Ask in plain English why this roadmap was started. Use only saved roadmap facts. Do not answer — only ask one clear question."
        : level === 2
          ? "WHY 2: Ask in plain English why this roadmap is a priority. Anchor on saved MoSCoW category, RICE reach/impact/score, and/or KANO customer value type from DATA. Use everyday words — no acronyms in the question."
          : `WHY ${level}: Ask in plain English and go one step deeper than WHY ${level - 1} ("${prior && prior.question ? prior.question.slice(0, compact ? 90 : 140) : "prior question"}"). Do not answer or assume.`;
    const retrySection = retryHint ? `${String(retryHint).trim()}\n\n` : "";
    const meceSection = compact ? "" : buildMeceUsedBucketsSection(previousWhys);
    const prioritizationSection = buildPrioritizationPromptSection(context, level);
    const researchSection =
      compact && level > 3 ? "" : buildResearchPromptSection(research);
    return (
      `5 Why Framework — write WHY ${level} as one plain-English question only.\n\n` +
      `${retrySection}` +
      `${levelGuide}\n` +
      buildAnalyticalLensSection(level, compact) +
      prioritizationSection +
      meceSection +
      "- Plain English only: short, clear, everyday words anyone can understand.\n" +
      "- No jargon, acronyms, or framework names in the question.\n" +
      "- One direct Why-question ending with ? (about 10–22 words).\n" +
      "- Use facts from the saved roadmap fields only.\n" +
      "- Do not answer. Do not guess. Do not mention missing fields.\n" +
      "- Pick a new angle from earlier WHY steps.\n" +
      (compact ? "" : "- RESEARCH is for wording ideas only — not for new facts.\n") +
      '- JSON only: {"question":"Why ...?"}\n\n' +
      buildForbiddenQuestionSection(
        chain,
        compact ? FIVE_WHY_FORBIDDEN_RECENT_COUNT : chain.length
      ) +
      researchSection +
      `PREVIOUS_WHYS:${chainJson}\n` +
      `DATA:${compactContextForPrompt(context)}`
    );
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function sleepWithProgress(waitMs, onProgress, statusPrefix) {
    if (!waitMs || waitMs <= 0) return;
    let remainingMs = waitMs;
    if (onProgress) onProgress(`${statusPrefix} — ${Math.ceil(remainingMs / 1000)}s remaining…`);
    while (remainingMs > 0) {
      const slice = Math.min(1000, remainingMs);
      await sleep(slice);
      remainingMs -= slice;
      if (onProgress && remainingMs > 0) {
        onProgress(`${statusPrefix} — ${Math.ceil(remainingMs / 1000)}s remaining…`);
      }
    }
  }

  function pruneGroqTokenUsage(now) {
    const cutoff = (now || Date.now()) - GROQ_TPM_WINDOW_MS;
    while (groqTokenUsageEntries.length && groqTokenUsageEntries[0].at < cutoff) {
      groqTokenUsageEntries.shift();
    }
  }

  function recordGroqTokenUsage(tokens, at) {
    const value = Math.ceil(Number(tokens));
    if (!Number.isFinite(value) || value <= 0) return;
    groqTokenUsageEntries.push({ tokens: value, at: at || Date.now() });
    pruneGroqTokenUsage();
  }

  function resetGroqTokenBudgetForTests() {
    groqTokenUsageEntries.length = 0;
  }

  function estimateGroqRequestTokens(prompt) {
    return Math.ceil(prompt.length / 3.2) + GROQ_MAX_OUTPUT_TOKENS;
  }

  function computeGroqPacingWaitMs(estimatedTokens, now) {
    const current = now || Date.now();
    pruneGroqTokenUsage(current);
    const rolling = groqTokenUsageEntries.reduce((sum, entry) => sum + entry.tokens, 0);
    const budget = GROQ_TPM_LIMIT - GROQ_TPM_BUFFER;
    if (rolling + estimatedTokens <= budget) return 0;
    const overflow = rolling + estimatedTokens - budget;
    return Math.max(0, Math.ceil((overflow / GROQ_TPM_LIMIT) * GROQ_TPM_WINDOW_MS) + 300);
  }

  function parseGroqRetryDelayMs(message) {
    const match = String(message || "").match(/try again in\s+([\d.]+)\s*s/i);
    if (!match) return GROQ_DEFAULT_RETRY_DELAY_MS;
    return Math.ceil(parseFloat(match[1]) * 1000) + 400;
  }

  function isGroqRateLimitError(status, message) {
    return status === 429 || /rate limit reached/i.test(String(message || ""));
  }

  function formatGroqErrorForUser(message) {
    const detail = String(message || "").trim();
    if (isGroqRateLimitError(429, detail)) {
      const waitSeconds = Math.max(1, Math.ceil(parseGroqRetryDelayMs(detail) / 1000));
      return `Groq free-tier rate limit reached. Wait ~${waitSeconds}s and try again.`;
    }
    return detail || "Could not generate the 5 Why step.";
  }

  function parseWhyResponse(text) {
    const trimmed = String(text || "").trim();
    if (!trimmed) return { question: "", hasAnswer: false };

    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidates = fenceMatch && fenceMatch[1] ? [fenceMatch[1].trim(), trimmed] : [trimmed];

    for (const candidate of candidates) {
      const objectMatch = candidate.match(/\{[\s\S]*\}/);
      if (!objectMatch) continue;
      try {
        const parsed = JSON.parse(objectMatch[0]);
        let question = String(
          (parsed && (parsed.question || parsed.why_question || parsed.ask)) || ""
        ).trim();
        const reason = String(
          (parsed && (parsed.reason || parsed.answer || parsed.text)) || ""
        ).trim();
        const whyField = String((parsed && parsed.why) || "").trim();
        if (!question && whyField.endsWith("?")) question = whyField;
        const hasAnswer = !!(
          (reason && !reason.endsWith("?")) ||
          (parsed && (parsed.clarity || parsed.insight || parsed.essence))
        );
        if (question || hasAnswer) return { question, hasAnswer };
      } catch {
        /* try next */
      }
    }

    const fallback = trimmed.replace(/^```(?:json)?|```$/gi, "").trim();
    return { question: fallback.endsWith("?") ? fallback : "", hasAnswer: !fallback.endsWith("?") && !!fallback };
  }

  function ensureWhyQuestionEnds(question) {
    const cleaned = String(question || "")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[.!]+$/, "");
    if (!cleaned) return "";
    return cleaned.endsWith("?") ? cleaned : `${cleaned}?`;
  }

  function normalizeWhyQuestion(parsed, level) {
    if (parsed.hasAnswer && !parsed.question) {
      throw new Error(
        `The model gave an answer for WHY ${level} instead of a question. Click Ask WHY ${level} again.`
      );
    }

    const question = ensureWhyQuestionEnds(parsed.question || "");
    if (!question) {
      throw new Error(`No question came back for WHY ${level}. Click Ask WHY ${level} again.`);
    }

    return { question };
  }

  async function callGroqWhy(apiKey, prompt, level, onProgress, callOptions) {
    const estimatedTokens = estimateGroqRequestTokens(prompt);
    const groqWaitMs = computeGroqPacingWaitMs(estimatedTokens);
    if (groqWaitMs > 0) {
      await sleepWithProgress(groqWaitMs, onProgress, "Groq free-tier token budget — pacing before 5 Why");
    }

    const temperature =
      callOptions && Number.isFinite(Number(callOptions.temperature))
        ? Number(callOptions.temperature)
        : 0.15;

    let rateLimitRetries = 0;
    while (rateLimitRetries < GROQ_RATE_LIMIT_RETRY_ATTEMPTS) {
      const response = await fetch(GROQ_CHAT_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            {
              role: "system",
              content:
                "Write one plain-English Why question in JSON ({\"question\":\"...\"}). Use simple words anyone can understand. No jargon. Facts from saved roadmap data only. Never answer or assume."
            },
            { role: "user", content: prompt }
          ],
          temperature,
          max_tokens: GROQ_MAX_OUTPUT_TOKENS,
          response_format: { type: "json_object" }
        })
      });

      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok) {
        const detail =
          payload && payload.error && payload.error.message
            ? String(payload.error.message)
            : `Groq request failed (${response.status}).`;
        if (isGroqRateLimitError(response.status, detail) && rateLimitRetries < GROQ_RATE_LIMIT_RETRY_ATTEMPTS - 1) {
          rateLimitRetries += 1;
          await sleepWithProgress(
            parseGroqRetryDelayMs(detail),
            onProgress,
            "Rate limit reached — retrying automatically"
          );
          continue;
        }
        throw new Error(formatGroqErrorForUser(detail));
      }

      const usage = payload && payload.usage ? payload.usage : null;
      if (usage && Number.isFinite(Number(usage.total_tokens))) {
        recordGroqTokenUsage(Number(usage.total_tokens));
      } else {
        recordGroqTokenUsage(estimatedTokens);
      }

      const choice = payload && Array.isArray(payload.choices) ? payload.choices[0] : null;
      const content = choice && choice.message && choice.message.content;
      return normalizeWhyQuestion(parseWhyResponse(content), level);
    }
    throw new Error("Rate limit reached too many times. Wait a minute and try again.");
  }

  async function awaitFiveWhyApiCooldowns(onProgress) {
    const groqWaitMs = computeGroqPacingWaitMs(estimateGroqRequestTokens(""));
    const tavilyWaitMs = computeTavilyPacingWaitMs();
    const waitMs = Math.max(groqWaitMs, tavilyWaitMs);
    if (waitMs > 0) {
      const parts = [];
      if (groqWaitMs > 0) parts.push("Groq");
      if (tavilyWaitMs > 0) parts.push("Tavily");
      await sleepWithProgress(
        waitMs,
        onProgress,
        `Waiting before the next WHY question`
      );
    }
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderWhyParagraphHtml(text) {
    return escapeHtml(String(text || "").trim());
  }

  async function generateNextWhy(contextObject, session, options) {
    const resolved = await resolveFiveWhyApiKeys();
    if (!resolved.ok) throw new Error(resolved.message);

    const onProgress = options && typeof options.onProgress === "function" ? options.onProgress : null;
    const source = session && typeof session === "object" ? session : {};
    const previousWhys = normalizePreviousWhys(source.whys);
    const level = getNextWhyLevel(previousWhys);
    if (!level) {
      throw new Error("All 5 WHY questions are done. Reset to start a new chain.");
    }

    const context = contextObject && typeof contextObject === "object" ? contextObject : {};
    const links = normalizeSummaryLinks(context.links);
    let research = source.research || null;

    if (level === 1) {
      research = await gatherFiveWhyTavilyResearch(context, links, resolved.tavilyApiKey, onProgress);
    } else {
      await awaitFiveWhyApiCooldowns(onProgress);
      if (!hasTavilyResearch(research)) {
        if (onProgress) onProgress("Refreshing background context for the next WHY…");
        research = await gatherFiveWhyTavilyResearch(context, links, resolved.tavilyApiKey, onProgress);
      } else if (onProgress) {
        onProgress(`Writing WHY ${level} in plain English…`);
      }
    }

    if (level === 1 && onProgress) {
      onProgress(`Writing WHY ${level} in plain English…`);
    } else if (level > 1 && onProgress && hasTavilyResearch(research)) {
      onProgress(`Writing WHY ${level} in plain English…`);
    }

    let retryHint = "";
    let step = null;
    let usedFallback = false;
    for (let attempt = 0; attempt < FIVE_WHY_REDUNDANCY_RETRY_ATTEMPTS; attempt += 1) {
      const prompt = buildWhyPrompt(context, level, previousWhys, research, retryHint);
      const temperature = Math.min(0.42, 0.14 + attempt * 0.07);
      if (attempt > 0 && onProgress) {
        onProgress(`Trying a fresher wording for WHY ${level} (attempt ${attempt + 1})…`);
      }
      try {
        step = await callGroqWhy(resolved.apiKey, prompt, level, onProgress, { temperature });
      } catch (err) {
        if (attempt >= FIVE_WHY_REDUNDANCY_RETRY_ATTEMPTS - 1) {
          if (onProgress) onProgress(`Using a simple backup question for WHY ${level}…`);
          step = buildFallbackWhyQuestion(level, context, previousWhys);
          usedFallback = true;
          break;
        }
        retryHint = `RETRY: ${err && err.message ? err.message : "Generation failed"}. Ask a distinct WHY ${level} question.`;
        continue;
      }
      const redundancyIssues = detectWhyQuestionRedundancy(step.question, previousWhys, level, context);
      if (!redundancyIssues.length) break;
      if (attempt >= FIVE_WHY_REDUNDANCY_RETRY_ATTEMPTS - 1) {
        if (onProgress) onProgress(`Using a simple backup question for WHY ${level}…`);
        step = buildFallbackWhyQuestion(level, context, previousWhys);
        usedFallback = true;
        break;
      }
      retryHint = buildWhyRedundancyRetryHint(redundancyIssues, previousWhys, level);
    }
    if (!step) {
      step = buildFallbackWhyQuestion(level, context, previousWhys);
      usedFallback = true;
    }
    const entry = { level, question: step.question, lens: getWhyLevelLensLabel(level) };

    return {
      entry,
      whys: previousWhys.concat([entry]),
      research,
      preparedContext: context,
      links,
      provider: resolved.provider,
      complete: level >= FIVE_WHY_MAX_LEVELS,
      usedFallback
    };
  }

  global.RoadmapFiveWhyFramework = {
    FIVE_WHY_MAX_LEVELS,
    resolveFiveWhyApiKeys,
    generateNextWhy,
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
    resetGroqTokenBudgetForTests,
    resetTavilyPacingForTests,
    computeGroqPacingWaitMs,
    computeTavilyPacingWaitMs
  };
})(typeof window !== "undefined" ? window : globalThis);
