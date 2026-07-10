#!/usr/bin/env node
/**
 * Smoke test for import file kind detection (mirrors app.js helpers).
 */
function isImportFileCsv(file) {
  if (!file) return false;
  const name = (file.name || "").toLowerCase();
  const type = (file.type || "").toLowerCase();
  return name.endsWith(".csv") || type === "text/csv" || type === "application/csv" || type === "application/vnd.ms-excel";
}

function resolveImportKind(forcedKind, file) {
  const fileIsCsv = isImportFileCsv(file);
  if (forcedKind === "json" && fileIsCsv) return "error-json";
  if (forcedKind === "csv" && !fileIsCsv) return "error-csv";
  if (forcedKind === "csv" || (forcedKind !== "json" && fileIsCsv)) return "csv";
  return "json";
}

const jsonFile = { name: "backup.json", type: "application/json" };
const csvFile = { name: "roadmaps.csv", type: "text/csv" };

const cases = [
  ["auto", jsonFile, "json"],
  ["auto", csvFile, "csv"],
  ["json", jsonFile, "json"],
  ["csv", csvFile, "csv"],
  ["json", csvFile, "error-json"],
  ["csv", jsonFile, "error-csv"]
];

cases.forEach(([kind, file, expected]) => {
  const got = resolveImportKind(kind, file);
  if (got !== expected) {
    console.error(`FAIL kind=${kind} file=${file.name}: expected ${expected}, got ${got}`);
    process.exit(1);
  }
});

console.log("Import file kind tests passed");
