/**
 * BYOK (Bring Your Own Key) — local encrypted storage for Groq & Tavily API keys.
 * Keys never leave the browser except when the user explicitly validates them.
 */
(function (global) {
  const STORAGE_KEY = "pm_byok_v1";
  const DEVICE_SALT_KEY = "pm_byok_device_salt_v1";
  const PBKDF2_ITERATIONS = 120000;
  const ENVELOPE_VERSION = 1;

  const PROVIDERS = {
    groq: {
      id: "groq",
      label: "Groq",
      description: "Fast LLM inference for AI features in this workspace.",
      placeholder: "gsk_…",
      signupUrl: "https://console.groq.com/keys",
      signupLabel: "Get Groq API key",
      validatePath: "/api/byok/validate-groq"
    },
    tavily: {
      id: "tavily",
      label: "Tavily",
      description: "Web search API for research and enrichment features.",
      placeholder: "tvly-…",
      signupUrl: "https://app.tavily.com/home",
      signupLabel: "Get Tavily API key",
      validatePath: "/api/byok/validate-tavily"
    }
  };

  let modalHooks = null;
  let draftKeys = { groq: "", tavily: "" };
  let activeProviderTab = "groq";
  const providerWorkflow = { groq: "paste", tavily: "paste" };

  const WORKFLOW_GUIDE = {
    paste: {
      badge: "Step 1 of 3",
      message: "Paste your API key from the provider console.",
      progress: 33
    },
    validate: {
      badge: "Step 2 of 3",
      message: "Click Save API key to test the connection and store it on this device.",
      progress: 66
    },
    save: {
      badge: "Complete",
      message: "Your key is saved and encrypted locally. You can close this window or configure the other provider.",
      progress: 100
    }
  };

  const BYOK_GRID_BREAKPOINT = "(min-width: 900px)";

  function isByokGridLayout() {
    return window.matchMedia(BYOK_GRID_BREAKPOINT).matches;
  }

  const STATUS_ICONS = {
    pending:
      '<svg class="byok-provider-status__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    valid:
      '<svg class="byok-provider-status__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
    saved:
      '<svg class="byok-provider-status__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    error:
      '<svg class="byok-provider-status__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>'
  };

  function bytesToHex(bytes) {
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }

  function hexToBytes(hex) {
    const normalized = String(hex || "").trim();
    if (!normalized || normalized.length % 2 !== 0) return new Uint8Array(0);
    const out = new Uint8Array(normalized.length / 2);
    for (let i = 0; i < out.length; i++) {
      out[i] = parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
  }

  function getDeviceSaltHex() {
    let saltHex = "";
    try {
      saltHex = localStorage.getItem(DEVICE_SALT_KEY) || "";
    } catch {
      saltHex = "";
    }
    if (!saltHex) {
      saltHex = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
      try {
        localStorage.setItem(DEVICE_SALT_KEY, saltHex);
      } catch (err) {
        console.warn("BYOK: unable to persist device salt", err);
      }
    }
    return saltHex;
  }

  async function deriveEncryptionKey() {
    if (!global.crypto || !global.crypto.subtle) {
      throw new Error("Web Crypto is not available in this browser.");
    }
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      enc.encode("pm-prioritization-tool-byok-v1"),
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: hexToBytes(getDeviceSaltHex()),
        iterations: PBKDF2_ITERATIONS,
        hash: "SHA-256"
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  }

  async function encryptSecret(plaintext) {
    const key = await deriveEncryptionKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plaintext));
    return {
      v: ENVELOPE_VERSION,
      iv: bytesToHex(iv),
      data: bytesToHex(new Uint8Array(cipher))
    };
  }

  async function decryptSecret(envelope) {
    if (!envelope || !envelope.iv || !envelope.data) return "";
    const key = await deriveEncryptionKey();
    const dec = new TextDecoder();
    const plainBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: hexToBytes(envelope.iv) },
      key,
      hexToBytes(envelope.data)
    );
    return dec.decode(plainBuffer);
  }

  function readStorageRaw() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { groq: null, tavily: null };
      const parsed = JSON.parse(raw);
      return {
        groq: parsed && parsed.groq ? parsed.groq : null,
        tavily: parsed && parsed.tavily ? parsed.tavily : null
      };
    } catch (err) {
      console.warn("BYOK: failed to read storage", err);
      return { groq: null, tavily: null };
    }
  }

  function writeStorageRaw(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (err) {
      console.error("BYOK: failed to write storage", err);
      return false;
    }
  }

  async function getStoredKey(providerId) {
    const raw = readStorageRaw();
    const envelope = raw[providerId];
    if (!envelope) return "";
    try {
      return await decryptSecret(envelope);
    } catch (err) {
      console.error("BYOK: decrypt failed for", providerId, err);
      return "";
    }
  }

  async function saveKey(providerId, apiKey) {
    const trimmed = String(apiKey || "").trim();
    const raw = readStorageRaw();
    if (!trimmed) {
      raw[providerId] = null;
      writeStorageRaw(raw);
      return { ok: true, cleared: true };
    }
    try {
      raw[providerId] = await encryptSecret(trimmed);
      raw[`${providerId}UpdatedAt`] = new Date().toISOString();
      if (!writeStorageRaw(raw)) {
        return { ok: false, message: "Could not save — browser storage may be full." };
      }
      return { ok: true };
    } catch (err) {
      console.error("BYOK: encrypt/save failed", err);
      return { ok: false, message: err.message || "Encryption failed." };
    }
  }

  async function clearKey(providerId) {
    return saveKey(providerId, "");
  }

  function hasStoredKey(providerId) {
    const raw = readStorageRaw();
    return !!(raw[providerId] && raw[providerId].data);
  }

  function countStoredKeys() {
    return Object.keys(PROVIDERS).filter((id) => hasStoredKey(id)).length;
  }

  async function validateKeyRemote(providerId, apiKey) {
    const provider = PROVIDERS[providerId];
    if (!provider) return { ok: false, message: "Unknown provider." };

    const normalized = normalizeApiKey(apiKey);
    const formatError = getFormatHint(providerId, normalized);
    if (!normalized) return { ok: false, message: "Enter an API key first." };
    if (formatError) return { ok: false, message: formatError };

    const input = getProviderInput(providerId);
    if (input && input.value !== normalized) {
      input.value = normalized;
      draftKeys[providerId] = normalized;
      updateKeyMeta(providerId);
    }

    const direct = await validateKeyDirect(providerId, normalized);
    if (direct.ok || direct.definitive) {
      return direct;
    }

    try {
      const response = await fetch(provider.validatePath, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ apiKey: normalized })
      });

      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (response.ok && payload && payload.ok) {
        return { ok: true, message: payload.message || "API key is valid.", definitive: true };
      }

      if (payload && payload.error) {
        return { ok: false, message: payload.error, definitive: true };
      }

      if (direct.message) {
        return direct;
      }

      return {
        ok: false,
        message:
          response.status === 404
            ? "Validation service is unavailable on this deployment. Trying direct provider check failed — confirm your key format and try again."
            : `Validation failed (${response.status}).`
      };
    } catch (err) {
      console.warn("BYOK validate proxy failed:", err);
      if (direct.message) return direct;
      return {
        ok: false,
        message: "Could not validate the API key. Check your network connection and try again."
      };
    }
  }

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

  function getFormatHint(providerId, apiKey) {
    if (!apiKey) return "";
    if (providerId === "groq" && !/^gsk_[A-Za-z0-9_-]+/.test(apiKey)) {
      return "Groq keys usually start with gsk_. Remove extra spaces or characters and try again.";
    }
    if (providerId === "tavily" && !/^tvly-/i.test(apiKey)) {
      return "Tavily keys usually start with tvly-. Remove extra spaces or characters and try again.";
    }
    return "";
  }

  function parseGroqError(payload, fallbackText) {
    if (payload && payload.error) {
      if (typeof payload.error === "string") return payload.error;
      if (payload.error.message) return String(payload.error.message);
    }
    return fallbackText ? fallbackText.slice(0, 180) : "";
  }

  function parseTavilyError(payload, fallbackText) {
    if (!payload) return fallbackText ? fallbackText.slice(0, 180) : "";
    if (typeof payload.detail === "string") return payload.detail;
    if (payload.detail && typeof payload.detail === "object" && payload.detail.error) {
      return String(payload.detail.error);
    }
    if (payload.error) return String(payload.error);
    if (payload.message) return String(payload.message);
    return fallbackText ? fallbackText.slice(0, 180) : "";
  }

  async function validateKeyDirect(providerId, apiKey) {
    if (providerId === "groq") return validateGroqDirect(apiKey);
    if (providerId === "tavily") return validateTavilyDirect(apiKey);
    return { ok: false, message: "Unknown provider.", definitive: false };
  }

  async function validateGroqDirect(apiKey) {
    const headers = {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json"
    };

    try {
      const modelsResponse = await fetch("https://api.groq.com/openai/v1/models", {
        method: "GET",
        headers
      });

      if (modelsResponse.ok) {
        return { ok: true, message: "Groq API key is valid.", definitive: true };
      }

      if (modelsResponse.status === 401 || modelsResponse.status === 403) {
        let detail = "";
        try {
          const payload = await modelsResponse.json();
          detail = parseGroqError(payload, "");
        } catch {
          detail = "";
        }
        return {
          ok: false,
          message: detail || "Groq rejected this API key (unauthorized).",
          definitive: true
        };
      }

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
        return { ok: true, message: "Groq API key is valid.", definitive: true };
      }

      if (chatResponse.status === 401 || chatResponse.status === 403) {
        return {
          ok: false,
          message: "Groq rejected this API key (unauthorized).",
          definitive: true
        };
      }

      const detail = await chatResponse.text().catch(() => "");
      return {
        ok: false,
        message: detail ? `Groq validation failed: ${detail.slice(0, 180)}` : "Groq validation failed.",
        definitive: true
      };
    } catch (err) {
      console.warn("BYOK Groq direct validate failed:", err);
      return {
        ok: false,
        message: "",
        definitive: false
      };
    }
  }

  async function validateTavilyDirect(apiKey) {
    const body = {
      api_key: apiKey,
      query: "validation",
      max_results: 1,
      include_answer: false,
      search_depth: "basic"
    };

    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        return { ok: true, message: "Tavily API key is valid.", definitive: true };
      }

      if (response.status === 401 || response.status === 403) {
        let detail = "";
        try {
          const payload = await response.json();
          detail = parseTavilyError(payload, "");
        } catch {
          detail = "";
        }
        return {
          ok: false,
          message: detail || "Tavily rejected this API key (unauthorized).",
          definitive: true
        };
      }

      if (response.status === 429) {
        return {
          ok: true,
          message: "Tavily API key is valid (rate limit during check — key accepted).",
          definitive: true
        };
      }

      let detail = "";
      try {
        const payload = await response.json();
        detail = parseTavilyError(payload, "");
      } catch {
        detail = await response.text().catch(() => "");
      }

      return {
        ok: false,
        message: detail ? `Tavily validation failed: ${detail}` : "Tavily validation failed.",
        definitive: true
      };
    } catch (err) {
      console.warn("BYOK Tavily direct validate failed:", err);
      return {
        ok: false,
        message: "",
        definitive: false
      };
    }
  }

  function setProviderStatus(providerId, type, message) {
    const el = document.getElementById(`byok${capitalize(providerId)}Status`);
    if (!el) return;
    el.hidden = !message;
    if (!message) {
      el.textContent = "";
      el.className = "byok-provider-status";
      syncProviderCard(providerId);
      return;
    }
    const icon = STATUS_ICONS[type] || "";
    el.className = "byok-provider-status" + (type ? ` byok-provider-status--${type}` : "");
    el.innerHTML = `${icon}<span>${escapeHtml(message)}</span>`;

    if (type === "pending") {
      setProviderCardState(providerId, "validating");
      updateProviderChip(providerId, "pending", "Checking…");
    } else if (type === "valid") {
      setProviderCardState(providerId, "configured");
      updateProviderChip(providerId, "valid", "Valid key");
    } else if (type === "saved") {
      setProviderCardState(providerId, "configured");
      updateProviderChip(providerId, "configured", "Saved locally");
    } else if (type === "error") {
      setProviderCardState(providerId, "error");
      updateProviderChip(providerId, "error", "Needs attention");
    }
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function capitalize(value) {
    return String(value || "").charAt(0).toUpperCase() + String(value || "").slice(1);
  }

  function getProviderInput(providerId) {
    return document.getElementById(`byok${capitalize(providerId)}KeyInput`);
  }

  function getProviderCard(providerId) {
    return document.getElementById(`byok${capitalize(providerId)}Card`);
  }

  function getProviderChip(providerId) {
    return document.getElementById(`byok${capitalize(providerId)}Chip`);
  }

  function getProviderActionButton(providerId, action) {
    const cap = capitalize(providerId);
    const ids = {
      validate: `byok${cap}ValidateBtn`,
      validateSave: `byok${cap}ValidateSaveBtn`,
      save: `byok${cap}SaveBtn`,
      clear: `byok${cap}ClearBtn`
    };
    return document.getElementById(ids[action] || "");
  }

  function getKeyUpdatedAt(providerId) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && parsed[`${providerId}UpdatedAt`] ? parsed[`${providerId}UpdatedAt`] : null;
    } catch {
      return null;
    }
  }

  function maskKeyPreview(key) {
    const value = String(key || "").trim();
    if (!value) return "";
    if (value.length <= 4) return "••••";
    return `•••• ${value.slice(-4)}`;
  }

  function formatSavedAt(iso) {
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    const diffMs = Date.now() - date.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "Saved just now";
    if (mins < 60) return `Saved ${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Saved ${hours}h ago`;
    return `Saved ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  }

  function updateKeyMeta(providerId) {
    const cap = capitalize(providerId);
    const meta = document.getElementById(`byok${cap}KeyMeta`);
    const mask = document.getElementById(`byok${cap}KeyMask`);
    const count = document.getElementById(`byok${cap}KeyCount`);
    const savedSep = document.getElementById(`byok${cap}SavedSep`);
    const savedAt = document.getElementById(`byok${cap}SavedAt`);
    const input = getProviderInput(providerId);
    const value = (input && input.value) || draftKeys[providerId] || "";
    const trimmed = value.trim();

    if (!meta || !mask || !count) return;

    if (!trimmed) {
      meta.hidden = true;
      return;
    }

    meta.hidden = false;
    mask.textContent = maskKeyPreview(trimmed);
    count.textContent = `${trimmed.length} character${trimmed.length === 1 ? "" : "s"}`;

    const updatedIso = hasStoredKey(providerId) ? getKeyUpdatedAt(providerId) : null;
    const savedLabel = formatSavedAt(updatedIso);
    if (savedSep) savedSep.hidden = !savedLabel;
    if (savedAt) {
      savedAt.hidden = !savedLabel;
      savedAt.textContent = savedLabel;
    }

    updateActionLinks(providerId);
  }

  function updateActionLinks(providerId) {
    const cap = capitalize(providerId);
    const clearBtn = document.getElementById(`byok${cap}ClearBtn`);
    const validateBtn = document.getElementById(`byok${cap}ValidateBtn`);
    const saveBtn = document.getElementById(`byok${cap}SaveBtn`);
    const primaryBtn = document.getElementById(`byok${cap}ValidateSaveBtn`);
    const input = getProviderInput(providerId);
    const hasValue = Boolean((input && input.value.trim()) || (draftKeys[providerId] || "").trim());
    const stored = hasStoredKey(providerId);

    if (clearBtn) clearBtn.hidden = !hasValue && !stored;
    if (validateBtn) validateBtn.disabled = !hasValue;
    if (saveBtn) saveBtn.disabled = !hasValue;
    if (primaryBtn) primaryBtn.disabled = !hasValue;
  }

  function updateWorkflowSteps(providerId) {
    const step = providerWorkflow[providerId] || "paste";
    const order = ["paste", "validate", "save"];
    const activeIndex = Math.max(0, order.indexOf(step));
    const guide = WORKFLOW_GUIDE[step] || WORKFLOW_GUIDE.paste;

    const badgeEl = document.getElementById("byokGuideBadge");
    const messageEl = document.getElementById("byokGuideMessage");
    const fillEl = document.getElementById("byokGuideFill");
    const guideEl = document.getElementById("byokSetupGuide");

    if (badgeEl) badgeEl.textContent = guide.badge;
    if (messageEl) messageEl.textContent = guide.message;
    if (fillEl) {
      fillEl.style.width = `${guide.progress}%`;
      fillEl.classList.toggle("byok-setup-guide__fill--complete", step === "save");
    }
    if (guideEl) {
      guideEl.classList.toggle("byok-setup-guide--complete", step === "save");
    }

    document.querySelectorAll("#byokWorkflowSteps .byok-setup-step").forEach((el) => {
      const stepName = el.getAttribute("data-step");
      if (!stepName) return;
      const idx = order.indexOf(stepName);
      el.classList.remove("byok-setup-step--active", "byok-setup-step--done", "byok-setup-step--pending");
      if (idx < activeIndex) el.classList.add("byok-setup-step--done");
      else if (idx === activeIndex) el.classList.add("byok-setup-step--active");
      else el.classList.add("byok-setup-step--pending");
    });
  }

  function setProviderWorkflow(providerId, step) {
    providerWorkflow[providerId] = step;
    if (providerId === activeProviderTab) {
      updateWorkflowSteps(providerId);
    }
  }

  function updateTabDots() {
    Object.keys(PROVIDERS).forEach((id) => {
      const cap = capitalize(id);
      const status = document.getElementById(`byokTab${cap}Dot`);
      const tab = document.getElementById(`byokTab${cap}`);
      const ready = hasStoredKey(id);
      if (status) {
        status.classList.toggle("byok-provider-tab__status--ready", ready);
        status.textContent = ready ? "Saved" : "";
      }
      if (tab) tab.classList.toggle("byok-provider-tab--ready", ready);
    });
  }

  function switchProviderTab(providerId) {
    if (!PROVIDERS[providerId]) return;
    activeProviderTab = providerId;

    document.querySelectorAll(".byok-provider-tab").forEach((tab) => {
      const isActive = tab.getAttribute("data-provider") === providerId;
      tab.classList.toggle("byok-provider-tab--active", isActive);
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    Object.keys(PROVIDERS).forEach((id) => {
      const card = getProviderCard(id);
      if (!card) return;
      const isActive = id === providerId;
      card.classList.toggle("byok-provider-card--active", isActive);
      if (isByokGridLayout()) {
        card.hidden = false;
      } else {
        card.hidden = !isActive;
      }
    });

    updateWorkflowSteps(providerId);
    const input = getProviderInput(providerId);
    if (input && !isByokGridLayout()) {
      setTimeout(() => input.focus(), 0);
    }
  }

  function syncDesktopProviderVisibility() {
    const isGrid = isByokGridLayout();
    Object.keys(PROVIDERS).forEach((id) => {
      const card = getProviderCard(id);
      if (!card) return;
      if (isGrid) {
        card.hidden = false;
        card.classList.add("byok-provider-card--active");
      } else {
        card.hidden = id !== activeProviderTab;
        card.classList.toggle("byok-provider-card--active", id === activeProviderTab);
      }
    });
  }

  function setButtonLoading(btn, loading, loadingLabel) {
    if (!btn) return;
    const isLink = btn.classList.contains("byok-action-link");
    if (loading) {
      if (btn.dataset.byokLoading === "1") return;
      btn.dataset.byokLoading = "1";
      btn.dataset.byokOriginalLabel =
        btn.querySelector(".byok-btn__label")?.textContent || btn.textContent.trim();
      btn.disabled = true;
      btn.classList.add("byok-btn--loading");
      const label = btn.querySelector(".byok-btn__label");
      if (label) label.textContent = loadingLabel || "Working…";
      else btn.textContent = loadingLabel || "Working…";
      if (!isLink && !btn.querySelector(".byok-btn__spinner")) {
        const spinner = document.createElement("span");
        spinner.className = "byok-btn__spinner";
        spinner.setAttribute("aria-hidden", "true");
        btn.insertBefore(spinner, btn.firstChild);
      }
      return;
    }
    btn.dataset.byokLoading = "0";
    btn.disabled = false;
    btn.classList.remove("byok-btn--loading");
    btn.querySelector(".byok-btn__spinner")?.remove();
    const label = btn.querySelector(".byok-btn__label");
    if (label && btn.dataset.byokOriginalLabel) {
      label.textContent = btn.dataset.byokOriginalLabel;
    } else if (btn.dataset.byokOriginalLabel) {
      btn.textContent = btn.dataset.byokOriginalLabel;
    }
  }

  function setProviderCardState(providerId, state) {
    const card = getProviderCard(providerId);
    if (!card) return;
    card.classList.remove(
      "byok-provider-card--configured",
      "byok-provider-card--pending",
      "byok-provider-card--validating",
      "byok-provider-card--error"
    );
    if (state) card.classList.add(`byok-provider-card--${state}`);
    if (state === "configured" || (state === "" && hasStoredKey(providerId))) {
      card.classList.add("byok-provider-card--configured");
    }
  }

  function updateProviderChip(providerId, type, text) {
    const chip = getProviderChip(providerId);
    if (!chip) return;
    chip.className = "byok-provider-chip" + (type ? ` byok-provider-chip--${type}` : "");
    if (text) {
      chip.textContent = text;
      return;
    }
    if (hasStoredKey(providerId)) {
      chip.textContent = "Saved locally";
      chip.classList.add("byok-provider-chip--configured");
      return;
    }
    chip.textContent = "Not configured";
  }

  function updateSummaryStrip() {
    const stripEl = document.getElementById("byokSummaryStrip");
    const countEl = document.getElementById("byokSummaryCount");
    const fillEl = document.getElementById("byokProgressFill");
    const total = Object.keys(PROVIDERS).length;
    const count = countStoredKeys();
    const pct = total ? Math.round((count / total) * 100) : 0;

    if (countEl) {
      countEl.textContent =
        count === total
          ? `All ${total} providers ready`
          : count === 0
            ? `0 of ${total} ready`
            : `${count} of ${total} ready`;
    }
    if (stripEl) {
      stripEl.classList.toggle("byok-hero-panel--ready", count === total && total > 0);
      stripEl.classList.toggle("byok-hero-panel--partial", count > 0 && count < total);
    }
    if (fillEl) {
      fillEl.style.width = `${pct}%`;
      fillEl.classList.toggle("byok-progress__fill--complete", count === total && total > 0);
    }
    updateTabDots();
  }

  function syncProviderCard(providerId) {
    const configured = hasStoredKey(providerId);
    setProviderCardState(providerId, configured ? "configured" : "");
    updateProviderChip(providerId, configured ? "configured" : "", configured ? "Saved locally" : "Not configured");
  }

  async function loadModalFields() {
    for (const id of Object.keys(PROVIDERS)) {
      const input = getProviderInput(id);
      const stored = await getStoredKey(id);
      draftKeys[id] = stored;
      if (input) {
        input.value = stored;
        input.type = "password";
      }
      setProviderStatus(id, "", "");
      syncProviderCard(id);
      updateKeyMeta(id);
      providerWorkflow[id] = hasStoredKey(id) ? "save" : stored.trim() ? "validate" : "paste";
    }
    switchProviderTab(activeProviderTab);
    syncDesktopProviderVisibility();
    updateHeaderBadge();
    updateSummaryStrip();
  }

  function updateHeaderBadge() {
    const btn = document.getElementById("byokApiKeysBtn");
    if (!btn) return;
    const total = Object.keys(PROVIDERS).length;
    const count = countStoredKeys();
    const metaEl = document.getElementById("byokHeaderMeta");
    const dotEl = document.getElementById("byokHeaderDot");

    btn.classList.toggle("app-header-action-btn--byok-ready", count === total && total > 0);
    btn.classList.toggle("app-header-action-btn--byok-partial", count > 0 && count < total);

    if (metaEl) {
      metaEl.textContent =
        count === total
          ? "All providers ready"
          : count === 0
            ? "Not configured"
            : `${count} of ${total} ready`;
    }

    if (dotEl) {
      dotEl.hidden = count === 0;
      dotEl.classList.toggle("byok-header-dot--partial", count > 0 && count < total);
      dotEl.classList.toggle("byok-header-dot--ready", count === total && total > 0);
    }

    btn.setAttribute(
      "title",
      count > 0
        ? `API Keys — ${count} of ${total} provider${total === 1 ? "" : "s"} configured (encrypted locally)`
        : "Store encrypted Groq & Tavily API keys locally (BYOK)"
    );
  }

  async function handleValidate(providerId) {
    const input = getProviderInput(providerId);
    const validateBtn = getProviderActionButton(providerId, "validate");
    const validateSaveBtn = getProviderActionButton(providerId, "validateSave");
    const saveBtn = getProviderActionButton(providerId, "save");
    const apiKey = (input && input.value) || draftKeys[providerId] || "";
    setProviderWorkflow(providerId, "validate");
    setProviderStatus(providerId, "pending", "Contacting provider to verify your key…");
    setButtonLoading(validateBtn, true, "Validating…");
    if (validateSaveBtn) validateSaveBtn.disabled = true;
    if (saveBtn) saveBtn.disabled = true;
    try {
      const result = await validateKeyRemote(providerId, apiKey);
      setProviderStatus(providerId, result.ok ? "valid" : "error", result.message);
      if (result.ok) setProviderWorkflow(providerId, "validate");
      return result;
    } finally {
      setButtonLoading(validateBtn, false);
      if (validateSaveBtn) validateSaveBtn.disabled = false;
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  async function handleSave(providerId) {
    const input = getProviderInput(providerId);
    const saveBtn = getProviderActionButton(providerId, "save");
    const validateBtn = getProviderActionButton(providerId, "validate");
    const validateSaveBtn = getProviderActionButton(providerId, "validateSave");
    const apiKey = normalizeApiKey(input ? input.value : "");
    if (input && input.value !== apiKey) input.value = apiKey;
    setProviderWorkflow(providerId, "save");
    setProviderStatus(providerId, "pending", "Encrypting and saving to this browser…");
    setButtonLoading(saveBtn, true, "Saving…");
    if (validateBtn) validateBtn.disabled = true;
    if (validateSaveBtn) validateSaveBtn.disabled = true;
    try {
      const result = await saveKey(providerId, apiKey);
      if (!result.ok) {
        setProviderStatus(providerId, "error", result.message || "Save failed.");
        return result;
      }
      draftKeys[providerId] = apiKey.trim();
      setProviderStatus(
        providerId,
        result.cleared ? "" : "saved",
        result.cleared ? "Key removed from this browser." : "Saved locally with AES-GCM encryption."
      );
      if (result.cleared) {
        syncProviderCard(providerId);
        providerWorkflow[providerId] = "paste";
      } else {
        setProviderWorkflow(providerId, "save");
      }
      updateKeyMeta(providerId);
      updateHeaderBadge();
      updateSummaryStrip();
      return result;
    } finally {
      setButtonLoading(saveBtn, false);
      if (validateBtn) validateBtn.disabled = false;
      if (validateSaveBtn) validateSaveBtn.disabled = false;
    }
  }

  async function handleValidateAndSave(providerId) {
    const validateSaveBtn = getProviderActionButton(providerId, "validateSave");
    setButtonLoading(validateSaveBtn, true, "Saving…");
    try {
      const validateResult = await handleValidate(providerId);
      if (!validateResult.ok) return validateResult;
      return handleSave(providerId);
    } finally {
      setButtonLoading(validateSaveBtn, false);
    }
  }

  async function handleClear(providerId) {
    const clearBtn = getProviderActionButton(providerId, "clear");
    setButtonLoading(clearBtn, true, "Removing…");
    try {
      const input = getProviderInput(providerId);
      if (input) input.value = "";
      draftKeys[providerId] = "";
      setProviderStatus(providerId, "pending", "Removing key from this browser…");
      const result = await saveKey(providerId, "");
      if (!result.ok) {
        setProviderStatus(providerId, "error", result.message || "Could not remove key.");
        return result;
      }
      setProviderStatus(providerId, "", "");
      syncProviderCard(providerId);
      updateKeyMeta(providerId);
      providerWorkflow[providerId] = "paste";
      updateWorkflowSteps(providerId);
      updateHeaderBadge();
      updateSummaryStrip();
      return result;
    } finally {
      setButtonLoading(clearBtn, false);
    }
  }

  function bindProviderActions(providerId) {
    const cap = capitalize(providerId);
    const validateBtn = document.getElementById(`byok${cap}ValidateBtn`);
    const validateSaveBtn = document.getElementById(`byok${cap}ValidateSaveBtn`);
    const saveBtn = document.getElementById(`byok${cap}SaveBtn`);
    const clearBtn = document.getElementById(`byok${cap}ClearBtn`);
    const input = getProviderInput(providerId);

    if (validateBtn) validateBtn.addEventListener("click", () => handleValidate(providerId));
    if (validateSaveBtn) validateSaveBtn.addEventListener("click", () => handleValidateAndSave(providerId));
    if (saveBtn) saveBtn.addEventListener("click", () => handleSave(providerId));
    if (clearBtn) clearBtn.addEventListener("click", () => handleClear(providerId));
    if (input) {
      input.addEventListener("input", () => {
        draftKeys[providerId] = input.value;
        setProviderStatus(providerId, "", "");
        updateKeyMeta(providerId);
        setProviderWorkflow(providerId, input.value.trim() ? "validate" : "paste");
        updateProviderChip(
          providerId,
          input.value.trim() ? "draft" : "",
          input.value.trim() ? "Unsaved changes" : "Not configured"
        );
        if (input.value.trim()) {
          getProviderCard(providerId)?.classList.remove("byok-provider-card--configured");
        }
      });
      input.addEventListener("focus", () => {
        activeProviderTab = providerId;
        if (!isByokGridLayout()) {
          switchProviderTab(providerId);
        } else {
          updateWorkflowSteps(providerId);
        }
      });
    }
  }

  function openModal() {
    if (!modalHooks || !modalHooks.modal) return;
    loadModalFields();
    modalHooks.activateModal();
    const first = getProviderInput("groq");
    if (first) setTimeout(() => first.focus(), 0);
  }

  function closeModal(options) {
    if (!modalHooks || !modalHooks.modal) return;
    modalHooks.deactivateModal(options || {});
  }

  function initModal(hooks) {
    modalHooks = hooks || null;
    const openBtn = document.getElementById("byokApiKeysBtn");
    const cancelBtn = document.getElementById("byokApiKeysCancelBtn");

    if (openBtn) openBtn.addEventListener("click", () => openModal());
    if (cancelBtn) cancelBtn.addEventListener("click", () => closeModal());

    document.querySelectorAll(".byok-provider-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        const providerId = tab.getAttribute("data-provider");
        if (providerId) switchProviderTab(providerId);
      });
    });

    window.addEventListener("resize", syncDesktopProviderVisibility);

    Object.keys(PROVIDERS).forEach((providerId) => bindProviderActions(providerId));

    updateHeaderBadge();
    updateSummaryStrip();
  }

  global.ByokApiKeys = {
    PROVIDERS,
    initModal,
    openModal,
    closeModal,
    getStoredKey,
    saveKey,
    clearKey,
    hasStoredKey,
    countStoredKeys,
    validateKeyRemote,
    normalizeApiKey,
    validateKeyDirect,
    updateHeaderBadge,
    encryptSecret,
    decryptSecret
  };
})(typeof window !== "undefined" ? window : globalThis);
