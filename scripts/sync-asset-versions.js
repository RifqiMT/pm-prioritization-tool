#!/usr/bin/env node
/**
 * Prefix every index.html ?v= tag with APP_ASSET_VERSION from src/constants.js.
 * Format: ?v={APP_ASSET_VERSION}-{asset-slug}
 *
 * Run via: npm run sync:assets (also runs before npm run build)
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const constantsPath = path.join(ROOT, "src/constants.js");
const indexPath = path.join(ROOT, "index.html");

function readAppAssetVersion() {
  const source = fs.readFileSync(constantsPath, "utf8");
  const match = source.match(/const APP_ASSET_VERSION = "([^"]+)"/);
  if (!match) {
    throw new Error("APP_ASSET_VERSION not found in src/constants.js");
  }
  return match[1];
}

function assetSlugFromUrl(url) {
  const clean = String(url || "").split("?")[0];
  const base = path.basename(clean, path.extname(clean));
  const dir = path.dirname(clean);
  const parent = dir === "." ? "" : path.basename(dir);
  if (parent && parent !== "src" && parent !== "css") {
    return `${parent}-${base}`.replace(/[^a-zA-Z0-9._-]+/g, "-");
  }
  return base.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function syncIndexHtml(version) {
  let html = fs.readFileSync(indexPath, "utf8");
  let replacements = 0;

  const next = html.replace(
    /((?:href|src)="[^"?]+\?v=)([^"]+)(")/g,
    (full, prefix, oldVersion, suffix) => {
      const urlMatch = prefix.match(/(?:href|src)="([^"?]+)/);
      const assetUrl = urlMatch ? urlMatch[1] : "asset";
      const slug = assetSlugFromUrl(assetUrl);
      const nextVersion = `${version}-${slug}`;
      if (oldVersion !== nextVersion) {
        replacements += 1;
      }
      return `${prefix}${nextVersion}${suffix}`;
    }
  );

  if (!html.match(/\?v=/)) {
    console.log("sync-asset-versions: no ?v= tags found in index.html");
    return;
  }

  if (replacements === 0) {
    console.log(`sync-asset-versions: all asset tags already use baseline ${version}`);
    return;
  }

  fs.writeFileSync(indexPath, next, "utf8");
  console.log(`sync-asset-versions: updated ${replacements} asset tags to baseline ${version}`);
}

const version = readAppAssetVersion();
syncIndexHtml(version);
