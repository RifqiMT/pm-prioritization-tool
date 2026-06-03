/**
 * Fullscreen module — phones/tablets use a body-level host (teleport) for reliable layout;
 * desktop uses native Fullscreen API with in-place pseudo fallback.
 */
(function (global) {
  const PORTAL_IDS = [
    "exportFormatModal", "importFormatModal", "projectModal",
    "profileViewModal", "profileEditModal", "profileDeleteModal",
    "projectDeleteModal", "projectBulkTransferModal", "toastContainer"
  ];

  const COMPACT_MQ =
    typeof COMPACT_LAYOUT_MAX_WIDTH_PX !== "undefined" && Number(COMPACT_LAYOUT_MAX_WIDTH_PX) > 0
      ? `(max-width: ${Number(COMPACT_LAYOUT_MAX_WIDTH_PX)}px)`
      : "(max-width: 1400px)";

  const VIEW_KEYS = ["table", "board", "moscow", "map", "raci"];

  const VIEW_TAB_ARIA = {
    table: "Table view",
    board: "Board view",
    moscow: "MoSCoW view",
    map: "Map view",
    raci: "RACI matrix view"
  };

  const VIEW_TAB_FS_ARIA = {
    table: "Switch to Table view",
    board: "Switch to Board view",
    moscow: "Switch to MoSCoW view",
    map: "Switch to Map view",
    raci: "Switch to RACI matrix view"
  };

  const VIEW_TAB_LABELS = {
    table: "Table",
    board: "Board",
    moscow: "MoSCoW",
    map: "Map",
    raci: "RACI"
  };

  const VIEW_TAB_ICONS = {
    table: '<svg class="view-fullscreen-tab-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/></svg>',
    board: '<svg class="view-fullscreen-tab-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="12" rx="1"/></svg>',
    moscow: '<svg class="view-fullscreen-tab-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>',
    map: '<svg class="view-fullscreen-tab-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/></svg>',
    raci: '<svg class="view-fullscreen-tab-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 0 1-6.75 0 3.375 3.375 0 0 1 6.75 0zm8.25 2.25a2.625 2.625 0 0 1-5.25 0 2.625 2.625 0 0 1 5.25 0z"/></svg>'
  };

  let getState;
  let getElements;
  let switchView;
  let getViewElement;
  let syncViewTabs;
  let onExitFullscreen;
  let onEnterFullscreen;
  let currentFullscreenEl = null;
  let pseudoFullscreenEl = null;
  let pendingView = null;
  let scrollLockY = 0;
  let chromeOffsetBound = false;
  let useHostMode = false;

  let fullscreenHost = null;
  let fullscreenStage = null;
  let fullscreenChrome = null;
  let fullscreenTabButtons = null;
  const viewRestoreInfo = new Map();

  const PRESENTATION_PROPS = [
    "position", "top", "left", "right", "bottom", "inset", "z-index",
    "height", "min-height", "max-height", "width", "padding", "overflow", "margin",
    "transform", "visibility", "opacity", "flex", "flex-basis", "flex-grow", "flex-shrink"
  ];

  const VIEW_SHELL_SELECTOR =
    ".view-toolbar, .projects-map-container, .projects-map-legend, .scrum-board, .moscow-grid, .table-wrapper, .raci-matrix-wrap";

  function isCompactViewport() {
    return window.matchMedia(COMPACT_MQ).matches;
  }

  function getViewRoots() {
    const els = getElements();
    return [els.projectsTableView, els.projectsBoardView, els.projectsMoscowView, els.projectsMapView, els.projectsRaciView].filter(Boolean);
  }

  function getViewTabButtons() {
    const els = getElements();
    return [
      [els.projectsViewTableBtn, "table"],
      [els.projectsViewBoardBtn, "board"],
      [els.projectsViewMoscowBtn, "moscow"],
      [els.projectsViewMapBtn, "map"],
      [els.projectsViewRaciBtn, "raci"]
    ].filter(([btn]) => !!btn);
  }

  function isNativeFullscreen(viewEl) {
    const active = document.fullscreenElement || document.webkitFullscreenElement;
    return !!viewEl && active === viewEl;
  }

  function isPseudoFullscreen(viewEl) {
    return !!viewEl && pseudoFullscreenEl === viewEl;
  }

  function isElementFullscreen(viewEl) {
    return isNativeFullscreen(viewEl) || isPseudoFullscreen(viewEl);
  }

  function isAnyViewFullscreen() {
    return getViewRoots().some((el) => isElementFullscreen(el));
  }

  function preferHostFullscreen() {
    /* Unified body-level host — reliable on desktop and compact viewports. */
    return true;
  }

  function getWorkspaceContainer() {
    const els = getElements();
    return els.workspacePortfolioBody || document.querySelector(".portfolio-stage") || els.projectsTableView?.parentNode || null;
  }

  function saveViewAnchor(viewEl) {
    if (!viewEl || viewRestoreInfo.has(viewEl)) return;
    viewRestoreInfo.set(viewEl, {
      parent: viewEl.parentNode,
      nextSibling: viewEl.nextSibling
    });
  }

  function restoreViewToPortfolio(viewEl) {
    if (!viewEl) return;
    const info = viewRestoreInfo.get(viewEl);
    if (!info || !info.parent) return;
    if (viewEl.parentNode === info.parent) return;

    if (info.nextSibling && info.nextSibling.parentNode === info.parent) {
      info.parent.insertBefore(viewEl, info.nextSibling);
    } else {
      info.parent.appendChild(viewEl);
    }
  }

  function applyViewVisibilityFromState() {
    const state = getState();
    const els = getElements();
    if (!state || !els.projectsTableView) return;

    const view = state.projectsView;
    const showTable = view === "table";
    const showBoard = view === "board";
    const showMoscow = view === "moscow";
    const showMap = view === "map";
    const showRaci = view === "raci";

    if (els.projectsTableView && els.projectsTableView.parentNode !== fullscreenStage) {
      els.projectsTableView.style.display = showTable ? "flex" : "none";
    }
    if (els.projectsBoardView && els.projectsBoardView.parentNode !== fullscreenStage) {
      els.projectsBoardView.style.display = showBoard ? "flex" : "none";
    }
    if (els.projectsMoscowView && els.projectsMoscowView.parentNode !== fullscreenStage) {
      els.projectsMoscowView.style.display = showMoscow ? "flex" : "none";
    }
    if (els.projectsMapView && els.projectsMapView.parentNode !== fullscreenStage) {
      els.projectsMapView.style.display = showMap ? "flex" : "none";
    }
    if (els.projectsRaciView && els.projectsRaciView.parentNode !== fullscreenStage) {
      els.projectsRaciView.style.display = showRaci ? "flex" : "none";
    }
  }

  let fullscreenProfileLabel = null;

  function ensureFullscreenHost() {
    if (fullscreenHost) return;

    fullscreenHost = document.createElement("div");
    fullscreenHost.id = "viewFullscreenHost";
    fullscreenHost.className = "view-fullscreen-host";
    fullscreenHost.hidden = true;
    fullscreenHost.setAttribute("aria-hidden", "true");

    fullscreenChrome = document.createElement("div");
    fullscreenChrome.className = "view-fullscreen-chrome";
    fullscreenChrome.setAttribute("role", "banner");

    const brand = document.createElement("div");
    brand.className = "view-fullscreen-brand";

    const mark = document.createElement("span");
    mark.className = "view-fullscreen-mark";
    mark.setAttribute("aria-hidden", "true");
    mark.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 16l4-8 4 5 5-9"/></svg>';

    const context = document.createElement("div");
    context.className = "view-fullscreen-context";

    const eyebrow = document.createElement("span");
    eyebrow.className = "view-fullscreen-eyebrow";
    eyebrow.textContent = "Portfolio focus";

    fullscreenProfileLabel = document.createElement("span");
    fullscreenProfileLabel.id = "viewFullscreenProfileLabel";
    fullscreenProfileLabel.className = "view-fullscreen-profile";
    fullscreenProfileLabel.textContent = "No profile selected";

    context.appendChild(eyebrow);
    context.appendChild(fullscreenProfileLabel);
    brand.appendChild(mark);
    brand.appendChild(context);

    const tabsNav = document.createElement("nav");
    tabsNav.className = "view-fullscreen-tabs";
    tabsNav.setAttribute("role", "tablist");
    tabsNav.setAttribute("aria-label", "Switch view in full screen");

    fullscreenTabButtons = {};
    VIEW_KEYS.forEach((viewKey) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "view-fullscreen-tab view-toggle-btn";
      btn.dataset.fsView = viewKey;
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", "false");
      btn.innerHTML = (VIEW_TAB_ICONS[viewKey] || "") +
        `<span class="view-fullscreen-tab-label">${VIEW_TAB_LABELS[viewKey]}</span>`;
      btn.setAttribute("aria-label", VIEW_TAB_FS_ARIA[viewKey]);
      btn.addEventListener("click", () => {
        switchViewWhileFullscreen(viewKey);
      });
      tabsNav.appendChild(btn);
      fullscreenTabButtons[viewKey] = btn;
    });

    const actions = document.createElement("div");
    actions.className = "view-fullscreen-actions";

    const exitBtn = document.createElement("button");
    exitBtn.type = "button";
    exitBtn.className = "view-fullscreen-exit-btn";
    exitBtn.setAttribute("aria-label", "Exit full screen");
    exitBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg><span class="view-fullscreen-exit-label">Exit full screen</span>';
    exitBtn.addEventListener("click", () => exitFullscreen());

    actions.appendChild(exitBtn);

    fullscreenChrome.appendChild(brand);
    fullscreenChrome.appendChild(tabsNav);
    fullscreenChrome.appendChild(actions);

    fullscreenStage = document.createElement("div");
    fullscreenStage.className = "view-fullscreen-stage";

    fullscreenHost.appendChild(fullscreenChrome);
    fullscreenHost.appendChild(fullscreenStage);
    document.body.appendChild(fullscreenHost);
    updateFullscreenHostLayoutClass();
  }

  function syncFullscreenChromeContext() {
    if (!fullscreenProfileLabel) {
      fullscreenProfileLabel = document.getElementById("viewFullscreenProfileLabel");
    }
    const source = document.getElementById("activeProfileTitleText");
    if (fullscreenProfileLabel && source) {
      fullscreenProfileLabel.textContent = (source.textContent || "").trim() || "No profile selected";
    }
  }

  function updateFullscreenHostLayoutClass() {
    if (!fullscreenHost) return;
    const compact = isCompactViewport();
    fullscreenHost.classList.toggle("view-fullscreen-host--compact", compact);
    fullscreenHost.classList.toggle("view-fullscreen-host--desktop", !compact);
  }

  function syncFullscreenChromeTabs(activeView) {
    if (!fullscreenTabButtons) return;
    VIEW_KEYS.forEach((viewKey) => {
      const btn = fullscreenTabButtons[viewKey];
      if (!btn) return;
      const isActive = viewKey === activeView;
      btn.classList.toggle("view-fullscreen-tab--active", isActive);
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
    });
    syncFullscreenChromeContext();
  }

  function showFullscreenHost() {
    ensureFullscreenHost();
    updateFullscreenHostLayoutClass();
    syncFullscreenChromeContext();
    fullscreenHost.hidden = false;
    fullscreenHost.setAttribute("aria-hidden", "false");
  }

  function hideFullscreenHost() {
    if (!fullscreenHost) return;
    fullscreenHost.hidden = true;
    fullscreenHost.setAttribute("aria-hidden", "true");
  }

  function mountViewInHost(viewEl) {
    if (!viewEl) return;
    ensureFullscreenHost();
    saveViewAnchor(viewEl);

    viewEl.classList.add("view-pseudo-fullscreen", "view-in-fullscreen-host");
    viewEl.style.display = "flex";
    fullscreenStage.appendChild(viewEl);
    useHostMode = true;
    showFullscreenHost();
  }

  function unmountViewFromHost(viewEl) {
    if (!viewEl) return;
    viewEl.classList.remove("view-in-fullscreen-host");
    restoreViewToPortfolio(viewEl);
    applyViewVisibilityFromState();
  }

  function unmountAllViewsFromHost() {
    if (!fullscreenStage) return;
    Array.from(fullscreenStage.querySelectorAll(".projects-view")).forEach((viewEl) => {
      unmountViewFromHost(viewEl);
    });
    useHostMode = false;
    hideFullscreenHost();
  }

  function lockPageScroll() {
    scrollLockY = window.scrollY || window.pageYOffset || 0;
    document.documentElement.classList.add("view-fullscreen-lock");
    document.body.classList.add("view-pseudo-fullscreen-active");
    if (useHostMode) {
      document.body.style.top = "";
    } else {
      document.body.style.top = `-${scrollLockY}px`;
    }
  }

  function unlockPageScroll() {
    document.documentElement.classList.remove("view-fullscreen-lock");
    document.body.classList.remove("view-pseudo-fullscreen-active");
    document.body.style.top = "";
    if (!useHostMode) {
      window.scrollTo(0, scrollLockY);
    }
    void document.documentElement.offsetHeight;
  }

  function movePortalsTo(el) {
    if (!el) return;
    PORTAL_IDS.forEach((id) => {
      const node = document.getElementById(id);
      if (node && node.parentNode !== el) el.appendChild(node);
    });
  }

  function movePortalsBackToBody() {
    PORTAL_IDS.forEach((id) => {
      const node = document.getElementById(id);
      if (node && node.parentNode !== document.body) document.body.appendChild(node);
    });
  }

  function clearChromePresentationStyles(node) {
    if (!node || !node.style) return;
    PRESENTATION_PROPS.forEach((prop) => {
      node.style.removeProperty(prop);
    });
  }

  function restoreChromeToContainer() {
    const container = getWorkspaceContainer();
    const anchor = getElements().projectsTableView;
    if (!container || !anchor) return;

    const headerRow = document.querySelector(".projects-header-row");
    const filtersShell = document.querySelector(".filters-shell");

    if (filtersShell && filtersShell.parentNode !== container) {
      container.insertBefore(filtersShell, anchor);
    }
    if (headerRow && headerRow.parentNode !== container) {
      const insertBefore = filtersShell && filtersShell.parentNode === container ? filtersShell : anchor;
      container.insertBefore(headerRow, insertBefore);
    }

    clearChromePresentationStyles(headerRow);
    clearChromePresentationStyles(filtersShell);
  }

  function restoreViewShellPresentation() {
    getViewRoots().forEach((viewEl) => {
      clearChromePresentationStyles(viewEl);
      viewEl.querySelectorAll(VIEW_SHELL_SELECTOR).forEach(clearChromePresentationStyles);
    });
  }

  function resetPortfolioStageScroll() {
    const stage = document.querySelector(".portfolio-stage");
    if (!stage) return;
    stage.scrollTop = 0;
    stage.scrollLeft = 0;
  }

  function schedulePostExitLayoutPasses(callback) {
    const runLayout = () => {
      restoreViewShellPresentation();
      resetPortfolioStageScroll();
      invalidateMapSize();
    };

    runLayout();
    requestAnimationFrame(() => {
      runLayout();
      requestAnimationFrame(runLayout);
    });
    [80, 180, 360].forEach((delay) => {
      window.setTimeout(runLayout, delay);
    });

    if (typeof callback === "function") {
      window.setTimeout(callback, 0);
      window.setTimeout(callback, 180);
      window.setTimeout(callback, 360);
    }
  }

  function clearPseudoFullscreenShell() {
    document.documentElement.classList.remove("pseudo-view-fullscreen");
    document.documentElement.style.removeProperty("--pseudo-fs-chrome-height");
    document.documentElement.style.removeProperty("--pseudo-fs-header-height");
  }

  function bindPseudoChromeOffsetListeners() {
    if (chromeOffsetBound) return;
    chromeOffsetBound = true;

    window.addEventListener("resize", () => {
      if (pseudoFullscreenEl) invalidateMapSize();
    });

    window.addEventListener("orientationchange", () => {
      if (pseudoFullscreenEl) {
        window.setTimeout(invalidateMapSize, 120);
        window.setTimeout(invalidateMapSize, 320);
      }
    });
  }

  function forceRestoreWorkspaceLayout() {
    getViewRoots().forEach((el) => {
      el.classList.remove("view-pseudo-fullscreen", "view-in-fullscreen-host");
    });
    unmountAllViewsFromHost();
    restoreViewShellPresentation();
    restoreChromeToContainer();
    clearPseudoFullscreenShell();
    pseudoFullscreenEl = null;
    currentFullscreenEl = null;
    useHostMode = false;

    if (document.body.classList.contains("view-pseudo-fullscreen-active") ||
        document.documentElement.classList.contains("view-fullscreen-lock")) {
      unlockPageScroll();
    }

    const nativeFs = document.fullscreenElement || document.webkitFullscreenElement;
    if (nativeFs && getViewRoots().includes(nativeFs)) {
      exitNativeFullscreen();
    }
  }

  function setViewTabAccessibility(fullscreenHints) {
    getViewTabButtons().forEach(([btn, view]) => {
      const label = fullscreenHints ? (VIEW_TAB_FS_ARIA[view] || VIEW_TAB_ARIA[view]) : VIEW_TAB_ARIA[view];
      btn.setAttribute("aria-label", label);
      btn.removeAttribute("title");
    });
  }

  function blurViewTabButtons() {
    getViewTabButtons().forEach(([btn]) => {
      btn.classList.remove("view-toggle-btn--pressed");
      btn.removeAttribute("title");
      if (document.activeElement === btn) btn.blur();
    });
    const tabs = document.querySelector(".portfolio-view-tabs");
    if (tabs && document.activeElement && tabs.contains(document.activeElement)) {
      document.activeElement.blur();
    }
  }

  function resetViewTabButtons() {
    getViewTabButtons().forEach(([btn]) => {
      btn.disabled = false;
      btn.removeAttribute("aria-disabled");
      btn.removeAttribute("title");
    });
    setViewTabAccessibility(false);
    blurViewTabButtons();
  }

  function updateFullscreenButtons() {
    const els = getElements();
    const activeEl = pseudoFullscreenEl || document.fullscreenElement || document.webkitFullscreenElement;

    function updateBtn(btn, viewEl, expandLbl, compressLbl) {
      if (!btn || !viewEl) return;
      const isFs = isElementFullscreen(viewEl);
      btn.classList.toggle("is-fullscreen", !!isFs);
      const expand = btn.querySelector(".icon-expand");
      const compress = btn.querySelector(".icon-compress");
      if (expand) expand.style.display = isFs ? "none" : "";
      if (compress) compress.style.display = isFs ? "" : "none";
      const labelEl = btn.querySelector(".projects-map-fullscreen-label") || btn.querySelector(".view-fullscreen-label");
      const compressText = isCompactViewport() ? "Exit full screen" : compressLbl;
      const expandText = isCompactViewport() ? "Full screen" : expandLbl;
      if (labelEl) labelEl.textContent = isFs ? compressText : expandText;
      btn.setAttribute("aria-label", isFs ? compressText : expandText);
      btn.setAttribute("aria-pressed", isFs ? "true" : "false");
      btn.removeAttribute("title");
    }

    updateBtn(els.projectsMapFullscreenBtn, els.projectsMapView, "Full screen", "Exit full screen");
    updateBtn(els.scrumBoardFullscreenBtn, els.projectsBoardView, "Full screen", "Exit full screen");
    updateBtn(els.moscowFullscreenBtn, els.projectsMoscowView, "Full screen", "Exit full screen");
    updateBtn(els.tableFullscreenBtn, els.projectsTableView, "Full screen", "Exit full screen");
    updateBtn(els.raciMatrixFullscreenBtn, els.projectsRaciView, "Full screen", "Exit full screen");

    document.documentElement.classList.toggle("has-view-fullscreen", !!(
      activeEl === els.projectsTableView ||
      activeEl === els.projectsBoardView ||
      activeEl === els.projectsMoscowView ||
      activeEl === els.projectsMapView ||
      activeEl === els.projectsRaciView
    ));
  }

  function invalidateMapSize() {
    const els = getElements();
    const map = els.projectsMapContainer && els.projectsMapContainer._leafletMap;
    if (!map) return;
    requestAnimationFrame(() => map.invalidateSize());
    window.setTimeout(() => map.invalidateSize(), 120);
  }

  function finishFullscreenExit() {
    forceRestoreWorkspaceLayout();
    movePortalsBackToBody();
    resetViewTabButtons();
    updateFullscreenButtons();
    resetPortfolioStageScroll();
    invalidateMapSize();

    if (typeof syncViewTabs === "function") {
      try {
        const state = getState();
        syncViewTabs(state && state.projectsView);
      } catch (err) {
        console.warn("Fullscreen view-tab sync failed", err);
      }
    }

    const notifyExit = () => {
      if (typeof onExitFullscreen === "function") {
        try {
          onExitFullscreen();
        } catch (err) {
          console.warn("Fullscreen exit callback failed", err);
        }
      }
    };

    schedulePostExitLayoutPasses(notifyExit);
  }

  function enterPseudoFullscreen(viewEl) {
    if (!viewEl || pseudoFullscreenEl === viewEl) return;

    if (pseudoFullscreenEl) {
      unmountViewFromHost(pseudoFullscreenEl);
    }

    restoreChromeToContainer();

    pseudoFullscreenEl = viewEl;
    currentFullscreenEl = viewEl;
    mountViewInHost(viewEl);

    document.documentElement.classList.add("pseudo-view-fullscreen");
    lockPageScroll();
    setViewTabAccessibility(true);

    const state = getState();
    syncFullscreenChromeTabs(state && state.projectsView);

    updateFullscreenButtons();
    scheduleCompactLayoutRefresh();
  }

  function exitPseudoFullscreen(runExitCallback) {
    if (!pseudoFullscreenEl && !document.documentElement.classList.contains("pseudo-view-fullscreen")) {
      return;
    }

    if (pseudoFullscreenEl) {
      unmountViewFromHost(pseudoFullscreenEl);
      pseudoFullscreenEl = null;
    }

    unmountAllViewsFromHost();
    clearPseudoFullscreenShell();

    if (document.body.classList.contains("view-pseudo-fullscreen-active") ||
        document.documentElement.classList.contains("view-fullscreen-lock")) {
      unlockPageScroll();
    }

    if (runExitCallback !== false) {
      finishFullscreenExit();
    }
  }

  function enterNativeFullscreen(viewEl) {
    const req = viewEl.requestFullscreen || viewEl.webkitRequestFullscreen;
    if (!req) {
      enterPseudoFullscreen(viewEl);
      return;
    }
    try {
      const result = req.call(viewEl);
      if (result && typeof result.catch === "function") {
        result.catch(() => enterPseudoFullscreen(viewEl));
      }
    } catch (_) {
      enterPseudoFullscreen(viewEl);
    }
  }

  function exitNativeFullscreen() {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  }

  function enterFullscreen(viewEl) {
    if (!viewEl) return;
    enterPseudoFullscreen(viewEl);
  }

  function exitFullscreen() {
    if (pseudoFullscreenEl || document.documentElement.classList.contains("pseudo-view-fullscreen")) {
      exitPseudoFullscreen(true);
      return;
    }
    exitNativeFullscreen();
  }

  function migratePseudoFullscreenToView(view) {
    const targetEl = getViewElement(view);
    if (!targetEl || !pseudoFullscreenEl) return false;

    const oldEl = pseudoFullscreenEl;
    if (oldEl === targetEl) {
      blurViewTabButtons();
      syncFullscreenChromeTabs(view);
      return true;
    }

    switchView(view);

    unmountViewFromHost(oldEl);
    oldEl.classList.remove("view-pseudo-fullscreen");
    mountViewInHost(targetEl);

    pseudoFullscreenEl = targetEl;
    currentFullscreenEl = targetEl;

    setViewTabAccessibility(true);
    syncFullscreenChromeTabs(view);
    updateFullscreenButtons();
    blurViewTabButtons();

    scheduleCompactLayoutRefresh();
    return true;
  }

  function toggle(viewEl) {
    if (!viewEl) return;
    if (isElementFullscreen(viewEl)) {
      exitFullscreen();
    } else {
      enterFullscreen(viewEl);
    }
  }

  function onChange() {
    if (pseudoFullscreenEl) return;

    const el = document.fullscreenElement || document.webkitFullscreenElement;
    const els = getElements();
    const isAny = el === els.projectsMapView || el === els.projectsBoardView ||
      el === els.projectsMoscowView || el === els.projectsTableView || el === els.projectsRaciView;

    if (isAny && el) {
      currentFullscreenEl = el;
      movePortalsTo(el);
      setViewTabAccessibility(true);
      updateFullscreenButtons();
      invalidateMapSize();
      return;
    }

    if (pendingView) {
      const view = pendingView;
      pendingView = null;
      restoreChromeToContainer();
      restoreViewShellPresentation();
      switchView(view);
      const targetEl = getViewElement(view);
      if (targetEl) {
        requestAnimationFrame(() => {
          enterFullscreen(targetEl);
          blurViewTabButtons();
        });
      } else {
        finishFullscreenExit();
      }
      return;
    }

    finishFullscreenExit();
  }

  function isViewFullscreen() {
    if (pseudoFullscreenEl) return true;
    const el = document.fullscreenElement || document.webkitFullscreenElement;
    const els = getElements();
    return el === els.projectsTableView || el === els.projectsBoardView ||
      el === els.projectsMoscowView || el === els.projectsMapView || el === els.projectsRaciView;
  }

  function switchViewWhileFullscreen(view) {
    const targetEl = getViewElement(view);
    if (!targetEl) return;

    const state = getState();
    if (state.projectsView === view && pseudoFullscreenEl === targetEl) {
      blurViewTabButtons();
      syncFullscreenChromeTabs(view);
      return;
    }

    if (pseudoFullscreenEl) {
      migratePseudoFullscreenToView(view);
      return;
    }

    switchView(view);
    enterPseudoFullscreen(targetEl);
    blurViewTabButtons();
  }

  function requestViewSwitchWhileFullscreen(view) {
    switchViewWhileFullscreen(view);
  }

  function scheduleCompactLayoutRefresh() {
    if (!pseudoFullscreenEl) return;
    updateFullscreenHostLayoutClass();
    const run = () => {
      if (typeof onEnterFullscreen === "function") {
        try {
          onEnterFullscreen();
        } catch (err) {
          console.warn("Fullscreen enter layout refresh failed", err);
        }
      }
      if (fullscreenStage) {
        fullscreenStage.scrollTop = 0;
        fullscreenStage.scrollLeft = 0;
      }
      invalidateMapSize();
    };
    run();
    requestAnimationFrame(run);
    [100, 250, 420].forEach((delay) => {
      window.setTimeout(run, delay);
    });
  }

  function handleCompactViewportChange() {
    if (!pseudoFullscreenEl) return;
    updateFullscreenHostLayoutClass();
    if (isCompactViewport()) {
      scheduleCompactLayoutRefresh();
    } else {
      invalidateMapSize();
    }
  }

  function initEscapeHandler() {
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || !pseudoFullscreenEl) return;
      e.preventDefault();
      exitFullscreen();
    });
  }

  function initOrientationHandler() {
    window.addEventListener("orientationchange", () => {
      if (!isAnyViewFullscreen()) return;
      window.setTimeout(invalidateMapSize, 120);
      window.setTimeout(invalidateMapSize, 320);
    });
  }

  global.Fullscreen = {
    init(deps) {
      getState = deps.getState;
      getElements = deps.getElements;
      switchView = deps.switchView;
      getViewElement = deps.getViewElement;
      syncViewTabs = deps.syncViewTabs;
      onExitFullscreen = deps.onExitFullscreen;
      onEnterFullscreen = deps.onEnterFullscreen;

      ensureFullscreenHost();
      bindPseudoChromeOffsetListeners();
      initEscapeHandler();
      initOrientationHandler();

      const mq = window.matchMedia(COMPACT_MQ);
      if (typeof mq.addEventListener === "function") {
        mq.addEventListener("change", handleCompactViewportChange);
      } else if (typeof mq.addListener === "function") {
        mq.addListener(handleCompactViewportChange);
      }
    },
    toggle,
    onChange,
    isViewFullscreen,
    getViewElement: () => getViewElement,
    switchViewWhileFullscreen,
    requestViewSwitchWhileFullscreen,
    exit: exitFullscreen,
    restoreWorkspaceChrome: restoreChromeToContainer,
    restoreViewShell: restoreViewShellPresentation,
    resetPortfolioStageScroll,
    schedulePostExitLayoutPasses,
    getPseudoFullscreenElement: () => pseudoFullscreenEl,
    isHostMode: () => useHostMode,
    updateHostLayoutClass: updateFullscreenHostLayoutClass,
    syncChromeContext: syncFullscreenChromeContext,
    scheduleCompactLayoutRefresh
  };
})(typeof window !== "undefined" ? window : this);
