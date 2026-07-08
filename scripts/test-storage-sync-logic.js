/**
 * Lightweight checks for cloud load conflict resolution (no test runner required).
 */
const assert = require("assert");
const WorkspaceMerge = require("../src/modules/workspace-merge.js");

function isEmptyPayload(payload) {
  if (!payload || typeof payload !== "object") return true;
  if (!Array.isArray(payload.profiles)) return true;
  return payload.profiles.length === 0;
}

function countProfiles(payload) {
  return WorkspaceMerge.countProfiles(payload);
}

function countRoadmaps(payload) {
  return WorkspaceMerge.countRoadmaps(payload);
}

function resolvePayloadForLoad(remoteBody, localPayload) {
  const remotePayload =
    remoteBody && remoteBody.payload ? remoteBody.payload : null;
  const remoteDocAt = remoteBody && remoteBody.updatedAt ? remoteBody.updatedAt : null;
  const remoteEmpty = isEmptyPayload(remotePayload);
  const localEmpty = isEmptyPayload(localPayload);

  if (!remoteEmpty && !localEmpty) {
    const mergedPayload = WorkspaceMerge.mergeWorkspacePayloads(localPayload, remotePayload);
    const mergedProfiles = countProfiles(mergedPayload);
    const mergedRoadmaps = countRoadmaps(mergedPayload);
    const remoteCount = countProfiles(remotePayload);
    const localCount = countProfiles(localPayload);
    const remoteRoadmaps = countRoadmaps(remotePayload);
    const localRoadmaps = countRoadmaps(localPayload);
    const differsFromRemote =
      mergedProfiles !== remoteCount || mergedRoadmaps !== remoteRoadmaps;
    const differsFromLocal =
      mergedProfiles !== localCount || mergedRoadmaps !== localRoadmaps;

    return {
      source: differsFromLocal && differsFromRemote ? "merged" : differsFromRemote ? "merged" : "local",
      pushToCloud: differsFromRemote || differsFromLocal,
      mergedProfiles,
      mergedRoadmaps
    };
  }
  if (!remoteEmpty) return { source: "remote", pushToCloud: false };
  if (!localEmpty) return { source: "local", pushToCloud: true };
  return { source: "none", pushToCloud: false };
}

const bothSides = resolvePayloadForLoad(
  {
    payload: {
      profiles: [{ id: "r1", name: "Remote", roadmaps: [{ id: "p-remote", modifiedAt: "2026-06-02T00:00:00.000Z" }] }],
      _storageMeta: { updatedAt: "2026-05-26T16:00:00.000Z" }
    },
    updatedAt: "2026-05-26T16:00:00.000Z",
    revision: 3
  },
  {
    profiles: [{ id: "l1", name: "Local", roadmaps: [{ id: "p-local", modifiedAt: "2026-06-01T00:00:00.000Z" }] }],
    _storageMeta: { updatedAt: "2026-05-26T10:00:00.000Z" }
  }
);
assert.strictEqual(bothSides.source, "merged");
assert.strictEqual(bothSides.mergedProfiles, 2);
assert.strictEqual(bothSides.mergedRoadmaps, 2);
assert.strictEqual(bothSides.pushToCloud, true);

const migrateLocal = resolvePayloadForLoad({ payload: null, updatedAt: null }, {
  profiles: [{ id: "l1", name: "Local", roadmaps: [] }]
});
assert.strictEqual(migrateLocal.source, "local");
assert.strictEqual(migrateLocal.pushToCloud, true);

const remoteOnly = resolvePayloadForLoad(
  {
    payload: {
      profiles: [
        { id: "r1", roadmaps: [] },
        { id: "r2", roadmaps: [] },
        { id: "r3", roadmaps: [] }
      ]
    },
    updatedAt: "2026-05-26T10:00:00.000Z"
  },
  {
    profiles: [{ id: "l1", name: "Local", roadmaps: [] }],
    _storageMeta: { updatedAt: "2026-05-26T18:00:00.000Z" }
  }
);
assert.strictEqual(remoteOnly.source, "merged");
assert.strictEqual(remoteOnly.mergedProfiles, 4);

function stripLegacyWorkspaceFields(payload) {
  const LEGACY_WORKSPACE_FIELDS = ["boardHiddenStatuses"];
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }
  let removed = false;
  LEGACY_WORKSPACE_FIELDS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      delete payload[key];
      removed = true;
    }
  });
  return removed;
}

const legacyPayload = {
  profiles: [{ id: "p1", name: "Demo", roadmaps: [] }],
  boardHiddenStatuses: ["Cancelled"],
  sortField: "riceScore"
};
assert.strictEqual(stripLegacyWorkspaceFields(legacyPayload), true);
assert.strictEqual(Object.prototype.hasOwnProperty.call(legacyPayload, "boardHiddenStatuses"), false);
assert.strictEqual(legacyPayload.sortField, "riceScore");
assert.strictEqual(stripLegacyWorkspaceFields(null), false);

console.log("OK: storage sync logic tests passed");
