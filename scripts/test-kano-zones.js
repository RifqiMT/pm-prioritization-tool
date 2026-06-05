/**
 * KANO 5×5 zone matrix checks (no test runner required).
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const constantsSrc = fs.readFileSync(path.join(__dirname, "../src/constants.js"), "utf8");
const ctx = { console };
vm.runInNewContext(
  `${constantsSrc}
this.__getZone = getKanoZoneIdFromPosition;
this.__getCategory = getKanoCategoryFromPosition;
this.__matrix = KANO_ZONE_MATRIX;`,
  ctx
);

const getZone = ctx.__getZone;
const getCategory = ctx.__getCategory;
const matrix = ctx.__matrix;

assert.strictEqual(getZone(3, 5), "attractive", "F3·S5 should be attractive (was indifferent)");
assert.strictEqual(getZone(5, 3), "indifferent", "F5·S3 should be indifferent (was must-be)");
assert.strictEqual(getZone(4, 3), "indifferent", "F4·S3 should be indifferent (was must-be)");
assert.strictEqual(getZone(2, 3), "must-be", "F2·S3 should be must-be baseline");
assert.strictEqual(getZone(3, 1), "reverse", "F3·S1 should be reverse");
assert.strictEqual(getZone(4, 5), "one-dimensional", "F4·S5 should be one-dimensional");
assert.strictEqual(getZone(1, 1), "indifferent", "F1·S1 should be indifferent");

Object.keys(matrix).forEach((sKey) => {
  const s = Number(sKey);
  matrix[sKey].forEach((zoneId, index) => {
    const f = index + 1;
    assert.strictEqual(getZone(f, s), zoneId, `matrix[${s}][${f}] mismatch`);
    const category = getCategory(f, s);
    assert.ok(category, `category missing for F${f} S${s}`);
    assert.strictEqual(category.id, zoneId, `category id mismatch for F${f} S${s}`);
    assert.ok(category.label, `category label missing for F${f} S${s}`);
  });
});

assert.strictEqual(getZone(0, 3), null);
assert.strictEqual(getZone(3, 6), null);
assert.strictEqual(getCategory(null, 3), null);

console.log("OK: KANO zone matrix (25 cells + edge cases)");
