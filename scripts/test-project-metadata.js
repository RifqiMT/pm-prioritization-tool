/**
 * Labels/links normalization checks (no test runner required).
 */
const assert = require("assert");
const {
  normalizeProjectLabels,
  normalizeProjectLinks,
  normalizeProjectTasks,
  normalizeProjectRaci
} = require("../api/_lib/project-metadata");

assert.deepStrictEqual(normalizeProjectLabels("alpha, beta | gamma"), [
  "alpha",
  "beta",
  "gamma"
]);

assert.deepStrictEqual(
  normalizeProjectLinks([
    { name: "Spec", href: "example.com/doc" },
    "https://docs.example.com/guide"
  ]),
  [
    { label: "Spec", url: "https://example.com/doc" },
    { label: "docs.example.com/guide", url: "https://docs.example.com/guide" }
  ]
);

assert.deepStrictEqual(
  normalizeProjectLinks([{ text: "Wiki", url: "https://wiki.test/a" }]),
  [{ label: "Wiki", url: "https://wiki.test/a" }]
);

assert.deepStrictEqual(
  normalizeProjectTasks([{ title: "Launch", status: "invalid" }]),
  [{ name: "Launch", status: "Not Started" }]
);

assert.deepStrictEqual(
  normalizeProjectRaci({
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

console.log("OK: project metadata normalization tests passed");
