/**
 * Cost of Delay compute/sanitize tests (workshop three-part model + legacy keys).
 * CoD is independent of Financial impact — no shared values or coupling flags.
 */
const assert = require("assert");
const CostOfDelay = require("../src/modules/cost-of-delay.js");

assert.ok(CostOfDelay);
assert.strictEqual(typeof CostOfDelay.compute, "function");
assert.strictEqual(typeof CostOfDelay.sanitizeInputs, "function");
assert.strictEqual(typeof CostOfDelay.buildHowToUse, "function");

const empty = CostOfDelay.compute({});
assert.strictEqual(empty.costOfDelayValue, null);
assert.match(empty.explanation, /Step 1/i);
assert.match(empty.howToUse, /compare Cost of Delay/i);

const basic = CostOfDelay.compute({
  userBusinessValue: 10000,
  delayPeriods: 3,
  durationUnit: "month"
});
assert.strictEqual(basic.costOfDelayValue, 30000);
assert.strictEqual(basic.breakdown.waitingPerPeriod, 10000);
assert.strictEqual(basic.breakdown.delayedValue, 30000);
assert.match(basic.explanation, /If we wait about 3 months/i);
assert.match(basic.explanation, /10,000/);
assert.match(basic.explanation, /value people and the business miss/i);
assert.match(basic.howToUse, /planning signal/i);

const comprehensive = CostOfDelay.compute({
  userBusinessValue: 8000,
  timePressureValue: 2000,
  riskOpportunityValue: 1500,
  delayPeriods: 2,
  durationUnit: "week",
  oneTimeWaitingCost: 500
});
assert.strictEqual(comprehensive.breakdown.waitingPerPeriod, 11500);
assert.strictEqual(comprehensive.costOfDelayValue, 23500);
assert.match(comprehensive.explanation, /timing pressure/i);
assert.match(comprehensive.explanation, /risk or closed opportunity/i);
assert.match(comprehensive.explanation, /one-time cost/i);

const legacy = CostOfDelay.compute({
  valuePerPeriod: 5000,
  delayPeriods: 2,
  durationUnit: "week",
  extraCostOfWaiting: 1000
});
assert.strictEqual(legacy.costOfDelayValue, 11000);
assert.strictEqual(legacy.breakdown.userBusinessValue, 5000);
assert.strictEqual(legacy.breakdown.oneTimeWaitingCost, 1000);

const oneTimeOnly = CostOfDelay.compute({
  oneTimeWaitingCost: 2500
});
assert.strictEqual(oneTimeOnly.costOfDelayValue, 2500);
assert.match(oneTimeOnly.explanation, /one-time cost/i);

// Legacy coupling flag must be ignored — CoD never reads Financial impact.
const ignoredCoupling = CostOfDelay.compute(
  { useFinancialImpact: true, delayPeriods: 4, durationUnit: "quarter" },
  { financialImpactValue: 2000 }
);
assert.strictEqual(ignoredCoupling.costOfDelayValue, null);
assert.strictEqual(ignoredCoupling.breakdown.userBusinessValue, null);

const sanitized = CostOfDelay.sanitizeInputs({
  valuePerPeriod: "12.5",
  delayPeriods: "2",
  durationUnit: "weeks",
  extraCostOfWaiting: "",
  useFinancialImpact: "true"
});
assert.strictEqual(sanitized.userBusinessValue, 12.5);
assert.strictEqual(sanitized.valuePerPeriod, 12.5);
assert.strictEqual(sanitized.delayPeriods, 2);
assert.strictEqual(sanitized.durationUnit, "week");
assert.strictEqual(sanitized.oneTimeWaitingCost, null);
assert.strictEqual(Object.prototype.hasOwnProperty.call(sanitized, "useFinancialImpact"), false);

assert.strictEqual(CostOfDelay.hasMeaningfulInputs({}), false);
assert.strictEqual(CostOfDelay.hasMeaningfulInputs({ userBusinessValue: 0 }), false);
assert.strictEqual(CostOfDelay.hasMeaningfulInputs({ userBusinessValue: 100 }), true);
assert.strictEqual(CostOfDelay.hasMeaningfulInputs({ timePressureValue: 50 }), true);
assert.strictEqual(CostOfDelay.hasMeaningfulInputs({ useFinancialImpact: true }), false);

assert.strictEqual(
  CostOfDelay.validationMessage({ userBusinessValue: 100, delayPeriods: 1 }, null),
  "Select a currency when Cost of Delay is provided."
);
assert.strictEqual(
  CostOfDelay.validationMessage({ userBusinessValue: 100, delayPeriods: 1 }, "EUR"),
  ""
);

const singular = CostOfDelay.compute({
  userBusinessValue: 100,
  delayPeriods: 1,
  durationUnit: "week"
});
assert.match(singular.explanation, /1 week(?!s)/i);

console.log("test-cost-of-delay: ok");
