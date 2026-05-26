/**
 * Lightweight checks for cloud load conflict resolution (no test runner required).
 */
const assert = require("assert");

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

function resolvePayloadForLoad(remoteBody, localPayload, localMeta) {
  const remotePayload =
    remoteBody && remoteBody.payload ? remoteBody.payload : null;
  const remoteDocAt = remoteBody && remoteBody.updatedAt ? remoteBody.updatedAt : null;
  const remoteAt = getPayloadUpdatedAtMs(remotePayload, remoteDocAt);
  const localAt = Math.max(
    getPayloadUpdatedAtMs(localPayload, null),
    localMeta.updatedAt ? Date.parse(localMeta.updatedAt) || 0 : 0
  );

  const remoteEmpty = isEmptyPayload(remotePayload);
  const localEmpty = isEmptyPayload(localPayload);

  if (!remoteEmpty && !localEmpty) {
    if (localAt > remoteAt) {
      return { source: "local", pushToCloud: true };
    }
    return { source: "remote", pushToCloud: false };
  }
  if (!remoteEmpty) return { source: "remote", pushToCloud: false };
  if (!localEmpty) return { source: "local", pushToCloud: true };
  return { source: "none", pushToCloud: false };
}

const remoteNewer = resolvePayloadForLoad(
  {
    payload: {
      profiles: [{ id: "r1", name: "Remote", projects: [] }],
      _storageMeta: { updatedAt: "2026-05-26T16:00:00.000Z" }
    },
    updatedAt: "2026-05-26T16:00:00.000Z"
  },
  {
    profiles: [{ id: "l1", name: "Local", projects: [] }],
    _storageMeta: { updatedAt: "2026-05-26T10:00:00.000Z" }
  },
  {}
);
assert.strictEqual(remoteNewer.source, "remote");
assert.strictEqual(remoteNewer.pushToCloud, false);

const localNewer = resolvePayloadForLoad(
  {
    payload: {
      profiles: [{ id: "r1", name: "Remote", projects: [] }],
      _storageMeta: { updatedAt: "2026-05-26T10:00:00.000Z" }
    },
    updatedAt: "2026-05-26T10:00:00.000Z"
  },
  {
    profiles: [{ id: "l1", name: "Local", projects: [] }],
    _storageMeta: { updatedAt: "2026-05-26T18:00:00.000Z" }
  },
  { updatedAt: "2026-05-26T18:00:00.000Z" }
);
assert.strictEqual(localNewer.source, "local");
assert.strictEqual(localNewer.pushToCloud, true);

const migrateLocal = resolvePayloadForLoad({ payload: null, updatedAt: null }, {
  profiles: [{ id: "l1", name: "Local", projects: [] }]
}, {});
assert.strictEqual(migrateLocal.source, "local");
assert.strictEqual(migrateLocal.pushToCloud, true);

console.log("OK: storage sync logic tests passed");
