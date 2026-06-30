/**
 * Share-link URL parse/build helpers.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const shareLinkSrc = fs.readFileSync(
  path.join(__dirname, "../src/modules/share-link.js"),
  "utf8"
);

function createSandbox(locationOverrides) {
  const location = Object.assign(
    {
      pathname: "/index.html",
      search: "",
      hash: "",
      origin: "https://example.test"
    },
    locationOverrides || {}
  );
  return {
    URLSearchParams,
    URL,
    window: {
      location,
      history: { replaceState() {} },
      addEventListener() {},
      requestAnimationFrame(fn) {
        if (typeof fn === "function") fn();
      },
      setTimeout(fn) {
        if (typeof fn === "function") fn();
      }
    },
    document: {
      getElementById() {
        return null;
      },
      querySelector() {
        return null;
      },
      body: {
        appendChild() {},
        removeChild() {}
      },
      execCommand() {
        return true;
      }
    },
    navigator: { clipboard: { async writeText() {} } },
    console
  };
}

function loadShareLink(sandbox) {
  vm.runInNewContext(`${shareLinkSrc}\nthis.ShareLink = ShareLink;`, sandbox);
  return sandbox.ShareLink;
}

const ShareLink = loadShareLink(createSandbox());
assert.ok(ShareLink, "ShareLink global must be defined");

const parsed = ShareLink.parseShareParams("?roadmap=rm-1&view=board&profile=pr-1");
assert.strictEqual(parsed.roadmap, "rm-1");
assert.strictEqual(parsed.view, "board");
assert.strictEqual(parsed.profile, "pr-1");

const hashSandbox = createSandbox({
  hash: "#pm/roadmap=rm-2&view=gantt&profile=pr-3",
  search: "?roadmap=legacy"
});
const ShareLinkHash = loadShareLink(hashSandbox);
const fromHash = ShareLinkHash.readShareParamsFromLocation();
assert.strictEqual(fromHash.roadmap, "rm-2");
assert.strictEqual(fromHash.view, "gantt");
assert.strictEqual(fromHash.profile, "pr-3");

const built = ShareLink.buildShareUrl(
  {
    roadmapId: "rm-42",
    view: "gantt",
    profileId: "pr-9"
  },
  "https://example.test/app/?apiKey=secret"
);
assert.strictEqual(
  built,
  "https://example.test/app/?apiKey=secret#pm/roadmap=rm-42&view=gantt&profile=pr-9"
);

console.log("test-share-link: ok");
