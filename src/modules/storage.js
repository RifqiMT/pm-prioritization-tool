/**
 * Persistence layer: MongoDB (Vercel /api) when configured, else browser localStorage.
 * When remote is active, localStorage is used only as an offline cache.
 */
const AppStorage = (function () {
  const API_SECRET_STORAGE_KEY = "pm_cloud_api_secret_v1";
  const LOCAL_META_KEY = "pm_local_storage_meta_v1";
  const CLIENT_ID_KEY = "pm_storage_client_id_v1";
  const URL_KEY_PARAM = "pm_api_key";
  const SAVE_DEBOUNCE_MS = 250;
  const PULL_INTERVAL_MS = 45000;

  /** @type {"unknown"|"local"|"mongodb"|"mongodb-pending-auth"} */
  let mode = "unknown";
  /** @type {"idle"|"syncing"|"synced"|"error"|"offline"} */
  let syncStatus = "idle";
  let lastError = null;
  let lastSyncedAt = null;
  let lastAppliedRemoteAt = null;
  let remoteWorkspaceHadData = false;
  let lastLoadSource = null;
  let cloudConfig = null;
  let applyPayloadFn = null;
  let serializePayloadFn = null;
  let onStatusChangeFn = null;
  let onCloudDataRefreshedFn = null;

  let saveTimer = null;
  let pullTimer = null;
  let pendingPayload = null;
  let inFlightSave = null;
  let cloudListenersBound = false;

  function notifyStatus() {
    if (typeof onStatusChangeFn === "function") {
      onStatusChangeFn({
        mode,
        syncStatus,
        lastError,
        lastSyncedAt,
        lastAppliedRemoteAt,
        lastLoadSource,
        remoteWorkspaceHadData,
        cloudConfig
      });
    }
  }

  function setSyncStatus(next, error) {
    syncStatus = next;
    lastError = error || null;
    notifyStatus();
  }

  function getClientId() {
    try {
      let id = localStorage.getItem(CLIENT_ID_KEY);
      if (!id) {
        id =
          "pm_" +
          Date.now().toString(36) +
          "_" +
          Math.random().toString(36).slice(2, 10);
        localStorage.setItem(CLIENT_ID_KEY, id);
      }
      return id;
    } catch {
      return "pm_anonymous";
    }
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

  function readLocalMeta() {
    try {
      const raw = localStorage.getItem(LOCAL_META_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function writeLocalMeta(meta) {
    try {
      localStorage.setItem(LOCAL_META_KEY, JSON.stringify(meta));
    } catch (err) {
      console.warn("Failed to write local storage meta", err);
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

  function getPayloadUpdatedAtMs(payload, fallbackIso) {
    const meta =
      payload && payload._storageMeta && typeof payload._storageMeta === "object"
        ? payload._storageMeta
        : null;
    if (meta && meta.updatedAt) {
      const parsed = Date.parse(meta.updatedAt);
      if (!Number.isNaN(parsed)) return parsed;
    }
    if (fallbackIso) {
      const parsed = Date.parse(fallbackIso);
      if (!Number.isNaN(parsed)) return parsed;
    }
    return 0;
  }

  function stampPayload(payload) {
    if (!payload || typeof payload !== "object") return payload;
    const stamped = Object.assign({}, payload);
    stamped._storageMeta = {
      updatedAt: new Date().toISOString(),
      clientId: getClientId()
    };
    return stamped;
  }

  /**
   * Pick newer workspace on load: remote wins ties unless local is strictly newer.
   */
  function resolvePayloadForLoad(remoteBody, localPayload) {
    const remotePayload =
      remoteBody && remoteBody.payload ? remoteBody.payload : null;
    const remoteDocAt = remoteBody && remoteBody.updatedAt ? remoteBody.updatedAt : null;
    const remoteAt = getPayloadUpdatedAtMs(remotePayload, remoteDocAt);
    const localMeta = readLocalMeta();
    const localAt = Math.max(
      getPayloadUpdatedAtMs(localPayload, null),
      localMeta.updatedAt ? Date.parse(localMeta.updatedAt) || 0 : 0
    );

    const remoteEmpty = isEmptyPayload(remotePayload);
    const localEmpty = isEmptyPayload(localPayload);

    if (!remoteEmpty && remoteWorkspaceHadData !== false) {
      remoteWorkspaceHadData = true;
    }

    if (!remoteEmpty && !localEmpty) {
      if (localAt > remoteAt) {
        return {
          payload: localPayload,
          source: "local",
          pushToCloud: true,
          remoteUpdatedAt: remoteDocAt
        };
      }
      return {
        payload: remotePayload,
        source: "remote",
        pushToCloud: false,
        remoteUpdatedAt: remoteDocAt || null
      };
    }

    if (!remoteEmpty) {
      return {
        payload: remotePayload,
        source: "remote",
        pushToCloud: false,
        remoteUpdatedAt: remoteDocAt || null
      };
    }

    if (!localEmpty) {
      return {
        payload: localPayload,
        source: "local",
        pushToCloud: true,
        remoteUpdatedAt: null
      };
    }

    return { payload: null, source: "none", pushToCloud: false, remoteUpdatedAt: null };
  }

  function commitLoadedPayload(payload, source, remoteUpdatedAt) {
    applyPayload(payload);
    writeLocalCache(payload);
    lastLoadSource = source;
    const appliedAt =
      source === "remote"
        ? remoteUpdatedAt || getPayloadUpdatedAtMs(payload, null)
        : new Date().toISOString();
    if (source === "remote" && appliedAt) {
      lastAppliedRemoteAt = appliedAt;
      lastSyncedAt = appliedAt;
      writeLocalMeta({ updatedAt: appliedAt, source: "remote" });
    } else if (payload) {
      const localAt = getPayloadUpdatedAtMs(payload, null) || Date.now();
      writeLocalMeta({
        updatedAt: new Date(localAt).toISOString(),
        source: source || "local"
      });
    }
    setSyncStatus("synced");
  }

  function notifyCloudDataRefreshed(extra) {
    if (typeof onCloudDataRefreshedFn === "function") {
      onCloudDataRefreshedFn(extra || {});
    }
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
    if (body && body.payload && !isEmptyPayload(body.payload)) {
      remoteWorkspaceHadData = true;
    }
    return body;
  }

  async function putRemoteState(payload) {
    const stamped = stampPayload(payload);
    const bodyJson = JSON.stringify({ payload: stamped });
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
      const stamped = stampPayload(payload);
      writeLocalCache(stamped);
      const result = await putRemoteState(stamped);
      lastSyncedAt = (result && result.updatedAt) || new Date().toISOString();
      lastAppliedRemoteAt = lastSyncedAt;
      writeLocalMeta({ updatedAt: lastSyncedAt, source: "remote" });
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
    const stamped = stampPayload(payload);
    pendingPayload = stamped;
    writeLocalCache(stamped);
    writeLocalMeta({
      updatedAt: stamped._storageMeta.updatedAt,
      source: "local"
    });
    if (mode === "mongodb-pending-auth") {
      setSyncStatus("error", "Connect cloud storage to sync changes.");
      return;
    }
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
    }, SAVE_DEBOUNCE_MS);
  }

  async function flushPendingSave() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    const payload = pendingPayload;
    pendingPayload = null;
    if (mode !== "mongodb" || !payload) return;

    if (inFlightSave) {
      try {
        await inFlightSave;
      } catch {
        /* saveRemoteNow already logged */
      }
      return;
    }

    try {
      await saveRemoteNow(payload);
    } catch (err) {
      try {
        await fetch("/api/state", {
          method: "PUT",
          headers: buildAuthHeaders(),
          body: JSON.stringify({ payload: stampPayload(payload) }),
          keepalive: true
        });
        lastSyncedAt = new Date().toISOString();
        setSyncStatus("synced");
      } catch (flushErr) {
        console.warn("Flush save on unload failed", flushErr || err);
      }
    }
  }

  async function migrateLocalToRemote(localPayload) {
    if (!localPayload || isEmptyPayload(localPayload)) return false;
    setSyncStatus("syncing");
    try {
      await putRemoteState(localPayload);
      lastSyncedAt = new Date().toISOString();
      lastAppliedRemoteAt = lastSyncedAt;
      writeLocalMeta({ updatedAt: lastSyncedAt, source: "remote" });
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
    const localPayload = readLocalPayload();
    const resolved = resolvePayloadForLoad(remote, localPayload);

    if (resolved.payload) {
      commitLoadedPayload(
        resolved.payload,
        resolved.source,
        resolved.remoteUpdatedAt
      );
      if (resolved.pushToCloud) {
        const migrated = await migrateLocalToRemote(resolved.payload);
        return { migrated, source: resolved.source };
      }
      return { migrated: false, source: resolved.source };
    }

    setSyncStatus("synced");
    return { migrated: false, source: "none" };
  }

  async function pullFromCloudIfNewer(options) {
    if (mode !== "mongodb") {
      return { updated: false, reason: "not_cloud" };
    }
    try {
      const remote = await fetchRemoteState();
      const remoteAt = remote.updatedAt
        ? Date.parse(remote.updatedAt)
        : getPayloadUpdatedAtMs(remote.payload, null);
      const lastAt = lastAppliedRemoteAt
        ? Date.parse(lastAppliedRemoteAt)
        : 0;
      const force = options && options.force === true;

      if (isEmptyPayload(remote.payload)) {
        return { updated: false, reason: "remote_empty" };
      }

      if (!force && remoteAt && lastAt && remoteAt <= lastAt) {
        return { updated: false, reason: "already_current" };
      }

      commitLoadedPayload(remote.payload, "remote", remote.updatedAt || null);
      notifyCloudDataRefreshed({
        profileCount: remote.payload.profiles.length,
        source: "pull"
      });
      return {
        updated: true,
        profileCount: remote.payload.profiles.length,
        updatedAt: remote.updatedAt
      };
    } catch (err) {
      console.warn("Cloud pull failed", err);
      return { updated: false, reason: "error", error: err.message || String(err) };
    }
  }

  function setupCloudLifecycle() {
    if (cloudListenersBound) return;
    cloudListenersBound = true;

    window.addEventListener("beforeunload", flushPendingSave);
    window.addEventListener("pagehide", flushPendingSave);

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        flushPendingSave();
        return;
      }
      if (document.visibilityState === "visible") {
        pullFromCloudIfNewer().then((result) => {
          if (result && result.updated) {
            notifyCloudDataRefreshed(result);
          }
        });
      }
    });

    window.addEventListener("focus", () => {
      pullFromCloudIfNewer().then((result) => {
        if (result && result.updated) {
          notifyCloudDataRefreshed(result);
        }
      });
    });

    if (pullTimer) clearInterval(pullTimer);
    pullTimer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      pullFromCloudIfNewer();
    }, PULL_INTERVAL_MS);
  }

  async function bootstrap(options) {
    applyPayloadFn = options && options.apply;
    serializePayloadFn = options && options.serialize;
    onStatusChangeFn = options && options.onStatusChange;
    onCloudDataRefreshedFn = options && options.onCloudDataRefreshed;

    consumeApiKeyFromUrl();

    if (isLocalFileOrigin()) {
      mode = "local";
      applyPayload(readLocalPayload());
      setSyncStatus("offline");
      return { mode, migrated: false, loadSource: "local" };
    }

    const configResult = await fetchCloudConfig();
    const config = configResult && configResult.config ? configResult.config : null;
    const apiIssue = configResult && configResult.apiIssue ? configResult.apiIssue : null;

    if (!config || config.storage !== "mongodb") {
      mode = "local";
      applyPayload(readLocalPayload());
      setSyncStatus("idle", lastError || null);
      return { mode, migrated: false, apiIssue, loadSource: "local" };
    }

    if (needsClientSecret(config) && !getApiSecret()) {
      mode = "mongodb-pending-auth";
      applyPayload(readLocalPayload());
      setSyncStatus("error", "Set PM_API_SECRET on Vercel, then connect via Cloud menu.");
      return { mode, migrated: false, needsAuth: true, apiIssue: null, loadSource: "local" };
    }

    mode = "mongodb";
    let migrated = false;
    let loadSource = "none";

    try {
      const result = await loadFromCloud();
      migrated = result.migrated;
      loadSource = result.source || "none";
      setupCloudLifecycle();
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
      loadSource = "local";
    }

    notifyStatus();
    return {
      mode,
      migrated,
      needsAuth: mode === "mongodb-pending-auth",
      apiIssue: null,
      loadSource,
      remoteWorkspaceHadData
    };
  }

  function persistState(payload) {
    if (!payload) return;
    scheduleRemoteSave(payload);
  }

  function shouldSeedDefaultProfile() {
    if (mode === "mongodb" && remoteWorkspaceHadData) {
      return false;
    }
    return true;
  }

  function isRemoteWorkspacePopulated() {
    return remoteWorkspaceHadData;
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
    setupCloudLifecycle();

    const serialized =
      typeof serializePayloadFn === "function" ? serializePayloadFn() : null;
    if (serialized) {
      await saveRemoteNow(serialized);
      writeLocalCache(stampPayload(serialized));
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
    await flushPendingSave();
    const serialized =
      typeof serializePayloadFn === "function" ? serializePayloadFn() : pendingPayload;
    if (!serialized) {
      throw new Error("Nothing to sync.");
    }
    const ok = await saveRemoteNow(serialized);
    if (!ok) {
      throw new Error(lastError || "Cloud sync failed.");
    }
    return true;
  }

  async function pullFromCloud(options) {
    if (mode !== "mongodb") {
      throw new Error("Cloud storage is not active on this device.");
    }
    const result = await pullFromCloudIfNewer(
      Object.assign({ force: true }, options || {})
    );
    if (!result.updated && result.reason === "error") {
      throw new Error(result.error || "Could not load workspace from cloud.");
    }
    return result;
  }

  function getMode() {
    return mode;
  }

  function getStatus() {
    return {
      mode,
      syncStatus,
      lastError,
      lastSyncedAt,
      lastAppliedRemoteAt,
      lastLoadSource,
      remoteWorkspaceHadData,
      cloudConfig
    };
  }

  function isCloudActive() {
    return mode === "mongodb";
  }

  return {
    bootstrap,
    persistState,
    connectWithApiSecret,
    forceSyncNow,
    pullFromCloud,
    pullFromCloudIfNewer,
    flushPendingSave,
    getMode,
    getStatus,
    isCloudActive,
    shouldSeedDefaultProfile,
    isRemoteWorkspacePopulated,
    getApiSecret,
    setApiSecret
  };
})();
