/**
 * Roadmap quarter periods (YYYY-Q1..Q4) with per-period status.
 */
const RoadmapPeriods = (function () {
  const START_YEAR = 2020;
  const FUTURE_YEARS = 20;
  const PERIOD_PATTERN = /^(\d{4})-Q([1-4])$/;

  function getEndYear() {
    return new Date().getFullYear() + FUTURE_YEARS;
  }

  function getCurrentQuarter(date) {
    const d = date instanceof Date ? date : new Date();
    return Math.floor(d.getMonth() / 3) + 1;
  }

  function getCurrentPeriod(date) {
    const d = date instanceof Date ? date : new Date();
    const year = d.getFullYear();
    const quarter = getCurrentQuarter(d);
    const period = `${year}-Q${quarter}`;
    return normalizeKey(period) || `${START_YEAR}-Q1`;
  }

  function buildDefaultPeriodEntry(statusOptions) {
    return {
      period: getCurrentPeriod(),
      status: normalizeStatus("Not Started", statusOptions)
    };
  }

  function buildOptions() {
    const options = [];
    const endYear = getEndYear();
    for (let year = START_YEAR; year <= endYear; year += 1) {
      for (let quarter = 1; quarter <= 4; quarter += 1) {
        options.push(`${year}-Q${quarter}`);
      }
    }
    return options;
  }

  function normalizeKey(raw) {
    const value = String(raw || "").trim().toUpperCase().replace(/\s+/g, "");
    if (!value) return null;
    const match = value.match(PERIOD_PATTERN);
    if (!match) return null;
    return `${match[1]}-Q${match[2]}`;
  }

  function normalizeStatus(status, statusOptions) {
    const value = String(status || "").trim();
    const options = Array.isArray(statusOptions) && statusOptions.length ? statusOptions : ["Not Started"];
    return options.includes(value) ? value : options[0];
  }

  function normalizePeriods(raw, { legacyPeriod = null, legacyStatus = null, statusOptions = null } = {}) {
    const out = [];
    const seen = new Set();

    const pushEntry = (periodRaw, statusRaw) => {
      const period = normalizeKey(periodRaw);
      if (!period || seen.has(period)) return;
      seen.add(period);
      out.push({
        period,
        status: normalizeStatus(statusRaw, statusOptions)
      });
    };

    if (Array.isArray(raw)) {
      raw.forEach((entry) => {
        if (!entry || typeof entry !== "object") return;
        pushEntry(entry.period != null ? entry.period : entry.quarter, entry.status);
      });
    } else if (typeof raw === "string" && raw.trim()) {
      raw
        .split(/[,|;]+/)
        .map((part) => part.trim())
        .filter(Boolean)
        .forEach((token) => pushEntry(token, legacyStatus));
    }

    if (!out.length && legacyPeriod) {
      pushEntry(legacyPeriod, legacyStatus);
    }

    out.sort((a, b) => {
      const [ay, aq] = a.period.split("-Q").map(Number);
      const [by, bq] = b.period.split("-Q").map(Number);
      if (ay !== by) return ay - by;
      return aq - bq;
    });

    return out;
  }

  function deriveLegacyPeriod(periods) {
    const latest = getLatestPeriodEntry(periods);
    return latest ? latest.period : null;
  }

  function getLatestPeriodEntry(periods) {
    const list = Array.isArray(periods) ? periods.filter((entry) => entry && normalizeKey(entry.period)) : [];
    if (!list.length) return null;
    const sorted = list
      .map((entry) => ({
        period: normalizeKey(entry.period),
        status: entry.status
      }))
      .sort((a, b) => {
        const [ay, aq] = a.period.split("-Q").map(Number);
        const [by, bq] = b.period.split("-Q").map(Number);
        if (ay !== by) return ay - by;
        return aq - bq;
      });
    return sorted[sorted.length - 1];
  }

  /** When quarters exist, roadmap status follows the chronologically latest quarter. */
  function deriveRoadmapStatus(periods, { fallbackStatus = null, statusOptions = null } = {}) {
    const latest = getLatestPeriodEntry(periods);
    if (latest) return normalizeStatus(latest.status, statusOptions);
    const fallback = String(fallbackStatus || "").trim();
    return fallback ? normalizeStatus(fallback, statusOptions) : null;
  }

  function formatDisplay(periods) {
    const list = Array.isArray(periods) ? periods : [];
    return list.map((entry) => entry.period).join(", ");
  }

  function validatePeriods(periods) {
    const list = Array.isArray(periods) ? periods : [];
    for (const entry of list) {
      if (!entry || !normalizeKey(entry.period)) {
        return "Each roadmap period must use the format YYYY-QX (e.g. 2026-Q1).";
      }
    }
    return "";
  }

  function validateUniquePeriods(periods) {
    const list = Array.isArray(periods) ? periods : [];
    const seen = new Set();
    for (const entry of list) {
      const period = normalizeKey(entry && entry.period != null ? entry.period : entry);
      if (!period) continue;
      if (seen.has(period)) {
        return `Each quarter can only appear once. Remove the duplicate ${period} entry.`;
      }
      seen.add(period);
    }
    return "";
  }

  function coercePeriodsField(value) {
    if (Array.isArray(value)) return value.length ? value : null;
    if (typeof value !== "string" || !value.trim()) return null;
    const trimmed = value.trim();
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed;
      } catch (_) {
        return null;
      }
    }
    if (/[,|;]/.test(trimmed)) return trimmed;
    const compact = trimmed.toUpperCase().replace(/\s+/g, "");
    if (PERIOD_PATTERN.test(compact)) return compact;
    return null;
  }

  function parseImportPeriods(raw, { legacyPeriod = null, legacyStatus = null, statusOptions = null } = {}) {
    const coerced = coercePeriodsField(raw);
    if (coerced) return normalizePeriods(coerced, { legacyStatus, statusOptions });
    return normalizePeriods(null, { legacyPeriod, legacyStatus, statusOptions });
  }

  function serializeExportPeriods(periods, { statusOptions = null } = {}) {
    return JSON.stringify(normalizePeriods(periods, { statusOptions }));
  }

  return {
    getCurrentPeriod,
    buildDefaultPeriodEntry,
    buildOptions,
    normalizePeriods,
    coercePeriodsField,
    parseImportPeriods,
    serializeExportPeriods,
    deriveLegacyPeriod,
    getLatestPeriodEntry,
    deriveRoadmapStatus,
    validatePeriods,
    validateUniquePeriods
  };
})();
