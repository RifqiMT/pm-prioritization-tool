#!/usr/bin/env node
/**
 * Usage: node scripts/verify-deployment.js https://your-domain.vercel.app
 */
const base = (process.argv[2] || "").replace(/\/$/, "");
if (!base) {
  console.error("Usage: node scripts/verify-deployment.js <origin>");
  process.exit(1);
}

async function main() {
  const url = base + "/api/config";
  console.log("Checking", url);

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const text = await res.text();
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
