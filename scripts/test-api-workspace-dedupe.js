/**
 * Server-side workspace dedupe (Vercel /api/state).
 */
const assert = require("assert");
const {
  dedupeWorkspacePayload,
  workspacePayloadChangedByDedupe,
  WorkspaceMerge
} = require("../api/_lib/workspace-dedupe.js");

const duplicatePayload = {
  profiles: [
    {
      id: "p1",
      name: "Test",
      roadmaps: [
        {
          id: "r-a",
          title: "AI impact measurement",
          roadmapPeriod: "2026-Q3",
          countries: ["EU"],
          moscowCategory: "Must have",
          tshirtSize: "M",
          modifiedAt: "2026-05-31T21:30:00.000Z"
        },
        {
          id: "r-b",
          title: "AI impact measurement",
          roadmapPeriod: "2026-Q3",
          countries: ["EU"],
          moscowCategory: "Must",
          tshirtSize: "M",
          modifiedAt: "2026-07-09T13:36:00.000Z"
        }
      ]
    }
  ]
};

const deduped = dedupeWorkspacePayload(duplicatePayload);
assert.strictEqual(WorkspaceMerge.countRoadmaps(duplicatePayload), 2);
assert.strictEqual(WorkspaceMerge.countRoadmaps(deduped), 1);
assert.strictEqual(deduped.profiles[0].roadmaps[0].id, "r-a");
assert.strictEqual(
  deduped.profiles[0].roadmaps[0].modifiedAt,
  "2026-07-09T13:36:00.000Z"
);
assert.ok(workspacePayloadChangedByDedupe(duplicatePayload, deduped));

const unchanged = dedupeWorkspacePayload(deduped);
assert.ok(!workspacePayloadChangedByDedupe(deduped, unchanged));

const tombstonedImport = dedupeWorkspacePayload({
  profiles: [
    {
      id: "p1",
      name: "Prod team",
      modifiedAt: "2026-07-09T12:00:00.000Z",
      roadmaps: [
        {
          id: "r1",
          title: "Re-imported on Vercel",
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
assert.strictEqual(WorkspaceMerge.countRoadmaps(tombstonedImport), 1);
assert.strictEqual(tombstonedImport.workspaceTombstones.roadmaps.r1, undefined);

console.log("OK: api workspace dedupe tests passed");
