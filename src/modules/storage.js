/**
 * Persistence layer: MongoDB (Vercel /api) when configured, else browser localStorage.
 * When remote is active, localStorage is used only as an offline cache.
 */
const AppStorage = (function () {
  const API_SECRET_SESSION_KEY = "pm_cloud_api_secret_v1";
  const URL_KEY_PARAM = "pm_api_key";

  /** @type {"unknown"|"local"|"mongodb"|"mongodb-pending-auth"} */
  let mode = "unknown";
  /** @type {"idle"|"syncing"|"synced"|"error"|"offline"} */
  let syncStatus = "idle";
  let lastError = null;
  let lastSyncedAt = null;
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
        lastSyncedAt
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
      const fromSession = sessionStorage.getItem(API_SECRET_SESSION_KEY);
      if (fromSession && fromSession.trim()) return fromSession.trim();
    } catch {
      /* ignore */
    }
    return "";
  }

  function setApiSecret(secret) {
    const value = secret && String(secret).trim() ? String(secret).trim() : "";
    try {
      if (value) {
        sessionStorage.setItem(API_SECRET_SESSION_KEY, value);
      } else {
        sessionStorage.removeItem(API_SECRET_SESSION_KEY);
      }
    } catch (err) {
      console.warn("Could not store API secret in session", err);
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
    const headers = { "Content-Type": "application/json" };
    const secret = getApiSecret();
    if (secret) {
      headers.Authorization = "Bearer " + secret;
    }
    return headers;
  }

  async function fetchHealth() {
    if (isLocalFileOrigin()) return null;
    try {
      const res = await fetch("/api/health", {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store"
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  async function fetchRemoteState() {
    const res = await fetch("/api/state", {
      method: "GET",
      headers: buildAuthHeaders(),
      cache: "no-store"
    });
    if (res.status === 401) {
      const err = new Error("Unauthorized");
      err.code = "UNAUTHORIZED";
      throw err;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Failed to load cloud workspace");
    }
    return await res.json();
  }

  async function putRemoteState(payload) {
    const res = await fetch("/api/state", {
      method: "PUT",
      headers: buildAuthHeaders(),
      body: JSON.stringify({ payload })
    });
    if (res.status === 401) {
      const err = new Error("Unauthorized");
      err.code = "UNAUTHORIZED";
      throw err;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Failed to save cloud workspace");
    }
    return await res.json();
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
    }, 700);
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

    const health = await fetchHealth();
    if (!health || health.storage !== "mongodb") {
      mode = "local";
      applyPayload(readLocalPayload());
      setSyncStatus("idle");
      return { mode, migrated: false };
    }

    const authRequired = Boolean(health.authRequired);
    if (authRequired && !getApiSecret()) {
      mode = "mongodb-pending-auth";
      applyPayload(readLocalPayload());
      setSyncStatus("error", "Cloud storage requires an API key.");
      return { mode, migrated: false, needsAuth: true };
    }

    mode = "mongodb";
    let migrated = false;

    try {
      const remote = await fetchRemoteState();
      const remotePayload = remote && remote.payload ? remote.payload : null;
      const localPayload = readLocalPayload();

      if (!isEmptyPayload(remotePayload)) {
        applyPayload(remotePayload);
        writeLocalCache(remotePayload);
        lastSyncedAt = remote.updatedAt || null;
        setSyncStatus("synced");
      } else if (!isEmptyPayload(localPayload)) {
        applyPayload(localPayload);
        migrated = await migrateLocalToRemote(localPayload);
        if (migrated) writeLocalCache(localPayload);
      } else {
        setSyncStatus("synced");
      }
    } catch (err) {
      console.error("Cloud load failed; using local cache", err);
      if (err && err.code === "UNAUTHORIZED") {
        mode = "mongodb-pending-auth";
        setSyncStatus("error", "Invalid or missing API key.");
      } else {
        mode = "local";
        setSyncStatus("offline", err.message || String(err));
      }
      applyPayload(readLocalPayload());
    }

    window.addEventListener("beforeunload", flushPendingSave);
    notifyStatus();
    return { mode, migrated, needsAuth: mode === "mongodb-pending-auth" };
  }

  function persistState(payload) {
    if (!payload || typeof serializePayloadFn !== "function") {
      writeLocalCache(payload);
      return;
    }

    if (mode === "mongodb") {
      scheduleRemoteSave(payload);
      return;
    }

    writeLocalCache(payload);
    if (mode === "mongodb-pending-auth") {
      setSyncStatus("error", "Connect cloud storage to sync changes.");
    }
  }

  async function connectWithApiSecret(secret) {
    setApiSecret(secret);
    const health = await fetchHealth();
    if (!health || health.storage !== "mongodb") {
      throw new Error("Cloud storage is not available on this deployment.");
    }
    mode = "mongodb";
    const remote = await fetchRemoteState();
    const remotePayload = remote && remote.payload ? remote.payload : null;
    const localPayload = readLocalPayload();

    if (!isEmptyPayload(remotePayload)) {
      applyPayload(remotePayload);
      writeLocalCache(remotePayload);
    } else if (!isEmptyPayload(localPayload)) {
      applyPayload(localPayload);
      await migrateLocalToRemote(localPayload);
    }

    const serialized =
      typeof serializePayloadFn === "function" ? serializePayloadFn() : null;
    if (serialized) {
      await saveRemoteNow(serialized);
      writeLocalCache(serialized);
    }

    setSyncStatus("synced");
    return { ok: true };
  }

  function getMode() {
    return mode;
  }

  function getStatus() {
    return { mode, syncStatus, lastError, lastSyncedAt };
  }

  function isCloudActive() {
    return mode === "mongodb";
  }

  return {
    bootstrap,
    persistState,
    connectWithApiSecret,
    flushPendingSave,
    getMode,
    getStatus,
    isCloudActive,
    getApiSecret,
    setApiSecret
  };
})();
