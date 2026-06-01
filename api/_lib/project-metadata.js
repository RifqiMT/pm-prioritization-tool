/**
 * Server-side normalization for project labels/links before MongoDB persist.
 * Mirrors client rules in src/app.js so legacy or partial payloads still round-trip.
 */

function normalizeProjectLabels(raw) {
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

function normalizeProjectLinkUrl(url) {
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

function normalizeProjectLinks(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  raw.forEach((item) => {
    if (typeof item === "string") {
      const url = normalizeProjectLinkUrl(item);
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
    const url = normalizeProjectLinkUrl(item.url || item.href || item.link || "");
    if (!label || !url) return;
    const key = label + "\0" + url;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ label, url });
  });
  return out;
}

function normalizeProjectForStorage(project) {
  if (!project || typeof project !== "object") return project;
  return Object.assign({}, project, {
    labels: normalizeProjectLabels(project.labels),
    links: normalizeProjectLinks(project.links)
  });
}

function normalizeProfilesPayload(profiles) {
  if (!Array.isArray(profiles)) return profiles;
  return profiles.map((profile) => {
    if (!profile || typeof profile !== "object") return profile;
    const next = Object.assign({}, profile);
    if (Array.isArray(profile.projects)) {
      next.projects = profile.projects.map(normalizeProjectForStorage);
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

module.exports = {
  normalizeWorkspacePayload,
  normalizeProjectLabels,
  normalizeProjectLinks
};
