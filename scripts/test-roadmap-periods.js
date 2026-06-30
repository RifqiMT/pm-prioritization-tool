/**
 * Roadmap period helpers — latest quarter status centralization.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(path.join(__dirname, "../src/modules/roadmap-periods.js"), "utf8");
const RoadmapPeriods = eval(source.replace(/const RoadmapPeriods = /, ""));

assert.ok(RoadmapPeriods, "RoadmapPeriods module should load");
assert.strictEqual(typeof RoadmapPeriods.getLatestPeriodEntry, "function");
assert.strictEqual(typeof RoadmapPeriods.deriveRoadmapStatus, "function");

const periods = RoadmapPeriods.normalizePeriods(
  [
    { period: "2026-Q1", status: "Done" },
    { period: "2026-Q3", status: "In Progress" },
    { period: "2025-Q4", status: "Not Started" }
  ],
  { statusOptions: ["Not Started", "In Progress", "Done"] }
);

const latest = RoadmapPeriods.getLatestPeriodEntry(periods);
assert.strictEqual(latest.period, "2026-Q3");
assert.strictEqual(latest.status, "In Progress");

assert.strictEqual(
  RoadmapPeriods.deriveLegacyPeriod(periods),
  "2026-Q3"
);

assert.strictEqual(
  RoadmapPeriods.deriveRoadmapStatus(periods, {
    fallbackStatus: "Done",
    statusOptions: ["Not Started", "In Progress", "Done"]
  }),
  "In Progress"
);

assert.strictEqual(
  RoadmapPeriods.deriveRoadmapStatus([], {
    fallbackStatus: "On Hold",
    statusOptions: ["Not Started", "In Progress", "On Hold"]
  }),
  "On Hold"
);

assert.strictEqual(
  RoadmapPeriods.validateUniquePeriods([
    { period: "2026-Q1", status: "Done" },
    { period: "2026-Q2", status: "In Progress" }
  ]),
  ""
);

assert.match(
  RoadmapPeriods.validateUniquePeriods([
    { period: "2026-Q2", status: "Done" },
    { period: "2026-Q2", status: "Not Started" }
  ]),
  /duplicate 2026-Q2/i
);

const multiPeriod = RoadmapPeriods.normalizePeriods(
  [
    { period: "2025-Q4", status: "Done" },
    { period: "2026-Q1", status: "In Progress" },
    { period: "2026-Q3", status: "Not Started" }
  ],
  { statusOptions: ["Not Started", "In Progress", "Done"] }
);
assert.strictEqual(multiPeriod.length, 3);
assert.deepStrictEqual(
  multiPeriod.map((entry) => entry.period),
  ["2025-Q4", "2026-Q1", "2026-Q3"]
);

const imported = RoadmapPeriods.parseImportPeriods(
  '[{"period":"2026-Q1","status":"Done"},{"period":"2026-Q3","status":"In Progress"}]',
  { statusOptions: ["Not Started", "In Progress", "Done"] }
);
assert.strictEqual(imported.length, 2);
assert.strictEqual(imported[1].period, "2026-Q3");

const legacyOnly = RoadmapPeriods.parseImportPeriods(null, {
  legacyPeriod: "2025-Q4",
  legacyStatus: "Done",
  statusOptions: ["Not Started", "In Progress", "Done"]
});
assert.strictEqual(legacyOnly.length, 1);
assert.strictEqual(legacyOnly[0].period, "2025-Q4");

const commaSeparated = RoadmapPeriods.parseImportPeriods("2025-Q4,2026-Q1", {
  legacyStatus: "Not Started",
  statusOptions: ["Not Started", "In Progress", "Done"]
});
assert.strictEqual(commaSeparated.length, 2);

const exported = RoadmapPeriods.serializeExportPeriods(imported, {
  statusOptions: ["Not Started", "In Progress", "Done"]
});
assert.ok(exported.includes("2026-Q3"));

console.log("OK: roadmap periods centralization tests passed");
