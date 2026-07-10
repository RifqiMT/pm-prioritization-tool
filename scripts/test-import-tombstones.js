/**
 * Import + tombstone interaction: cleared tombstones must allow re-imported entities to persist.
 */
const assert = require("assert");
const WorkspaceMerge = require("../src/modules/workspace-merge.js");
const { applyTombstones, dedupeWorkspacePayload } = WorkspaceMerge;

const tombstonedPayload = {
  profiles: [
    {
      id: "p1",
      name: "Team A",
      roadmaps: [
        {
          id: "r1",
          title: "Deleted then re-imported",
          modifiedAt: "2026-05-01T00:00:00.000Z"
        }
      ]
    }
  ],
  workspaceTombstones: {
    profiles: {},
    roadmaps: { r1: "2026-06-01T00:00:00.000Z" }
  }
};

const stripped = applyTombstones(tombstonedPayload);
assert.strictEqual(stripped.profiles[0].roadmaps.length, 0, "tombstone should hide roadmap before import clear");

const importCleared = {
  profiles: tombstonedPayload.profiles,
  workspaceTombstones: { profiles: {}, roadmaps: {} }
};

const restored = dedupeWorkspacePayload(importCleared);
assert.strictEqual(restored.profiles[0].roadmaps.length, 1, "cleared tombstones should keep imported roadmap");
assert.strictEqual(restored.profiles[0].roadmaps[0].id, "r1");

const newerReimport = {
  profiles: [
    {
      id: "p1",
      name: "Team A",
      roadmaps: [
        {
          id: "r1",
          title: "Restored item",
          modifiedAt: "2026-07-01T00:00:00.000Z"
        }
      ]
    }
  ],
  workspaceTombstones: {
    profiles: {},
    roadmaps: { r1: "2026-06-01T00:00:00.000Z" }
  }
};

const newerKept = applyTombstones(newerReimport);
assert.strictEqual(newerKept.profiles[0].roadmaps.length, 1, "newer modifiedAt should beat tombstone without clearing");

const revived = dedupeWorkspacePayload({
  profiles: [
    {
      id: "p1",
      name: "Team A",
      modifiedAt: "2026-07-09T12:00:00.000Z",
      roadmaps: [
        {
          id: "r1",
          title: "Re-imported",
          modifiedAt: "2026-07-09T12:00:00.000Z"
        }
      ]
    }
  ],
  workspaceTombstones: {
    profiles: {},
    roadmaps: { r1: "2026-06-01T00:00:00.000Z" }
  }
});
assert.strictEqual(revived.profiles[0].roadmaps.length, 1, "prune should drop stale tombstones for live entities");
assert.strictEqual(revived.workspaceTombstones.roadmaps.r1, undefined);

console.log("Import tombstone tests passed");
