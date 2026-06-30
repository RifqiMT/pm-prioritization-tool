/**
 * Roadmap Gantt timeline — calendar weeks × roadmap rows with continuous period bars.
 */
const GanttView = (function () {
  const PAD_WEEKS = 6;
  const MIN_WEEKS = 52;
  const ZOOM_PRESETS = {
    compact: { unit: "month", colWidth: 60 },
    standard: { unit: "week", colWidth: 44 },
    comfortable: { unit: "week", colWidth: 58 }
  };
  const ZOOM_LEVELS = {
    compact: ZOOM_PRESETS.compact.colWidth,
    standard: ZOOM_PRESETS.standard.colWidth,
    comfortable: ZOOM_PRESETS.comfortable.colWidth
  };
  let activeTooltip = null;
  let touchTooltipDismissBound = false;
  let tooltipHideTimer = 0;

  function slugStatus(status) {
    return String(status || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");
  }

  function normalizePeriodStatus(status) {
    const value = String(status || "").trim();
    const options =
      typeof roadmapStatusList !== "undefined" && Array.isArray(roadmapStatusList)
        ? roadmapStatusList
        : ["Not Started", "In Progress", "On Hold", "Done", "Cancelled"];
    if (options.includes(value)) return value;
    if (
      typeof RoadmapPeriods !== "undefined" &&
      typeof RoadmapPeriods.normalizeStatus === "function"
    ) {
      return RoadmapPeriods.normalizeStatus(value, options);
    }
    return options[0] || "Not Started";
  }

  function parseWeekKey(key) {
    const match = String(key || "").trim().match(/^(\d{4})-W(\d{2})$/i);
    if (!match) return null;
    return { year: Number(match[1]), week: Number(match[2]) };
  }

  function formatWeekKey(year, week) {
    return `${year}-W${String(week).padStart(2, "0")}`;
  }

  function getISOWeekParts(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const isoYear = d.getFullYear();
    const week1 = new Date(isoYear, 0, 4);
    const week =
      1 +
      Math.round(
        ((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
      );
    return { year: isoYear, week };
  }

  function getISOWeekKey(date) {
    const parts = getISOWeekParts(date instanceof Date ? date : new Date());
    return formatWeekKey(parts.year, parts.week);
  }

  function isoWeekStart(weekKey) {
    const parsed = parseWeekKey(weekKey);
    if (!parsed) return null;
    const jan4 = new Date(parsed.year, 0, 4);
    const day = (jan4.getDay() + 6) % 7;
    const mondayWeek1 = new Date(jan4);
    mondayWeek1.setDate(jan4.getDate() - day);
    const start = new Date(mondayWeek1);
    start.setDate(mondayWeek1.getDate() + (parsed.week - 1) * 7);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  function isoWeekEnd(weekKey) {
    const start = isoWeekStart(weekKey);
    if (!start) return null;
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end;
  }

  function compareWeekKeys(a, b) {
    const pa = parseWeekKey(a);
    const pb = parseWeekKey(b);
    if (!pa || !pb) return 0;
    if (pa.year !== pb.year) return pa.year - pb.year;
    return pa.week - pb.week;
  }

  function addWeeks(weekKey, delta) {
    const start = isoWeekStart(weekKey);
    if (!start) return weekKey;
    start.setDate(start.getDate() + delta * 7);
    return getISOWeekKey(start);
  }

  function iterWeekKeys(startKey, endKey) {
    const keys = [];
    if (!startKey || !endKey || compareWeekKeys(startKey, endKey) > 0) return keys;
    let cursor = startKey;
    let guard = 0;
    while (compareWeekKeys(cursor, endKey) <= 0 && guard < 600) {
      keys.push(cursor);
      cursor = addWeeks(cursor, 1);
      guard += 1;
    }
    return keys;
  }

  function periodToDateRange(period) {
    const text = String(period || "").trim().toUpperCase();
    const match = text.match(/^(\d{4})-Q([1-4])$/);
    if (!match) return null;
    const year = Number(match[1]);
    const quarter = Number(match[2]);
    const startMonth = (quarter - 1) * 3;
    const start = new Date(year, startMonth, 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(year, startMonth + 3, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end, period: text, quarter };
  }

  function weekOverlapsRange(weekKey, range) {
    if (!range) return false;
    const weekStart = isoWeekStart(weekKey);
    const weekEnd = isoWeekEnd(weekKey);
    if (!weekStart || !weekEnd) return false;
    return weekStart <= range.end && weekEnd >= range.start;
  }

  function buildTimelineWeeks(roadmaps) {
    const list = Array.isArray(roadmaps) ? roadmaps : [];
    const todayKey = getISOWeekKey(new Date());
    let minKey = todayKey;
    let maxKey = todayKey;

    list.forEach((roadmap) => {
      const periods = Array.isArray(roadmap.periods) ? roadmap.periods : [];
      periods.forEach((entry) => {
        const range = periodToDateRange(entry && entry.period);
        if (!range) return;
        const startKey = getISOWeekKey(range.start);
        const endKey = getISOWeekKey(range.end);
        if (compareWeekKeys(startKey, minKey) < 0) minKey = startKey;
        if (compareWeekKeys(endKey, maxKey) > 0) maxKey = endKey;
      });
      if (roadmap.deadline && typeof normalizeRoadmapDeadline === "function") {
        const normalized = normalizeRoadmapDeadline(roadmap.deadline);
        if (normalized) {
          const parts = normalized.split("-").map(Number);
          const deadlineDate = new Date(parts[0], parts[1] - 1, parts[2]);
          const deadlineKey = getISOWeekKey(deadlineDate);
          if (compareWeekKeys(deadlineKey, minKey) < 0) minKey = deadlineKey;
          if (compareWeekKeys(deadlineKey, maxKey) > 0) maxKey = deadlineKey;
        }
      }
    });

    minKey = addWeeks(minKey, -PAD_WEEKS);
    maxKey = addWeeks(maxKey, PAD_WEEKS);
    let weeks = iterWeekKeys(minKey, maxKey);
    if (weeks.length < MIN_WEEKS) {
      maxKey = addWeeks(minKey, MIN_WEEKS - 1);
      weeks = iterWeekKeys(minKey, maxKey);
    }
    return weeks;
  }

  function buildRowWeekStatuses(periods, weeks) {
    const statusByWeek = new Map();
    weeks.forEach((wk) => statusByWeek.set(wk, null));
    const entries = Array.isArray(periods) ? periods : [];
    entries.forEach((entry) => {
      if (!entry || !entry.period) return;
      const range = periodToDateRange(entry.period);
      if (!range) return;
      weeks.forEach((wk) => {
        if (weekOverlapsRange(wk, range)) {
          statusByWeek.set(wk, entry.status || "Not Started");
        }
      });
    });
    return statusByWeek;
  }

  function getWeekIndex(weeks, weekKey) {
    const idx = weeks.indexOf(weekKey);
    return idx >= 0 ? idx : -1;
  }

  function getPeriodWeekSpan(periods, weeks) {
    const spans = [];
    (Array.isArray(periods) ? periods : []).forEach((entry) => {
      if (!entry || !entry.period) return;
      const range = periodToDateRange(entry.period);
      if (!range) return;
      let startIdx = -1;
      let endIdx = -1;
      weeks.forEach((wk, idx) => {
        if (!weekOverlapsRange(wk, range)) return;
        if (startIdx < 0) startIdx = idx;
        endIdx = idx;
      });
      if (startIdx < 0) return;
      const status = normalizePeriodStatus(entry.status);
      spans.push({
        startIdx,
        endIdx,
        span: endIdx - startIdx + 1,
        period: range.period,
        status,
        slug: slugStatus(status)
      });
    });
    return spans.sort((a, b) => a.startIdx - b.startIdx);
  }

  function getCalendarMonthKey(date) {
    const d = date instanceof Date ? date : new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }

  function monthOverlapsRange(month, range) {
    if (!month || !range) return false;
    const monthStart = new Date(month.year, month.month, 1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date(month.year, month.month + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);
    return monthStart <= range.end && monthEnd >= range.start;
  }

  function buildTimelineMonths(weeks) {
    if (!Array.isArray(weeks) || !weeks.length) return [];
    const rangeStart = isoWeekStart(weeks[0]);
    const rangeEnd = isoWeekEnd(weeks[weeks.length - 1]);
    if (!rangeStart || !rangeEnd) return [];

    const months = [];
    let year = rangeStart.getFullYear();
    let month = rangeStart.getMonth();
    const endYear = rangeEnd.getFullYear();
    const endMonth = rangeEnd.getMonth();
    let guard = 0;

    while ((year < endYear || (year === endYear && month <= endMonth)) && guard < 240) {
      const date = new Date(year, month, 1);
      months.push({
        key: `${year}-${String(month + 1).padStart(2, "0")}`,
        year,
        month,
        label: date.toLocaleDateString(undefined, { month: "short" }),
        labelFull: date.toLocaleDateString(undefined, { month: "short", year: "numeric" })
      });
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
      guard += 1;
    }
    return months;
  }

  function getPeriodMonthSpan(periods, months) {
    const spans = [];
    (Array.isArray(periods) ? periods : []).forEach((entry) => {
      if (!entry || !entry.period) return;
      const range = periodToDateRange(entry.period);
      if (!range) return;
      let startIdx = -1;
      let endIdx = -1;
      months.forEach((monthEntry, idx) => {
        if (!monthOverlapsRange(monthEntry, range)) return;
        if (startIdx < 0) startIdx = idx;
        endIdx = idx;
      });
      if (startIdx < 0) return;
      const status = normalizePeriodStatus(entry.status);
      spans.push({
        startIdx,
        endIdx,
        span: endIdx - startIdx + 1,
        period: range.period,
        status,
        slug: slugStatus(status)
      });
    });
    return spans.sort((a, b) => a.startIdx - b.startIdx);
  }

  function buildMonthGroups(weeks) {
    const groups = [];
    weeks.forEach((weekKey, index) => {
      const start = isoWeekStart(weekKey);
      if (!start) return;
      const label = start.toLocaleDateString(undefined, { month: "short", year: "numeric" });
      const last = groups[groups.length - 1];
      if (last && last.label === label) {
        last.span += 1;
        last.endIdx = index;
      } else {
        groups.push({ label, span: 1, startIdx: index, endIdx: index });
      }
    });
    return groups;
  }

  function buildYearGroups(months) {
    const groups = [];
    months.forEach((monthEntry, index) => {
      const label = String(monthEntry.year);
      const last = groups[groups.length - 1];
      if (last && last.label === label) {
        last.span += 1;
        last.endIdx = index;
      } else {
        groups.push({ label, span: 1, startIdx: index, endIdx: index });
      }
    });
    return groups;
  }

  function formatWeekHeader(weekKey) {
    const start = isoWeekStart(weekKey);
    if (!start) return { weekLabel: weekKey, dateLabel: "" };
    const parsed = parseWeekKey(weekKey);
    const weekLabel = parsed ? `W${String(parsed.week).padStart(2, "0")}` : weekKey;
    const dateLabel = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return { weekLabel, dateLabel };
  }

  function isQuarterStartMonth(monthEntry) {
    return monthEntry && [0, 3, 6, 9].includes(monthEntry.month);
  }

  function isQuarterStartWeek(weekKey) {
    const start = isoWeekStart(weekKey);
    if (!start) return false;
    return start.getDate() <= 7 && [0, 3, 6, 9].includes(start.getMonth());
  }

  function buildStatusLegend(statusList) {
    const defaults = ["Not Started", "In Progress", "On Hold", "Done", "Cancelled"];
    const list = Array.isArray(statusList) && statusList.length ? statusList : defaults;
    return list.map((status) => ({ status, slug: slugStatus(status) }));
  }

  function resolveBarSegmentGeometry(span, spanIndex, periodSpans, timelineLength) {
    const edgeInset = 3;
    const prev = spanIndex > 0 ? periodSpans[spanIndex - 1] : null;
    const next = spanIndex < periodSpans.length - 1 ? periodSpans[spanIndex + 1] : null;
    const joinsPrev = Boolean(prev && prev.endIdx === span.startIdx - 1);
    const joinsNext = Boolean(next && next.startIdx === span.endIdx + 1);
    const atTimelineStart = span.startIdx === 0;
    const atTimelineEnd = span.endIdx === timelineLength - 1;
    const leftPad = atTimelineStart ? edgeInset : joinsPrev ? 0 : edgeInset;
    const rightPad = atTimelineEnd ? edgeInset : joinsNext ? 0 : edgeInset;
    return {
      leftPad,
      rightPad,
      joinsPrev,
      joinsNext,
      atTimelineStart,
      atTimelineEnd
    };
  }

  function isCompactGanttLayout() {
    return (
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("is-compact-layout")
    );
  }

  function syncGanttLayoutMode(chart, desktop, cards) {
    const compact = isCompactGanttLayout();
    chart.classList.toggle("roadmaps-gantt-chart--compact", compact);
    chart.classList.toggle("roadmaps-gantt-chart--timeline", !compact);
    if (compact) {
      desktop.setAttribute("hidden", "");
      desktop.setAttribute("aria-hidden", "true");
      cards.removeAttribute("hidden");
      cards.setAttribute("aria-hidden", "false");
    } else {
      desktop.removeAttribute("hidden");
      desktop.setAttribute("aria-hidden", "false");
      cards.setAttribute("hidden", "");
      cards.setAttribute("aria-hidden", "true");
    }
  }

  function syncGanttToolbarForLayout() {
    const compact = isCompactGanttLayout();
    const zoomToggle = document.getElementById("roadmapsGanttZoomToggle");
    const statsEl = document.getElementById("roadmapsGanttStats");
    if (zoomToggle) {
      if (compact) {
        zoomToggle.setAttribute("hidden", "");
        zoomToggle.setAttribute("aria-hidden", "true");
      } else {
        zoomToggle.removeAttribute("hidden");
        zoomToggle.setAttribute("aria-hidden", "false");
      }
    }
    if (statsEl) {
      if (compact) {
        statsEl.setAttribute("hidden", "");
        statsEl.setAttribute("aria-hidden", "true");
      } else {
        statsEl.removeAttribute("hidden");
        statsEl.setAttribute("aria-hidden", "false");
      }
    }
  }

  function getZoomLevel(container) {
    const level = container && container.dataset.ganttZoom;
    return ZOOM_PRESETS[level] ? level : "standard";
  }

  function getZoomPreset(zoom) {
    return ZOOM_PRESETS[zoom] || ZOOM_PRESETS.standard;
  }

  function getTimelineUnit(zoom) {
    return getZoomPreset(zoom).unit;
  }

  function getColWidth(chartOrZoom) {
    if (typeof chartOrZoom === "string") {
      return getZoomPreset(chartOrZoom).colWidth;
    }
    return getZoomPreset(getZoomLevel(chartOrZoom)).colWidth;
  }

  function getWeekWidth(container) {
    return getColWidth(container);
  }

  function getLabelWidth() {
    if (typeof window !== "undefined" && window.matchMedia) {
      if (window.matchMedia("(max-width: 480px)").matches) return 108;
      if (window.matchMedia("(max-width: 768px)").matches) return 128;
      if (window.matchMedia("(max-width: 1400px)").matches) return 176;
    }
    return 248;
  }

  function readChartLabelWidth(chart) {
    if (!chart) return getLabelWidth();
    const raw = getComputedStyle(chart).getPropertyValue("--gantt-label-w").trim();
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : getLabelWidth();
  }

  function applyChartMetrics(chart, colCount, zoom) {
    const preset = getZoomPreset(zoom);
    chart.style.setProperty("--gantt-week-count", String(colCount));
    chart.style.setProperty("--gantt-col-count", String(colCount));
    chart.style.setProperty("--gantt-week-w", `${preset.colWidth}px`);
    chart.style.setProperty("--gantt-col-w", `${preset.colWidth}px`);
    chart.style.setProperty("--gantt-label-w", `${getLabelWidth()}px`);
    chart.dataset.ganttZoom = zoom;
    chart.dataset.ganttUnit = preset.unit;
    chart.classList.toggle("roadmaps-gantt-chart--monthly", preset.unit === "month");
  }

  function ensureTouchTooltipDismiss() {
    if (touchTooltipDismissBound || typeof document === "undefined") return;
    touchTooltipDismissBound = true;
    document.addEventListener(
      "click",
      (event) => {
        if (!activeTooltip) return;
        if (event.target.closest(".roadmaps-gantt-tooltip")) return;
        if (event.target.closest(".roadmaps-gantt-bar")) return;
        hideTooltip();
      },
      true
    );
  }

  function hideTooltip() {
    if (tooltipHideTimer) {
      window.clearTimeout(tooltipHideTimer);
      tooltipHideTimer = 0;
    }
    if (activeTooltip) {
      activeTooltip.remove();
      activeTooltip = null;
    }
  }

  function showTooltip(target, html, clientX, clientY) {
    hideTooltip();
    const tip = document.createElement("div");
    tip.className = "roadmaps-gantt-tooltip";
    tip.setAttribute("role", "tooltip");
    tip.innerHTML = html;
    document.body.appendChild(tip);
    activeTooltip = tip;

    const pad = 12;
    const rect = tip.getBoundingClientRect();
    let left = clientX + 14;
    let top = clientY + 14;
    if (left + rect.width > window.innerWidth - pad) {
      left = clientX - rect.width - 14;
    }
    if (top + rect.height > window.innerHeight - pad) {
      top = clientY - rect.height - 14;
    }
    tip.style.left = `${Math.max(pad, left)}px`;
    tip.style.top = `${Math.max(pad, top)}px`;
    requestAnimationFrame(() => tip.classList.add("roadmaps-gantt-tooltip--visible"));
  }

  function bindTooltip(target, buildHtml) {
    const canHover =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    if (canHover) {
      target.addEventListener("mouseenter", (event) => {
        showTooltip(target, buildHtml(), event.clientX, event.clientY);
      });
      target.addEventListener("mousemove", (event) => {
        if (!activeTooltip) return;
        const pad = 12;
        const rect = activeTooltip.getBoundingClientRect();
        let left = event.clientX + 14;
        let top = event.clientY + 14;
        if (left + rect.width > window.innerWidth - pad) left = event.clientX - rect.width - 14;
        if (top + rect.height > window.innerHeight - pad) top = event.clientY - rect.height - 14;
        activeTooltip.style.left = `${Math.max(pad, left)}px`;
        activeTooltip.style.top = `${Math.max(pad, top)}px`;
      });
      target.addEventListener("mouseleave", () => {
        tooltipHideTimer = window.setTimeout(hideTooltip, 80);
      });
    }

    target.addEventListener("click", (event) => {
      if (canHover) return;
      event.stopPropagation();
      const box = target.getBoundingClientRect();
      showTooltip(target, buildHtml(), box.left + box.width / 2, box.bottom);
    });

    target.addEventListener("focus", () => {
      const box = target.getBoundingClientRect();
      showTooltip(target, buildHtml(), box.left + box.width / 2, box.top);
    });
    target.addEventListener("blur", hideTooltip);
    ensureTouchTooltipDismiss();
  }

  function syncScrollShadows(scroll) {
    if (!scroll) return;
    const max = scroll.scrollWidth - scroll.clientWidth;
    const x = scroll.scrollLeft;
    scroll.classList.toggle("roadmaps-gantt-scroll--shadow-left", x > 4);
    scroll.classList.toggle("roadmaps-gantt-scroll--shadow-right", x < max - 4);
    scroll.classList.toggle("roadmaps-gantt-scroll--shadow-top", scroll.scrollTop > 4);
  }

  function scrollToToday(scroll, timeline, todayKey, options) {
    if (!scroll || !Array.isArray(timeline) || !timeline.length) return false;
    const opts = options && typeof options === "object" ? options : {};
    const unit = opts.unit || "week";
    const todayMonthKey = opts.todayMonthKey || getCalendarMonthKey(new Date());
    const todayIdx =
      typeof opts.todayIdx === "number" && opts.todayIdx >= 0
        ? opts.todayIdx
        : resolveTodayTimelineIndex(timeline, unit, todayKey, todayMonthKey);
    if (todayIdx < 0) return false;
    const chart = scroll.closest(".roadmaps-gantt-chart");
    const colW = getColWidth(chart);
    const labelW = readChartLabelWidth(chart);
    const targetLeft = labelW + todayIdx * colW - scroll.clientWidth / 2 + colW / 2;
    scroll.scrollTo({ left: Math.max(0, targetLeft), behavior: "smooth" });
    return true;
  }

  function resolveTodayTimelineIndex(timeline, unit, todayKey, todayMonthKey) {
    if (!Array.isArray(timeline) || !timeline.length) return -1;
    if (unit === "month") {
      const direct = timeline.findIndex((entry) => entry && entry.key === todayMonthKey);
      if (direct >= 0) return direct;
      const now = new Date();
      const targetTime = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      let bestIdx = 0;
      let bestDelta = Number.POSITIVE_INFINITY;
      timeline.forEach((entry, index) => {
        if (!entry || typeof entry.year !== "number" || typeof entry.month !== "number") return;
        const entryTime = new Date(entry.year, entry.month, 1).getTime();
        const delta = Math.abs(entryTime - targetTime);
        if (delta < bestDelta) {
          bestDelta = delta;
          bestIdx = index;
        }
      });
      return bestIdx;
    }
    const direct = getWeekIndex(timeline, todayKey);
    if (direct >= 0) return direct;
    const todayStart = isoWeekStart(todayKey);
    if (!todayStart) return 0;
    const todayTime = todayStart.getTime();
    let bestIdx = 0;
    let bestDelta = Number.POSITIVE_INFINITY;
    timeline.forEach((weekKey, index) => {
      const start = isoWeekStart(weekKey);
      if (!start) return;
      const delta = Math.abs(start.getTime() - todayTime);
      if (delta < bestDelta) {
        bestDelta = delta;
        bestIdx = index;
      }
    });
    return bestIdx;
  }

  function persistChartTimelineState(chart, state) {
    if (!chart || !state) return;
    const isMonthly = state.unit === "month";
    chart.dataset.ganttUnit = state.unit || "week";
    chart.dataset.ganttTodayKey = state.todayKey || getISOWeekKey(new Date());
    chart.dataset.ganttTodayMonthKey = state.todayMonthKey || getCalendarMonthKey(new Date());
    chart.dataset.ganttTimelineKeys = JSON.stringify(
      isMonthly
        ? (state.months || []).map((entry) => entry.key)
        : Array.isArray(state.weeks)
          ? state.weeks
          : []
    );
    if (isMonthly) {
      chart.dataset.ganttTimelineMonths = JSON.stringify(
        (state.months || []).map((entry) => ({
          key: entry.key,
          year: entry.year,
          month: entry.month
        }))
      );
    } else {
      delete chart.dataset.ganttTimelineMonths;
    }
  }

  function readChartTimeline(chart) {
    if (!chart) return [];
    const unit = chart.dataset.ganttUnit || "week";
    if (unit === "month") {
      try {
        const parsed = JSON.parse(chart.dataset.ganttTimelineMonths || "[]");
        return Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        return [];
      }
    }
    try {
      const parsed = JSON.parse(chart.dataset.ganttTimelineKeys || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function pulseTodayTarget(target) {
    if (!target || !target.classList) return;
    target.classList.add("roadmaps-gantt-today-pulse");
    window.setTimeout(() => {
      target.classList.remove("roadmaps-gantt-today-pulse");
    }, 1400);
  }

  function pulseTodayColumn(scroll, unit, todayIdx) {
    if (!scroll || todayIdx < 0) return;
    const headCells = scroll.querySelectorAll(
      unit === "month"
        ? ".roadmaps-gantt-months--columns .roadmaps-gantt-month--col"
        : ".roadmaps-gantt-weeks .roadmaps-gantt-week"
    );
    if (headCells[todayIdx]) {
      pulseTodayTarget(headCells[todayIdx]);
    }
    scroll.querySelectorAll(".roadmaps-gantt-row__grid").forEach((grid) => {
      const cell = grid.children[todayIdx];
      if (cell) pulseTodayTarget(cell);
    });
    pulseTodayTarget(scroll.querySelector(".roadmaps-gantt-today-line"));
  }

  function jumpGanttToToday() {
    const container = document.getElementById("roadmapsGanttContainer");
    if (!container) return false;
    hideTooltip();

    if (isCompactGanttLayout()) {
      const todayCard = container.querySelector("[data-gantt-today-card='1']");
      if (todayCard) {
        todayCard.scrollIntoView({ behavior: "smooth", block: "center" });
        pulseTodayTarget(todayCard);
        return true;
      }
      const cards = container.querySelector(".roadmaps-gantt-cards:not([hidden])");
      if (cards) {
        cards.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return false;
    }

    const chart = container.querySelector(".roadmaps-gantt-chart");
    const scroll = container.querySelector(".roadmaps-gantt-scroll");
    if (!chart || !scroll) return false;

    const unit = chart.dataset.ganttUnit || "week";
    const timeline = readChartTimeline(chart);
    const todayKey = chart.dataset.ganttTodayKey || getISOWeekKey(new Date());
    const todayMonthKey = chart.dataset.ganttTodayMonthKey || getCalendarMonthKey(new Date());
    const todayIdx = resolveTodayTimelineIndex(timeline, unit, todayKey, todayMonthKey);
    if (todayIdx < 0) return false;

    const scrolled = scrollToToday(scroll, timeline, todayKey, {
      unit,
      todayMonthKey,
      todayIdx
    });
    if (scrolled) {
      pulseTodayColumn(scroll, unit, todayIdx);
      if (typeof scroll.focus === "function") {
        scroll.focus({ preventScroll: true });
      }
    }
    return scrolled;
  }

  function bindGanttTodayButton() {
    const todayBtn = document.getElementById("roadmapsGanttTodayBtn");
    if (!todayBtn) return;
    if (todayBtn._ganttTodayHandler) {
      todayBtn.removeEventListener("click", todayBtn._ganttTodayHandler);
    }
    todayBtn._ganttTodayHandler = (event) => {
      event.preventDefault();
      jumpGanttToToday();
    };
    todayBtn.addEventListener("click", todayBtn._ganttTodayHandler);
  }

  function formatPeriodRangeHint(period) {
    const range = periodToDateRange(period);
    if (!range) return "";
    const start = range.start.toLocaleDateString(undefined, { month: "short", year: "numeric" });
    const end = range.end.toLocaleDateString(undefined, { month: "short", year: "numeric" });
    return start === end ? start : `${start} – ${end}`;
  }

  function periodSpanContainsWeek(span, weeks, weekKey) {
    if (!span || !weekKey) return false;
    for (let idx = span.startIdx; idx <= span.endIdx; idx += 1) {
      if (weeks[idx] === weekKey) return true;
    }
    return false;
  }

  function resolveCardAccentSlug(periodSpans, weeks, todayKey, options) {
    const opts = options && typeof options === "object" ? options : {};
    const months = Array.isArray(opts.months) ? opts.months : null;
    const todayMonthKey = opts.todayMonthKey || null;
    if (!periodSpans.length) return "not-started";

    const containsToday = (span) => {
      if (months && todayMonthKey) {
        for (let idx = span.startIdx; idx <= span.endIdx; idx += 1) {
          if (months[idx] && months[idx].key === todayMonthKey) return true;
        }
        return false;
      }
      return periodSpanContainsWeek(span, weeks, todayKey);
    };

    const current = periodSpans.find(containsToday);
    if (current) return current.slug;
    const inProgress = periodSpans.find((span) => span.status === "In Progress");
    if (inProgress) return inProgress.slug;
    return periodSpans[periodSpans.length - 1].slug;
  }

  function resolveRoadmapDeadlineState(deadline, periodSpans) {
    if (!deadline || typeof normalizeRoadmapDeadline !== "function") return null;
    const normalized = normalizeRoadmapDeadline(deadline);
    if (!normalized) return null;

    const tone =
      typeof getRoadmapDeadlineHintTone === "function"
        ? getRoadmapDeadlineHintTone(deadline)
        : "neutral";
    const hint =
      typeof formatRoadmapDeadlineRelativeHint === "function"
        ? formatRoadmapDeadlineRelativeHint(deadline)
        : "";
    const label =
      typeof formatRoadmapDeadlineForDisplay === "function"
        ? formatRoadmapDeadlineForDisplay(deadline)
        : normalized;

    const deadlineParts = normalized.split("-").map(Number);
    const deadlineDate = new Date(deadlineParts[0], deadlineParts[1] - 1, deadlineParts[2]);
    deadlineDate.setHours(23, 59, 59, 999);

    let timelineExceeds = false;
    (Array.isArray(periodSpans) ? periodSpans : []).forEach((span) => {
      const range = periodToDateRange(span.period);
      if (range && range.end > deadlineDate) timelineExceeds = true;
    });

    const isOverdue = tone === "overdue";
    const exceeds = isOverdue || timelineExceeds;
    let statusLabel = hint || label;
    if (timelineExceeds && !isOverdue) {
      statusLabel = "Schedule past deadline";
    } else if (isOverdue) {
      statusLabel = hint || "Overdue";
    }

    return {
      tone,
      hint,
      label,
      normalized,
      timelineExceeds,
      isOverdue,
      exceeds,
      statusLabel
    };
  }

  function formatPeriodWeekCount(span) {
    const count = span && span.span ? span.span : 0;
    if (!count) return "";
    return `${count} week${count === 1 ? "" : "s"}`;
  }

  function appendDeadlineFooter(parent, roadmap, periodSpans, escapeHtml, classPrefix) {
    const prefix = classPrefix || "roadmaps-gantt-card";
    const deadlineState = resolveRoadmapDeadlineState(roadmap.deadline, periodSpans);
    if (!deadlineState) return;

    const footer = document.createElement("footer");
    footer.className = `${prefix}__deadline ${prefix}__deadline--${deadlineState.tone}`;
    if (deadlineState.timelineExceeds) {
      footer.classList.add(`${prefix}__deadline--exceeds`);
    }
    if (deadlineState.exceeds) {
      footer.classList.add(`${prefix}__deadline--warning`);
    }

    const icon = document.createElement("span");
    icon.className = `${prefix}__deadline-icon`;
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML =
      deadlineState.exceeds
        ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>'
        : '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';

    const copy = document.createElement("span");
    copy.className = `${prefix}__deadline-copy`;

    const dateLabel = document.createElement("span");
    dateLabel.className = `${prefix}__deadline-label`;
    dateLabel.textContent = deadlineState.label;

    const status = document.createElement("span");
    status.className = `${prefix}__deadline-status`;
    status.textContent = deadlineState.statusLabel;

    copy.appendChild(dateLabel);
    copy.appendChild(status);
    footer.appendChild(icon);
    footer.appendChild(copy);
    parent.appendChild(footer);
  }

  function buildDesktopRowLabel(roadmap, periodSpans, options) {
    const opts = options && typeof options === "object" ? options : {};
    const escapeHtml =
      typeof opts.escapeHtml === "function"
        ? opts.escapeHtml
        : (value) => String(value || "").replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
    const onOpenRoadmap = typeof opts.onOpenRoadmap === "function" ? opts.onOpenRoadmap : null;
    const accentSlug = opts.accentSlug || "not-started";
    const deadlineState = resolveRoadmapDeadlineState(roadmap.deadline, periodSpans);

    const label = document.createElement("div");
    label.className = "roadmaps-gantt-row__label";
    label.dataset.ganttAccent = accentSlug;
    if (deadlineState && deadlineState.exceeds) {
      label.classList.add("roadmaps-gantt-row__label--deadline-warning");
    }

    const stripe = document.createElement("span");
    stripe.className = `roadmaps-gantt-row__accent roadmaps-gantt-row__accent--${accentSlug}`;
    stripe.setAttribute("aria-hidden", "true");
    label.appendChild(stripe);

    const labelInner = document.createElement("div");
    labelInner.className = "roadmaps-gantt-row__label-inner";

    const titleRow = document.createElement("div");
    titleRow.className = "roadmaps-gantt-row__title-row";

    const titleText = (roadmap.title || "Untitled roadmap").trim() || "Untitled roadmap";
    const titleBtn = document.createElement("button");
    titleBtn.type = "button";
    titleBtn.className = "roadmaps-gantt-row__title";
    titleBtn.textContent = titleText;
    titleBtn.title = titleText;
    titleBtn.setAttribute("aria-label", `Open roadmap ${titleText}`);
    if (roadmap.id && onOpenRoadmap) {
      titleBtn.addEventListener("click", () => onOpenRoadmap(roadmap.id));
    }
    titleRow.appendChild(titleBtn);

    const openIcon = document.createElement("span");
    openIcon.className = "roadmaps-gantt-row__open-icon";
    openIcon.setAttribute("aria-hidden", "true");
    openIcon.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';
    titleRow.appendChild(openIcon);
    labelInner.appendChild(titleRow);

    const chips = document.createElement("div");
    chips.className = "roadmaps-gantt-row__chips";
    chips.setAttribute("aria-label", "Roadmap periods");
    const chipsList = document.createElement("div");
    chipsList.className = "roadmaps-gantt-row__chips-list";
    if (periodSpans.length) {
      periodSpans.slice(0, 2).forEach((span) => {
        const chip = document.createElement("span");
        chip.className = `roadmaps-gantt-row__chip roadmaps-gantt-row__chip--${span.slug}`;
        chip.dataset.status = span.status;
        chip.textContent = span.period;
        chipsList.appendChild(chip);
      });
      if (periodSpans.length > 2) {
        const more = document.createElement("span");
        more.className = "roadmaps-gantt-row__chip roadmaps-gantt-row__chip--more";
        more.textContent = `+${periodSpans.length - 2}`;
        chipsList.appendChild(more);
      }
    } else {
      chips.classList.add("roadmaps-gantt-row__chips--empty");
    }
    chips.appendChild(chipsList);
    if (deadlineState && roadmap.ownerProfileName) {
      const ownerChip = document.createElement("span");
      ownerChip.className = "roadmaps-gantt-row__chips-owner";
      ownerChip.textContent = roadmap.ownerProfileName;
      ownerChip.title = roadmap.ownerProfileName;
      chips.appendChild(ownerChip);
    }
    labelInner.appendChild(chips);

    const footer = document.createElement("div");
    footer.className = "roadmaps-gantt-row__footer";
    if (deadlineState) {
      footer.classList.add(
        "roadmaps-gantt-row__deadline",
        `roadmaps-gantt-row__deadline--${deadlineState.tone}`
      );
      if (deadlineState.timelineExceeds) {
        footer.classList.add("roadmaps-gantt-row__deadline--exceeds");
      }
      if (deadlineState.exceeds) {
        footer.classList.add("roadmaps-gantt-row__deadline--warning");
      }
      footer.innerHTML =
        '<span class="roadmaps-gantt-row__deadline-icon" aria-hidden="true"></span>' +
        `<span class="roadmaps-gantt-row__deadline-date">${escapeHtml(deadlineState.label)}</span>` +
        `<span class="roadmaps-gantt-row__deadline-status">${escapeHtml(deadlineState.statusLabel)}</span>`;
    } else if (roadmap.ownerProfileName) {
      footer.classList.add("roadmaps-gantt-row__footer--meta");
      footer.textContent = roadmap.ownerProfileName;
      footer.title = roadmap.ownerProfileName;
    } else {
      footer.classList.add("roadmaps-gantt-row__footer--empty");
      footer.setAttribute("aria-hidden", "true");
    }
    labelInner.appendChild(footer);

    label.appendChild(labelInner);
    return label;
  }

  function buildMobileCards(roadmaps, weeks, options) {
    const opts = options && typeof options === "object" ? options : {};
    const escapeHtml =
      typeof opts.escapeHtml === "function"
        ? opts.escapeHtml
        : (value) => String(value || "").replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
    const onOpenRoadmap = typeof opts.onOpenRoadmap === "function" ? opts.onOpenRoadmap : null;
    const todayKey = opts.todayKey || getISOWeekKey(new Date());
    const todayIdx = getWeekIndex(weeks, todayKey);

    const panel = document.createElement("div");
    panel.className = "roadmaps-gantt-cards";
    panel.setAttribute("role", "list");
    panel.setAttribute("aria-label", "Roadmap timeline cards");
    const totalWeeks = Math.max(weeks.length, 1);

    roadmaps.forEach((roadmap) => {
      const card = document.createElement("article");
      card.className = "roadmaps-gantt-card";
      card.setAttribute("role", "listitem");

      const periodSpans = getPeriodWeekSpan(roadmap.periods, weeks);
      const highlightsToday = periodSpans.some((span) =>
        periodSpanContainsWeek(span, weeks, todayKey)
      );
      const accentSlug = resolveCardAccentSlug(periodSpans, weeks, todayKey);
      card.dataset.ganttAccent = accentSlug;
      if (highlightsToday) {
        card.dataset.ganttTodayCard = "1";
      }

      const header = document.createElement("header");
      header.className = "roadmaps-gantt-card__header";

      const titleRow = document.createElement("div");
      titleRow.className = "roadmaps-gantt-card__title-row";

      const titleBtn = document.createElement("button");
      titleBtn.type = "button";
      titleBtn.className = "roadmaps-gantt-card__title";
      const titleText = (roadmap.title || "Untitled roadmap").trim() || "Untitled roadmap";
      titleBtn.textContent = titleText;
      titleBtn.setAttribute("aria-label", `Open roadmap ${titleText}`);
      if (roadmap.id && onOpenRoadmap) {
        titleBtn.addEventListener("click", () => onOpenRoadmap(roadmap.id));
      }
      titleRow.appendChild(titleBtn);

      const openIcon = document.createElement("span");
      openIcon.className = "roadmaps-gantt-card__open-icon";
      openIcon.setAttribute("aria-hidden", "true");
      openIcon.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';
      titleRow.appendChild(openIcon);
      header.appendChild(titleRow);

      const metaRow = document.createElement("div");
      metaRow.className = "roadmaps-gantt-card__meta-row";

      const metaParts = [];
      if (roadmap.ownerProfileName) metaParts.push(roadmap.ownerProfileName);
      if (periodSpans.length) {
        metaParts.push(`${periodSpans.length} period${periodSpans.length === 1 ? "" : "s"}`);
      }
      if (metaParts.length) {
        const meta = document.createElement("span");
        meta.className = "roadmaps-gantt-card__meta";
        meta.textContent = metaParts.join(" · ");
        metaRow.appendChild(meta);
      }

      if (highlightsToday) {
        const badge = document.createElement("span");
        badge.className = "roadmaps-gantt-card__badge roadmaps-gantt-card__badge--current";
        badge.textContent = "This week";
        metaRow.appendChild(badge);
      }

      if (metaRow.childElementCount) {
        header.appendChild(metaRow);
      }
      card.appendChild(header);

      const body = document.createElement("div");
      body.className = "roadmaps-gantt-card__body";

      if (!periodSpans.length) {
        const empty = document.createElement("p");
        empty.className = "roadmaps-gantt-card__empty";
        empty.textContent = "No periods assigned yet.";
        body.appendChild(empty);
      } else {
        periodSpans.forEach((span) => {
          const isCurrent = periodSpanContainsWeek(span, weeks, todayKey);
          const row = document.createElement("div");
          row.className = "roadmaps-gantt-card__period";
          row.dataset.ganttPeriodStatus = span.slug;
          if (isCurrent) {
            row.dataset.ganttPeriodCurrent = "1";
          }

          const stripe = document.createElement("span");
          stripe.className = `roadmaps-gantt-card__period-stripe roadmaps-gantt-card__period-stripe--${span.slug}`;
          stripe.setAttribute("aria-hidden", "true");
          row.appendChild(stripe);

          const content = document.createElement("div");
          content.className = "roadmaps-gantt-card__period-content";

          const head = document.createElement("div");
          head.className = "roadmaps-gantt-card__period-head";

          const labelWrap = document.createElement("div");
          labelWrap.className = "roadmaps-gantt-card__period-label-wrap";

          const periodLabel = document.createElement("span");
          periodLabel.className = "roadmaps-gantt-card__period-label";
          periodLabel.textContent = span.period;
          labelWrap.appendChild(periodLabel);

          if (isCurrent) {
            const nowBadge = document.createElement("span");
            nowBadge.className = "roadmaps-gantt-card__period-now";
            nowBadge.textContent = "Now";
            labelWrap.appendChild(nowBadge);
          }

          const status = document.createElement("span");
          status.className = `roadmaps-gantt-card__status roadmaps-gantt-card__status--${span.slug}`;
          status.setAttribute("data-status", span.status);
          status.textContent = span.status;

          head.appendChild(labelWrap);
          head.appendChild(status);
          content.appendChild(head);

          const hintRow = document.createElement("div");
          hintRow.className = "roadmaps-gantt-card__period-meta";

          const hint = document.createElement("span");
          hint.className = "roadmaps-gantt-card__period-hint";
          hint.textContent = formatPeriodRangeHint(span.period);
          hintRow.appendChild(hint);

          const weekCount = document.createElement("span");
          weekCount.className = "roadmaps-gantt-card__period-weeks";
          weekCount.textContent = formatPeriodWeekCount(span);
          hintRow.appendChild(weekCount);
          content.appendChild(hintRow);

          const track = document.createElement("div");
          track.className = "roadmaps-gantt-card__bar-track";
          track.setAttribute("role", "img");
          track.setAttribute(
            "aria-label",
            `${span.period}, ${span.status}, ${formatPeriodWeekCount(span)} on portfolio timeline`
          );

          const todayMarker =
            todayIdx >= 0
              ? (() => {
                  const marker = document.createElement("span");
                  marker.className = "roadmaps-gantt-card__today-marker";
                  marker.style.left = `${(todayIdx / totalWeeks) * 100}%`;
                  marker.setAttribute("aria-hidden", "true");
                  return marker;
                })()
              : null;
          if (todayMarker) track.appendChild(todayMarker);

          const bar = document.createElement("span");
          bar.className = `roadmaps-gantt-card__bar roadmaps-gantt-bar--${span.slug}`;
          bar.setAttribute("data-status", span.status);
          const widthPct = Math.max((span.span / totalWeeks) * 100, 3);
          const leftPct = (span.startIdx / totalWeeks) * 100;
          bar.style.width = `${widthPct}%`;
          bar.style.left = `${leftPct}%`;
          track.appendChild(bar);
          content.appendChild(track);

          row.appendChild(content);
          body.appendChild(row);
        });
      }
      card.appendChild(body);

      appendDeadlineFooter(card, roadmap, periodSpans, escapeHtml, "roadmaps-gantt-card");

      panel.appendChild(card);
    });

    return panel;
  }

  function updateStats(statsEl, roadmaps, timelineMeta) {
    if (!statsEl) return;
    const count = Array.isArray(roadmaps) ? roadmaps.length : 0;
    const meta = timelineMeta && typeof timelineMeta === "object" ? timelineMeta : {};
    const colCount = Number(meta.count) || 0;
    const unit = meta.unit === "month" ? "month" : "week";
    const unitLabel = `${unit}${colCount === 1 ? "" : "s"}`;
    statsEl.textContent = `${count} roadmap${count === 1 ? "" : "s"} · ${colCount} ${unitLabel}`;
  }

  function syncZoomToggle(zoom) {
    const toggle = document.getElementById("roadmapsGanttZoomToggle");
    if (!toggle) return;
    toggle.dataset.activeZoom = zoom;
    toggle.querySelectorAll("[data-gantt-zoom]").forEach((btn) => {
      const active = btn.getAttribute("data-gantt-zoom") === zoom;
      btn.setAttribute("aria-selected", active ? "true" : "false");
      btn.classList.toggle("roadmaps-gantt-zoom-btn--active", active);
    });
  }

  function renderEmpty(container, title, hint) {
    container.innerHTML = "";
    container.classList.remove("roadmaps-gantt-host");
    const empty = document.createElement("div");
    empty.className = "roadmaps-gantt-empty empty-state";
    empty.setAttribute("role", "status");
    empty.innerHTML =
      '<div class="roadmaps-gantt-empty__icon" aria-hidden="true">' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 5h8"/><path d="M3 12h14"/><path d="M3 19h11"/><path d="M16 8v8"/><path d="M20 6v12"/></svg>' +
      "</div>" +
      `<p class="roadmaps-gantt-empty__title">${title}</p>` +
      `<p class="roadmaps-gantt-empty__hint">${hint}</p>`;
    container.appendChild(empty);
  }

  function render(container, options) {
    if (!container) return;
    hideTooltip();
    syncGanttToolbarForLayout();

    const opts = options && typeof options === "object" ? options : {};
    const roadmaps = Array.isArray(opts.roadmaps) ? opts.roadmaps : [];
    const escapeHtml =
      typeof opts.escapeHtml === "function"
        ? opts.escapeHtml
        : (value) => String(value || "").replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
    const onOpenRoadmap = typeof opts.onOpenRoadmap === "function" ? opts.onOpenRoadmap : null;
    const zoom = ZOOM_PRESETS[opts.zoom] ? opts.zoom : getZoomLevel(container);
    const zoomPreset = getZoomPreset(zoom);
    const isMonthly = zoomPreset.unit === "month";
    const statusList =
      typeof roadmapStatusList !== "undefined" && Array.isArray(roadmapStatusList)
        ? roadmapStatusList
        : null;

    container.innerHTML = "";
    container.classList.add("roadmaps-gantt-host");

    const weeks = buildTimelineWeeks(roadmaps);
    const months = isMonthly ? buildTimelineMonths(weeks) : [];
    const timeline = isMonthly ? months : weeks;
    const todayKey = getISOWeekKey(new Date());
    const todayMonthKey = getCalendarMonthKey(new Date());
    const todayIdx = isMonthly
      ? months.findIndex((entry) => entry.key === todayMonthKey)
      : getWeekIndex(weeks, todayKey);
    const monthGroups = buildMonthGroups(weeks);
    const yearGroups = isMonthly ? buildYearGroups(months) : [];

    updateStats(document.getElementById("roadmapsGanttStats"), roadmaps, {
      count: timeline.length,
      unit: zoomPreset.unit
    });
    syncZoomToggle(zoom);

    if (!roadmaps.length) {
      renderEmpty(
        container,
        "No roadmaps to plot",
        "Add roadmaps or adjust filters to see the timeline."
      );
      bindGanttTodayButton();
      return { weeks, roadmapCount: 0 };
    }

    const chart = document.createElement("div");
    chart.className = "roadmaps-gantt-chart";
    applyChartMetrics(chart, timeline.length, zoom);
    persistChartTimelineState(chart, {
      unit: zoomPreset.unit,
      weeks,
      months,
      todayKey,
      todayMonthKey
    });

    const metaBar = document.createElement("div");
    metaBar.className = "roadmaps-gantt-meta";
    const legend = document.createElement("div");
    legend.className = "roadmaps-gantt-legend";
    legend.setAttribute("aria-label", "Roadmap status colors");
    buildStatusLegend(statusList).forEach(({ status, slug }) => {
      const item = document.createElement("span");
      item.className = "roadmaps-gantt-legend__item";
      item.innerHTML =
        `<span class="roadmaps-gantt-legend__swatch roadmaps-gantt-bar--${slug}" aria-hidden="true"></span>` +
        `<span class="roadmaps-gantt-legend__label">${escapeHtml(status)}</span>`;
      legend.appendChild(item);
    });
    const deadlineLegend = document.createElement("span");
    deadlineLegend.className = "roadmaps-gantt-legend__item roadmaps-gantt-legend__item--deadline";
    deadlineLegend.innerHTML =
      '<span class="roadmaps-gantt-legend__glyph roadmaps-gantt-legend__glyph--deadline" aria-hidden="true">' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M12 3 20 12 12 21 4 12Z"/></svg></span>' +
      '<span class="roadmaps-gantt-legend__label">Deadline marker</span>';
    legend.appendChild(deadlineLegend);
    const todayLegend = document.createElement("span");
    todayLegend.className = "roadmaps-gantt-legend__item roadmaps-gantt-legend__item--today";
    todayLegend.innerHTML =
      '<span class="roadmaps-gantt-legend__glyph roadmaps-gantt-legend__glyph--today" aria-hidden="true">' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round">' +
      '<path d="M12 3v18"/><circle cx="12" cy="5.5" r="2.2" fill="currentColor" stroke="none"/></svg></span>' +
      '<span class="roadmaps-gantt-legend__label">Today</span>';
    legend.appendChild(todayLegend);
    const overdueLegend = document.createElement("span");
    overdueLegend.className = "roadmaps-gantt-legend__item roadmaps-gantt-legend__item--overdue";
    overdueLegend.innerHTML =
      '<span class="roadmaps-gantt-legend__glyph roadmaps-gantt-legend__glyph--overdue" aria-hidden="true">' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>' +
      '<path d="M12 9v4"/><path d="M12 17h.01"/></svg></span>' +
      '<span class="roadmaps-gantt-legend__label">Overdue / exceeds deadline</span>';
    legend.appendChild(overdueLegend);
    metaBar.appendChild(legend);

    const scroll = document.createElement("div");
    scroll.className = "roadmaps-gantt-scroll";
    scroll.setAttribute("tabindex", "0");
    scroll.setAttribute("role", "region");
    scroll.setAttribute("aria-label", "Roadmap Gantt timeline");

    const matrix = document.createElement("div");
    matrix.className = "roadmaps-gantt-matrix";

    const head = document.createElement("div");
    head.className = "roadmaps-gantt-head";

    const corner = document.createElement("div");
    corner.className = "roadmaps-gantt-head__corner";
    corner.innerHTML =
      '<span class="roadmaps-gantt-head__corner-title">Roadmaps</span>' +
      '<span class="roadmaps-gantt-head__corner-sub">Portfolio timeline</span>';

    const headTimeline = document.createElement("div");
    headTimeline.className = "roadmaps-gantt-head__timeline";

    if (isMonthly) {
      const yearsRow = document.createElement("div");
      yearsRow.className = "roadmaps-gantt-years";
      yearsRow.style.gridTemplateColumns = `repeat(${months.length}, var(--gantt-col-w))`;
      yearGroups.forEach((group) => {
        const cell = document.createElement("div");
        cell.className = "roadmaps-gantt-year";
        cell.style.gridColumn = `span ${group.span}`;
        cell.textContent = group.label;
        yearsRow.appendChild(cell);
      });

      const monthsRow = document.createElement("div");
      monthsRow.className = "roadmaps-gantt-months roadmaps-gantt-months--columns";
      monthsRow.style.gridTemplateColumns = `repeat(${months.length}, var(--gantt-col-w))`;
      months.forEach((monthEntry) => {
        const cell = document.createElement("div");
        cell.className = "roadmaps-gantt-month roadmaps-gantt-month--col";
        cell.dataset.month = monthEntry.key;
        if (monthEntry.key === todayMonthKey) cell.classList.add("roadmaps-gantt-month--today");
        if (isQuarterStartMonth(monthEntry)) cell.classList.add("roadmaps-gantt-month--quarter");
        cell.textContent = monthEntry.label;
        cell.title = monthEntry.labelFull;
        monthsRow.appendChild(cell);
      });

      headTimeline.appendChild(yearsRow);
      headTimeline.appendChild(monthsRow);
    } else {
      const monthsRow = document.createElement("div");
      monthsRow.className = "roadmaps-gantt-months";
      monthsRow.style.gridTemplateColumns = `repeat(${weeks.length}, var(--gantt-col-w))`;
      monthGroups.forEach((group) => {
        const cell = document.createElement("div");
        cell.className = "roadmaps-gantt-month";
        cell.style.gridColumn = `span ${group.span}`;
        cell.textContent = group.label;
        monthsRow.appendChild(cell);
      });

      const weeksRow = document.createElement("div");
      weeksRow.className = "roadmaps-gantt-weeks";
      weeksRow.style.gridTemplateColumns = `repeat(${weeks.length}, var(--gantt-col-w))`;
      weeks.forEach((weekKey) => {
        const cell = document.createElement("div");
        cell.className = "roadmaps-gantt-week";
        cell.dataset.week = weekKey;
        if (weekKey === todayKey) cell.classList.add("roadmaps-gantt-week--today");
        if (isQuarterStartWeek(weekKey)) cell.classList.add("roadmaps-gantt-week--quarter");
        const header = formatWeekHeader(weekKey);
        cell.innerHTML =
          `<span class="roadmaps-gantt-week__label">${escapeHtml(header.weekLabel)}</span>` +
          `<span class="roadmaps-gantt-week__date">${escapeHtml(header.dateLabel)}</span>`;
        weeksRow.appendChild(cell);
      });

      headTimeline.appendChild(monthsRow);
      headTimeline.appendChild(weeksRow);
    }
    head.appendChild(corner);
    head.appendChild(headTimeline);
    matrix.appendChild(head);

    const body = document.createElement("div");
    body.className = "roadmaps-gantt-body";

    roadmaps.forEach((roadmap, rowIndex) => {
      const row = document.createElement("div");
      row.className = "roadmaps-gantt-row";
      row.dataset.roadmapId = roadmap.id || "";
      if (rowIndex % 2 === 1) row.classList.add("roadmaps-gantt-row--alt");

      const periodSpans = isMonthly
        ? getPeriodMonthSpan(roadmap.periods, months)
        : getPeriodWeekSpan(roadmap.periods, weeks);
      const titleText = (roadmap.title || "Untitled roadmap").trim() || "Untitled roadmap";
      const accentSlug = resolveCardAccentSlug(
        periodSpans,
        weeks,
        todayKey,
        isMonthly ? { months, todayMonthKey } : null
      );
      const deadlineState = resolveRoadmapDeadlineState(roadmap.deadline, periodSpans);
      if (deadlineState && deadlineState.exceeds) {
        row.classList.add("roadmaps-gantt-row--deadline-warning");
      }

      const label = buildDesktopRowLabel(roadmap, periodSpans, {
        escapeHtml,
        onOpenRoadmap,
        accentSlug
      });

      const track = document.createElement("div");
      track.className = "roadmaps-gantt-row__track";
      track.style.width = `calc(${timeline.length} * var(--gantt-col-w))`;

      const grid = document.createElement("div");
      grid.className = "roadmaps-gantt-row__grid";
      grid.style.gridTemplateColumns = `repeat(${timeline.length}, var(--gantt-col-w))`;
      if (isMonthly) {
        months.forEach((monthEntry) => {
          const cell = document.createElement("div");
          cell.className = "roadmaps-gantt-row__month";
          cell.dataset.month = monthEntry.key;
          if (monthEntry.key === todayMonthKey) cell.classList.add("roadmaps-gantt-row__month--today");
          if (isQuarterStartMonth(monthEntry)) cell.classList.add("roadmaps-gantt-row__month--quarter");
          grid.appendChild(cell);
        });
      } else {
        weeks.forEach((weekKey) => {
          const cell = document.createElement("div");
          cell.className = "roadmaps-gantt-row__week";
          cell.dataset.week = weekKey;
          if (weekKey === todayKey) cell.classList.add("roadmaps-gantt-row__week--today");
          if (isQuarterStartWeek(weekKey)) cell.classList.add("roadmaps-gantt-row__week--quarter");
          grid.appendChild(cell);
        });
      }
      track.appendChild(grid);

      const barsLayer = document.createElement("div");
      barsLayer.className = "roadmaps-gantt-row__bars";
      periodSpans.forEach((span, spanIndex) => {
        const segment = resolveBarSegmentGeometry(span, spanIndex, periodSpans, timeline.length);
        const bar = document.createElement("button");
        bar.type = "button";
        bar.className = `roadmaps-gantt-bar roadmaps-gantt-bar--${span.slug}`;
        if (!segment.joinsPrev) bar.classList.add("roadmaps-gantt-bar--seg-start");
        if (!segment.joinsNext) bar.classList.add("roadmaps-gantt-bar--seg-end");
        if (segment.joinsPrev) bar.classList.add("roadmaps-gantt-bar--seg-join-left");
        if (segment.joinsNext) bar.classList.add("roadmaps-gantt-bar--seg-join-right");
        bar.style.left = `calc(${span.startIdx} * var(--gantt-col-w) + ${segment.leftPad}px)`;
        bar.style.width = `calc(${span.span} * var(--gantt-col-w) - ${segment.leftPad + segment.rightPad}px)`;
        bar.dataset.period = span.period;
        bar.dataset.status = span.status;
        bar.setAttribute("data-status", span.status);
        bar.setAttribute("aria-label", `${titleText}, ${span.period}, ${span.status}`);
        const barLabel = document.createElement("span");
        barLabel.className = "roadmaps-gantt-bar__label";
        barLabel.textContent = span.period;
        bar.appendChild(barLabel);
        bindTooltip(bar, () =>
          `<p class="roadmaps-gantt-tooltip__title">${escapeHtml(titleText)}</p>` +
          `<p class="roadmaps-gantt-tooltip__period">${escapeHtml(span.period)}</p>` +
          `<p class="roadmaps-gantt-tooltip__status roadmaps-gantt-tooltip__status--${span.slug}">${escapeHtml(span.status)}</p>`
        );
        bar.addEventListener("click", () => {
          if (roadmap.id && onOpenRoadmap) onOpenRoadmap(roadmap.id);
        });
        barsLayer.appendChild(bar);
      });
      track.appendChild(barsLayer);

      if (roadmap.deadline && typeof normalizeRoadmapDeadline === "function") {
        const normalized = normalizeRoadmapDeadline(roadmap.deadline);
        if (normalized) {
          const parts = normalized.split("-").map(Number);
          const deadlineDate = new Date(parts[0], parts[1] - 1, parts[2]);
          const deadlineIdx = isMonthly
            ? months.findIndex((entry) => entry.key === getCalendarMonthKey(deadlineDate))
            : getWeekIndex(weeks, getISOWeekKey(deadlineDate));
          if (deadlineIdx >= 0) {
            const marker = document.createElement("div");
            marker.className = "roadmaps-gantt-deadline";
            if (deadlineState && deadlineState.isOverdue) {
              marker.classList.add("roadmaps-gantt-deadline--overdue");
            } else if (deadlineState && deadlineState.timelineExceeds) {
              marker.classList.add("roadmaps-gantt-deadline--exceeds");
            }
            marker.style.left = `calc(${deadlineIdx} * var(--gantt-col-w) + var(--gantt-col-w) / 2)`;
            marker.setAttribute("aria-hidden", "true");
            const deadlineLabel =
              typeof formatRoadmapDeadlineForDisplay === "function"
                ? formatRoadmapDeadlineForDisplay(roadmap.deadline)
                : normalized;
            const deadlineHint = deadlineState ? deadlineState.statusLabel : "";
            bindTooltip(marker, () =>
              `<p class="roadmaps-gantt-tooltip__title">${escapeHtml(titleText)}</p>` +
              `<p class="roadmaps-gantt-tooltip__period">Deadline · ${escapeHtml(deadlineLabel)}</p>` +
              (deadlineHint
                ? `<p class="roadmaps-gantt-tooltip__status roadmaps-gantt-tooltip__status--${deadlineState.isOverdue || deadlineState.timelineExceeds ? "cancelled" : "deadline"}">${escapeHtml(deadlineHint)}</p>`
                : "")
            );
            track.appendChild(marker);
          }
        }
      }

      row.appendChild(label);
      row.appendChild(track);
      body.appendChild(row);
    });

    matrix.appendChild(body);
    scroll.appendChild(matrix);

    if (todayIdx >= 0) {
      const todayLine = document.createElement("div");
      todayLine.className = "roadmaps-gantt-today-line";
      todayLine.setAttribute("aria-hidden", "true");
      todayLine.style.left = `calc(var(--gantt-label-w) + ${todayIdx} * var(--gantt-col-w) + var(--gantt-col-w) / 2)`;
      scroll.appendChild(todayLine);
    }

    const desktop = document.createElement("div");
    desktop.className = "roadmaps-gantt-desktop";

    const scrollHint = document.createElement("div");
    scrollHint.className = "roadmaps-gantt-scroll-hint";
    scrollHint.setAttribute("aria-hidden", "true");
    scrollHint.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>' +
      "<span>Swipe sideways to explore the timeline</span>" +
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>';
    desktop.appendChild(scrollHint);
    desktop.appendChild(scroll);

    chart.appendChild(metaBar);
    chart.appendChild(desktop);
    const cards = buildMobileCards(roadmaps, weeks, { escapeHtml, onOpenRoadmap, todayKey });
    chart.appendChild(cards);
    container.appendChild(chart);

    syncGanttLayoutMode(chart, desktop, cards);

    const compact = isCompactGanttLayout();
    if (!compact) {
      const onScroll = () => syncScrollShadows(scroll);
      scroll.addEventListener("scroll", onScroll, { passive: true });
      onScroll();

      requestAnimationFrame(() => {
        jumpGanttToToday();
        onScroll();
      });
    }

    bindGanttTodayButton();

    const zoomToggle = document.getElementById("roadmapsGanttZoomToggle");
    if (zoomToggle && !zoomToggle.dataset.ganttBound) {
      zoomToggle.dataset.ganttBound = "1";
      zoomToggle.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-gantt-zoom]");
        if (!btn || typeof opts.onZoomChange !== "function") return;
        const next = btn.getAttribute("data-gantt-zoom");
        if (!ZOOM_PRESETS[next]) return;
        opts.onZoomChange(next);
      });
    }

    return { weeks, roadmapCount: roadmaps.length };
  }

  return {
    parseWeekKey,
    formatWeekKey,
    getISOWeekKey,
    periodToDateRange,
    buildTimelineWeeks,
    buildTimelineMonths,
    buildRowWeekStatuses,
    getPeriodMonthSpan,
    monthOverlapsRange,
    resolveRoadmapDeadlineState,
    getCalendarMonthKey,
    weekOverlapsRange,
    compareWeekKeys,
    getZoomLevel,
    isCompactGanttLayout,
    syncGanttToolbarForLayout,
    jumpGanttToToday,
    bindGanttTodayButton,
    resolveTodayTimelineIndex,
    resolveBarSegmentGeometry,
    scrollToToday,
    hideTooltip,
    render
  };
})();
