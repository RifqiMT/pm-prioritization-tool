/**
 * Labels/links normalization checks (no test runner required).
 */
const assert = require("assert");
const {
  normalizeWorkspacePayload,
  normalizeRoadmapLabels,
  normalizeRoadmapLinks,
  normalizeRoadmapTasks,
  normalizeRoadmapRaci,
  normalizeKanoAxisLevel,
  normalizeRoadmapNote
} = require("../api/_lib/roadmap-metadata");

assert.deepStrictEqual(normalizeRoadmapLabels("alpha, beta | gamma"), [
  "alpha",
  "beta",
  "gamma"
]);

assert.deepStrictEqual(
  normalizeRoadmapLinks([
    { name: "Spec", href: "example.com/doc" },
    "https://docs.example.com/guide"
  ]),
  [
    { label: "Spec", url: "https://example.com/doc" },
    { label: "docs.example.com/guide", url: "https://docs.example.com/guide" }
  ]
);

assert.deepStrictEqual(
  normalizeRoadmapLinks([{ text: "Wiki", url: "https://wiki.test/a" }]),
  [{ label: "Wiki", url: "https://wiki.test/a" }]
);

assert.deepStrictEqual(
  normalizeRoadmapTasks([{ title: "Launch", status: "invalid" }]),
  [{ name: "Launch", status: "Not Started" }]
);

assert.deepStrictEqual(
  normalizeRoadmapRaci({
    responsible: [{ name: "Alice", domain: "Business" }, { person: "Bob", type: "Tech" }],
    accountable: [{ label: "Carol", side: "Business" }],
    consulted: "invalid",
    informed: [{ name: "", domain: "Tech" }, { name: "Dave", domain: "Unknown" }]
  }),
  {
    responsible: [
      { name: "Alice", domain: "Business" },
      { name: "Bob", domain: "Tech" }
    ],
    accountable: [{ name: "Carol", domain: "Business" }],
    consulted: [],
    informed: [{ name: "Dave", domain: "Business" }]
  }
);

assert.strictEqual(normalizeKanoAxisLevel(3), 3);
assert.strictEqual(normalizeKanoAxisLevel("4"), 4);
assert.strictEqual(normalizeKanoAxisLevel(0), null);
assert.strictEqual(normalizeKanoAxisLevel(6), null);
assert.strictEqual(normalizeKanoAxisLevel("x"), null);

assert.strictEqual(normalizeRoadmapNote("  Internal context  "), "Internal context");
assert.strictEqual(normalizeRoadmapNote("   "), null);
assert.strictEqual(normalizeRoadmapNote(null), null);
assert.strictEqual(normalizeRoadmapNote("<p></p>"), null);
assert.strictEqual(normalizeRoadmapNote("<p><strong>Legal</strong> review</p>"), "<p><strong>Legal</strong> review</p>");

const migrated = normalizeWorkspacePayload({
  profiles: [
    {
      id: "p1",
      name: "Legacy",
      projects: [{ id: "old1", labels: ["alpha"], links: ["https://example.com"] }]
    }
  ]
});
assert.ok(Array.isArray(migrated.profiles[0].roadmaps));
assert.strictEqual(migrated.profiles[0].roadmaps[0].id, "old1");
assert.strictEqual(migrated.profiles[0].roadmaps[0].labels[0], "alpha");
assert.strictEqual(migrated.profiles[0].projects, undefined);

console.log("OK: roadmap metadata normalization tests passed");
