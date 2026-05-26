/**
 * Fullscreen module — toggle view fullscreen and switch view while fullscreen.
 * Depends on: getState(), getElements(), switchView(), getViewElement() — provided via init().
 */
(function (global) {
  const PORTAL_IDS = [
    "exportFormatModal", "importFormatModal", "projectModal",
    "profileViewModal", "profileEditModal", "profileDeleteModal",
    "projectDeleteModal", "toastContainer"
  ];
  let getState;
  let getElements;
  let switchView;
  let getViewElement;
  let currentFullscreenEl = null;
  let pendingView = null;

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

  function moveFiltersAndHeaderTo(el) {
    if (!el) return;
    const filtersShell = document.querySelector(".filters-shell");
    const headerRow = document.querySelector(".projects-header-row");
    if (filtersShell && filtersShell.parentNode !== el) el.insertBefore(filtersShell, el.firstChild);
    if (headerRow && headerRow.parentNode !== el) el.insertBefore(headerRow, el.firstChild);
  }

  function moveFiltersAndHeaderBack() {
    if (!currentFullscreenEl) return;
    const cardPlain = currentFullscreenEl.parentNode;
    if (!cardPlain) return;
    const filtersShell = document.querySelector(".filters-shell");
    const headerRow = document.querySelector(".projects-header-row");
    const anchor = getElements().projectsTableView;
    if (filtersShell && anchor && filtersShell.parentNode === currentFullscreenEl) cardPlain.insertBefore(filtersShell, anchor);
    if (headerRow && headerRow.parentNode === currentFullscreenEl) cardPlain.insertBefore(headerRow, filtersShell || anchor);
    currentFullscreenEl = null;
  }

  function setViewToggleDisabled(disabled) {
    const els = getElements();
    [els.projectsViewTableBtn, els.projectsViewBoardBtn, els.projectsViewMoscowBtn, els.projectsViewMapBtn].forEach((btn) => {
      if (!btn) return;
      btn.disabled = !!disabled;
      if (disabled) { btn.setAttribute("aria-disabled", "true"); btn.title = "Exit full screen to switch view"; }
      else { btn.removeAttribute("aria-disabled"); btn.removeAttribute("title"); }
    });
  }

  function setViewToggleTitles() {
    const titles = { table: "Switch to Table", board: "Switch to Board", moscow: "Switch to MOSCOW", map: "Switch to Map" };
    const els = getElements();
    [[els.projectsViewTableBtn, "table"], [els.projectsViewBoardBtn, "board"], [els.projectsViewMoscowBtn, "moscow"], [els.projectsViewMapBtn, "map"]].forEach(([btn, view]) => {
      if (btn) btn.title = titles[view] || "";
    });
  }

  function updateFullscreenButtons() {
    const el = document.fullscreenElement || document.webkitFullscreenElement;
    const isMap = el === getElements().projectsMapView;
    const isBoard = el === getElements().projectsBoardView;
    const isMoscow = el === getElements().projectsMoscowView;
    const isTable = el === getElements().projectsTableView;
    function updateBtn(btn, isFs, expandLbl, compressLbl) {
      if (!btn) return;
      btn.classList.toggle("is-fullscreen", !!isFs);
      const expand = btn.querySelector(".icon-expand");
      const compress = btn.querySelector(".icon-compress");
      if (expand) expand.style.display = isFs ? "none" : "";
      if (compress) compress.style.display = isFs ? "" : "none";
      const labelEl = btn.querySelector(".projects-map-fullscreen-label") || btn.querySelector(".view-fullscreen-label");
      if (labelEl) labelEl.textContent = isFs ? compressLbl : expandLbl;
      btn.setAttribute("aria-label", isFs ? compressLbl : expandLbl);
      btn.title = isFs ? compressLbl : expandLbl;
    }
    const els = getElements();
    updateBtn(els.projectsMapFullscreenBtn, isMap, "Full screen", "Exit full screen");
    updateBtn(els.scrumBoardFullscreenBtn, isBoard, "Full screen", "Exit full screen");
    updateBtn(els.moscowFullscreenBtn, isMoscow, "Full screen", "Exit full screen");
    updateBtn(els.tableFullscreenBtn, isTable, "Full screen", "Exit full screen");
  }

  function toggle(viewEl) {
    if (!viewEl) return;
    const isFs = document.fullscreenElement === viewEl || (document.webkitFullscreenElement && document.webkitFullscreenElement === viewEl);
    if (isFs) {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    } else {
      if (viewEl.requestFullscreen) viewEl.requestFullscreen();
      else if (viewEl.webkitRequestFullscreen) viewEl.webkitRequestFullscreen();
    }
  }

  function onChange() {
    const el = document.fullscreenElement || document.webkitFullscreenElement;
    const els = getElements();
    const isMap = el === els.projectsMapView;
    const isBoard = el === els.projectsBoardView;
    const isMoscow = el === els.projectsMoscowView;
    const isTable = el === els.projectsTableView;
    const isAny = isMap || isBoard || isMoscow || isTable;

    if (isAny && el) {
      currentFullscreenEl = el;
      movePortalsTo(el);
      moveFiltersAndHeaderTo(el);
      setViewToggleTitles();
    } else {
      moveFiltersAndHeaderBack();
      movePortalsBackToBody();
      setViewToggleDisabled(false);
      if (pendingView) {
        const view = pendingView;
        pendingView = null;
        switchView(view);
        const targetEl = getViewElement(view);
        if (targetEl) {
          requestAnimationFrame(() => {
            if (targetEl.requestFullscreen) targetEl.requestFullscreen().catch(() => {});
            else if (targetEl.webkitRequestFullscreen) targetEl.webkitRequestFullscreen();
          });
        }
      }
    }
    updateFullscreenButtons();
    const map = els.projectsMapContainer && els.projectsMapContainer._leafletMap;
    if (map) map.invalidateSize();
  }

  function isViewFullscreen() {
    const el = document.fullscreenElement || document.webkitFullscreenElement;
    const els = getElements();
    return el === els.projectsTableView || el === els.projectsBoardView || el === els.projectsMoscowView || el === els.projectsMapView;
  }

  function requestViewSwitchWhileFullscreen(view) {
    pendingView = view;
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  }

  global.Fullscreen = {
    init(deps) {
      getState = deps.getState;
      getElements = deps.getElements;
      switchView = deps.switchView;
      getViewElement = deps.getViewElement;
    },
    toggle,
    onChange,
    isViewFullscreen,
    getViewElement: () => getViewElement,
    requestViewSwitchWhileFullscreen
  };
})(typeof window !== "undefined" ? window : this);
