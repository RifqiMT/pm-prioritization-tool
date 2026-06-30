/**
 * Export payload coverage checks (no test runner required).
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
  CSV_COLUMN_IDS,
  pickExtraEntityFields,
  buildWorkspaceStateSnapshot,
  buildJsonExportDocument,
  parseExtraDataJson,
  parseJsonArrayCell,
  mergeExtraFieldsIntoEntity
} = require("../api/_lib/export-payload");

const constantsSrc = fs.readFileSync(path.join(__dirname, "../src/constants.js"), "utf8");
const appSrc = fs.readFileSync(path.join(__dirname, "../src/app.js"), "utf8");

assert.ok(appSrc.includes("buildExportJsonPayload"), "app.js must define buildExportJsonPayload");
assert.ok(appSrc.includes("buildExportCsvRows"), "app.js must define buildExportCsvRows");
assert.ok(appSrc.includes("parseRoadmapPeriodsFromImport"), "app.js must define parseRoadmapPeriodsFromImport");
assert.ok(appSrc.includes("serializeRoadmapPeriodsForExport"), "app.js must define serializeRoadmapPeriodsForExport");
assert.ok(fs.existsSync(path.join(__dirname, "../src/modules/export-payload.js")), "export-payload module must exist");

const workspaceKeysMatch = constantsSrc.match(/const WORKSPACE_PERSISTED_STATE_KEYS = \[([\s\S]*?)\];/);
assert.ok(workspaceKeysMatch, "WORKSPACE_PERSISTED_STATE_KEYS required");
const workspaceKeys = workspaceKeysMatch[1]
  .split("\n")
  .map((line) => line.replace(/\/\/.*/, "").trim())
  .filter(Boolean)
  .map((line) => line.replace(/["',]/g, "").trim())
  .filter(Boolean);

const workspace = buildWorkspaceStateSnapshot(workspaceKeys, (key) => {
  if (key === "activeProfileId") return "profile_a";
  if (key === "roadmapsView") return "board";
  return undefined;
});
assert.strictEqual(workspace.activeProfileId, "profile_a");
assert.strictEqual(workspace.roadmapsView, "board");

const profile = { id: "p1", name: "Growth", boardOrder: { Done: ["r1"] }, customFlag: true };
const knownProfile = new Set(["id", "name", "boardOrder", "roadmaps"]);
const profileExtra = pickExtraEntityFields(profile, knownProfile);
assert.deepStrictEqual(profileExtra, { customFlag: true });

const roadmap = { id: "r1", title: "Alpha", futureMetric: 42 };
const knownRoadmap = new Set(["id", "title"]);
const roadmapExtra = pickExtraEntityFields(roadmap, knownRoadmap);
assert.deepStrictEqual(roadmapExtra, { futureMetric: 42 });

const jsonDoc = buildJsonExportDocument({
  version: 1,
  exportedAt: "2026-06-08T00:00:00.000Z",
  profiles: [{ id: "p1", roadmaps: [] }],
  workspace
});
assert.strictEqual(jsonDoc.version, 1);
assert.strictEqual(jsonDoc.profiles.length, 1);
assert.strictEqual(jsonDoc.roadmapsView, "board");
assert.strictEqual(jsonDoc.activeProfileId, "profile_a");

assert.ok(CSV_COLUMN_IDS.includes("roadmapPeriods"));
assert.ok(CSV_COLUMN_IDS.includes("roadmapRaci"));
assert.ok(CSV_COLUMN_IDS.includes("profileBoardOrder"));
assert.ok(CSV_COLUMN_IDS.includes("profileMoscowOrder"));
assert.ok(CSV_COLUMN_IDS.includes("profileExtraData"));
assert.ok(CSV_COLUMN_IDS.includes("roadmapExtraData"));
assert.ok(CSV_COLUMN_IDS.includes("workspaceState"));

const knownRoadmapMatch = constantsSrc.match(/const EXPORT_CSV_KNOWN_ROADMAP_KEYS = \[([\s\S]*?)\];/);
assert.ok(knownRoadmapMatch, "EXPORT_CSV_KNOWN_ROADMAP_KEYS required");
const knownRoadmapKeys = knownRoadmapMatch[1]
  .split("\n")
  .map((line) => line.replace(/\/\/.*/, "").trim())
  .filter(Boolean)
  .map((line) => line.replace(/["',]/g, "").trim())
  .filter(Boolean);
assert.ok(knownRoadmapKeys.includes("roadmapPeriods"), "roadmapPeriods must be a known CSV roadmap key");
assert.ok(knownRoadmapKeys.includes("roadmapPeriod"), "roadmapPeriod must be a known CSV roadmap key");
assert.ok(knownRoadmapKeys.includes("note"), "note must be a known CSV roadmap key");
assert.ok(knownRoadmapKeys.includes("tasks"), "tasks must be a known CSV roadmap key");
assert.ok(knownRoadmapKeys.includes("raci"), "raci must be a known CSV roadmap key");

const parsedArray = parseJsonArrayCell('[{"period":"2026-Q1","status":"Done"}]');
assert.ok(Array.isArray(parsedArray));
assert.strictEqual(parsedArray.length, 1);

const parsedExtra = parseExtraDataJson('{"beta":1}');
assert.deepStrictEqual(parsedExtra, { beta: 1 });
assert.deepStrictEqual(mergeExtraFieldsIntoEntity({ id: "r1" }, { beta: 1 }), { id: "r1", beta: 1 });

console.log("OK: export payload tests passed");
