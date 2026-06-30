/**
 * Shareable deep links for portfolio view + opened roadmap.
 * Uses the URL hash (works on file:// and static hosts); also reads legacy ?query params.
 * Global: ShareLink
 */
const ShareLink = (function () {
  const PARAM_ROADMAP = "roadmap";
  const PARAM_VIEW = "view";
  const PARAM_PROFILE = "profile";
  const HASH_PREFIX = "pm";

  const VALID_VIEWS = ["table", "board", "moscow", "map", "raci", "kano", "gantt"];

  /** @type {Record<string, unknown> | null} */
  let deps = null;
  let applying = false;
  let suppressSync = false;
  /** Blocks URL writes until the incoming link is applied (prevents init from stripping params). */
  let bootComplete = false;

  function normalizeView(view) {
    const value = String(view || "").trim().toLowerCase();
    return VALID_VIEWS.includes(value) ? value : "";
  }

  function parseShareParams(search) {
    const params = new URLSearchParams(typeof search === "string" ? search : "");
    const roadmap = (params.get(PARAM_ROADMAP) || "").trim();
    const view = normalizeView(params.get(PARAM_VIEW));
    const profile = (params.get(PARAM_PROFILE) || "").trim();
    return {
      roadmap: roadmap || "",
      view,
      profile: profile || ""
    };
  }

  function readShareParamsFromLocation() {
    if (typeof window === "undefined" || !window.location) {
      return { roadmap: "", view: "", profile: "" };
    }

    const hash = String(window.location.hash || "").replace(/^#/, "").trim();
    if (hash) {
      const hashBody = hash.startsWith(`${HASH_PREFIX}/`) ? hash.slice(HASH_PREFIX.length + 1) : hash;
      const hashSearch = hashBody.startsWith("?") ? hashBody : hashBody.includes("=") ? `?${hashBody}` : "";
      if (hashSearch) {
        const fromHash = parseShareParams(hashSearch);
        if (fromHash.roadmap || fromHash.view || fromHash.profile) return fromHash;
      }
    }

    return parseShareParams(window.location.search || "");
  }

  function hasShareParamsInLocation() {
    const parsed = readShareParamsFromLocation();
    return !!(parsed.roadmap || parsed.view || parsed.profile);
  }

  function buildShareParams({ roadmapId, view, profileId } = {}) {
    const params = new URLSearchParams();
    const roadmap = String(roadmapId || "").trim();
    const profile = String(profileId || "").trim();
    const normalizedView = normalizeView(view);
    if (roadmap) params.set(PARAM_ROADMAP, roadmap);
    if (normalizedView) params.set(PARAM_VIEW, normalizedView);
    if (profile) params.set(PARAM_PROFILE, profile);
    return params;
  }

  function buildShareUrl({ roadmapId, view, profileId } = {}, baseUrl) {
    const params = buildShareParams({ roadmapId, view, profileId });
    const qs = params.toString();
    let origin = "";
    let pathname = "/";
    let search = "";
    if (typeof baseUrl === "string" && baseUrl) {
      try {
        const parsed = new URL(baseUrl);
        origin = parsed.origin;
        pathname = parsed.pathname || "/";
        search = parsed.search || "";
      } catch {
        origin = "";
        pathname = "/";
        search = "";
      }
    } else if (typeof window !== "undefined" && window.location) {
      origin = window.location.origin || "";
      pathname = window.location.pathname || "/";
      search = window.location.search || "";
    }
    const hash = qs ? `#${HASH_PREFIX}/${qs}` : "";
    return `${origin}${pathname}${search}${hash}`;
  }

  function replaceShareLocation(params) {
    if (typeof window === "undefined" || !window.history || !window.location) return;
    const qs = params.toString();
    const hash = qs ? `#${HASH_PREFIX}/${qs}` : "";
    const next = `${window.location.pathname}${window.location.search || ""}${hash}`;
    window.history.replaceState({ shareLink: true }, "", next);
  }

  function clearLegacyShareQueryParams() {
    if (typeof window === "undefined" || !window.history || !window.location) return;
    const current = new URLSearchParams(window.location.search || "");
    let changed = false;
    [PARAM_ROADMAP, PARAM_VIEW, PARAM_PROFILE].forEach((key) => {
      if (current.has(key)) {
        current.delete(key);
        changed = true;
      }
    });
    if (!changed) return;
    const qs = current.toString();
    const next = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash || ""}`;
    window.history.replaceState({ shareLink: true }, "", next);
  }

  function getSnapshot() {
    if (!deps || typeof deps.getSnapshot !== "function") return null;
    return deps.getSnapshot();
  }

  function syncUrlFromAppState() {
    if (!deps || applying || suppressSync || !bootComplete) return;
    const snapshot = getSnapshot();
    if (!snapshot) return;

    const params = buildShareParams({
      roadmapId: snapshot.roadmapId,
      view: snapshot.view,
      profileId: snapshot.profileId
    });

    const prev = readShareParamsFromLocation();
    const nextRoadmap = params.get(PARAM_ROADMAP) || "";
    const nextView = params.get(PARAM_VIEW) || "";
    const nextProfile = params.get(PARAM_PROFILE) || "";
    if (
      prev.roadmap === nextRoadmap &&
      prev.view === nextView &&
      prev.profile === nextProfile
    ) {
      return;
    }

    replaceShareLocation(params);
    clearLegacyShareQueryParams();
  }

  function highlightRoadmapInPortfolio(roadmapId) {
    if (!roadmapId || typeof document === "undefined") return;
    const escaped =
      typeof CSS !== "undefined" && typeof CSS.escape === "function"
        ? CSS.escape(roadmapId)
        : String(roadmapId).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const node =
      document.querySelector(`.roadmaps-table-card[data-roadmap-id="${escaped}"]`) ||
      document.querySelector(`.scrum-board-card[data-roadmap-id="${escaped}"]`) ||
      document.querySelector(`.moscow-board-card[data-roadmap-id="${escaped}"]`) ||
      document.querySelector(`[data-roadmap-id="${escaped}"]`) ||
      document.querySelector(`[data-id="${escaped}"]`);
    if (!node) return;
    node.classList.add("portfolio-roadmap--deep-link-focus");
    if (typeof node.scrollIntoView === "function") {
      node.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
    window.setTimeout(() => {
      node.classList.remove("portfolio-roadmap--deep-link-focus");
    }, 2400);
  }

  function openRoadmapFromDeepLink(roadmapId) {
    const openRoadmapModal = deps && deps.openRoadmapModal;
    if (typeof openRoadmapModal !== "function" || !roadmapId) return;
    const run = () => openRoadmapModal("view", roadmapId, { fromShareLink: true });
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => window.requestAnimationFrame(run));
    } else {
      run();
    }
  }

  function applyFromUrl() {
    if (!deps || applying) {
      return { appliedAny: false, appliedView: false, openedRoadmap: false };
    }
    const parsed = readShareParamsFromLocation();
    if (!parsed.roadmap && !parsed.view && !parsed.profile) {
      return { appliedAny: false, appliedView: false, openedRoadmap: false };
    }

    applying = true;
    suppressSync = true;
    let openedRoadmap = false;
    try {
      const findRoadmapWithOwner = deps.findRoadmapWithOwner;
      const switchView = deps.switchView;
      const setActiveProfile = deps.setActiveProfile;
      const isProfileUnlocked = deps.isProfileUnlocked;
      const showToast = deps.showToast;
      const queueUnlockViewRoadmap = deps.queueUnlockViewRoadmap;
      const getActiveProfileId = deps.getActiveProfileId;

      if (parsed.roadmap && typeof findRoadmapWithOwner === "function") {
        const located = findRoadmapWithOwner(parsed.roadmap);
        const ownerProfile = located && located.profile;
        if (ownerProfile && typeof setActiveProfile === "function") {
          const activeId = typeof getActiveProfileId === "function" ? getActiveProfileId() : "";
          if (ownerProfile.id && ownerProfile.id !== activeId) {
            setActiveProfile(ownerProfile.id);
          }
        }
      } else if (parsed.profile && typeof setActiveProfile === "function") {
        const activeId = typeof getActiveProfileId === "function" ? getActiveProfileId() : "";
        if (parsed.profile !== activeId) {
          setActiveProfile(parsed.profile);
        }
      }

      if (parsed.view && typeof switchView === "function") {
        switchView(parsed.view);
      }

      if (!parsed.roadmap) {
        return { appliedAny: true, appliedView: !!parsed.view, openedRoadmap: false };
      }

      if (typeof findRoadmapWithOwner !== "function") {
        return { appliedAny: true, appliedView: !!parsed.view, openedRoadmap: false };
      }

      const located = findRoadmapWithOwner(parsed.roadmap);
      const roadmap = located && located.roadmap;
      const ownerProfile = located && located.profile;
      if (!roadmap) {
        if (typeof showToast === "function") {
          showToast("Roadmap not found in this workspace. Import or sync the same data to open this link.");
        }
        return { appliedAny: true, appliedView: !!parsed.view, openedRoadmap: false };
      }

      const profileId = ownerProfile ? ownerProfile.id : parsed.profile;
      if (profileId && typeof isProfileUnlocked === "function" && !isProfileUnlocked(profileId)) {
        if (typeof queueUnlockViewRoadmap === "function") {
          queueUnlockViewRoadmap({
            profileId,
            roadmapId: parsed.roadmap,
            view: parsed.view
          });
        }
        return { appliedAny: true, appliedView: !!parsed.view, openedRoadmap: false };
      }

      openRoadmapFromDeepLink(parsed.roadmap);
      highlightRoadmapInPortfolio(parsed.roadmap);
      openedRoadmap = true;
      return { appliedAny: true, appliedView: !!parsed.view, openedRoadmap: true };
    } finally {
      suppressSync = false;
      applying = false;
    }
  }

  function init(options) {
    deps = options || {};
    bootComplete = false;
    if (typeof window !== "undefined") {
      window.addEventListener("popstate", () => {
        applyFromUrl();
      });
      window.addEventListener("hashchange", () => {
        applyFromUrl();
      });
    }
  }

  function notifyAppStateChanged() {
    syncUrlFromAppState();
  }

  function applyAfterBoot() {
    const result = applyFromUrl();
    bootComplete = true;
    syncUrlFromAppState();
    return result;
  }

  function retryAfterDataRefresh() {
    if (!hasShareParamsInLocation()) return;
    const parsed = readShareParamsFromLocation();
    if (!parsed.roadmap) return;
    const snapshot = getSnapshot();
    if (snapshot && snapshot.roadmapId === parsed.roadmap) return;
    applyFromUrl();
    syncUrlFromAppState();
  }

  function markBootComplete() {
    bootComplete = true;
    syncUrlFromAppState();
  }

  return {
    parseShareParams,
    readShareParamsFromLocation,
    buildShareUrl,
    init,
    applyAfterBoot,
    retryAfterDataRefresh,
    markBootComplete,
    notifyAppStateChanged,
    highlightRoadmapInPortfolio
  };
})();
