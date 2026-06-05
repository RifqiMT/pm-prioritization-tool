/**
 * Roadmap LLM summary — Tavily research (optional) + Groq synthesis (client-side BYOK).
 */
(function (global) {
  const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
  const GROQ_MODEL = "llama-3.1-8b-instant";
  const TAVILY_SEARCH_URL = "https://api.tavily.com/search";
  const TAVILY_EXTRACT_URL = "https://api.tavily.com/extract";
  const TAVILY_MAX_LINK_EXTRACTS = 3;
  const TAVILY_EXTRACT_MAX_CHARS = 320;
  const TAVILY_SEARCH_MAX_CHARS = 380;
  const TAVILY_SEARCH_MAX_RESULTS = 2;
  const SUMMARY_RETRY_ATTEMPTS = 3;
  const SUMMARY_MIN_ANCHOR_CHARS = 4;
  const SUMMARY_PHRASE_DEDUPE_WORDS = 5;
  const PROFESSIONAL_SENTENCES_PER_PARAGRAPH = 8;
  const SIMPLIFIED_SENTENCES_PER_PARAGRAPH = 5;
  const PROFESSIONAL_MIN_SENTENCES_PER_PARAGRAPH = 5;
  const SIMPLIFIED_MIN_SENTENCES_PER_PARAGRAPH = 3;
  const SUMMARY_CONTEXT_MAX_FIELD_CHARS = 420;
  const SUMMARY_CONTEXT_MAX_ARRAY_ITEMS = 6;
  const GROQ_TPM_LIMIT = 6000;
  const GROQ_TPM_WINDOW_MS = 60000;
  const GROQ_TPM_BUFFER = 250;
  const GROQ_DEFAULT_RETRY_DELAY_MS = 12000;
  const GROQ_RATE_LIMIT_RETRY_ATTEMPTS = 5;
  const GROQ_MAX_OUTPUT_TOKENS = {
    professional: 960,
    simplified: 600
  };
  const TAVILY_MIN_GAP_MS = 8000;
  const groqTokenUsageEntries = [];
  let lastTavilyFinishedAt = 0;
  const SUMMARY_PARAGRAPH_KEYS = ["paragraph1", "paragraph2", "paragraph3"];

  const SUMMARY_FIELD_GROUPS = {
    opening: ["title", "description", "note", "roadmapType", "roadmapStatus", "roadmapPeriod"],
    prioritization: [
      "moscowCategory",
      "kanoFunctionality",
      "kanoSatisfaction",
      "kanoCategory",
      "riceScore",
      "reachValue",
      "reachDescription",
      "impactValue",
      "impactDescription",
      "confidenceValue",
      "confidenceDescription",
      "effortValue",
      "effortDescription",
      "tshirtSize"
    ],
    delivery: [
      "tasks",
      "raci",
      "countries",
      "labels",
      "links",
      "financialImpactValue",
      "financialImpactCurrency",
      "financialImpactFramework"
    ]
  };

  function formatMissingSummaryKeyMessage(missingProviders) {
    const missing = Array.isArray(missingProviders) ? missingProviders.filter(Boolean) : [];
    if (!missing.length) return "";
    return `Roadmap summary requires Groq and Tavily API keys. Add ${missing.join(" and ")} via header → API keys.`;
  }

  async function resolveSummaryApiKeys() {
    if (typeof ByokApiKeys === "undefined") {
      return { ok: false, message: "API keys are not available. Reload the app and try again." };
    }
    const groqKey = await ByokApiKeys.getStoredKey("groq");
    const tavilyKey = await ByokApiKeys.getStoredKey("tavily");
    const missing = [];
    if (!groqKey) missing.push("Groq");
    if (!tavilyKey) missing.push("Tavily");
    if (missing.length) {
      return { ok: false, message: formatMissingSummaryKeyMessage(missing) };
    }
    return {
      ok: true,
      provider: "groq",
      apiKey: groqKey,
      groqApiKey: groqKey,
      tavilyApiKey: tavilyKey
    };
  }

  async function resolveGroqApiKey() {
    return resolveSummaryApiKeys();
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

  function emptySummaryVariant() {
    return { paragraph1: "", paragraph2: "", paragraph3: "" };
  }

  function coalesceSummaryVariant(variant) {
    const source = variant && typeof variant === "object" ? variant : {};
    return {
      paragraph1: normalizeSummaryParagraph(source.paragraph1),
      paragraph2: normalizeSummaryParagraph(source.paragraph2),
      paragraph3: normalizeSummaryParagraph(source.paragraph3)
    };
  }

  function buildLinksPromptRule(links) {
    if (!links.length) return "";
    return (
      "- The links array is non-empty: in paragraph3 you MUST mention every link label from JSON.\n" +
      "- Mention each link label exactly once in the entire summary — never repeat a link label.\n" +
      "- Use each link's exact display label only — never paste raw URL strings in paragraph text.\n" +
      "- Example phrasing: 'Reference materials include Spec and Design guide.'\n"
    );
  }

  function buildNoDuplicationRules() {
    return (
      "- Never repeat the same fact, field value, phrase, or link label anywhere in the summary.\n" +
      "- Each roadmap link label may appear at most once across all three paragraphs.\n" +
      "- Synthesize insights; do not enumerate or read back JSON keys or raw field lists.\n" +
      "- Each sentence must add NEW information; never paraphrase or restate a prior sentence.\n" +
      "- Do not reuse the same opening clause (e.g. 'This roadmap', 'The initiative', 'In summary').\n"
    );
  }

  function buildParagraphExclusiveRules(context) {
    const present = listPresentContextKeys(context);
    const opening = intersectFields(present, SUMMARY_FIELD_GROUPS.opening);
    const prioritization = intersectFields(present, SUMMARY_FIELD_GROUPS.prioritization);
    const delivery = intersectFields(present, SUMMARY_FIELD_GROUPS.delivery);
    const lines = [
      "- Each data point appears once in the entire summary.",
      "- paragraph1 introduces context; paragraph2 adds prioritization; paragraph3 adds delivery — no overlap.",
      "- Never repeat title, description, scores, categories, or labels across paragraphs."
    ];
    if (opening.length) {
      lines.push(`- paragraph1 ONLY: ${opening.join(", ")} — never mention these again in p2/p3.`);
    }
    if (prioritization.length) {
      lines.push(`- paragraph2 ONLY: ${prioritization.join(", ")} — never mention these in p1/p3.`);
    }
    if (delivery.length) {
      lines.push(`- paragraph3 ONLY: ${delivery.join(", ")} — never mention these in p1/p2.`);
    }
    return `${lines.join("\n")}\n`;
  }

  function buildTavilySearchQuery(context) {
    const parts = [];
    if (context.title) parts.push(String(context.title).trim());
    if (context.description) {
      parts.push(String(context.description).trim().slice(0, 160));
    }
    if (context.roadmapType) parts.push(String(context.roadmapType).trim());
    if (context.moscowCategory) parts.push(`MoSCoW ${context.moscowCategory}`);
    if (context.kanoCategory) parts.push(`Kano ${context.kanoCategory}`);
    if (context.riceScore != null && Number.isFinite(Number(context.riceScore))) {
      parts.push(`RICE ${context.riceScore}`);
    }
    if (context.tshirtSize) parts.push(String(context.tshirtSize).trim());
    const query = parts.filter(Boolean).join(" — ");
    return query.slice(0, 240);
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
      const snippet = compactTavilySnippet(item && (item.content || item.raw_content), 180);
      if (snippet) snippets.push(snippet);
    });
    const merged = [answer, ...snippets].filter(Boolean).join(" ");
    return compactTavilySnippet(merged, TAVILY_SEARCH_MAX_CHARS);
  }

  function parseTavilyExtractPayload(payload, links) {
    const labelByUrl = new Map();
    normalizeSummaryLinks(links).forEach((link) => {
      labelByUrl.set(link.url, link.label);
    });
    const out = [];
    const results = payload && Array.isArray(payload.results) ? payload.results : [];
    results.forEach((item) => {
      const url = normalizeRedirectLinkUrl(item && item.url);
      const raw = item && (item.raw_content || item.content);
      const snippet = compactTavilySnippet(raw, TAVILY_EXTRACT_MAX_CHARS);
      if (!url || !snippet) return;
      out.push({
        label: labelByUrl.get(url) || url,
        url,
        snippet
      });
    });
    return out.slice(0, TAVILY_MAX_LINK_EXTRACTS);
  }

  function hasTavilyResearch(research) {
    return !!(
      research &&
      (research.searchBrief || (Array.isArray(research.linkExtracts) && research.linkExtracts.length))
    );
  }

  function buildResearchPromptSection(research) {
    if (!hasTavilyResearch(research)) return "";
    const parts = [];
    if (research.searchBrief) {
      parts.push(`SEARCH_BRIEF:${JSON.stringify(research.searchBrief)}`);
    }
    if (research.linkExtracts && research.linkExtracts.length) {
      parts.push(
        `LINK_EXTRACTS:${JSON.stringify(
          research.linkExtracts.map((item) => ({
            label: item.label,
            snippet: item.snippet
          }))
        )}`
      );
    }
    return (
      "RESEARCH (Tavily — supplementary wording aid; facts must still come from DATA only):\n" +
      `${parts.join("\n")}\n` +
      "- Use LINK_EXTRACTS only to enrich paragraph3 delivery context for labeled links.\n" +
      "- Do not add external facts from SEARCH_BRIEF or RESEARCH.\n\n"
    );
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
      body: JSON.stringify({
        api_key: apiKey,
        urls
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
          : `Tavily extract failed (${response.status}).`;
      throw new Error(detail);
    }
    return parseTavilyExtractPayload(payload, links);
  }

  async function gatherTavilyResearch(context, links, tavilyApiKey, onProgress) {
    if (!tavilyApiKey) {
      throw new Error(formatMissingSummaryKeyMessage(["Tavily"]));
    }
    const research = { searchBrief: "", linkExtracts: [] };
    const normalizedLinks = normalizeSummaryLinks(links);
    let searchError = null;

    if (normalizedLinks.length) {
      if (onProgress) onProgress("Tavily: extracting roadmap link context (step 1 of 2)…");
      try {
        research.linkExtracts = await callTavilyExtract(tavilyApiKey, normalizedLinks);
      } catch (err) {
        console.warn("Roadmap summary Tavily extract failed:", err);
      }
    }

    const query = buildTavilySearchQuery(context);
    if (!query) {
      throw new Error(
        "This roadmap needs a title or description before Tavily can gather context for the summary."
      );
    }

    if (onProgress) {
      onProgress(
        normalizedLinks.length
          ? "Tavily: gathering topic context (step 2 of 2)…"
          : "Tavily: gathering topic context (step 1 of 2)…"
      );
    }
    try {
      research.searchBrief = await callTavilySearch(tavilyApiKey, query);
    } catch (err) {
      searchError = err;
      console.warn("Roadmap summary Tavily search failed:", err);
    }

    if (!hasTavilyResearch(research)) {
      const detail =
        searchError && searchError.message
          ? searchError.message
          : "Tavily returned no usable context for this roadmap.";
      throw new Error(`Tavily research failed: ${detail}`);
    }
    recordTavilyUsage();
    return research;
  }

  function pickSpreadSentences(sentences, count) {
    if (!sentences.length) return [];
    if (sentences.length <= count) return sentences.slice();
    if (count === 1) return [sentences[0]];
    const picked = [];
    const used = new Set();
    for (let i = 0; i < count; i += 1) {
      const idx = Math.round((i * (sentences.length - 1)) / (count - 1));
      if (!used.has(idx)) {
        picked.push(sentences[idx]);
        used.add(idx);
      }
    }
    let cursor = 0;
    while (picked.length < count && cursor < sentences.length) {
      if (!used.has(cursor)) {
        picked.push(sentences[cursor]);
        used.add(cursor);
      }
      cursor += 1;
    }
    return picked.slice(0, count);
  }

  function softenStoryTone(text) {
    return String(text || "")
      .replace(/\butilized\b/gi, "used")
      .replace(/\butilizes\b/gi, "uses")
      .replace(/\butilize\b/gi, "use")
      .replace(/\bleverages\b/gi, "uses")
      .replace(/\bleverage\b/gi, "use")
      .replace(/\bfacilitates\b/gi, "helps")
      .replace(/\bfacilitate\b/gi, "help")
      .replace(/\boperationalize\b/gi, "carry out")
      .replace(/\bFurthermore,?\s*/gi, "Also, ")
      .replace(/\bIn addition,?\s*/gi, "Also, ")
      .replace(/\bConsequently,?\s*/gi, "So, ")
      .replace(/\bTaken together,?\s*/gi, "Overall, ")
      .replace(/\bIt is important to note that\s*/gi, "")
      .replace(/\bThis roadmap item\b/gi, "This work")
      .replace(/\bThe initiative\b/gi, "This work");
  }

  function finalizeSimplifiedParagraph(text, targetCount) {
    const normalized = normalizeSummaryParagraph(text);
    const sentences = splitSentences(normalized);
    const picked = pickSpreadSentences(sentences, targetCount);
    const softened = softenStoryTone(joinSummarySentences(picked));
    return normalizeSentenceSpacing(trimParagraphToSentenceCount(softened, targetCount));
  }

  function deriveSimplifiedFromProfessional(professional) {
    const target = SIMPLIFIED_SENTENCES_PER_PARAGRAPH;
    const coalesced = coalesceSummaryVariant(professional);
    return {
      paragraph1: finalizeSimplifiedParagraph(coalesced.paragraph1, target),
      paragraph2: finalizeSimplifiedParagraph(coalesced.paragraph2, target),
      paragraph3: finalizeSimplifiedParagraph(coalesced.paragraph3, target)
    };
  }

  function recordTavilyUsage(at) {
    lastTavilyFinishedAt = at || Date.now();
  }

  function computeTavilyPacingWaitMs(now) {
    if (!lastTavilyFinishedAt) return 0;
    const elapsed = (now || Date.now()) - lastTavilyFinishedAt;
    return Math.max(0, TAVILY_MIN_GAP_MS - elapsed);
  }

  function getSummaryApiCooldownStatus(tone) {
    const resolvedTone = tone === "professional" ? "professional" : "simplified";
    const groqWaitMs = computeTpmPacingWaitMs(estimateGroqRequestTokens("", resolvedTone, ""));
    const tavilyWaitMs = computeTavilyPacingWaitMs();
    const waitMs = Math.max(groqWaitMs, tavilyWaitMs);
    return {
      ready: waitMs <= 0,
      waitMs,
      groqWaitMs,
      tavilyWaitMs
    };
  }

  function formatCooldownWaitLabel(status) {
    const parts = [];
    if (status.groqWaitMs > 0) parts.push("Groq");
    if (status.tavilyWaitMs > 0) parts.push("Tavily");
    if (!parts.length) return "Waiting for API cooldown";
    return `Waiting for ${parts.join(" and ")} API cooldown`;
  }

  async function awaitSummaryApiCooldowns(onProgress) {
    let status = getSummaryApiCooldownStatus("simplified");
    while (!status.ready) {
      await sleepWithProgress(status.waitMs, onProgress, formatCooldownWaitLabel(status));
      status = getSummaryApiCooldownStatus("simplified");
    }
    return status;
  }

  function shouldReuseCachedTavilyResearch(research) {
    return hasTavilyResearch(research);
  }

  function escapeRegExp(text) {
    return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function normalizeMentionKey(label) {
    return String(label || "").trim().toLowerCase();
  }

  function pruneSummaryValue(value) {
    if (value == null) return undefined;
    if (Array.isArray(value)) {
      const items = value.map(pruneSummaryValue).filter((item) => item !== undefined);
      return items.length ? items : undefined;
    }
    if (typeof value === "object") {
      const out = {};
      Object.keys(value).forEach((key) => {
        const next = pruneSummaryValue(value[key]);
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

  function hasRaciEntries(raci) {
    if (!raci || typeof raci !== "object") return false;
    return ["responsible", "accountable", "consulted", "informed"].some(
      (role) => Array.isArray(raci[role]) && raci[role].length > 0
    );
  }

  function hasAnyRiceInput(source) {
    if (!source || typeof source !== "object") return false;
    const riceScore = Number(source.riceScore);
    if (Number.isFinite(riceScore) && riceScore !== 0) return true;
    const numericKeys = ["reachValue", "impactValue", "confidenceValue", "effortValue"];
    if (numericKeys.some((key) => source[key] != null && source[key] !== "")) return true;
    const textKeys = [
      "reachDescription",
      "impactDescription",
      "confidenceDescription",
      "effortDescription"
    ];
    return textKeys.some((key) => pruneSummaryValue(source[key]) !== undefined);
  }

  function hasFinancialImpact(source) {
    const value = Number(source && source.financialImpactValue);
    return Number.isFinite(value) && value !== 0;
  }

  function listPresentContextKeys(context) {
    if (!context || typeof context !== "object") return [];
    return Object.keys(context).filter((key) => pruneSummaryValue(context[key]) !== undefined);
  }

  function intersectFields(presentKeys, groupKeys) {
    const present = new Set(presentKeys);
    return groupKeys.filter((key) => present.has(key));
  }

  function buildPresentFieldsGuide(context) {
    const keys = listPresentContextKeys(context);
    if (!keys.length) return "";
    return `AVAILABLE FIELDS: ${keys.join(", ")}. Omit anything not listed.\n\n`;
  }

  function compactRaciForPrompt(raci) {
    if (!hasRaciEntries(raci)) return undefined;
    const out = {};
    ["responsible", "accountable", "consulted", "informed"].forEach((role) => {
      const entries = Array.isArray(raci[role]) ? raci[role] : [];
      if (!entries.length) return;
      out[role] = entries.slice(0, SUMMARY_CONTEXT_MAX_ARRAY_ITEMS).map((entry) => {
        const name = String(
          entry && (entry.name != null ? entry.name : entry.person || entry.label || "")
        ).trim();
        const domain = String((entry && entry.domain) || "Business").trim() || "Business";
        return name ? `${name} (${domain})` : "";
      }).filter(Boolean);
    });
    return Object.keys(out).length ? out : undefined;
  }

  function compactTasksForPrompt(tasks) {
    if (!Array.isArray(tasks) || !tasks.length) return undefined;
    const compact = tasks
      .slice(0, SUMMARY_CONTEXT_MAX_ARRAY_ITEMS)
      .map((task) => {
        if (!task || typeof task !== "object") return "";
        const title = String(task.title != null ? task.title : task.name || "").trim();
        const status = String(task.status || "").trim();
        if (!title) return "";
        return status ? `${title} [${status}]` : title;
      })
      .filter(Boolean);
    return compact.length ? compact : undefined;
  }

  function buildSparseParagraphFallbackGuide(context) {
    const present = listPresentContextKeys(context);
    const lines = [];
    if (!intersectFields(present, SUMMARY_FIELD_GROUPS.opening).length) {
      lines.push(
        "- paragraph1: use only title/description; do not invent roadmap metadata."
      );
    }
    if (!intersectFields(present, SUMMARY_FIELD_GROUPS.prioritization).length) {
      lines.push(
        "- paragraph2: if no prioritization fields, reflect strategic weight using title/description only; never invent scores or categories."
      );
    }
    if (!intersectFields(present, SUMMARY_FIELD_GROUPS.delivery).length) {
      lines.push(
        "- paragraph3: if no delivery fields, close with execution outlook grounded in prior paragraphs only; never invent tasks, RACI, or links."
      );
    }
    return lines.length ? `Sparse sections:\n${lines.join("\n")}\n\n` : "";
  }

  const PROFESSIONAL_BRIDGE_OPENERS =
    /^(with|given|against|building|this|that|these|those|as|once|from|in turn|together|accordingly|on that basis|on this basis|from this|turning to|moving to|next|finally|to carry|to deliver|to execute|with that|with this|against this|against that|from there|in this framing|under this|within this|looking|under|through|by|on|because|while|after|before|here|such|so|meanwhile|therefore|consequently|specifically|notably|equally|similarly|still|yet|also)/i;

  function buildSentenceFlowGuide() {
    return (
      "Sentence flow:\n" +
      "- Each sentence must follow logically from the previous one; avoid isolated fact drops.\n" +
      "- Use connective phrasing between sentences (e.g. In turn, Together, This positioning, Against that backdrop, From there).\n" +
      "- Vary sentence openings inside each paragraph; do not start 3+ consecutive sentences the same way.\n" +
      "- Prefer implication → evidence → next implication rather than list-like enumeration.\n\n"
    );
  }

  function buildCohesionExampleGuide() {
    return (
      "Bridge patterns (adapt wording; do not copy verbatim):\n" +
      "- paragraph1 close → paragraph2 open: context/purpose → prioritization lens.\n" +
      "- paragraph2 close → paragraph3 open: prioritization stakes → delivery and ownership.\n" +
      "- sentence chain: fact → implication → next fact.\n\n"
    );
  }

  function buildParagraphTransitionGuide(context) {
    const present = listPresentContextKeys(context);
    const hasPrioritization =
      intersectFields(present, SUMMARY_FIELD_GROUPS.prioritization).length > 0;
    const hasDelivery = intersectFields(present, SUMMARY_FIELD_GROUPS.delivery).length > 0;
    const lines = [
      "Paragraph bridges:",
      "- paragraph1: establish context, then move toward why prioritization matters; the final sentence must tee up paragraph2.",
      "- paragraph2: open with an explicit bridge from paragraph1; never start with an unrelated fact dump."
    ];
    if (hasPrioritization) {
      lines.push(
        "- paragraph2: weave prioritization signals into a single narrative thread; the final sentence must tee up delivery."
      );
    }
    lines.push(
      "- paragraph3: open with an explicit bridge from paragraph2; never restart the story from scratch."
    );
    if (hasDelivery) {
      lines.push(
        "- paragraph3: land delivery, ownership, and references, then close with forward-looking clarity."
      );
    } else {
      lines.push("- paragraph3: close with execution outlook grounded in prior paragraphs only.");
    }
    lines.push("- Do not repeat the same bridge phrase across paragraphs.");
    return `${lines.join("\n")}\n\n`;
  }

  function sentenceOpensWithBridge(sentence) {
    const trimmed = String(sentence || "").trim();
    if (!trimmed) return false;
    return PROFESSIONAL_BRIDGE_OPENERS.test(trimmed);
  }

  function sentencesShareThematicLink(previousSentence, nextSentence) {
    if (sentenceOpensWithBridge(nextSentence)) return true;
    const previousWords = new Set(tokenizeWords(previousSentence));
    return tokenizeWords(nextSentence).some((word) => word.length > 4 && previousWords.has(word));
  }

  function detectChoppySentenceOpenings(paragraphText, paragraphKey) {
    const sentences = splitSentences(paragraphText);
    if (sentences.length < 3) return null;
    let streak = 1;
    for (let i = 1; i < sentences.length; i += 1) {
      const previousWord = tokenizeWords(sentences[i - 1])[0] || "";
      const currentWord = tokenizeWords(sentences[i])[0] || "";
      if (previousWord && currentWord && previousWord === currentWord) {
        streak += 1;
        if (streak >= 3) {
          return `${paragraphKey} has choppy repeated sentence openings`;
        }
      } else {
        streak = 1;
      }
    }
    return null;
  }

  function detectSummaryCohesionIssues(variant) {
    const issues = [];
    const coalesced = coalesceSummaryVariant(variant);
    const paragraph1Sentences = splitSentences(coalesced.paragraph1);
    const paragraph2Sentences = splitSentences(coalesced.paragraph2);
    const paragraph3Sentences = splitSentences(coalesced.paragraph3);

    if (coalesced.paragraph2 && paragraph2Sentences.length && !sentenceOpensWithBridge(paragraph2Sentences[0])) {
      issues.push("paragraph2 should open with a bridge from paragraph1");
    }
    if (coalesced.paragraph3 && paragraph3Sentences.length && !sentenceOpensWithBridge(paragraph3Sentences[0])) {
      issues.push("paragraph3 should open with a bridge from paragraph2");
    }

    const paragraph1Close = paragraph1Sentences[paragraph1Sentences.length - 1] || "";
    const paragraph2Open = paragraph2Sentences[0] || "";
    if (
      paragraph1Close &&
      paragraph2Open &&
      !sentencesShareThematicLink(paragraph1Close, paragraph2Open)
    ) {
      issues.push("weak bridge between paragraph1 and paragraph2");
    }

    const paragraph2Close = paragraph2Sentences[paragraph2Sentences.length - 1] || "";
    const paragraph3Open = paragraph3Sentences[0] || "";
    if (
      paragraph2Close &&
      paragraph3Open &&
      !sentencesShareThematicLink(paragraph2Close, paragraph3Open)
    ) {
      issues.push("weak bridge between paragraph2 and paragraph3");
    }

    SUMMARY_PARAGRAPH_KEYS.forEach((key) => {
      const choppy = detectChoppySentenceOpenings(coalesced[key], key);
      if (choppy) issues.push(choppy);
    });

    return [...new Set(issues)].slice(0, 5);
  }

  function buildCohesionRetryHint(issues) {
    if (!issues.length) return "";
    return (
      `Improve cohesion: ${issues.join("; ")}. ` +
      "Bridge each sentence to the prior one; open paragraph2/paragraph3 with explicit links from the previous paragraph."
    );
  }

  function buildProfessionalQualityRetryHint(redundancyIssues, cohesionIssues) {
    const parts = [];
    if (redundancyIssues.length) {
      parts.push(buildRedundancyRetryHint(redundancyIssues));
    }
    if (cohesionIssues.length) {
      parts.push(buildCohesionRetryHint(cohesionIssues));
    }
    return parts.filter(Boolean).join(" ");
  }

  function buildPrioritizationNarrativeGuide(context) {
    const present = intersectFields(listPresentContextKeys(context), SUMMARY_FIELD_GROUPS.prioritization);
    if (!present.length) return "";
    const lines = [
      "Prioritization synthesis (paragraph2 only):",
      "- Weave prioritization signals into one narrative thread; do not read fields as a bullet list."
    ];
    const riceFields = present.filter((key) =>
      /^(riceScore|reach|impact|confidence|effort)/i.test(key)
    );
    if (riceFields.length) {
      lines.push(
        "- Connect RICE inputs as cause → score → decision implication; mention each RICE element once."
      );
    }
    if (present.includes("moscowCategory")) {
      lines.push("- MoSCoW category should frame urgency and trade-off posture in context.");
    }
    if (present.some((key) => key.startsWith("kano"))) {
      lines.push("- Kano scores should explain customer expectation fit, not repeat raw numbers mechanically.");
    }
    if (present.includes("tshirtSize")) {
      lines.push("- T-shirt size should anchor delivery scope expectations alongside other prioritization signals.");
    }
    return `${lines.join("\n")}\n\n`;
  }

  function buildDeliveryNarrativeGuide(context) {
    const present = intersectFields(listPresentContextKeys(context), SUMMARY_FIELD_GROUPS.delivery);
    if (!present.length) return "";
    const lines = [
      "Delivery synthesis (paragraph3 only):",
      "- Connect tasks, ownership, geography, labels, links, and financial impact into an execution storyline."
    ];
    if (present.includes("tasks")) {
      lines.push("- Tasks should read as sequenced delivery momentum, not a task dump.");
    }
    if (present.includes("raci")) {
      lines.push("- RACI should clarify who drives, approves, advises, and stays informed across Business/Tech.");
    }
    if (present.includes("links")) {
      lines.push("- Link labels should appear naturally inside the delivery narrative.");
    }
    if (
      present.includes("financialImpactValue") ||
      present.includes("financialImpactCurrency") ||
      present.includes("financialImpactFramework")
    ) {
      lines.push("- Financial impact should close the business case without repeating prioritization metrics.");
    }
    return `${lines.join("\n")}\n\n`;
  }

  function compactStringListForPrompt(value) {
    if (!Array.isArray(value)) return undefined;
    const items = value
      .map((item) => String(item != null ? item : "").trim())
      .filter(Boolean)
      .slice(0, SUMMARY_CONTEXT_MAX_ARRAY_ITEMS);
    return items.length ? items.join(", ") : undefined;
  }

  function compactFinancialForPrompt(context) {
    const value = Number(context && context.financialImpactValue);
    if (!Number.isFinite(value) || value === 0) return undefined;
    const currency = String((context && context.financialImpactCurrency) || "").trim();
    const framework = String((context && context.financialImpactFramework) || "").trim();
    const amount = currency ? `${value} ${currency}` : String(value);
    return framework ? `${amount} (${framework})` : amount;
  }

  function compactContextForPrompt(context) {
    if (!context || typeof context !== "object") return "{}";
    const out = {};
    Object.keys(context).forEach((key) => {
      const value = context[key];
      if (key === "raci") {
        const compactRaci = compactRaciForPrompt(value);
        if (compactRaci) out.raci = compactRaci;
        return;
      }
      if (key === "tasks") {
        const compactTasks = compactTasksForPrompt(value);
        if (compactTasks) out.tasks = compactTasks;
        return;
      }
      if (key === "countries" || key === "labels") {
        const compactList = compactStringListForPrompt(value);
        if (compactList) out[key] = compactList;
        return;
      }
      if (
        key === "financialImpactValue" ||
        key === "financialImpactCurrency" ||
        key === "financialImpactFramework"
      ) {
        return;
      }
      if (typeof value === "string") {
        out[key] =
          value.length > SUMMARY_CONTEXT_MAX_FIELD_CHARS
            ? `${value.slice(0, SUMMARY_CONTEXT_MAX_FIELD_CHARS)}...`
            : value;
        return;
      }
      if (Array.isArray(value)) {
        out[key] = value.slice(0, SUMMARY_CONTEXT_MAX_ARRAY_ITEMS);
        return;
      }
      out[key] = value;
    });
    const financialSummary = compactFinancialForPrompt(context);
    if (financialSummary) {
      out.financialImpact = financialSummary;
    }
    return JSON.stringify(out);
  }

  function sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  function parseGroqRateLimitNumber(message, pattern) {
    const match = String(message || "").match(pattern);
    if (!match) return null;
    const value = parseInt(String(match[1]).replace(/,/g, ""), 10);
    return Number.isFinite(value) ? value : null;
  }

  function parseGroqRateLimitDetails(message) {
    const text = String(message || "");
    const retryMatch = text.match(/try again in\s+([\d.]+)\s*s/i);
    const retrySeconds = retryMatch ? parseFloat(retryMatch[1]) : NaN;
    return {
      retryAfterMs: Number.isFinite(retrySeconds)
        ? Math.ceil(retrySeconds * 1000) + 400
        : null,
      tokensUsed: parseGroqRateLimitNumber(text, /Tokens Used:\s*([\d,]+)/i),
      tokensRequested: parseGroqRateLimitNumber(text, /Tokens Requested:\s*([\d,]+)/i),
      tpmLimit: parseGroqRateLimitNumber(text, /TPM Limit:\s*([\d,]+)/i) || GROQ_TPM_LIMIT
    };
  }

  function parseGroqRetryDelayMs(message) {
    const details = parseGroqRateLimitDetails(message);
    if (details.retryAfterMs) return details.retryAfterMs;
    if (
      details.tokensUsed != null &&
      details.tokensRequested != null &&
      details.tpmLimit > 0
    ) {
      const overflow = details.tokensUsed + details.tokensRequested - details.tpmLimit;
      if (overflow > 0) {
        return Math.ceil((overflow / details.tpmLimit) * GROQ_TPM_WINDOW_MS) + 500;
      }
    }
    return GROQ_DEFAULT_RETRY_DELAY_MS;
  }

  function isGroqRateLimitError(status, message) {
    return status === 429 || /rate limit reached/i.test(String(message || ""));
  }

  function formatGroqErrorForUser(message) {
    const detail = String(message || "").trim();
    if (isGroqRateLimitError(429, detail)) {
      const waitSeconds = Math.max(1, Math.ceil(parseGroqRetryDelayMs(detail) / 1000));
      return (
        `Groq free-tier rate limit reached after automatic retries. ` +
        `Wait ~${waitSeconds}s and try again, or upgrade your Groq plan.`
      );
    }
    return detail || "Could not generate the roadmap summary.";
  }

  function createGroqError(message, status) {
    const error = new Error(message);
    error.status = status;
    if (isGroqRateLimitError(status, message)) {
      error.rateLimit = true;
      error.rateLimitDetails = parseGroqRateLimitDetails(message);
      error.retryAfterMs = parseGroqRetryDelayMs(message);
      if (error.rateLimitDetails.tokensRequested != null) {
        recordGroqTokenUsage(error.rateLimitDetails.tokensRequested);
      }
    }
    return error;
  }

  function pruneGroqTokenUsage(now) {
    const cutoff = (now || Date.now()) - GROQ_TPM_WINDOW_MS;
    while (groqTokenUsageEntries.length && groqTokenUsageEntries[0].at < cutoff) {
      groqTokenUsageEntries.shift();
    }
  }

  function getGroqRollingTokenUsage(now) {
    pruneGroqTokenUsage(now);
    return groqTokenUsageEntries.reduce((sum, entry) => sum + entry.tokens, 0);
  }

  function recordGroqTokenUsage(tokens, at) {
    const value = Math.ceil(Number(tokens));
    if (!Number.isFinite(value) || value <= 0) return;
    groqTokenUsageEntries.push({ tokens: value, at: at || Date.now() });
    pruneGroqTokenUsage();
  }

  function estimateGroqRequestTokens(prompt, tone, retryHint) {
    const system = getSystemMessage(tone);
    const requestPrompt = retryHint ? `${prompt}\n${retryHint}` : prompt;
    const inputTokens = Math.ceil((system.length + requestPrompt.length) / 3.2);
    const maxOut =
      tone === "simplified" ? GROQ_MAX_OUTPUT_TOKENS.simplified : GROQ_MAX_OUTPUT_TOKENS.professional;
    return inputTokens + maxOut;
  }

  function computeTpmPacingWaitMs(estimatedTokens, now) {
    const current = now || Date.now();
    pruneGroqTokenUsage(current);
    const rolling = getGroqRollingTokenUsage(current);
    const budget = GROQ_TPM_LIMIT - GROQ_TPM_BUFFER;
    if (rolling + estimatedTokens <= budget) return 0;

    const entries = groqTokenUsageEntries.slice().sort((a, b) => a.at - b.at);
    let runningTotal = rolling;
    let waitMs = 0;
    const target = budget - estimatedTokens;

    while (runningTotal > target && entries.length) {
      const oldest = entries.shift();
      runningTotal -= oldest.tokens;
      waitMs = Math.max(waitMs, oldest.at + GROQ_TPM_WINDOW_MS - current);
    }

    if (waitMs <= 0) {
      const overflow = rolling + estimatedTokens - budget;
      waitMs = Math.ceil((overflow / GROQ_TPM_LIMIT) * GROQ_TPM_WINDOW_MS);
    }
    return Math.max(0, waitMs + 300);
  }

  async function sleepWithProgress(waitMs, onProgress, statusPrefix) {
    if (!waitMs || waitMs <= 0) return;
    let remainingMs = waitMs;
    if (onProgress) {
      onProgress(`${statusPrefix} — ${Math.ceil(remainingMs / 1000)}s remaining…`);
    }
    while (remainingMs > 0) {
      const slice = Math.min(1000, remainingMs);
      await sleep(slice);
      remainingMs -= slice;
      if (onProgress && remainingMs > 0) {
        onProgress(`${statusPrefix} — ${Math.ceil(remainingMs / 1000)}s remaining…`);
      }
    }
  }

  async function paceGroqRequests(estimatedTokens, onProgress) {
    const waitMs = computeTpmPacingWaitMs(estimatedTokens);
    if (waitMs > 0) {
      await sleepWithProgress(
        waitMs,
        onProgress,
        "Groq free-tier token budget — pacing before request"
      );
    }
  }

  function resetGroqTokenBudgetForTests() {
    groqTokenUsageEntries.length = 0;
  }

  function getTargetSentenceCount(tone) {
    return tone === "simplified"
      ? SIMPLIFIED_SENTENCES_PER_PARAGRAPH
      : PROFESSIONAL_SENTENCES_PER_PARAGRAPH;
  }

  function countSentences(text) {
    return splitSentences(text).length;
  }

  function buildSentenceCountRule(tone) {
    const count = getTargetSentenceCount(tone);
    return (
      `Each paragraph: exactly ${count} sentences ending with . ! or ?; ` +
      "put one space after every sentence-ending mark before the next sentence.\n\n"
    );
  }

  function buildSharedExclusionRules() {
    return (
      "- Facts from source only; no invention or missing-field mentions (no 'not specified', TBD, unknown).\n"
    );
  }

  function buildCompactCoreRules(links) {
    return (
      buildSharedExclusionRules() +
      buildNoDuplicationRules() +
      buildLinksPromptRule(links)
    );
  }

  function buildDynamicArcGuide(context, style) {
    const present = listPresentContextKeys(context);
    const opening = intersectFields(present, SUMMARY_FIELD_GROUPS.opening);
    const prioritization = intersectFields(present, SUMMARY_FIELD_GROUPS.prioritization);
    const delivery = intersectFields(present, SUMMARY_FIELD_GROUPS.delivery);
    const lines = [];

    const p1 = opening.length ? opening.join(", ") : "available context fields";
    const p2 = prioritization.length ? prioritization.join(", ") : "prioritization fields";
    const p3 = delivery.length ? delivery.join(", ") : "delivery fields";

    if (style === "professional") {
      lines.push(
        `Arc: p1=${p1}; p2=${p2}; p3=${p3}. One continuous executive narrative with explicit sentence and paragraph bridges.`
      );
    } else {
      lines.push(`Story arc: p1 setup=${p1}; p2 tension=${p2}; p3 resolution=${p3}. Plain, warm transitions.`);
    }

    return `${lines.join("\n")}\n\n`;
  }

  function prepareSummaryContext(contextObject) {
    const source = contextObject && typeof contextObject === "object" ? contextObject : {};
    const draft = {};

    [
      "title",
      "description",
      "note",
      "roadmapType",
      "roadmapStatus",
      "tshirtSize",
      "roadmapPeriod",
      "moscowCategory",
      "reachValue",
      "reachDescription",
      "impactValue",
      "impactDescription",
      "confidenceValue",
      "confidenceDescription",
      "effortValue",
      "effortDescription",
      "financialImpactValue",
      "financialImpactCurrency",
      "financialImpactFramework",
      "kanoFunctionality",
      "kanoSatisfaction",
      "kanoCategory",
      "riceScore",
      "countries",
      "labels",
      "links",
      "tasks",
      "raci"
    ].forEach((key) => {
      if (source[key] !== undefined && source[key] !== null) {
        draft[key] = source[key];
      }
    });

    if (!hasAnyRiceInput(draft)) {
      delete draft.reachValue;
      delete draft.reachDescription;
      delete draft.impactValue;
      delete draft.impactDescription;
      delete draft.confidenceValue;
      delete draft.confidenceDescription;
      delete draft.effortValue;
      delete draft.effortDescription;
      delete draft.riceScore;
    } else {
      const effort = Number(draft.effortValue);
      const hasExplicitScore =
        Number.isFinite(Number(draft.riceScore)) && Number(draft.riceScore) !== 0;
      if ((!Number.isFinite(effort) || effort <= 0) && !hasExplicitScore) {
        delete draft.riceScore;
      }
    }

    if (draft.kanoFunctionality == null || draft.kanoSatisfaction == null) {
      delete draft.kanoFunctionality;
      delete draft.kanoSatisfaction;
      delete draft.kanoCategory;
    }

    if (!hasFinancialImpact(draft)) {
      delete draft.financialImpactValue;
      delete draft.financialImpactCurrency;
      delete draft.financialImpactFramework;
    }

    if (!hasRaciEntries(draft.raci)) {
      delete draft.raci;
    }

    draft.links = normalizeSummaryLinks(draft.links);

    delete draft.createdAt;
    delete draft.modifiedAt;

    const pruned = pruneSummaryValue(draft);
    return pruned || { title: pruneSummaryValue(source.title) || "Untitled roadmap" };
  }

  function buildCompactProfessionalGuide(context) {
    const present = listPresentContextKeys(context);
    const hasPrioritization =
      intersectFields(present, SUMMARY_FIELD_GROUPS.prioritization).length > 0;
    const hasDelivery = intersectFields(present, SUMMARY_FIELD_GROUPS.delivery).length > 0;
    const lines = [
      "Narrative:",
      "- One continuous briefing with bridges between sentences and paragraphs.",
      "- paragraph1: context; paragraph2: prioritization; paragraph3: delivery.",
      "- Vary sentence openings; connect each sentence to the prior one."
    ];
    if (hasPrioritization) {
      lines.push("- paragraph2: weave prioritization as one thread, not a field list.");
    }
    if (hasDelivery) {
      lines.push("- paragraph3: weave delivery, ownership, links, and impact as execution storyline.");
    }
    lines.push(
      "- Open paragraph2/paragraph3 with explicit bridges from the previous paragraph.",
      "- Mention the roadmap title at most once."
    );
    return `${lines.join("\n")}\n\n`;
  }

  function buildProfessionalPrompt(context, links, research) {
    const normalizedLinks = normalizeSummaryLinks(links);
    return (
      "Write a cohesive executive roadmap briefing. JSON keys: paragraph1, paragraph2, paragraph3.\n\n" +
      buildPresentFieldsGuide(context) +
      buildDynamicArcGuide(context, "professional") +
      buildCompactProfessionalGuide(context) +
      "Paragraph exclusivity:\n" +
      buildParagraphExclusiveRules(context) +
      buildSparseParagraphFallbackGuide(context) +
      buildSentenceCountRule("professional") +
      "Anti-redundancy:\n" +
      "- Each fact, metric, label, and phrase appears once in the full summary.\n" +
      "- Use RESEARCH for phrasing variety only; never duplicate Tavily wording verbatim.\n\n" +
      "Rules:\n" +
      buildCompactCoreRules(normalizedLinks) +
      "- JSON only.\n\n" +
      buildResearchPromptSection(research) +
      `DATA:${compactContextForPrompt(context)}`
    );
  }

  function buildStorytellingPrompt(professional) {
    const compact = coalesceSummaryVariant(professional);
    return (
      "Rewrite PROFESSIONAL JSON as simplified storytelling. JSON keys: paragraph1, paragraph2, paragraph3.\n" +
      buildSentenceCountRule("simplified") +
      "Story structure:\n" +
      "- paragraph1: plain setup; paragraph2: why it matters; paragraph3: what happens next.\n" +
      "- Preserve paragraph bridges from PROFESSIONAL; keep the same narrative order.\n" +
      "- Use gentle transitions; warm, human tone.\n\n" +
      "Rules:\n" +
      "- Same facts only; do not add/remove/change information.\n" +
      "- Plain language, short sentences, no jargon.\n" +
      "- Each link label at most once; never paste raw URLs.\n" +
      "- Never repeat the same phrase or fact across paragraphs.\n" +
      "- JSON only.\n\n" +
      `PROFESSIONAL:${JSON.stringify(compact)}`
    );
  }

  function extractGroqMessage(payload) {
    const choice = payload && Array.isArray(payload.choices) ? payload.choices[0] : null;
    const content = choice && choice.message && choice.message.content;
    return typeof content === "string" ? content.trim() : "";
  }

  function parseGroqError(payload, fallbackText) {
    if (payload && payload.error && payload.error.message) {
      return String(payload.error.message);
    }
    return fallbackText || "";
  }

  function getSystemMessage(tone) {
    if (tone === "simplified") {
      return (
        `Storyteller. JSON paragraph1, paragraph2, paragraph3. ` +
        `${SIMPLIFIED_SENTENCES_PER_PARAGRAPH} sentences each. Same facts and bridges as input.`
      );
    }
    return (
      `PM analyst. JSON paragraph1, paragraph2, paragraph3. ` +
      `${PROFESSIONAL_SENTENCES_PER_PARAGRAPH} sentences each. ` +
      "Write one flowing briefing with explicit bridges between sentences and paragraphs. " +
      "Non-redundant synthesis from DATA only; each fact once."
    );
  }

  async function callGroqChat(apiKey, prompt, tone, onProgress, retryHint) {
    const hint = retryHint || "";
    const estimatedTokens = estimateGroqRequestTokens(prompt, tone, hint);
    await paceGroqRequests(estimatedTokens, onProgress);
    const isSimplified = tone === "simplified";
    const requestPrompt = hint ? `${prompt}\n${hint}` : prompt;
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
          { role: "system", content: getSystemMessage(tone) },
          { role: "user", content: requestPrompt }
        ],
        temperature: isSimplified ? 0.18 : 0.12,
        max_tokens: isSimplified ? GROQ_MAX_OUTPUT_TOKENS.simplified : GROQ_MAX_OUTPUT_TOKENS.professional,
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
      const detail = parseGroqError(payload, await response.text().catch(() => ""));
      if (response.status === 401 || response.status === 403) {
        throw new Error(detail || "Groq rejected the API key. Check your key in API keys settings.");
      }
      throw createGroqError(detail || `Groq request failed (${response.status}).`, response.status);
    }

    const usage = payload && payload.usage ? payload.usage : null;
    if (usage && Number.isFinite(Number(usage.total_tokens))) {
      recordGroqTokenUsage(Number(usage.total_tokens));
    } else {
      recordGroqTokenUsage(estimatedTokens);
    }

    const text = extractGroqMessage(payload);
    if (!text) {
      throw new Error("Groq returned an empty summary. Try again.");
    }
    return text;
  }

  function splitSentences(text) {
    return (text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text]).map((s) => s.trim()).filter(Boolean);
  }

  function splitIntoHalves(items) {
    if (!items.length) {
      return { first: [], second: [] };
    }
    const size = Math.ceil(items.length / 2);
    return {
      first: items.slice(0, size),
      second: items.slice(size)
    };
  }

  function splitIntoThirds(items) {
    if (!items.length) {
      return { first: [], second: [], third: [] };
    }
    const size = Math.ceil(items.length / 3);
    return {
      first: items.slice(0, size),
      second: items.slice(size, size * 2),
      third: items.slice(size * 2)
    };
  }

  function normalizeParagraphValue(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function joinSummarySentences(sentences) {
    return sentences
      .map((sentence) => String(sentence || "").trim())
      .filter(Boolean)
      .join(" ");
  }

  function normalizeSentenceSpacing(text) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .replace(/(?<!\d)([.!?]+)(?=[A-Za-z])/g, "$1 ")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function normalizeSummaryParagraph(text) {
    const collapsed = normalizeParagraphValue(text);
    if (!collapsed) return "";
    const sentences = splitSentences(collapsed);
    const joined = sentences.length > 1 ? joinSummarySentences(sentences) : collapsed;
    return normalizeSentenceSpacing(joined);
  }

  function finalizeSummaryVariant(variant) {
    return coalesceSummaryVariant(variant);
  }

  function parseSummaryParagraphs(text) {
    const normalized = String(text || "")
      .replace(/\r\n/g, "\n")
      .trim();
    if (!normalized) {
      return emptySummaryVariant();
    }

    const byBlankLine = normalized.split(/\n\s*\n+/).map((part) => part.trim()).filter(Boolean);
    if (byBlankLine.length >= 3) {
      return {
        paragraph1: byBlankLine[0],
        paragraph2: byBlankLine[1],
        paragraph3: byBlankLine.slice(2).join(" ")
      };
    }
    if (byBlankLine.length === 2) {
      return {
        paragraph1: byBlankLine[0],
        paragraph2: byBlankLine[1],
        paragraph3: ""
      };
    }

    const bySingleLine = normalized.split(/\n+/).map((part) => part.trim()).filter(Boolean);
    if (bySingleLine.length >= 3) {
      return {
        paragraph1: bySingleLine[0],
        paragraph2: bySingleLine[1],
        paragraph3: bySingleLine.slice(2).join(" ")
      };
    }
    if (bySingleLine.length === 2) {
      return {
        paragraph1: bySingleLine[0],
        paragraph2: bySingleLine[1],
        paragraph3: ""
      };
    }

    const sentences = splitSentences(normalized);
    if (sentences.length >= 3) {
      const split = splitIntoThirds(sentences);
      return {
        paragraph1: split.first.join(" "),
        paragraph2: split.second.join(" "),
        paragraph3: split.third.join(" ")
      };
    }
    if (sentences.length === 2) {
      return {
        paragraph1: sentences[0],
        paragraph2: sentences[1],
        paragraph3: ""
      };
    }

    const words = normalized.split(/\s+/);
    if (words.length >= 18) {
      const split = splitIntoThirds(words);
      return {
        paragraph1: split.first.join(" "),
        paragraph2: split.second.join(" "),
        paragraph3: split.third.join(" ")
      };
    }

    return { paragraph1: normalized, paragraph2: "", paragraph3: "" };
  }

  function parseThreeParagraphs(text) {
    return parseSummaryParagraphs(text);
  }

  function parseSummaryResponse(text) {
    const trimmed = String(text || "").trim();
    if (!trimmed) {
      return emptySummaryVariant();
    }

    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidates = [trimmed];
    if (fenceMatch && fenceMatch[1]) {
      candidates.unshift(fenceMatch[1].trim());
    }

    for (const candidate of candidates) {
      const objectMatch = candidate.match(/\{[\s\S]*\}/);
      if (!objectMatch) continue;
      try {
        const parsed = JSON.parse(objectMatch[0]);
        if (parsed && typeof parsed === "object") {
          const coalesced = coalesceSummaryVariant(parsed);
          if (coalesced.paragraph1 || coalesced.paragraph2 || coalesced.paragraph3) {
            return coalesced;
          }
        }
      } catch {
        /* try next candidate */
      }
    }

    return parseSummaryParagraphs(trimmed);
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function summaryMentionsLink(text, link) {
    const haystack = String(text || "");
    if (!link.label) return false;
    return new RegExp(escapeRegExp(link.label), "i").test(haystack);
  }

  function tokenizeWords(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2);
  }

  function normalizeSentenceFingerprint(sentence) {
    return tokenizeWords(sentence).join(" ");
  }

  function collectMetricPhraseAnchors(context) {
    const anchors = [];
    const push = (text) => {
      const trimmed = String(text || "").trim();
      if (trimmed.length >= SUMMARY_MIN_ANCHOR_CHARS) anchors.push(trimmed);
    };

    if (context.riceScore != null && Number.isFinite(Number(context.riceScore))) {
      const score = String(context.riceScore);
      push(`RICE ${score}`);
      push(`RICE score of ${score}`);
      push(`RICE score is ${score}`);
    }
    if (context.moscowCategory) {
      const category = String(context.moscowCategory).trim();
      push(`MoSCoW ${category}`);
      push(category);
    }
    if (context.kanoCategory) {
      const category = String(context.kanoCategory).trim();
      push(`Kano ${category}`);
      push(category);
    }
    if (context.tshirtSize) push(String(context.tshirtSize).trim());
    if (context.roadmapType) push(String(context.roadmapType).trim());
    if (context.roadmapStatus) push(String(context.roadmapStatus).trim());

    return anchors;
  }

  function collectFieldAnchors(context, fieldKeys) {
    const anchors = [];
    const seen = new Set();

    function pushAnchor(text) {
      const trimmed = String(text || "").trim();
      if (trimmed.length < SUMMARY_MIN_ANCHOR_CHARS) return;
      const variants = [trimmed];
      if (trimmed.length > 48) variants.push(trimmed.slice(0, 48));
      variants.forEach((variant) => {
        const key = variant.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        anchors.push(variant);
      });
    }

    fieldKeys.forEach((fieldKey) => {
      const value = context[fieldKey];
      if (value == null || value === "") return;
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        pushAnchor(String(value));
        return;
      }
      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (typeof item === "string") pushAnchor(item);
          else if (item && typeof item === "object") {
            if (item.title) pushAnchor(item.title);
            if (item.label) pushAnchor(item.label);
            if (item.name) pushAnchor(item.name);
          }
        });
      }
    });

    return anchors.sort((a, b) => b.length - a.length);
  }

  function stripAnchorsFromText(text, anchors) {
    let work = String(text || "");
    anchors.forEach((anchor) => {
      const pattern = new RegExp(escapeRegExp(anchor), "gi");
      work = work.replace(pattern, "");
    });
    return normalizeSentenceSpacing(
      work
        .replace(/\s+([.,;:!?])/g, "$1")
        .replace(/([.!?])\s*([.!?])+/g, "$1")
        .replace(/^\s*[.,;:!?]+\s*/g, "")
        .replace(/\s{2,}/g, " ")
    );
  }

  function enforceParagraphFieldExclusivity(variant, context) {
    const coalesced = coalesceSummaryVariant(variant);
    const openingAnchors = collectFieldAnchors(context, SUMMARY_FIELD_GROUPS.opening);
    const prioritizationAnchors = collectFieldAnchors(context, SUMMARY_FIELD_GROUPS.prioritization);
    const deliveryAnchors = collectFieldAnchors(context, SUMMARY_FIELD_GROUPS.delivery);
    return {
      paragraph1: stripAnchorsFromText(coalesced.paragraph1, [
        ...prioritizationAnchors,
        ...deliveryAnchors
      ]),
      paragraph2: stripAnchorsFromText(coalesced.paragraph2, [
        ...openingAnchors,
        ...deliveryAnchors
      ]),
      paragraph3: stripAnchorsFromText(coalesced.paragraph3, [
        ...openingAnchors,
        ...prioritizationAnchors
      ])
    };
  }

  function uniqueSortedAnchors(context) {
    const raw = [
      ...collectFieldAnchors(context, SUMMARY_FIELD_GROUPS.opening),
      ...collectFieldAnchors(context, SUMMARY_FIELD_GROUPS.prioritization),
      ...collectFieldAnchors(context, SUMMARY_FIELD_GROUPS.delivery),
      ...collectMetricPhraseAnchors(context)
    ];
    const seen = new Set();
    return raw
      .filter((anchor) => {
        const key = anchor.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => b.length - a.length);
  }

  function dedupeAnchorsAcrossVariant(variant, context) {
    const anchors = uniqueSortedAnchors(context);
    const seenGlobal = new Set();
    const out = coalesceSummaryVariant(variant);

    anchors.forEach((anchor) => {
      const anchorKey = anchor.toLowerCase();
      const pattern = new RegExp(escapeRegExp(anchor), "gi");
      SUMMARY_PARAGRAPH_KEYS.forEach((key) => {
        out[key] = out[key].replace(pattern, (match) => {
          if (seenGlobal.has(anchorKey)) return " ";
          seenGlobal.add(anchorKey);
          return match;
        });
      });
    });

    SUMMARY_PARAGRAPH_KEYS.forEach((key) => {
      out[key] = normalizeSentenceSpacing(out[key]);
    });
    return out;
  }

  function dedupeGlobalSentences(variant) {
    const out = emptySummaryVariant();
    SUMMARY_PARAGRAPH_KEYS.forEach((key) => {
      const seen = new Set();
      const kept = [];
      splitSentences(variant[key]).forEach((sentence) => {
        const fingerprint = normalizeSentenceFingerprint(sentence);
        if (fingerprint.length >= 10 && seen.has(fingerprint)) return;
        if (fingerprint.length >= 10) seen.add(fingerprint);
        if (sentence.trim()) kept.push(sentence.trim());
      });
      out[key] = normalizeSentenceSpacing(joinSummarySentences(kept));
    });
    return out;
  }

  function dedupeRepeatedPhrases(variant, minWords) {
    const seenPhrases = new Set();
    const out = emptySummaryVariant();
    SUMMARY_PARAGRAPH_KEYS.forEach((key) => {
      const sentences = splitSentences(variant[key]).map((sentence) => {
        const words = tokenizeWords(sentence);
        if (words.length < minWords) return sentence;
        let work = sentence;
        for (let i = 0; i <= words.length - minWords; i += 1) {
          const phrase = words.slice(i, i + minWords).join(" ");
          if (phrase.length < 18) continue;
          if (seenPhrases.has(phrase)) {
            const pattern = new RegExp(escapeRegExp(phrase), "i");
            work = work.replace(pattern, "").replace(/\s+/g, " ").trim();
          } else {
            seenPhrases.add(phrase);
          }
        }
        return work;
      });
      out[key] = normalizeSentenceSpacing(joinSummarySentences(sentences.filter(Boolean)));
    });
    return out;
  }

  function countAnchorMentions(text, anchor) {
    if (!anchor) return 0;
    const matches = String(text || "").match(new RegExp(escapeRegExp(anchor), "gi"));
    return matches ? matches.length : 0;
  }

  function detectSummaryRedundancy(variant, context, links) {
    const issues = [];
    const coalesced = coalesceSummaryVariant(variant);
    const combined = [coalesced.paragraph1, coalesced.paragraph2, coalesced.paragraph3].join(" ");
    const sentences = [];
    SUMMARY_PARAGRAPH_KEYS.forEach((key) => {
      splitSentences(coalesced[key]).forEach((sentence) => {
        sentences.push(normalizeSentenceFingerprint(sentence));
      });
    });

    const duplicateSentenceCount = sentences.filter(
      (fingerprint, index) => fingerprint.length >= 10 && sentences.indexOf(fingerprint) !== index
    ).length;
    if (duplicateSentenceCount) {
      issues.push("duplicate sentences");
    }

    const allAnchors = [
      ...collectFieldAnchors(context, SUMMARY_FIELD_GROUPS.opening),
      ...collectFieldAnchors(context, SUMMARY_FIELD_GROUPS.prioritization),
      ...collectFieldAnchors(context, SUMMARY_FIELD_GROUPS.delivery)
    ];
    allAnchors.forEach((anchor) => {
      const mentions = countAnchorMentions(combined, anchor);
      if (mentions > 1) {
        issues.push(`"${anchor}" appears ${mentions} times`);
      }
    });

    normalizeSummaryLinks(links).forEach((link) => {
      const mentions = countAnchorMentions(combined, link.label);
      if (mentions > 1) {
        issues.push(`link "${link.label}" appears ${mentions} times`);
      }
    });

    const seenPhrases = new Set();
    sentences.forEach((fingerprint) => {
      const words = fingerprint.split(" ");
      for (let i = 0; i <= words.length - SUMMARY_PHRASE_DEDUPE_WORDS; i += 1) {
        const phrase = words.slice(i, i + SUMMARY_PHRASE_DEDUPE_WORDS).join(" ");
        if (phrase.length < 18) continue;
        if (seenPhrases.has(phrase)) {
          issues.push(`repeated phrase "${phrase}"`);
          return;
        }
        seenPhrases.add(phrase);
      }
    });

    return [...new Set(issues)].slice(0, 6);
  }

  function buildRedundancyRetryHint(issues) {
    if (!issues.length) return "";
    return `Remove redundancy: ${issues.join("; ")}. Each fact, phrase, and link label must appear once.`;
  }

  function compressRedundantSummary(variant, context, links) {
    let work = { ...variant };
    work = enforceParagraphFieldExclusivity(work, context);
    work = dedupeAnchorsAcrossVariant(work, context);
    work = dedupeGlobalSentences(work);
    work = dedupeRepeatedPhrases(work, SUMMARY_PHRASE_DEDUPE_WORDS);
    work = dedupeSummaryVariantContext(work, links);
    work = dedupeRelatedResourcesClauseAcrossVariant(work);
    return coalesceSummaryVariant(work);
  }

  function dedupeRelatedResourcesClauseAcrossVariant(variant) {
    const mentioned = new Set();
    const out = coalesceSummaryVariant(variant);
    SUMMARY_PARAGRAPH_KEYS.forEach((key) => {
      let text = out[key];
      text = String(text || "").replace(/Related resources:\s*([^.]*)\./gi, (match, listPart) => {
        const labels = listPart.split(",").map((s) => s.trim()).filter(Boolean);
        const unique = labels.filter((label) => {
          const labelKey = normalizeMentionKey(label);
          if (mentioned.has(labelKey)) return false;
          mentioned.add(labelKey);
          return true;
        });
        if (!unique.length) return "";
        return `Related resources: ${unique.join(", ")}.`;
      });
      out[key] = normalizeSentenceSpacing(text);
    });
    return out;
  }

  function dedupeRelatedResourcesClause(text) {
    let seenClause = false;
    return String(text || "").replace(/Related resources:\s*([^.]*)\./gi, (match, listPart) => {
      if (seenClause) return " ";
      seenClause = true;
      const labels = listPart.split(",").map((s) => s.trim()).filter(Boolean);
      const seen = new Set();
      const unique = labels.filter((label) => {
        const key = normalizeMentionKey(label);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      if (!unique.length) return "";
      return `Related resources: ${unique.join(", ")}.`;
    });
  }

  function removeDuplicateLinkLabelMentionsInText(text, links, mentionedGlobal) {
    let work = String(text || "");
    const mentioned = mentionedGlobal || new Set();

    normalizeSummaryLinks(links)
      .slice()
      .sort((a, b) => b.label.length - a.label.length)
      .forEach((link) => {
        if (!link.label) return;
        const key = normalizeMentionKey(link.label);
        const pattern = new RegExp(escapeRegExp(link.label), "gi");
        let seenInText = false;
        work = work.replace(pattern, (match) => {
          if (mentioned.has(key)) return " ";
          if (seenInText) return " ";
          seenInText = true;
          mentioned.add(key);
          return match;
        });
      });

    work = dedupeRelatedResourcesClause(work);
    return {
      text: normalizeSentenceSpacing(
        work
          .replace(/\s+([.,;])/g, "$1")
          .replace(/([.,;])\s*([.,;])+/g, "$1")
      ),
      mentioned
    };
  }

  function dedupeSummaryVariantContext(variant, links) {
    const mentioned = new Set();
    const out = { ...variant };
    // Prefer keeping link mentions in paragraph3 (delivery section).
    ["paragraph3", "paragraph2", "paragraph1"].forEach((key) => {
      const next = removeDuplicateLinkLabelMentionsInText(variant[key], links, mentioned);
      out[key] = next.text;
    });
    return out;
  }

  function replaceFirstLabelWithToken(work, label, token) {
    const idx = work.indexOf(label);
    if (idx === -1) return work;
    let next = `${work.slice(0, idx)}${token}${work.slice(idx + label.length)}`;
    next = next.split(label).join("");
    return next.replace(/\s{2,}/g, " ").trim();
  }

  function formatLinksAppendix(links) {
    return links.map((link) => link.label).join(", ");
  }

  function stripBareLinkUrlsFromSummaryText(text, links) {
    let work = String(text || "");
    normalizeSummaryLinks(links).forEach((link) => {
      if (!link.url) return;
      const combinedPatterns = [
        `${link.label} (${link.url})`,
        `${link.label}(${link.url})`,
        `${link.label} ( ${link.url} )`
      ];
      combinedPatterns.forEach((pattern) => {
        if (work.includes(pattern)) {
          work = work.split(pattern).join(link.label);
        }
      });
      work = work.split(link.url).join(link.label);
    });
    return normalizeSentenceSpacing(
      work
        .replace(/\bhttps?:\/\/[^\s)<>\]"']+/gi, "")
        .replace(/\s+([.,;])/g, "$1")
    );
  }

  function sanitizeSummaryParagraphLinks(text, links) {
    return stripBareLinkUrlsFromSummaryText(text, links);
  }

  function sanitizeSummaryVariantLinks(variant, links) {
    const coalesced = coalesceSummaryVariant(variant);
    return {
      paragraph1: sanitizeSummaryParagraphLinks(coalesced.paragraph1, links),
      paragraph2: sanitizeSummaryParagraphLinks(coalesced.paragraph2, links),
      paragraph3: sanitizeSummaryParagraphLinks(coalesced.paragraph3, links)
    };
  }

  function ensureLinksInSummaryVariant(variant, links) {
    const normalizedLinks = normalizeSummaryLinks(links);
    const coalesced = coalesceSummaryVariant(variant);
    if (!normalizedLinks.length) return coalesced;

    const combined = [coalesced.paragraph1, coalesced.paragraph2, coalesced.paragraph3].join(" ");
    const missing = normalizedLinks.filter((link) => !summaryMentionsLink(combined, link));
    if (!missing.length) return coalesced;

    const labelsNotInBody = missing.filter((link) => !summaryMentionsLink(coalesced.paragraph3, link));
    if (!labelsNotInBody.length) return coalesced;
    const appendix = ` To support delivery, reference materials include ${formatLinksAppendix(labelsNotInBody)}.`;
    return {
      paragraph1: coalesced.paragraph1,
      paragraph2: coalesced.paragraph2,
      paragraph3: normalizeSummaryParagraph(`${coalesced.paragraph3}${appendix}`)
    };
  }

  function linkifyRoadmapSummaryText(text, links) {
    const normalizedLinks = normalizeSummaryLinks(links);
    let work = sanitizeSummaryParagraphLinks(text, normalizedLinks);
    const placeholders = [];

    normalizedLinks
      .slice()
      .sort((a, b) => b.label.length - a.label.length)
      .forEach((link, index) => {
        if (!link.label || !work.includes(link.label)) return;
        const token = `@@ROADMAP_SUMMARY_LINK_${index}@@`;
        placeholders.push({ token, link });
        work = replaceFirstLabelWithToken(work, link.label, token);
      });

    let html = escapeHtml(work);
    placeholders.forEach(({ token, link }) => {
      const safeUrl = normalizeRedirectLinkUrl(link.url);
      if (!safeUrl) return;
      const anchor =
        `<a class="roadmap-summary-link" href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">` +
        `${escapeHtml(link.label)}</a>`;
      html = html.split(escapeHtml(token)).join(anchor);
    });

    return html;
  }

  function renderRoadmapSummaryParagraphText(text, links) {
    const normalizedLinks = normalizeSummaryLinks(links);
    const sanitized = sanitizeSummaryParagraphLinks(normalizeSummaryParagraph(text), normalizedLinks);
    if (!normalizedLinks.length) {
      return escapeHtml(sanitized);
    }
    return linkifyRoadmapSummaryText(sanitized, normalizedLinks);
  }

  function trimParagraphToSentenceCount(text, targetCount) {
    const sentences = splitSentences(normalizeParagraphValue(text));
    if (!sentences.length) return "";
    const selected =
      sentences.length <= targetCount ? sentences : sentences.slice(0, targetCount);
    return normalizeSentenceSpacing(joinSummarySentences(selected));
  }

  function getMinimumSentenceCount(tone) {
    return tone === "simplified"
      ? SIMPLIFIED_MIN_SENTENCES_PER_PARAGRAPH
      : PROFESSIONAL_MIN_SENTENCES_PER_PARAGRAPH;
  }

  function expandSentencesToCount(sentences, targetCount) {
    const work = sentences.slice();
    let guard = 0;
    while (work.length < targetCount && guard < 16) {
      guard += 1;
      let expanded = false;
      for (let i = 0; i < work.length; i += 1) {
        if (work.length >= targetCount) break;
        const parts = work[i].split(/;\s+|,\s+(?=[A-Za-z])/);
        if (parts.length <= 1) continue;
        const first = parts[0].trim();
        const rest = parts.slice(1).join(", ").trim();
        if (!first || !rest) continue;
        const firstSentence = /[.!?]$/.test(first) ? first : `${first}.`;
        const restSentence = /[.!?]$/.test(rest) ? rest : `${rest}.`;
        work.splice(i, 1, firstSentence, restSentence);
        expanded = true;
        break;
      }
      if (!expanded) break;
    }
    return work;
  }

  function rebalanceParagraphText(processedText, sourceText, targetCount, minimumCount) {
    const minimum = Math.max(1, minimumCount || 1);
    let sentences = splitSentences(normalizeSummaryParagraph(processedText)).filter(Boolean);
    const sourceSentences = splitSentences(normalizeSummaryParagraph(sourceText)).filter(Boolean);

    if (sentences.length > targetCount) {
      sentences = sentences.slice(0, targetCount);
    }

    if (sentences.length < targetCount) {
      const seen = new Set(sentences.map((sentence) => normalizeSentenceFingerprint(sentence)));
      sourceSentences.forEach((sentence) => {
        if (sentences.length >= targetCount) return;
        const fingerprint = normalizeSentenceFingerprint(sentence);
        if (fingerprint.length >= 10 && seen.has(fingerprint)) return;
        sentences.push(sentence.trim());
        if (fingerprint.length >= 10) seen.add(fingerprint);
      });
    }

    if (sentences.length < targetCount) {
      sentences = expandSentencesToCount(sentences, targetCount);
    }

    if (!sentences.length && sourceSentences.length) {
      sentences = sourceSentences.slice(0, Math.max(minimum, Math.min(targetCount, sourceSentences.length)));
    }

    if (sentences.length > targetCount) {
      sentences = sentences.slice(0, targetCount);
    }

    const normalized = normalizeSentenceSpacing(joinSummarySentences(sentences));
    if (!normalized) return "";
    if (countSentences(normalized) < minimum) {
      return normalizeSentenceSpacing(
        joinSummarySentences(sourceSentences.slice(0, Math.max(minimum, sourceSentences.length)))
      );
    }
    return normalized;
  }

  function finalizeSummaryVariantForTone(processed, source, tone) {
    const target = getTargetSentenceCount(tone);
    const minimum = getMinimumSentenceCount(tone);
    const processedVariant = coalesceSummaryVariant(processed);
    const sourceVariant = coalesceSummaryVariant(source);
    const out = {};
    SUMMARY_PARAGRAPH_KEYS.forEach((key) => {
      out[key] = rebalanceParagraphText(
        processedVariant[key],
        sourceVariant[key],
        target,
        minimum
      );
    });
    return coalesceSummaryVariant(out);
  }

  function repairSummaryParagraphStructure(variant, label) {
    const coalesced = coalesceSummaryVariant(variant);
    if (!coalesced.paragraph1 && !coalesced.paragraph2 && !coalesced.paragraph3) {
      throw new Error(`The ${label} summary could not be formatted as three paragraphs. Try again.`);
    }

    if (!coalesced.paragraph3) {
      const paragraph2Sentences = splitSentences(coalesced.paragraph2);
      if (paragraph2Sentences.length >= 2) {
        const split = splitIntoHalves(paragraph2Sentences);
        coalesced.paragraph2 = joinSummarySentences(split.first);
        coalesced.paragraph3 = joinSummarySentences(split.second);
      } else if (coalesced.paragraph2) {
        coalesced.paragraph3 = coalesced.paragraph2;
        coalesced.paragraph2 = "";
      }
    }

    if (!coalesced.paragraph2 && coalesced.paragraph3) {
      const paragraph3Sentences = splitSentences(coalesced.paragraph3);
      if (paragraph3Sentences.length >= 2) {
        const split = splitIntoHalves(paragraph3Sentences);
        coalesced.paragraph2 = joinSummarySentences(split.first);
        coalesced.paragraph3 = joinSummarySentences(split.second);
      } else {
        coalesced.paragraph2 = coalesced.paragraph3;
      }
    }

    if (!coalesced.paragraph1) {
      coalesced.paragraph1 = coalesced.paragraph2 || coalesced.paragraph3 || "";
    }

    if (!coalesced.paragraph1 || !coalesced.paragraph2 || !coalesced.paragraph3) {
      throw new Error(`The ${label} summary could not be formatted as three paragraphs. Try again.`);
    }
    return coalesced;
  }

  function buildSentenceCountRetryHint(tone, variant) {
    const target = getTargetSentenceCount(tone);
    const coalesced = coalesceSummaryVariant(variant);
    const counts = {
      paragraph1: countSentences(coalesced.paragraph1),
      paragraph2: countSentences(coalesced.paragraph2),
      paragraph3: countSentences(coalesced.paragraph3)
    };
    return (
      `Fix sentence counts: p1=${counts.paragraph1}, p2=${counts.paragraph2}, p3=${counts.paragraph3}; need ${target} each. Same facts.`
    );
  }

  function enforceParagraphSentenceCounts(variant, tone, sourceVariant) {
    return finalizeSummaryVariantForTone(variant, sourceVariant || variant, tone);
  }

  function assertSummaryParagraphVariant(variant, label) {
    return repairSummaryParagraphStructure(variant, label);
  }

  function assertThreeParagraphVariant(variant, label) {
    return repairSummaryParagraphStructure(variant, label);
  }

  function postProcessProfessionalVariant(variant, context, links) {
    const withLinks = ensureLinksInSummaryVariant(variant, links);
    return compressRedundantSummary(withLinks, context, links);
  }

  function postProcessSimplifiedVariant(variant, context, links) {
    return postProcessProfessionalVariant(variant, context, links);
  }

  function buildLocalSimplifiedVariant(professional, context, links) {
    return finalizeSummaryVariant(
      sanitizeSummaryVariantLinks(
        compressRedundantSummary(deriveSimplifiedFromProfessional(professional), context, links),
        links
      )
    );
  }

  async function generateVariantWithRetry(
    apiKey,
    prompt,
    tone,
    label,
    onProgress,
    context,
    links,
    postProcessFn
  ) {
    let lastError = null;
    let retryHint = "";
    let lastVariant = null;
    let lastParsed = null;
    for (let attempt = 0; attempt < SUMMARY_RETRY_ATTEMPTS; attempt += 1) {
      const isFinalAttempt = attempt === SUMMARY_RETRY_ATTEMPTS - 1;
      let rateLimitRetries = 0;
      while (rateLimitRetries < GROQ_RATE_LIMIT_RETRY_ATTEMPTS) {
        try {
          const rawText = await callGroqChat(apiKey, prompt, tone, onProgress, retryHint);
          const parsed = repairSummaryParagraphStructure(parseSummaryResponse(rawText), label);
          lastParsed = parsed;
          const processVariant = postProcessFn || postProcessProfessionalVariant;
          const processed = processVariant(parsed, context, links);
          const finalized = finalizeSummaryVariantForTone(processed, parsed, tone);
          const redundancyIssues = detectSummaryRedundancy(finalized, context, links);
          if (redundancyIssues.length && !isFinalAttempt) {
            lastVariant = finalized;
            const cohesionIssues =
              tone === "professional" ? detectSummaryCohesionIssues(finalized) : [];
            retryHint = buildProfessionalQualityRetryHint(redundancyIssues, cohesionIssues);
            throw new Error(`The ${label} summary still needs quality refinement.`);
          }
          lastVariant = finalized;
          return finalized;
        } catch (err) {
          lastError = err;
          if (err && err.rateLimit && rateLimitRetries < GROQ_RATE_LIMIT_RETRY_ATTEMPTS - 1) {
            rateLimitRetries += 1;
            const waitMs =
              err.retryAfterMs ||
              computeTpmPacingWaitMs(estimateGroqRequestTokens(prompt, tone, retryHint));
            await sleepWithProgress(
              waitMs,
              onProgress,
              `Groq rate limit — retrying ${label} automatically`
            );
            continue;
          }
          if (lastVariant && !(err && err.rateLimit)) {
            const redundancyIssues = detectSummaryRedundancy(lastVariant, context, links);
            if (redundancyIssues.length) {
              const cohesionIssues =
                tone === "professional" ? detectSummaryCohesionIssues(lastVariant) : [];
              retryHint = buildProfessionalQualityRetryHint(redundancyIssues, cohesionIssues);
            } else {
              retryHint = buildSentenceCountRetryHint(tone, lastVariant);
            }
          }
          break;
        }
      }
    }
    if (lastVariant) {
      const finalized = finalizeSummaryVariantForTone(
        lastVariant,
        lastParsed || lastVariant,
        tone
      );
      const redundancyIssues = detectSummaryRedundancy(finalized, context, links);
      if (!redundancyIssues.length) {
        return finalized;
      }
      lastError = new Error(`The ${label} summary still contains redundant content.`);
    }
    throw new Error(formatGroqErrorForUser(lastError && lastError.message) || `Could not generate the ${label} summary.`);
  }

  function resetTavilyPacingForTests() {
    lastTavilyFinishedAt = 0;
  }

  async function generateProfessionalSummary(contextObject, options) {
    const resolved = await resolveSummaryApiKeys();
    if (!resolved.ok) {
      throw new Error(resolved.message);
    }
    const onProgress = options && typeof options.onProgress === "function" ? options.onProgress : null;

    const preparedContext = prepareSummaryContext(contextObject);
    const links = normalizeSummaryLinks(preparedContext.links);
    const research = await gatherTavilyResearch(
      preparedContext,
      links,
      resolved.tavilyApiKey,
      onProgress
    );

    if (onProgress) onProgress("Groq: synthesizing non-redundant executive briefing…");

    const professionalRaw = await generateVariantWithRetry(
      resolved.apiKey,
      buildProfessionalPrompt(preparedContext, links, research),
      "professional",
      "professional",
      onProgress,
      preparedContext,
      links
    );
    const professional = finalizeSummaryVariant(
      sanitizeSummaryVariantLinks(professionalRaw, links)
    );

    return {
      professional,
      simplified: null,
      links,
      preparedContext,
      research,
      provider: resolved.provider,
      researchUsed: true
    };
  }

  async function generateSimplifiedSummary(session, options) {
    const resolved = await resolveSummaryApiKeys();
    if (!resolved.ok) {
      throw new Error(resolved.message);
    }
    const onProgress = options && typeof options.onProgress === "function" ? options.onProgress : null;
    const source = session && typeof session === "object" ? session : {};
    const professional = source.professional;
    const preparedContext = source.preparedContext;
    const links = normalizeSummaryLinks(source.links || (preparedContext && preparedContext.links));
    if (!professional || !preparedContext) {
      throw new Error("Generate the professional summary before requesting the simplified view.");
    }

    await awaitSummaryApiCooldowns(onProgress);

    if (shouldReuseCachedTavilyResearch(source.research)) {
      if (onProgress) {
        onProgress("API cooldown clear — reusing Tavily research from executive briefing…");
      }
    } else {
      if (onProgress) onProgress("Tavily: gathering research for storytelling summary…");
      await gatherTavilyResearch(preparedContext, links, resolved.tavilyApiKey, onProgress);
    }

    if (onProgress) onProgress("Groq: rewriting executive briefing as simplified storytelling…");
    try {
      const simplifiedRaw = await generateVariantWithRetry(
        resolved.apiKey,
        buildStorytellingPrompt(professional),
        "simplified",
        "simplified",
        onProgress,
        preparedContext,
        links,
        postProcessSimplifiedVariant
      );
      const simplified = finalizeSummaryVariant(sanitizeSummaryVariantLinks(simplifiedRaw, links));
      return {
        simplified,
        links,
        provider: resolved.provider,
        simplifiedSource: "groq"
      };
    } catch (err) {
      console.warn("Roadmap simplified Groq summary failed; using local derivation:", err);
      if (onProgress) {
        onProgress("Groq storytelling unavailable — preparing simplified view locally…");
      }
      return {
        simplified: buildLocalSimplifiedVariant(professional, preparedContext, links),
        links,
        provider: resolved.provider,
        simplifiedSource: "local",
        fallbackReason: err && err.message ? err.message : "Groq storytelling failed."
      };
    }
  }

  async function generateSummary(contextObject, options) {
    return generateProfessionalSummary(contextObject, options);
  }

  global.RoadmapLlmSummary = {
    resolveSummaryApiKeys,
    resolveGroqApiKey,
    formatMissingSummaryKeyMessage,
    generateSummary,
    generateProfessionalSummary,
    generateSimplifiedSummary,
    getSummaryApiCooldownStatus,
    awaitSummaryApiCooldowns,
    prepareSummaryContext,
    parseThreeParagraphs,
    parseSummaryParagraphs: parseThreeParagraphs,
    parseSummaryResponse,
    assertSummaryParagraphVariant,
    buildProfessionalPrompt,
    buildStorytellingPrompt,
    buildSimplifyPrompt: buildStorytellingPrompt,
    ensureLinksInSummaryVariant,
    linkifyRoadmapSummaryText,
    renderRoadmapSummaryParagraphText,
    sanitizeSummaryVariantLinks,
    dedupeSummaryVariantContext,
    normalizeSummaryLinks,
    normalizeRedirectLinkUrl,
    countSentences,
    enforceParagraphSentenceCounts,
    getTargetSentenceCount,
    compactContextForPrompt,
    parseGroqRetryDelayMs,
    parseGroqRateLimitDetails,
    estimateGroqRequestTokens,
    computeTpmPacingWaitMs,
    resetGroqTokenBudgetForTests,
    resetTavilyPacingForTests,
    recordGroqTokenUsage,
    recordTavilyUsage,
    formatGroqErrorForUser,
    normalizeSummaryParagraph,
    normalizeSentenceSpacing,
    finalizeSummaryVariant,
    buildTavilySearchQuery,
    parseTavilySearchPayload,
    parseTavilyExtractPayload,
    hasTavilyResearch,
    buildResearchPromptSection,
    deriveSimplifiedFromProfessional,
    buildLocalSimplifiedVariant,
    repairSummaryParagraphStructure,
    finalizeSummaryVariantForTone,
    rebalanceParagraphText,
    getMinimumSentenceCount,
    compactRaciForPrompt,
    compactTasksForPrompt,
    compactFinancialForPrompt,
    compactStringListForPrompt,
    shouldReuseCachedTavilyResearch,
    formatCooldownWaitLabel,
    pickSpreadSentences,
    buildParagraphExclusiveRules,
    compressRedundantSummary,
    detectSummaryRedundancy,
    detectSummaryCohesionIssues,
    buildCohesionRetryHint,
    buildProfessionalQualityRetryHint,
    sentenceOpensWithBridge,
    enforceParagraphFieldExclusivity,
    dedupeGlobalSentences
  };
})(typeof window !== "undefined" ? window : globalThis);
