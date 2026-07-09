/**
 * Import + tombstone interaction: cleared tombstones must allow re-imported entities to persist.
 */
const assert = require("assert");
const { applyTombstones, dedupeWorkspacePayload } = require("../src/modules/workspace-merge.js");

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

console.log("Import tombstone tests passed");
