/**
 * Product Management Prioritization Tool - Application constants
 * Central place for storage key, currency list, country list, and ISO country codes.
 * Used by the app for dropdowns, display (e.g. country codes in roadmap list), and persistence.
 *
 * NOTE: This file is loaded as a classic <script>, not as an ES module.
 * All top-level consts become globals that the rest of the app can read.
 */
const STORAGE_KEY = "rice_prioritizer_v1";

/** Bump when shipping client changes so browsers fetch fresh JS (Vercel caches /src with long TTL). */
const APP_ASSET_VERSION = "20260708-ui198";

/**
 * Viewports at or below this width use the unified phone/tablet UI
 * (profile picker, bottom-sheet profiles, card table, FAB, flat layout).
 * Above this width: desktop sidebar + data table.
 */
const COMPACT_LAYOUT_MAX_WIDTH_PX = 1400;

/** Workspace trust profile label token (internal persistence key). */
const WORKSPACE_TRUST_PROFILE_LABEL = "UmlmcWkgVGphaHlvbm8=";

/** Demo profile: read-only (no edits or deletions) when active. */
const DEMO_PROFILE_NAME = "Test";

/** Profile selected on load when present in the workspace. */
const DEFAULT_ACTIVE_PROFILE_NAME = DEMO_PROFILE_NAME;

/** Canonical production deployment (MongoDB + /api). Do not use pm-prioritization-tool.vercel.app (legacy React app). */
const PRODUCTION_APP_ORIGIN = "https://pm-prioritization-tool-six.vercel.app";

/** Hostnames that serve a different app; users should open PRODUCTION_APP_ORIGIN instead. */
const LEGACY_WRONG_HOSTNAMES = ["pm-prioritization-tool.vercel.app"];

const roadmapStatusList = [
  "Not Started",
  "In Progress",
  "On Hold",
  "Done",
  "Cancelled"
];

/**
 * Roadmap status display: icon and tooltip for the table column (same style as roadmap type).
 * Keys must match roadmapStatusList values.
 */
const roadmapStatusIcons = {
  "Not Started": {
    tooltipTitle: "Not Started",
    tooltipBody: "Work has not begun yet.",
    svg: "<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><circle cx='12' cy='12' r='10'/></svg>"
  },
  "In Progress": {
    tooltipTitle: "In Progress",
    tooltipBody: "Actively being\nworked on.",
    svg: "<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><polyline points='23 4 23 10 17 10'/><polyline points='1 20 1 14 7 14'/><path d='M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15'/></svg>"
  },
  "On Hold": {
    tooltipTitle: "On Hold",
    tooltipBody: "Paused or waiting\non dependency.",
    svg: "<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><rect x='6' y='4' width='4' height='16'/><rect x='14' y='4' width='4' height='16'/></svg>"
  },
  "Done": {
    tooltipTitle: "Done",
    tooltipBody: "Completed\nand delivered.",
    svg: "<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M22 11.08V12a10 10 0 1 1-5.93-9.14'/><polyline points='22 4 12 14.01 9 11.01'/></svg>"
  },
  "Cancelled": {
    tooltipTitle: "Cancelled",
    tooltipBody: "Stopped and will not\nbe completed.",
    svg: "<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><circle cx='12' cy='12' r='10'/><line x1='15' y1='9' x2='9' y2='15'/><line x1='9' y1='9' x2='15' y2='15'/></svg>"
  }
};

const tshirtSizeList = ["XS", "S", "M", "L", "XL"];

/**
 * MOSCOW prioritization: Must have, Should have, Could have, Won't have (this time).
 * Used in the MOSCOW view and roadmap metadata.
 */
const moscowList = [
  "Must have",
  "Should have",
  "Could have",
  "Won't have"
];

/** Table view (compact card list): group roadmaps by attribute. */
const TABLE_GROUP_BY_OPTIONS = [
  { id: "none", label: "No grouping" },
  { id: "ownerProfileName", label: "Owner profile" },
  { id: "roadmapStatus", label: "Status" },
  { id: "moscowCategory", label: "MoSCoW" },
  { id: "kanoModel", label: "KANO model" },
  { id: "tshirtSize", label: "T-shirt size" },
  { id: "financialImpactFramework", label: "Financial framework" },
  { id: "roadmapType", label: "Roadmap type" },
  { id: "financialImpactCurrency", label: "Currency" }
];

/**
 * MOSCOW category tooltips for the board view.
 */
const moscowTooltips = {
  "Must have": {
    tooltipTitle: "Must have",
    tooltipBody: "Critical for launch. Non-negotiable requirements.",
    gridDescription: "Essential for the product to work or meet its core goal."
  },
  "Should have": {
    tooltipTitle: "Should have",
    tooltipBody: "Important but not vital. Should be included if possible.",
    gridDescription: "Adds real value but is not required for launch."
  },
  "Could have": {
    tooltipTitle: "Could have",
    tooltipBody: "Desirable. Include when time and resources allow.",
    gridDescription: "Nice-to-have when time and resources allow."
  },
  "Won't have": {
    tooltipTitle: "Won't have",
    tooltipBody: "Out of scope for this release. Deferred to later.",
    gridDescription: "Out of scope for this release; can be added later."
  }
};

/** Grid order: top-left, top-right, bottom-left, bottom-right (2x2) */
const moscowGridOrder = ["Must have", "Should have", "Could have", "Won't have"];

/** MoSCoW quadrant header labels (display). Internal values stay lowercase in `moscowList`. */
const moscowDisplayNames = {
  "Must have": "Must Have",
  "Should have": "Should Have",
  "Could have": "Could Have",
  "Won't have": "Won't Have"
};

/**
 * KANO model axes for the roadmap modal matrix (5 levels each).
 * X-axis: functionality depth; Y-axis: customer satisfaction response.
 */
const kanoFunctionalityLevels = [
  { level: 1, label: "Absent", shortLabel: "Absent", description: "Feature is not implemented." },
  { level: 2, label: "Minimal", shortLabel: "Minimal", description: "Bare-minimum or latent functionality." },
  { level: 3, label: "Basic", shortLabel: "Basic", description: "Expected baseline capability." },
  { level: 4, label: "Enhanced", shortLabel: "Enhanced", description: "Above-average performance." },
  { level: 5, label: "Full", shortLabel: "Full", description: "Best-in-class or complete functionality." }
];

const kanoSatisfactionLevels = [
  { level: 1, label: "Very dissatisfied", shortLabel: "V. low", description: "Strong negative response." },
  { level: 2, label: "Dissatisfied", shortLabel: "Low", description: "Below expectations." },
  { level: 3, label: "Neutral", shortLabel: "Neutral", description: "Neither strong delight nor frustration." },
  { level: 4, label: "Satisfied", shortLabel: "High", description: "Meets or exceeds expectations." },
  { level: 5, label: "Delighted", shortLabel: "V. high", description: "Strong positive emotional response." }
];

/** Legend entries for the roadmap modal KANO matrix. */
const kanoCategoryLegend = [
  {
    id: "attractive",
    label: "Attractive",
    hint: "Delighter",
    compactLabel: "Delight",
    categoryCode: "A",
    hintCode: "D",
    description:
      "High satisfaction relative to functionality — users are delighted even when capability is still limited. Typical of unexpected strengths and delighters.",
    detail:
      "Delighters are features people do not expect but enjoy when they appear. They are usually not required for the product to work, yet they create strong positive feelings and can help differentiate your offer. Use this zone to identify ideas worth promoting when you want to surprise customers and build emotional loyalty."
  },
  {
    id: "one-dimensional",
    label: "One-dimensional",
    hint: "Performance",
    compactLabel: "Perform",
    categoryCode: "O",
    hintCode: "P",
    description:
      "Strong functionality paired with strong satisfaction — performance drivers where more capability tends to increase customer approval.",
    detail:
      "One-dimensional features behave like performance drivers. The more you deliver, the more satisfied users typically become, and falling short is often noticed quickly. Prioritize steady, visible improvement in this zone when customers compare you on quality, speed, or depth of capability."
  },
  {
    id: "must-be",
    label: "Must-be",
    hint: "Baseline",
    compactLabel: "Baseline",
    categoryCode: "M",
    hintCode: "B",
    description:
      "Baseline expectations — customers assume this capability should exist; meeting it prevents frustration more than it creates excitement.",
    detail:
      "Must-be features are table stakes. People expect them, notice immediately when they are missing, and rarely celebrate when they are present. Focus on reliable delivery here to avoid dissatisfaction, reduce support burden, and protect trust before investing in standout enhancements elsewhere."
  },
  {
    id: "reverse",
    label: "Reverse",
    hint: "Simplify",
    compactLabel: "Simplify",
    categoryCode: "R",
    hintCode: "S",
    description:
      "High functionality with low satisfaction — may signal over-engineering, friction, or features that should be simplified or removed.",
    detail:
      "Reverse features can backfire. Adding more capability may confuse, frustrate, or feel redundant, so satisfaction can fall even as functionality grows. Treat this zone as a signal to streamline workflows, remove clutter, or reconsider whether the feature still earns its place in the product."
  },
  {
    id: "indifferent",
    label: "Indifferent",
    hint: "Neutral",
    compactLabel: "Neutral",
    categoryCode: "I",
    hintCode: "N",
    description:
      "Neutral impact — at this functionality level, satisfaction is barely affected, so users may not feel a meaningful difference either way.",
    detail:
      "Indifferent features neither delight nor frustrate most users. They may still support internal or operational needs, but they rarely change how customers feel about the product. Deprioritize extra polish here unless the feature clearly supports a strategic goal, compliance requirement, or dependency for something more important."
  }
];

/**
 * Explicit 5×5 KANO zone map (rows = satisfaction 5→1, cols = functionality 1→5).
 * Attractive = high satisfaction vs functionality (delighters).
 * One-dimensional = high F + high S (performance drivers).
 * Must-be = expected baseline (adequate F, neutral–satisfied S).
 * Reverse = high F + low S (over-built or unwanted complexity).
 * Indifferent = low impact on satisfaction at this functionality level.
 */
const KANO_ZONE_MATRIX = {
  5: ["attractive", "attractive", "attractive", "one-dimensional", "one-dimensional"],
  4: ["attractive", "attractive", "must-be", "one-dimensional", "one-dimensional"],
  3: ["indifferent", "must-be", "must-be", "indifferent", "indifferent"],
  2: ["indifferent", "indifferent", "indifferent", "reverse", "reverse"],
  1: ["indifferent", "indifferent", "reverse", "reverse", "reverse"]
};

function getKanoZoneIdFromPosition(functionality, satisfaction) {
  const f = Number(functionality);
  const s = Number(satisfaction);
  if (!Number.isInteger(f) || !Number.isInteger(s) || f < 1 || f > 5 || s < 1 || s > 5) {
    return null;
  }
  const row = KANO_ZONE_MATRIX[s];
  return row && row[f - 1] ? row[f - 1] : "indifferent";
}

/** Interpretive KANO category from a matrix position (display only; axes are persisted). */
function getKanoCategoryFromPosition(functionality, satisfaction) {
  function getLevelMeta(levels, level) {
    if (!Array.isArray(levels)) return null;
    const n = Number(level);
    return levels.find((row) => row.level === n) || null;
  }

  function buildPositionDescription(entry, f, s) {
    if (!entry) return "";
    const fMeta = getLevelMeta(kanoFunctionalityLevels, f);
    const sMeta = getLevelMeta(kanoSatisfactionLevels, s);
    const fLabel = fMeta ? fMeta.label : `level ${f}`;
    const sLabel = sMeta ? sMeta.label : `level ${s}`;
    return `${entry.description} (${fLabel} · ${sLabel})`;
  }

  const f = Number(functionality);
  const s = Number(satisfaction);
  if (!Number.isInteger(f) || !Number.isInteger(s) || f < 1 || f > 5 || s < 1 || s > 5) {
    return null;
  }
  const id = getKanoZoneIdFromPosition(f, s);
  const entry =
    typeof kanoCategoryLegend !== "undefined"
      ? kanoCategoryLegend.find((row) => row.id === id)
      : null;
  if (!entry) {
    return { id, label: id, description: "" };
  }
  return {
    id: entry.id,
    label: entry.label,
    hint: entry.hint,
    description: buildPositionDescription(entry, f, s)
  };
}

/**
 * Roadmap period tooltip for the table column (same style as roadmap type / MOSCOW).
 * tooltipTitle: column label; tooltipBodyDescription: static description. Interpretation (e.g. "2026-Q1 = Jan–Mar 2026") is appended in app.js when a value is present.
 */
const roadmapPeriodTooltip = {
  tooltipTitle: "Roadmap periods",
  tooltipBodyDescription: "Planning quarters for this roadmap (YYYY-Qn). Each quarter can have its own status. Used for filtering and roadmap views.\n\nQ1 = Jan - Mar\nQ2 = Apr - Jun\nQ3 = Jul - Sep\nQ4 = Oct - Dec"
};

/**
 * T-shirt size tooltips for the table column (same style as roadmap type/status).
 * Duration in sprints aligns with the practical guide for modern product teams
 * (see https://rifqi-tjahyono.com/story-points-demystified-a-practical-guide-for-modern-product-teams/).
 * T-shirt sizing is used for high-level estimation (e.g. discovery, roadmap, epics).
 */
const tshirtSizeTooltips = {
  "XS": {
    tooltipTitle: "XS",
    tooltipBody: "About 1 sprint.\nSmallest size; a single sprint or less. Good for quick wins and small, well-understood items."
  },
  "S": {
    tooltipTitle: "S",
    tooltipBody: "About 1 to 2 sprints.\nSmall; fits in one or two sprints. Suited for focused features or improvements."
  },
  "M": {
    tooltipTitle: "M",
    tooltipBody: "About 3 to 4 sprints.\nMedium; spans roughly a quarter or more of a typical release. Plan for multiple sprints."
  },
  "L": {
    tooltipTitle: "L",
    tooltipBody: "About 4 to 6 sprints.\nLarge; often a major feature or initiative. Consider breaking into smaller deliverables."
  },
  "XL": {
    tooltipTitle: "XL",
    tooltipBody: "About 6 to 8 sprints.\nExtra large; epic or theme scale. Best split into smaller items before committing to delivery."
  }
};

/**
 * Roadmap type display: icon (SVG string) and tooltip for the table column.
 * Keys must match the roadmap type values used in the app.
 * tooltipTitle: short label; tooltipBody: brief, human-friendly description (use \n for line breaks).
 */
const roadmapTypeIcons = {
  "New Product": {
    tooltipTitle: "New Product",
    tooltipBody: "Brand new product or feature for users or the market.",
    svg: "<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M12 2L14.5 8.5L21 9L16 13.5L17.5 21L12 18L6.5 21L8 13.5L3 9L9.5 8.5L12 2Z'/></svg>"
  },
  "Improvement": {
    tooltipTitle: "Improvement",
    tooltipBody: "Makes an existing product, flow, or process better.",
    svg: "<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><polyline points='23 6 13.5 15.5 8.5 10.5 1 18'/><polyline points='17 6 23 6 23 12'/></svg>"
  },
  "Tech Debt": {
    tooltipTitle: "Tech Debt",
    tooltipBody: "Reduces technical debt through refactoring, infrastructure, or platform work.",
    svg: "<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><polyline points='16 18 22 12 16 6'/><polyline points='8 6 2 12 8 18'/></svg>"
  },
  "Market Expansion": {
    tooltipTitle: "Market Expansion",
    tooltipBody: "Reaches new customer segments, markets, or regions.",
    svg: "<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><circle cx='12' cy='12' r='10'/><line x1='2' y1='12' x2='22' y2='12'/><path d='M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z'/></svg>"
  }
};

const currencyList = [
  "USD", "EUR", "GBP", "JPY", "CNY", "AUD", "CAD", "CHF", "HKD", "SGD",
  "NZD", "SEK", "NOK", "DKK", "PLN", "CZK", "HUF", "BGN", "RON", "HRK",
  "RUB", "TRY", "BRL", "MXN", "ARS", "CLP", "COP", "PEN", "ZAR", "INR",
  "IDR", "MYR", "THB", "PHP", "VND", "KRW", "TWD", "ISK",
  "SAR", "AED", "QAR", "KWD", "BHD", "ILS", "EGP", "NGN", "KES", "GHS",
  "BDT", "PKR", "LKR"
];

/** Workspace JSON keys removed from the product; stripped on load, import, and persist. */
const LEGACY_WORKSPACE_FIELDS = ["boardHiddenStatuses"];

/**
 * Top-level workspace UI keys written by serializeStatePayload() and restored on load.
 * Add new persisted state fields here so localStorage and Vercel MongoDB stay in sync.
 * (profiles[] is always serialized separately.)
 */
const WORKSPACE_PERSISTED_STATE_KEYS = [
  "activeProfileId",
  "sortField",
  "sortDirection",
  "roadmapsView",
  "tableSortByRice",
  "tableGroupBy",
  "scrumBoardSortByRice",
  "scrumBoardVisibleStatuses",
  "moscowSortByRice",
  "mapMetric",
  "raciMatrixDomain",
  "kanoPortfolioPanel",
  "ganttZoom",
  "exchangeRatesToEUR",
  "exchangeRatesDate",
  "exchangeRatesLastSource",
  "superAdminMode"
];

/** JSON export format version (add fields freely; importers ignore unknown keys). */
const EXPORT_JSON_VERSION = 1;

/**
 * Profile keys mapped to explicit CSV columns or nested roadmaps[].
 * Any other profile property is written to profileExtraData as JSON.
 */
const EXPORT_CSV_KNOWN_PROFILE_KEYS = [
  "id",
  "name",
  "team",
  "createdAt",
  "roadmaps",
  "projects",
  "boardOrder",
  "moscowOrder",
  "passwordSalt",
  "passwordHash"
];

/**
 * Roadmap keys mapped to explicit CSV columns.
 * Any other roadmap property is written to roadmapExtraData as JSON.
 */
const EXPORT_CSV_KNOWN_ROADMAP_KEYS = [
  "id",
  "title",
  "description",
  "note",
  "createdAt",
  "modifiedAt",
  "reachValue",
  "reachDescription",
  "impactValue",
  "impactDescription",
  "confidenceValue",
  "confidenceDescription",
  "effortValue",
  "effortDescription",
  "financialImpactValue",
  "financialImpactCurrency",
  "financialImpactFramework",
  "financialImpactInputs",
  "roadmapType",
  "roadmapStatus",
  "projectType",
  "projectStatus",
  "tshirtSize",
  "roadmapPeriod",
  "roadmapPeriods",
  "roadmapDeadline",
  "projectPeriod",
  "moscowCategory",
  "kanoFunctionality",
  "kanoSatisfaction",
  "countries",
  "labels",
  "links",
  "tasks",
  "raci",
  "riceScore",
  "ownerProfileId",
  "ownerProfileName"
];

/** ISO currency code → display symbol for profile view and summaries. */
const CURRENCY_SYMBOLS = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CNY: "¥",
  AUD: "A$",
  CAD: "C$",
  CHF: "CHF",
  HKD: "HK$",
  SGD: "S$",
  NZD: "NZ$",
  SEK: "kr",
  NOK: "kr",
  DKK: "kr",
  PLN: "zł",
  CZK: "Kč",
  HUF: "Ft",
  BGN: "лв",
  RON: "lei",
  HRK: "kn",
  RUB: "₽",
  TRY: "₺",
  BRL: "R$",
  MXN: "MX$",
  ARS: "$",
  CLP: "$",
  COP: "$",
  PEN: "S/",
  ZAR: "R",
  INR: "₹",
  IDR: "Rp",
  MYR: "RM",
  THB: "฿",
  PHP: "₱",
  VND: "₫",
  KRW: "₩",
  TWD: "NT$",
  ISK: "kr",
  SAR: "SR",
  AED: "AED",
  QAR: "QR",
  KWD: "KD",
  BHD: "BD",
  ILS: "₪",
  EGP: "E£",
  NGN: "₦",
  KES: "KSh",
  GHS: "GH₵",
  BDT: "৳",
  PKR: "Rs",
  LKR: "Rs",
};

/** Currencies that show the symbol after the amount (e.g. 1.2 Mn kr). */
const CURRENCY_SYMBOL_SUFFIX = ["SEK", "NOK", "DKK", "ISK"];

/** Pseudo-option in target-country selects; expands to all EU member states on selection. */
const COUNTRY_OPTION_EU = "EU";

/** EU member states (27) — names must match entries in countryList exactly. */
const EU_MEMBER_COUNTRIES = [
  "Austria", "Belgium", "Bulgaria", "Croatia", "Cyprus", "Czechia", "Denmark", "Estonia", "Finland",
  "France", "Germany", "Greece", "Hungary", "Ireland", "Italy", "Latvia", "Lithuania", "Luxembourg",
  "Malta", "Netherlands", "Poland", "Portugal", "Romania", "Slovakia", "Slovenia", "Spain", "Sweden"
];

const countryList = [
  "Afghanistan","Albania","Algeria","Andorra","Angola","Antigua and Barbuda","Argentina","Armenia","Australia",
  "Austria","Azerbaijan","Bahamas","Bahrain","Bangladesh","Barbados","Belarus","Belgium","Belize","Benin",
  "Bhutan","Bolivia","Bosnia and Herzegovina","Botswana","Brazil","Brunei","Bulgaria","Burkina Faso","Burundi",
  "Cabo Verde","Cambodia","Cameroon","Canada","Central African Republic","Chad","Chile","China","Colombia",
  "Comoros","Congo (Congo-Brazzaville)","Costa Rica","Croatia","Cuba","Cyprus","Czechia","Democratic Republic of the Congo",
  "Denmark","Djibouti","Dominica","Dominican Republic","Ecuador","Egypt","El Salvador","Equatorial Guinea",
  "Eritrea","Estonia","Eswatini","Ethiopia","Fiji","Finland","France","Gabon","Gambia","Georgia","Germany",
  "Ghana","Greece","Grenada","Guatemala","Guinea","Guinea-Bissau","Guyana","Haiti","Honduras","Hong Kong","Hungary",
  "Iceland","India","Indonesia","Iran","Iraq","Ireland","Israel","Italy","Jamaica","Japan","Jordan","Kazakhstan",
  "Kenya","Kiribati","Kosovo","Kuwait","Kyrgyzstan","Laos","Latvia","Lebanon","Lesotho","Liberia","Libya","Liechtenstein",
  "Lithuania","Luxembourg","Macau","Madagascar","Malawi","Malaysia","Maldives","Mali","Malta","Marshall Islands",
  "Mauritania","Mauritius","Mexico","Micronesia","Moldova","Monaco","Mongolia","Montenegro","Morocco",
  "Mozambique","Myanmar","Namibia","Nauru","Nepal","Netherlands","New Zealand","Nicaragua","Niger","Nigeria",
  "North Korea","North Macedonia","Norway","Oman","Pakistan","Palau","Palestine","Panama","Papua New Guinea","Paraguay",
  "Peru","Philippines","Poland","Portugal","Qatar","Romania","Russia","Rwanda","Saint Kitts and Nevis",
  "Saint Lucia","Saint Vincent and the Grenadines","Samoa","San Marino","Sao Tome and Principe","Saudi Arabia",
  "Senegal","Serbia","Seychelles","Sierra Leone","Singapore","Slovakia","Slovenia","Solomon Islands","Somalia",
  "South Africa","South Korea","South Sudan","Spain","Sri Lanka","Sudan","Suriname","Sweden","Switzerland",
  "Syria","Taiwan","Tajikistan","Tanzania","Thailand","Timor-Leste","Togo","Tonga","Trinidad and Tobago","Tunisia",
  "Turkey","Turkmenistan","Tuvalu","Uganda","Ukraine","United Arab Emirates","United Kingdom","United States",
  "Uruguay","Uzbekistan","Vanuatu","Vatican City","Venezuela","Vietnam","Yemen","Zambia","Zimbabwe"
];

const countryCodeByName = {
  "Afghanistan": "AF",
  "Albania": "AL",
  "Algeria": "DZ",
  "Andorra": "AD",
  "Angola": "AO",
  "Antigua and Barbuda": "AG",
  "Argentina": "AR",
  "Armenia": "AM",
  "Australia": "AU",
  "Austria": "AT",
  "Azerbaijan": "AZ",
  "Bahamas": "BS",
  "Bahrain": "BH",
  "Bangladesh": "BD",
  "Barbados": "BB",
  "Belarus": "BY",
  "Belgium": "BE",
  "Belize": "BZ",
  "Benin": "BJ",
  "Bhutan": "BT",
  "Bolivia": "BO",
  "Bosnia and Herzegovina": "BA",
  "Botswana": "BW",
  "Brazil": "BR",
  "Brunei": "BN",
  "Bulgaria": "BG",
  "Burkina Faso": "BF",
  "Burundi": "BI",
  "Cabo Verde": "CV",
  "Cambodia": "KH",
  "Cameroon": "CM",
  "Canada": "CA",
  "Central African Republic": "CF",
  "Chad": "TD",
  "Chile": "CL",
  "China": "CN",
  "Colombia": "CO",
  "Comoros": "KM",
  "Congo (Congo-Brazzaville)": "CG",
  "Costa Rica": "CR",
  "Croatia": "HR",
  "Cuba": "CU",
  "Cyprus": "CY",
  "Czechia": "CZ",
  "Democratic Republic of the Congo": "CD",
  "Denmark": "DK",
  "Djibouti": "DJ",
  "Dominica": "DM",
  "Dominican Republic": "DO",
  "Ecuador": "EC",
  "Egypt": "EG",
  "El Salvador": "SV",
  "Equatorial Guinea": "GQ",
  "Eritrea": "ER",
  "Estonia": "EE",
  "Eswatini": "SZ",
  "Ethiopia": "ET",
  "Fiji": "FJ",
  "Finland": "FI",
  "France": "FR",
  "Gabon": "GA",
  "Gambia": "GM",
  "Georgia": "GE",
  "Germany": "DE",
  "Ghana": "GH",
  "Greece": "GR",
  "Grenada": "GD",
  "Guatemala": "GT",
  "Guinea": "GN",
  "Guinea-Bissau": "GW",
  "Guyana": "GY",
  "Haiti": "HT",
  "Honduras": "HN",
  "Hong Kong": "HK",
  "Hungary": "HU",
  "Iceland": "IS",
  "India": "IN",
  "Indonesia": "ID",
  "Iran": "IR",
  "Iraq": "IQ",
  "Ireland": "IE",
  "Israel": "IL",
  "Italy": "IT",
  "Jamaica": "JM",
  "Japan": "JP",
  "Jordan": "JO",
  "Kazakhstan": "KZ",
  "Kenya": "KE",
  "Kiribati": "KI",
  "Kosovo": "XK",
  "Kuwait": "KW",
  "Kyrgyzstan": "KG",
  "Laos": "LA",
  "Latvia": "LV",
  "Lebanon": "LB",
  "Lesotho": "LS",
  "Liberia": "LR",
  "Libya": "LY",
  "Liechtenstein": "LI",
  "Lithuania": "LT",
  "Luxembourg": "LU",
  "Macau": "MO",
  "Madagascar": "MG",
  "Malawi": "MW",
  "Malaysia": "MY",
  "Maldives": "MV",
  "Mali": "ML",
  "Malta": "MT",
  "Marshall Islands": "MH",
  "Mauritania": "MR",
  "Mauritius": "MU",
  "Mexico": "MX",
  "Micronesia": "FM",
  "Moldova": "MD",
  "Monaco": "MC",
  "Mongolia": "MN",
  "Montenegro": "ME",
  "Morocco": "MA",
  "Mozambique": "MZ",
  "Myanmar": "MM",
  "Namibia": "NA",
  "Nauru": "NR",
  "Nepal": "NP",
  "Netherlands": "NL",
  "New Zealand": "NZ",
  "Nicaragua": "NI",
  "Niger": "NE",
  "Nigeria": "NG",
  "North Korea": "KP",
  "North Macedonia": "MK",
  "Norway": "NO",
  "Oman": "OM",
  "Pakistan": "PK",
  "Palau": "PW",
  "Palestine": "PS",
  "Panama": "PA",
  "Papua New Guinea": "PG",
  "Paraguay": "PY",
  "Peru": "PE",
  "Philippines": "PH",
  "Poland": "PL",
  "Portugal": "PT",
  "Qatar": "QA",
  "Romania": "RO",
  "Russia": "RU",
  "Rwanda": "RW",
  "Saint Kitts and Nevis": "KN",
  "Saint Lucia": "LC",
  "Saint Vincent and the Grenadines": "VC",
  "Samoa": "WS",
  "San Marino": "SM",
  "Sao Tome and Principe": "ST",
  "Saudi Arabia": "SA",
  "Senegal": "SN",
  "Serbia": "RS",
  "Seychelles": "SC",
  "Sierra Leone": "SL",
  "Singapore": "SG",
  "Slovakia": "SK",
  "Slovenia": "SI",
  "Solomon Islands": "SB",
  "Somalia": "SO",
  "South Africa": "ZA",
  "South Korea": "KR",
  "South Sudan": "SS",
  "Spain": "ES",
  "Sri Lanka": "LK",
  "Sudan": "SD",
  "Suriname": "SR",
  "Sweden": "SE",
  "Switzerland": "CH",
  "Syria": "SY",
  "Taiwan": "TW",
  "Tajikistan": "TJ",
  "Tanzania": "TZ",
  "Thailand": "TH",
  "Timor-Leste": "TL",
  "Togo": "TG",
  "Tonga": "TO",
  "Trinidad and Tobago": "TT",
  "Tunisia": "TN",
  "Turkey": "TR",
  "Turkmenistan": "TM",
  "Tuvalu": "TV",
  "Uganda": "UG",
  "Ukraine": "UA",
  "United Arab Emirates": "AE",
  "United Kingdom": "GB",
  "United States": "US",
  "Uruguay": "UY",
  "Uzbekistan": "UZ",
  "Vanuatu": "VU",
  "Vatican City": "VA",
  "Venezuela": "VE",
  "Vietnam": "VN",
  "Yemen": "YE",
  "Zambia": "ZM",
  "Zimbabwe": "ZW"
};

/**
 * Alternate names (e.g. from GeoJSON, imports) mapped to canonical countryList name.
 * Ensures one consistent label and code (e.g. Taiwan) everywhere.
 */
const countryNameAliases = {
  "European Union": COUNTRY_OPTION_EU,
  "EU (European Union)": COUNTRY_OPTION_EU,
  "Chinese Taipei": "Taiwan",
  "Taiwan, Province of China": "Taiwan",
  "Taiwan, China": "Taiwan",
  "Republic of China (Taiwan)": "Taiwan",
  "United Republic of Tanzania": "Tanzania",
  "Czech Republic": "Czechia",
  "Republic of Korea": "South Korea",
  "Democratic People's Republic of Korea": "North Korea",
  "Iran, Islamic Republic of": "Iran",
  "Lao People's Democratic Republic": "Laos",
  "Republic of Moldova": "Moldova",
  "Russian Federation": "Russia",
  "Syrian Arab Republic": "Syria",
  "United States of America": "United States",
  "Viet Nam": "Vietnam",
  "Venezuela, Bolivarian Republic of": "Venezuela",
  "Bolivia, Plurinational State of": "Bolivia",
  "Brunei Darussalam": "Brunei"
};
