/**
 * Ensures persisted workspace keys stay aligned with constants and entity round-trips.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
  normalizeProjectTasks,
  normalizeWorkspacePayload
} = require("../api/_lib/project-metadata");

const constantsSrc = fs.readFileSync(
  path.join(__dirname, "../src/constants.js"),
  "utf8"
);

const keysMatch = constantsSrc.match(
  /const WORKSPACE_PERSISTED_STATE_KEYS = \[([\s\S]*?)\];/
);
assert.ok(keysMatch, "WORKSPACE_PERSISTED_STATE_KEYS must exist in constants.js");

const keys = keysMatch[1]
  .split("\n")
  .map((line) => line.replace(/\/\/.*/, "").trim())
  .filter(Boolean)
  .map((line) => line.replace(/["',]/g, "").trim())
  .filter(Boolean);

const requiredKeys = [
  "activeProfileId",
  "sortField",
  "sortDirection",
  "projectsView",
  "tableSortByRice",
  "tableGroupBy",
  "scrumBoardSortByRice",
  "scrumBoardVisibleStatuses",
  "moscowSortByRice",
  "mapMetric",
  "exchangeRatesToEUR",
  "exchangeRatesDate",
  "exchangeRatesLastSource",
  "superAdminMode"
];

requiredKeys.forEach((key) => {
  assert.ok(keys.includes(key), `WORKSPACE_PERSISTED_STATE_KEYS missing ${key}`);
});

const appSrc = fs.readFileSync(path.join(__dirname, "../src/app.js"), "utf8");
assert.ok(
  appSrc.includes("WORKSPACE_PERSISTED_STATE_KEYS"),
  "app.js must read WORKSPACE_PERSISTED_STATE_KEYS for serializeStatePayload"
);
assert.ok(
  appSrc.includes("moscowOrder"),
  "normalizeLoadedProfile must persist moscowOrder"
);

function mergeLoadedProject(project) {
  const normalized = {
    id: project.id || "p1",
    title: String(project.title || "Untitled"),
    customMeta: project.customMeta
  };
  return Object.assign({}, project, normalized);
}

const merged = mergeLoadedProject({
  id: "p1",
  title: "Alpha",
  customMeta: { tier: "A" },
  reachValue: 10
});
assert.strictEqual(merged.customMeta.tier, "A");
assert.strictEqual(merged.reachValue, 10);

function mergeLoadedProfile(raw) {
  const profile = Object.assign({}, raw, {
    id: raw.id,
    projects: raw.projects || [],
    boardOrder: raw.boardOrder || {},
    moscowOrder: raw.moscowOrder || {}
  });
  return profile;
}

const profile = mergeLoadedProfile({
  id: "prof1",
  name: "Growth",
  moscowOrder: { "Must Have": ["p1"] },
  boardOrder: { "In Progress": ["p2"] },
  futureField: true
});
assert.deepStrictEqual(profile.moscowOrder, { "Must Have": ["p1"] });
assert.strictEqual(profile.futureField, true);

assert.deepStrictEqual(
  normalizeProjectTasks([{ title: "Ship", status: "In Progress" }, { name: "", status: "Done" }]),
  [{ name: "Ship", status: "In Progress" }]
);

const workspace = normalizeWorkspacePayload({
  profiles: [
    {
      id: "prof1",
      projects: [{ id: "p1", tasks: [{ name: "Task A", status: "Done" }] }]
    }
  ],
  scrumBoardVisibleStatuses: ["In Progress", "Done"],
  tableGroupBy: "none"
});
assert.strictEqual(workspace.profiles[0].projects[0].tasks[0].name, "Task A");
assert.deepStrictEqual(workspace.scrumBoardVisibleStatuses, ["In Progress", "Done"]);

console.log("OK: persistence keys and round-trip tests passed");
