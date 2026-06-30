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
  let getProfileCountFn = null;
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

  function isLocalDevOrigin() {
    const host = (window.location.hostname || "").toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  }

  function isOfflineDevOrigin() {
    return isLocalFileOrigin() || isLocalDevOrigin();
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

  function writeLocalMeta(patch) {
    try {
      const prev = readLocalMeta();
      localStorage.setItem(
        LOCAL_META_KEY,
        JSON.stringify(Object.assign({}, prev, patch || {}))
      );
    } catch (err) {
      console.warn("Failed to write local storage meta", err);
    }
  }

  function markRemoteApplied(iso) {
    const at = iso || new Date().toISOString();
    lastAppliedRemoteAt = at;
    writeLocalMeta({ lastRemoteAppliedAt: at, updatedAt: at, source: "remote" });
  }

  function markLocalModified(iso) {
    const at = iso || new Date().toISOString();
    writeLocalMeta({ lastLocalModifiedAt: at, updatedAt: at, source: "local" });
  }

  function countProfiles(payload) {
    if (!payload || !Array.isArray(payload.profiles)) return 0;
    return payload.profiles.length;
  }

  function countRoadmaps(payload) {
    if (!payload || !Array.isArray(payload.profiles)) return 0;
    return payload.profiles.reduce((total, profile) => {
      const len = profile && Array.isArray(profile.roadmaps) ? profile.roadmaps.length : 0;
      return total + len;
    }, 0);
  }

  function readLocalPayload() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const payload = JSON.parse(raw);
      if (typeof stripLegacyWorkspaceFields === "function" && stripLegacyWorkspaceFields(payload)) {
        writeLocalCache(payload);
      }
      return payload;
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
    if (typeof stripLegacyWorkspaceFields === "function") {
      stripLegacyWorkspaceFields(stamped);
    }
    stamped._storageMeta = {
      updatedAt: new Date().toISOString(),
      clientId: getClientId()
    };
    return stamped;
  }

  /**
   * Pick workspace on load. MongoDB document time is authoritative; richer cloud
   * workspaces always beat smaller stale local caches (common on new devices).
   */
  function resolvePayloadForLoad(remoteBody, localPayload) {
    const remotePayload =
      remoteBody && remoteBody.payload ? remoteBody.payload : null;
    const remoteDocAt = remoteBody && remoteBody.updatedAt ? remoteBody.updatedAt : null;
    const remoteAt = getPayloadUpdatedAtMs(remotePayload, remoteDocAt);
    const remoteDocMs = remoteDocAt ? Date.parse(remoteDocAt) || remoteAt : remoteAt;
    const localMeta = readLocalMeta();
    const lastLocalMs = localMeta.lastLocalModifiedAt
      ? Date.parse(localMeta.lastLocalModifiedAt) || 0
      : getPayloadUpdatedAtMs(localPayload, null);
    const lastRemoteMs = localMeta.lastRemoteAppliedAt
      ? Date.parse(localMeta.lastRemoteAppliedAt) || 0
      : 0;
    const remoteCount = countProfiles(remotePayload);
    const localCount = countProfiles(localPayload);
    const remoteRoadmaps = countRoadmaps(remotePayload);
    const localRoadmaps = countRoadmaps(localPayload);

    const remoteEmpty = isEmptyPayload(remotePayload);
    const localEmpty = isEmptyPayload(localPayload);

    if (!remoteEmpty) {
      remoteWorkspaceHadData = true;
    }

    if (!remoteEmpty && !localEmpty) {
      if (localRoadmaps > remoteRoadmaps) {
        return {
          payload: localPayload,
          source: "local",
          pushToCloud: true,
          remoteUpdatedAt: remoteDocAt
        };
      }
      if (remoteRoadmaps > localRoadmaps && remoteCount >= localCount) {
        return {
          payload: remotePayload,
          source: "remote",
          pushToCloud: false,
          remoteUpdatedAt: remoteDocAt || null
        };
      }
      if (remoteCount > localCount) {
        return {
          payload: remotePayload,
          source: "remote",
          pushToCloud: false,
          remoteUpdatedAt: remoteDocAt || null
        };
      }
      if (localCount > remoteCount && lastLocalMs > remoteDocMs) {
        return {
          payload: localPayload,
          source: "local",
          pushToCloud: true,
          remoteUpdatedAt: remoteDocAt
        };
      }
      if (!lastRemoteMs || remoteDocMs >= lastRemoteMs) {
        return {
          payload: remotePayload,
          source: "remote",
          pushToCloud: false,
          remoteUpdatedAt: remoteDocAt || null
        };
      }
      if (lastLocalMs > remoteDocMs && lastLocalMs > lastRemoteMs) {
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
    if (payload && typeof stripLegacyWorkspaceFields === "function") {
      stripLegacyWorkspaceFields(payload);
    }
    applyPayload(payload);
    writeLocalCache(payload);
    lastLoadSource = source;
    if (source === "remote") {
      const appliedAt =
        remoteUpdatedAt ||
        (payload && payload._storageMeta && payload._storageMeta.updatedAt) ||
        new Date().toISOString();
      lastSyncedAt = appliedAt;
      markRemoteApplied(appliedAt);
    } else if (payload && source === "local") {
      markLocalModified(
        getPayloadUpdatedAtMs(payload, null)
          ? new Date(getPayloadUpdatedAtMs(payload, null)).toISOString()
          : new Date().toISOString()
      );
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
    if (isOfflineDevOrigin()) return { config: null, apiIssue: null };

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
      markRemoteApplied(lastSyncedAt);
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

  function scheduleRemoteSave(payload, options) {
    const stamped = stampPayload(payload);
    pendingPayload = stamped;
    writeLocalCache(stamped);
    markLocalModified(stamped._storageMeta.updatedAt);
    if (mode === "mongodb-pending-auth") {
      setSyncStatus("error", "Connect cloud storage to sync changes.");
      return Promise.resolve(false);
    }
    if (mode !== "mongodb") return Promise.resolve(true);

    const flushNow = options && options.flush === true;
    if (flushNow) {
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      inFlightSave = saveRemoteNow(stamped).finally(() => {
        inFlightSave = null;
        pendingPayload = null;
      });
      return inFlightSave;
    }

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
    return Promise.resolve(true);
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
    if (typeof stripLegacyWorkspaceFields === "function") {
      stripLegacyWorkspaceFields(localPayload);
    }
    setSyncStatus("syncing");
    try {
      await putRemoteState(localPayload);
      lastSyncedAt = new Date().toISOString();
      markRemoteApplied(lastSyncedAt);
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

  /** If cloud has more profiles than this tab, apply cloud (fixes stale local cache). */
  async function reconcileWithRemoteAfterLoad() {
    if (mode !== "mongodb") return { reconciled: false };
    try {
      const remote = await fetchRemoteState();
      const remoteCount = countProfiles(remote.payload);
      const localCount =
        typeof getProfileCountFn === "function" ? getProfileCountFn() : countProfiles(readLocalPayload());
      const remoteRoadmaps = countRoadmaps(remote.payload);
      const localPayload = readLocalPayload();
      const localRoadmaps = countRoadmaps(localPayload);
      if (
        (remoteCount > localCount || remoteRoadmaps > localRoadmaps) &&
        !isEmptyPayload(remote.payload)
      ) {
        commitLoadedPayload(remote.payload, "remote", remote.updatedAt || null);
        notifyCloudDataRefreshed({
          profileCount: remoteCount,
          source: "reconcile"
        });
        return { reconciled: true, remoteCount, localCount };
      }
      return { reconciled: false, remoteCount, localCount };
    } catch (err) {
      console.warn("Cloud reconcile failed", err);
      return { reconciled: false, error: err.message || String(err) };
    }
  }

  async function getCloudDiagnostics() {
    const deviceCount =
      typeof getProfileCountFn === "function" ? getProfileCountFn() : countProfiles(readLocalPayload());
    const status = getStatus();
    let cloudCount = null;
    let cloudUpdatedAt = null;
    let cloudError = null;
    try {
      if (mode === "mongodb" || (cloudConfig && cloudConfig.storage === "mongodb")) {
        const remote = await fetchRemoteState();
        cloudCount = countProfiles(remote.payload);
        cloudUpdatedAt = remote.updatedAt || null;
      }
    } catch (err) {
      cloudError = err.message || String(err);
    }
    return {
      mode: status.mode,
      syncStatus: status.syncStatus,
      deviceProfileCount: deviceCount,
      cloudProfileCount: cloudCount,
      cloudUpdatedAt,
      cloudError,
      hostname: window.location.hostname,
      href: window.location.href
    };
  }

  function hasUnsyncedLocalChanges(remoteAt) {
    const localMeta = readLocalMeta();
    const lastLocalMs = localMeta.lastLocalModifiedAt
      ? Date.parse(localMeta.lastLocalModifiedAt) || 0
      : 0;
    const lastRemoteMs = lastAppliedRemoteAt ? Date.parse(lastAppliedRemoteAt) || 0 : 0;
    if (pendingPayload || saveTimer) return true;
    if (!lastLocalMs) return false;
    if (lastLocalMs > lastRemoteMs) return true;
    if (remoteAt && lastLocalMs > remoteAt) return true;
    return false;
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

      if (!force && hasUnsyncedLocalChanges(remoteAt)) {
        return { updated: false, reason: "local_pending" };
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
    getProfileCountFn = options && options.getProfileCount;
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
      const reconcile = await reconcileWithRemoteAfterLoad();
      if (reconcile && reconcile.reconciled) {
        loadSource = "remote";
      }
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

  function persistState(payload, options) {
    if (!payload) return;
    return scheduleRemoteSave(payload, options);
  }

  async function flushPersistState() {
    await flushPendingSave();
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
          "This URL is not running the PM Prioritization Tool API (got HTML). Re-link the Vercel roadmap to github.com/RifqiMT/pm-prioritization-tool."
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
    getCloudDiagnostics,
    getStatus,
    isCloudActive,
    shouldSeedDefaultProfile,
    isOfflineDevOrigin,
    getApiSecret
  };
})();
