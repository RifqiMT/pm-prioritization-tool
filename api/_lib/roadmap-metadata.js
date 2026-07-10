/**
 * Server-side normalization for roadmap labels/links before MongoDB persist.
 * Mirrors client rules in src/app.js so legacy or partial payloads still round-trip.
 */

function normalizeRoadmapLabels(raw) {
  if (!Array.isArray(raw)) {
    if (typeof raw === "string" && raw.trim()) {
      const parts = raw
        .split(/[|,]/)
        .map((part) => part.trim())
        .filter(Boolean);
      const source = parts.length > 1 ? parts : [raw.trim()];
      const seen = new Set();
      const out = [];
      source.forEach((label) => {
        if (!label || seen.has(label)) return;
        seen.add(label);
        out.push(label);
      });
      return out;
    }
    return [];
  }
  const seen = new Set();
  const out = [];
  raw.forEach((item) => {
    const label = String(item || "").trim();
    if (!label || seen.has(label)) return;
    seen.add(label);
    out.push(label);
  });
  return out;
}

function normalizeRoadmapLinkUrl(url) {
  const trimmed = String(url || "").trim();
  if (!trimmed) return null;
  let candidate = trimmed;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(candidate)) {
    candidate = "https://" + candidate;
  }
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.href;
  } catch {
    return null;
  }
}

function linkPreviewLabel(url) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname && parsed.pathname !== "/" ? parsed.pathname : "";
    return parsed.hostname + path;
  } catch {
    return url;
  }
}

function normalizeRoadmapLinks(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  raw.forEach((item) => {
    if (typeof item === "string") {
      const url = normalizeRoadmapLinkUrl(item);
      if (!url) return;
      const label = linkPreviewLabel(url) || url;
      const key = label + "\0" + url;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ label, url });
      return;
    }
    if (!item || typeof item !== "object") return;
    const label = String(
      item.label != null
        ? item.label
        : item.text != null
          ? item.text
          : item.name != null
            ? item.name
            : item.title || ""
    ).trim();
    const url = normalizeRoadmapLinkUrl(item.url || item.href || item.link || "");
    if (!label || !url) return;
    const key = label + "\0" + url;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ label, url });
  });
  return out;
}

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

const ROADMAP_TASK_STATUSES = [
  "Not Started",
  "In Progress",
  "On Hold",
  "Done",
  "Cancelled"
];

function normalizeRoadmapTaskStatus(status) {
  const value = String(status || "").trim();
  return ROADMAP_TASK_STATUSES.includes(value) ? value : "Not Started";
}

function normalizeRoadmapTasks(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  raw.forEach((task) => {
    if (!task || typeof task !== "object") return;
    const name = String(task.name != null ? task.name : task.title || "").trim();
    if (!name) return;
    out.push({
      name,
      status: normalizeRoadmapTaskStatus(task.status)
    });
  });
  return out;
}

function normalizeKanoAxisLevel(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 5) return null;
  return n;
}

function normalizeRoadmapNote(raw) {
  if (raw == null) return null;
  const value = String(raw).trim();
  if (!value) return null;
  const plain = value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return null;
  return value;
}

function normalizeRoadmapForStorage(roadmap) {
  if (!roadmap || typeof roadmap !== "object") return roadmap;
  return Object.assign({}, roadmap, {
    labels: normalizeRoadmapLabels(roadmap.labels),
    links: normalizeRoadmapLinks(roadmap.links),
    tasks: normalizeRoadmapTasks(roadmap.tasks),
    raci: normalizeRoadmapRaci(roadmap.raci),
    kanoFunctionality: normalizeKanoAxisLevel(roadmap.kanoFunctionality),
    kanoSatisfaction: normalizeKanoAxisLevel(roadmap.kanoSatisfaction),
    note: normalizeRoadmapNote(roadmap.note)
  });
}

function normalizeProfilesPayload(profiles) {
  if (!Array.isArray(profiles)) return profiles;
  return profiles.map((profile) => {
    if (!profile || typeof profile !== "object") return profile;
    const next = Object.assign({}, profile);
    const roadmapsSource = Array.isArray(profile.roadmaps)
      ? profile.roadmaps
      : Array.isArray(profile.projects)
        ? profile.projects
        : null;
    if (roadmapsSource) {
      next.roadmaps = roadmapsSource.map(normalizeRoadmapForStorage);
      delete next.projects;
    }
    return next;
  });
}

function normalizeWorkspacePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }
  const next = Object.assign({}, payload);
  if (Array.isArray(payload.profiles)) {
    next.profiles = normalizeProfilesPayload(payload.profiles);
  }
  return next;
}

const RoadmapMetadata = {
  normalizeWorkspacePayload,
  normalizeRoadmapLabels,
  normalizeRoadmapLinks,
  normalizeRoadmapTasks,
  normalizeRoadmapRaci,
  normalizeKanoAxisLevel,
  normalizeRoadmapNote
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = RoadmapMetadata;
}

if (typeof window !== "undefined") {
  window.RoadmapMetadata = RoadmapMetadata;
}
