/**
 * Export payload helpers: full workspace snapshot for JSON/CSV download.
 * Loaded as a classic script; exposes ExportPayload global.
 */
const ExportPayload = (function () {
  const CSV_COLUMN_IDS = [
    "profileId",
    "profileName",
    "profileTeam",
    "profileCreatedAt",
    "profileBoardOrder",
    "profileMoscowOrder",
    "profileExtraData",
    "roadmapId",
    "roadmapTitle",
    "roadmapDescription",
    "roadmapNote",
    "roadmapCreatedAt",
    "roadmapModifiedAt",
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
    "financialImpactInputs",
    "roadmapType",
    "roadmapStatus",
    "tshirtSize",
    "roadmapPeriod",
    "roadmapPeriods",
    "roadmapDeadline",
    "moscowCategory",
    "kanoFunctionality",
    "kanoSatisfaction",
    "countries",
    "roadmapLabels",
    "roadmapLinks",
    "roadmapTasks",
    "roadmapRaci",
    "roadmapExtraData",
    "riceScore",
    "workspaceState"
  ];

  function getKnownProfileKeys() {
    if (typeof EXPORT_CSV_KNOWN_PROFILE_KEYS !== "undefined" && Array.isArray(EXPORT_CSV_KNOWN_PROFILE_KEYS)) {
      return new Set(EXPORT_CSV_KNOWN_PROFILE_KEYS);
    }
    return new Set(["id", "name", "team", "createdAt", "roadmaps", "projects", "boardOrder", "moscowOrder", "passwordSalt", "passwordHash"]);
  }

  function getKnownRoadmapKeys() {
    if (typeof EXPORT_CSV_KNOWN_ROADMAP_KEYS !== "undefined" && Array.isArray(EXPORT_CSV_KNOWN_ROADMAP_KEYS)) {
      return new Set(EXPORT_CSV_KNOWN_ROADMAP_KEYS);
    }
    return new Set();
  }

  function getWorkspacePersistedKeys() {
    if (typeof WORKSPACE_PERSISTED_STATE_KEYS !== "undefined" && Array.isArray(WORKSPACE_PERSISTED_STATE_KEYS)) {
      return WORKSPACE_PERSISTED_STATE_KEYS.slice();
    }
    return [];
  }

  function pickExtraEntityFields(entity, knownKeys) {
    if (!entity || typeof entity !== "object" || Array.isArray(entity)) return null;
    const known = knownKeys instanceof Set ? knownKeys : new Set(knownKeys || []);
    const extra = {};
    Object.keys(entity).forEach((key) => {
      if (!known.has(key)) extra[key] = entity[key];
    });
    return Object.keys(extra).length ? extra : null;
  }

  function serializeExtraDataJson(extra) {
    if (!extra || typeof extra !== "object") return "";
    try {
      return JSON.stringify(extra);
    } catch {
      return "";
    }
  }

  function parseExtraDataJson(raw) {
    const text = raw != null ? String(raw).trim() : "";
    if (!text) return null;
    try {
      const parsed = JSON.parse(text);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  /**
   * @param {string[]} keys
   * @param {(key: string) => unknown} readFieldFn
   * @param {Record<string, unknown>} [overrides]
   */
  function buildWorkspaceStateSnapshot(keys, readFieldFn, overrides) {
    const workspace = {};
    const patch = overrides && typeof overrides === "object" ? overrides : {};
    keys.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(patch, key)) {
        workspace[key] = patch[key];
        return;
      }
      if (typeof readFieldFn === "function") {
        const value = readFieldFn(key);
        if (value !== undefined) workspace[key] = value;
      }
    });
    return workspace;
  }

  /**
   * @param {object} options
   * @param {number} options.version
   * @param {string} options.exportedAt
   * @param {unknown[]} options.profiles
   * @param {Record<string, unknown>} options.workspace
   */
  function buildJsonExportDocument(options) {
    const opts = options && typeof options === "object" ? options : {};
    const doc = {
      version: opts.version != null ? opts.version : (typeof EXPORT_JSON_VERSION !== "undefined" ? EXPORT_JSON_VERSION : 1),
      exportedAt: opts.exportedAt || new Date().toISOString(),
      profiles: Array.isArray(opts.profiles) ? opts.profiles : []
    };
    const workspace = opts.workspace && typeof opts.workspace === "object" ? opts.workspace : {};
    Object.keys(workspace).forEach((key) => {
      doc[key] = workspace[key];
    });
    return doc;
  }

  function parseJsonArrayCell(raw) {
    const text = raw != null ? String(raw).trim() : "";
    if (!text) return null;
    try {
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  function mergeExtraFieldsIntoEntity(entity, extra) {
    if (!entity || typeof entity !== "object" || Array.isArray(entity)) return entity;
    if (!extra || typeof extra !== "object" || Array.isArray(extra)) return entity;
    return Object.assign({}, entity, extra);
  }

  return {
    CSV_COLUMN_IDS,
    getKnownProfileKeys,
    getKnownRoadmapKeys,
    getWorkspacePersistedKeys,
    pickExtraEntityFields,
    serializeExtraDataJson,
    parseExtraDataJson,
    buildWorkspaceStateSnapshot,
    buildJsonExportDocument,
    parseJsonArrayCell,
    mergeExtraFieldsIntoEntity
  };
})();
