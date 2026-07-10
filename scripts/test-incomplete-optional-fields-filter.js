#!/usr/bin/env node
/**
 * Unit tests for incomplete optional fields filter (src/modules/incomplete-optional-fields.js).
 */
const assert = require("assert");
const IncompleteOptionalFields = require("../src/modules/incomplete-optional-fields.js");

const {
  roadmapIsMissingOptionalField,
  roadmapMatchesIncompleteOptionalFieldsFilter
} = IncompleteOptionalFields;

const sparse = { id: "sparse", title: "Sparse roadmap" };
const partial = {
  id: "partial",
  title: "Partial",
  labels: ["alpha"],
  moscowCategory: "Should"
};
const rich = {
  id: "rich",
  title: "Rich",
  note: "Context",
  labels: ["alpha"],
  links: ["https://example.com"],
  reachValue: 100,
  impactValue: 3,
  confidenceValue: 80,
  effortValue: 2,
  moscowCategory: "Must",
  kanoSatisfaction: 3,
  kanoFunctionality: 3,
  roadmapType: "Feature",
  tshirtSize: "M",
  roadmapDeadline: "2026-12-31",
  roadmapPeriods: [{ id: "p1", period: "2026-Q1" }],
  tasks: [{ name: "Ship" }],
  countries: ["US"],
  raci: { responsible: [{ name: "Alice", domain: "Business" }] },
  financialImpactValue: 5000
};

assert.strictEqual(roadmapIsMissingOptionalField(sparse, "labels"), true);
assert.strictEqual(roadmapIsMissingOptionalField(partial, "labels"), false);
assert.strictEqual(roadmapIsMissingOptionalField(partial, "links"), true);
assert.strictEqual(roadmapIsMissingOptionalField(rich, "links"), false);

assert.strictEqual(roadmapMatchesIncompleteOptionalFieldsFilter(sparse, [], "any"), true);
assert.strictEqual(
  roadmapMatchesIncompleteOptionalFieldsFilter(sparse, ["labels", "links"], "any"),
  true
);
assert.strictEqual(
  roadmapMatchesIncompleteOptionalFieldsFilter(partial, ["labels", "links"], "any"),
  true
);
assert.strictEqual(
  roadmapMatchesIncompleteOptionalFieldsFilter(rich, ["labels", "links"], "any"),
  false
);
assert.strictEqual(
  roadmapMatchesIncompleteOptionalFieldsFilter(partial, ["labels", "links"], "all"),
  false
);
assert.strictEqual(
  roadmapMatchesIncompleteOptionalFieldsFilter(sparse, ["labels", "links"], "all"),
  true
);

const zeroRice = { id: "zero-rice", title: "Zero RICE", reachValue: 0, impactValue: 0 };
const zeroFinancial = { id: "zero-fin", title: "Zero financial", financialImpactValue: 0 };
const zeroKano = { id: "zero-kano", title: "Zero KANO", kanoSatisfaction: 0, kanoFunctionality: 0 };

assert.strictEqual(roadmapIsMissingOptionalField(zeroRice, "rice"), true);
assert.strictEqual(roadmapIsMissingOptionalField(zeroFinancial, "financial"), true);
assert.strictEqual(roadmapIsMissingOptionalField(zeroKano, "kano"), true);
assert.strictEqual(
  roadmapIsMissingOptionalField({ ...zeroRice, reachValue: 120, impactValue: 0 }, "rice"),
  true
);

const partialRiceWithZero = {
  id: "partial-rice-zero",
  title: "Partial RICE zero impact",
  reachValue: 100,
  impactValue: 0,
  confidenceValue: 80,
  effortValue: 2
};
assert.strictEqual(roadmapIsMissingOptionalField(partialRiceWithZero, "rice"), true);

const partialRiceComplete = {
  id: "partial-rice-complete",
  title: "Complete RICE",
  reachValue: 100,
  impactValue: 3,
  confidenceValue: 80,
  effortValue: 2
};
assert.strictEqual(roadmapIsMissingOptionalField(partialRiceComplete, "rice"), false);

const financialWithZeroInput = {
  id: "financial-zero-input",
  title: "Financial zero input",
  financialImpactInputs: { revenue: 5000, cost: 0 }
};
assert.strictEqual(roadmapIsMissingOptionalField(financialWithZeroInput, "financial"), true);

const currencyOnly = {
  id: "currency-only",
  title: "Currency only",
  financialImpactCurrency: "USD",
  financialImpactFramework: "npv"
};
assert.strictEqual(roadmapIsMissingOptionalField(currencyOnly, "financial"), true);

const riceOnly = { id: "rice-only", title: "RICE only", reachValue: 50 };
assert.strictEqual(
  roadmapMatchesIncompleteOptionalFieldsFilter(riceOnly, ["rice", "financial"], "any"),
  true
);
assert.strictEqual(
  roadmapMatchesIncompleteOptionalFieldsFilter(partialRiceComplete, ["rice", "financial"], "all"),
  false
);
assert.strictEqual(
  roadmapMatchesIncompleteOptionalFieldsFilter(sparse, ["rice", "financial"], "any"),
  true
);
assert.strictEqual(
  roadmapMatchesIncompleteOptionalFieldsFilter(rich, ["rice", "financial"], "any"),
  false
);

console.log("Incomplete optional fields filter tests passed");
