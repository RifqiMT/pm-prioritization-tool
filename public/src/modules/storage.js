/**
 * Persistence layer: MongoDB (Vercel /api) when configured, else browser localStorage.
 * When remote is active, localStorage is used only as an offline cache.
 */
const AppStorage = (function () {
  const API_SECRET_STORAGE_KEY = "pm_cloud_api_secret_v1";
  const URL_KEY_PARAM = "pm_api_key";

  /** @type {"unknown"|"local"|"mongodb"|"mongodb-pending-auth"} */
  let mode = "unknown";
  /** @type {"idle"|"syncing"|"synced"|"error"|"offline"} */
  let syncStatus = "idle";
  let lastError = null;
  let lastSyncedAt = null;
  let cloudConfig = null;
  let applyPayloadFn = null;
  let serializePayloadFn = null;
  let onStatusChangeFn = null;

  let saveTimer = null;
  let pendingPayload = null;
  let inFlightSave = null;

  function notifyStatus() {
    if (typeof onStatusChangeFn === "function") {
      onStatusChangeFn({
        mode,
        syncStatus,
        lastError,
        lastSyncedAt,
        cloudConfig
      });
    }
  }

  function setSyncStatus(next, error) {
    syncStatus = next;
    lastError = error || null;
    notifyStatus();
  }

  function isLocalFileOrigin() {
    return window.location.protocol === "file:";
  }

  function getApiSecret() {
    try {
      const fromSession = sessionStorage.getItem(API_SECRET_STORAGE_KEY);
      if (fromSession && fromSession.trim()) return fromSession.trim();
      const fromLocal = localStorage.getItem(API_SECRET_STORAGE_KEY);
      if (fromLocal && fromLocal.trim()) return fromLocal.trim();
    } catch {
      /* ignore */
    }
    return "";
  }

  function setApiSecret(secret) {
    const value = secret && String(secret).trim() ? String(secret).trim() : "";
    try {
      if (value) {
        sessionStorage.setItem(API_SECRET_STORAGE_KEY, value);
        localStorage.setItem(API_SECRET_STORAGE_KEY, value);
      } else {
        sessionStorage.removeItem(API_SECRET_STORAGE_KEY);
        localStorage.removeItem(API_SECRET_STORAGE_KEY);
      }
    } catch (err) {
      console.warn("Could not store API secret", err);
    }
  }

  function consumeApiKeyFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search);
      const key = params.get(URL_KEY_PARAM);
      if (!key || !key.trim()) return false;
      setApiSecret(key.trim());
      params.delete(URL_KEY_PARAM);
      const nextQuery = params.toString();
      const nextUrl =
        window.location.pathname +
        (nextQuery ? "?" + nextQuery : "") +
        window.location.hash;
      window.history.replaceState({}, "", nextUrl);
      return true;
    } catch {
      return false;
    }
  }

  function readLocalPayload() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (err) {
      console.warn("Failed to read local storage cache", err);
      return null;
    }
  }

  function writeLocalCache(payload) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.warn("Failed to write local storage cache", err);
    }
  }

  function isEmptyPayload(payload) {
    if (!payload || typeof payload !== "object") return true;
    if (!Array.isArray(payload.profiles)) return true;
    return payload.profiles.length === 0;
  }

  function buildAuthHeaders() {
    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json"
    };
    const secret = getApiSecret();
    if (secret) {
      headers.Authorization = "Bearer " + secret;
    }
    return headers;
  }

  async function parseJsonResponse(res) {
    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    const text = await res.text();
    if (contentType.indexOf("text/html") >= 0 || /^\s*</.test(text)) {
      const err = new Error(
        "Cloud API returned HTML instead of JSON. Check Vercel deploy includes /api routes (not only static files)."
      );
      err.code = "INVALID_API_RESPONSE";
      throw err;
    }
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      const err = new Error("Cloud API returned invalid JSON.");
      err.code = "INVALID_API_RESPONSE";
      throw err;
    }
  }

  async function fetchCloudConfig() {
    if (isLocalFileOrigin()) return { config: null, apiIssue: null };

    const endpoints = ["/api/config", "/api/health"];
    let configError = null;
    let apiIssue = null;

    for (let i = 0; i < endpoints.length; i++) {
      try {
        const res = await fetch(endpoints[i], {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store"
        });
        if (res.status === 401) {
          apiIssue = "vercel_protection";
          configError = new Error(
            "Vercel Deployment Protection is blocking /api (HTTP 401). Disable it for Production in Vercel → Settings → Deployment Protection."
          );
          continue;
        }
        if (!res.ok) {
          configError = new Error("Cloud config HTTP " + res.status);
          continue;
        }
        const data = await parseJsonResponse(res);
        if (data && data.storage === "mongodb") {
          cloudConfig = data;
          return { config: data, apiIssue: null };
        }
        if (data && data.storage === "unavailable") {
          configError = new Error("MongoDB is not configured on the server (MONGODB_URI).");
          apiIssue = "mongodb_not_configured";
        }
      } catch (err) {
        configError = err;
        if (err && err.code === "INVALID_API_RESPONSE") {
          apiIssue = "html_response";
        }
      }
    }

    if (configError) {
      lastError = configError.message || String(configError);
      console.warn("Cloud config unavailable", configError);
    }
    return { config: null, apiIssue: apiIssue || (configError ? "unavailable" : null) };
  }

  async function fetchRemoteState() {
    const res = await fetch("/api/state", {
      method: "GET",
      headers: buildAuthHeaders(),
      cache: "no-store"
    });
    const body = await parseJsonResponse(res);
    if (res.status === 401) {
      const err = new Error(body.error || "Unauthorized");
      err.code = "UNAUTHORIZED";
      throw err;
    }
    if (!res.ok) {
      throw new Error(body.error || "Failed to load cloud workspace");
    }
    return body;
  }

  async function putRemoteState(payload) {
    const bodyJson = JSON.stringify({ payload });
    const headers = buildAuthHeaders();
    let res = await fetch("/api/state", {
      method: "PUT",
      headers,
      body: bodyJson
    });

    if (res.status === 405 || res.status === 501) {
      res = await fetch("/api/state", {
        method: "POST",
        headers,
        body: bodyJson
      });
    }

    const body = await parseJsonResponse(res);
    if (res.status === 401) {
      const err = new Error(body.error || "Unauthorized");
      err.code = "UNAUTHORIZED";
      throw err;
    }
    if (!res.ok) {
      throw new Error(body.error || "Failed to save cloud workspace");
    }
    return body;
  }

  async function saveRemoteNow(payload) {
    setSyncStatus("syncing");
    try {
      const result = await putRemoteState(payload);
      lastSyncedAt = (result && result.updatedAt) || new Date().toISOString();
      setSyncStatus("synced");
      return true;
    } catch (err) {
      console.error("Cloud save failed", err);
      if (err && err.code === "UNAUTHORIZED") {
        mode = "mongodb-pending-auth";
      }
      setSyncStatus("error", err.message || String(err));
      return false;
    }
  }

  function scheduleRemoteSave(payload) {
    pendingPayload = payload;
    writeLocalCache(payload);
    if (mode !== "mongodb") return;

    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      const toSave = pendingPayload;
      pendingPayload = null;
      if (!toSave) return;
      inFlightSave = saveRemoteNow(toSave).finally(() => {
        inFlightSave = null;
      });
    }, 400);
  }

  async function flushPendingSave() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    const payload = pendingPayload;
    pendingPayload = null;
    if (mode !== "mongodb" || !payload) return;

    try {
      await fetch("/api/state", {
        method: "PUT",
        headers: buildAuthHeaders(),
        body: JSON.stringify({ payload }),
        keepalive: true
      });
      lastSyncedAt = new Date().toISOString();
      setSyncStatus("synced");
    } catch (err) {
      console.warn("Flush save on unload failed", err);
    }
  }

  async function migrateLocalToRemote(localPayload) {
    if (!localPayload || isEmptyPayload(localPayload)) return false;
    setSyncStatus("syncing");
    try {
      await putRemoteState(localPayload);
      lastSyncedAt = new Date().toISOString();
      setSyncStatus("synced");
      return true;
    } catch (err) {
      console.error("Migration to cloud failed", err);
      setSyncStatus("error", err.message || String(err));
      return false;
    }
  }

  function applyPayload(payload) {
    if (typeof applyPayloadFn === "function" && payload) {
      applyPayloadFn(payload);
    }
  }

  function canUseCloudWithoutClientSecret(config) {
    return config && config.storage === "mongodb" && config.authRequired === false;
  }

  function needsClientSecret(config) {
    return config && config.storage === "mongodb" && config.authRequired === true;
  }

  async function loadFromCloud() {
    const remote = await fetchRemoteState();
    const remotePayload = remote && remote.payload ? remote.payload : null;
    const localPayload = readLocalPayload();

    if (!isEmptyPayload(remotePayload)) {
      applyPayload(remotePayload);
      writeLocalCache(remotePayload);
      lastSyncedAt = remote.updatedAt || null;
      setSyncStatus("synced");
      return { migrated: false };
    }

    if (!isEmptyPayload(localPayload)) {
      applyPayload(localPayload);
      const migrated = await migrateLocalToRemote(localPayload);
      return { migrated };
    }

    setSyncStatus("synced");
    return { migrated: false };
  }

  async function bootstrap(options) {
    applyPayloadFn = options && options.apply;
    serializePayloadFn = options && options.serialize;
    onStatusChangeFn = options && options.onStatusChange;

    consumeApiKeyFromUrl();

    if (isLocalFileOrigin()) {
      mode = "local";
      applyPayload(readLocalPayload());
      setSyncStatus("offline");
      return { mode, migrated: false };
    }

    const configResult = await fetchCloudConfig();
    const config = configResult && configResult.config ? configResult.config : null;
    const apiIssue = configResult && configResult.apiIssue ? configResult.apiIssue : null;

    if (!config || config.storage !== "mongodb") {
      mode = "local";
      applyPayload(readLocalPayload());
      setSyncStatus("idle", lastError || null);
      return { mode, migrated: false, apiIssue };
    }

    if (needsClientSecret(config) && !getApiSecret()) {
      mode = "mongodb-pending-auth";
      applyPayload(readLocalPayload());
      setSyncStatus("error", "Set PM_API_SECRET on Vercel, then connect via Cloud menu.");
      return { mode, migrated: false, needsAuth: true, apiIssue: null };
    }

    mode = "mongodb";
    let migrated = false;

    try {
      const result = await loadFromCloud();
      migrated = result.migrated;
    } catch (err) {
      console.error("Cloud load failed; using local cache", err);
      if (err && err.code === "UNAUTHORIZED") {
        mode = "mongodb-pending-auth";
        setSyncStatus("error", "Invalid API key. Open Cloud and enter PM_API_SECRET.");
      } else {
        mode = "local";
        setSyncStatus("offline", err.message || String(err));
      }
      applyPayload(readLocalPayload());
    }

    window.addEventListener("beforeunload", flushPendingSave);
    notifyStatus();
    return {
      mode,
      migrated,
      needsAuth: mode === "mongodb-pending-auth",
      apiIssue: null
    };
  }

  function persistState(payload) {
    if (!payload) return;

    writeLocalCache(payload);

    if (mode === "mongodb") {
      scheduleRemoteSave(payload);
      return;
    }

    if (mode === "mongodb-pending-auth") {
      setSyncStatus("error", "Connect cloud storage to sync changes.");
    }
  }

  async function connectWithApiSecret(secret) {
    if (secret && String(secret).trim()) {
      setApiSecret(secret);
    }
    const configResult = await fetchCloudConfig();
    const config = configResult && configResult.config ? configResult.config : null;
    if (!config || config.storage !== "mongodb") {
      if (configResult && configResult.apiIssue === "html_response") {
        throw new Error(
          "This URL is not running the PM Prioritization Tool API (got HTML). Re-link the Vercel project to github.com/RifqiMT/pm-prioritization-tool."
        );
      }
      throw new Error(
        "Cloud storage is not available. Confirm MONGODB_URI is set on Vercel and redeploy."
      );
    }
    if (needsClientSecret(config) && !getApiSecret()) {
      throw new Error("API key is required for this deployment.");
    }

    mode = "mongodb";
    await loadFromCloud();

    const serialized =
      typeof serializePayloadFn === "function" ? serializePayloadFn() : null;
    if (serialized) {
      await saveRemoteNow(serialized);
      writeLocalCache(serialized);
    }

    setSyncStatus("synced");
    return { ok: true };
  }

  async function forceSyncNow() {
    if (mode !== "mongodb" && cloudConfig && cloudConfig.storage === "mongodb") {
      mode = "mongodb";
    }
    if (mode !== "mongodb") {
      throw new Error("Cloud storage is not active.");
    }
    const serialized =
      typeof serializePayloadFn === "function" ? serializePayloadFn() : pendingPayload;
    if (!serialized) {
      throw new Error("Nothing to sync.");
    }
    return saveRemoteNow(serialized);
  }

  function getMode() {
    return mode;
  }

  function getStatus() {
    return { mode, syncStatus, lastError, lastSyncedAt, cloudConfig };
  }

  function isCloudActive() {
    return mode === "mongodb";
  }

  return {
    bootstrap,
    persistState,
    connectWithApiSecret,
    forceSyncNow,
    flushPendingSave,
    getMode,
    getStatus,
    isCloudActive,
    getApiSecret,
    setApiSecret
  };
})();
