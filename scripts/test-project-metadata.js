/**
 * Labels/links normalization checks (no test runner required).
 */
const assert = require("assert");
const {
  normalizeProjectLabels,
  normalizeProjectLinks
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

console.log("OK: project metadata normalization tests passed");
