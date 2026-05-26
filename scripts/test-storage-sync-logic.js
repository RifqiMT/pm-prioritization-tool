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

function countProfiles(payload) {
  if (!payload || !Array.isArray(payload.profiles)) return 0;
  return payload.profiles.length;
}

function resolvePayloadForLoad(remoteBody, localPayload, localMeta) {
  const remotePayload =
    remoteBody && remoteBody.payload ? remoteBody.payload : null;
  const remoteDocAt = remoteBody && remoteBody.updatedAt ? remoteBody.updatedAt : null;
  const remoteAt = getPayloadUpdatedAtMs(remotePayload, remoteDocAt);
  const remoteDocMs = remoteDocAt ? Date.parse(remoteDocAt) || remoteAt : remoteAt;
  const lastLocalMs = localMeta.lastLocalModifiedAt
    ? Date.parse(localMeta.lastLocalModifiedAt) || 0
    : getPayloadUpdatedAtMs(localPayload, null);
  const lastRemoteMs = localMeta.lastRemoteAppliedAt
    ? Date.parse(localMeta.lastRemoteAppliedAt) || 0
    : 0;
  const remoteCount = countProfiles(remotePayload);
  const localCount = countProfiles(localPayload);

  const remoteEmpty = isEmptyPayload(remotePayload);
  const localEmpty = isEmptyPayload(localPayload);

  if (!remoteEmpty && !localEmpty) {
    if (remoteCount > localCount) {
      return { source: "remote", pushToCloud: false };
    }
    if (localCount > remoteCount && lastLocalMs > remoteDocMs) {
      return { source: "local", pushToCloud: true };
    }
    if (!lastRemoteMs || remoteDocMs >= lastRemoteMs) {
      return { source: "remote", pushToCloud: false };
    }
    if (lastLocalMs > remoteDocMs && lastLocalMs > lastRemoteMs) {
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
      profiles: [
        { id: "r1", name: "Remote", projects: [] },
        { id: "r2", name: "Remote 2", projects: [] }
      ],
      _storageMeta: { updatedAt: "2026-05-26T10:00:00.000Z" }
    },
    updatedAt: "2026-05-26T10:00:00.000Z"
  },
  {
    profiles: [
      { id: "l1", name: "Local", projects: [] },
      { id: "l2", projects: [] },
      { id: "l3", projects: [] }
    ],
    _storageMeta: { updatedAt: "2026-05-26T18:00:00.000Z" }
  },
  {
    lastLocalModifiedAt: "2026-05-26T18:00:00.000Z",
    lastRemoteAppliedAt: "2026-05-26T09:00:00.000Z"
  }
);
assert.strictEqual(localNewer.source, "local");
assert.strictEqual(localNewer.pushToCloud, true);

const migrateLocal = resolvePayloadForLoad({ payload: null, updatedAt: null }, {
  profiles: [{ id: "l1", name: "Local", projects: [] }]
}, {});
assert.strictEqual(migrateLocal.source, "local");
assert.strictEqual(migrateLocal.pushToCloud, true);

const remoteRicher = resolvePayloadForLoad(
  {
    payload: {
      profiles: [
        { id: "r1", projects: [] },
        { id: "r2", projects: [] },
        { id: "r3", projects: [] }
      ],
      _storageMeta: { updatedAt: "2026-05-26T10:00:00.000Z" }
    },
    updatedAt: "2026-05-26T10:00:00.000Z"
  },
  {
    profiles: [{ id: "l1", name: "Local", projects: [] }],
    _storageMeta: { updatedAt: "2026-05-26T18:00:00.000Z" }
  },
  { updatedAt: "2026-05-26T18:00:00.000Z", lastLocalModifiedAt: "2026-05-26T18:00:00.000Z" }
);
assert.strictEqual(remoteRicher.source, "remote");
assert.strictEqual(remoteRicher.pushToCloud, false);

console.log("OK: storage sync logic tests passed");
