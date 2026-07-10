#!/usr/bin/env node
/**
 * Usage: node scripts/verify-deployment.js https://your-domain.vercel.app
 *
 * Checks cloud API health and that production serves the expected import-fix bundle.
 */
const DEFAULT_PRODUCTION = "https://pm-prioritization-tool-six.vercel.app";
const EXPECTED_APP_BUNDLE = "app.js?v=20260709-import-fix-v2";
const EXPECTED_MERGE_BUNDLE = "workspace-merge.js?v=20260709-import-fix-v2";

const base = (process.argv[2] || DEFAULT_PRODUCTION).replace(/\/$/, "");
if (!base) {
  console.error("Usage: node scripts/verify-deployment.js [origin]");
  console.error("Default production:", DEFAULT_PRODUCTION);
  process.exit(1);
}

function assertBundleVersion(rootText) {
  const missing = [];
  if (!rootText.includes(EXPECTED_APP_BUNDLE)) {
    missing.push(EXPECTED_APP_BUNDLE);
  }
  if (!rootText.includes(EXPECTED_MERGE_BUNDLE)) {
    missing.push(EXPECTED_MERGE_BUNDLE);
  }
  if (!missing.length) {
    console.log("OK: Production HTML references latest import-fix bundles.");
    return;
  }
  console.error("FAIL: Production is missing latest client bundles:");
  missing.forEach((bundle) => console.error("  -", bundle));
  console.error("Redeploy from main after pushing import-fix-v2 changes, then hard-refresh.");
  process.exit(8);
}

async function main() {
  const rootRes = await fetch(base + "/");
  const rootText = await rootRes.text();
  if (
    rootText.includes("create-react-app") ||
    (rootText.includes("PM Prioritization Matrix") &&
      !rootText.includes("Product Management Prioritization Tool"))
  ) {
    console.error("FAIL: Homepage is the old React app, not this repository.");
    console.error("Use production URL:", DEFAULT_PRODUCTION);
    process.exit(6);
  }
  if (
    !rootText.includes("app-shell") &&
    !rootText.includes("Product Management Prioritization Tool")
  ) {
    console.warn("WARN: Homepage may not be the expected static app.");
  }

  assertBundleVersion(rootText);

  const url = base + "/api/config";
  console.log("Checking", url);

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const text = await res.text();

  if (res.status === 401 && text.includes("Authentication Required")) {
    console.error("FAIL: Vercel Deployment Protection blocks /api (401).");
    console.error("Disable: Vercel → Roadmap → Deployment Protection → turn off for Production.");
    process.exit(7);
  }

  const isHtml = /^\s*</.test(text) || (res.headers.get("content-type") || "").includes("text/html");

  if (isHtml) {
    console.error("FAIL: /api/config returned HTML (wrong deployment or SPA rewrite).");
    console.error("First 120 chars:", text.slice(0, 120).replace(/\s+/g, " "));
    process.exit(2);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error("FAIL: Invalid JSON from /api/config");
    console.error(text.slice(0, 200));
    process.exit(3);
  }

  if (!data.ok) {
    console.error("FAIL: API ok=false", data);
    process.exit(4);
  }

  if (data.storage !== "mongodb") {
    console.error("FAIL: storage is not mongodb. Set MONGODB_URI on Vercel and redeploy.");
    console.error(data);
    process.exit(5);
  }

  console.log("OK: Cloud API is live.");
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error("FAIL:", err.message || err);
  process.exit(1);
});
