/**
 * Merge workspace payloads for concurrent multi-user editing.
 * - Union profiles/roadmaps by id (dedupe profiles by normalized name)
 * - Dedupe roadmaps by content fingerprint; anchor survivor on roadmap id
 * - Dedupe profiles by normalized name; anchor survivor on profile id
 * - Newer modifiedAt wins for field data on the anchored entity
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

  function compareEntityIds(idA, idB) {
    return String(idA || "")
      .trim()
      .localeCompare(String(idB || "").trim());
  }

  /** Stable anchor id when several entities represent the same logical record. */
  function pickAnchorId(...ids) {
    const valid = ids.map((id) => String(id || "").trim()).filter(Boolean);
    if (!valid.length) return "";
    return valid.slice().sort(compareEntityIds)[0];
  }

  /** Merge entities onto the anchored id (newest field data, anchor id preserved). */
  function mergeEntitiesWithIdAnchor(entities) {
    if (!entities || !entities.length) return null;
    if (entities.length === 1) return entities[0];
    const anchorId = pickAnchorId(...entities.map((entity) => entity && entity.id));
    const anchorSeed = entities.find((entity) => entity && entity.id === anchorId) || entities[0];
    let merged = Object.assign({}, anchorSeed);
    entities.forEach((entity) => {
      if (!entity) return;
      const newer = pickNewerEntity(merged, entity);
      merged = Object.assign({}, newer, { id: anchorId });
    });
    return merged;
  }

  function normalizeScalar(value) {
    return String(value || "")
      .trim()
      .toLowerCase();
  }

  const EU_MEMBER_COUNTRIES_FALLBACK = [
    "austria",
    "belgium",
    "bulgaria",
    "croatia",
    "cyprus",
    "czechia",
    "denmark",
    "estonia",
    "finland",
    "france",
    "germany",
    "greece",
    "hungary",
    "ireland",
    "italy",
    "latvia",
    "lithuania",
    "luxembourg",
    "malta",
    "netherlands",
    "poland",
    "portugal",
    "romania",
    "slovakia",
    "slovenia",
    "spain",
    "sweden"
  ];

  function getEuMemberCountryTokens() {
    if (typeof EU_MEMBER_COUNTRIES !== "undefined" && Array.isArray(EU_MEMBER_COUNTRIES)) {
      return EU_MEMBER_COUNTRIES.map((country) => normalizeScalar(country)).filter(Boolean);
    }
    return EU_MEMBER_COUNTRIES_FALLBACK.slice();
  }

  function getEuRegionToken() {
    if (typeof COUNTRY_OPTION_EU !== "undefined") {
      return normalizeScalar(COUNTRY_OPTION_EU);
    }
    return "eu";
  }

  function normalizeProfileName(name) {
    return normalizeScalar(name);
  }

  function normalizeCountriesList(countries) {
    let names = [];
    if (Array.isArray(countries)) {
      names = countries.map((country) => normalizeScalar(country)).filter(Boolean);
    } else if (countries != null && countries !== "") {
      names = String(countries)
        .split(/[,|]/)
        .map((country) => normalizeScalar(country))
        .filter(Boolean);
    }
    if (!names.length) return "";

    const euToken = getEuRegionToken();
    const euMembers = getEuMemberCountryTokens();
    const euMemberSet = new Set(euMembers);
    const unique = Array.from(new Set(names));
    const hasEuToken = unique.includes(euToken);
    const hasAllEuMembers =
      euMembers.length > 0 && euMembers.every((member) => unique.includes(member));

    if (hasEuToken || hasAllEuMembers) {
      const nonEu = unique.filter((name) => name !== euToken && !euMemberSet.has(name)).sort();
      return nonEu.length ? `${euToken},${nonEu.join(",")}` : euToken;
    }

    return unique.sort().join(",");
  }

  function getRoadmapPeriodKey(roadmap) {
    if (!roadmap || typeof roadmap !== "object") return "";
    if (Array.isArray(roadmap.roadmapPeriods) && roadmap.roadmapPeriods.length) {
      const periods = roadmap.roadmapPeriods
        .map((entry) => (entry && entry.period ? String(entry.period).trim().toUpperCase() : ""))
        .filter(Boolean)
        .sort();
      if (periods.length) return periods.join(",");
    }
    return roadmap.roadmapPeriod ? String(roadmap.roadmapPeriod).trim().toUpperCase() : "";
  }

  function normalizeMoscowForIdentity(category) {
    const raw = normalizeScalar(category);
    if (!raw) return "";
    if (raw === "must" || raw.startsWith("must")) return "must have";
    if (raw === "should" || raw.startsWith("should")) return "should have";
    if (raw === "could" || raw.startsWith("could")) return "could have";
    if (raw === "wont" || raw === "won't" || raw.includes("won")) return "won't have";
    return raw;
  }

  /** Stable fingerprint for logical duplicate detection (same row in the UI). */
  function getRoadmapIdentityKey(roadmap) {
    if (!roadmap || typeof roadmap !== "object") return "";
    const title = normalizeScalar(roadmap.title).replace(/\s+/g, " ");
    if (!title) return "";
    return [
      title,
      getRoadmapPeriodKey(roadmap),
      normalizeCountriesList(roadmap.countries),
      normalizeMoscowForIdentity(roadmap.moscowCategory),
      normalizeScalar(roadmap.roadmapType),
      normalizeScalar(roadmap.tshirtSize)
    ].join("|");
  }

  function tombstoneEntityId(tombstonesOut, kind, entity) {
    if (!entity || !entity.id) return;
    const deletedAt = entity.modifiedAt || entity.updatedAt || entity.createdAt || new Date().toISOString();
    recordTombstoneOnMap(tombstonesOut, kind, entity.id, deletedAt);
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

  function normalizeTombstoneKind(kind) {
    if (kind === "profile" || kind === "profiles") return "profiles";
    if (kind === "roadmap" || kind === "roadmaps") return "roadmaps";
    return kind;
  }

  function recordTombstoneOnMap(tombstones, kind, id, deletedAt) {
    if (!tombstones || !id) return;
    const bucket = normalizeTombstoneKind(kind);
    const at = deletedAt || new Date().toISOString();
    if (!tombstones[bucket] || typeof tombstones[bucket] !== "object") {
      tombstones[bucket] = {};
    }
    const prev = tombstones[bucket][id] ? Date.parse(tombstones[bucket][id]) : 0;
    const next = Date.parse(at);
    if (!prev || next >= prev) {
      tombstones[bucket][id] = at;
    }
  }

  function purgeOrderMap(orderMap, removedIds) {
    if (!orderMap || typeof orderMap !== "object" || !removedIds || !removedIds.size) {
      return orderMap;
    }
    const next = {};
    Object.keys(orderMap).forEach((key) => {
      const list = Array.isArray(orderMap[key]) ? orderMap[key] : [];
      const filtered = list.filter((id) => !removedIds.has(id));
      if (filtered.length) next[key] = filtered;
    });
    return next;
  }

  function dedupeRoadmapsList(roadmaps, tombstonesOut) {
    const list = Array.isArray(roadmaps) ? roadmaps : [];
    const byId = new Map();

    list.forEach((roadmap) => {
      if (!roadmap || typeof roadmap !== "object") return;
      const id = typeof roadmap.id === "string" && roadmap.id.trim() ? roadmap.id.trim() : "";
      if (!id) return;
      const existing = byId.get(id);
      byId.set(id, existing ? mergeEntitiesWithIdAnchor([existing, roadmap]) : roadmap);
    });

    const byIdentity = new Map();
    byId.forEach((roadmap) => {
      const identityKey = getRoadmapIdentityKey(roadmap) || `__id:${roadmap.id}`;
      if (!byIdentity.has(identityKey)) byIdentity.set(identityKey, []);
      byIdentity.get(identityKey).push(roadmap);
    });

    const kept = [];
    const removedIds = new Set();

    byIdentity.forEach((group) => {
      if (group.length === 1) {
        kept.push(group[0]);
        return;
      }
      const anchor = mergeEntitiesWithIdAnchor(group);
      const anchorId = anchor.id;
      group.forEach((roadmap) => {
        if (roadmap.id === anchorId) return;
        removedIds.add(roadmap.id);
        tombstoneEntityId(tombstonesOut, "roadmaps", roadmap);
      });
      kept.push(anchor);
    });

    return { roadmaps: kept, removedIds };
  }

  function dedupeProfileRoadmaps(profile, tombstonesOut) {
    if (!profile || typeof profile !== "object") return profile;
    const deduped = dedupeRoadmapsList(profile.roadmaps, tombstonesOut);
    const next = Object.assign({}, profile, { roadmaps: deduped.roadmaps });
    if (deduped.removedIds.size) {
      next.boardOrder = purgeOrderMap(profile.boardOrder, deduped.removedIds);
      next.moscowOrder = purgeOrderMap(profile.moscowOrder, deduped.removedIds);
    }
    return next;
  }

  function dedupeProfilesByName(profiles, tombstonesOut) {
    const list = Array.isArray(profiles) ? profiles : [];
    const byId = new Map();

    list.forEach((profile) => {
      if (!profile || typeof profile !== "object") return;
      const id = typeof profile.id === "string" && profile.id.trim() ? profile.id.trim() : "";
      if (!id) return;
      const existing = byId.get(id);
      byId.set(
        id,
        existing ? mergeSingleProfile(existing, profile, tombstonesOut, id) : dedupeProfileRoadmaps(profile, tombstonesOut)
      );
    });

    const nameToIds = new Map();
    byId.forEach((profile, id) => {
      const nameKey = normalizeProfileName(profile.name);
      if (!nameKey) return;
      if (!nameToIds.has(nameKey)) nameToIds.set(nameKey, []);
      nameToIds.get(nameKey).push(id);
    });

    nameToIds.forEach((ids) => {
      if (ids.length <= 1) return;
      const sortedIds = ids.slice().sort(compareEntityIds);
      const anchorId = sortedIds[0];
      let canonical = byId.get(anchorId);
      for (let i = 1; i < sortedIds.length; i++) {
        const otherId = sortedIds[i];
        const other = byId.get(otherId);
        if (!other) continue;
        canonical = mergeSingleProfile(canonical, other, tombstonesOut, anchorId);
        tombstoneEntityId(tombstonesOut, "profiles", other);
        byId.delete(otherId);
      }
      canonical.id = anchorId;
      byId.set(anchorId, canonical);
    });

    return Array.from(byId.values());
  }

  /** Same roadmap id copied into multiple profiles — keep on anchored profile id. */
  function dedupeSharedRoadmapIdsAcrossProfiles(profiles, tombstonesOut) {
    const list = (Array.isArray(profiles) ? profiles : []).map((profile) =>
      Object.assign({}, profile, {
        roadmaps: Array.isArray(profile.roadmaps) ? profile.roadmaps.slice() : []
      })
    );
    const idToLocations = new Map();

    list.forEach((profile) => {
      profile.roadmaps.forEach((roadmap) => {
        const id = roadmap && roadmap.id ? String(roadmap.id).trim() : "";
        if (!id) return;
        if (!idToLocations.has(id)) idToLocations.set(id, []);
        idToLocations.get(id).push({ profile, roadmap });
      });
    });

    idToLocations.forEach((locations) => {
      if (locations.length <= 1) return;
      const anchorProfileId = pickAnchorId(...locations.map((entry) => entry.profile.id));
      const merged = mergeEntitiesWithIdAnchor(locations.map((entry) => entry.roadmap));
      const mergedId = merged.id;
      list.forEach((profile) => {
        profile.roadmaps = profile.roadmaps.filter((roadmap) => roadmap.id !== mergedId);
      });
      const anchorProfile = list.find((profile) => profile.id === anchorProfileId);
      if (anchorProfile) anchorProfile.roadmaps.push(merged);
    });

    return list;
  }

  function pruneObsoleteTombstones(payload) {
    if (!payload || typeof payload !== "object") return payload;
    const tombstones = getTombstones(payload);
    let changed = false;

    (Array.isArray(payload.profiles) ? payload.profiles : []).forEach((profile) => {
      if (!profile || typeof profile !== "object") return;
      if (profile.id && tombstones.profiles[profile.id]) {
        if (!isTombstoned(tombstones, "profiles", profile.id, profile)) {
          delete tombstones.profiles[profile.id];
          changed = true;
        }
      }
      (Array.isArray(profile.roadmaps) ? profile.roadmaps : []).forEach((roadmap) => {
        if (!roadmap || !roadmap.id || !tombstones.roadmaps[roadmap.id]) return;
        if (!isTombstoned(tombstones, "roadmaps", roadmap.id, roadmap)) {
          delete tombstones.roadmaps[roadmap.id];
          changed = true;
        }
      });
    });

    if (!changed) return payload;
    const next = Object.assign({}, payload);
    next.workspaceTombstones = tombstones;
    return next;
  }

  function dedupeWorkspacePayload(payload) {
    if (!payload || typeof payload !== "object") return payload;
    const tombstones = getTombstones(payload);
    let profiles = dedupeProfilesByName(Array.isArray(payload.profiles) ? payload.profiles : [], tombstones);
    profiles = dedupeSharedRoadmapIdsAcrossProfiles(profiles, tombstones);
    profiles = profiles.map((profile) => dedupeProfileRoadmaps(profile, tombstones));
    const next = Object.assign({}, payload, {
      profiles,
      workspaceTombstones: tombstones
    });
    return applyTombstones(pruneObsoleteTombstones(next));
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

  function mergeRoadmaps(localRoadmaps, remoteRoadmaps, tombstonesOut) {
    const localList = Array.isArray(localRoadmaps) ? localRoadmaps : [];
    const remoteList = Array.isArray(remoteRoadmaps) ? remoteRoadmaps : [];
    const byId = new Map();

    function addRoadmap(roadmap) {
      if (!roadmap || typeof roadmap !== "object") return;
      const id = typeof roadmap.id === "string" && roadmap.id.trim() ? roadmap.id.trim() : "";
      if (!id) return;
      const existing = byId.get(id);
      byId.set(id, existing ? mergeEntitiesWithIdAnchor([existing, roadmap]) : roadmap);
    }

    localList.forEach(addRoadmap);
    remoteList.forEach(addRoadmap);

    return dedupeRoadmapsList(Array.from(byId.values()), tombstonesOut).roadmaps;
  }

  function mergeSingleProfile(profileA, profileB, tombstonesOut, anchorProfileId) {
    if (!profileA) return dedupeProfileRoadmaps(profileB, tombstonesOut);
    if (!profileB) return dedupeProfileRoadmaps(profileA, tombstonesOut);
    const anchorId = anchorProfileId || pickAnchorId(profileA.id, profileB.id);
    const newer = pickNewerEntity(profileA, profileB);
    const older = newer === profileA ? profileB : profileA;
    const merged = Object.assign({}, mergeEntitiesWithIdAnchor([profileA, profileB]), {
      id: anchorId,
      roadmaps: mergeRoadmaps(profileA && profileA.roadmaps, profileB && profileB.roadmaps, tombstonesOut),
      boardOrder: mergeOrderMaps(newer.boardOrder, older.boardOrder),
      moscowOrder: mergeOrderMaps(newer.moscowOrder, older.moscowOrder)
    });
    if (!merged.passwordHash && older && older.passwordHash) {
      merged.passwordSalt = older.passwordSalt;
      merged.passwordHash = older.passwordHash;
    }
    return dedupeProfileRoadmaps(merged, tombstonesOut);
  }

  function mergeProfiles(localProfiles, remoteProfiles, tombstonesOut) {
    const localList = Array.isArray(localProfiles) ? localProfiles : [];
    const remoteList = Array.isArray(remoteProfiles) ? remoteProfiles : [];
    const combined = [];

    function ingest(profile) {
      if (!profile || typeof profile !== "object") return;
      const id = typeof profile.id === "string" && profile.id.trim() ? profile.id.trim() : "";
      if (!id) return;
      combined.push(profile);
    }

    localList.forEach(ingest);
    remoteList.forEach(ingest);

    return dedupeProfilesByName(combined, tombstonesOut);
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
      profiles: mergeProfiles(local.profiles, remote.profiles, tombstones),
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

    return dedupeWorkspacePayload(applyTombstones(pruneObsoleteTombstones(merged)));
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
    recordTombstoneOnMap(tombstones, kind, id, deletedAt);
    next.workspaceTombstones = tombstones;
    return next;
  }

  return {
    mergeWorkspacePayloads,
    dedupeWorkspacePayload,
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
