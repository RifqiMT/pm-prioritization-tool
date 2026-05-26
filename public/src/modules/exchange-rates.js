/**
 * Exchange rates module — ETL from multiple APIs, merge for maximum currency coverage, daily refresh at 00:00 Germany time.
 * Depends on: getState(), saveState(), getElements(), onRatesUpdated() — provided via init().
 * Uses globals: none (all via init). Safe to load after constants.js, utils.js.
 *
 * Sources (all free, no API key required):
 * 1. Frankfurter (api.frankfurter.dev) — ECB data, EUR base, ~31 currencies, daily.
 * 2. MoneyConvert (cdn.moneyconvert.net) — 180+ currencies, USD base, updated every 5 min.
 * 3. Fallback: static rates for currencies that may be missing when APIs fail or are blocked (e.g. CORS).
 * Merged result: Frankfurter first, then MoneyConvert, then fallback so every listed currency has a rate.
 */
(function (global) {
  const FRANKFURTER_URL = "https://api.frankfurter.dev/v1/latest";
  const MONEYCONVERT_URL = "https://cdn.moneyconvert.net/api/latest.json";
  const TIMEZONE = "Europe/Berlin";

  /** Fallback: 1 unit of currency = X EUR. Used only when no API provides the rate (e.g. TWD when MoneyConvert is blocked by CORS). Approximate; refresh from APIs when possible. */
  const FALLBACK_RATES_TO_EUR = {
    TWD: 0.0285,
    AED: 0.2532,
    SAR: 0.2516,
    QAR: 0.2532,
    KWD: 0.2932,
    BHD: 2.506,
    EGP: 0.0198,
    NGN: 0.00058,
    KES: 0.00605,
    GHS: 0.0595,
    BDT: 0.00795,
    PKR: 0.00318,
    LKR: 0.00282,
    UAH: 0.0225,
    UYU: 0.0212,
    PYG: 0.00012,
    BOB: 0.12,
    CRC: 0.0017,
    DOP: 0.0145,
    GTQ: 0.11,
    HNL: 0.034,
    NIO: 0.023,
    PAB: 0.846,
    PEN: 0.22,
    UZS: 0.000062,
    KZT: 0.0015,
    GEL: 0.29,
    AMD: 0.0021,
    AZN: 0.49,
    BYN: 0.26,
    MDL: 0.045,
    TMT: 0.24,
    TJS: 0.084,
    KGS: 0.0095,
    NPR: 0.00635,
    BWP: 0.061,
    MUR: 0.018,
    NAD: 0.053,
    ZMW: 0.045,
    TND: 0.26,
    MAD: 0.095,
    XOF: 0.00138,
    XAF: 0.00152,
    RWF: 0.00066,
    UGX: 0.00022,
    TZS: 0.00033,
    ETB: 0.014,
    GNF: 0.000095
  };

  let getState;
  let saveState;
  let getElements;
  let onRatesUpdated;
  let dailyTimeoutId = null;

  function getTodayGermanyDateString() {
    return new Date().toLocaleDateString("en-CA", { timeZone: TIMEZONE });
  }

  function getNextMidnightGermanyMs() {
    const now = Date.now();
    const todayStr = getTodayGermanyDateString();
    const [y, m, d] = todayStr.split("-").map(Number);
    const utc22 = new Date(Date.UTC(y, m - 1, d, 22, 0, 0)).getTime();
    const utc23 = new Date(Date.UTC(y, m - 1, d, 23, 0, 0)).getTime();
    const fmt = (ms) => {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        hour12: false,
        minute: "2-digit"
      }).formatToParts(new Date(ms));
      const get = (type) => (parts.find((p) => p.type === type) || {}).value;
      return { day: Number(get("day")), hour: Number(get("hour")) };
    };
    const nextDay = d + 1;
    const midnightBerlin = fmt(utc22).day === nextDay && fmt(utc22).hour === 0 ? utc22 : utc23;
    let next = midnightBerlin;
    if (next <= now) next += 24 * 60 * 60 * 1000;
    return next - now;
  }

  /** Frankfurter: base EUR, rates = amount in currency per 1 EUR. */
  function fetchFrankfurter() {
    return fetch(FRANKFURTER_URL).then((res) => {
      if (!res.ok) throw new Error("Frankfurter unavailable");
      return res.json();
    });
  }

  /** MoneyConvert: base USD, rates = amount in currency per 1 USD. */
  function fetchMoneyConvert() {
    return fetch(MONEYCONVERT_URL).then((res) => {
      if (!res.ok) throw new Error("MoneyConvert unavailable");
      return res.json();
    });
  }

  /** Build toEUR map from Frankfurter response (base EUR). */
  function transformFrankfurter(data) {
    const rates = data.rates || {};
    const seen = Object.create(null);
    const toEUR = { EUR: 1 };
    Object.keys(rates).forEach((c) => {
      const key = (c || "").toString().trim().toUpperCase();
      if (!key || key === "EUR") return;
      const fromEurToC = rates[c];
      if (!Number.isFinite(fromEurToC) || fromEurToC <= 0) return;
      const rateToEur = 1 / fromEurToC;
      if (!Number.isFinite(rateToEur)) return;
      if (seen[key] !== undefined) return;
      seen[key] = true;
      toEUR[key] = rateToEur;
    });
    return toEUR;
  }

  /** Build toEUR map from MoneyConvert response (base USD). rate_EUR = EUR per 1 USD; rate_X = X per 1 USD. So 1 X = (1/rate_X) USD = (1/rate_X)*rate_EUR EUR. */
  function transformMoneyConvert(data) {
    const rates = data.rates || {};
    const eurPerUsd = rates.EUR != null && Number.isFinite(rates.EUR) && rates.EUR > 0 ? rates.EUR : null;
    if (!eurPerUsd) return {};
    const toEUR = {};
    Object.keys(rates).forEach((c) => {
      const key = (c || "").toString().trim().toUpperCase();
      if (!key) return;
      const fromUsdToC = rates[c];
      if (!Number.isFinite(fromUsdToC) || fromUsdToC <= 0) return;
      if (key === "USD") {
        toEUR.USD = eurPerUsd;
        return;
      }
      if (key === "EUR") {
        toEUR.EUR = 1;
        return;
      }
      toEUR[key] = eurPerUsd / fromUsdToC;
    });
    return toEUR;
  }

  /** Merge toEUR maps: primary first, then fill missing from secondary, then from fallback. */
  function mergeToEUR(primary, secondary) {
    const merged = Object.assign({}, primary);
    if (secondary && typeof secondary === "object") {
      Object.keys(secondary).forEach((key) => {
        const k = key.toUpperCase();
        if (k && (merged[k] == null || !Number.isFinite(merged[k])) && Number.isFinite(secondary[key])) {
          merged[k] = secondary[key];
        }
      });
    }
    Object.keys(FALLBACK_RATES_TO_EUR).forEach((code) => {
      const k = code.toUpperCase();
      if (k && (merged[k] == null || !Number.isFinite(merged[k]))) {
        const rate = FALLBACK_RATES_TO_EUR[code];
        if (Number.isFinite(rate) && rate > 0) merged[k] = rate;
      }
    });
    merged.EUR = 1;
    return merged;
  }

  function loadIntoState(transformed, source) {
    const state = getState();
    state.exchangeRatesToEUR = transformed;
    state.exchangeRatesDate = getTodayGermanyDateString();
    if (source) state.exchangeRatesLastSource = source;
    saveState();
    updateLabel();
  }

  function updateLabel() {
    const el = getElements().exchangeRatesDateLabel;
    if (!el) return;
    const state = getState();
    const dateStr = state.exchangeRatesDate;
    if (!dateStr) {
      el.textContent = "";
      return;
    }
    const d = new Date(dateStr + "T12:00:00Z");
    const formatted = Number.isNaN(d.getTime()) ? dateStr : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
    const source = state.exchangeRatesLastSource;
    const sourceLabel = source === "manual" ? " (manual refresh)" : source === "auto" ? " (auto)" : "";
    el.textContent = `Last updated: ${formatted}${sourceLabel}`;
  }

  /**
   * Fetch from all sources and merge. Frankfurter is primary (EUR base); MoneyConvert fills missing currencies.
   */
  function fetchRates(source) {
    const primaryPromise = fetchFrankfurter()
      .then(transformFrankfurter)
      .catch(() => ({}));

    const secondaryPromise = fetchMoneyConvert()
      .then(transformMoneyConvert)
      .catch(() => ({}));

    return Promise.all([primaryPromise, secondaryPromise]).then(([frankfurterToEUR, moneyConvertToEUR]) => {
      const merged = mergeToEUR(frankfurterToEUR, moneyConvertToEUR);
      if (Object.keys(merged).length <= 1) {
        const state = getState();
        if (Object.keys(state.exchangeRatesToEUR || {}).length === 0) {
          merged.EUR = 1;
        }
      }
      loadIntoState(merged, source);
      return merged;
    });
  }

  function scheduleDailyRefresh() {
    if (dailyTimeoutId != null) {
      clearTimeout(dailyTimeoutId);
      dailyTimeoutId = null;
    }
    const ms = getNextMidnightGermanyMs();
    dailyTimeoutId = setTimeout(() => {
      dailyTimeoutId = null;
      fetchRates("auto")
        .then(() => { if (typeof onRatesUpdated === "function") onRatesUpdated(); })
        .catch(() => {})
        .finally(scheduleDailyRefresh);
    }, ms);
  }

  function ensure() {
    const state = getState();
    const today = getTodayGermanyDateString();
    if (state.exchangeRatesDate === today && Object.keys(state.exchangeRatesToEUR || {}).length > 0) {
      return Promise.resolve(state.exchangeRatesToEUR);
    }
    return fetchRates("auto").catch((err) => {
      const s = getState();
      if (Object.keys(s.exchangeRatesToEUR || {}).length === 0) {
        const fallback = { EUR: 1 };
        Object.keys(FALLBACK_RATES_TO_EUR).forEach((code) => {
          const rate = FALLBACK_RATES_TO_EUR[code];
          if (Number.isFinite(rate) && rate > 0) fallback[code.toUpperCase()] = rate;
        });
        s.exchangeRatesToEUR = fallback;
        s.exchangeRatesDate = getTodayGermanyDateString();
        saveState();
        updateLabel();
        if (typeof onRatesUpdated === "function") onRatesUpdated();
      }
      throw err;
    });
  }

  function refreshManual() {
    const btn = getElements().refreshExchangeRatesBtn;
    if (btn) btn.disabled = true;
    return fetchRates("manual")
      .then(() => { if (typeof onRatesUpdated === "function") onRatesUpdated(); })
      .finally(() => { if (btn) btn.disabled = false; });
  }

  function convertToEUR(amount, currencyCode) {
    if (!Number.isFinite(amount)) return NaN;
    const code = (currencyCode || "EUR").toString().trim().toUpperCase();
    if (!code) return NaN;
    if (code === "EUR") return amount;
    const state = getState();
    const rate = (state.exchangeRatesToEUR || {})[code];
    if (rate != null && Number.isFinite(rate)) return amount * rate;
    return NaN;
  }

  function hasRate(currencyCode) {
    const code = (currencyCode || "").toString().trim().toUpperCase();
    if (!code || code === "EUR") return true;
    const state = getState();
    const rate = (state.exchangeRatesToEUR || {})[code];
    return rate != null && Number.isFinite(rate);
  }

  global.ExchangeRates = {
    init(deps) {
      getState = deps.getState;
      saveState = deps.saveState;
      getElements = deps.getElements;
      onRatesUpdated = deps.onRatesUpdated;
    },
    ensure,
    refreshManual,
    scheduleDailyRefresh,
    updateLabel,
    convertToEUR,
    hasRate,
    getTodayGermanyDateString
  };
})(typeof window !== "undefined" ? window : this);
