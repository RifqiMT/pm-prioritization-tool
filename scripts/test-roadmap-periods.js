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

console.log("OK: roadmap periods centralization tests passed");
