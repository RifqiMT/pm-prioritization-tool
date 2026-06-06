/**
 * Profile view RACI lead counts (no test runner required).
 */
const assert = require("assert");

const RACI_ROLES = ["responsible", "accountable", "consulted", "informed"];
const RACI_DOMAIN_OPTIONS = ["Business", "Tech"];

function normalizeRaciDomain(domain) {
  const value = String(domain || "").trim();
  return RACI_DOMAIN_OPTIONS.includes(value) ? value : "Business";
}

function normalizeRaciEntries(entries) {
  if (!Array.isArray(entries)) return [];
  const out = [];
  entries.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    const name = String(entry.name != null ? entry.name : entry.person || entry.label || "").trim();
    if (!name) return;
    out.push({
      name,
      domain: normalizeRaciDomain(entry.domain || entry.type || entry.side)
    });
  });
  return out;
}

function normalizeRoadmapRaci(raci) {
  const source = raci && typeof raci === "object" ? raci : {};
  return {
    responsible: normalizeRaciEntries(source.responsible),
    accountable: normalizeRaciEntries(source.accountable),
    consulted: normalizeRaciEntries(source.consulted),
    informed: normalizeRaciEntries(source.informed)
  };
}

function buildProfileViewRaciActorCounts(roadmaps, domain) {
  const targetDomain = normalizeRaciDomain(domain);
  const countsByKey = {};
  const displayNames = {};

  roadmaps.forEach((roadmap) => {
    const raci = normalizeRoadmapRaci(roadmap && roadmap.raci);
    const actorsInRoadmap = new Set();

    RACI_ROLES.forEach((role) => {
      raci[role].forEach((entry) => {
        if (entry.domain !== targetDomain) return;
        const name = String(entry.name || "").trim();
        if (!name) return;
        const key = name.toLowerCase();
        actorsInRoadmap.add(key);
        if (!displayNames[key]) displayNames[key] = name;
      });
    });

    actorsInRoadmap.forEach((key) => {
      countsByKey[key] = (countsByKey[key] || 0) + 1;
    });
  });

  const counts = {};
  Object.entries(countsByKey).forEach(([key, count]) => {
    counts[displayNames[key]] = count;
  });
  return counts;
}

const roadmaps = [
  {
    id: "r1",
    raci: {
      responsible: [{ name: "Alex Kim", domain: "Business" }],
      accountable: [{ name: "Alex Kim", domain: "Business" }],
      consulted: [{ name: "Sam Lee", domain: "Tech" }],
      informed: []
    }
  },
  {
    id: "r2",
    raci: {
      responsible: [{ name: "Sam Lee", domain: "Tech" }],
      accountable: [],
      consulted: [{ name: "Alex Kim", domain: "Business" }],
      informed: []
    }
  },
  {
    id: "r3",
    raci: {
      responsible: [{ name: "sam lee", domain: "Tech" }],
      accountable: [],
      consulted: [],
      informed: []
    }
  }
];

const businessCounts = buildProfileViewRaciActorCounts(roadmaps, "Business");
assert.strictEqual(businessCounts["Alex Kim"], 2);
assert.strictEqual(Object.keys(businessCounts).length, 1);

const techCounts = buildProfileViewRaciActorCounts(roadmaps, "Tech");
assert.strictEqual(techCounts["Sam Lee"], 3);
assert.strictEqual(Object.keys(techCounts).length, 1);

assert.deepStrictEqual(buildProfileViewRaciActorCounts([], "Business"), {});
assert.deepStrictEqual(buildProfileViewRaciActorCounts([{ raci: {} }], "Tech"), {});

console.log("test-profile-view-raci-leads.js: all assertions passed");
