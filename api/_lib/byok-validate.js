/**
 * Shared BYOK key normalization and provider validation (server-side).
 */

function normalizeApiKey(raw) {
  if (raw == null) return "";
  let key = String(raw).trim();
  key = key.replace(/^\uFEFF/, "");
  key = key.replace(/[\u200B-\u200D\uFEFF]/g, "");
  key = key.replace(/^["'`]+|["'`]+$/g, "");
  key = key.replace(/^Bearer\s+/i, "");
  key = key.replace(/\s+/g, "");
  return key;
}

function formatHint(providerId, apiKey) {
  if (!apiKey) return "Enter an API key first.";
  if (providerId === "groq" && !/^gsk_[A-Za-z0-9_-]+/.test(apiKey)) {
    return "Groq keys usually start with gsk_. Check for extra spaces or missing characters.";
  }
  if (providerId === "tavily" && !/^tvly-/i.test(apiKey)) {
    return "Tavily keys usually start with tvly-. Check for extra spaces or missing characters.";
  }
  return "";
}

function extractGroqError(payload, fallbackText) {
  if (payload && payload.error) {
    if (typeof payload.error === "string") return payload.error;
    if (payload.error.message) return String(payload.error.message);
  }
  if (fallbackText) return fallbackText.slice(0, 180);
  return "";
}

function extractTavilyError(payload, fallbackText) {
  if (!payload) return fallbackText ? fallbackText.slice(0, 180) : "";
  if (typeof payload.detail === "string") return payload.detail;
  if (payload.detail && typeof payload.detail === "object" && payload.detail.error) {
    return String(payload.detail.error);
  }
  if (payload.error) return String(payload.error);
  if (payload.message) return String(payload.message);
  return fallbackText ? fallbackText.slice(0, 180) : "";
}

async function validateGroqKey(apiKey) {
  const normalized = normalizeApiKey(apiKey);
  const hint = formatHint("groq", normalized);
  if (!normalized) return { ok: false, error: "apiKey is required." };
  if (hint) return { ok: false, error: hint };

  const headers = {
    Authorization: `Bearer ${normalized}`,
    Accept: "application/json"
  };

  try {
    const modelsResponse = await fetch("https://api.groq.com/openai/v1/models", {
      method: "GET",
      headers
    });

    if (modelsResponse.ok) {
      return { ok: true, message: "Groq API key is valid." };
    }

    if (modelsResponse.status === 401 || modelsResponse.status === 403) {
      let detail = "";
      try {
        const payload = await modelsResponse.json();
        detail = extractGroqError(payload, "");
      } catch {
        detail = "";
      }
      return {
        ok: false,
        error: detail || "Groq rejected this API key (unauthorized)."
      };
    }

    // Fallback: minimal chat completion (some accounts behave differently on /models).
    const chatResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
        temperature: 0
      })
    });

    if (chatResponse.ok) {
      return { ok: true, message: "Groq API key is valid." };
    }

    if (chatResponse.status === 401 || chatResponse.status === 403) {
      return { ok: false, error: "Groq rejected this API key (unauthorized)." };
    }

    const detail = await chatResponse.text().catch(() => "");
    return {
      ok: false,
      error: detail ? `Groq validation failed: ${detail.slice(0, 180)}` : "Groq validation failed."
    };
  } catch (err) {
    console.error("validateGroqKey error:", err);
    return { ok: false, error: "Unable to reach Groq API." };
  }
}

async function validateTavilyKey(apiKey) {
  const normalized = normalizeApiKey(apiKey);
  const hint = formatHint("tavily", normalized);
  if (!normalized) return { ok: false, error: "apiKey is required." };
  if (hint) return { ok: false, error: hint };

  const body = JSON.stringify({
    api_key: normalized,
    query: "validation",
    max_results: 1,
    include_answer: false,
    search_depth: "basic"
  });

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${normalized}`
      },
      body
    });

    if (response.ok) {
      return { ok: true, message: "Tavily API key is valid." };
    }

    if (response.status === 401 || response.status === 403) {
      return { ok: false, error: "Tavily rejected this API key (unauthorized)." };
    }

    if (response.status === 429) {
      return {
        ok: true,
        message: "Tavily API key is valid (rate limit hit during check — key accepted)."
      };
    }

    let detail = "";
    try {
      const payload = await response.json();
      detail = extractTavilyError(payload, "");
    } catch {
      detail = await response.text().catch(() => "");
    }

    return {
      ok: false,
      error: detail ? `Tavily validation failed: ${detail}` : "Tavily validation failed."
    };
  } catch (err) {
    console.error("validateTavilyKey error:", err);
    return { ok: false, error: "Unable to reach Tavily API." };
  }
}

module.exports = {
  normalizeApiKey,
  formatHint,
  validateGroqKey,
  validateTavilyKey
};
