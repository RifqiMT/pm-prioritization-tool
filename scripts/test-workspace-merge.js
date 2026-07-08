/**
 * Tests for workspace merge (concurrent multi-user safety).
 */
const assert = require("assert");
const WorkspaceMerge = require("../src/modules/workspace-merge.js");

const { mergeWorkspacePayloads, countProfiles, countRoadmaps, applyTombstones, recordTombstone } =
  WorkspaceMerge;

const local = {
  profiles: [
    {
      id: "p1",
      name: "Team A",
      createdAt: "2026-01-01T00:00:00.000Z",
      roadmaps: [
        { id: "r1", title: "Local roadmap", modifiedAt: "2026-06-01T12:00:00.000Z" }
      ]
    }
  ],
  activeProfileId: "p1",
  _storageMeta: { updatedAt: "2026-06-01T12:00:00.000Z" }
};

const remote = {
  profiles: [
    {
      id: "p2",
      name: "Team B",
      createdAt: "2026-01-02T00:00:00.000Z",
      roadmaps: [
        { id: "r2", title: "Remote roadmap", modifiedAt: "2026-06-02T12:00:00.000Z" }
      ]
    }
  ],
  activeProfileId: "p2",
  _storageMeta: { updatedAt: "2026-06-02T12:00:00.000Z" }
};

const merged = mergeWorkspacePayloads(local, remote);
assert.strictEqual(countProfiles(merged), 2);
assert.strictEqual(countRoadmaps(merged), 2);
assert.strictEqual(merged.activeProfileId, "p2");

const conflictLocal = {
  profiles: [
    {
      id: "p1",
      name: "Team A",
      roadmaps: [
        { id: "r1", title: "Local newer", modifiedAt: "2026-06-03T12:00:00.000Z" }
      ]
    }
  ]
};

const conflictRemote = {
  profiles: [
    {
      id: "p1",
      name: "Team A",
      roadmaps: [
        { id: "r1", title: "Remote older", modifiedAt: "2026-06-01T12:00:00.000Z" }
      ]
    }
  ]
};

const conflictMerged = mergeWorkspacePayloads(conflictLocal, conflictRemote);
assert.strictEqual(conflictMerged.profiles[0].roadmaps[0].title, "Local newer");

const duplicateNameLocal = {
  profiles: [{ id: "p1", name: "Shared Team", roadmaps: [{ id: "r1", modifiedAt: "2026-06-01T00:00:00.000Z" }] }]
};
const duplicateNameRemote = {
  profiles: [{ id: "p9", name: "Shared Team", roadmaps: [{ id: "r2", modifiedAt: "2026-06-02T00:00:00.000Z" }] }]
};
const duplicateMerged = mergeWorkspacePayloads(duplicateNameLocal, duplicateNameRemote);
assert.strictEqual(countProfiles(duplicateMerged), 1);
assert.strictEqual(countRoadmaps(duplicateMerged), 2);

let tombstoned = recordTombstone(
  {
    profiles: [{ id: "p1", roadmaps: [{ id: "r1", modifiedAt: "2026-06-01T00:00:00.000Z" }] }]
  },
  "roadmap",
  "r1"
);
tombstoned = applyTombstones(tombstoned);
assert.strictEqual(countRoadmaps(tombstoned), 0);

const resurrect = mergeWorkspacePayloads(
  { profiles: [], workspaceTombstones: { profiles: {}, roadmaps: { r1: "2026-06-01T00:00:00.000Z" } } },
  {
    profiles: [
      {
        id: "p1",
        roadmaps: [{ id: "r1", title: "Recreated", modifiedAt: "2026-06-05T00:00:00.000Z" }]
      }
    ]
  }
);
assert.strictEqual(countRoadmaps(resurrect), 1);
assert.strictEqual(resurrect.profiles[0].roadmaps[0].title, "Recreated");

console.log("OK: workspace merge tests passed");
