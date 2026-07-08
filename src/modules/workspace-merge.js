/**
 * Merge workspace payloads for concurrent multi-user editing.
 * - Union profiles/roadmaps by id (and dedupe profiles by normalized name)
 * - Newer modifiedAt wins for the same entity
 * - Tombstones propagate deletions across sessions
 */
const WorkspaceMerge = (function () {
  const PERSISTED_UI_KEYS =
    typeof WORKSPACE_PERSISTED_STATE_KEYS !== "undefined" && Array.isArray(WORKSPACE_PERSISTED_STATE_KEYS)
      ? WORKSPACE_PERSISTED_STATE_KEYS
      : [
          "activeProfileId",
          "sortField",
          "sortDirection",
          "roadmapsView",
          "tableSortByRice",
          "tableGroupBy",
          "scrumBoardSortByRice",
          "scrumBoardVisibleStatuses",
          "moscowSortByRice",
          "mapMetric",
          "raciMatrixDomain",
          "kanoPortfolioPanel",
          "ganttZoom",
          "exchangeRatesToEUR",
          "exchangeRatesDate",
          "exchangeRatesLastSource",
          "superAdminMode"
        ];

  function getEntityModifiedMs(entity) {
    if (!entity || typeof entity !== "object") return 0;
    const candidates = [entity.modifiedAt, entity.updatedAt, entity.createdAt];
    for (let i = 0; i < candidates.length; i++) {
      if (!candidates[i]) continue;
      const parsed = Date.parse(candidates[i]);
      if (!Number.isNaN(parsed)) return parsed;
    }
    return 0;
  }

  function getPayloadUpdatedAtMs(payload) {
    if (!payload || typeof payload !== "object") return 0;
    const meta =
      payload._storageMeta && typeof payload._storageMeta === "object" ? payload._storageMeta : null;
    if (meta && meta.updatedAt) {
      const parsed = Date.parse(meta.updatedAt);
      if (!Number.isNaN(parsed)) return parsed;
    }
    return 0;
  }

  function pickNewerEntity(a, b) {
    if (!a) return b || null;
    if (!b) return a || null;
    return getEntityModifiedMs(a) >= getEntityModifiedMs(b) ? a : b;
  }

  function normalizeProfileName(name) {
    return String(name || "")
      .trim()
      .toLowerCase();
  }

  function getTombstones(payload) {
    if (!payload || typeof payload !== "object") {
      return { profiles: {}, roadmaps: {} };
    }
    const raw = payload.workspaceTombstones;
    if (!raw || typeof raw !== "object") {
      return { profiles: {}, roadmaps: {} };
    }
    return {
      profiles: raw.profiles && typeof raw.profiles === "object" ? raw.profiles : {},
      roadmaps: raw.roadmaps && typeof raw.roadmaps === "object" ? raw.roadmaps : {}
    };
  }

  function mergeTombstones(localPayload, remotePayload) {
    const local = getTombstones(localPayload);
    const remote = getTombstones(remotePayload);
    const merged = { profiles: {}, roadmaps: {} };

    ["profiles", "roadmaps"].forEach((kind) => {
      const keys = new Set([
        ...Object.keys(local[kind] || {}),
        ...Object.keys(remote[kind] || {})
      ]);
      keys.forEach((id) => {
        const localAt = local[kind][id] ? Date.parse(local[kind][id]) : 0;
        const remoteAt = remote[kind][id] ? Date.parse(remote[kind][id]) : 0;
        if (!localAt && !remoteAt) return;
        merged[kind][id] =
          localAt >= remoteAt ? local[kind][id] : remote[kind][id];
      });
    });

    return merged;
  }

  function isTombstoned(tombstones, kind, id, entity) {
    if (!id || !tombstones || !tombstones[kind]) return false;
    const deletedAt = tombstones[kind][id];
    if (!deletedAt) return false;
    const deletedMs = Date.parse(deletedAt);
    if (Number.isNaN(deletedMs)) return true;
    const entityMs = getEntityModifiedMs(entity);
    return !entityMs || entityMs <= deletedMs;
  }

  function mergeOrderMaps(preferred, fallback) {
    const a = preferred && typeof preferred === "object" ? preferred : {};
    const b = fallback && typeof fallback === "object" ? fallback : {};
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    const out = {};
    keys.forEach((key) => {
      const listA = Array.isArray(a[key]) ? a[key] : [];
      const listB = Array.isArray(b[key]) ? b[key] : [];
      const seen = new Set();
      const merged = [];
      listA.concat(listB).forEach((id) => {
        const val = String(id || "").trim();
        if (!val || seen.has(val)) return;
        seen.add(val);
        merged.push(val);
      });
      if (merged.length) out[key] = merged;
    });
    return out;
  }

  function mergeSingleProfile(profileA, profileB) {
    const newer = pickNewerEntity(profileA, profileB);
    const older = newer === profileA ? profileB : profileA;
    const merged = Object.assign({}, newer);
    merged.roadmaps = mergeRoadmaps(profileA && profileA.roadmaps, profileB && profileB.roadmaps);
    merged.boardOrder = mergeOrderMaps(newer.boardOrder, older.boardOrder);
    merged.moscowOrder = mergeOrderMaps(newer.moscowOrder, older.moscowOrder);
    if (!merged.passwordHash && older && older.passwordHash) {
      merged.passwordSalt = older.passwordSalt;
      merged.passwordHash = older.passwordHash;
    }
    return merged;
  }

  function mergeRoadmaps(localRoadmaps, remoteRoadmaps) {
    const localList = Array.isArray(localRoadmaps) ? localRoadmaps : [];
    const remoteList = Array.isArray(remoteRoadmaps) ? remoteRoadmaps : [];
    const byId = new Map();

    function addRoadmap(roadmap) {
      if (!roadmap || typeof roadmap !== "object") return;
      const id = typeof roadmap.id === "string" && roadmap.id.trim() ? roadmap.id.trim() : "";
      if (!id) return;
      const existing = byId.get(id);
      byId.set(id, existing ? pickNewerEntity(existing, roadmap) : roadmap);
    }

    localList.forEach(addRoadmap);
    remoteList.forEach(addRoadmap);

    return Array.from(byId.values());
  }

  function mergeProfiles(localProfiles, remoteProfiles) {
    const localList = Array.isArray(localProfiles) ? localProfiles : [];
    const remoteList = Array.isArray(remoteProfiles) ? remoteProfiles : [];
    const byId = new Map();

    function ingest(profile) {
      if (!profile || typeof profile !== "object") return;
      const id = typeof profile.id === "string" && profile.id.trim() ? profile.id.trim() : "";
      if (!id) return;
      const existing = byId.get(id);
      byId.set(id, existing ? mergeSingleProfile(existing, profile) : Object.assign({}, profile));
    }

    localList.forEach(ingest);
    remoteList.forEach(ingest);

    const nameToIds = new Map();
    byId.forEach((profile, id) => {
      const nameKey = normalizeProfileName(profile.name);
      if (!nameKey) return;
      if (!nameToIds.has(nameKey)) nameToIds.set(nameKey, []);
      nameToIds.get(nameKey).push(id);
    });

    nameToIds.forEach((ids) => {
      if (ids.length <= 1) return;
      let canonical = byId.get(ids[0]);
      for (let i = 1; i < ids.length; i++) {
        const other = byId.get(ids[i]);
        if (!other) continue;
        canonical = mergeSingleProfile(canonical, other);
        byId.delete(ids[i]);
      }
      const canonicalId =
        typeof canonical.id === "string" && canonical.id.trim() ? canonical.id.trim() : ids[0];
      canonical.id = canonicalId;
      byId.set(canonicalId, canonical);
    });

    return Array.from(byId.values());
  }

  function applyTombstones(payload) {
    if (!payload || typeof payload !== "object") return payload;
    const tombstones = getTombstones(payload);
    const hasTombstones =
      Object.keys(tombstones.profiles).length > 0 || Object.keys(tombstones.roadmaps).length > 0;
    if (!hasTombstones) return payload;

    const next = Object.assign({}, payload);
    next.workspaceTombstones = tombstones;
    next.profiles = (Array.isArray(payload.profiles) ? payload.profiles : [])
      .filter((profile) => !isTombstoned(tombstones, "profiles", profile.id, profile))
      .map((profile) => {
        const copy = Object.assign({}, profile);
        copy.roadmaps = (Array.isArray(profile.roadmaps) ? profile.roadmaps : []).filter(
          (roadmap) => !isTombstoned(tombstones, "roadmaps", roadmap.id, roadmap)
        );
        return copy;
      });
    return next;
  }

  function mergeWorkspacePayloads(localPayload, remotePayload) {
    const local = localPayload && typeof localPayload === "object" ? localPayload : { profiles: [] };
    const remote = remotePayload && typeof remotePayload === "object" ? remotePayload : { profiles: [] };
    const tombstones = mergeTombstones(local, remote);

    const merged = {
      profiles: mergeProfiles(local.profiles, remote.profiles),
      workspaceTombstones: tombstones
    };

    const uiSource = getPayloadUpdatedAtMs(local) >= getPayloadUpdatedAtMs(remote) ? local : remote;
    PERSISTED_UI_KEYS.forEach((key) => {
      if (uiSource[key] !== undefined) merged[key] = uiSource[key];
    });

    const metaLocal = local._storageMeta;
    const metaRemote = remote._storageMeta;
    if (metaLocal || metaRemote) {
      const newerMeta = pickNewerEntity(
        metaLocal ? { updatedAt: metaLocal.updatedAt, clientId: metaLocal.clientId } : null,
        metaRemote ? { updatedAt: metaRemote.updatedAt, clientId: metaRemote.clientId } : null
      ) || { updatedAt: new Date().toISOString() };
      merged._storageMeta = {
        updatedAt: newerMeta.updatedAt || new Date().toISOString(),
        clientId: (metaLocal && metaLocal.clientId) || (metaRemote && metaRemote.clientId) || ""
      };
    }

    return applyTombstones(merged);
  }

  function countProfiles(payload) {
    return payload && Array.isArray(payload.profiles) ? payload.profiles.length : 0;
  }

  function countRoadmaps(payload) {
    if (!payload || !Array.isArray(payload.profiles)) return 0;
    return payload.profiles.reduce((total, profile) => {
      const len = profile && Array.isArray(profile.roadmaps) ? profile.roadmaps.length : 0;
      return total + len;
    }, 0);
  }

  function payloadsDiffer(a, b) {
    if (!a && !b) return false;
    if (!a || !b) return true;
    return (
      countProfiles(a) !== countProfiles(b) ||
      countRoadmaps(a) !== countRoadmaps(b) ||
      JSON.stringify(a) !== JSON.stringify(b)
    );
  }

  function recordTombstone(payload, kind, id, deletedAt) {
    if (!payload || typeof payload !== "object" || !id) return payload;
    const next = Object.assign({}, payload);
    const tombstones = getTombstones(next);
    const at = deletedAt || new Date().toISOString();
    if (kind === "profile") tombstones.profiles[id] = at;
    if (kind === "roadmap") tombstones.roadmaps[id] = at;
    next.workspaceTombstones = tombstones;
    return next;
  }

  return {
    mergeWorkspacePayloads,
    applyTombstones,
    recordTombstone,
    countProfiles,
    countRoadmaps,
    payloadsDiffer
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = WorkspaceMerge;
}
