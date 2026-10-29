/**
 * Profile overview timeline — aggregate roadmaps by period/year + metric.
 * Global: ProfileOverviewTimeline
 */
const ProfileOverviewTimeline = (function () {
  const CATEGORY_COLORS = [
    "#0f766e",
    "#0369a1",
    "#c2410c",
    "#be185d",
    "#6d28d9",
    "#0e7490",
    "#b45309",
    "#4338ca",
    "#15803d",
    "#9f1239",
    "#115e59",
    "#7e22ce"
  ];

  const NUMERIC_BAR_COLOR = "#0f766e";
  const NUMERIC_BAR_COLOR_SOFT = "#14b8a6";
  const UNPOSITIONED_KANO_KEY = "__kano_unpositioned__";
  const GRANULARITIES = [
    { id: "quarter", label: "Quarterly" },
    { id: "year", label: "Annually" }
  ];

  const VIEW_MODES = [
    { id: "chart", label: "Chart" },
    { id: "table", label: "Table" }
  ];

  const METRICS = [
    { id: "roadmapType", label: "Roadmap type", kind: "category" },
    { id: "tshirtSize", label: "T-shirt size", kind: "category" },
    { id: "moscow", label: "MoSCoW distribution", kind: "category" },
    { id: "kano", label: "KANO model", kind: "category" },
    { id: "financialFramework", label: "Financial framework", kind: "category" },
    { id: "currency", label: "Currency", kind: "category" },
    { id: "financialImpact", label: "Financial impact (EUR)", kind: "numeric", aggregation: "sum" },
    { id: "riceScore", label: "RICE score", kind: "numeric", aggregation: "average" }
  ];

  function getMetric(metricId) {
    return METRICS.find((entry) => entry.id === metricId) || METRICS[0];
  }

  function normalizeGranularity(value) {
    const raw = String(value || "")
      .trim()
      .toLowerCase();
    if (raw === "year" || raw === "annual" || raw === "annually" || raw === "y") return "year";
    return "quarter";
  }

  function normalizeViewMode(value) {
    const raw = String(value || "")
      .trim()
      .toLowerCase();
    if (raw === "table" || raw === "grid" || raw === "data") return "table";
    return "chart";
  }

  function emptyStateHtml(grain, emptyMessage) {
    return `<div class="profile-timeline-empty" role="status">
      <span class="profile-timeline-empty-icon" aria-hidden="true"></span>
      <p class="profile-timeline-empty-title">No ${
        grain === "year" ? "yearly" : "quarterly"
      } data yet</p>
      <p class="profile-timeline-empty-copy">${escapeXml(
        emptyMessage || "Add roadmap periods to see the portfolio timeline."
      )}</p>
    </div>`;
  }

  function buildChromeHtml(model, options) {
    const opts = options && typeof options === "object" ? options : {};
    const grain = normalizeGranularity(
      (model && model.granularity) || opts.granularity || "quarter"
    );
    const bucketWord = grain === "year" ? "year" : "quarter";
    const totals = stackTotals(model);
    const legendSource =
      opts.legendModel && opts.legendModel.kind === "category" ? opts.legendModel : model;
    const activeFilter = normalizeSeriesFilter(legendSource, opts.seriesFilter);
    const isFiltered = Boolean(activeFilter && activeFilter.length);

    let legendItems = "";
    if (legendSource.kind === "category" && legendSource.series.length) {
      legendSource.series.forEach((series) => {
        const unique =
          Number(series.uniqueCount) ||
          (legendSource.uniqueBySeries && legendSource.uniqueBySeries[series.key]) ||
          0;
        if (unique <= 0 && !series.values.some((value) => Number(value) > 0)) return;
        const pressed = !isFiltered || activeFilter.includes(series.key);
        const filterClass = isFiltered
          ? pressed
            ? " is-filter-on"
            : " is-filter-off"
          : "";
        legendItems += `<button type="button" class="profile-timeline-legend-item${filterClass}" data-series="${escapeXml(
          series.key
        )}" aria-pressed="${pressed ? "true" : "false"}" title="${
          isFiltered && pressed
            ? `Remove ${escapeXml(series.label)} filter`
            : `Filter to ${escapeXml(series.label)}`
        }"><span class="profile-timeline-legend-swatch" style="background:${escapeXml(
          series.color
        )}"></span><span class="profile-timeline-legend-label">${escapeXml(
          series.label
        )}</span><span class="profile-timeline-legend-count">${escapeXml(
          formatCompactNumber(unique)
        )}</span></button>`;
      });
    }

    const clearFilterBtn = isFiltered
      ? `<button type="button" class="profile-timeline-clear-filter" aria-label="Clear timeline category filters"><span class="profile-timeline-clear-filter__icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg></span><span class="profile-timeline-clear-filter__label">Clear filters</span></button>`
      : "";

    const legendBlock = legendItems
      ? `<div class="profile-timeline-legend" role="group" aria-label="Filter by category">${legendItems}</div>`
      : "";

    const summary =
      model.kind === "numeric"
        ? model.aggregation === "average"
          ? `Average per ${bucketWord}`
          : `Total per ${bucketWord}`
        : isFiltered
          ? `Filtered count per ${bucketWord}`
          : `Stacked count per ${bucketWord}`;
    const summaryUnit =
      model.unitLabel && model.kind === "numeric" ? ` · ${model.unitLabel}` : "";

    const chrome = `<div class="profile-timeline-meta${legendBlock ? " has-legend" : ""}${
      isFiltered ? " has-filter" : ""
    }">
        <div class="profile-timeline-meta-head">
          <p class="profile-timeline-summary"><span class="profile-timeline-summary__label">${escapeXml(
            summary
          )}${escapeXml(summaryUnit)}</span></p>
          ${clearFilterBtn}
        </div>
        ${legendBlock}
      </div>
      ${buildInsightChips(model, totals)}`;

    return { chrome, totals, isFiltered, grain, bucketWord };
  }

  function comparePeriods(a, b) {
    const [ay, aq] = String(a).split("-Q").map(Number);
    const [by, bq] = String(b).split("-Q").map(Number);
    if (ay !== by) return ay - by;
    return aq - bq;
  }

  function compareBuckets(a, b, granularity) {
    if (normalizeGranularity(granularity) === "year") {
      return Number(a) - Number(b);
    }
    return comparePeriods(a, b);
  }

  function periodToBucket(period, granularity) {
    const key = normalizePeriodKey(period) || String(period || "").trim();
    if (!key) return null;
    if (normalizeGranularity(granularity) === "year") {
      const match = String(key).match(/^(\d{4})/);
      return match ? match[1] : null;
    }
    return normalizePeriodKey(key);
  }

  function uniqueBucketsFromPeriods(periods, granularity) {
    const seen = new Set();
    const buckets = [];
    (periods || []).forEach((period) => {
      const bucket = periodToBucket(period, granularity);
      if (!bucket || seen.has(bucket)) return;
      seen.add(bucket);
      buckets.push(bucket);
    });
    return buckets;
  }

  function normalizePeriodKey(raw) {
    if (typeof RoadmapPeriods !== "undefined" && typeof RoadmapPeriods.normalizePeriods === "function") {
      const normalized = RoadmapPeriods.normalizePeriods([{ period: raw, status: "Not Started" }]);
      return normalized[0] ? normalized[0].period : null;
    }
    const value = String(raw || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "");
    const match = value.match(/^(\d{4})-Q([1-4])$/);
    return match ? `${match[1]}-Q${match[2]}` : null;
  }

  function defaultGetPeriodEntries(roadmap) {
    if (typeof RoadmapPeriods !== "undefined" && typeof RoadmapPeriods.normalizePeriods === "function") {
      return RoadmapPeriods.normalizePeriods(
        roadmap && roadmap.roadmapPeriods,
        {
          legacyPeriod: (roadmap && (roadmap.roadmapPeriod || roadmap.projectPeriod)) || null,
          legacyStatus: (roadmap && (roadmap.roadmapStatus || roadmap.projectStatus)) || null
        }
      );
    }
    const periods = [];
    if (Array.isArray(roadmap && roadmap.roadmapPeriods)) {
      roadmap.roadmapPeriods.forEach((entry) => {
        const period = normalizePeriodKey(entry && entry.period);
        if (period) periods.push({ period, status: entry.status || "Not Started" });
      });
    }
    if (!periods.length) {
      const legacy = normalizePeriodKey(roadmap && (roadmap.roadmapPeriod || roadmap.projectPeriod));
      if (legacy) periods.push({ period: legacy, status: "Not Started" });
    }
    return periods;
  }

  function escapeXml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function resolveCategoryKey(roadmap, metricId, helpers) {
    const h = helpers || {};
    switch (metricId) {
      case "roadmapType": {
        const value = roadmap && roadmap.roadmapType != null ? String(roadmap.roadmapType).trim() : "";
        return value || "Not set";
      }
      case "tshirtSize": {
        const value = roadmap && roadmap.tshirtSize != null ? String(roadmap.tshirtSize).trim() : "";
        return value || "Not set";
      }
      case "moscow": {
        const value =
          roadmap && roadmap.moscowCategory != null ? String(roadmap.moscowCategory).trim() : "";
        return value || "Not set";
      }
      case "kano": {
        if (typeof h.getKanoKey === "function") return h.getKanoKey(roadmap);
        const f = roadmap && roadmap.kanoFunctionality;
        const s = roadmap && roadmap.kanoSatisfaction;
        if (f == null || s == null || f === "" || s === "") return UNPOSITIONED_KANO_KEY;
        if (typeof getKanoCellZoneId === "function") {
          return getKanoCellZoneId(Number(f), Number(s)) || UNPOSITIONED_KANO_KEY;
        }
        return UNPOSITIONED_KANO_KEY;
      }
      case "financialFramework": {
        if (typeof h.normalizeFramework === "function") {
          return h.normalizeFramework(roadmap && roadmap.financialImpactFramework);
        }
        const raw = String((roadmap && roadmap.financialImpactFramework) || "custom")
          .trim()
          .toLowerCase();
        return raw || "custom";
      }
      case "currency": {
        const value =
          roadmap && roadmap.financialImpactCurrency != null
            ? String(roadmap.financialImpactCurrency).trim().toUpperCase()
            : "";
        return value || "Not set";
      }
      default:
        return "Not set";
    }
  }

  function resolveNumericValue(roadmap, metricId, helpers) {
    const h = helpers || {};
    if (metricId === "financialImpact") {
      if (typeof h.getFinancialImpactEur === "function") {
        const value = h.getFinancialImpactEur(roadmap);
        return Number.isFinite(value) ? value : null;
      }
      const amount = Number(roadmap && roadmap.financialImpactValue);
      return Number.isFinite(amount) ? amount : null;
    }
    if (metricId === "riceScore") {
      if (typeof h.calculateRiceScore === "function") {
        const score = h.calculateRiceScore(roadmap);
        return Number.isFinite(score) ? score : null;
      }
      if (typeof calculateRiceScore === "function") {
        const score = calculateRiceScore(roadmap);
        return Number.isFinite(score) ? score : null;
      }
      return null;
    }
    return null;
  }

  function labelForCategory(metricId, key, helpers) {
    const h = helpers || {};
    if (typeof h.labelFor === "function") {
      const custom = h.labelFor(metricId, key);
      if (custom) return custom;
    }
    if (metricId === "kano" && key === UNPOSITIONED_KANO_KEY) return "Not positioned";
    if (metricId === "moscow") {
      const map = {
        "Must have": "Must",
        "Should have": "Should",
        "Could have": "Could",
        "Won't have": "Won't"
      };
      return map[key] || key;
    }
    if (metricId === "financialFramework") {
      const map = {
        custom: "Custom",
        clv: "CLV",
        nps: "NPS",
        risk: "Risk",
        headcount: "Headcount",
        operational: "Operational"
      };
      return map[key] || key;
    }
    return key;
  }

  function preferredCategoryOrder(metricId, helpers) {
    const h = helpers || {};
    if (typeof h.sortOrderFor === "function") {
      const order = h.sortOrderFor(metricId);
      if (Array.isArray(order) && order.length) return order.slice();
    }
    if (metricId === "moscow" && typeof moscowList !== "undefined") return moscowList.slice();
    if (metricId === "tshirtSize" && typeof tshirtSizeList !== "undefined") return tshirtSizeList.slice();
    if (metricId === "financialFramework") {
      return ["custom", "clv", "headcount", "operational", "nps", "risk"];
    }
    if (metricId === "kano" && typeof kanoCategoryLegend !== "undefined") {
      return kanoCategoryLegend.map((entry) => entry.id).concat(UNPOSITIONED_KANO_KEY);
    }
    return [];
  }

  function sortCategoryKeys(keys, metricId, helpers) {
    const preferred = preferredCategoryOrder(metricId, helpers);
    const remaining = keys.slice().sort((a, b) => String(a).localeCompare(String(b)));
    if (!preferred.length) return remaining;
    const used = new Set();
    const ordered = [];
    preferred.forEach((key) => {
      if (keys.includes(key) && !used.has(key)) {
        ordered.push(key);
        used.add(key);
      }
    });
    remaining.forEach((key) => {
      if (!used.has(key)) ordered.push(key);
    });
    return ordered;
  }

  /**
   * Build chart model for a metric.
   * @param {string} [granularityOrOptions] - "quarter" | "year", or helpers.granularity
   * @returns {{ metricId, kind, aggregation, periods, series, empty, emptyMessage, unitLabel, granularity }}
   */
  function buildSeries(roadmaps, metricId, helpers, granularity) {
    const metric = getMetric(metricId);
    const h = helpers || {};
    const grain = normalizeGranularity(
      granularity != null ? granularity : h.granularity != null ? h.granularity : "quarter"
    );
    const getPeriodEntries =
      typeof h.getPeriodEntries === "function" ? h.getPeriodEntries : defaultGetPeriodEntries;
    const list = Array.isArray(roadmaps) ? roadmaps : [];

    const periodSet = new Set();
    const contributions = [];
    let roadmapSeq = 0;

    list.forEach((roadmap) => {
      const entries = getPeriodEntries(roadmap) || [];
      const periods = entries
        .map((entry) => normalizePeriodKey(entry && entry.period))
        .filter(Boolean);
      if (!periods.length) return;
      // Annual: one contribution per calendar year (Q1+Q2 of 2026 → once in 2026).
      const buckets = uniqueBucketsFromPeriods(periods, grain);
      if (!buckets.length) return;
      buckets.forEach((bucket) => periodSet.add(bucket));

      const roadmapId =
        roadmap && roadmap.id != null && String(roadmap.id).trim()
          ? String(roadmap.id)
          : `__anon_${roadmapSeq++}`;

      if (metric.kind === "category") {
        const key = resolveCategoryKey(roadmap, metric.id, h);
        buckets.forEach((bucket) => {
          contributions.push({ period: bucket, key, value: 1, roadmapId });
        });
      } else {
        const value = resolveNumericValue(roadmap, metric.id, h);
        if (value == null) return;
        buckets.forEach((bucket) => {
          contributions.push({ period: bucket, key: metric.id, value, roadmapId });
        });
      }
    });

    const periods = Array.from(periodSet).sort((a, b) => compareBuckets(a, b, grain));
    if (!periods.length || !contributions.length) {
      return {
        metricId: metric.id,
        kind: metric.kind,
        aggregation: metric.aggregation || null,
        periods: [],
        series: [],
        empty: true,
        emptyMessage:
          grain === "year"
            ? "No yearly data yet. Add roadmap periods (e.g. 2026-Q1) to see this timeline."
            : "No quarterly data yet. Add roadmap periods (e.g. 2026-Q1) to see this timeline.",
        unitLabel: metric.kind === "numeric" && metric.id === "financialImpact" ? "EUR" : "",
        granularity: grain,
        uniqueCount: 0,
        uniqueBySeries: {},
        uniqueNumericTotal: 0,
        uniqueNumericAverage: 0
      };
    }

    // Unique portfolio stats (do not sum period buckets — multi-period roadmaps would double-count).
    const uniqueIds = new Set(contributions.map((row) => row.roadmapId));
    const uniqueCount = uniqueIds.size;
    const uniqueBySeries = {};
    const uniqueNumericById = new Map();
    contributions.forEach((row) => {
      if (!uniqueBySeries[row.key]) uniqueBySeries[row.key] = new Set();
      uniqueBySeries[row.key].add(row.roadmapId);
      if (!uniqueNumericById.has(row.roadmapId)) {
        uniqueNumericById.set(row.roadmapId, row.value);
      }
    });
    const uniqueSeriesCounts = {};
    Object.keys(uniqueBySeries).forEach((key) => {
      uniqueSeriesCounts[key] = uniqueBySeries[key].size;
    });
    let uniqueNumericTotal = 0;
    uniqueNumericById.forEach((value) => {
      uniqueNumericTotal += Number(value) || 0;
    });
    const uniqueNumericAverage = uniqueCount ? uniqueNumericTotal / uniqueCount : 0;

    if (metric.kind === "category") {
      const keys = sortCategoryKeys(
        Array.from(new Set(contributions.map((row) => row.key))),
        metric.id,
        h
      );
      const series = keys.map((key, index) => {
        const values = periods.map((period) => {
          let total = 0;
          contributions.forEach((row) => {
            if (row.period === period && row.key === key) total += 1;
          });
          return total;
        });
        return {
          key,
          label: labelForCategory(metric.id, key, h),
          color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
          values,
          uniqueCount: uniqueSeriesCounts[key] || 0
        };
      });
      return {
        metricId: metric.id,
        kind: "category",
        aggregation: "count",
        periods,
        series,
        empty: false,
        emptyMessage: "",
        unitLabel: "roadmaps",
        granularity: grain,
        uniqueCount,
        uniqueBySeries: uniqueSeriesCounts,
        uniqueNumericTotal: 0,
        uniqueNumericAverage: 0
      };
    }

    const values = periods.map((period) => {
      let sum = 0;
      let count = 0;
      contributions.forEach((row) => {
        if (row.period !== period) return;
        sum += row.value;
        count += 1;
      });
      if (!count) return 0;
      if (metric.aggregation === "average") return sum / count;
      return sum;
    });

    return {
      metricId: metric.id,
      kind: "numeric",
      aggregation: metric.aggregation || "sum",
      periods,
      series: [
        {
          key: metric.id,
          label: metric.label,
          color: NUMERIC_BAR_COLOR,
          values,
          uniqueCount
        }
      ],
      empty: false,
      emptyMessage: "",
      unitLabel: metric.id === "financialImpact" ? "EUR" : metric.id === "riceScore" ? "avg RICE" : "",
      granularity: grain,
      uniqueCount,
      uniqueBySeries: uniqueSeriesCounts,
      uniqueNumericTotal,
      uniqueNumericAverage
    };
  }

  function niceMax(value) {
    if (!Number.isFinite(value) || value <= 0) return 1;
    const padded = value * 1.1;
    const magnitude = Math.pow(10, Math.floor(Math.log10(padded)));
    const normalized = padded / magnitude;
    let nice;
    if (normalized <= 1) nice = 1;
    else if (normalized <= 2) nice = 2;
    else if (normalized <= 5) nice = 5;
    else nice = 10;
    return nice * magnitude;
  }

  function formatCompactNumber(value) {
    if (!Number.isFinite(value)) return "0";
    const abs = Math.abs(value);
    const trim = (n) => {
      const fixed = Math.abs(n - Math.round(n)) < 0.05 ? Math.round(n).toString() : n.toFixed(1);
      return fixed.replace(/\.0$/, "");
    };
    if (abs >= 1000000) return `${trim(value / 1000000)}M`;
    if (abs >= 1000) return `${trim(value / 1000)}k`;
    if (abs >= 10 || Number.isInteger(value)) return String(Math.round(value));
    return Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 });
  }

  function formatTick(value, metricId) {
    if (!Number.isFinite(value)) return "0";
    if (metricId === "financialImpact") return formatCompactNumber(value);
    if (metricId === "riceScore") {
      return Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 });
    }
    return String(Math.round(value));
  }

  function formatValueLabel(value, metricId, unitLabel) {
    const core = formatTick(value, metricId);
    if (metricId === "financialImpact" && unitLabel) return core;
    if (unitLabel && metricId === "riceScore") return core;
    return core;
  }

  function splitPeriod(period) {
    const match = String(period || "").match(/^(\d{4})-Q([1-4])$/i);
    if (!match) return { year: "", quarter: String(period || "") };
    return { year: match[1], quarter: `Q${match[2]}` };
  }

  function stackTotals(model) {
    return model.periods.map((_, periodIndex) =>
      model.series.reduce((sum, series) => sum + (Number(series.values[periodIndex]) || 0), 0)
    );
  }

  function categorySeriesKeys(model) {
    if (!model || model.kind !== "category" || !Array.isArray(model.series)) return [];
    return model.series.map((series) => series.key);
  }

  /**
   * Normalize filter keys. null/empty/all-selected → null (show everything).
   */
  function normalizeSeriesFilter(model, filterKeys) {
    if (!model || model.kind !== "category") return null;
    const allKeys = categorySeriesKeys(model);
    if (!allKeys.length) return null;
    if (!Array.isArray(filterKeys) || !filterKeys.length) return null;
    const allowed = [];
    const seen = new Set();
    filterKeys.forEach((key) => {
      if (!allKeys.includes(key) || seen.has(key)) return;
      seen.add(key);
      allowed.push(key);
    });
    if (!allowed.length || allowed.length === allKeys.length) return null;
    return allowed;
  }

  /**
   * Toggle a series key in the filter set (multi-select).
   * Isolates on first click from "all"; clicking the sole active key clears filter.
   */
  function toggleSeriesFilter(model, currentFilter, seriesKey) {
    if (!seriesKey || !model || model.kind !== "category") return null;
    const allKeys = categorySeriesKeys(model);
    if (!allKeys.includes(seriesKey)) return normalizeSeriesFilter(model, currentFilter);

    const active = normalizeSeriesFilter(model, currentFilter);
    if (!active) {
      // From "show all" → isolate this series.
      return [seriesKey];
    }
    if (active.length === 1 && active[0] === seriesKey) {
      // Sole filter clicked again → clear (show all).
      return null;
    }
    if (active.includes(seriesKey)) {
      const next = active.filter((key) => key !== seriesKey);
      return normalizeSeriesFilter(model, next);
    }
    return normalizeSeriesFilter(model, active.concat(seriesKey));
  }

  /**
   * Return a chart model limited to selected series (KPIs + stacks update).
   * Legend should still render from the base model.
   */
  function applySeriesFilter(model, filterKeys) {
    const normalized = normalizeSeriesFilter(model, filterKeys);
    if (!model || !normalized) {
      return { model, filterKeys: null, isFiltered: false };
    }
    const series = model.series.filter((entry) => normalized.includes(entry.key));
    let uniqueCount = 0;
    const uniqueBySeries = {};
    series.forEach((entry) => {
      const count = Number(entry.uniqueCount) || 0;
      uniqueCount += count;
      uniqueBySeries[entry.key] = count;
    });
    return {
      model: Object.assign({}, model, {
        series,
        uniqueCount,
        uniqueBySeries,
        filtered: true
      }),
      filterKeys: normalized,
      isFiltered: true
    };
  }

  function roundedTopBarPath(x, y, width, height, radius) {
    const h = Math.max(height, 0.5);
    const r = Math.max(0, Math.min(radius, width / 2, h));
    const bottom = y + h;
    if (r <= 0.25) {
      return `M${x.toFixed(2)},${y.toFixed(2)} h${width.toFixed(2)} v${h.toFixed(2)} h${(-width).toFixed(
        2
      )} Z`;
    }
    return [
      `M${x.toFixed(2)},${bottom.toFixed(2)}`,
      `V${(y + r).toFixed(2)}`,
      `Q${x.toFixed(2)},${y.toFixed(2)} ${(x + r).toFixed(2)},${y.toFixed(2)}`,
      `H${(x + width - r).toFixed(2)}`,
      `Q${(x + width).toFixed(2)},${y.toFixed(2)} ${(x + width).toFixed(2)},${(y + r).toFixed(2)}`,
      `V${bottom.toFixed(2)}`,
      "Z"
    ].join(" ");
  }

  function buildInsightChips(model, totals) {
    const grain = normalizeGranularity(model && model.granularity);
    const bucketLabel = grain === "year" ? "years" : "quarters";
    const activeCount = totals.filter((value) => value > 0).length;
    const peakIndex = totals.reduce(
      (best, value, index) => (value > totals[best] ? index : best),
      0
    );
    const peakPeriod = model.periods[peakIndex] || "—";
    const peakValue = totals[peakIndex] || 0;
    const uniqueCount = Number(model.uniqueCount) || 0;

    let portfolioLabel = "Unique roadmaps";
    let portfolioValue = formatTick(uniqueCount, model.metricId);
    let portfolioDetail = model.unitLabel || "roadmaps";
    if (model.kind === "numeric" && model.aggregation === "average") {
      portfolioLabel = "Portfolio avg";
      portfolioValue = formatTick(model.uniqueNumericAverage, model.metricId);
      portfolioDetail = model.unitLabel || "";
    } else if (model.kind === "numeric" && model.aggregation === "sum") {
      portfolioLabel = "Portfolio total";
      portfolioValue = formatTick(model.uniqueNumericTotal, model.metricId);
      portfolioDetail = model.unitLabel || "";
    }

    const chips = [
      {
        label: "Peak",
        value: `${peakPeriod}`,
        detail:
          formatTick(peakValue, model.metricId) +
          (model.unitLabel ? ` ${model.unitLabel}` : " roadmaps"),
        accent: true
      },
      {
        label: portfolioLabel,
        value: portfolioValue,
        detail: portfolioDetail
      },
      {
        label: `Active ${bucketLabel}`,
        value: String(activeCount),
        detail: `of ${model.periods.length}`
      }
    ];

    return `<div class="profile-timeline-kpi" role="list">${chips
      .map(
        (chip) => `<div class="profile-timeline-kpi-item${
          chip.accent ? " profile-timeline-kpi-item--accent" : ""
        }" role="listitem">
        <span class="profile-timeline-kpi-label">${escapeXml(chip.label)}</span>
        <span class="profile-timeline-kpi-value">${escapeXml(chip.value)}</span>
        ${
          chip.detail
            ? `<span class="profile-timeline-kpi-detail">${escapeXml(chip.detail)}</span>`
            : ""
        }
      </div>`
      )
      .join("")}</div>`;
  }

  function bindChartInteractions(container) {
    if (!container || typeof document === "undefined") return;
    const tip = container.querySelector(".profile-timeline-tooltip");
    const plot = container.querySelector(".profile-timeline-plot");
    const wrap = container.querySelector(".profile-timeline-chart-wrap");
    if (!tip || !plot) return;

    const hide = () => {
      tip.hidden = true;
      tip.setAttribute("aria-hidden", "true");
      plot.classList.remove("is-hovering");
      container.querySelectorAll(".profile-timeline-bar.is-active").forEach((node) => {
        node.classList.remove("is-active");
      });
      container.querySelectorAll(".profile-timeline-col.is-active").forEach((node) => {
        node.classList.remove("is-active");
      });
    };

    const show = (target, event) => {
      const period = target.getAttribute("data-period") || "";
      const series = target.getAttribute("data-series-label") || "";
      const display = target.getAttribute("data-display") || target.getAttribute("data-value") || "";
      const unit = target.getAttribute("data-unit") || "";
      tip.innerHTML = `<strong>${escapeXml(period)}</strong>${
        series ? `<span class="profile-timeline-tooltip-series">${escapeXml(series)}</span>` : ""
      }<span class="profile-timeline-tooltip-value">${escapeXml(display)}${
        unit ? ` ${escapeXml(unit)}` : ""
      }</span>`;
      tip.hidden = false;
      tip.setAttribute("aria-hidden", "false");
      plot.classList.add("is-hovering");
      container.querySelectorAll(".profile-timeline-bar.is-active").forEach((node) => {
        node.classList.remove("is-active");
      });
      container.querySelectorAll(".profile-timeline-col.is-active").forEach((node) => {
        node.classList.remove("is-active");
      });
      target.classList.add("is-active");
      const col = target.closest(".profile-timeline-col");
      if (col) col.classList.add("is-active");

      const bounds = plot.getBoundingClientRect();
      const tipWidth = tip.offsetWidth || 140;
      const tipHeight = tip.offsetHeight || 64;
      let x = event.clientX - bounds.left + 14;
      let y = event.clientY - bounds.top - tipHeight - 10;
      if (x + tipWidth > bounds.width - 8) x = bounds.width - tipWidth - 8;
      if (x < 8) x = 8;
      if (y < 8) y = event.clientY - bounds.top + 16;
      tip.style.left = `${x}px`;
      tip.style.top = `${y}px`;
    };

    plot.addEventListener("pointerleave", hide);
    plot.addEventListener("pointerover", (event) => {
      const target = event.target && event.target.closest ? event.target.closest("[data-tip]") : null;
      if (!target || !plot.contains(target)) {
        hide();
        return;
      }
      show(target, event);
    });
    plot.addEventListener("pointermove", (event) => {
      const target = event.target && event.target.closest ? event.target.closest("[data-tip]") : null;
      if (!target || !plot.contains(target)) return;
      show(target, event);
    });

    if (!wrap) return;
    wrap.querySelectorAll(".profile-timeline-legend-item").forEach((item) => {
      item.addEventListener("click", () => {
        const key = item.getAttribute("data-series");
        const state = container._ptRenderState;
        if (!key || !state || !state.baseModel) return;
        const nextFilter = toggleSeriesFilter(state.baseModel, state.seriesFilter, key);
        state.seriesFilter = nextFilter;
        repaintFromState(container);
      });
    });
  }

  function renderSvg(model, options) {
    const opts = options && typeof options === "object" ? options : {};
    const grain = normalizeGranularity(
      (model && model.granularity) || opts.granularity || "quarter"
    );
    if (!model || model.empty) {
      return emptyStateHtml(grain, model && model.emptyMessage);
    }

    const chromeParts = buildChromeHtml(model, opts);
    const { chrome, totals, isFiltered } = chromeParts;

    const periodCount = Math.max(model.periods.length, 1);
    const measured = Number(opts.containerWidth);
    const width = Math.max(
      Number.isFinite(measured) && measured > 40 ? measured : 0,
      Math.max(680, 80 + periodCount * (grain === "year" ? 140 : 96))
    );
    const height = 300;
    const margin = { top: 28, right: 18, bottom: 54, left: 48 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const maxRaw = Math.max(...totals, 0);
    const maxValue = niceMax(maxRaw);
    const peakIndex = totals.reduce(
      (best, value, index) => (value > totals[best] ? index : best),
      0
    );
    // Dense but capped: few annual columns should not become giant slabs.
    const barGap = periodCount <= 4 ? 0.22 : periodCount <= 8 ? 0.16 : 0.12;
    const slot = plotWidth / periodCount;
    const maxBar =
      periodCount <= 2 ? 120 : periodCount <= 4 ? 100 : periodCount <= 6 ? 88 : slot;
    const barWidth = Math.max(28, Math.min(maxBar, slot * (1 - barGap)));

    const uid = `pt${String(model.metricId || "m").replace(/[^a-zA-Z0-9]/g, "")}${periodCount}${grain}`;
    const gradientId = `${uid}BarGrad`;
    const fadeId = `${uid}PlotFade`;
    let clipDefs = "";

    let bars = "";
    model.periods.forEach((period, periodIndex) => {
      const x = margin.left + periodIndex * slot + (slot - barWidth) / 2;
      const total = totals[periodIndex] || 0;
      const isPeak = periodIndex === peakIndex && total > 0;
      const colClass = `profile-timeline-col${isPeak ? " profile-timeline-col--peak" : ""}${
        total <= 0 ? " profile-timeline-col--empty" : ""
      }`;
      bars += `<g class="${colClass}" data-period="${escapeXml(period)}">`;
      bars += `<rect class="profile-timeline-col-track" x="${(margin.left + periodIndex * slot + 2).toFixed(
        2
      )}" y="${margin.top}" width="${Math.max(slot - 4, 1).toFixed(2)}" height="${plotHeight}" rx="10" />`;

      if (total <= 0) {
        const ghostY = margin.top + plotHeight - 8;
        bars += `<rect class="profile-timeline-ghost" x="${x.toFixed(2)}" y="${ghostY.toFixed(
          2
        )}" width="${barWidth.toFixed(2)}" height="8" rx="4" />`;
      } else if (model.kind === "category") {
        let yCursor = margin.top + plotHeight;
        const stackTop = margin.top + plotHeight - (total / maxValue) * plotHeight;
        const clipId = `${uid}Clip${periodIndex}`;
        clipDefs += `<clipPath id="${clipId}"><path d="${roundedTopBarPath(
          x,
          stackTop,
          barWidth,
          (total / maxValue) * plotHeight,
          Math.min(10, barWidth / 2)
        )}"/></clipPath>`;
        bars += `<g clip-path="url(#${clipId})">`;
        model.series.forEach((series) => {
          const value = Number(series.values[periodIndex]) || 0;
          if (value <= 0) return;
          const barHeight = (value / maxValue) * plotHeight;
          yCursor -= barHeight;
          const display = String(value);
          bars += `<rect class="profile-timeline-bar" data-tip="1" x="${x.toFixed(2)}" y="${yCursor.toFixed(
            2
          )}" width="${barWidth.toFixed(2)}" height="${Math.max(barHeight, 0.5).toFixed(
            2
          )}" fill="${escapeXml(series.color)}" data-period="${escapeXml(period)}" data-series="${escapeXml(
            series.key
          )}" data-series-label="${escapeXml(series.label)}" data-value="${value}" data-display="${escapeXml(
            display
          )}" data-unit="${escapeXml(model.unitLabel || "roadmaps")}" style="--bar-delay:${(
            periodIndex * 0.035
          ).toFixed(2)}s" />`;
        });
        bars += `</g>`;
        if (total > 0) {
          bars += `<text class="profile-timeline-value-label${
            isPeak ? " profile-timeline-value-label--peak" : ""
          }" x="${(x + barWidth / 2).toFixed(2)}" y="${Math.max(stackTop - 8, 14).toFixed(
            2
          )}" text-anchor="middle">${escapeXml(formatCompactNumber(total))}</text>`;
        }
      } else {
        const value = Number(model.series[0].values[periodIndex]) || 0;
        const barHeight = (value / maxValue) * plotHeight;
        const y = margin.top + plotHeight - barHeight;
        const display = formatValueLabel(value, model.metricId, model.unitLabel);
        bars += `<path class="profile-timeline-bar profile-timeline-bar--numeric${
          isPeak ? " profile-timeline-bar--peak" : ""
        }" data-tip="1" d="${roundedTopBarPath(
          x,
          y,
          barWidth,
          barHeight,
          Math.min(10, barWidth / 2)
        )}" fill="url(#${gradientId})" data-period="${escapeXml(period)}" data-value="${value}" data-display="${escapeXml(
          display
        )}" data-unit="${escapeXml(model.unitLabel || "")}" style="--bar-delay:${(periodIndex * 0.04).toFixed(
          2
        )}s" />`;
        if (value > 0) {
          bars += `<text class="profile-timeline-value-label${
            isPeak ? " profile-timeline-value-label--peak" : ""
          }" x="${(x + barWidth / 2).toFixed(2)}" y="${Math.max(y - 8, 14).toFixed(
            2
          )}" text-anchor="middle">${escapeXml(display)}</text>`;
        }
      }
      bars += `</g>`;
    });

    let xLabels = "";
    let lastYear = "";
    model.periods.forEach((period, periodIndex) => {
      const x = margin.left + periodIndex * slot + slot / 2;
      if (grain === "year") {
        xLabels += `<text class="profile-timeline-axis-quarter" x="${x.toFixed(2)}" y="${(
          height - 18
        ).toFixed(2)}" text-anchor="middle">${escapeXml(period)}</text>`;
        return;
      }
      const parts = splitPeriod(period);
      const showYear = parts.year && parts.year !== lastYear;
      if (showYear) lastYear = parts.year;
      xLabels += `<text class="profile-timeline-axis-quarter" x="${x.toFixed(2)}" y="${(
        height - 24
      ).toFixed(2)}" text-anchor="middle">${escapeXml(parts.quarter || period)}</text>`;
      if (showYear) {
        xLabels += `<text class="profile-timeline-axis-year" x="${x.toFixed(2)}" y="${(
          height - 10
        ).toFixed(2)}" text-anchor="middle">${escapeXml(parts.year)}</text>`;
      } else {
        xLabels += `<text class="profile-timeline-axis-year profile-timeline-axis-year--muted" x="${x.toFixed(
          2
        )}" y="${(height - 10).toFixed(2)}" text-anchor="middle">${escapeXml(
          parts.year || ""
        )}</text>`;
      }
    });

    const tickCount = 4;
    let yGrid = "";
    for (let i = 0; i <= tickCount; i += 1) {
      const ratio = i / tickCount;
      const value = maxValue * (1 - ratio);
      const y = margin.top + plotHeight * ratio;
      const isBase = i === tickCount;
      yGrid += `<line class="profile-timeline-grid${isBase ? " profile-timeline-grid--base" : ""}" x1="${
        margin.left
      }" x2="${width - margin.right}" y1="${y.toFixed(2)}" y2="${y.toFixed(2)}" />`;
      yGrid += `<text class="profile-timeline-axis-y" x="${margin.left - 10}" y="${(y + 3.5).toFixed(
        2
      )}" text-anchor="end">${escapeXml(formatTick(value, model.metricId))}</text>`;
    }

    return `<div class="profile-timeline-chart-wrap${
      isFiltered ? " has-series-filter" : ""
    }" data-granularity="${escapeXml(grain)}" data-view="chart">
      ${chrome}
      <div class="profile-timeline-plot">
        <div class="profile-timeline-svg-scroll">
          <svg class="profile-timeline-svg" viewBox="0 0 ${width} ${height}" width="100%" height="auto" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${escapeXml(
      opts.ariaLabel || "Portfolio timeline chart"
    )}">
            <defs>
              <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="${NUMERIC_BAR_COLOR_SOFT}"/>
                <stop offset="100%" stop-color="${NUMERIC_BAR_COLOR}"/>
              </linearGradient>
              <linearGradient id="${fadeId}" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#0f766e" stop-opacity="0.04"/>
                <stop offset="100%" stop-color="#0f766e" stop-opacity="0"/>
              </linearGradient>
              ${clipDefs}
            </defs>
            <rect class="profile-timeline-plot-bg" x="${margin.left}" y="${margin.top}" width="${plotWidth}" height="${plotHeight}" rx="12" fill="url(#${fadeId})" />
            ${yGrid}
            <line class="profile-timeline-axis" x1="${margin.left}" x2="${width - margin.right}" y1="${
      margin.top + plotHeight
    }" y2="${margin.top + plotHeight}" />
            ${bars}
            ${xLabels}
          </svg>
        </div>
        <div class="profile-timeline-tooltip" hidden aria-hidden="true"></div>
      </div>
    </div>`;
  }

  function renderTable(model, options) {
    const opts = options && typeof options === "object" ? options : {};
    const grain = normalizeGranularity(
      (model && model.granularity) || opts.granularity || "quarter"
    );
    if (!model || model.empty) {
      return emptyStateHtml(grain, model && model.emptyMessage);
    }

    const chromeParts = buildChromeHtml(model, opts);
    const { chrome, totals, isFiltered } = chromeParts;
    const periodLabel = grain === "year" ? "Year" : "Period";

    const peakIndex = totals.reduce(
      (best, value, index) => (value > totals[best] ? index : best),
      0
    );
    const bucketPrevLabel = grain === "year" ? "vs prior year" : "vs prior quarter";

    const formatPeriodGrowth = (current, previous, hasPrevious) => {
      const curr = Number(current) || 0;
      const prev = Number(previous) || 0;
      if (!hasPrevious) {
        return { text: "—", dir: "flat", title: "No prior period" };
      }
      if (prev === 0 && curr === 0) {
        return { text: "—", dir: "flat", title: bucketPrevLabel };
      }
      if (prev === 0 && curr > 0) {
        return { text: "New", dir: "up", title: `New ${bucketPrevLabel}` };
      }
      if (curr === 0 && prev > 0) {
        return { text: "−100%", dir: "down", title: bucketPrevLabel };
      }
      const pct = ((curr - prev) / prev) * 100;
      const rounded = Math.round(pct);
      const text = `${rounded > 0 ? "+" : ""}${rounded}%`;
      const dir = rounded > 0 ? "up" : rounded < 0 ? "down" : "flat";
      return { text, dir, title: bucketPrevLabel };
    };

    const valueCell = (value, display, { previous, hasPrevious, totalCell } = {}) => {
      const growth = formatPeriodGrowth(value, previous, hasPrevious);
      const zeroClass = value === 0 ? " is-zero" : "";
      const totalClass = totalCell ? " profile-timeline-table-total" : "";
      return `<td class="profile-timeline-table-value${totalClass}${zeroClass}"><span class="profile-timeline-table-value__num">${escapeXml(
        display
      )}</span><span class="profile-timeline-table-value__growth is-${growth.dir}" title="${escapeXml(
        growth.title
      )}">${escapeXml(growth.text)}</span></td>`;
    };

    // Period → Total → categories
    let headCells = `<th scope="col" class="profile-timeline-table-period">${escapeXml(
      periodLabel
    )}</th>`;
    if (model.kind === "category") {
      headCells += `<th scope="col" class="profile-timeline-table-total">Total</th>`;
      model.series.forEach((series) => {
        headCells += `<th scope="col" class="profile-timeline-table-series" title="${escapeXml(
          series.label
        )}"><span class="profile-timeline-table-series-inner"><span class="profile-timeline-table-swatch" style="background:${escapeXml(
          series.color
        )}"></span><span class="profile-timeline-table-series-label">${escapeXml(
          series.label
        )}</span></span></th>`;
      });
    } else {
      const valueHeader = model.unitLabel
        ? `${getMetric(model.metricId).label} (${model.unitLabel})`
        : getMetric(model.metricId).label;
      headCells += `<th scope="col" class="profile-timeline-table-total" title="${escapeXml(
        valueHeader
      )}">${escapeXml(valueHeader)}</th>`;
    }

    let bodyRows = "";
    model.periods.forEach((period, periodIndex) => {
      const total = totals[periodIndex] || 0;
      const prevTotal = periodIndex > 0 ? totals[periodIndex - 1] || 0 : 0;
      const hasPrevious = periodIndex > 0;
      const isPeak = periodIndex === peakIndex && total > 0;
      let cells = `<th scope="row" class="profile-timeline-table-period">${escapeXml(period)}</th>`;
      if (model.kind === "category") {
        cells += valueCell(total, formatCompactNumber(total), {
          previous: prevTotal,
          hasPrevious,
          totalCell: true
        });
        model.series.forEach((series) => {
          const value = Number(series.values[periodIndex]) || 0;
          const previous = hasPrevious ? Number(series.values[periodIndex - 1]) || 0 : 0;
          cells += valueCell(value, formatCompactNumber(value), {
            previous,
            hasPrevious
          });
        });
      } else {
        const values = (model.series[0] && model.series[0].values) || [];
        const value = Number(values[periodIndex]) || 0;
        const previous = hasPrevious ? Number(values[periodIndex - 1]) || 0 : 0;
        cells += valueCell(value, formatTick(value, model.metricId), {
          previous,
          hasPrevious,
          totalCell: true
        });
      }
      bodyRows += `<tr${isPeak ? ' class="profile-timeline-table-row--peak"' : ""}>${cells}</tr>`;
    });

    const seriesCount = model.kind === "category" ? model.series.length : 0;
    const colCount = 1 + (model.kind === "category" ? 1 + seriesCount : 1);
    let colgroup = `<colgroup><col class="profile-timeline-col--period" />`;
    if (model.kind === "category") {
      colgroup += `<col class="profile-timeline-col--total" />`;
      for (let i = 0; i < seriesCount; i += 1) {
        colgroup += `<col class="profile-timeline-col--series" />`;
      }
    } else {
      colgroup += `<col class="profile-timeline-col--total" />`;
    }
    colgroup += `</colgroup>`;

    return `<div class="profile-timeline-chart-wrap${
      isFiltered ? " has-series-filter" : ""
    }" data-granularity="${escapeXml(grain)}" data-view="table">
      ${chrome}
      <div class="profile-timeline-table-wrap">
        <table class="profile-timeline-table profile-timeline-table--calm" style="--pt-cols:${colCount};--pt-series:${Math.max(
      seriesCount,
      1
    )}" aria-label="${escapeXml(opts.ariaLabel || "Portfolio timeline table")}">
          ${colgroup}
          <thead><tr>${headCells}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>
    </div>`;
  }

  function repaintFromState(container) {
    const state = container && container._ptRenderState;
    if (!state || !state.baseModel) return;
    paintView(container, state.baseModel, state.metricId, {
      containerWidth: state.lastWidth || container.clientWidth || 720,
      granularity: state.granularity,
      seriesFilter: state.seriesFilter,
      legendModel: state.baseModel,
      viewMode: state.viewMode
    });
  }

  function paintView(container, baseModel, metricId, options) {
    const opts = options && typeof options === "object" ? options : {};
    const grain = normalizeGranularity((baseModel && baseModel.granularity) || opts.granularity);
    const viewMode = normalizeViewMode(
      opts.viewMode != null
        ? opts.viewMode
        : container._ptRenderState && container._ptRenderState.viewMode
    );
    const width =
      Number(opts.containerWidth) > 0
        ? Number(opts.containerWidth)
        : container && container.clientWidth
          ? container.clientWidth
          : 720;
    const applied = applySeriesFilter(baseModel, opts.seriesFilter);
    const viewModel = applied.model;
    const renderOpts = {
      ariaLabel: `${getMetric(metricId).label} by ${grain === "year" ? "year" : "quarter"}`,
      containerWidth: width,
      granularity: grain,
      seriesFilter: applied.filterKeys,
      legendModel: opts.legendModel || baseModel
    };
    container.innerHTML =
      viewMode === "table" ? renderTable(viewModel, renderOpts) : renderSvg(viewModel, renderOpts);
    if (container._ptRenderState) {
      container._ptRenderState.viewMode = viewMode;
      container._ptRenderState.seriesFilter = applied.filterKeys;
    }
    try {
      bindChartInteractions(container);
      const clearBtn = container.querySelector(".profile-timeline-clear-filter");
      if (clearBtn) {
        clearBtn.addEventListener("click", (event) => {
          event.preventDefault();
          const state = container._ptRenderState;
          if (!state || !state.baseModel) return;
          state.seriesFilter = null;
          repaintFromState(container);
        });
      }
    } catch (error) {
      if (typeof console !== "undefined" && console.warn) {
        console.warn("ProfileOverviewTimeline: interaction bind failed", error);
      }
    }
  }

  function bindResizeObserver(container) {
    if (!container || typeof ResizeObserver === "undefined") return;
    if (container._ptResizeObserver) return;
    let timer = null;
    const observer = new ResizeObserver((entries) => {
      const entry = entries && entries[0];
      const nextWidth = entry && entry.contentRect ? entry.contentRect.width : 0;
      if (!nextWidth || nextWidth < 40) return;
      const state = container._ptRenderState;
      if (!state || !state.baseModel || state.baseModel.empty) return;
      if (normalizeViewMode(state.viewMode) === "table") return;
      if (Math.abs((state.lastWidth || 0) - nextWidth) < 8) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        state.lastWidth = nextWidth;
        repaintFromState(container);
      }, 100);
    });
    container._ptResizeObserver = observer;
    observer.observe(container);
  }

  function renderInto(container, roadmaps, metricId, helpers, options) {
    if (!container) return null;
    const opts = options && typeof options === "object" ? options : {};
    const grain = normalizeGranularity(
      opts.granularity != null
        ? opts.granularity
        : helpers && helpers.granularity != null
          ? helpers.granularity
          : "quarter"
    );
    const viewMode = normalizeViewMode(opts.viewMode);
    const model = buildSeries(roadmaps, metricId, helpers, grain);
    const width = container.clientWidth > 40 ? container.clientWidth : 720;
    const prev = container._ptRenderState;
    // Keep series filter only when the same metric+granularity still has those keys.
    let seriesFilter = null;
    if (opts.resetSeriesFilter) {
      seriesFilter = null;
    } else if (opts.seriesFilter != null) {
      seriesFilter = normalizeSeriesFilter(model, opts.seriesFilter);
    } else if (
      prev &&
      prev.metricId === metricId &&
      prev.granularity === grain &&
      prev.seriesFilter
    ) {
      seriesFilter = normalizeSeriesFilter(model, prev.seriesFilter);
    }
    container._ptRenderState = {
      baseModel: model,
      model,
      metricId,
      granularity: grain,
      seriesFilter,
      viewMode,
      lastWidth: width
    };
    paintView(container, model, metricId, {
      containerWidth: width,
      granularity: grain,
      seriesFilter,
      legendModel: model,
      viewMode
    });
    bindResizeObserver(container);
    return model;
  }

  return {
    METRICS,
    GRANULARITIES,
    VIEW_MODES,
    UNPOSITIONED_KANO_KEY,
    normalizeGranularity,
    normalizeViewMode,
    periodToBucket,
    buildSeries,
    applySeriesFilter,
    toggleSeriesFilter,
    renderSvg,
    renderTable,
    renderInto,
    formatCompactNumber
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = ProfileOverviewTimeline;
}
