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
assert.strictEqual(duplicateMerged.profiles[0].id, "p1");
assert.strictEqual(countRoadmaps(duplicateMerged), 2);
assert.ok(duplicateMerged.workspaceTombstones.profiles["p9"]);

const duplicateRoadmapLocal = {
  profiles: [
    {
      id: "p1",
      name: "Team",
      roadmaps: [
        {
          id: "r-old",
          title: "AI audit logs",
          roadmapPeriod: "2025-Q2",
          countries: ["EU"],
          moscowCategory: "Must have",
          tshirtSize: "S",
          modifiedAt: "2026-05-31T21:07:00.000Z"
        }
      ]
    }
  ]
};

const duplicateRoadmapRemote = {
  profiles: [
    {
      id: "p1",
      name: "Team",
      roadmaps: [
        {
          id: "r-new",
          title: "AI audit logs",
          roadmapPeriod: "2025-Q2",
          countries: ["EU"],
          moscowCategory: "Must have",
          tshirtSize: "S",
          modifiedAt: "2026-07-08T18:37:00.000Z"
        },
        {
          id: "r-mid",
          title: "AI audit logs",
          roadmapPeriod: "2025-Q2",
          countries: ["EU"],
          moscowCategory: "Must have",
          tshirtSize: "S",
          modifiedAt: "2026-07-08T18:36:00.000Z"
        }
      ]
    }
  ]
};

const duplicateRoadmapMerged = mergeWorkspacePayloads(duplicateRoadmapLocal, duplicateRoadmapRemote);
assert.strictEqual(countRoadmaps(duplicateRoadmapMerged), 1);
assert.strictEqual(
  duplicateRoadmapMerged.profiles[0].roadmaps[0].id,
  "r-mid"
);
assert.strictEqual(
  duplicateRoadmapMerged.profiles[0].roadmaps[0].modifiedAt,
  "2026-07-08T18:37:00.000Z"
);
assert.ok(duplicateRoadmapMerged.workspaceTombstones.roadmaps["r-old"]);
assert.ok(duplicateRoadmapMerged.workspaceTombstones.roadmaps["r-new"]);

const dedupeOnly = WorkspaceMerge.dedupeWorkspacePayload(duplicateRoadmapRemote);
assert.strictEqual(countRoadmaps(dedupeOnly), 1);
assert.strictEqual(dedupeOnly.profiles[0].roadmaps[0].id, "r-mid");

const moscowAliasDedupe = WorkspaceMerge.dedupeWorkspacePayload({
  profiles: [
    {
      id: "p1",
      name: "Test",
      roadmaps: [
        {
          id: "r-a",
          title: "Unified conversation identity",
          roadmapPeriod: "2025-Q1",
          countries: ["EU"],
          moscowCategory: "Must have",
          tshirtSize: "M",
          modifiedAt: "2026-05-31T17:43:00.000Z"
        },
        {
          id: "r-b",
          title: "Unified conversation identity",
          roadmapPeriod: "2025-Q1",
          countries: ["EU"],
          moscowCategory: "Must",
          tshirtSize: "M",
          modifiedAt: "2026-07-08T20:24:00.000Z"
        }
      ]
    }
  ]
});
assert.strictEqual(countRoadmaps(moscowAliasDedupe), 1);
assert.strictEqual(moscowAliasDedupe.profiles[0].roadmaps[0].id, "r-a");
assert.strictEqual(
  moscowAliasDedupe.profiles[0].roadmaps[0].modifiedAt,
  "2026-07-08T20:24:00.000Z"
);

const sharedRoadmapIdDedupe = WorkspaceMerge.dedupeWorkspacePayload({
  profiles: [
    {
      id: "p1",
      name: "Team A",
      roadmaps: [{ id: "r1", title: "Shared", modifiedAt: "2026-06-01T00:00:00.000Z" }]
    },
    {
      id: "p2",
      name: "Team B",
      roadmaps: [{ id: "r1", title: "Shared copy", modifiedAt: "2026-06-02T00:00:00.000Z" }]
    }
  ]
});
assert.strictEqual(countRoadmaps(sharedRoadmapIdDedupe), 1);
assert.strictEqual(sharedRoadmapIdDedupe.profiles[0].roadmaps[0].title, "Shared copy");
assert.strictEqual(countProfiles(sharedRoadmapIdDedupe), 2);

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

const euAliasDedupe = WorkspaceMerge.dedupeWorkspacePayload({
  profiles: [
    {
      id: "p1",
      name: "Team",
      roadmaps: [
        {
          id: "r-eu-token",
          title: "AI audit logs",
          roadmapPeriod: "2025-Q2",
          countries: ["EU"],
          moscowCategory: "Must have",
          tshirtSize: "S",
          modifiedAt: "2026-05-31T21:07:00.000Z"
        },
        {
          id: "r-eu-expanded",
          title: "AI audit logs",
          roadmapPeriod: "2025-Q2",
          countries: [
            "Austria",
            "Belgium",
            "Bulgaria",
            "Croatia",
            "Cyprus",
            "Czechia",
            "Denmark",
            "Estonia",
            "Finland",
            "France",
            "Germany",
            "Greece",
            "Hungary",
            "Ireland",
            "Italy",
            "Latvia",
            "Lithuania",
            "Luxembourg",
            "Malta",
            "Netherlands",
            "Poland",
            "Portugal",
            "Romania",
            "Slovakia",
            "Slovenia",
            "Spain",
            "Sweden"
          ],
          moscowCategory: "Must have",
          tshirtSize: "S",
          modifiedAt: "2026-07-08T18:37:00.000Z"
        }
      ]
    }
  ]
});
assert.strictEqual(countRoadmaps(euAliasDedupe), 1);
assert.strictEqual(euAliasDedupe.profiles[0].roadmaps[0].id, "r-eu-expanded");
assert.ok(euAliasDedupe.workspaceTombstones.roadmaps["r-eu-token"]);

console.log("OK: workspace merge tests passed");
