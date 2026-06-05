/**
 * Product Management Prioritization Tool - Main application module
 * Handles state, DOM cache, initialization, rendering, modals, import/export, and event handlers.
 *
 * IMPORTANT: This file now runs as a classic <script> (no ES modules).
 * It relies on globals defined in:
 *  - src/constants.js  (STORAGE_KEY, currencyList, countryList, countryCodeByName, countryNameAliases, ...)
 *  - src/rice.js       (calculateRiceScore, formatRice, validateRoadmapInput)
 *  - src/utils.js      (formatDateTime, formatDateForFilename, compareDatesDesc, generateId, escapeHtml, countryCodeToFlag, toNumberOrNull, parseCsv, escapeCsvCell)
 *  - src/modules/profile-security.js (ProfileSecurity: password hash/verify for profile lock)
 *
 * That means you can simply open index.html in a browser (no dev server required)
 * and everything, including export/import, will work.
 */

// --- State & DOM cache ---
let state = {
  profiles: [],
  activeProfileId: null,
  sortField: "createdAt",
  sortDirection: "desc",
  roadmapsView: "table",
  tableSortByRice: true,
  /** Compact table cards: group by attribute (see TABLE_GROUP_BY_OPTIONS). */
  tableGroupBy: "none",
  scrumBoardSortByRice: true,
  /** Roadmap status values shown as Scrum board columns (subset of roadmapStatusList). */
  scrumBoardVisibleStatuses: null,
  moscowSortByRice: true,
  mapMetric: "roadmaps",
  raciMatrixDomain: "Business",
  /** Portfolio KANO view: matrix (`positioned`) vs unplaced roadmap cards (`unpositioned`). */
  kanoPortfolioPanel: "positioned",
  exchangeRatesToEUR: {},
  exchangeRatesDate: null,
  exchangeRatesLastSource: null,
  /** When true and active profile is super-admin capable, portfolio shows all profiles' roadmaps. */
  superAdminMode: false
};

let editingRoadmapId = null;
let roadmapModalMode = "create";

/** Profile IDs unlocked for this browser tab session (sessionStorage, not localStorage). */
const unlockedProfileIds = new Set();

const UNLOCK_SESSION_STORAGE_KEY = "pmTool_unlockedProfileIds_v1";

/** Set when unlock is required before view/edit/activate. */
let pendingUnlockAction = null;

/** Pending export format after password verification (`json` | `csv`). */
let pendingExportFormat = null;

/** Filters profile list in the profiles panel (name / team). */
let profilesFilterQuery = "";
let profilePickerOpen = false;
let profilePickerHighlightIndex = -1;
let profilePickerIsSearching = false;
let profilePickerSuppressFocusOpen = false;
let profilePickerPointerSelecting = false;

const MAP_METRIC_OPTIONS = [
  {
    id: "roadmaps",
    label: "Roadmap count",
    short: "Count",
    description: "Number of roadmaps per country",
    keywords: ["count", "roadmaps", "number", "volume", "quantity"]
  },
  {
    id: "rice",
    label: "RICE score",
    short: "RICE",
    description: "Total RICE score by country",
    keywords: ["rice", "score", "priority", "reach", "impact", "confidence", "effort", "sum", "total"]
  },
  {
    id: "riceAvg",
    label: "Average RICE score",
    short: "Avg RICE",
    description: "Mean RICE score per roadmap in each country",
    keywords: ["rice", "average", "avg", "mean", "score", "priority"]
  },
  {
    id: "financial",
    label: "Financial impact (EUR)",
    short: "EUR",
    description: "Total financial impact in EUR by country",
    keywords: ["financial", "eur", "money", "impact", "revenue", "cost", "euro", "sum", "total"]
  },
  {
    id: "financialAvg",
    label: "Average financial impact (EUR)",
    short: "Avg EUR",
    description: "Mean financial impact in EUR per roadmap in each country",
    keywords: ["financial", "eur", "average", "avg", "mean", "money", "impact", "euro"]
  }
];

let mapMetricPickerOpen = false;
let mapMetricPickerHighlightIndex = -1;
let mapMetricPickerPointerSelecting = false;

let profilesSheetTab = "browse";
let profilesSheetCloseTimer = null;

function markProfileUnlocked(profileId) {
  if (!profileId) return;
  unlockedProfileIds.add(profileId);
  persistUnlockedProfilesToSession();
}

function markProfileLocked(profileId) {
  if (!profileId) return;
  unlockedProfileIds.delete(profileId);
  persistUnlockedProfilesToSession();
}

function persistUnlockedProfilesToSession() {
  try {
    sessionStorage.setItem(
      UNLOCK_SESSION_STORAGE_KEY,
      JSON.stringify(Array.from(unlockedProfileIds))
    );
  } catch (err) {
    console.warn("Could not persist unlocked profiles to session", err);
  }
}

/** Clears in-memory unlock state (every page load requires password again). */
function resetProfileUnlockSession() {
  unlockedProfileIds.clear();
  try {
    sessionStorage.removeItem(UNLOCK_SESSION_STORAGE_KEY);
  } catch (err) {
    /* ignore */
  }
}

const $ = (id) => document.getElementById(id);

const elements = {};

/** Returns the canonical country name used in countryList/countryCodeByName. Resolves aliases (e.g. Chinese Taipei → Taiwan). */
function getCanonicalCountryName(name) {
  if (!name || typeof name !== "string") return "";
  const t = name.trim();
  if (!t) return "";
  if (typeof COUNTRY_OPTION_EU !== "undefined" && t.toUpperCase() === COUNTRY_OPTION_EU) return COUNTRY_OPTION_EU;
  if (typeof countryList !== "undefined" && countryList.includes(t)) return t;
  if (typeof countryNameAliases !== "undefined" && countryNameAliases[t]) return countryNameAliases[t];
  return t;
}

function isEuRegionOption(name) {
  return typeof COUNTRY_OPTION_EU !== "undefined" && name === COUNTRY_OPTION_EU;
}

/** Expands EU pseudo-option into all EU member countries; dedupes and keeps only countryList entries. */
function expandEuRegionInCountryNames(names) {
  const result = [];
  const seen = new Set();
  (names || []).forEach((raw) => {
    const name = typeof raw === "string" ? raw.trim() : "";
    if (!name) return;
    if (isEuRegionOption(name)) {
      if (typeof EU_MEMBER_COUNTRIES !== "undefined") {
        EU_MEMBER_COUNTRIES.forEach((member) => {
          if (!seen.has(member)) {
            seen.add(member);
            result.push(member);
          }
        });
      }
      return;
    }
    if (typeof countryList !== "undefined" && countryList.includes(name) && !seen.has(name)) {
      seen.add(name);
      result.push(name);
    }
  });
  return result;
}

/** Returns canonical names only; expands EU to all member states; drops invalid entries. */
function normalizeCountryNames(names) {
  if (!Array.isArray(names)) return [];
  const resolved = names
    .map((c) => getCanonicalCountryName(String(c).trim()))
    .filter((c) => c);
  return expandEuRegionInCountryNames(resolved);
}

/** Returns a trimmed currency string or null; use for consistent storage and comparison. */
function normalizeCurrency(val) {
  if (val == null || val === "") return null;
  const s = String(val).trim();
  return s === "" ? null : s;
}

const FINANCIAL_FRAMEWORK_DEFAULT = "custom";
const FINANCIAL_FRAMEWORKS = ["custom", "clv", "headcount", "operational", "nps", "risk"];
const FINANCIAL_FRAMEWORK_ICONS = {
  custom: {
    label: "Custom",
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M4 20h4l10-10-4-4L4 16v4z"/><path stroke-linecap="round" stroke-linejoin="round" d="M13 7l4 4"/></svg>',
    tooltipTitle: "Custom (direct amount)",
    tooltipBody: "Manual financial impact entered directly by the user."
  },
  clv: {
    label: "CLV",
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5 19V9m7 10V5m7 14v-8"/><path stroke-linecap="round" stroke-linejoin="round" d="M3 19h18"/></svg>',
    tooltipTitle: "CLV framework",
    tooltipBody: "Estimates impact from customer lifetime value uplift."
  },
  nps: {
    label: "NPS",
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path stroke-linecap="round" stroke-linejoin="round" d="M9 10h.01M15 10h.01M9 14c.8 1 1.8 1.5 3 1.5s2.2-.5 3-1.5"/></svg>',
    tooltipTitle: "NPS to financial impact",
    tooltipBody: "Converts NPS movement into retained, expansion, and referral value."
  },
  risk: {
    label: "Risk",
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3l7 3v6c0 4.2-2.5 6.9-7 9-4.5-2.1-7-4.8-7-9V6l7-3z"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v5m0 3h.01"/></svg>',
    tooltipTitle: "Risk mitigation",
    tooltipBody: "Estimates avoided expected loss after mitigation."
  },
  headcount: {
    label: "Headcount",
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M8 10a3 3 0 100-6 3 3 0 000 6zm8 1a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"/><path stroke-linecap="round" stroke-linejoin="round" d="M3 19a5 5 0 0110 0m2 0a4 4 0 018 0"/></svg>',
    tooltipTitle: "Headcount savings",
    tooltipBody: "Converts saved capacity into avoided FTE and financial impact."
  },
  operational: {
    label: "Operational",
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6"/></svg>',
    tooltipTitle: "Operational efficiency",
    tooltipBody: "Estimates savings from lower unit cost and faster cycle time."
  }
};

const ROADMAP_FORM_FIELD_TOOLTIPS = {
  financialCustomNotes: {
    title: "Custom notes",
    body: "Optional notes that explain assumptions, source data, or rationale used for manual financial impact."
  },
  financialClvCustomers: {
    title: "Customers (portfolio size)",
    body: "Number of customers in scope for CLV calculations. Leave blank to treat inputs as per-customer."
  },
  financialClvMargin: {
    title: "Contribution margin per customer",
    body: "Contribution margin per customer used to estimate CLV-based impact."
  },
  financialClvRetentionRatePct: {
    title: "New retention rate (%)",
    body: "Expected retention rate after the initiative. Used in CLV uplift computation."
  },
  financialClvDiscountRatePct: {
    title: "Discount rate (%)",
    body: "Discount rate used to convert future value into present value in CLV calculations."
  },
  financialClvAcquisitionCost: {
    title: "CAC per customer (optional)",
    body: "Customer acquisition cost per customer. If empty, the model defaults this to 0."
  },
  financialClvBaselineRetentionRatePct: {
    title: "Baseline retention (%) or uplift points",
    body: "Baseline retention before change, or direct uplift points to compare against the new retention rate."
  },
  financialNpsReportedImpactBasis: {
    title: "Reported financial impact basis",
    body: "Controls which NPS outcome is written to the main Financial impact result field."
  },
  financialNpsTotalCustomers: {
    title: "Total customers",
    body: "Optional reference count for the full customer base used in NPS scenario framing."
  },
  financialNpsCustomersMoved: {
    title: "Customers moved to promoter",
    body: "Count of customers expected to move into promoter behavior due to the initiative."
  },
  financialNpsArpa: {
    title: "ARPA per year",
    body: "Annual revenue per account used to estimate retained and expansion revenue."
  },
  financialNpsRetentionPromoterPct: {
    title: "Retention (promoter, %)",
    body: "Annual retention rate for promoter customers in the NPS model."
  },
  financialNpsRetentionSourcePct: {
    title: "Retention (source segment, %)",
    body: "Annual retention of the source segment customers are moving from (for example, detractors or passives)."
  },
  financialNpsContributionMarginPct: {
    title: "Contribution margin (%)",
    body: "Contribution margin applied to NPS-driven retained, expansion, and referral revenue."
  },
  financialNpsUpsellPerConverted: {
    title: "Upsell per converted customer",
    body: "Optional incremental upsell revenue per moved customer (defaults to 0 when empty)."
  },
  financialNpsReferralPerConverted: {
    title: "Referral revenue per converted customer",
    body: "Optional incremental referral revenue per moved customer before margin."
  },
  financialNpsProgramCost: {
    title: "Program cost",
    body: "Total annual cost of the NPS initiative, subtracted to compute net impact."
  },
  financialRiskProbabilityBeforePct: {
    title: "Probability before mitigation (%)",
    body: "Estimated probability of the risk event before applying mitigation."
  },
  financialRiskProbabilityAfterPct: {
    title: "Probability after mitigation (%)",
    body: "Estimated probability of the same risk event after mitigation."
  },
  financialRiskLossPerExposure: {
    title: "Loss per exposed unit",
    body: "Expected loss value for one exposed unit when the risk materializes."
  },
  financialRiskExposureUnits: {
    title: "Exposure units per period",
    body: "Number of exposure units in each period for expected-loss estimation."
  },
  financialRiskPeriodsPerYear: {
    title: "Periods per year",
    body: "How many periods are included in one year (for example, 12 for monthly)."
  },
  financialRiskMitigationCost: {
    title: "Mitigation cost per year",
    body: "Optional annual mitigation spend used to compute net mitigation value."
  },
  financialHeadcountMinutesSavedPerFtePerDay: {
    title: "Minutes saved per FTE per day",
    body: "Average daily minutes saved for each FTE in scope."
  },
  financialHeadcountWorkingDaysPerYear: {
    title: "Working days per year",
    body: "Working days per year used to annualize time savings."
  },
  financialHeadcountFteCount: {
    title: "FTE count in scope",
    body: "Number of FTEs affected by the efficiency improvement."
  },
  financialHeadcountHoursPerDay: {
    title: "Hours per day",
    body: "Standard productive hours per workday used in avoided FTE conversion."
  },
  financialHeadcountUtilizationGainPct: {
    title: "Utilization gain (%)",
    body: "Optional override for utilization gain percentage; if empty, derived from minutes saved."
  },
  financialHeadcountAnnualCostPerFte: {
    title: "Annual fully loaded cost per FTE",
    body: "Annual fully loaded cost (salary plus overhead) per FTE."
  },
  financialOperationalCostPerUnitBefore: {
    title: "Cost per unit (before)",
    body: "Current cost per unit before the efficiency improvement."
  },
  financialOperationalCostPerUnitAfter: {
    title: "Cost per unit (after)",
    body: "Target cost per unit after the efficiency improvement."
  },
  financialOperationalAnnualVolume: {
    title: "Annual volume",
    body: "Annual unit volume used in the cost-per-unit savings component."
  },
  financialOperationalCycleTimeBeforeMinutes: {
    title: "Cycle time before (minutes)",
    body: "Current cycle time per transaction/customer before improvement."
  },
  financialOperationalCycleTimeAfterMinutes: {
    title: "Cycle time after (minutes)",
    body: "Target cycle time per transaction/customer after improvement."
  },
  financialOperationalLaborCostPerHour: {
    title: "Labor cost per hour",
    body: "Average labor cost per hour used in labor/time savings."
  },
  financialOperationalAnnualTransactions: {
    title: "Annual transactions",
    body: "Yearly transaction/customer volume used in labor/time annualization."
  }
};

function normalizeFinancialFramework(val) {
  const raw = (val || "").toString().trim().toLowerCase();
  return FINANCIAL_FRAMEWORKS.includes(raw) ? raw : FINANCIAL_FRAMEWORK_DEFAULT;
}

function sanitizeFinancialImpactInputs(framework, inputs) {
  const f = normalizeFinancialFramework(framework);
  const source = inputs && typeof inputs === "object" ? inputs : {};
  const allowed = {
    custom: ["customNotes"],
    clv: [
      "clvCustomers",
      "clvMargin",
      "clvRetentionRatePct",
      "clvDiscountRatePct",
      "clvAcquisitionCost",
      "clvBaselineRetentionRatePct"
    ],
    nps: [
      "npsTotalCustomers",
      "npsCustomersMoved",
      "npsArpa",
      "npsRetentionPromoterPct",
      "npsRetentionSourcePct",
      "npsContributionMarginPct",
      "npsUpsellPerConverted",
      "npsReferralPerConverted",
      "npsProgramCost",
      "npsDeltaRetainedRevenue",
      "npsDeltaExpansionRevenue",
      "npsDeltaReferralRevenue",
      "npsReportedImpactBasis"
    ],
    risk: [
      "riskProbabilityBeforePct",
      "riskProbabilityAfterPct",
      "riskLossPerExposure",
      "riskExposureUnits",
      "riskPeriodsPerYear",
      "riskMitigationCost"
    ],
    headcount: [
      "hcMinutesSavedPerFtePerDay",
      "hcWorkingDaysPerYear",
      "hcFteCount",
      "hcHoursPerDay",
      "hcUtilizationGainPct",
      "hcAnnualCostPerFte"
    ],
    operational: [
      "opCostPerUnitBefore",
      "opCostPerUnitAfter",
      "opAnnualVolume",
      "opCycleTimeBeforeMinutes",
      "opCycleTimeAfterMinutes",
      "opLaborCostPerHour",
      "opAnnualTransactions"
    ]
  };

  const out = {};
  (allowed[f] || []).forEach((key) => {
    if (key === "customNotes") {
      const note = (source.customNotes || "").toString().trim();
      if (note) out.customNotes = note;
      return;
    }
    if (key === "npsReportedImpactBasis") {
      const raw = (source.npsReportedImpactBasis ?? "net").toString().trim().toLowerCase();
      out.npsReportedImpactBasis = raw === "subtotal" ? "subtotal" : "net";
      return;
    }
    const n = Number(source[key]);
    if (Number.isFinite(n)) out[key] = n;
  });
  return out;
}

function sanitizeProfilesForExport(profiles) {
  return (Array.isArray(profiles) ? profiles : []).map((profile) => {
    const safeProfile = { ...profile };
    safeProfile.roadmaps = (Array.isArray(profile.roadmaps) ? profile.roadmaps : []).map((roadmap) => {
      const framework = normalizeFinancialFramework(roadmap.financialImpactFramework);
      return {
        ...roadmap,
        financialImpactFramework: framework,
        financialImpactInputs: sanitizeFinancialImpactInputs(framework, roadmap.financialImpactInputs || {})
      };
    });
    return safeProfile;
  });
}

function getFinancialInputsFromForm() {
  return {
    customNotes: (elements.financialCustomNotes && elements.financialCustomNotes.value || "").trim(),
    clvCustomers: elements.financialClvCustomers && elements.financialClvCustomers.value !== "" ? Number(elements.financialClvCustomers.value) : null,
    clvMargin: elements.financialClvMargin && elements.financialClvMargin.value !== "" ? Number(elements.financialClvMargin.value) : null,
    clvRetentionRatePct: elements.financialClvRetentionRatePct && elements.financialClvRetentionRatePct.value !== "" ? Number(elements.financialClvRetentionRatePct.value) : null,
    clvDiscountRatePct: elements.financialClvDiscountRatePct && elements.financialClvDiscountRatePct.value !== "" ? Number(elements.financialClvDiscountRatePct.value) : null,
    clvAcquisitionCost: elements.financialClvAcquisitionCost && elements.financialClvAcquisitionCost.value !== "" ? Number(elements.financialClvAcquisitionCost.value) : null,
    clvBaselineRetentionRatePct: elements.financialClvBaselineRetentionRatePct && elements.financialClvBaselineRetentionRatePct.value !== "" ? Number(elements.financialClvBaselineRetentionRatePct.value) : null,
    npsTotalCustomers: elements.financialNpsTotalCustomers && elements.financialNpsTotalCustomers.value !== "" ? Number(elements.financialNpsTotalCustomers.value) : null,
    npsCustomersMoved: elements.financialNpsCustomersMoved && elements.financialNpsCustomersMoved.value !== "" ? Number(elements.financialNpsCustomersMoved.value) : null,
    npsArpa: elements.financialNpsArpa && elements.financialNpsArpa.value !== "" ? Number(elements.financialNpsArpa.value) : null,
    npsRetentionPromoterPct: elements.financialNpsRetentionPromoterPct && elements.financialNpsRetentionPromoterPct.value !== "" ? Number(elements.financialNpsRetentionPromoterPct.value) : null,
    npsRetentionSourcePct: elements.financialNpsRetentionSourcePct && elements.financialNpsRetentionSourcePct.value !== "" ? Number(elements.financialNpsRetentionSourcePct.value) : null,
    npsContributionMarginPct: elements.financialNpsContributionMarginPct && elements.financialNpsContributionMarginPct.value !== "" ? Number(elements.financialNpsContributionMarginPct.value) : null,
    npsUpsellPerConverted: elements.financialNpsUpsellPerConverted && elements.financialNpsUpsellPerConverted.value !== "" ? Number(elements.financialNpsUpsellPerConverted.value) : null,
    npsReferralPerConverted: elements.financialNpsReferralPerConverted && elements.financialNpsReferralPerConverted.value !== "" ? Number(elements.financialNpsReferralPerConverted.value) : null,
    npsProgramCost: elements.financialNpsProgramCost && elements.financialNpsProgramCost.value !== "" ? Number(elements.financialNpsProgramCost.value) : null,
    npsReportedImpactBasis:
      elements.financialNpsReportedImpactBasis && elements.financialNpsReportedImpactBasis.value
        ? elements.financialNpsReportedImpactBasis.value
        : "net",
    riskProbabilityBeforePct: elements.financialRiskProbabilityBeforePct && elements.financialRiskProbabilityBeforePct.value !== "" ? Number(elements.financialRiskProbabilityBeforePct.value) : null,
    riskProbabilityAfterPct: elements.financialRiskProbabilityAfterPct && elements.financialRiskProbabilityAfterPct.value !== "" ? Number(elements.financialRiskProbabilityAfterPct.value) : null,
    riskLossPerExposure: elements.financialRiskLossPerExposure && elements.financialRiskLossPerExposure.value !== "" ? Number(elements.financialRiskLossPerExposure.value) : null,
    riskExposureUnits: elements.financialRiskExposureUnits && elements.financialRiskExposureUnits.value !== "" ? Number(elements.financialRiskExposureUnits.value) : null,
    riskPeriodsPerYear: elements.financialRiskPeriodsPerYear && elements.financialRiskPeriodsPerYear.value !== "" ? Number(elements.financialRiskPeriodsPerYear.value) : null,
    riskMitigationCost: elements.financialRiskMitigationCost && elements.financialRiskMitigationCost.value !== "" ? Number(elements.financialRiskMitigationCost.value) : null,
    hcMinutesSavedPerFtePerDay: elements.financialHeadcountMinutesSavedPerFtePerDay && elements.financialHeadcountMinutesSavedPerFtePerDay.value !== "" ? Number(elements.financialHeadcountMinutesSavedPerFtePerDay.value) : null,
    hcWorkingDaysPerYear: elements.financialHeadcountWorkingDaysPerYear && elements.financialHeadcountWorkingDaysPerYear.value !== "" ? Number(elements.financialHeadcountWorkingDaysPerYear.value) : null,
    hcFteCount: elements.financialHeadcountFteCount && elements.financialHeadcountFteCount.value !== "" ? Number(elements.financialHeadcountFteCount.value) : null,
    hcHoursPerDay: elements.financialHeadcountHoursPerDay && elements.financialHeadcountHoursPerDay.value !== "" ? Number(elements.financialHeadcountHoursPerDay.value) : null,
    hcUtilizationGainPct: elements.financialHeadcountUtilizationGainPct && elements.financialHeadcountUtilizationGainPct.value !== "" ? Number(elements.financialHeadcountUtilizationGainPct.value) : null,
    hcAnnualCostPerFte: elements.financialHeadcountAnnualCostPerFte && elements.financialHeadcountAnnualCostPerFte.value !== "" ? Number(elements.financialHeadcountAnnualCostPerFte.value) : null,
    opCostPerUnitBefore: elements.financialOperationalCostPerUnitBefore && elements.financialOperationalCostPerUnitBefore.value !== "" ? Number(elements.financialOperationalCostPerUnitBefore.value) : null,
    opCostPerUnitAfter: elements.financialOperationalCostPerUnitAfter && elements.financialOperationalCostPerUnitAfter.value !== "" ? Number(elements.financialOperationalCostPerUnitAfter.value) : null,
    opAnnualVolume: elements.financialOperationalAnnualVolume && elements.financialOperationalAnnualVolume.value !== "" ? Number(elements.financialOperationalAnnualVolume.value) : null,
    opCycleTimeBeforeMinutes: elements.financialOperationalCycleTimeBeforeMinutes && elements.financialOperationalCycleTimeBeforeMinutes.value !== "" ? Number(elements.financialOperationalCycleTimeBeforeMinutes.value) : null,
    opCycleTimeAfterMinutes: elements.financialOperationalCycleTimeAfterMinutes && elements.financialOperationalCycleTimeAfterMinutes.value !== "" ? Number(elements.financialOperationalCycleTimeAfterMinutes.value) : null,
    opLaborCostPerHour: elements.financialOperationalLaborCostPerHour && elements.financialOperationalLaborCostPerHour.value !== "" ? Number(elements.financialOperationalLaborCostPerHour.value) : null,
    opAnnualTransactions: elements.financialOperationalAnnualTransactions && elements.financialOperationalAnnualTransactions.value !== "" ? Number(elements.financialOperationalAnnualTransactions.value) : null
  };
}

/** Use current form values only so framework switches never reuse old framework inputs. */
function mergeFinancialImpactInputsForCompute() {
  const formInputs = getFinancialInputsFromForm();
  const currentFramework = normalizeFinancialFramework(elements.financialFramework && elements.financialFramework.value);
  return sanitizeFinancialImpactInputs(currentFramework, formInputs);
}

function setFinancialInputsToForm(inputs) {
  const safe = inputs && typeof inputs === "object" ? inputs : {};
  if (elements.financialCustomNotes) elements.financialCustomNotes.value = safe.customNotes || "";
  if (elements.financialClvCustomers) elements.financialClvCustomers.value = safe.clvCustomers != null ? String(safe.clvCustomers) : "";
  if (elements.financialClvMargin) elements.financialClvMargin.value = safe.clvMargin != null ? String(safe.clvMargin) : "";
  if (elements.financialClvRetentionRatePct) elements.financialClvRetentionRatePct.value = safe.clvRetentionRatePct != null ? String(safe.clvRetentionRatePct) : "";
  if (elements.financialClvDiscountRatePct) elements.financialClvDiscountRatePct.value = safe.clvDiscountRatePct != null ? String(safe.clvDiscountRatePct) : "";
  if (elements.financialClvAcquisitionCost) elements.financialClvAcquisitionCost.value = safe.clvAcquisitionCost != null ? String(safe.clvAcquisitionCost) : "";
  if (elements.financialClvBaselineRetentionRatePct) elements.financialClvBaselineRetentionRatePct.value = safe.clvBaselineRetentionRatePct != null ? String(safe.clvBaselineRetentionRatePct) : "";
  if (elements.financialNpsTotalCustomers) elements.financialNpsTotalCustomers.value = safe.npsTotalCustomers != null ? String(safe.npsTotalCustomers) : "";
  if (elements.financialNpsCustomersMoved) elements.financialNpsCustomersMoved.value = safe.npsCustomersMoved != null ? String(safe.npsCustomersMoved) : "";
  if (elements.financialNpsArpa) elements.financialNpsArpa.value = safe.npsArpa != null ? String(safe.npsArpa) : "";
  if (elements.financialNpsRetentionPromoterPct) elements.financialNpsRetentionPromoterPct.value = safe.npsRetentionPromoterPct != null ? String(safe.npsRetentionPromoterPct) : "";
  if (elements.financialNpsRetentionSourcePct) elements.financialNpsRetentionSourcePct.value = safe.npsRetentionSourcePct != null ? String(safe.npsRetentionSourcePct) : "";
  if (elements.financialNpsContributionMarginPct) elements.financialNpsContributionMarginPct.value = safe.npsContributionMarginPct != null ? String(safe.npsContributionMarginPct) : "";
  if (elements.financialNpsUpsellPerConverted) elements.financialNpsUpsellPerConverted.value = safe.npsUpsellPerConverted != null ? String(safe.npsUpsellPerConverted) : "";
  if (elements.financialNpsReferralPerConverted) elements.financialNpsReferralPerConverted.value = safe.npsReferralPerConverted != null ? String(safe.npsReferralPerConverted) : "";
  if (elements.financialNpsProgramCost) elements.financialNpsProgramCost.value = safe.npsProgramCost != null ? String(safe.npsProgramCost) : "";
  if (elements.financialNpsReportedImpactBasis) {
    elements.financialNpsReportedImpactBasis.value =
      safe.npsReportedImpactBasis === "subtotal" ? "subtotal" : "net";
  }
  if (elements.financialRiskProbabilityBeforePct) elements.financialRiskProbabilityBeforePct.value = safe.riskProbabilityBeforePct != null ? String(safe.riskProbabilityBeforePct) : "";
  if (elements.financialRiskProbabilityAfterPct) elements.financialRiskProbabilityAfterPct.value = safe.riskProbabilityAfterPct != null ? String(safe.riskProbabilityAfterPct) : "";
  if (elements.financialRiskLossPerExposure) elements.financialRiskLossPerExposure.value = safe.riskLossPerExposure != null ? String(safe.riskLossPerExposure) : "";
  if (elements.financialRiskExposureUnits) elements.financialRiskExposureUnits.value = safe.riskExposureUnits != null ? String(safe.riskExposureUnits) : "";
  if (elements.financialRiskPeriodsPerYear) elements.financialRiskPeriodsPerYear.value = safe.riskPeriodsPerYear != null ? String(safe.riskPeriodsPerYear) : "";
  if (elements.financialRiskMitigationCost) elements.financialRiskMitigationCost.value = safe.riskMitigationCost != null ? String(safe.riskMitigationCost) : "";
  if (elements.financialHeadcountMinutesSavedPerFtePerDay) elements.financialHeadcountMinutesSavedPerFtePerDay.value = safe.hcMinutesSavedPerFtePerDay != null ? String(safe.hcMinutesSavedPerFtePerDay) : "";
  if (elements.financialHeadcountWorkingDaysPerYear) elements.financialHeadcountWorkingDaysPerYear.value = safe.hcWorkingDaysPerYear != null ? String(safe.hcWorkingDaysPerYear) : "";
  if (elements.financialHeadcountFteCount) elements.financialHeadcountFteCount.value = safe.hcFteCount != null ? String(safe.hcFteCount) : "";
  if (elements.financialHeadcountHoursPerDay) elements.financialHeadcountHoursPerDay.value = safe.hcHoursPerDay != null ? String(safe.hcHoursPerDay) : "";
  if (elements.financialHeadcountUtilizationGainPct) elements.financialHeadcountUtilizationGainPct.value = safe.hcUtilizationGainPct != null ? String(safe.hcUtilizationGainPct) : "";
  if (elements.financialHeadcountAnnualCostPerFte) elements.financialHeadcountAnnualCostPerFte.value = safe.hcAnnualCostPerFte != null ? String(safe.hcAnnualCostPerFte) : "";
  if (elements.financialOperationalCostPerUnitBefore) elements.financialOperationalCostPerUnitBefore.value = safe.opCostPerUnitBefore != null ? String(safe.opCostPerUnitBefore) : "";
  if (elements.financialOperationalCostPerUnitAfter) elements.financialOperationalCostPerUnitAfter.value = safe.opCostPerUnitAfter != null ? String(safe.opCostPerUnitAfter) : "";
  if (elements.financialOperationalAnnualVolume) elements.financialOperationalAnnualVolume.value = safe.opAnnualVolume != null ? String(safe.opAnnualVolume) : "";
  if (elements.financialOperationalCycleTimeBeforeMinutes) elements.financialOperationalCycleTimeBeforeMinutes.value = safe.opCycleTimeBeforeMinutes != null ? String(safe.opCycleTimeBeforeMinutes) : "";
  if (elements.financialOperationalCycleTimeAfterMinutes) elements.financialOperationalCycleTimeAfterMinutes.value = safe.opCycleTimeAfterMinutes != null ? String(safe.opCycleTimeAfterMinutes) : "";
  if (elements.financialOperationalLaborCostPerHour) elements.financialOperationalLaborCostPerHour.value = safe.opLaborCostPerHour != null ? String(safe.opLaborCostPerHour) : "";
  if (elements.financialOperationalAnnualTransactions) elements.financialOperationalAnnualTransactions.value = safe.opAnnualTransactions != null ? String(safe.opAnnualTransactions) : "";
}

function resetFinancialFrameworkInputs() {
  // Hard reset all framework-specific inputs to prevent stale cross-framework carryover.
  setFinancialInputsToForm({});
  if (elements.financialImpactValue && elements.financialImpactValue.readOnly) {
    elements.financialImpactValue.value = "";
  }
}

function toggleFinancialFrameworkFields(framework) {
  const selected = normalizeFinancialFramework(framework);
  if (elements.financialFramework) elements.financialFramework.value = selected;
  if (elements.financialImpactValue) {
    const isCustom = selected === FINANCIAL_FRAMEWORK_DEFAULT;
    elements.financialImpactValue.readOnly = !isCustom;
    elements.financialImpactValue.classList.toggle("is-computed", !isCustom);
    if (isCustom) {
      elements.financialImpactValue.placeholder = "e.g. 250000";
    } else {
      elements.financialImpactValue.placeholder = "Auto-calculated from framework inputs";
    }
  }
  if (elements.financialFrameworkFormulaHint) {
    if (selected === "clv") {
      elements.financialFrameworkFormulaHint.textContent = "CLV: CLV = (margin x retention) / (1 + discount - retention), Net CLV = CLV - CAC. Enter baseline retention for uplift mode. If you enter a small value (e.g. 3) it is treated as uplift points (+3 pp). If customers is blank, result is per-customer.";
    } else if (selected === "nps") {
      elements.financialFrameworkFormulaHint.textContent =
        "NPS: use “Reported impact” to choose what fills the financial impact field—subtotal (retention + expansion GP, doc Step 3) or net (includes referral GP and subtracts program cost). Breakdown always shows all lines. Rates accept 95 or 0.95.";
    } else if (selected === "risk") {
      elements.financialFrameworkFormulaHint.textContent = "Risk mitigation value: ((expected loss before - expected loss after) x periods per year) - mitigation cost, where expected loss = probability x loss per exposure x exposure units.";
    } else if (selected === "headcount") {
      elements.financialFrameworkFormulaHint.textContent = "Headcount savings: Hours saved per FTE/year = (minutes saved per FTE per day / 60) x working days/year. Total hours saved = hours saved per FTE/year x FTE count. Avoided FTEs = total hours saved / (working days/year x hours/day). Financial impact = avoided FTEs x annual fully loaded cost per FTE.";
    } else if (selected === "operational") {
      elements.financialFrameworkFormulaHint.textContent = "Operational efficiency: Annual financial impact = (cost per unit before - cost per unit after) x annual volume + ((cycle time before - cycle time after) / 60) x labor cost per hour x annual transactions.";
    } else {
      elements.financialFrameworkFormulaHint.textContent = "Custom: enter a direct amount manually.";
    }
  }
  const blocks = document.querySelectorAll("[data-framework-fields]");
  blocks.forEach((el) => {
    const isActive = el.getAttribute("data-framework-fields") === selected;
    el.style.display = isActive ? "" : "none";
  });
  if (selected !== "clv") {
    updateClvBreakdown(null);
  }
  if (selected !== "risk") {
    updateRiskBreakdown(null);
  }
  if (selected !== "nps") {
    updateNpsBreakdown(null);
  }
  if (selected !== "headcount") {
    updateHeadcountBreakdown(null);
  }
  if (selected !== "operational") {
    updateOperationalBreakdown(null);
  }
}

function computeClvBreakdown(inputs) {
  const safe = inputs && typeof inputs === "object" ? inputs : {};
  const toFinite = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };
  const pctOrNull = (value) => {
    const n = toFinite(value);
    return n == null ? null : n / 100;
  };

  const customersRaw = toFinite(safe.clvCustomers);
  const margin = toFinite(safe.clvMargin);
  const retentionRateRaw = toFinite(safe.clvRetentionRatePct);
  const retentionRate = pctOrNull(safe.clvRetentionRatePct);
  const discountRate = pctOrNull(safe.clvDiscountRatePct);
  const acquisitionCostRaw = toFinite(safe.clvAcquisitionCost);
  const acquisitionCost = acquisitionCostRaw == null ? 0 : acquisitionCostRaw;
  const baselineRetentionRateRaw = toFinite(safe.clvBaselineRetentionRatePct);
  let baselineRetentionRate = pctOrNull(safe.clvBaselineRetentionRatePct);
  let effectiveNewRetentionRate = retentionRate;

  if (retentionRateRaw == null || margin == null || discountRate == null) return null;

  if (baselineRetentionRateRaw != null && baselineRetentionRateRaw > 0 && baselineRetentionRateRaw <= 15) {
    effectiveNewRetentionRate = (retentionRateRaw + baselineRetentionRateRaw) / 100;
    baselineRetentionRate = retentionRateRaw / 100;
  }

  const denominator = 1 + discountRate - effectiveNewRetentionRate;
  if (effectiveNewRetentionRate == null || denominator === 0) return null;

  const customers = customersRaw == null ? 1 : customersRaw;
  const clvNew = (margin * effectiveNewRetentionRate) / denominator;
  const netClvNew = clvNew - acquisitionCost;

  let netClvBaseline = null;
  let netClvIncremental = null;
  if (baselineRetentionRate != null) {
    const baselineDenominator = 1 + discountRate - baselineRetentionRate;
    if (baselineDenominator === 0) return null;
    const clvBaseline = (margin * baselineRetentionRate) / baselineDenominator;
    netClvBaseline = clvBaseline - acquisitionCost;
    netClvIncremental = netClvNew - netClvBaseline;
  }

  const totalImpact = netClvIncremental != null ? customers * netClvIncremental : customers * netClvNew;
  return {
    clvNew,
    netClvNew,
    netClvBaseline,
    netClvIncremental,
    totalImpact
  };
}

function updateClvBreakdown(breakdown) {
  const setText = (el, value) => {
    if (!el) return;
    el.textContent = Number.isFinite(value) ? Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—";
  };
  setText(elements.financialClvBreakdownClvNew, breakdown && breakdown.clvNew);
  setText(elements.financialClvBreakdownNetClvNew, breakdown && breakdown.netClvNew);
  setText(elements.financialClvBreakdownNetClvBaseline, breakdown && breakdown.netClvBaseline);
  setText(elements.financialClvBreakdownNetClvIncremental, breakdown && breakdown.netClvIncremental);
  setText(elements.financialClvBreakdownTotalImpact, breakdown && breakdown.totalImpact);
}

function computeRiskBreakdown(inputs) {
  const safe = inputs && typeof inputs === "object" ? inputs : {};
  const toFinite = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  const probabilityBeforePct = toFinite(safe.riskProbabilityBeforePct);
  const probabilityAfterPct = toFinite(safe.riskProbabilityAfterPct);
  const lossPerExposure = toFinite(safe.riskLossPerExposure);
  const exposureUnits = toFinite(safe.riskExposureUnits);
  const periodsPerYearRaw = toFinite(safe.riskPeriodsPerYear);
  const mitigationCostRaw = toFinite(safe.riskMitigationCost);
  const periodsPerYear = periodsPerYearRaw == null ? 12 : periodsPerYearRaw;
  const mitigationCost = mitigationCostRaw == null ? 0 : mitigationCostRaw;

  if (
    probabilityBeforePct == null ||
    probabilityAfterPct == null ||
    lossPerExposure == null ||
    exposureUnits == null ||
    periodsPerYear <= 0
  ) return null;
  if (probabilityAfterPct > probabilityBeforePct) return null;

  const expectedBefore = exposureUnits * (probabilityBeforePct / 100) * lossPerExposure;
  const expectedAfter = exposureUnits * (probabilityAfterPct / 100) * lossPerExposure;
  const expectedAvoided = expectedBefore - expectedAfter;
  const annualizedAvoided = expectedAvoided * periodsPerYear;
  const netValue = annualizedAvoided - mitigationCost;

  return {
    expectedBefore,
    expectedAfter,
    expectedAvoided,
    annualizedAvoided,
    netValue
  };
}

function computeHeadcountBreakdown(inputs) {
  const safe = inputs && typeof inputs === "object" ? inputs : {};
  const toFinite = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };
  const minutesSavedPerFtePerDay = toFinite(safe.hcMinutesSavedPerFtePerDay);
  const workingDaysPerYear = toFinite(safe.hcWorkingDaysPerYear);
  const fteCount = toFinite(safe.hcFteCount);
  const hoursPerDay = toFinite(safe.hcHoursPerDay) || 8;
  const annualCostPerFte = toFinite(safe.hcAnnualCostPerFte);
  const utilizationGainPct = toFinite(safe.hcUtilizationGainPct);

  if (
    minutesSavedPerFtePerDay == null ||
    workingDaysPerYear == null ||
    fteCount == null ||
    annualCostPerFte == null ||
    workingDaysPerYear <= 0 ||
    hoursPerDay <= 0 ||
    fteCount < 0 ||
    minutesSavedPerFtePerDay < 0 ||
    annualCostPerFte < 0
  ) return null;

  const derivedUtilizationGain = minutesSavedPerFtePerDay / (hoursPerDay * 60);
  const utilizationGain =
    utilizationGainPct != null ? utilizationGainPct / 100 : derivedUtilizationGain;
  if (utilizationGain < 0) return null;

  const hoursSavedPerFtePerYear = (minutesSavedPerFtePerDay / 60) * workingDaysPerYear;
  const totalHoursSaved = hoursSavedPerFtePerYear * fteCount;
  const avoidedFtes = totalHoursSaved / (workingDaysPerYear * hoursPerDay);
  const financialImpact = avoidedFtes * annualCostPerFte;

  return {
    utilizationGain,
    hoursSavedPerFtePerYear,
    totalHoursSaved,
    avoidedFtes,
    financialImpact
  };
}

function updateHeadcountBreakdown(breakdown) {
  const setText = (el, value, opts = {}) => {
    if (!el) return;
    if (!Number.isFinite(value)) {
      el.textContent = "—";
      return;
    }
    if (opts.percent) {
      el.textContent = `${(value * 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
      return;
    }
    el.textContent = Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
  };
  setText(elements.financialHeadcountBreakdownUtilizationGain, breakdown && breakdown.utilizationGain, { percent: true });
  setText(elements.financialHeadcountBreakdownHoursSavedPerFte, breakdown && breakdown.hoursSavedPerFtePerYear);
  setText(elements.financialHeadcountBreakdownTotalHoursSaved, breakdown && breakdown.totalHoursSaved);
  setText(elements.financialHeadcountBreakdownAvoidedFtes, breakdown && breakdown.avoidedFtes);
  setText(elements.financialHeadcountBreakdownFinancialImpact, breakdown && breakdown.financialImpact);
}

function computeOperationalBreakdown(inputs) {
  const safe = inputs && typeof inputs === "object" ? inputs : {};
  const toFinite = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };
  const hasCostView =
    toFinite(safe.opCostPerUnitBefore) != null &&
    toFinite(safe.opCostPerUnitAfter) != null &&
    toFinite(safe.opAnnualVolume) != null;
  const hasLaborView =
    toFinite(safe.opCycleTimeBeforeMinutes) != null &&
    toFinite(safe.opCycleTimeAfterMinutes) != null &&
    toFinite(safe.opLaborCostPerHour) != null &&
    toFinite(safe.opAnnualTransactions) != null;
  if (!hasCostView && !hasLaborView) return null;

  const costPerUnitBefore = toFinite(safe.opCostPerUnitBefore);
  const costPerUnitAfter = toFinite(safe.opCostPerUnitAfter);
  const annualVolume = toFinite(safe.opAnnualVolume);
  const cycleTimeBeforeMinutes = toFinite(safe.opCycleTimeBeforeMinutes);
  const cycleTimeAfterMinutes = toFinite(safe.opCycleTimeAfterMinutes);
  const laborCostPerHour = toFinite(safe.opLaborCostPerHour);
  const annualTransactions = toFinite(safe.opAnnualTransactions);

  const costPerUnitSavings =
    hasCostView ? (costPerUnitBefore - costPerUnitAfter) * annualVolume : 0;
  const laborSavings =
    hasLaborView
      ? ((cycleTimeBeforeMinutes - cycleTimeAfterMinutes) / 60) * laborCostPerHour * annualTransactions
      : 0;

  return {
    costPerUnitSavings,
    laborSavings,
    totalSavings: costPerUnitSavings + laborSavings
  };
}

function updateOperationalBreakdown(breakdown) {
  const setText = (el, value) => {
    if (!el) return;
    if (!Number.isFinite(value)) {
      el.textContent = "—";
      return;
    }
    el.textContent = Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
  };
  setText(elements.financialOperationalBreakdownCostPerUnitSavings, breakdown && breakdown.costPerUnitSavings);
  setText(elements.financialOperationalBreakdownLaborSavings, breakdown && breakdown.laborSavings);
  setText(elements.financialOperationalBreakdownTotalSavings, breakdown && breakdown.totalSavings);
}

function updateRiskBreakdown(breakdown) {
  const setText = (el, value) => {
    if (!el) return;
    el.textContent = Number.isFinite(value) ? Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—";
  };
  setText(elements.financialRiskBreakdownExpectedBefore, breakdown && breakdown.expectedBefore);
  setText(elements.financialRiskBreakdownExpectedAfter, breakdown && breakdown.expectedAfter);
  setText(elements.financialRiskBreakdownExpectedAvoided, breakdown && breakdown.expectedAvoided);
  setText(elements.financialRiskBreakdownAnnualizedAvoided, breakdown && breakdown.annualizedAvoided);
  setText(elements.financialRiskBreakdownNetValue, breakdown && breakdown.netValue);
}

/**
 * Parses retention/margin inputs: 95 → 0.95, and 0.95 → 0.95 (decimal fraction).
 * Values must be within 0–100; (1, 100] are treated as percent points; [0, 1] as fractions.
 */
function parseNpsRateInput(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  if (n > 1) return n / 100;
  return n;
}

function normalizeNpsReportedImpactBasis(inputs) {
  const safe = inputs && typeof inputs === "object" ? inputs : {};
  return safe.npsReportedImpactBasis === "subtotal" ? "subtotal" : "net";
}

function computeNpsBreakdown(inputs) {
  const safe = inputs && typeof inputs === "object" ? inputs : {};
  const toFinite = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  const customersMoved = toFinite(safe.npsCustomersMoved);
  const totalCustomers = toFinite(safe.npsTotalCustomers);
  const arpa = toFinite(safe.npsArpa);
  const retentionPromoter = parseNpsRateInput(safe.npsRetentionPromoterPct);
  const retentionSource = parseNpsRateInput(safe.npsRetentionSourcePct);
  const contributionMargin = parseNpsRateInput(safe.npsContributionMarginPct);
  const upsellPerConvertedRaw = toFinite(safe.npsUpsellPerConverted);
  const referralPerConvertedRaw = toFinite(safe.npsReferralPerConverted);
  const programCostRaw = toFinite(safe.npsProgramCost);
  const upsellPerConverted = upsellPerConvertedRaw == null ? 0 : upsellPerConvertedRaw;
  const referralPerConverted = referralPerConvertedRaw == null ? 0 : referralPerConvertedRaw;
  const programCost = programCostRaw == null ? 0 : programCostRaw;

  if (
    customersMoved == null ||
    arpa == null ||
    retentionPromoter == null ||
    retentionSource == null ||
    contributionMargin == null
  ) return null;
  if (totalCustomers != null && customersMoved > totalCustomers) return null;
  if (retentionPromoter < retentionSource) return null;

  const incrementalRetainedCustomers = customersMoved * (retentionPromoter - retentionSource);
  const retainedRevenue = incrementalRetainedCustomers * arpa;
  const expansionRevenue = customersMoved * upsellPerConverted;
  const referralRevenue = customersMoved * referralPerConverted;
  const retainedGrossProfit = retainedRevenue * contributionMargin;
  const expansionGrossProfit = expansionRevenue * contributionMargin;
  const referralGrossProfit = referralRevenue * contributionMargin;
  const subtotalRetentionExpansionGrossProfit = retainedGrossProfit + expansionGrossProfit;
  const grossProfitImpact = subtotalRetentionExpansionGrossProfit + referralGrossProfit;
  const netImpact = grossProfitImpact - programCost;
  const retentionRateDelta = retentionPromoter - retentionSource;

  return {
    incrementalRetainedCustomers,
    retentionRateDelta,
    retainedRevenue,
    retainedGrossProfit,
    expansionRevenue,
    expansionGrossProfit,
    subtotalRetentionExpansionGrossProfit,
    referralRevenue,
    referralGrossProfit,
    grossProfitImpact,
    netImpact
  };
}

function updateNpsBreakdown(breakdown) {
  const setText = (el, value) => {
    if (!el) return;
    el.textContent = Number.isFinite(value) ? Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—";
  };
  setText(elements.financialNpsBreakdownRetainedCustomers, breakdown && breakdown.incrementalRetainedCustomers);
  setText(elements.financialNpsBreakdownRetainedRevenue, breakdown && breakdown.retainedRevenue);
  setText(elements.financialNpsBreakdownRetainedGrossProfit, breakdown && breakdown.retainedGrossProfit);
  setText(elements.financialNpsBreakdownExpansionRevenue, breakdown && breakdown.expansionRevenue);
  setText(elements.financialNpsBreakdownExpansionGrossProfit, breakdown && breakdown.expansionGrossProfit);
  setText(elements.financialNpsBreakdownSubtotalRetentionExpansion, breakdown && breakdown.subtotalRetentionExpansionGrossProfit);
  setText(elements.financialNpsBreakdownReferralRevenue, breakdown && breakdown.referralRevenue);
  setText(elements.financialNpsBreakdownReferralGrossProfit, breakdown && breakdown.referralGrossProfit);
  setText(elements.financialNpsBreakdownGrossProfit, breakdown && breakdown.grossProfitImpact);
  setText(elements.financialNpsBreakdownNetImpact, breakdown && breakdown.netImpact);
  if (elements.financialNpsBreakdownFormula) {
    if (breakdown && Number.isFinite(breakdown.incrementalRetainedCustomers)) {
      const dPct = Number.isFinite(breakdown.retentionRateDelta)
        ? (breakdown.retentionRateDelta * 100).toLocaleString(undefined, { maximumFractionDigits: 2 })
        : "—";
      elements.financialNpsBreakdownFormula.textContent =
        `Δ retention = ${dPct} percentage points → incremental retained customers = moved × ΔR. ` +
        "GP = revenue × contribution margin per stream; subtotal = retained + expansion (matches the worked example when referral = 0).";
    } else {
      elements.financialNpsBreakdownFormula.textContent = "";
    }
  }
  if (elements.financialNpsBreakdownFormulaRow) {
    elements.financialNpsBreakdownFormulaRow.style.display =
      breakdown && Number.isFinite(breakdown.incrementalRetainedCustomers) ? "" : "none";
  }

  const framework = elements.financialFramework && normalizeFinancialFramework(elements.financialFramework.value);
  if (elements.financialNpsBreakdownWarningRow && elements.financialNpsBreakdownWarning) {
    if (framework !== "nps") {
      elements.financialNpsBreakdownWarning.textContent = "—";
      elements.financialNpsBreakdownWarningRow.style.display = "none";
      elements.financialNpsBreakdownWarningRow.classList.remove("is-missing");
    } else {
      const inputs = mergeFinancialImpactInputsForCompute();
      const before = parseNpsRateInput(inputs.npsRetentionPromoterPct);
      const source = parseNpsRateInput(inputs.npsRetentionSourcePct);
      const invalidRetentionOrder =
        before != null && source != null && source > before;
      if (invalidRetentionOrder) {
        elements.financialNpsBreakdownWarning.textContent = "Source segment retention cannot be greater than promoter retention.";
        elements.financialNpsBreakdownWarningRow.style.display = "";
        elements.financialNpsBreakdownWarningRow.classList.add("is-missing");
      } else {
        elements.financialNpsBreakdownWarning.textContent = "—";
        elements.financialNpsBreakdownWarningRow.style.display = "none";
        elements.financialNpsBreakdownWarningRow.classList.remove("is-missing");
      }
    }
  }
}

function getFinancialFrameworkValidationMessage(framework, inputs) {
  const f = normalizeFinancialFramework(framework);
  const safe = inputs && typeof inputs === "object" ? inputs : {};
  const isFiniteNumber = (value) => Number.isFinite(Number(value));

  if (f === "clv") {
    return "CLV framework requires margin, retention rate, and discount rate (plus optional customers, CAC, baseline/uplift).";
  }
  if (f === "nps") {
    const rateOutOfRange = (key) =>
      safe[key] != null &&
      safe[key] !== "" &&
      isFiniteNumber(safe[key]) &&
      parseNpsRateInput(safe[key]) == null;
    if (
      rateOutOfRange("npsRetentionPromoterPct") ||
      rateOutOfRange("npsRetentionSourcePct") ||
      rateOutOfRange("npsContributionMarginPct")
    ) {
      return "NPS framework: retention and margin must be between 0 and 100 (e.g. 95 or 0.95 for 95%).";
    }
    const hasMoved = isFiniteNumber(safe.npsCustomersMoved);
    const hasArpa = isFiniteNumber(safe.npsArpa);
    const promoR = parseNpsRateInput(safe.npsRetentionPromoterPct);
    const srcR = parseNpsRateInput(safe.npsRetentionSourcePct);
    const marginR = parseNpsRateInput(safe.npsContributionMarginPct);
    const hasPromo = promoR != null;
    const hasSrc = srcR != null;
    const hasMargin = marginR != null;
    if (hasMoved && hasArpa && hasPromo && hasSrc && hasMargin) {
      if (srcR > promoR) {
        return "NPS framework: source segment retention must be less than or equal to promoter retention.";
      }
      if (safe.npsTotalCustomers != null && Number(safe.npsCustomersMoved) > Number(safe.npsTotalCustomers)) {
        return "NPS framework: customers moved cannot exceed total customers.";
      }
    }
    return "NPS framework requires moved customers, ARPA, promoter and source segment retention %, and contribution margin % (upsell and referral default to 0 if blank; optional total customers, program cost).";
  }
  if (f === "risk") {
    return "Risk framework requires probability before, probability after, loss per exposure, and exposure units (plus optional periods per year and mitigation cost).";
  }
  if (f === "headcount") {
    return "Headcount framework requires minutes saved per FTE per day, working days per year, FTE count, and annual fully loaded cost per FTE (optional hours/day default 8 and optional utilization gain % override).";
  }
  if (f === "operational") {
    return "Operational efficiency requires either: (a) cost-per-unit before, cost-per-unit after, and annual volume; or (b) cycle time before (minutes), cycle time after (minutes), labor cost per hour, and annual transactions.";
  }
  return "Complete all required inputs for the selected financial framework.";
}

function computeFrameworkFinancialImpact(framework, inputs, customAmount) {
  const safe = inputs && typeof inputs === "object" ? inputs : {};
  const toFinite = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };
  const pctOrNull = (value) => {
    const n = toFinite(value);
    return n == null ? null : n / 100;
  };
  const f = normalizeFinancialFramework(framework);

  if (f === "custom") {
    return toFinite(customAmount);
  }

  if (f === "clv") {
    const customers = toFinite(safe.clvCustomers);
    const margin = toFinite(safe.clvMargin);
    const retentionRateRaw = toFinite(safe.clvRetentionRatePct);
    const retentionRate = pctOrNull(safe.clvRetentionRatePct);
    const discountRate = pctOrNull(safe.clvDiscountRatePct);
    const acquisitionCostRaw = toFinite(safe.clvAcquisitionCost);
    const acquisitionCost = acquisitionCostRaw == null ? 0 : acquisitionCostRaw;
    const baselineRetentionRateRaw = toFinite(safe.clvBaselineRetentionRatePct);
    let baselineRetentionRate = pctOrNull(safe.clvBaselineRetentionRatePct);
    let effectiveNewRetentionRate = retentionRate;
    if (retentionRateRaw == null || margin == null || discountRate == null) return null;

    // UX guardrail: users often enter uplift points (e.g. "3") instead of baseline retention.
    // If baseline input looks like uplift points, reinterpret as "new retention = current + uplift points".
    if (baselineRetentionRateRaw != null && baselineRetentionRateRaw > 0 && baselineRetentionRateRaw <= 15) {
      effectiveNewRetentionRate = (retentionRateRaw + baselineRetentionRateRaw) / 100;
      baselineRetentionRate = retentionRateRaw / 100;
    }

    const denominator = 1 + discountRate - effectiveNewRetentionRate;
    const customerCount = customers == null ? 1 : customers;
    if (effectiveNewRetentionRate == null || denominator === 0) return null;
    const clv = (margin * effectiveNewRetentionRate) / denominator;
    const netClv = clv - acquisitionCost;

    if (baselineRetentionRate != null) {
      const baselineDenominator = 1 + discountRate - baselineRetentionRate;
      if (baselineDenominator === 0) return null;
      const baselineClv = (margin * baselineRetentionRate) / baselineDenominator;
      const baselineNetClv = baselineClv - acquisitionCost;
      return customerCount * (netClv - baselineNetClv);
    }

    return customerCount * netClv;
  }
  if (f === "nps") {
    const basis = normalizeNpsReportedImpactBasis(safe);
    const breakdown = computeNpsBreakdown(safe);
    if (breakdown) {
      return basis === "subtotal" ? breakdown.subtotalRetentionExpansionGrossProfit : breakdown.netImpact;
    }
    const dr = toFinite(safe.npsDeltaRetainedRevenue);
    const de = toFinite(safe.npsDeltaExpansionRevenue);
    const dref = toFinite(safe.npsDeltaReferralRevenue);
    const pc = toFinite(safe.npsProgramCost);
    if (dr != null || de != null || dref != null) {
      if (basis === "subtotal") return (dr ?? 0) + (de ?? 0);
      return (dr ?? 0) + (de ?? 0) + (dref ?? 0) - (pc ?? 0);
    }
    return null;
  }
  if (f === "risk") {
    const breakdown = computeRiskBreakdown(safe);
    if (!breakdown) return null;
    return breakdown.netValue;
  }
  if (f === "headcount") {
    const breakdown = computeHeadcountBreakdown(safe);
    if (!breakdown) return null;
    return breakdown.financialImpact;
  }
  if (f === "operational") {
    const breakdown = computeOperationalBreakdown(safe);
    if (!breakdown) return null;
    return breakdown.totalSavings;
  }
  return null;
}

// --- Initialization ---
let roadmapModalSectionNavObserver = null;
let roadmapModalSectionNavSyncFrame = null;
let roadmapModalSectionNavRatioMap = new Map();
let roadmapModalSectionNavLockUntil = 0;
let roadmapModalSectionNavLockedId = null;
let roadmapModalSectionNavResizeObserver = null;

const ROADMAP_MODAL_SECTION_NAV_IDS = [
  "roadmapModalSectionRoadmap",
  "roadmapModalSectionRice",
  "roadmapModalSectionMoscow",
  "roadmapModalSectionKano",
  "roadmapModalSectionMeta",
  "roadmapModalSectionRaci",
  "roadmapModalSectionFinancial"
];

function roadmapModalSectionRoadmapHasData() {
  if ((elements.roadmapTitle?.value || "").trim()) return true;
  if (richDescriptionToPlainText(getRichDescriptionValue("roadmapDescription"))) return true;
  const section = document.getElementById("roadmapModalSectionRoadmap");
  if (!section) return false;
  for (const details of section.querySelectorAll(".roadmap-optional-field-details")) {
    const wrap = details.closest(".roadmap-field-tooltip-wrap");
    if (roadmapOptionalFieldHasData(wrap)) return true;
  }
  return false;
}

function roadmapModalSectionHasData(sectionId) {
  if (!sectionId) return false;
  if (sectionId === "roadmapModalSectionRoadmap") {
    return roadmapModalSectionRoadmapHasData();
  }
  return roadmapOptionalSectionHasData(sectionId);
}

const ROADMAP_MODAL_SECTION_STATUS_MARKUP =
  '<svg class="roadmap-modal-section-status-icon" viewBox="0 0 12 12" aria-hidden="true">' +
  '<path d="M2.4 6.2 4.9 8.7 9.6 3.6" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function ensureRoadmapModalSectionStatusBadge(btn) {
  if (!btn) return;
  let status = btn.querySelector(".roadmap-modal-section-status");
  if (!status) {
    status = document.createElement("span");
    status.className = "roadmap-modal-section-status";
    status.setAttribute("aria-hidden", "true");
    btn.appendChild(status);
  }
  if (!status.querySelector(".roadmap-modal-section-status-icon")) {
    status.innerHTML = ROADMAP_MODAL_SECTION_STATUS_MARKUP;
  }
}

function syncRoadmapModalSectionNavIndicators() {
  const modal = document.getElementById("roadmapModal");
  if (!modal) return;
  modal.querySelectorAll(".roadmap-modal-section-btn[data-scroll-target]").forEach((btn) => {
    ensureRoadmapModalSectionStatusBadge(btn);
    if (!btn.dataset.sectionLabel) {
      btn.dataset.sectionLabel = btn.getAttribute("aria-label") || "Section";
    }
    const sectionId = btn.getAttribute("data-scroll-target");
    const hasData = roadmapModalSectionHasData(sectionId);
    const isActive = btn.classList.contains("is-active");
    const wasPopulated = btn.classList.contains("is-populated");
    btn.classList.toggle("is-populated", hasData);
    const baseLabel = btn.dataset.sectionLabel;
    const contentStatus = hasData ? "has content" : "no content yet";
    const labelSuffix = isActive ? `, ${contentStatus}, current section` : `, ${contentStatus}`;
    btn.setAttribute("aria-label", `${baseLabel}${labelSuffix}`);
    btn.setAttribute("title", `${baseLabel} — ${contentStatus}${isActive ? " · current section" : ""}`);
    btn.setAttribute("aria-current", isActive ? "location" : "false");
    if (hasData && !wasPopulated) {
      btn.classList.add("is-populated-pulse");
      window.setTimeout(() => btn.classList.remove("is-populated-pulse"), 650);
    }
  });

  syncRoadmapModalSectionActiveIndicator(modal);
}

function setRoadmapModalActiveSection(modal, sectionId, { userInitiated = false } = {}) {
  if (!modal || !sectionId) return;
  if (userInitiated) {
    roadmapModalSectionNavLockedId = sectionId;
    roadmapModalSectionNavLockUntil = Date.now() + 850;
  }
  modal.querySelectorAll(".roadmap-modal-section-btn").forEach((btn) => {
    btn.classList.toggle("is-active", btn.getAttribute("data-scroll-target") === sectionId);
  });
  syncRoadmapModalSectionNavIndicators();
}

function resolveRoadmapModalActiveSectionId(scrollRoot, sectionEls) {
  if (!scrollRoot || !sectionEls.length) return null;

  let bestId = null;
  let bestRatio = 0;
  sectionEls.forEach((sec) => {
    const ratio = roadmapModalSectionNavRatioMap.get(sec.id) || 0;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      bestId = sec.id;
    }
  });
  if (bestId && bestRatio >= 0.12) return bestId;

  const rootRect = scrollRoot.getBoundingClientRect();
  const focusLine = rootRect.top + Math.min(rootRect.height * 0.24, 96);
  let nearestId = sectionEls[0].id;
  let nearestDistance = Infinity;
  sectionEls.forEach((sec) => {
    const rect = sec.getBoundingClientRect();
    if (rect.bottom <= rootRect.top + 8) return;
    const distance = Math.abs(rect.top - focusLine);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestId = sec.id;
    }
  });
  return nearestId;
}

function syncRoadmapModalSectionActiveIndicator(modal) {
  const rail = modal?.querySelector(".roadmap-modal-section-rail");
  if (!rail) return;

  let indicator = rail.querySelector(".roadmap-modal-section-active-indicator");
  if (!indicator) {
    indicator = document.createElement("span");
    indicator.className = "roadmap-modal-section-active-indicator";
    indicator.setAttribute("aria-hidden", "true");
    rail.appendChild(indicator);
  } else if (indicator !== rail.lastElementChild) {
    rail.appendChild(indicator);
  }

  const activeBtn = rail.querySelector(".roadmap-modal-section-btn.is-active");
  if (!activeBtn) {
    rail.classList.remove("roadmap-modal-section-rail--indicator-ready");
    return;
  }

  const isHorizontal = getComputedStyle(rail).flexDirection === "row";
  rail.classList.toggle("roadmap-modal-section-rail--layout-horizontal", isHorizontal);

  const railRect = rail.getBoundingClientRect();
  const btnRect = activeBtn.getBoundingClientRect();
  const indicatorRect = indicator.getBoundingClientRect();

  let offsetX;
  let offsetY;
  if (isHorizontal) {
    const indicatorWidth = indicatorRect.width || 20.5;
    const indicatorHeight = indicatorRect.height || 2.9;
    offsetX = btnRect.left - railRect.left + (btnRect.width - indicatorWidth) / 2;
    offsetY = btnRect.top - railRect.top;
  } else {
    const indicatorHeight = indicatorRect.height || 24;
    offsetX = btnRect.left - railRect.left;
    offsetY = btnRect.top - railRect.top + (btnRect.height - indicatorHeight) / 2;
  }

  const isFirstPaint = !rail.classList.contains("roadmap-modal-section-rail--indicator-ready");
  if (isFirstPaint) {
    indicator.classList.add("is-instant");
  }

  rail.style.setProperty("--section-indicator-x", `${offsetX}px`);
  rail.style.setProperty("--section-indicator-y", `${offsetY}px`);
  rail.classList.add("roadmap-modal-section-rail--indicator-ready");

  if (isFirstPaint) {
    requestAnimationFrame(() => indicator.classList.remove("is-instant"));
  }
}

function ensureRoadmapModalSectionNavIndicatorObserver(modal) {
  const rail = modal?.querySelector(".roadmap-modal-section-rail");
  if (!rail || rail.dataset.indicatorObserverReady === "1") return;
  rail.dataset.indicatorObserverReady = "1";
  if (roadmapModalSectionNavResizeObserver) {
    roadmapModalSectionNavResizeObserver.disconnect();
  }
  roadmapModalSectionNavResizeObserver = new ResizeObserver(() => {
    syncRoadmapModalSectionActiveIndicator(modal);
  });
  roadmapModalSectionNavResizeObserver.observe(rail);
  rail.querySelectorAll(".roadmap-modal-section-btn").forEach((btn) => {
    roadmapModalSectionNavResizeObserver.observe(btn);
  });
}

function scheduleRoadmapModalSectionNavSync() {
  if (roadmapModalSectionNavSyncFrame != null) {
    cancelAnimationFrame(roadmapModalSectionNavSyncFrame);
  }
  roadmapModalSectionNavSyncFrame = requestAnimationFrame(() => {
    roadmapModalSectionNavSyncFrame = null;
    syncRoadmapOptionalDisclosures({ resetCollapsed: false });
  });
}

function initRoadmapModalSectionNav() {
  const modal = document.getElementById("roadmapModal");
  if (!modal || modal.dataset.sectionNavReady === "1") return;
  modal.dataset.sectionNavReady = "1";
  const scrollRoot =
    modal.querySelector("#roadmapModalScrollRegion") || modal.querySelector(".roadmap-modal-scroll") || modal.querySelector(".modal-body");

  ensureRoadmapModalSectionNavIndicatorObserver(modal);

  modal.querySelectorAll(".roadmap-modal-section-btn[data-scroll-target]").forEach((btn) => {
    ensureRoadmapModalSectionStatusBadge(btn);
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-scroll-target");
      const el = id ? document.getElementById(id) : null;
      if (el) {
        expandOptionalRoadmapSection(el);
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      setRoadmapModalActiveSection(modal, id, { userInitiated: true });
    });
  });

  if (!scrollRoot) return;
  const sectionEls = ROADMAP_MODAL_SECTION_NAV_IDS.map((id) => document.getElementById(id)).filter(Boolean);
  if (sectionEls.length === 0) return;

  roadmapModalSectionNavRatioMap = new Map();
  sectionEls.forEach((sec) => roadmapModalSectionNavRatioMap.set(sec.id, 0));

  if (roadmapModalSectionNavObserver) {
    roadmapModalSectionNavObserver.disconnect();
    roadmapModalSectionNavObserver = null;
  }
  roadmapModalSectionNavObserver = new IntersectionObserver(
    (entries) => {
      if (Date.now() < roadmapModalSectionNavLockUntil) return;

      entries.forEach((entry) => {
        roadmapModalSectionNavRatioMap.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
      });

      const activeId = resolveRoadmapModalActiveSectionId(scrollRoot, sectionEls);
      if (!activeId) return;

      const currentActive = modal.querySelector(".roadmap-modal-section-btn.is-active");
      const currentId = currentActive?.getAttribute("data-scroll-target");
      if (currentId === activeId) return;

      setRoadmapModalActiveSection(modal, activeId);
    },
    {
      root: scrollRoot,
      threshold: [0, 0.08, 0.15, 0.25, 0.4, 0.55, 0.7, 0.85, 1],
      rootMargin: "-10% 0px -62% 0px"
    }
  );
  sectionEls.forEach((sec) => roadmapModalSectionNavObserver.observe(sec));
  setRoadmapModalActiveSection(modal, sectionEls[0].id);
}

function resetRoadmapModalSectionNav() {
  const modal = document.getElementById("roadmapModal");
  if (!modal) return;
  const scrollRegion =
    modal.querySelector("#roadmapModalScrollRegion") || modal.querySelector(".roadmap-modal-scroll") || modal.querySelector(".modal-body");
  if (scrollRegion) scrollRegion.scrollTop = 0;
  roadmapModalSectionNavLockUntil = 0;
  roadmapModalSectionNavLockedId = null;
  roadmapModalSectionNavRatioMap = new Map();
  setRoadmapModalActiveSection(modal, ROADMAP_MODAL_SECTION_NAV_IDS[0]);
}

function navigateRoadmapModalToSection(sectionId, { focusSelector } = {}) {
  const modal = document.getElementById("roadmapModal");
  if (!modal || !sectionId) return;
  const section = document.getElementById(sectionId);
  if (!section) return;

  expandOptionalRoadmapSection(section);
  setRoadmapModalActiveSection(modal, sectionId, { userInitiated: true });

  const scrollRoot =
    modal.querySelector("#roadmapModalScrollRegion") ||
    modal.querySelector(".roadmap-modal-scroll") ||
    modal.querySelector(".modal-body");

  if (scrollRoot) {
    const rootRect = scrollRoot.getBoundingClientRect();
    const sectionRect = section.getBoundingClientRect();
    const nextTop = scrollRoot.scrollTop + (sectionRect.top - rootRect.top) - 12;
    scrollRoot.scrollTo({ top: Math.max(0, nextTop), behavior: "smooth" });
  } else {
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (focusSelector) {
    window.setTimeout(() => {
      const focusEl =
        section.querySelector(focusSelector) ||
        modal.querySelector(focusSelector) ||
        document.querySelector(focusSelector);
      if (focusEl && !focusEl.disabled) {
        focusEl.focus({ preventScroll: true });
      }
    }, 420);
  }
}

function openRoadmapModalForKanoScoring(roadmapId) {
  if (!roadmapId) return;
  const scrollOptions = { scrollToSection: "roadmapModalSectionKano" };
  if (isActiveDemoProfile()) {
    openRoadmapModal("view", roadmapId, scrollOptions);
    showToast("Demo profile is read-only. Switch to your own profile to edit KANO scores.");
    return;
  }
  openRoadmapModal("edit", roadmapId, scrollOptions);
}

function ensureRoadmapFormFieldTooltips() {
  const roadmapForm = elements.roadmapForm || $("roadmapForm");
  if (!roadmapForm) return;
  const wraps = roadmapForm.querySelectorAll(".roadmap-field-tooltip-wrap");
  wraps.forEach((wrap) => {
    if (wrap.querySelector(".cell-type-tooltip")) return;
    const control = wrap.querySelector("input, select, textarea");
    const labelEl = wrap.querySelector("label");
    if (!control || !labelEl) return;

    const labelText = (labelEl.textContent || "").replace(/\s+/g, " ").trim();
    const cleanTitle = labelText.replace(/\s*\(optional\)\s*/ig, "").trim() || "Field details";
    const tooltipCopy = ROADMAP_FORM_FIELD_TOOLTIPS[control.id] || null;
    const bodyText = tooltipCopy && tooltipCopy.body
      ? tooltipCopy.body
      : (
        control.tagName === "SELECT"
          ? `Select the value for ${cleanTitle.toLowerCase()} for this roadmap.`
          : `Provide a value for ${cleanTitle.toLowerCase()} for this roadmap.`
      );

    const tooltipEl = document.createElement("div");
    tooltipEl.className = "cell-type-tooltip";

    const titleNode = document.createElement("div");
    titleNode.className = "cell-type-tooltip-title";
    titleNode.textContent = (tooltipCopy && tooltipCopy.title) || cleanTitle;
    tooltipEl.appendChild(titleNode);

    const bodyNode = document.createElement("div");
    bodyNode.className = "cell-type-tooltip-body";
    bodyNode.textContent = bodyText;
    tooltipEl.appendChild(bodyNode);

    wrap.appendChild(tooltipEl);
  });
}

function shouldWrapOptionalRoadmapField(wrap) {
  if (!wrap || wrap.closest(".roadmap-optional-field-details")) return false;
  if (wrap.closest("[data-optional-section]")) return false;
  return wrap.hasAttribute("data-optional-collapsible");
}

function getOptionalFieldSummaryText(labelEl) {
  if (!labelEl) return "Optional field";
  const clone = labelEl.cloneNode(true);
  clone.querySelectorAll(".field-optional-tag").forEach((el) => el.remove());
  return (clone.textContent || "").replace(/\s*\(optional[^)]*\)\s*/gi, "").replace(/\s+/g, " ").trim();
}

function buildOptionalDisclosureSummary(titleText, options = {}) {
  const subtitle = options.subtitle || "";
  const summaryKind = options.kind === "section" ? "section" : "field";

  const summary = document.createElement("summary");
  summary.className =
    summaryKind === "section"
      ? "form-section-header roadmap-optional-section-summary"
      : "roadmap-optional-field-summary";
  summary.dataset.optionalKind = summaryKind;

  const row = document.createElement("div");
  row.className = "roadmap-optional-summary-row";

  const lead = document.createElement("span");
  lead.className = "roadmap-optional-summary-lead";
  lead.setAttribute("aria-hidden", "true");

  const copy = document.createElement("div");
  copy.className = "roadmap-optional-summary-copy";

  const titleSpan = document.createElement("span");
  titleSpan.className =
    summaryKind === "section"
      ? "form-section-title roadmap-optional-section-title"
      : "roadmap-optional-field-summary-title";
  titleSpan.textContent = titleText || "Optional field";
  copy.appendChild(titleSpan);

  if (subtitle) {
    const subtitleSpan = document.createElement("span");
    subtitleSpan.className =
      summaryKind === "section"
        ? "form-section-hint roadmap-optional-section-subtitle"
        : "roadmap-optional-field-summary-subtitle";
    subtitleSpan.textContent = subtitle;
    copy.appendChild(subtitleSpan);
  }

  const statusDot = document.createElement("span");
  statusDot.className = "roadmap-optional-status-dot";
  statusDot.setAttribute("title", "Has data");
  statusDot.setAttribute("aria-hidden", "true");

  const optionalBadge = document.createElement("span");
  optionalBadge.className =
    summaryKind === "section"
      ? "roadmap-optional-badge roadmap-optional-badge--section"
      : "roadmap-optional-badge roadmap-optional-badge--field";
  optionalBadge.textContent = summaryKind === "section" ? "Optional section" : "Optional field";

  const chevron = document.createElement("span");
  chevron.className = "roadmap-optional-summary-chevron";
  chevron.setAttribute("aria-hidden", "true");

  row.appendChild(lead);
  row.appendChild(copy);
  row.appendChild(statusDot);
  row.appendChild(optionalBadge);

  summary.appendChild(row);
  summary.appendChild(chevron);
  summary.setAttribute("aria-label", `Expand ${titleText || "section"}`);
  return summary;
}

function wrapOptionalRoadmapField(wrap) {
  if (!shouldWrapOptionalRoadmapField(wrap)) return;

  const labelEl = wrap.querySelector(":scope > label") || wrap.querySelector("label");
  if (!labelEl) return;

  const titleText = getOptionalFieldSummaryText(labelEl) || "Optional field";
  const hintEl = wrap.querySelector(":scope > .roadmap-dynamic-field-hint");
  const subtitle = hintEl ? hintEl.textContent.trim() : "";

  const details = document.createElement("details");
  details.className = "roadmap-optional-disclosure roadmap-optional-field-details";
  details.dataset.optionalKind = "field";

  const summary = buildOptionalDisclosureSummary(titleText, {
    kind: "field",
    subtitle: subtitle.length > 72 ? `${subtitle.slice(0, 69)}…` : subtitle
  });

  const body = document.createElement("div");
  body.className = "roadmap-optional-field-body";

  Array.from(wrap.childNodes).forEach((child) => {
    if (child === labelEl) return;
    body.appendChild(child);
  });

  labelEl.remove();
  details.appendChild(summary);
  details.appendChild(body);
  wrap.appendChild(details);
  wrap.classList.add("roadmap-optional-field-wrap");
}

function wrapOptionalRoadmapSections() {
  document.querySelectorAll("#roadmapForm [data-optional-section]").forEach((section) => {
    if (section.dataset.optionalSectionWrapped === "1") return;

    const header = section.querySelector(":scope > .form-section-header");
    if (!header) return;

    const contentNodes = [];
    let node = header.nextElementSibling;
    while (node) {
      const next = node.nextElementSibling;
      contentNodes.push(node);
      node = next;
    }
    if (!contentNodes.length) return;

    const titleEl = header.querySelector(".form-section-title");
    const hintEl = header.querySelector(".form-section-hint");
    const titleText = (titleEl?.textContent || "Section").replace(/\s*\(optional\)\s*/i, "").trim();
    const subtitle = (hintEl?.textContent || section.getAttribute("data-optional-subtitle") || "").trim();

    const details = document.createElement("details");
    details.className = "roadmap-optional-disclosure roadmap-optional-section-details";
    details.dataset.optionalSection = section.id || "";
    details.dataset.optionalKind = "section";

    const summary = buildOptionalDisclosureSummary(titleText, {
      kind: "section",
      subtitle
    });

    const body = document.createElement("div");
    body.className = "roadmap-optional-section-body";
    contentNodes.forEach((contentNode) => body.appendChild(contentNode));

    details.appendChild(summary);
    details.appendChild(body);
    header.replaceWith(details);
    section.dataset.optionalSectionWrapped = "1";
    section.classList.add("roadmap-optional-section-host");
  });
}

function ensureRoadmapOptionalDisclosures() {
  const roadmapForm = elements.roadmapForm || $("roadmapForm");
  if (!roadmapForm || roadmapForm.dataset.optionalDisclosuresReady === "1") return;

  try {
    roadmapForm.querySelectorAll("[data-optional-collapsible]").forEach(wrapOptionalRoadmapField);
    wrapOptionalRoadmapSections();
    ensureRoadmapTasksDisclosure();
    ensureRoadmapKanoAxisSelects();
    ensureRoadmapKanoAxisMeters();
    ensureRoadmapKanoLegend();
    ensureRoadmapKanoMatrixMounted();
    roadmapForm.dataset.optionalDisclosuresReady = "1";
  } catch (err) {
    console.error("Optional roadmap disclosures failed to initialize:", err);
  }
}

function roadmapOptionalFieldHasData(wrap) {
  if (!wrap) return false;
  const body = wrap.querySelector(".roadmap-optional-field-body") || wrap;

  const standaloneInputs = body.querySelectorAll(":scope > .form-grid input, :scope > .form-grid select, :scope > .form-grid textarea, :scope > input, :scope > select, :scope > textarea");
  for (const input of standaloneInputs) {
    if (input.type === "hidden") continue;
    if ((input.value || "").trim()) return true;
  }

  const dynamicRows = body.querySelectorAll(
    ".roadmap-label-row, .roadmap-link-row, .roadmap-task-row, .roadmap-raci-row, .country-row"
  );
  for (const row of dynamicRows) {
    const rowInputs = row.querySelectorAll("input, select, textarea");
    for (const input of rowInputs) {
      if ((input.value || "").trim()) return true;
    }
  }

  if (
    body.querySelector(
      ".roadmap-raci-card, .roadmap-raci-readonly-row, .roadmap-task-card, .roadmap-task-readonly-row, .roadmap-label-readonly-row"
    )
  ) {
    return true;
  }

  return false;
}

function roadmapOptionalSectionHasData(sectionId) {
  if (sectionId === "roadmapModalSectionRice") {
    const scalarFields = ["reachValue", "impactValue", "confidenceValue", "effortValue"];
    for (const fieldId of scalarFields) {
      const el = document.getElementById(fieldId);
      if (el && String(el.value || "").trim()) return true;
    }
    const richFields = ["reachDescription", "impactDescription", "confidenceDescription", "effortDescription"];
    for (const fieldId of richFields) {
      if (richDescriptionToPlainText(getRichDescriptionValue(fieldId))) return true;
    }
    return false;
  }
  if (sectionId === "roadmapModalSectionMoscow") {
    return !!(elements.roadmapMoscow && String(elements.roadmapMoscow.value || "").trim());
  }
  if (sectionId === "roadmapModalSectionKano") {
    const { kanoFunctionality, kanoSatisfaction } = getRoadmapKanoFromControls();
    return kanoFunctionality != null && kanoSatisfaction != null;
  }
  if (sectionId === "roadmapModalSectionMeta") {
    const scalarFields = [
      elements.roadmapType,
      elements.roadmapStatus,
      elements.roadmapTshirtSize,
      elements.roadmapPeriod
    ];
    for (const el of scalarFields) {
      if (el && String(el.value || "").trim()) return true;
    }
    const sectionBody =
      document.querySelector("#roadmapModalSectionMeta .roadmap-optional-section-body") ||
      document.getElementById("roadmapModalSectionMeta");
    if (!sectionBody) return false;
    const taskRows = sectionBody.querySelectorAll(".roadmap-task-row");
    for (const row of taskRows) {
      if ((row.querySelector("input")?.value || "").trim()) return true;
    }
    const countryRows = sectionBody.querySelectorAll(".country-row select");
    for (const select of countryRows) {
      if ((select.value || "").trim()) return true;
    }
    if (sectionBody.querySelector(".roadmap-task-card, .roadmap-task-readonly-row")) {
      return true;
    }
    return false;
  }
  if (sectionId === "roadmapModalSectionRaci") {
    const rows = document.querySelectorAll("#roadmapModalSectionRaci .roadmap-raci-row");
    for (const row of rows) {
      const name = (row.querySelector(".roadmap-raci-name-input")?.value || "").trim();
      if (name) return true;
    }
    if (document.querySelector("#roadmapModalSectionRaci .roadmap-raci-card, #roadmapModalSectionRaci .roadmap-raci-readonly-row")) {
      return true;
    }
    return false;
  }
  if (sectionId === "roadmapModalSectionFinancial") {
    const impactVal = elements.financialImpactValue?.value;
    if (impactVal != null && String(impactVal).trim() !== "" && Number(impactVal) !== 0) {
      return true;
    }
    const currency = elements.roadmapCurrency?.value;
    if (currency && String(currency).trim()) return true;
    const framework = normalizeFinancialFramework(
      elements.financialFramework?.value || FINANCIAL_FRAMEWORK_DEFAULT
    );
    const activePanel = document.querySelector(
      `#financialFrameworkFields [data-framework-fields="${framework}"]`
    );
    if (activePanel) {
      const frameworkInputs = activePanel.querySelectorAll("input, select, textarea");
      for (const input of frameworkInputs) {
        if ((input.value || "").trim()) return true;
      }
    }
    return false;
  }
  return false;
}

function normalizeKanoAxisLevel(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 5) return null;
  return n;
}

function getKanoLevelMeta(levels, level) {
  if (!Array.isArray(levels) || level == null) return null;
  return levels.find((item) => item.level === level) || null;
}

function populateRoadmapKanoAxisSelect(selectEl, levels) {
  if (!selectEl || selectEl.dataset.kanoOptionsReady === "1") return;
  if (!Array.isArray(levels)) return;
  selectEl.dataset.kanoOptionsReady = "1";
  levels.forEach((meta) => {
    const opt = document.createElement("option");
    opt.value = String(meta.level);
    opt.textContent = `${meta.level} — ${meta.label}`;
    if (meta.description) opt.title = meta.description;
    selectEl.appendChild(opt);
  });
}

function ensureRoadmapKanoAxisSelects() {
  if (typeof kanoFunctionalityLevels === "undefined" || typeof kanoSatisfactionLevels === "undefined") {
    return;
  }
  populateRoadmapKanoAxisSelect(elements.roadmapKanoFunctionalitySelect, kanoFunctionalityLevels);
  populateRoadmapKanoAxisSelect(elements.roadmapKanoSatisfactionSelect, kanoSatisfactionLevels);

  const bindAxisSelect = (selectEl) => {
    if (!selectEl || selectEl.dataset.kanoBound === "1") return;
    selectEl.dataset.kanoBound = "1";
    selectEl.addEventListener("change", () => {
      if (roadmapModalMode === "view") return;
      const f = normalizeKanoAxisLevel(elements.roadmapKanoFunctionalitySelect?.value);
      const s = normalizeKanoAxisLevel(elements.roadmapKanoSatisfactionSelect?.value);
      if (f == null || s == null) {
        setRoadmapKanoSelection(null, null);
        return;
      }
      setRoadmapKanoSelection(f, s);
    });
  };

  bindAxisSelect(elements.roadmapKanoFunctionalitySelect);
  bindAxisSelect(elements.roadmapKanoSatisfactionSelect);
}

function ensureRoadmapKanoAxisMeters() {
  const buildMeter = (container, levels) => {
    if (!container || container.dataset.kanoMeterReady === "1" || !Array.isArray(levels)) return;
    container.dataset.kanoMeterReady = "1";
    container.innerHTML = "";
    levels.forEach((meta) => {
      const dot = document.createElement("span");
      dot.className = "roadmap-kano-axis-meter__dot";
      dot.dataset.level = String(meta.level);
      dot.title = meta.description || meta.label;
      container.appendChild(dot);
    });
  };
  if (typeof kanoFunctionalityLevels !== "undefined") {
    buildMeter(elements.roadmapKanoFunctionalityMeter, kanoFunctionalityLevels);
  }
  if (typeof kanoSatisfactionLevels !== "undefined") {
    buildMeter(elements.roadmapKanoSatisfactionMeter, kanoSatisfactionLevels);
  }
}

function syncRoadmapKanoAxisMeters(functionality, satisfaction) {
  const f = normalizeKanoAxisLevel(functionality);
  const s = normalizeKanoAxisLevel(satisfaction);
  const syncOne = (container, level) => {
    if (!container) return;
    container.querySelectorAll(".roadmap-kano-axis-meter__dot").forEach((dot) => {
      const dotLevel = Number(dot.dataset.level);
      dot.classList.toggle("is-active", level != null && dotLevel === level);
      dot.classList.toggle("is-dimmed", level != null && dotLevel !== level);
    });
  };
  syncOne(elements.roadmapKanoFunctionalityMeter, f);
  syncOne(elements.roadmapKanoSatisfactionMeter, s);
}

function ensureRoadmapKanoLegend() {
  const legend = elements.roadmapKanoLegend || $("roadmapKanoLegend");
  if (!legend || legend.dataset.kanoLegendReady === "5") return;
  if (typeof kanoCategoryLegend === "undefined" || !Array.isArray(kanoCategoryLegend)) return;
  legend.dataset.kanoLegendReady = "5";
  legend.innerHTML = "";

  const detailHost = elements.roadmapKanoLegendDetail || $("roadmapKanoLegendDetail");
  if (detailHost) {
    detailHost.hidden = true;
    detailHost.className = "roadmap-kano-legend-detail";
    detailHost.innerHTML = "";
  }

  kanoCategoryLegend.forEach((entry) => {
    const item = document.createElement("div");
    item.className = `roadmap-kano-legend__item roadmap-kano-legend__item--${entry.id}`;
    item.dataset.kanoZone = entry.id;
    item.dataset.kanoDetail = entry.detail || entry.description || "";
    item.setAttribute("role", "button");
    item.tabIndex = 0;
    item.setAttribute("aria-expanded", "false");
    item.setAttribute(
      "aria-label",
      `${entry.label}${entry.hint ? ` (${entry.hint})` : ""}. Tap to read more.`
    );
    const swatchWrap = document.createElement("span");
    swatchWrap.className = "roadmap-kano-legend__swatch-wrap";
    const swatch = document.createElement("span");
    swatch.className = "roadmap-kano-legend__swatch";
    swatch.setAttribute("aria-hidden", "true");
    swatchWrap.appendChild(swatch);
    const copy = document.createElement("span");
    copy.className = "roadmap-kano-legend__copy";
    const label = document.createElement("span");
    label.className = "roadmap-kano-legend__label";
    label.textContent = entry.label;
    const hint = document.createElement("span");
    hint.className = "roadmap-kano-legend__hint";
    hint.textContent = entry.hint || "";
    const compact = document.createElement("span");
    compact.className = "roadmap-kano-legend__compact";
    compact.textContent = entry.compactLabel || entry.hint || entry.label;
    const chevron = document.createElement("span");
    chevron.className = "roadmap-kano-legend__chevron";
    chevron.setAttribute("aria-hidden", "true");
    copy.appendChild(label);
    if (entry.hint) copy.appendChild(hint);
    copy.appendChild(compact);
    item.appendChild(swatchWrap);
    item.appendChild(copy);
    item.appendChild(chevron);
    legend.appendChild(item);
  });

  if (legend.dataset.kanoLegendBound !== "1") {
    legend.dataset.kanoLegendBound = "1";
    legend.addEventListener("click", (event) => {
      const item = event.target.closest(".roadmap-kano-legend__item");
      if (!item || !legend.contains(item)) return;
      toggleRoadmapKanoLegendDetail(item.dataset.kanoZone);
    });
    legend.addEventListener("keydown", (event) => {
      const item = event.target.closest(".roadmap-kano-legend__item");
      if (!item || !legend.contains(item)) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleRoadmapKanoLegendDetail(item.dataset.kanoZone);
      }
    });
  }
}

function toggleRoadmapKanoLegendDetail(zoneId) {
  const legend = elements.roadmapKanoLegend || $("roadmapKanoLegend");
  const detailHost = elements.roadmapKanoLegendDetail || $("roadmapKanoLegendDetail");
  if (!legend || !detailHost || !zoneId) return;

  const item = legend.querySelector(`.roadmap-kano-legend__item[data-kano-zone="${zoneId}"]`);
  if (!item) return;

  const isOpen = item.classList.contains("is-expanded");
  legend.querySelectorAll(".roadmap-kano-legend__item").forEach((pill) => {
    pill.classList.remove("is-expanded");
    pill.setAttribute("aria-expanded", "false");
  });

  if (isOpen) {
    detailHost.hidden = true;
    detailHost.classList.remove("is-visible");
    detailHost.innerHTML = "";
    return;
  }

  const entry = kanoCategoryLegend.find((row) => row.id === zoneId);
  item.classList.add("is-expanded");
  item.setAttribute("aria-expanded", "true");

  const title = entry ? entry.label : zoneId;
  const hint = entry && entry.hint ? entry.hint : "";
  const body = entry ? entry.detail || entry.description || "" : item.dataset.kanoDetail || "";

  detailHost.innerHTML = "";
  detailHost.className = `roadmap-kano-legend-detail roadmap-kano-legend-detail--${zoneId}`;

  const inner = document.createElement("div");
  inner.className = "roadmap-kano-legend-detail__inner";

  const header = document.createElement("div");
  header.className = "roadmap-kano-legend-detail__header";
  const swatch = document.createElement("span");
  swatch.className = "roadmap-kano-legend-detail__swatch";
  swatch.setAttribute("aria-hidden", "true");
  const heading = document.createElement("div");
  heading.className = "roadmap-kano-legend-detail__heading";
  const titleEl = document.createElement("span");
  titleEl.className = "roadmap-kano-legend-detail__title";
  titleEl.textContent = title;
  heading.appendChild(titleEl);
  if (hint) {
    const hintEl = document.createElement("span");
    hintEl.className = "roadmap-kano-legend-detail__hint";
    hintEl.textContent = hint;
    heading.appendChild(hintEl);
  }
  header.appendChild(swatch);
  header.appendChild(heading);

  const text = document.createElement("p");
  text.className = "roadmap-kano-legend-detail__text";
  text.textContent = body;

  inner.appendChild(header);
  inner.appendChild(text);
  detailHost.appendChild(inner);
  detailHost.hidden = false;
  requestAnimationFrame(() => {
    detailHost.classList.add("is-visible");
  });
}

function syncRoadmapKanoLegendHighlight(functionality, satisfaction, { hoverZone = null } = {}) {
  const legend = elements.roadmapKanoLegend || $("roadmapKanoLegend");
  if (!legend) return;
  const f = normalizeKanoAxisLevel(functionality);
  const s = normalizeKanoAxisLevel(satisfaction);
  const activeZone =
    hoverZone ||
    (f != null && s != null && typeof getKanoCategoryFromPosition === "function"
      ? getKanoCategoryFromPosition(f, s)?.id
      : null);
  legend.querySelectorAll(".roadmap-kano-legend__item").forEach((item) => {
    const zone = item.dataset.kanoZone;
    item.classList.toggle("is-active", !!activeZone && zone === activeZone);
  });
}

function getKanoCellZoneId(functionality, satisfaction) {
  if (typeof getKanoCategoryFromPosition !== "function") return "indifferent";
  const category = getKanoCategoryFromPosition(functionality, satisfaction);
  return category && category.id ? category.id : "indifferent";
}

function syncRoadmapKanoMatrixCrosshair(functionality, satisfaction, { hover = false } = {}) {
  const host = elements.roadmapKanoMatrix || $("roadmapKanoMatrix");
  if (!host) return;
  const f = normalizeKanoAxisLevel(functionality);
  const s = normalizeKanoAxisLevel(satisfaction);
  host.querySelectorAll(".roadmap-kano-matrix-cell").forEach((cell) => {
    const cellF = Number(cell.dataset.functionality);
    const cellS = Number(cell.dataset.satisfaction);
    const inRow = f != null && cellS === s;
    const inCol = s != null && cellF === f;
    cell.classList.toggle("is-crosshair-row", inRow);
    cell.classList.toggle("is-crosshair-col", inCol);
    cell.classList.toggle("is-crosshair-hover", hover && (inRow || inCol));
  });
}


function buildRoadmapKanoCellGlyph(zoneId) {
  const entry =
    typeof kanoCategoryLegend !== "undefined"
      ? kanoCategoryLegend.find((row) => row.id === zoneId)
      : null;
  const cat = entry && entry.categoryCode ? entry.categoryCode : "";
  const hint = entry && entry.hintCode ? entry.hintCode : "";

  const glyph = document.createElement("span");
  glyph.className = "roadmap-kano-matrix-cell__glyph";
  glyph.setAttribute("aria-hidden", "true");

  const code = document.createElement("span");
  code.className = "roadmap-kano-matrix-cell__code";

  const catEl = document.createElement("span");
  catEl.className = "roadmap-kano-matrix-cell__code-cat";
  catEl.textContent = cat;

  const sep = document.createElement("span");
  sep.className = "roadmap-kano-matrix-cell__code-sep";
  sep.textContent = "-";
  sep.setAttribute("aria-hidden", "true");

  const hintEl = document.createElement("span");
  hintEl.className = "roadmap-kano-matrix-cell__code-hint";
  hintEl.textContent = hint;

  code.appendChild(catEl);
  code.appendChild(sep);
  code.appendChild(hintEl);
  glyph.appendChild(code);
  return glyph;
}

function getRoadmapKanoCompactCodeLabel(zoneId) {
  const entry =
    typeof kanoCategoryLegend !== "undefined"
      ? kanoCategoryLegend.find((row) => row.id === zoneId)
      : null;
  if (!entry || !entry.categoryCode || !entry.hintCode) return "";
  return `${entry.categoryCode} - ${entry.hintCode}`;
}


function ensureRoadmapKanoMatrixMounted() {
  const host = elements.roadmapKanoMatrix || $("roadmapKanoMatrix");
  if (!host || host.dataset.kanoVersion === "9") return;
  if (typeof kanoFunctionalityLevels === "undefined" || typeof kanoSatisfactionLevels === "undefined") {
    return;
  }

  host.dataset.kanoVersion = "9";
  host.classList.add("roadmap-kano-matrix-host--v9");
  host.innerHTML = "";

  const band = document.createElement("div");
  band.className = "roadmap-kano-matrix-band";
  band.setAttribute("aria-hidden", "true");
  const bandY = document.createElement("span");
  bandY.className = "roadmap-kano-matrix-band__item roadmap-kano-matrix-band__item--y";
  bandY.textContent = "Satisfaction increases upward";
  const bandX = document.createElement("span");
  bandX.className = "roadmap-kano-matrix-band__item roadmap-kano-matrix-band__item--x";
  bandX.textContent = "Functionality increases rightward";
  band.appendChild(bandY);
  band.appendChild(bandX);
  host.appendChild(band);

  const wrap = document.createElement("div");
  wrap.className = "roadmap-kano-matrix-wrap";

  const corner = document.createElement("div");
  corner.className = "roadmap-kano-matrix-corner";
  corner.setAttribute("aria-hidden", "true");
  const yTitle = document.createElement("span");
  yTitle.className = "roadmap-kano-axis-title roadmap-kano-axis-title--y";
  yTitle.innerHTML =
    '<span class="roadmap-kano-axis-title__full">Satisfaction</span><span class="roadmap-kano-axis-title__micro">Sat</span>';
  corner.appendChild(yTitle);
  wrap.appendChild(corner);

  const appendAxisLabel = (axis, level, meta) => {
    const label = document.createElement("span");
    label.className = `roadmap-kano-axis-label roadmap-kano-axis-label--${axis}`;
    label.dataset.level = String(level);
    const full = document.createElement("span");
    full.className = "roadmap-kano-axis-label__full";
    full.textContent = meta ? meta.shortLabel : String(level);
    const micro = document.createElement("span");
    micro.className = "roadmap-kano-axis-label__micro";
    micro.textContent = String(level);
    micro.setAttribute("aria-hidden", "true");
    label.appendChild(full);
    label.appendChild(micro);
    if (meta && meta.description) label.title = `${meta.label || meta.shortLabel}: ${meta.description}`;
    else if (meta) label.title = meta.label || meta.shortLabel;
    wrap.appendChild(label);
  };

  for (let s = 5; s >= 1; s -= 1) {
    appendAxisLabel("y", s, getKanoLevelMeta(kanoSatisfactionLevels, s));
  }

  const grid = document.createElement("div");
  grid.className = "roadmap-kano-matrix-grid";
  grid.setAttribute("role", "grid");
  grid.setAttribute("aria-label", "KANO functionality and satisfaction matrix");
  grid.tabIndex = 0;

  for (let s = 5; s >= 1; s -= 1) {
    for (let f = 1; f <= 5; f += 1) {
      const fMeta = getKanoLevelMeta(kanoFunctionalityLevels, f);
      const sMeta = getKanoLevelMeta(kanoSatisfactionLevels, s);
      const zoneId = getKanoCellZoneId(f, s);
      const category =
        typeof getKanoCategoryFromPosition === "function" ? getKanoCategoryFromPosition(f, s) : null;
      const compactCode = getRoadmapKanoCompactCodeLabel(zoneId);

      const cell = document.createElement("div");
      cell.className = `roadmap-kano-matrix-cell roadmap-kano-matrix-cell--zone-${zoneId}`;
      cell.dataset.functionality = String(f);
      cell.dataset.satisfaction = String(s);
      cell.dataset.kanoZone = zoneId;
      cell.style.gridColumn = String(f + 1);
      cell.style.gridRow = String(7 - s);
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("tabindex", "-1");
      cell.setAttribute("aria-selected", "false");
      cell.setAttribute(
        "aria-label",
        `Functionality ${f}${fMeta ? `: ${fMeta.label}` : ""}, Satisfaction ${s}${sMeta ? `: ${sMeta.label}` : ""}${category ? `, ${category.label}` : ""}${compactCode ? ` (${compactCode})` : ""}`
      );

      const zoneTag = document.createElement("span");
      zoneTag.className = "roadmap-kano-matrix-cell__zone-tag";
      if (category && typeof kanoCategoryLegend !== "undefined") {
        const legendEntry = kanoCategoryLegend.find((entry) => entry.id === category.id);
        zoneTag.textContent = legendEntry && legendEntry.hint ? legendEntry.hint : category.label;
      }
      cell.appendChild(zoneTag);

      cell.appendChild(buildRoadmapKanoCellGlyph(zoneId));

      const coords = document.createElement("span");
      coords.className = "roadmap-kano-matrix-cell__coords";
      coords.textContent = `${fMeta ? fMeta.shortLabel : f} · ${sMeta ? sMeta.shortLabel : s}`;
      cell.appendChild(coords);

      const marker = document.createElement("span");
      marker.className = "roadmap-kano-matrix-cell__marker";
      marker.setAttribute("aria-hidden", "true");
      cell.appendChild(marker);

      const tip = document.createElement("span");
      tip.className = "roadmap-kano-matrix-cell__tip";
      tip.textContent = category ? category.label : "";
      cell.appendChild(tip);

      const activateCell = () => {
        if (roadmapModalMode === "view") return;
        setRoadmapKanoSelection(f, s);
      };

      cell.addEventListener("click", activateCell);
      cell.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activateCell();
        }
      });
      cell.addEventListener("mouseenter", () => {
        syncRoadmapKanoMatrixCrosshair(f, s, { hover: true });
        syncRoadmapKanoAxisLabelHighlight(f, s);
        syncRoadmapKanoAxisMeters(f, s);
        syncRoadmapKanoLegendHighlight(f, s, { hoverZone: zoneId });
        cell.classList.add("is-preview");
      });
      cell.addEventListener("mouseleave", () => {
        const current = getRoadmapKanoFromControls();
        syncRoadmapKanoMatrixCrosshair(current.kanoFunctionality, current.kanoSatisfaction);
        syncRoadmapKanoAxisLabelHighlight(current.kanoFunctionality, current.kanoSatisfaction);
        syncRoadmapKanoAxisMeters(current.kanoFunctionality, current.kanoSatisfaction);
        syncRoadmapKanoLegendHighlight(current.kanoFunctionality, current.kanoSatisfaction);
        cell.classList.remove("is-preview");
      });
      cell.addEventListener("focus", () => {
        syncRoadmapKanoMatrixCrosshair(f, s, { hover: true });
        syncRoadmapKanoAxisLabelHighlight(f, s);
        syncRoadmapKanoAxisMeters(f, s);
        syncRoadmapKanoLegendHighlight(f, s, { hoverZone: zoneId });
      });
      cell.addEventListener("blur", () => {
        const current = getRoadmapKanoFromControls();
        syncRoadmapKanoMatrixCrosshair(current.kanoFunctionality, current.kanoSatisfaction);
        syncRoadmapKanoAxisLabelHighlight(current.kanoFunctionality, current.kanoSatisfaction);
        syncRoadmapKanoAxisMeters(current.kanoFunctionality, current.kanoSatisfaction);
        syncRoadmapKanoLegendHighlight(current.kanoFunctionality, current.kanoSatisfaction);
      });

      grid.appendChild(cell);
    }
  }

  grid.addEventListener("keydown", (event) => {
    if (roadmapModalMode === "view") return;
    const current = getRoadmapKanoFromControls();
    let f = current.kanoFunctionality != null ? current.kanoFunctionality : 3;
    let s = current.kanoSatisfaction != null ? current.kanoSatisfaction : 3;
    let handled = true;
    if (event.key === "ArrowRight") f = Math.min(5, f + 1);
    else if (event.key === "ArrowLeft") f = Math.max(1, f - 1);
    else if (event.key === "ArrowUp") s = Math.min(5, s + 1);
    else if (event.key === "ArrowDown") s = Math.max(1, s - 1);
    else if (event.key === "Enter" || event.key === " ") {
      setRoadmapKanoSelection(f, s);
      event.preventDefault();
      return;
    } else if (event.key === "Escape") {
      grid.blur();
      return;
    } else {
      handled = false;
    }
    if (!handled) return;
    event.preventDefault();
    setRoadmapKanoSelection(f, s);
    const target = grid.querySelector(
      `.roadmap-kano-matrix-cell[data-functionality="${f}"][data-satisfaction="${s}"]`
    );
    if (target) target.focus();
  });

  for (let f = 1; f <= 5; f += 1) {
    appendAxisLabel("x", f, getKanoLevelMeta(kanoFunctionalityLevels, f));
  }

  const xTitle = document.createElement("span");
  xTitle.className = "roadmap-kano-axis-title roadmap-kano-axis-title--x";
  xTitle.innerHTML =
    '<span class="roadmap-kano-axis-title__full">Functionality</span><span class="roadmap-kano-axis-title__micro">Func</span>';
  wrap.appendChild(xTitle);

  wrap.appendChild(grid);
  host.appendChild(wrap);

  if (elements.roadmapKanoClearBtn && elements.roadmapKanoClearBtn.dataset.kanoBound !== "1") {
    elements.roadmapKanoClearBtn.dataset.kanoBound = "1";
    elements.roadmapKanoClearBtn.addEventListener("click", () => {
      if (roadmapModalMode === "view") return;
      setRoadmapKanoSelection(null, null);
      if (elements.roadmapKanoFunctionalitySelect) elements.roadmapKanoFunctionalitySelect.focus();
    });
  }
}

function syncRoadmapKanoAxisLabelHighlight(functionality, satisfaction) {
  const host = elements.roadmapKanoMatrix || $("roadmapKanoMatrix");
  if (!host) return;
  const f = normalizeKanoAxisLevel(functionality);
  const s = normalizeKanoAxisLevel(satisfaction);
  host.querySelectorAll(".roadmap-kano-axis-label").forEach((label) => {
    const level = Number(label.dataset.level);
    const axis = label.classList.contains("roadmap-kano-axis-label--x") ? "x" : "y";
    const active = axis === "x" ? f != null && level === f : s != null && level === s;
    label.classList.toggle("is-active", active);
  });
}

function renderRoadmapKanoResultMetrics(functionality, satisfaction) {
  const f = normalizeKanoAxisLevel(functionality);
  const s = normalizeKanoAxisLevel(satisfaction);
  const fMeta = getKanoLevelMeta(kanoFunctionalityLevels, f);
  const sMeta = getKanoLevelMeta(kanoSatisfactionLevels, s);
  const fShort = fMeta?.shortLabel || fMeta?.label || `L${f}`;
  const sShort = sMeta?.shortLabel || sMeta?.label || `L${s}`;
  const fLong = fMeta?.label || `Level ${f}`;
  const sLong = sMeta?.label || `Level ${s}`;

  return `<span class="roadmap-kano-result__chip" title="Functionality: ${fLong}">
      <span class="roadmap-kano-result__chip-kicker" aria-hidden="true">F</span>
      <span class="roadmap-kano-result__chip-body">
        <span class="roadmap-kano-result__chip-level">${f}</span>
        <span class="roadmap-kano-result__chip-value"><span class="roadmap-kano-result__chip-num">${f}</span><span class="roadmap-kano-result__chip-sep" aria-hidden="true">·</span><span class="roadmap-kano-result__chip-label">${fShort}</span></span>
        <span class="roadmap-kano-result__chip-caption">${fShort}</span>
      </span>
    </span><span class="roadmap-kano-result__chip" title="Satisfaction: ${sLong}">
      <span class="roadmap-kano-result__chip-kicker" aria-hidden="true">S</span>
      <span class="roadmap-kano-result__chip-body">
        <span class="roadmap-kano-result__chip-level">${s}</span>
        <span class="roadmap-kano-result__chip-value"><span class="roadmap-kano-result__chip-num">${s}</span><span class="roadmap-kano-result__chip-sep" aria-hidden="true">·</span><span class="roadmap-kano-result__chip-label">${sShort}</span></span>
        <span class="roadmap-kano-result__chip-caption">${sShort}</span>
      </span>
    </span>`;
}

function syncRoadmapKanoSummary(functionality, satisfaction) {
  const summaryEl = elements.roadmapKanoSelectionSummary || $("roadmapKanoSelectionSummary");
  const categoryEl = elements.roadmapKanoCategoryBadge || $("roadmapKanoCategoryBadge");
  const resultEl = elements.roadmapKanoResult || $("roadmapKanoResult");
  const clearBtn = elements.roadmapKanoClearBtn || $("roadmapKanoClearBtn");
  if (!summaryEl) return;

  const f = normalizeKanoAxisLevel(functionality);
  const s = normalizeKanoAxisLevel(satisfaction);
  const hasSelection = f != null && s != null;

  if (resultEl) {
    resultEl.classList.toggle("roadmap-kano-result--empty", !hasSelection);
    resultEl.classList.toggle("roadmap-kano-result--filled", hasSelection);
  }

  if (!hasSelection) {
    summaryEl.textContent = "No position selected";
    summaryEl.title = "Choose axis levels or pick a cell on the matrix.";
    if (categoryEl) {
      categoryEl.hidden = true;
      categoryEl.textContent = "";
      categoryEl.className = "roadmap-kano-category-badge";
    }
    if (clearBtn) clearBtn.hidden = true;
    return;
  }

  const fMeta = getKanoLevelMeta(kanoFunctionalityLevels, f);
  const sMeta = getKanoLevelMeta(kanoSatisfactionLevels, s);
  summaryEl.innerHTML = renderRoadmapKanoResultMetrics(f, s);
  summaryEl.title = `Functionality ${f} (${fMeta ? fMeta.label : "Level " + f}), Satisfaction ${s} (${sMeta ? sMeta.label : "Level " + s})`;

  if (categoryEl && typeof getKanoCategoryFromPosition === "function") {
    const category = getKanoCategoryFromPosition(f, s);
    if (category) {
      categoryEl.hidden = false;
      categoryEl.textContent = category.label;
      categoryEl.title = "Tap the matching category above to read the full analysis.";
      categoryEl.className = `roadmap-kano-category-badge roadmap-kano-category-badge--${category.id}`;
    } else {
      categoryEl.hidden = true;
      categoryEl.textContent = "";
      categoryEl.className = "roadmap-kano-category-badge";
    }
  }

  if (clearBtn) {
    clearBtn.hidden = roadmapModalMode === "view";
  }
}

function setRoadmapKanoSelection(functionality, satisfaction, { readonly = false } = {}) {
  ensureRoadmapKanoAxisSelects();
  ensureRoadmapKanoMatrixMounted();
  const f = normalizeKanoAxisLevel(functionality);
  const s = normalizeKanoAxisLevel(satisfaction);

  if (elements.roadmapKanoFunctionalitySelect) {
    elements.roadmapKanoFunctionalitySelect.value = f != null ? String(f) : "";
  }
  if (elements.roadmapKanoSatisfactionSelect) {
    elements.roadmapKanoSatisfactionSelect.value = s != null ? String(s) : "";
  }

  const host = elements.roadmapKanoMatrix || $("roadmapKanoMatrix");
  if (host) {
    host.classList.toggle("roadmap-kano-matrix-host--readonly", !!readonly);
    host.classList.toggle("roadmap-kano-matrix-host--has-selection", f != null && s != null);
    host.querySelectorAll(".roadmap-kano-matrix-cell").forEach((cell) => {
      const cellF = Number(cell.dataset.functionality);
      const cellS = Number(cell.dataset.satisfaction);
      const selected = f != null && s != null && cellF === f && cellS === s;
      cell.classList.toggle("is-selected", selected);
      cell.classList.toggle("is-readonly", !!readonly);
      cell.setAttribute("aria-selected", selected ? "true" : "false");
      cell.setAttribute("aria-disabled", readonly ? "true" : "false");
      cell.tabIndex = readonly ? -1 : selected ? 0 : -1;
    });
    syncRoadmapKanoMatrixCrosshair(f, s);
    syncRoadmapKanoAxisLabelHighlight(f, s);
    syncRoadmapKanoAxisMeters(f, s);
    syncRoadmapKanoLegendHighlight(f, s);
  }

  syncRoadmapKanoSummary(f, s);

  const section = document.getElementById("roadmapModalSectionKano");
  if (section) {
    const details = section.querySelector(".roadmap-optional-section-details");
    if (details) {
      details.classList.toggle("roadmap-optional--has-data", f != null && s != null);
    }
  }
}

function getRoadmapKanoFromControls() {
  const f = elements.roadmapKanoFunctionalitySelect
    ? normalizeKanoAxisLevel(elements.roadmapKanoFunctionalitySelect.value)
    : null;
  const s = elements.roadmapKanoSatisfactionSelect
    ? normalizeKanoAxisLevel(elements.roadmapKanoSatisfactionSelect.value)
    : null;
  return { kanoFunctionality: f, kanoSatisfaction: s };
}

function syncRoadmapOptionalDisclosureState(detailsEl, hasData, resetCollapsed) {
  if (!detailsEl) return;
  if (resetCollapsed) {
    detailsEl.open = !!hasData;
  }
  detailsEl.classList.toggle("roadmap-optional--has-data", !!hasData);
  syncRoadmapOptionalDisclosureAria(detailsEl);
}

function syncRoadmapOptionalDisclosureAria(detailsEl) {
  if (!detailsEl) return;
  const summary = detailsEl.querySelector("summary");
  if (!summary) return;
  const titleEl = summary.querySelector(
    ".roadmap-optional-field-summary-title, .roadmap-optional-section-title, .form-section-title"
  );
  const name = titleEl ? titleEl.textContent.trim() : "section";
  summary.setAttribute("aria-expanded", detailsEl.open ? "true" : "false");
  summary.setAttribute("aria-label", detailsEl.open ? `Collapse ${name}` : `Expand ${name}`);
}

function expandOptionalRoadmapSection(sectionEl) {
  if (!sectionEl) return;
  const details = sectionEl.querySelector(":scope > .roadmap-optional-section-details");
  if (details) {
    details.open = true;
    syncRoadmapOptionalDisclosureAria(details);
  }
}

function forceRoadmapModalSectionOpen(sectionId) {
  if (!sectionId) return;
  expandOptionalRoadmapSection(document.getElementById(sectionId));
}

function syncRoadmapOptionalDisclosures({ resetCollapsed = false, forceOpenSectionIds = [] } = {}) {
  const roadmapForm = elements.roadmapForm || $("roadmapForm");
  if (!roadmapForm) return;
  const forceOpenSet = new Set(forceOpenSectionIds.filter(Boolean));

  roadmapForm.querySelectorAll(".roadmap-optional-field-details").forEach((detailsEl) => {
    const wrap = detailsEl.closest(".roadmap-field-tooltip-wrap");
    syncRoadmapOptionalDisclosureState(detailsEl, roadmapOptionalFieldHasData(wrap), resetCollapsed);
  });

  roadmapForm.querySelectorAll(".roadmap-optional-section-details").forEach((detailsEl) => {
    const sectionId = detailsEl.dataset.optionalSection;
    const forceOpen = sectionId && forceOpenSet.has(sectionId);
    syncRoadmapOptionalDisclosureState(
      detailsEl,
      sectionId ? roadmapOptionalSectionHasData(sectionId) : false,
      resetCollapsed && !forceOpen
    );
    if (forceOpen) {
      detailsEl.open = true;
      syncRoadmapOptionalDisclosureAria(detailsEl);
    }
  });

  syncRoadmapModalSectionNavIndicators();
}

function isLegacyWrongHostname() {
  if (typeof LEGACY_WRONG_HOSTNAMES === "undefined" || !Array.isArray(LEGACY_WRONG_HOSTNAMES)) {
    return false;
  }
  const host = window.location.hostname || "";
  return LEGACY_WRONG_HOSTNAMES.some((h) => h === host);
}

function showWrongHostBanner() {
  const banner = $("wrongHostBanner");
  const link = $("wrongHostBannerLink");
  if (!banner) return true;
  const origin =
    typeof PRODUCTION_APP_ORIGIN !== "undefined" && PRODUCTION_APP_ORIGIN
      ? PRODUCTION_APP_ORIGIN
      : "https://pm-prioritization-tool-six.vercel.app";
  if (link) link.href = origin.replace(/\/$/, "") + "/";
  banner.hidden = false;
  const shell = document.querySelector(".app-shell");
  if (shell) shell.setAttribute("aria-hidden", "true");
  return true;
}

function showDeploymentIssueBanner(boot) {
  const banner = $("deploymentIssueBanner");
  const titleEl = $("deploymentIssueBannerTitle");
  const textEl = $("deploymentIssueBannerText");
  const dismissBtn = $("deploymentIssueBannerDismiss");
  if (!banner || !boot || !boot.apiIssue) return;

  if (boot.apiIssue === "vercel_protection") {
    if (titleEl) {
      titleEl.textContent = "Vercel login is blocking the API";
    }
    if (textEl) {
      textEl.textContent =
        "Deployment Protection returns 401 on /api/config, so MongoDB cannot sync from the browser. " +
        "In Vercel → your roadmap → Deployment Protection → disable Vercel Authentication for Production (or set Standard Protection off).";
    }
  } else if (boot.apiIssue === "html_response") {
    if (titleEl) {
      titleEl.textContent = "Wrong app deployed on this domain";
    }
    if (textEl) {
      const prod =
        typeof PRODUCTION_APP_ORIGIN !== "undefined"
          ? PRODUCTION_APP_ORIGIN
          : "https://pm-prioritization-tool-six.vercel.app";
      textEl.textContent =
        "This site returned HTML for /api/config (often the legacy React app). " +
        "Use the production URL: " + prod;
    }
  } else if (boot.apiIssue === "mongodb_not_configured") {
    if (titleEl) {
      titleEl.textContent = "MongoDB not configured on server";
    }
    if (textEl) {
      textEl.textContent =
        "The API is running but MONGODB_URI is missing in Vercel environment variables. Add it for Production and redeploy.";
    }
  } else {
    if (textEl) {
      textEl.textContent =
        "Could not reach the cloud API. Data is stored in this browser only until the server is fixed.";
    }
  }

  banner.hidden = false;
  if (dismissBtn && !dismissBtn.dataset.bound) {
    dismissBtn.dataset.bound = "1";
    dismissBtn.addEventListener("click", () => {
      banner.hidden = true;
    });
  }
}

function formatStorageSyncTime(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  } catch {
    return "";
  }
}

function refreshUiAfterCloudDataChange() {
  applyDefaultActiveProfileSelection();
  renderProfiles();
  renderRoadmaps();
  updateProfileLockedBanner();
  focusLockedProfileUnlockIfNeeded();
  if (state.roadmapsView === "map" && elements.roadmapsMapContainer) {
    renderRoadmapsMap();
  }
}

function showCloudWorkspaceToast(extra) {
  const count = state.profiles.length;
  if (count === 0) return;
  const status =
    typeof AppStorage !== "undefined" && AppStorage.getStatus
      ? AppStorage.getStatus()
      : null;
  const syncedLabel = formatStorageSyncTime(
    (extra && extra.updatedAt) ||
      (status && status.lastSyncedAt) ||
      null
  );
  let msg = count + " profile" + (count !== 1 ? "s" : "");
  if (syncedLabel) {
    msg += " · synced " + syncedLabel;
  }
  const lockedCount = state.profiles.filter(
    (p) => isProfilePasswordProtected(p) && !isProfileUnlocked(p.id)
  ).length;
  if (lockedCount > 0) {
    msg +=
      ". " +
      lockedCount +
      " locked — unlock to view roadmaps on this device.";
  }
  showStorageStatusToast(msg);
}

let lastStorageStatusToastKey = "";

function showStorageStatusToast(message) {
  if (!message) return;
  showToast(message);
}

function updateStorageStatusUI(status) {
  const mode = status && status.mode ? status.mode : "unknown";
  const sync = status && status.syncStatus ? status.syncStatus : "idle";
  const profileCount = state.profiles.length;
  const syncedLabel = formatStorageSyncTime(
    status && status.lastSyncedAt ? status.lastSyncedAt : null
  );

  let message = null;
  if (mode === "mongodb") {
    if (sync === "syncing") {
      return;
    }
    if (sync === "error") {
      message =
        (status && status.lastError) ||
        "Cloud sync issue — check your connection and try again.";
    } else if (profileCount > 0 && syncedLabel) {
      message =
        profileCount +
        " profile" +
        (profileCount !== 1 ? "s" : "") +
        " · synced " +
        syncedLabel;
    } else if (syncedLabel) {
      message = "Synced " + syncedLabel;
    } else {
      message = "Saved to cloud";
    }
  } else if (mode === "mongodb-pending-auth") {
    message = "Connect cloud storage to sync this workspace.";
  } else if (mode === "local" && sync === "offline") {
    message =
      (status && status.lastError) ||
      "Cloud unavailable — using browser cache on this device.";
  } else if (mode === "local" && window.location.protocol !== "file:") {
    message = "Local browser storage — open the production URL for cloud sync.";
  }

  if (!message) return;

  const toastKey = mode + "|" + sync + "|" + profileCount + "|" + syncedLabel + "|" + message;
  if (toastKey === lastStorageStatusToastKey) return;
  lastStorageStatusToastKey = toastKey;
  showStorageStatusToast(message);
}

function setCloudStorageModalError(msg) {
  const errorEl = $("cloudStorageError");
  if (!errorEl) return;
  if (msg) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
  } else {
    errorEl.textContent = "";
    errorEl.hidden = true;
  }
}

async function refreshCloudStorageDiagnostics() {
  const diagEl = $("cloudStorageDiagnostics");
  if (!diagEl || typeof AppStorage === "undefined" || !AppStorage.getCloudDiagnostics) {
    return;
  }
  diagEl.hidden = false;
  diagEl.textContent = "Checking cloud workspace…";
  try {
    const d = await AppStorage.getCloudDiagnostics();
    const cloud =
      d.cloudProfileCount != null
        ? d.cloudProfileCount + " profile" + (d.cloudProfileCount !== 1 ? "s" : "")
        : d.cloudError
          ? "unreachable"
          : "—";
    const device =
      d.deviceProfileCount +
      " profile" +
      (d.deviceProfileCount !== 1 ? "s" : "") +
      " on this device";
    const modeLabel = d.mode || "unknown";
    let line =
      "Cloud: " + cloud + " · Device: " + device + " · Storage: " + modeLabel;
    if (d.cloudUpdatedAt) {
      line += " · Cloud updated " + formatStorageSyncTime(d.cloudUpdatedAt);
    }
    if (d.hostname && d.hostname.indexOf("pm-prioritization-tool-six") < 0) {
      line += " · Warning: not on production URL";
    }
    diagEl.textContent = line;
    if (
      d.cloudProfileCount != null &&
      d.cloudProfileCount > d.deviceProfileCount
    ) {
      diagEl.classList.add("cloud-storage-diagnostics--warn");
    } else {
      diagEl.classList.remove("cloud-storage-diagnostics--warn");
    }
  } catch (err) {
    diagEl.textContent = err && err.message ? err.message : "Could not read diagnostics.";
  }
}

function openCloudStorageModal() {
  const modal = elements.cloudStorageModal || $("cloudStorageModal");
  const input = $("cloudStorageApiKeyInput");
  if (!modal || !input) return;
  activateBlockingModal(modal, "cloudStorage");
  input.value =
    typeof AppStorage !== "undefined" && AppStorage.getApiSecret
      ? AppStorage.getApiSecret()
      : "";
  setCloudStorageModalError("");
  refreshCloudStorageDiagnostics();
  input.focus();
}

function closeCloudStorageModal({ immediate = false } = {}) {
  const modal = elements.cloudStorageModal || $("cloudStorageModal");
  if (!modal) return;
  deactivateBlockingModal(modal, { immediate });
  setCloudStorageModalError("");
}

function initCloudStorageModal() {
  const modal = elements.cloudStorageModal || $("cloudStorageModal");
  const cancelBtn = $("cloudStorageCancelBtn");
  const submitBtn = $("cloudStorageSubmitBtn");
  const input = $("cloudStorageApiKeyInput");
  if (!modal || !submitBtn || !input) return;

  if (cancelBtn) cancelBtn.addEventListener("click", () => closeCloudStorageModal());

  const pullBtn = $("cloudStoragePullBtn");
  const pushBtn = $("cloudStoragePushBtn");
  if (pullBtn) {
    pullBtn.addEventListener("click", async () => {
      if (typeof AppStorage === "undefined" || !AppStorage.pullFromCloud) return;
      pullBtn.disabled = true;
      setCloudStorageModalError("");
      try {
        const result = await AppStorage.pullFromCloud({ force: true });
        refreshUiAfterCloudDataChange();
        if (result && result.updated) {
          showCloudWorkspaceToast({ source: "pull" });
        } else {
          showToast("Cloud workspace is already up to date on this device.");
        }
        refreshCloudStorageDiagnostics();
      } catch (err) {
        setCloudStorageModalError(err && err.message ? err.message : "Could not pull from cloud.");
      } finally {
        pullBtn.disabled = false;
      }
    });
  }
  if (pushBtn) {
    pushBtn.addEventListener("click", async () => {
      if (typeof AppStorage === "undefined" || !AppStorage.forceSyncNow) return;
      pushBtn.disabled = true;
      setCloudStorageModalError("");
      try {
        await AppStorage.forceSyncNow();
        showToast("Saved this device to cloud.");
        refreshCloudStorageDiagnostics();
      } catch (err) {
        setCloudStorageModalError(err && err.message ? err.message : "Could not save to cloud.");
      } finally {
        pushBtn.disabled = false;
      }
    });
  }

  submitBtn.addEventListener("click", async () => {
    const secret = input.value.trim();
    const status =
      typeof AppStorage !== "undefined" && AppStorage.getStatus
        ? AppStorage.getStatus()
        : null;
    const authRequired =
      status && status.cloudConfig && status.cloudConfig.authRequired === true;
    if (!secret && authRequired) {
      setCloudStorageModalError("Enter the API key from your Vercel environment (PM_API_SECRET).");
      return;
    }
    submitBtn.disabled = true;
    setCloudStorageModalError("");
    try {
      if (typeof AppStorage === "undefined") {
        throw new Error("Storage module is not loaded.");
      }
      await AppStorage.connectWithApiSecret(secret);
      closeCloudStorageModal();
      resetProfileUnlockSession();
      ensureDefaultProfile();
      applyDefaultActiveProfileSelection();
      renderProfiles();
      renderRoadmaps();
      focusLockedProfileUnlockIfNeeded();
      showToast("Connected to cloud storage. Your workspace is now saved in MongoDB.");
    } catch (err) {
      setCloudStorageModalError(err && err.message ? err.message : "Could not connect to cloud storage.");
    } finally {
      submitBtn.disabled = false;
    }
  });
}

async function init() {
  if (isLegacyWrongHostname() && showWrongHostBanner()) {
    return;
  }

  if (typeof ProfileSecurity === "undefined") {
    console.error(
      "ProfileSecurity module not loaded. Profile passwords and lock will not work until src/modules/profile-security.js is available."
    );
  }
  if (typeof RichTextEditor !== "undefined" && RichTextEditor.mountAllFromDom) {
    RichTextEditor.mountAllFromDom();
  }
  cacheElements();
  markPasswordManagerIgnore(document);
  syncFormFieldAccessibleNames(document);
  syncSiteFooterYear();
  ensureRoadmapFormFieldTooltips();
  ensureRoadmapOptionalDisclosures();
  initRoadmapModalSectionNav();
  initCurrencyOptions();
  initFilterCountriesOptions();
  initScrumBoardStatusColumnsOptions();
  syncFormFieldAccessibleNames(document);
  ExchangeRates.init({
    getState: () => state,
    saveState,
    getElements: () => elements,
    onRatesUpdated: () => {
      renderRoadmaps();
      if (state.roadmapsView === "map" && elements.roadmapsMapContainer) renderRoadmapsMap();
    }
  });
  Fullscreen.init({
    getState: () => state,
    getElements: () => elements,
    switchView: switchRoadmapsView,
    syncViewTabs: syncPortfolioViewTabState,
    getViewElement(view) {
      if (view === "table") return elements.roadmapsTableView;
      if (view === "board") return elements.roadmapsBoardView;
      if (view === "moscow") return elements.roadmapsMoscowView;
      if (view === "map") return elements.roadmapsMapView;
      if (view === "raci") return elements.roadmapsRaciView;
      if (view === "kano") return elements.roadmapsKanoView;
      return null;
    },
    onExitFullscreen: refreshWorkspaceAfterFullscreenExit,
    onEnterFullscreen: refreshCompactFullscreenEnter,
  });
  attachEventListeners();
  initCompactLayoutClass();
  initAppHeaderMenu();
  initPortfolioViewTabsOverflow();
  initProfilesPanel();
  initProfilePicker();
  initFilterAutocompletes();
  initSuperAdminToggle();
  initProfileModals();
  initPortfolioWorkspace();
  initCloudStorageModal();
  initBlockingModalGuards();
  registerAppOverlays();

  if (typeof AppStorage !== "undefined") {
    const boot = await AppStorage.bootstrap({
      apply: applyStatePayload,
      serialize: serializeStatePayload,
      getProfileCount: () => state.profiles.length,
      onStatusChange: updateStorageStatusUI,
      onCloudDataRefreshed: (extra) => {
        refreshUiAfterCloudDataChange();
        if (extra && (extra.updated || extra.source === "reconcile" || extra.source === "pull")) {
          showCloudWorkspaceToast(extra);
        }
      }
    });
    if (boot && boot.apiIssue) {
      showDeploymentIssueBanner(boot);
    }
    if (boot && boot.needsAuth && elements.cloudStorageModal) {
      openCloudStorageModal();
    }
  } else {
    applyStatePayload(
      (() => {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          return raw ? JSON.parse(raw) : null;
        } catch {
          return null;
        }
      })()
    );
    updateStorageStatusUI({ mode: "local", syncStatus: "idle" });
  }

  resetProfileUnlockSession();
  if (!ensureDevWorkspaceSeed()) {
    ensureDefaultProfile();
  }
  applyDefaultActiveProfileSelection();
  toggleFinancialFrameworkFields(FINANCIAL_FRAMEWORK_DEFAULT);
  renderProfiles();
  renderRoadmaps();
  focusLockedProfileUnlockIfNeeded();
  if (elements.roadmapsTableView && elements.roadmapsBoardView) {
    switchRoadmapsView(state.roadmapsView);
  }
  ExchangeRates.ensure()
    .then(() => {
      renderRoadmaps();
      if (state.roadmapsView === "map" && elements.roadmapsMapContainer) renderRoadmapsMap();
    })
    .catch(() => {})
    .finally(() => {
      ExchangeRates.updateLabel();
      ExchangeRates.scheduleDailyRefresh();
      syncFormFieldAccessibleNames(document);
    });
}

function syncSiteFooterYear() {
  const yearEl = elements.appSiteFooterYear || $("appSiteFooterYear");
  if (!yearEl) return;
  yearEl.textContent = `\u00A9 ${new Date().getFullYear()}`;
}

function cacheElements() {
  elements.profileList = $("profileList");
  elements.profilesEmptyState = $("profilesEmptyState");
  elements.profilesCountBadge = $("profilesCountBadge");
  elements.profilesCreatePanel = $("profilesCreatePanel");
  elements.profilesSheetTabs = $("profilesSheetTabs");
  elements.profilesSheetTabBrowse = $("profilesSheetTabBrowse");
  elements.profilesSheetTabCreate = $("profilesSheetTabCreate");
  elements.profilesSheetPanelBrowse = $("profilesSheetPanelBrowse");
  elements.profilesSheetPanelCreate = $("profilesSheetPanelCreate");
  elements.profilesPanelSheet = $("profilesPanelSheet");
  elements.profilesSheetCountBadge = $("profilesSheetCountBadge");
  elements.profilesSheetBackdrop = $("profilesSheetBackdrop");
  elements.profilesSheetCloseBtn = $("profilesSheetCloseBtn");
  elements.workspacePanel = $("workspacePanel");
  elements.workspacePortfolioBody = $("workspacePortfolioBody");
  elements.profilePickerBar = $("profilePickerBar");
  elements.profilePicker = $("profilePicker");
  elements.profilePickerInput = $("profilePickerInput");
  elements.profilePickerAvatar = $("profilePickerAvatar");
  elements.profilePickerToggle = $("profilePickerToggle");
  elements.profilePickerDropdown = $("profilePickerDropdown");
  elements.profilePickerListbox = $("profilePickerListbox");
  elements.profilePickerEmpty = $("profilePickerEmpty");
  elements.mobileProfileManageBtn = $("mobileProfileManageBtn");
  elements.profilesSearchInput = $("profilesSearchInput");
  elements.profilesNoResults = $("profilesNoResults");
  elements.portfolioFiltersDrawer = $("portfolioFiltersDrawer");
  elements.portfolioFiltersSummaryActions = $("portfolioFiltersSummaryActions");
  elements.portfolioFabAddRoadmap = $("portfolioFabAddRoadmap");
  elements.portfolioSelectionBar = $("portfolioSelectionBar");
  elements.portfolioSelectionCount = $("portfolioSelectionCount");
  elements.portfolioSelectionDeleteBtn = $("portfolioSelectionDeleteBtn");
  elements.portfolioSelectionClearBtn = $("portfolioSelectionClearBtn");
  elements.addProfileForm = $("addProfileForm");
  elements.newProfileName = $("newProfileName");
  elements.newProfileTeam = $("newProfileTeam");
  elements.newProfilePassword = $("newProfilePassword");
  elements.newProfilePasswordConfirm = $("newProfilePasswordConfirm");

  elements.profileLockedBanner = $("profileLockedBanner");
  elements.profileLockedBannerTitle = $("profileLockedBannerTitle");
  elements.profileLockedBannerText = $("profileLockedBannerText");
  elements.profileLockedUnlockForm = $("profileLockedUnlockForm");
  elements.profileLockedInlinePassword = $("profileLockedInlinePassword");
  elements.profileLockedInlineError = $("profileLockedInlineError");
  elements.filtersShell = document.querySelector(".filters-shell");

  elements.activeProfileTitleText = $("activeProfileTitleText");
  elements.activeProfileSubtitleText = $("activeProfileSubtitleText");
  elements.portfolioCommandAvatar = $("portfolioCommandAvatar");
  elements.portfolioIdentity = $("portfolioIdentity");
  elements.roadmapsHeaderBadges = $("roadmapsHeaderBadges");
  elements.addRoadmapBtn = $("addRoadmapBtn");
  elements.bulkDeleteBtn = $("bulkDeleteBtn");
  elements.bulkDuplicateBtn = $("bulkDuplicateBtn");
  elements.bulkMoveBtn = $("bulkMoveBtn");
  elements.portfolioSelectionDuplicateBtn = $("portfolioSelectionDuplicateBtn");
  elements.portfolioSelectionMoveBtn = $("portfolioSelectionMoveBtn");
  elements.roadmapBulkTransferModal = $("roadmapBulkTransferModal");
  elements.roadmapBulkTransferModalTitle = $("roadmapBulkTransferModalTitle");
  elements.roadmapBulkTransferModalSubtitle = $("roadmapBulkTransferModalSubtitle");
  elements.roadmapBulkTransferCountLabel = $("roadmapBulkTransferCountLabel");
  elements.roadmapBulkTransferHelpText = $("roadmapBulkTransferHelpText");
  elements.roadmapBulkTransferTargetProfile = $("roadmapBulkTransferTargetProfile");
  elements.roadmapBulkTransferCancelBtn = $("roadmapBulkTransferCancelBtn");
  elements.roadmapBulkTransferConfirmBtn = $("roadmapBulkTransferConfirmBtn");

  elements.filterTitle = $("filterTitle");
  elements.filterRoadmapPeriodToggle = $("filterRoadmapPeriodToggle");
  elements.filterRoadmapPeriodSearch = $("filterRoadmapPeriodSearch");
  elements.filterRoadmapPeriodList = $("filterRoadmapPeriodList");
  elements.filterRoadmapPeriodSummary = $("filterRoadmapPeriodSummary");
  elements.filterImpact = $("filterImpact");
  elements.filterEffort = $("filterEffort");
  elements.filterCurrency = $("filterCurrency");
  elements.filterFinancialFramework = $("filterFinancialFramework");
  elements.filterStatus = $("filterStatus");
  elements.filterTshirtSize = $("filterTshirtSize");
  elements.filterMoscow = $("filterMoscow");
  elements.filterLabel = $("filterLabel");
  elements.filterTitleDropdown = $("filterTitleDropdown");
  elements.filterTitleListbox = $("filterTitleListbox");
  elements.filterTitleAutocompleteEmpty = $("filterTitleAutocompleteEmpty");
  elements.filterLabelDropdown = $("filterLabelDropdown");
  elements.filterLabelListbox = $("filterLabelListbox");
  elements.filterLabelAutocompleteEmpty = $("filterLabelAutocompleteEmpty");
  elements.filterLinks = $("filterLinks");
  elements.filterLabels = $("filterLabels");
  elements.superAdminToggleWrap = $("superAdminToggleWrap");
  elements.superAdminModeToggle = $("superAdminModeToggle");
  elements.superAdminToggleDesktopSlot = $("superAdminToggleDesktopSlot");
  elements.superAdminToggleMobileSlot = $("superAdminToggleMobileSlot");
  elements.filterOwnerProfile = $("filterOwnerProfile");
  elements.filterOwnerProfileGroup = $("filterOwnerProfileGroup");
  elements.roadmapOwnerProfileWrap = $("roadmapOwnerProfileWrap");
  elements.roadmapOwnerProfile = $("roadmapOwnerProfile");
  elements.filterRoadmapType = $("filterRoadmapType");

  elements.roadmapsTableBody = $("roadmapsTableBody");
  elements.roadmapsTableCardsList = $("roadmapsTableCardsList");
  elements.roadmapsTableCardsShell = $("roadmapsTableCardsShell");
  elements.selectAllRoadmaps = $("selectAllRoadmaps");
  elements.roadmapsViewTableBtn = $("roadmapsViewTableBtn");
  elements.roadmapsViewBoardBtn = $("roadmapsViewBoardBtn");
  elements.roadmapsViewMoscowBtn = $("roadmapsViewMoscowBtn");
  elements.roadmapsViewMapBtn = $("roadmapsViewMapBtn");
  elements.roadmapsViewRaciBtn = $("roadmapsViewRaciBtn");
  elements.roadmapsViewKanoBtn = $("roadmapsViewKanoBtn");
  elements.portfolioViewTabsMoreBtn = $("portfolioViewTabsMoreBtn");
  elements.portfolioViewTabsMoreMenu = $("portfolioViewTabsMoreMenu");
  elements.roadmapsTableView = $("roadmapsTableView");
  elements.roadmapsBoardView = $("roadmapsBoardView");
  elements.roadmapsMoscowView = $("roadmapsMoscowView");
  elements.roadmapsMapView = $("roadmapsMapView");
  elements.roadmapsRaciView = $("roadmapsRaciView");
  elements.roadmapsRaciMatrixWrap = $("roadmapsRaciMatrixWrap");
  elements.roadmapsRaciMatrixTable = $("roadmapsRaciMatrixTable");
  elements.raciMatrixDomainToggle = document.querySelector(".raci-matrix-domain-toggle__buttons");
  elements.raciMatrixFullscreenBtn = $("raciMatrixFullscreenBtn");
  elements.roadmapsKanoView = $("roadmapsKanoView");
  elements.portfolioKanoPanelToggle = document.querySelector(".portfolio-kano-panel-toggle__buttons");
  elements.portfolioKanoLegend = $("portfolioKanoLegend");
  elements.portfolioKanoMatrix = $("portfolioKanoMatrix");
  elements.portfolioKanoPositionedList = $("portfolioKanoPositionedList");
  elements.portfolioKanoPositionedPanel = $("portfolioKanoPositionedPanel");
  elements.portfolioKanoPositionedEmpty = $("portfolioKanoPositionedEmpty");
  elements.portfolioKanoUnpositionedPanel = $("portfolioKanoUnpositionedPanel");
  elements.portfolioKanoUnpositionedList = $("portfolioKanoUnpositionedList");
  elements.portfolioKanoUnpositionedEmpty = $("portfolioKanoUnpositionedEmpty");
  elements.portfolioKanoFullscreenBtn = $("portfolioKanoFullscreenBtn");
  elements.tableFullscreenBtn = $("tableFullscreenBtn");
  elements.roadmapsMapContainer = $("roadmapsMapContainer");
  elements.roadmapsMapLegend = $("roadmapsMapLegend");
  elements.mapMetricPicker = $("mapMetricPicker");
  elements.mapMetricPickerTrigger = $("mapMetricPickerTrigger");
  elements.mapMetricPickerBadge = $("mapMetricPickerBadge");
  elements.mapMetricPickerLabel = $("mapMetricPickerLabel");
  elements.mapMetricPickerSearch = $("mapMetricPickerSearch");
  elements.mapMetricPickerDropdown = $("mapMetricPickerDropdown");
  elements.mapMetricPickerListbox = $("mapMetricPickerListbox");
  elements.mapMetricPickerEmpty = $("mapMetricPickerEmpty");
  elements.roadmapsMapFullscreenBtn = $("roadmapsMapFullscreenBtn");
  elements.refreshExchangeRatesBtn = $("refreshExchangeRatesBtn");
  elements.exchangeRatesDateLabel = $("exchangeRatesDateLabel");
  elements.tableSortByRiceToggle = $("tableSortByRiceToggle");
  elements.tableSortByRiceLabel = $("tableSortByRiceLabel");
  elements.tableGroupBySelect = $("tableGroupBySelect");
  elements.tableGroupBySummary = $("tableGroupBySummary");
  elements.roadmapsTableGroupBar = $("roadmapsTableGroupBar");
  elements.scrumBoardContainer = $("scrumBoardContainer");
  elements.scrumBoardSortByRiceToggle = $("scrumBoardSortByRiceToggle");
  elements.scrumBoardStatusColumnsToggle = $("scrumBoardStatusColumnsToggle");
  elements.scrumBoardStatusColumnsSummary = $("scrumBoardStatusColumnsSummary");
  elements.scrumBoardStatusColumnsPopup = $("scrumBoardStatusColumnsPopup");
  elements.scrumBoardStatusColumnsList = $("scrumBoardStatusColumnsList");
  elements.scrumBoardStatusColumnsSelectAll = $("scrumBoardStatusColumnsSelectAll");
  elements.scrumBoardFullscreenBtn = $("scrumBoardFullscreenBtn");
  elements.moscowBoardContainer = $("moscowBoardContainer");
  elements.moscowCompactNav = $("moscowCompactNav");
  elements.moscowFullscreenBtn = $("moscowFullscreenBtn");
  elements.moscowSortByRiceToggle = $("moscowSortByRiceToggle");
  elements.moscowSortByRiceLabel = $("moscowSortByRiceLabel");

  elements.roadmapModal = $("roadmapModal");
  elements.roadmapModalTitle = $("roadmapModalTitle");
  elements.roadmapModalSubtitle = $("roadmapModalSubtitle");
  elements.roadmapModalCloseBtn = $("roadmapModalCloseBtn");
  elements.roadmapForm = $("roadmapForm");
  elements.roadmapFormCancelBtn = $("roadmapFormCancelBtn");
  elements.roadmapFormSubmitBtn = $("roadmapFormSubmitBtn");
  elements.roadmapFormError = $("roadmapFormError");

  elements.roadmapTitle = $("roadmapTitle");
  elements.roadmapDescription = $("roadmapDescription");
  elements.reachDescription = $("reachDescription");
  elements.reachValue = $("reachValue");
  elements.impactDescription = $("impactDescription");
  elements.impactValue = $("impactValue");
  elements.confidenceDescription = $("confidenceDescription");
  elements.confidenceValue = $("confidenceValue");
  elements.effortDescription = $("effortDescription");
  elements.effortValue = $("effortValue");
  elements.financialImpactValue = $("financialImpactValue");
  elements.financialFramework = $("financialFramework");
  elements.financialFrameworkFormulaHint = $("financialFrameworkFormulaHint");
  elements.financialFrameworkFields = $("financialFrameworkFields");
  elements.financialCustomNotes = $("financialCustomNotes");
  elements.financialClvCustomers = $("financialClvCustomers");
  elements.financialClvMargin = $("financialClvMargin");
  elements.financialClvRetentionRatePct = $("financialClvRetentionRatePct");
  elements.financialClvDiscountRatePct = $("financialClvDiscountRatePct");
  elements.financialClvAcquisitionCost = $("financialClvAcquisitionCost");
  elements.financialClvBaselineRetentionRatePct = $("financialClvBaselineRetentionRatePct");
  elements.financialClvBreakdown = $("financialClvBreakdown");
  elements.financialClvBreakdownClvNew = $("financialClvBreakdownClvNew");
  elements.financialClvBreakdownNetClvNew = $("financialClvBreakdownNetClvNew");
  elements.financialClvBreakdownNetClvBaseline = $("financialClvBreakdownNetClvBaseline");
  elements.financialClvBreakdownNetClvIncremental = $("financialClvBreakdownNetClvIncremental");
  elements.financialClvBreakdownTotalImpact = $("financialClvBreakdownTotalImpact");
  elements.financialNpsTotalCustomers = $("financialNpsTotalCustomers");
  elements.financialNpsCustomersMoved = $("financialNpsCustomersMoved");
  elements.financialNpsArpa = $("financialNpsArpa");
  elements.financialNpsRetentionPromoterPct = $("financialNpsRetentionPromoterPct");
  elements.financialNpsRetentionSourcePct = $("financialNpsRetentionSourcePct");
  elements.financialNpsContributionMarginPct = $("financialNpsContributionMarginPct");
  elements.financialNpsUpsellPerConverted = $("financialNpsUpsellPerConverted");
  elements.financialNpsReferralPerConverted = $("financialNpsReferralPerConverted");
  elements.financialNpsProgramCost = $("financialNpsProgramCost");
  elements.financialNpsReportedImpactBasis = $("financialNpsReportedImpactBasis");
  elements.financialNpsBreakdown = $("financialNpsBreakdown");
  elements.financialNpsBreakdownWarningRow = $("financialNpsBreakdownWarningRow");
  elements.financialNpsBreakdownWarning = $("financialNpsBreakdownWarning");
  elements.financialNpsBreakdownFormulaRow = $("financialNpsBreakdownFormulaRow");
  elements.financialNpsBreakdownFormula = $("financialNpsBreakdownFormula");
  elements.financialNpsBreakdownRetainedCustomers = $("financialNpsBreakdownRetainedCustomers");
  elements.financialNpsBreakdownRetainedRevenue = $("financialNpsBreakdownRetainedRevenue");
  elements.financialNpsBreakdownRetainedGrossProfit = $("financialNpsBreakdownRetainedGrossProfit");
  elements.financialNpsBreakdownExpansionRevenue = $("financialNpsBreakdownExpansionRevenue");
  elements.financialNpsBreakdownExpansionGrossProfit = $("financialNpsBreakdownExpansionGrossProfit");
  elements.financialNpsBreakdownSubtotalRetentionExpansion = $("financialNpsBreakdownSubtotalRetentionExpansion");
  elements.financialNpsBreakdownReferralRevenue = $("financialNpsBreakdownReferralRevenue");
  elements.financialNpsBreakdownReferralGrossProfit = $("financialNpsBreakdownReferralGrossProfit");
  elements.financialNpsBreakdownGrossProfit = $("financialNpsBreakdownGrossProfit");
  elements.financialNpsBreakdownNetImpact = $("financialNpsBreakdownNetImpact");
  elements.financialRiskProbabilityBeforePct = $("financialRiskProbabilityBeforePct");
  elements.financialRiskProbabilityAfterPct = $("financialRiskProbabilityAfterPct");
  elements.financialRiskLossPerExposure = $("financialRiskLossPerExposure");
  elements.financialRiskExposureUnits = $("financialRiskExposureUnits");
  elements.financialRiskPeriodsPerYear = $("financialRiskPeriodsPerYear");
  elements.financialRiskMitigationCost = $("financialRiskMitigationCost");
  elements.financialRiskBreakdown = $("financialRiskBreakdown");
  elements.financialRiskBreakdownExpectedBefore = $("financialRiskBreakdownExpectedBefore");
  elements.financialRiskBreakdownExpectedAfter = $("financialRiskBreakdownExpectedAfter");
  elements.financialRiskBreakdownExpectedAvoided = $("financialRiskBreakdownExpectedAvoided");
  elements.financialRiskBreakdownAnnualizedAvoided = $("financialRiskBreakdownAnnualizedAvoided");
  elements.financialRiskBreakdownNetValue = $("financialRiskBreakdownNetValue");
  elements.financialHeadcountMinutesSavedPerFtePerDay = $("financialHeadcountMinutesSavedPerFtePerDay");
  elements.financialHeadcountWorkingDaysPerYear = $("financialHeadcountWorkingDaysPerYear");
  elements.financialHeadcountFteCount = $("financialHeadcountFteCount");
  elements.financialHeadcountHoursPerDay = $("financialHeadcountHoursPerDay");
  elements.financialHeadcountUtilizationGainPct = $("financialHeadcountUtilizationGainPct");
  elements.financialHeadcountAnnualCostPerFte = $("financialHeadcountAnnualCostPerFte");
  elements.financialHeadcountBreakdown = $("financialHeadcountBreakdown");
  elements.financialHeadcountBreakdownUtilizationGain = $("financialHeadcountBreakdownUtilizationGain");
  elements.financialHeadcountBreakdownHoursSavedPerFte = $("financialHeadcountBreakdownHoursSavedPerFte");
  elements.financialHeadcountBreakdownTotalHoursSaved = $("financialHeadcountBreakdownTotalHoursSaved");
  elements.financialHeadcountBreakdownAvoidedFtes = $("financialHeadcountBreakdownAvoidedFtes");
  elements.financialHeadcountBreakdownFinancialImpact = $("financialHeadcountBreakdownFinancialImpact");
  elements.financialOperationalCostPerUnitBefore = $("financialOperationalCostPerUnitBefore");
  elements.financialOperationalCostPerUnitAfter = $("financialOperationalCostPerUnitAfter");
  elements.financialOperationalAnnualVolume = $("financialOperationalAnnualVolume");
  elements.financialOperationalCycleTimeBeforeMinutes = $("financialOperationalCycleTimeBeforeMinutes");
  elements.financialOperationalCycleTimeAfterMinutes = $("financialOperationalCycleTimeAfterMinutes");
  elements.financialOperationalLaborCostPerHour = $("financialOperationalLaborCostPerHour");
  elements.financialOperationalAnnualTransactions = $("financialOperationalAnnualTransactions");
  elements.financialOperationalBreakdown = $("financialOperationalBreakdown");
  elements.financialOperationalBreakdownCostPerUnitSavings = $("financialOperationalBreakdownCostPerUnitSavings");
  elements.financialOperationalBreakdownLaborSavings = $("financialOperationalBreakdownLaborSavings");
  elements.financialOperationalBreakdownTotalSavings = $("financialOperationalBreakdownTotalSavings");
  elements.roadmapCurrency = $("roadmapCurrency");
  elements.roadmapType = $("roadmapType");
  elements.roadmapStatus = $("roadmapStatus");
  elements.roadmapTshirtSize = $("roadmapTshirtSize");
  elements.roadmapPeriod = $("roadmapPeriod");
  elements.roadmapMoscow = $("roadmapMoscow");
  elements.roadmapKanoFunctionalitySelect = $("roadmapKanoFunctionalitySelect");
  elements.roadmapKanoSatisfactionSelect = $("roadmapKanoSatisfactionSelect");
  elements.roadmapKanoFunctionalityMeter = $("roadmapKanoFunctionalityMeter");
  elements.roadmapKanoSatisfactionMeter = $("roadmapKanoSatisfactionMeter");
  elements.roadmapKanoMatrix = $("roadmapKanoMatrix");
  elements.roadmapKanoLegend = $("roadmapKanoLegend");
  elements.roadmapKanoLegendDetail = $("roadmapKanoLegendDetail");
  elements.roadmapKanoSelectionSummary = $("roadmapKanoSelectionSummary");
  elements.roadmapKanoCategoryBadge = $("roadmapKanoCategoryBadge");
  elements.roadmapKanoResult = $("roadmapKanoResult");
  elements.roadmapKanoClearBtn = $("roadmapKanoClearBtn");

  elements.roadmapMetaId = $("roadmapMetaId");
  elements.roadmapMetaCreated = $("roadmapMetaCreated");
  elements.roadmapMetaModified = $("roadmapMetaModified");
  elements.roadmapMetaRice = $("roadmapMetaRice");
  elements.roadmapMetaFinancialEur = $("roadmapMetaFinancialEur");
  elements.roadmapMetaExchangeRate = $("roadmapMetaExchangeRate");
  elements.roadmapModalFooterMetaDetails = $("roadmapModalFooterMetaDetails");

  elements.exportDataBtn = $("exportDataBtn");
  elements.importDataBtn = $("importDataBtn");
  elements.importFileInput = $("importFileInput");

  elements.toastContainer = $("toastContainer");
  elements.appSiteFooterYear = $("appSiteFooterYear");

  elements.filtersToggleBtn = $("filtersToggleBtn");
  elements.filtersAdvanced = $("filtersAdvanced");
  elements.filtersActivePill = $("filtersActivePill");
  elements.filtersResetBtn = $("filtersResetBtn");

  elements.countriesContainer = $("countriesContainer");
  elements.addCountryBtn = $("addCountryBtn");
  elements.roadmapLabelsContainer = $("roadmapLabelsContainer");
  elements.addRoadmapLabelBtn = $("addRoadmapLabelBtn");
  elements.roadmapLinksContainer = $("roadmapLinksContainer");
  elements.addRoadmapLinkBtn = $("addRoadmapLinkBtn");
  elements.roadmapTasksContainer = $("roadmapTasksContainer");
  elements.roadmapTasksCollapsibleWrap = document.querySelector("[data-roadmap-tasks-collapsible]");
  elements.addRoadmapTaskBtn = $("addRoadmapTaskBtn");
  elements.roadmapRaciSection = $("roadmapModalSectionRaci");

  elements.filterCountriesSearch = $("filterCountriesSearch");
  elements.filterCountriesList = $("filterCountriesList");
  elements.filterCountriesSummary = $("filterCountriesSummary");
  elements.filterCountriesToggle = $("filterCountriesToggle");
  elements.profileDeleteModal = $("profileDeleteModal");
  elements.profileDeleteNameLabel = $("profileDeleteNameLabel");
  elements.profileDeleteSummaryLabel = $("profileDeleteSummaryLabel");
  elements.profileDeleteWarningText = $("profileDeleteWarningText");
  elements.profileDeleteCancelTopBtn = $("profileDeleteCancelTopBtn");
  elements.profileDeleteCancelBtn = $("profileDeleteCancelBtn");
  elements.profileDeleteConfirmBtn = $("profileDeleteConfirmBtn");
  elements.profileDeletePasswordWrap = $("profileDeletePasswordWrap");
  elements.profileDeletePassword = $("profileDeletePassword");
  elements.profileDeletePasswordError = $("profileDeletePasswordError");

  elements.profileUnlockModal = $("profileUnlockModal");
  elements.profileUnlockModalSubtitle = $("profileUnlockModalSubtitle");
  elements.profileUnlockPassword = $("profileUnlockPassword");
  elements.profileUnlockError = $("profileUnlockError");
  elements.profileUnlockCancelBtn = $("profileUnlockCancelBtn");
  elements.profileUnlockConfirmBtn = $("profileUnlockConfirmBtn");

  elements.profileViewModal = $("profileViewModal");
  elements.profileViewAvatar = $("profileViewAvatar");
  elements.profileViewName = $("profileViewName");
  elements.profileViewTeam = $("profileViewTeam");
  elements.profileViewCloseBtn = $("profileViewCloseBtn");
  elements.profileViewCloseBtnFooter = $("profileViewCloseBtnFooter");
  elements.profileViewUniqueCountries = $("profileViewUniqueCountries");
  elements.profileViewTotalRoadmaps = $("profileViewTotalRoadmaps");
  elements.profileViewByStatus = $("profileViewByStatus");
  elements.profileViewByType = $("profileViewByType");
  elements.profileViewByTshirt = $("profileViewByTshirt");
  elements.profileViewByMoscow = $("profileViewByMoscow");
  elements.profileViewByFramework = $("profileViewByFramework");
  elements.profileViewByCountry = $("profileViewByCountry");
  elements.profileViewByCurrency = $("profileViewByCurrency");
  elements.profileViewCurrencyDetails = $("profileViewCurrencyDetails");
  elements.profileViewCurrencyTotals = $("profileViewCurrencyTotals");
  elements.profileViewCurrencyNote = $("profileViewCurrencyNote");
  elements.profileViewRiceStats = $("profileViewRiceStats");
  elements.profileViewFinancialStats = $("profileViewFinancialStats");
  elements.profileViewFinancialNote = $("profileViewFinancialNote");

  elements.profileEditModal = $("profileEditModal");
  elements.profileEditName = $("profileEditName");
  elements.profileEditTeam = $("profileEditTeam");
  elements.profileEditCancelBtn = $("profileEditCancelBtn");
  elements.profileEditCloseBtn = $("profileEditCloseBtn");
  elements.profileEditSaveBtn = $("profileEditSaveBtn");
  elements.profileEditCurrentPasswordWrap = $("profileEditCurrentPasswordWrap");
  elements.profileEditCurrentPassword = $("profileEditCurrentPassword");
  elements.profileEditNewPassword = $("profileEditNewPassword");
  elements.profileEditConfirmPassword = $("profileEditConfirmPassword");
  elements.profileEditRemovePassword = $("profileEditRemovePassword");
  elements.profileEditPasswordError = $("profileEditPasswordError");
  elements.profileEditPasswordHint = $("profileEditPasswordHint");

  elements.roadmapDeleteModal = $("roadmapDeleteModal");
  elements.roadmapDeleteNameLabel = $("roadmapDeleteNameLabel");
  elements.roadmapDeleteWarningText = $("roadmapDeleteWarningText");
  elements.roadmapDeleteCancelBtn = $("roadmapDeleteCancelBtn");
  elements.roadmapDeleteConfirmBtn = $("roadmapDeleteConfirmBtn");

  elements.exportFormatModal = $("exportFormatModal");
  elements.exportFormatModalSubtitle = $("exportFormatModalSubtitle");
  elements.exportUnlockModal = $("exportUnlockModal");
  elements.exportUnlockProfileList = $("exportUnlockProfileList");
  elements.exportUnlockError = $("exportUnlockError");
  elements.exportUnlockSkipBtn = $("exportUnlockSkipBtn");
  elements.exportUnlockConfirmBtn = $("exportUnlockConfirmBtn");
  elements.exportAsJsonBtn = $("exportAsJsonBtn");
  elements.exportAsCsvBtn = $("exportAsCsvBtn");
  elements.importFormatModal = $("importFormatModal");
  elements.importFormatModalSubtitle = $("importFormatModalSubtitle");
  elements.importAsJsonBtn = $("importAsJsonBtn");
  elements.importAsCsvBtn = $("importAsCsvBtn");
  elements.cloudStorageModal = $("cloudStorageModal");
}

function initCurrencyOptions() {
  const currencySelects = [elements.filterCurrency, elements.roadmapCurrency];
  currencyList.sort().forEach((code) => {
    currencySelects.forEach((select) => {
      if (!select) return;
      const opt = document.createElement("option");
      opt.value = code;
      opt.textContent = code;
      select.appendChild(opt.cloneNode(true));
    });
  });
}

/**
 * Ensures the roadmap currency select has an option for the given code.
 * Used when opening the roadmap modal so imported/JSON data with a currency
 * not in the initial list (or with different casing) still displays correctly.
 */
function ensureCurrencyOption(select, code) {
  if (!select || !code || typeof code !== "string") return;
  const trimmed = code.trim();
  if (!trimmed) return;
  const upper = trimmed.toUpperCase();
  const hasOption = Array.from(select.options).some((o) => (o.value || "").toUpperCase() === upper);
  if (!hasOption) {
    const opt = document.createElement("option");
    opt.value = trimmed;
    opt.textContent = trimmed;
    select.appendChild(opt);
  }
}

function createFilterCheckboxRow(options) {
  const {
    value,
    text,
    checked = false,
    rowClass = "filter-country-option",
    checkboxId,
    rowDataset = {}
  } = options;
  const row = document.createElement("div");
  row.className = rowClass;
  Object.entries(rowDataset).forEach(([key, datasetValue]) => {
    row.dataset[key] = datasetValue;
  });
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.id =
    checkboxId ||
    `filter-cb-${String(value).replace(/[^a-zA-Z0-9_-]+/g, "-").toLowerCase()}-${Math.random().toString(36).slice(2, 7)}`;
  cb.value = value;
  cb.checked = checked;
  const label = document.createElement("label");
  label.setAttribute("for", cb.id);
  label.textContent = text;
  row.appendChild(cb);
  row.appendChild(label);
  return { row, cb, label };
}

function initFilterCountriesOptions() {
  if (!elements.filterCountriesList) return;
  elements.filterCountriesList.innerHTML = "";
  const sorted = countryList.slice().sort();
  const selected = new Set(getSelectedFilterCountriesRaw());

  if (typeof COUNTRY_OPTION_EU !== "undefined") {
    const euRowBundle = createFilterCheckboxRow({
      value: COUNTRY_OPTION_EU,
      text: "EU (European Union)",
      checked:
        selected.has(COUNTRY_OPTION_EU) ||
        (typeof EU_MEMBER_COUNTRIES !== "undefined" &&
          EU_MEMBER_COUNTRIES.length > 0 &&
          EU_MEMBER_COUNTRIES.every((c) => selected.has(c))),
      rowClass: "filter-country-option filter-country-option--eu",
      checkboxId: "filterCountryEu",
      rowDataset: { name: COUNTRY_OPTION_EU }
    });
    elements.filterCountriesList.appendChild(euRowBundle.row);
  }

  sorted.forEach((name, index) => {
    const rowBundle = createFilterCheckboxRow({
      value: name,
      text: name,
      checked: selected.has(name),
      checkboxId: `filterCountry-${index}`,
      rowDataset: { name }
    });
    elements.filterCountriesList.appendChild(rowBundle.row);
  });
  filterFilterCountriesBySearchTerm();
  updateFilterCountriesSummary();
}

function initFilterRoadmapPeriodOptions(roadmaps) {
  if (!elements.filterRoadmapPeriodList) return;
  const listEl = elements.filterRoadmapPeriodList;
  const previouslySelected = new Set(getSelectedFilterRoadmapPeriods());

  const periodsSet = new Set();
  (roadmaps || []).forEach((p) => {
    const raw = p.roadmapPeriod != null ? String(p.roadmapPeriod).trim().toUpperCase() : "";
    if (raw) periodsSet.add(raw);
  });

  const periods = Array.from(periodsSet).sort();
  listEl.innerHTML = "";

  periods.forEach((period, index) => {
    const rowBundle = createFilterCheckboxRow({
      value: period,
      text: period,
      checked: previouslySelected.has(period),
      checkboxId: `filterRoadmapPeriod-${index}`,
      rowDataset: { period }
    });
    listEl.appendChild(rowBundle.row);
  });

  filterFilterRoadmapPeriodsBySearchTerm();
  updateFilterRoadmapPeriodsSummary();
}

function getCompactLayoutMediaQueryString() {
  const w =
    typeof COMPACT_LAYOUT_MAX_WIDTH_PX !== "undefined" && Number(COMPACT_LAYOUT_MAX_WIDTH_PX) > 0
      ? Number(COMPACT_LAYOUT_MAX_WIDTH_PX)
      : 1400;
  return `(max-width: ${w}px)`;
}

function isCompactLayoutViewport() {
  return window.matchMedia(getCompactLayoutMediaQueryString()).matches;
}

/** RACI desktop grid uses 1025px (CSS), not the 1400px compact breakpoint. */
function isRaciMatrixDesktopLayout() {
  return window.matchMedia("(min-width: 1025px)").matches;
}

function handleRaciMatrixTooltipShow(e) {
  if (!isRaciMatrixDesktopLayout()) return;
  const wrap = e.target.closest(".raci-matrix-with-tooltip");
  if (!wrap) return;
  if (activeTooltipWrap === wrap) return;
  document.body.classList.remove("cell-type-tooltip-hidden");
  positionProfileTooltip(wrap);
}

/** Mobile/tablet header actions menu (export, import, rates). */
function initCompactLayoutClass() {
  const compactMq = window.matchMedia(getCompactLayoutMediaQueryString());

  const apply = () => {
    const compact = compactMq.matches;
    document.documentElement.classList.toggle("is-compact-layout", compact);
    /* Non-desktop uses the same phone UI on tablets and phones (Android / iPhone). */
    document.documentElement.classList.toggle("is-phone-layout", compact);
    document.documentElement.classList.toggle("is-desktop-layout", !compact);
    if (typeof Fullscreen !== "undefined" && typeof Fullscreen.updateHostLayoutClass === "function") {
      Fullscreen.updateHostLayoutClass();
    }
    if (state.roadmapsView === "moscow") {
      renderMoscowBoard();
      syncMoscowCompactNav();
    } else if (state.roadmapsView === "board") {
      renderScrumBoard();
    } else if (state.roadmapsView === "raci") {
      renderRaciMatrix();
    } else if (state.roadmapsView === "kano") {
      renderKanoPortfolioMatrix();
    } else if (state.roadmapsView === "table") {
      renderRoadmaps();
    }
    if (compact && elements.portfolioFiltersDrawer?.open) {
      elements.portfolioFiltersDrawer.open = false;
      if (elements.filtersAdvanced) {
        elements.filtersAdvanced.classList.remove("visible");
        syncCompactFilterButtonLabels();
      }
      syncPortfolioFiltersDrawerState();
    }
    syncTableGroupByControlsForLayout();
    syncCompactFiltersChrome();
    hideCellTypeTooltips();
    mountSuperAdminToggleForLayout();
    syncSuperAdminChrome();
    if (elements.roadmapModal?.classList.contains("active")) {
      syncRoadmapModalFooterMetaDetails({ resetCollapsed: compact });
    }
    schedulePortfolioViewTabsLayout();
  };

  apply();
  if (typeof compactMq.addEventListener === "function") {
    compactMq.addEventListener("change", apply);
  } else if (typeof compactMq.addListener === "function") {
    compactMq.addListener(apply);
  }
}

function initAppHeaderMenu() {
  const header = document.querySelector(".app-header--modern");
  const toggleBtn = $("appHeaderMenuBtn");
  const toolbar = $("appHeaderToolbar");
  if (!header || !toggleBtn || !toolbar) return;

  toggleBtn.addEventListener("click", () => {
    const willOpen = !header.classList.contains("app-header--menu-open");
    if (willOpen) prepareAppOverlay("appHeaderMenu");
    const isOpen = header.classList.toggle("app-header--menu-open");
    toggleBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && header.classList.contains("app-header--menu-open")) {
      closeAppHeaderMenu();
      toggleBtn.focus();
    }
  });

  toolbar.querySelectorAll(".app-header-action-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (window.matchMedia("(max-width: 767px)").matches) closeAppHeaderMenu();
    });
  });

  const desktopMq = window.matchMedia("(min-width: 768px)");
  const onViewportChange = () => {
    if (desktopMq.matches) closeAppHeaderMenu();
  };
  if (typeof desktopMq.addEventListener === "function") {
    desktopMq.addEventListener("change", onViewportChange);
  } else if (typeof desktopMq.addListener === "function") {
    desktopMq.addListener(onViewportChange);
  }
}

function attachEventListeners() {
  // --- Profiles & roadmaps: core interactions ---
  elements.addProfileForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = (elements.newProfileName.value || "").trim();
    if (!name) return;
    const team = (elements.newProfileTeam && elements.newProfileTeam.value || "").trim();
    const pwd = elements.newProfilePassword ? elements.newProfilePassword.value : "";
    const confirm = elements.newProfilePasswordConfirm ? elements.newProfilePasswordConfirm.value : "";
    if (typeof ProfileSecurity === "undefined") {
      showToast("Profile security module failed to load. Refresh the page and try again.");
      return;
    }
    const validation = ProfileSecurity.validatePasswordPair(pwd, confirm, { required: false });
    if (!validation.ok) {
      showToast(validation.message);
      return;
    }
    addProfile(name, team, validation.password)
      .then(() => {
        elements.newProfileName.value = "";
        if (elements.newProfileTeam) elements.newProfileTeam.value = "";
        if (elements.newProfilePassword) elements.newProfilePassword.value = "";
        if (elements.newProfilePasswordConfirm) elements.newProfilePasswordConfirm.value = "";
        resetProfilePasswordToggles(elements.addProfileForm || $("addProfileForm"));
        showToast(
          validation.password
            ? "Profile created with password protection."
            : "Profile created successfully."
        );
        if (isCompactProfilesLayout()) {
          setProfilesSheetTab("browse");
          if (elements.profilesCreatePanel) elements.profilesCreatePanel.open = false;
        } else if (elements.profilesCreatePanel && window.matchMedia("(max-width: 767px)").matches) {
          elements.profilesCreatePanel.open = false;
        }
      })
      .catch((err) => {
        console.error("Failed to create profile:", err);
        showToast("Could not create profile. Please try again.");
      });
  });

  elements.addRoadmapBtn.addEventListener("click", () => {
    openRoadmapModal("create");
  });

  if (elements.bulkDeleteBtn) {
    elements.bulkDeleteBtn.addEventListener("click", handleBulkDelete);
  }
  if (elements.bulkDuplicateBtn) {
    elements.bulkDuplicateBtn.addEventListener("click", () => handleBulkRoadmapTransfer("duplicate"));
  }
  if (elements.bulkMoveBtn) {
    elements.bulkMoveBtn.addEventListener("click", () => handleBulkRoadmapTransfer("move"));
  }
  if (elements.portfolioSelectionDeleteBtn) {
    elements.portfolioSelectionDeleteBtn.addEventListener("click", handleBulkDelete);
  }
  if (elements.portfolioSelectionDuplicateBtn) {
    elements.portfolioSelectionDuplicateBtn.addEventListener("click", () => handleBulkRoadmapTransfer("duplicate"));
  }
  if (elements.portfolioSelectionMoveBtn) {
    elements.portfolioSelectionMoveBtn.addEventListener("click", () => handleBulkRoadmapTransfer("move"));
  }
  if (elements.portfolioSelectionClearBtn) {
    elements.portfolioSelectionClearBtn.addEventListener("click", clearRoadmapSelection);
  }

  if (elements.roadmapsViewTableBtn) {
    elements.roadmapsViewTableBtn.addEventListener("click", () => {
      if (Fullscreen.isViewFullscreen() && state.roadmapsView !== "table") {
        Fullscreen.switchViewWhileFullscreen("table");
      } else {
        switchRoadmapsView("table");
      }
    });
  }
  if (elements.roadmapsViewBoardBtn) {
    elements.roadmapsViewBoardBtn.addEventListener("click", () => {
      if (Fullscreen.isViewFullscreen() && state.roadmapsView !== "board") {
        Fullscreen.switchViewWhileFullscreen("board");
      } else {
        switchRoadmapsView("board");
      }
    });
  }
  if (elements.roadmapsViewMoscowBtn) {
    elements.roadmapsViewMoscowBtn.addEventListener("click", () => {
      if (Fullscreen.isViewFullscreen() && state.roadmapsView !== "moscow") {
        Fullscreen.switchViewWhileFullscreen("moscow");
      } else {
        switchRoadmapsView("moscow");
      }
    });
  }
  if (elements.roadmapsViewMapBtn) {
    elements.roadmapsViewMapBtn.addEventListener("click", () => {
      if (Fullscreen.isViewFullscreen() && state.roadmapsView !== "map") {
        Fullscreen.switchViewWhileFullscreen("map");
      } else {
        switchRoadmapsView("map");
      }
    });
  }
  if (elements.roadmapsViewRaciBtn) {
    elements.roadmapsViewRaciBtn.addEventListener("click", () => {
      if (Fullscreen.isViewFullscreen() && state.roadmapsView !== "raci") {
        Fullscreen.switchViewWhileFullscreen("raci");
      } else {
        switchRoadmapsView("raci");
      }
    });
  }
  if (elements.roadmapsViewKanoBtn) {
    elements.roadmapsViewKanoBtn.addEventListener("click", () => {
      if (Fullscreen.isViewFullscreen() && state.roadmapsView !== "kano") {
        Fullscreen.switchViewWhileFullscreen("kano");
      } else {
        switchRoadmapsView("kano");
      }
    });
  }

  [elements.roadmapsViewTableBtn, elements.roadmapsViewBoardBtn, elements.roadmapsViewMoscowBtn, elements.roadmapsViewMapBtn, elements.roadmapsViewRaciBtn, elements.roadmapsViewKanoBtn]
    .filter(Boolean)
    .forEach((btn) => {
      btn.addEventListener("touchend", () => {
        window.setTimeout(() => {
          if (document.activeElement === btn) btn.blur();
        }, 0);
      });
    });

  if (elements.tableSortByRiceToggle) {
    elements.tableSortByRiceToggle.addEventListener("change", () => {
      state.tableSortByRice = elements.tableSortByRiceToggle.checked;
      saveState();
      if (state.roadmapsView === "table") renderRoadmaps();
    });
  }

  initTableGroupByControls();
  syncCompactFiltersChrome();
  if (elements.scrumBoardSortByRiceToggle) {
    elements.scrumBoardSortByRiceToggle.addEventListener("change", () => {
      state.scrumBoardSortByRice = elements.scrumBoardSortByRiceToggle.checked;
      saveState();
      if (state.roadmapsView === "board") renderScrumBoard();
    });
  }
  if (elements.moscowSortByRiceToggle) {
    elements.moscowSortByRiceToggle.addEventListener("change", () => {
      state.moscowSortByRice = elements.moscowSortByRiceToggle.checked;
      saveState();
      if (state.roadmapsView === "moscow") renderMoscowBoard();
    });
  }

  initMapMetricPicker();
  initRaciMatrixDomainToggle();
  initPortfolioKanoPanelToggle();

  if (elements.raciMatrixFullscreenBtn && elements.roadmapsRaciView) {
    elements.raciMatrixFullscreenBtn.addEventListener("click", () => Fullscreen.toggle(elements.roadmapsRaciView));
  }
  if (elements.roadmapsRaciMatrixTable) {
    elements.roadmapsRaciMatrixTable.addEventListener("click", (event) => {
      const roleToggle = event.target.closest(".raci-matrix-card__role-toggle");
      if (roleToggle) {
        event.preventDefault();
        event.stopPropagation();
        handleRaciMatrixCardRoleToggle(roleToggle);
        return;
      }
      const viewBtn = event.target.closest("[data-action='viewRoadmap']");
      if (viewBtn) openRoadmapModal("view", viewBtn.getAttribute("data-id"));
    });
    elements.roadmapsRaciMatrixTable.addEventListener("mouseover", handleRaciMatrixTooltipShow, true);
  }
  if (elements.roadmapsRaciMatrixWrap) {
    elements.roadmapsRaciMatrixWrap.addEventListener("scroll", () => {
      hideCellTypeTooltips();
    }, { passive: true });
  }
  if (elements.portfolioKanoFullscreenBtn && elements.roadmapsKanoView) {
    elements.portfolioKanoFullscreenBtn.addEventListener("click", () => Fullscreen.toggle(elements.roadmapsKanoView));
  }
  if (elements.roadmapsKanoView) {
    elements.roadmapsKanoView.addEventListener("click", (event) => {
      const kanoBtn = event.target.closest("[data-action='setRoadmapKano']");
      if (kanoBtn) {
        openRoadmapModalForKanoScoring(kanoBtn.getAttribute("data-id"));
        return;
      }
      const viewBtn = event.target.closest("[data-action='viewRoadmap']");
      if (viewBtn) {
        if (portfolioKanoSuppressNextTileClick) return;
        openRoadmapModal("view", viewBtn.getAttribute("data-id"));
      }
    });
    elements.roadmapsKanoView.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const tile = event.target.closest(".portfolio-kano-matrix-tile[role='button']");
      if (!tile || portfolioKanoSuppressNextTileClick) return;
      event.preventDefault();
      openRoadmapModal("view", tile.getAttribute("data-id"));
    });
    elements.roadmapsKanoView.addEventListener("change", (event) => {
      const select = event.target.closest("[data-action='setRoadmapKanoAxis']");
      if (!select) return;
      const card = select.closest(".portfolio-kano-compact-card");
      if (!card) return;
      const roadmapId = select.getAttribute("data-roadmap-id");
      const fSelect = card.querySelector("[data-kano-axis='functionality']");
      const sSelect = card.querySelector("[data-kano-axis='satisfaction']");
      if (!roadmapId || !fSelect || !sSelect) return;
      setRoadmapKanoPosition(roadmapId, fSelect.value, sSelect.value);
    });
  }

  if (elements.roadmapsMapFullscreenBtn && elements.roadmapsMapView) {
    elements.roadmapsMapFullscreenBtn.addEventListener("click", () => Fullscreen.toggle(elements.roadmapsMapView));
  }
  if (elements.refreshExchangeRatesBtn) {
    elements.refreshExchangeRatesBtn.addEventListener("click", () => {
      ExchangeRates.refreshManual()
        .then(() => showToast("Exchange rates updated."))
        .catch(() => showToast("Could not refresh exchange rates. Try again later."));
    });
  }
  if (elements.scrumBoardFullscreenBtn && elements.roadmapsBoardView) {
    elements.scrumBoardFullscreenBtn.addEventListener("click", () => Fullscreen.toggle(elements.roadmapsBoardView));
  }
  if (elements.tableFullscreenBtn && elements.roadmapsTableView) {
    elements.tableFullscreenBtn.addEventListener("click", () => Fullscreen.toggle(elements.roadmapsTableView));
  }
  if (elements.moscowFullscreenBtn && elements.roadmapsMoscowView) {
    elements.moscowFullscreenBtn.addEventListener("click", () => Fullscreen.toggle(elements.roadmapsMoscowView));
  }
  document.addEventListener("fullscreenchange", () => {
    Fullscreen.onChange();
    returnTooltipsToOwner();
  });
  document.addEventListener("webkitfullscreenchange", () => {
    Fullscreen.onChange();
    returnTooltipsToOwner();
  });

  // --- Data export / import: main toolbar buttons ---
  // Export and Import both open a simple format chooser (JSON or CSV).
  elements.exportDataBtn.addEventListener("click", () => {
    if (!elements.exportFormatModal) {
      beginExport("json");
      return;
    }
    updateExportFormatModalNotice();
    activateBlockingModal(elements.exportFormatModal, "exportFormatModal");
  });

  elements.importDataBtn.addEventListener("click", () => {
    if (!elements.importFormatModal) return;
    updateImportFormatModalNotice();
    activateBlockingModal(elements.importFormatModal, "importFormatModal");
  });

  initExportUnlockModal();

  if (elements.exportAsJsonBtn) {
    elements.exportAsJsonBtn.addEventListener("click", () => {
      closeExportFormatModal();
      beginExport("json");
    });
  }
  if (elements.exportAsCsvBtn) {
    elements.exportAsCsvBtn.addEventListener("click", () => {
      closeExportFormatModal();
      beginExport("csv");
    });
  }

  if (elements.importAsJsonBtn) {
    elements.importAsJsonBtn.addEventListener("click", () => {
      if (!elements.importFileInput) return;
      elements.importFileInput.value = "";
      elements.importFileInput.click();
      closeImportFormatModal();
    });
  }
  if (elements.importAsCsvBtn) {
    elements.importAsCsvBtn.addEventListener("click", () => {
      // Reuse the same hidden input, but treat CSV differently in the change handler.
      if (!elements.importFileInput) return;
      elements.importFileInput.value = "";
      elements.importFileInput.setAttribute("data-import-kind", "csv");
      elements.importFileInput.click();
      closeImportFormatModal();
    });
  }

  if (elements.importFileInput) {
    elements.importFileInput.addEventListener("change", handleUnifiedImportChange);
  }

  if (elements.profileViewCloseBtnFooter) {
    elements.profileViewCloseBtnFooter.addEventListener("click", () => closeProfileViewModal());
  }
  if (elements.profileViewCloseBtn) {
    elements.profileViewCloseBtn.addEventListener("click", () => closeProfileViewModal());
  }
  if (elements.profileViewCurrencyDetails) {
    elements.profileViewCurrencyDetails.addEventListener("toggle", () => {
      syncProfileViewCurrencyDetails();
    });
  }
  if (elements.roadmapModalFooterMetaDetails) {
    elements.roadmapModalFooterMetaDetails.addEventListener("toggle", () => {
      syncRoadmapModalFooterMetaDetails();
    });
  }
  if (elements.roadmapForm) {
    elements.roadmapForm.addEventListener("input", (event) => {
      scheduleRoadmapModalSectionNavSync();
      if (event.target.closest(".roadmap-task-row, .roadmap-tasks-readonly, #roadmapTasksContainer")) {
        scheduleRoadmapTasksDisclosureSync();
      }
    });
    elements.roadmapForm.addEventListener("change", (event) => {
      scheduleRoadmapModalSectionNavSync();
      if (
        event.target.matches(".roadmap-task-name-input, .roadmap-task-status-select") ||
        event.target.closest("#roadmapTasksContainer")
      ) {
        scheduleRoadmapTasksDisclosureSync();
      }
    });
    elements.roadmapForm.addEventListener("toggle", (event) => {
      const target = event.target;
      if (
        target instanceof HTMLDetailsElement &&
        (target.classList.contains("roadmap-optional-field-details") ||
          target.classList.contains("roadmap-optional-section-details") ||
          target.classList.contains("roadmap-optional-disclosure") ||
          target.classList.contains("roadmap-tasks-disclosure"))
      ) {
        syncRoadmapOptionalDisclosureAria(target);
        if (target.classList.contains("roadmap-tasks-disclosure")) {
          syncRoadmapTasksDisclosure();
          return;
        }
        if (target.classList.contains("roadmap-optional-field-details")) {
          const wrap = target.closest(".roadmap-field-tooltip-wrap");
          target.classList.toggle("roadmap-optional--has-data", roadmapOptionalFieldHasData(wrap));
        } else {
          const sectionId = target.dataset.optionalSection;
          target.classList.toggle(
            "roadmap-optional--has-data",
            sectionId ? roadmapOptionalSectionHasData(sectionId) : false
          );
        }
      }
    });
  }

  if (elements.profileEditCancelBtn) {
    elements.profileEditCancelBtn.addEventListener("click", () => closeProfileEditModal());
  }
  if (elements.profileEditSaveBtn) {
    elements.profileEditSaveBtn.addEventListener("click", () => {
      handleProfileEditSave().catch((err) => {
        console.error("Profile save failed:", err);
        showToast("Could not save profile. Please try again.");
      });
    });
  }

  if (elements.profileLockedUnlockForm) {
    elements.profileLockedUnlockForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const active = getActiveProfile();
      if (!active) return;
      const password = elements.profileLockedInlinePassword
        ? elements.profileLockedInlinePassword.value
        : "";
      attemptProfileUnlock(active.id, password, { source: "inline" })
        .then((ok) => {
          if (ok) return completeProfileUnlockSuccess(active.id);
          return null;
        })
        .catch((err) => {
          console.error("Inline unlock failed:", err);
          showProfileLockedInlineError("Something went wrong. Please try again.");
        });
    });
  }
  if (elements.profileUnlockCancelBtn) {
    elements.profileUnlockCancelBtn.addEventListener("click", () => closeProfileUnlockModal());
  }
  if (elements.profileUnlockConfirmBtn) {
    elements.profileUnlockConfirmBtn.addEventListener("click", () => {
      handleProfileUnlockConfirm().catch((err) => {
        console.error("Unlock failed:", err);
        showProfileUnlockError("Something went wrong. Please try again.");
      });
    });
  }
  if (elements.profileUnlockPassword) {
    elements.profileUnlockPassword.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleProfileUnlockConfirm().catch((err) => {
          console.error("Unlock failed:", err);
          showProfileUnlockError("Something went wrong. Please try again.");
        });
      }
    });
  }

  if (elements.profileDeletePassword) {
    elements.profileDeletePassword.addEventListener("input", () => {
      updateProfileDeleteConfirmState();
    });
  }

  if (elements.filtersToggleBtn && elements.filtersAdvanced) {
    elements.filtersToggleBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openPortfolioFiltersDrawerIfClosed();
      elements.filtersAdvanced.classList.toggle("visible");
      syncCompactFilterButtonLabels();
    });
  }

  if (elements.filtersResetBtn) {
    elements.filtersResetBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openPortfolioFiltersDrawerIfClosed();
      clearFilters();
      renderRoadmaps();
    });
  }

  if (elements.filterCountriesToggle) {
    elements.filterCountriesToggle.addEventListener("click", (event) => {
      event.stopPropagation();
      const container = elements.filterCountriesToggle.closest(".filter-countries");
      if (!container) return;
      const willOpen = !container.classList.contains("open");
      if (willOpen) prepareAppOverlay("filterCountries");
      container.classList.toggle("open");
      if (willOpen && elements.filterCountriesSearch) {
        elements.filterCountriesSearch.focus();
        elements.filterCountriesSearch.select();
      }
    });
  }

  if (elements.filterRoadmapPeriodToggle) {
    elements.filterRoadmapPeriodToggle.addEventListener("click", (event) => {
      event.stopPropagation();
      const container = elements.filterRoadmapPeriodToggle.closest(".filter-countries");
      if (!container) return;
      const willOpen = !container.classList.contains("open");
      if (willOpen) prepareAppOverlay("filterRoadmapPeriod");
      container.classList.toggle("open");
      if (willOpen && elements.filterRoadmapPeriodSearch) {
        elements.filterRoadmapPeriodSearch.focus();
        elements.filterRoadmapPeriodSearch.select();
      }
    });
  }

  if (elements.scrumBoardStatusColumnsToggle) {
    elements.scrumBoardStatusColumnsToggle.addEventListener("click", (event) => {
      event.stopPropagation();
      const container = elements.scrumBoardStatusColumnsToggle.closest(".filter-countries");
      if (!container) return;
      const willOpen = !container.classList.contains("open");
      if (willOpen) {
        prepareAppOverlay("boardStatusColumns");
        syncScrumBoardStatusColumnsCheckboxes();
      }
      container.classList.toggle("open");
      elements.scrumBoardStatusColumnsToggle.setAttribute(
        "aria-expanded",
        willOpen ? "true" : "false"
      );
    });
  }

  if (elements.scrumBoardStatusColumnsSelectAll) {
    elements.scrumBoardStatusColumnsSelectAll.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      setScrumBoardVisibleStatuses(getAllRoadmapStatuses());
      renderScrumBoard();
    });
  }

  if (elements.scrumBoardStatusColumnsList) {
    elements.scrumBoardStatusColumnsList.addEventListener("change", (event) => {
      const target = event.target;
      if (!target || target.type !== "checkbox") return;
      const selected = readScrumBoardStatusColumnsFromUi();
      if (!selected.length) {
        target.checked = true;
        return;
      }
      setScrumBoardVisibleStatuses(selected);
      renderScrumBoard();
    });
  }

  document.addEventListener("click", (event) => {
    if (elements.filterCountriesToggle) {
      const countriesContainer = elements.filterCountriesToggle.closest(".filter-countries");
      if (countriesContainer && !countriesContainer.contains(event.target)) {
        countriesContainer.classList.remove("open");
      }
    }
    if (elements.filterRoadmapPeriodToggle) {
      const periodContainer = elements.filterRoadmapPeriodToggle.closest(".filter-countries");
      if (periodContainer && !periodContainer.contains(event.target)) {
        periodContainer.classList.remove("open");
      }
    }
    if (elements.scrumBoardStatusColumnsToggle) {
      const statusContainer = elements.scrumBoardStatusColumnsToggle.closest(".filter-countries");
      if (statusContainer && !statusContainer.contains(event.target)) {
        closeScrumBoardStatusColumnsPopup();
      }
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (closeTopBlockingModal()) {
      event.preventDefault();
      return;
    }
    if (elements.filterCountriesToggle) {
      const countriesContainer = elements.filterCountriesToggle.closest(".filter-countries");
      if (countriesContainer) {
        countriesContainer.classList.remove("open");
      }
    }
    if (elements.filterRoadmapPeriodToggle) {
      const periodContainer = elements.filterRoadmapPeriodToggle.closest(".filter-countries");
      if (periodContainer) {
        periodContainer.classList.remove("open");
      }
    }
    closeScrumBoardStatusColumnsPopup();
  });

  if (elements.filterCountriesSearch) {
    elements.filterCountriesSearch.addEventListener("input", () => {
      filterFilterCountriesBySearchTerm();
      renderRoadmaps();
      updateFiltersActivePill();
      updateFilterCountriesSummary();
    });
  }

  if (elements.filterCountriesList) {
    elements.filterCountriesList.addEventListener("change", (event) => {
      const target = event.target;
      if (target && target.type === "checkbox") {
        syncFilterEuRegionCheckbox(target);
        renderRoadmaps();
        updateFiltersActivePill();
        updateFilterCountriesSummary();
      }
    });
  }

  if (elements.filterRoadmapPeriodSearch) {
    elements.filterRoadmapPeriodSearch.addEventListener("input", () => {
      filterFilterRoadmapPeriodsBySearchTerm();
      renderRoadmaps();
      updateFiltersActivePill();
      updateFilterRoadmapPeriodsSummary();
    });
  }

  if (elements.filterRoadmapPeriodList) {
    elements.filterRoadmapPeriodList.addEventListener("change", (event) => {
      const target = event.target;
      if (target && target.type === "checkbox") {
        renderRoadmaps();
        updateFiltersActivePill();
        updateFilterRoadmapPeriodsSummary();
      }
    });
  }

  if (elements.addCountryBtn && elements.countriesContainer) {
    elements.addCountryBtn.addEventListener("click", () => {
      if (roadmapModalMode === "view") return;
      addCountryRow();
    });
    elements.countriesContainer.addEventListener("click", (event) => {
      if (roadmapModalMode === "view") return;
      const btn = event.target.closest(".country-remove-btn");
      if (!btn) return;
      const row = btn.closest(".country-row");
      if (!row) return;
      elements.countriesContainer.removeChild(row);
      if (!elements.countriesContainer.querySelector(".country-row")) {
        addCountryRow();
      }
    });
    elements.countriesContainer.addEventListener("change", (event) => {
      if (roadmapModalMode === "view") return;
      const select = event.target.closest(".country-row select");
      if (!select || !isEuRegionOption(select.value)) return;
      applyEuRegionToRoadmapCountries();
    });
  }

  if (elements.addRoadmapLabelBtn && elements.roadmapLabelsContainer) {
    elements.addRoadmapLabelBtn.addEventListener("click", () => {
      if (roadmapModalMode === "view") return;
      addRoadmapLabelRow();
    });
    elements.roadmapLabelsContainer.addEventListener("click", (event) => {
      if (roadmapModalMode === "view") return;
      const btn = event.target.closest(".roadmap-label-remove-btn");
      if (!btn) return;
      const row = btn.closest(".roadmap-label-row");
      if (!row) return;
      elements.roadmapLabelsContainer.removeChild(row);
      if (!elements.roadmapLabelsContainer.querySelector(".roadmap-label-row")) {
        addRoadmapLabelRow();
      }
      scheduleRoadmapModalSectionNavSync();
    });
  }

  if (elements.addRoadmapLinkBtn && elements.roadmapLinksContainer) {
    elements.addRoadmapLinkBtn.addEventListener("click", () => {
      if (roadmapModalMode === "view") return;
      addRoadmapLinkRow();
    });
    elements.roadmapLinksContainer.addEventListener("click", (event) => {
      if (roadmapModalMode === "view") return;
      const btn = event.target.closest(".roadmap-link-remove-btn");
      if (!btn) return;
      const row = btn.closest(".roadmap-link-row");
      if (!row) return;
      elements.roadmapLinksContainer.removeChild(row);
      if (!elements.roadmapLinksContainer.querySelector(".roadmap-link-row")) {
        addRoadmapLinkRow();
      }
      scheduleRoadmapModalSectionNavSync();
    });
  }

  if (elements.addRoadmapTaskBtn && elements.roadmapTasksContainer) {
    elements.addRoadmapTaskBtn.addEventListener("click", () => {
      if (roadmapModalMode === "view") return;
      addRoadmapTaskRow();
      scheduleRoadmapTasksDisclosureSync();
    });
    elements.roadmapTasksContainer.addEventListener("click", (event) => {
      if (roadmapModalMode === "view") return;
      const btn = event.target.closest(".roadmap-task-remove-btn");
      if (!btn) return;
      const row = btn.closest(".roadmap-task-row");
      if (!row) return;
      elements.roadmapTasksContainer.removeChild(row);
      if (!elements.roadmapTasksContainer.querySelector(".roadmap-task-row")) {
        addRoadmapTaskRow();
      }
      scheduleRoadmapTasksDisclosureSync();
    });
  }

  if (elements.roadmapRaciSection) {
    elements.roadmapRaciSection.addEventListener("click", (event) => {
      if (roadmapModalMode === "view") return;
      const addBtn = event.target.closest(".roadmap-raci-add-btn");
      if (addBtn) {
        const role = addBtn.getAttribute("data-raci-role");
        if (role) addRoadmapRaciRow(role);
        return;
      }
      const removeBtn = event.target.closest(".roadmap-raci-remove-btn");
      if (!removeBtn) return;
      const row = removeBtn.closest(".roadmap-raci-row");
      const container = removeBtn.closest(".roadmap-raci-list");
      if (!row || !container) return;
      container.removeChild(row);
      if (!container.querySelector(".roadmap-raci-row")) {
        addRoadmapRaciRow(container.getAttribute("data-raci-role"));
      }
      scheduleRoadmapModalSectionNavSync();
    });
  }

  const filterInputs = [
    elements.filterImpact,
    elements.filterEffort,
    elements.filterCurrency,
    elements.filterFinancialFramework,
    elements.filterStatus,
    elements.filterTshirtSize,
    elements.filterMoscow,
    elements.filterLinks,
    elements.filterLabels,
    elements.filterRoadmapType,
    elements.filterOwnerProfile
  ].filter(Boolean); // guard against missing DOM nodes so we never throw while wiring listeners

  const applyFiltersAndUpdateUI = () => {
    renderRoadmaps();
    updateFiltersActivePill();
  };
  const debouncedApplyFilters = typeof debounce === "function" ? debounce(applyFiltersAndUpdateUI, 200) : applyFiltersAndUpdateUI;

  filterInputs.forEach((input) => {
    if (!input) return;
    input.addEventListener("input", applyFiltersAndUpdateUI);
    input.addEventListener("change", applyFiltersAndUpdateUI);
  });

  if (elements.selectAllRoadmaps) {
    elements.selectAllRoadmaps.addEventListener("change", (e) => {
      if (isActiveDemoProfile()) {
        e.target.checked = false;
        return;
      }
      const checked = e.target.checked;
      getRoadmapSelectCheckboxes().forEach((cb) => {
        cb.checked = checked;
      });
      syncRoadmapTableSelection();
    });
  }

  function handleRoadmapTableRowActionClick(e) {
    const viewBtn = e.target.closest("[data-action='viewRoadmap']");
    const editBtn = e.target.closest("[data-action='editRoadmap']");
    const deleteBtn = e.target.closest("[data-action='deleteRoadmap']");

    if (viewBtn) {
      openRoadmapModal("view", viewBtn.getAttribute("data-id"));
    } else if (editBtn) {
      openRoadmapModal("edit", editBtn.getAttribute("data-id"));
    } else if (deleteBtn) {
      handleSingleDelete(deleteBtn.getAttribute("data-id"));
    }
  }

  function handleRoadmapTableSelectionChange(e) {
    if (e.target.classList.contains("roadmap-select-checkbox")) {
      syncRoadmapTableSelection();
    }
  }

  function handleRoadmapTableSelectionClick(e) {
    if (e.target.classList.contains("roadmap-select-checkbox")) {
      requestAnimationFrame(() => syncRoadmapTableSelection());
    }
  }

  function handleRoadmapTableTooltipMouseEnter(e) {
    if (isCompactLayoutViewport()) return;
    const wrap = findTableViewTooltipTrigger(e.target);
    if (!wrap) return;
    cancelTooltipHoverHide();
    positionProfileTooltip(wrap);
  }

  if (elements.roadmapsTableBody) {
    elements.roadmapsTableBody.addEventListener("change", handleRoadmapTableSelectionChange);
    elements.roadmapsTableBody.addEventListener("input", handleRoadmapTableSelectionChange);
    elements.roadmapsTableBody.addEventListener("click", handleRoadmapTableSelectionClick);
    elements.roadmapsTableBody.addEventListener("click", handleRoadmapTableRowActionClick);
    elements.roadmapsTableBody.addEventListener("mouseenter", handleRoadmapTableTooltipMouseEnter, true);
  }

  if (elements.roadmapsTableCardsList) {
    elements.roadmapsTableCardsList.addEventListener("change", handleRoadmapTableSelectionChange);
    elements.roadmapsTableCardsList.addEventListener("input", handleRoadmapTableSelectionChange);
    elements.roadmapsTableCardsList.addEventListener("click", (e) => {
      handleCompactTableTooltipClick(e);
      handleRoadmapTableSelectionClick(e);
      handleRoadmapTableRowActionClick(e);
    }, true);
    elements.roadmapsTableCardsList.addEventListener("mouseenter", handleRoadmapTableTooltipMouseEnter, true);
  }

  document.addEventListener("pointerdown", handleCompactTooltipDismissPointerDown, true);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && activeTooltipWrap) {
      hideCellTypeTooltips();
    }
  });

  const tableWrapper = elements.roadmapsTableBody && elements.roadmapsTableBody.closest(".table-wrapper");
  if (tableWrapper) {
    tableWrapper.addEventListener("scroll", () => {
      hideCellTypeTooltips();
    }, { passive: true });
  }
  if (elements.roadmapsTableCardsList) {
    elements.roadmapsTableCardsList.addEventListener("scroll", () => {
      hideCellTypeTooltips();
    }, { passive: true });
  }
  if (elements.scrumBoardContainer) {
    elements.scrumBoardContainer.addEventListener("scroll", () => {
      hideCellTypeTooltips();
    }, { passive: true });
  }
  if (elements.moscowBoardContainer) {
    elements.moscowBoardContainer.addEventListener("scroll", () => {
      hideCellTypeTooltips();
    }, { passive: true });
  }

  document.body.addEventListener("mouseenter", (e) => {
    const wrap = e.target.closest(".profile-icon-wrap");
    if (!wrap) return;
    document.body.classList.remove("cell-type-tooltip-hidden");
    positionProfileTooltip(wrap);
  }, true);

  document.body.addEventListener("mouseenter", (e) => {
    if (isCompactLayoutViewport() && e.target.closest(".roadmaps-table-card")) return;
    const wrap = e.target.closest(".cell-type-icon-wrap, .scrum-board-card-type-wrap, .card-meta-with-tooltip, .card-title-with-tooltip");
    if (!wrap) return;
    const tooltip = wrap.querySelector(".cell-type-tooltip");
    if (!tooltip) return;
    const anchorPoint = wrap.classList.contains("card-title-with-tooltip")
      ? { x: e.clientX, y: e.clientY }
      : null;
    positionProfileTooltip(wrap, anchorPoint);
  }, true);

  document.body.addEventListener("focusin", (e) => {
    const raciWrap = e.target.closest(".raci-matrix-with-tooltip");
    if (raciWrap && isRaciMatrixDesktopLayout()) {
      positionProfileTooltip(raciWrap);
      return;
    }
    const wrap = e.target.closest(".profile-icon-wrap");
    if (!wrap) return;
    positionProfileTooltip(wrap);
  }, true);

  document.body.addEventListener("mouseover", (e) => {
    handleRaciMatrixTooltipShow(e);
  }, true);

  document.body.addEventListener("mouseenter", (e) => {
    const raciHover =
      e.target.closest(".raci-matrix-with-tooltip") ||
      e.target.closest(".cell-type-tooltip--raci");
    if (raciHover && isRaciMatrixDesktopLayout()) {
      cancelTooltipHoverHide();
      return;
    }
    if (isCompactLayoutViewport()) return;
    const tooltip = e.target.closest(".cell-type-tooltip.cell-type-tooltip-visible");
    if (tooltip && tooltip._ownerWrap) {
      cancelTooltipHoverHide();
      return;
    }
    const wrap = e.target.closest(
      ".profile-icon-wrap, .cell-type-icon-wrap, .scrum-board-card-type-wrap, .roadmap-field-tooltip-wrap, .cell-date-with-tooltip, .cell-countries-with-tooltip, .cell-tshirt-with-tooltip, .cell-financial-with-tooltip, .cell-desc-with-tooltip, .cell-moscow-with-tooltip, .cell-period-with-tooltip, .cell-rice-with-tooltip, .card-meta-with-tooltip, .card-title-with-tooltip, .raci-matrix-with-tooltip"
    );
    if (wrap) cancelTooltipHoverHide();
  }, true);

  document.body.addEventListener("mouseout", (e) => {
    if (isCompactLayoutViewport() && e.target.closest(".roadmaps-table-card")) return;

    const tooltipEl = e.target.closest(".cell-type-tooltip.cell-type-tooltip-visible");
    if (tooltipEl && tooltipEl._ownerWrap) {
      const ownerWrap = tooltipEl._ownerWrap;
      if (e.relatedTarget && isWithinTooltipHoverZone(e.relatedTarget, ownerWrap)) return;
      scheduleTooltipHoverHide(ownerWrap, 100);
      return;
    }

    const wrap = e.target.closest(
      ".profile-icon-wrap, .cell-type-icon-wrap, .scrum-board-card-type-wrap, .roadmap-field-tooltip-wrap, .cell-date-with-tooltip, .cell-countries-with-tooltip, .cell-tshirt-with-tooltip, .cell-financial-with-tooltip, .cell-desc-with-tooltip, .cell-moscow-with-tooltip, .cell-period-with-tooltip, .cell-rice-with-tooltip, .card-meta-with-tooltip, .card-title-with-tooltip, .raci-matrix-with-tooltip"
    );
    if (!wrap) return;
    if (e.relatedTarget && isWithinTooltipHoverZone(e.relatedTarget, wrap)) {
      cancelTooltipHoverHide();
      return;
    }
    scheduleTooltipHoverHide(wrap, 160);
  }, true);

  if (elements.profileList) {
    elements.profileList.addEventListener("scroll", () => {
      hideCellTypeTooltips();
    }, { passive: true });
  }

  if (elements.roadmapModal) {
    elements.roadmapModal.addEventListener("mouseover", (e) => {
      const wrap = e.target.closest(".roadmap-field-tooltip-wrap");
      if (!wrap) return;
      if (activeTooltipWrap === wrap) return;
      positionProfileTooltip(wrap);
    }, true);
    elements.roadmapModal.addEventListener("mouseleave", () => {
      hideCellTypeTooltips();
    });
    elements.roadmapModal.addEventListener("focusin", (e) => {
      const wrap = e.target.closest(".roadmap-field-tooltip-wrap");
      if (!wrap) return;
      positionProfileTooltip(wrap);
    }, true);
  }

  // Prevent accidental wheel-based increments on number inputs.
  document.addEventListener("wheel", (e) => {
    const numberInput = e.target instanceof Element ? e.target.closest("input[type=\"number\"]") : null;
    if (!numberInput) return;
    if (document.activeElement === numberInput) {
      e.preventDefault();
    }
  }, { passive: false });

  const headerCells = document.querySelectorAll("th[data-sort-field]");
  headerCells.forEach((th) => {
    th.dataset.sortActive = "false";
    const btn = th.querySelector(".sort-button");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const field = th.getAttribute("data-sort-field");
      toggleSort(field);
    });
  });

  elements.roadmapModalCloseBtn.addEventListener("click", closeRoadmapModal);
  elements.roadmapFormCancelBtn.addEventListener("click", (e) => {
    e.preventDefault();
    closeRoadmapModal();
  });

  elements.roadmapForm.addEventListener("submit", handleRoadmapFormSubmit);

  if (elements.financialFramework) {
    elements.financialFramework.addEventListener("change", () => {
      const nextFramework = normalizeFinancialFramework(elements.financialFramework.value);
      const prevFramework = normalizeFinancialFramework(elements.financialFramework.dataset.lastFramework || "");
      if (prevFramework && prevFramework !== nextFramework) {
        resetFinancialFrameworkInputs();
      }
      toggleFinancialFrameworkFields(nextFramework);
      elements.financialFramework.dataset.lastFramework = nextFramework;
      updateModalRicePreview();
    });
  }

  [
    elements.reachValue,
    elements.impactValue,
    elements.confidenceValue,
    elements.effortValue,
    elements.financialImpactValue,
    elements.roadmapCurrency,
    elements.financialCustomNotes,
    elements.financialClvCustomers,
    elements.financialClvMargin,
    elements.financialClvRetentionRatePct,
    elements.financialClvDiscountRatePct,
    elements.financialClvAcquisitionCost,
    elements.financialClvBaselineRetentionRatePct,
    elements.financialNpsTotalCustomers,
    elements.financialNpsCustomersMoved,
    elements.financialNpsArpa,
    elements.financialNpsRetentionPromoterPct,
    elements.financialNpsRetentionSourcePct,
    elements.financialNpsContributionMarginPct,
    elements.financialNpsUpsellPerConverted,
    elements.financialNpsReferralPerConverted,
    elements.financialNpsProgramCost,
    elements.financialNpsReportedImpactBasis,
    elements.financialRiskProbabilityBeforePct,
    elements.financialRiskProbabilityAfterPct,
    elements.financialRiskLossPerExposure,
    elements.financialRiskExposureUnits,
    elements.financialRiskPeriodsPerYear,
    elements.financialRiskMitigationCost,
    elements.financialHeadcountMinutesSavedPerFtePerDay,
    elements.financialHeadcountWorkingDaysPerYear,
    elements.financialHeadcountFteCount,
    elements.financialHeadcountHoursPerDay,
    elements.financialHeadcountUtilizationGainPct,
    elements.financialHeadcountAnnualCostPerFte,
    elements.financialOperationalCostPerUnitBefore,
    elements.financialOperationalCostPerUnitAfter,
    elements.financialOperationalAnnualVolume,
    elements.financialOperationalCycleTimeBeforeMinutes,
    elements.financialOperationalCycleTimeAfterMinutes,
    elements.financialOperationalLaborCostPerHour,
    elements.financialOperationalAnnualTransactions
  ].forEach((el) => {
    if (!el) return;
    el.addEventListener("input", updateModalRicePreview);
    el.addEventListener("change", updateModalRicePreview);
  });

}

function updateFiltersActivePill() {
  if (!elements.filtersActivePill) return;
  const activeFilters = [];
  if ((elements.filterTitle.value || "").trim()) activeFilters.push("Title");
  if (elements.filterRoadmapType.value) activeFilters.push("Type");
  if (getSelectedFilterCountries().length) activeFilters.push("Countries");
  if (getSelectedFilterRoadmapPeriods().length) activeFilters.push("Roadmap period");
  if (elements.filterImpact.value) activeFilters.push("Impact");
  if (elements.filterEffort.value) activeFilters.push("Effort");
  if (elements.filterCurrency.value) activeFilters.push("Currency");
  if (elements.filterFinancialFramework && elements.filterFinancialFramework.value) activeFilters.push("Framework");
  if (elements.filterStatus.value) activeFilters.push("Status");
  if (elements.filterTshirtSize.value) activeFilters.push("T-shirt size");
  if (elements.filterMoscow && elements.filterMoscow.value) activeFilters.push("MOSCOW");
  if (elements.filterLabel && (elements.filterLabel.value || "").trim()) activeFilters.push("Label");
  if (elements.filterLabels && elements.filterLabels.value) {
    activeFilters.push(elements.filterLabels.value === "with" ? "With labels" : "Without labels");
  }
  if (elements.filterLinks && elements.filterLinks.value) {
    activeFilters.push(elements.filterLinks.value === "with" ? "With links" : "Without links");
  }
  if (elements.filterOwnerProfile && elements.filterOwnerProfile.value) {
    const opt = elements.filterOwnerProfile.selectedOptions[0];
    activeFilters.push(opt ? `Profile: ${opt.textContent}` : "Owner profile");
  }

  if (!activeFilters.length) {
    elements.filtersActivePill.style.display = "none";
    elements.filtersActivePill.textContent = "";
    elements.filtersActivePill.removeAttribute("title");
    elements.filtersActivePill.setAttribute("aria-hidden", "true");
    return;
  }
  elements.filtersActivePill.style.display = "inline-flex";
  elements.filtersActivePill.setAttribute("aria-hidden", "false");
  const verboseLabel = activeFilters.length === 1
    ? `1 active filter (${activeFilters[0]})`
    : `${activeFilters.length} active filters`;
  const compact = isTableCompactLayout();
  elements.filtersActivePill.textContent = compact
    ? String(activeFilters.length)
    : verboseLabel;
  elements.filtersActivePill.setAttribute("title", verboseLabel);
  if (compact) {
    elements.filtersActivePill.setAttribute("aria-label", verboseLabel);
  } else {
    elements.filtersActivePill.removeAttribute("aria-label");
  }
}

// --- Filter autocomplete (roadmap title, label) ---
const FILTER_AUTOCOMPLETE_MAX_SUGGESTIONS = 12;

const filterAutocompleteState = {
  title: { open: false, highlightIndex: -1 },
  label: { open: false, highlightIndex: -1 }
};

const debouncedFilterTextApply =
  typeof debounce === "function"
    ? debounce(() => {
        renderRoadmaps();
        updateFiltersActivePill();
      }, 200)
    : () => {
        renderRoadmaps();
        updateFiltersActivePill();
      };

function getFilterAutocompleteField(kind) {
  if (kind === "title") {
    return {
      input: elements.filterTitle,
      dropdown: elements.filterTitleDropdown,
      listbox: elements.filterTitleListbox,
      empty: elements.filterTitleAutocompleteEmpty,
      wrapper: $("filterTitleAutocomplete"),
      emptyMessage: "No matching titles in this profile",
      icon: "T"
    };
  }
  if (kind === "label") {
    return {
      input: elements.filterLabel,
      dropdown: elements.filterLabelDropdown,
      listbox: elements.filterLabelListbox,
      empty: elements.filterLabelAutocompleteEmpty,
      wrapper: $("filterLabelAutocomplete"),
      emptyMessage: "No matching labels in this profile",
      icon: "#"
    };
  }
  return null;
}

function getActiveProfileRoadmapsForFilters() {
  if (isSuperAdminModeActive()) {
    return getPortfolioRoadmapsBaseList();
  }
  const profile = getActiveProfile();
  if (!profile || !Array.isArray(profile.roadmaps)) return [];
  return profile.roadmaps;
}

function collectFilterTitleSuggestions() {
  const seen = new Set();
  const out = [];
  getActiveProfileRoadmapsForFilters().forEach((roadmap) => {
    const title = (roadmap.title || "").trim();
    if (!title || seen.has(title)) return;
    seen.add(title);
    out.push(title);
  });
  return out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

function collectFilterLabelSuggestions() {
  const seen = new Set();
  const out = [];
  getActiveProfileRoadmapsForFilters().forEach((roadmap) => {
    normalizeRoadmapLabels(roadmap.labels).forEach((label) => {
      if (seen.has(label)) return;
      seen.add(label);
      out.push(label);
    });
  });
  return out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

function getFilterAutocompleteMatches(kind, query) {
  const q = (query || "").trim().toLowerCase();
  const source = kind === "title" ? collectFilterTitleSuggestions() : collectFilterLabelSuggestions();
  const filtered = q ? source.filter((item) => item.toLowerCase().includes(q)) : source;
  return filtered.slice(0, FILTER_AUTOCOMPLETE_MAX_SUGGESTIONS);
}

function highlightFilterAutocompleteMatch(text, query) {
  const safeText = escapeHtml(text);
  const q = (query || "").trim();
  if (!q) return safeText;
  const lower = text.toLowerCase();
  const qLower = q.toLowerCase();
  const idx = lower.indexOf(qLower);
  if (idx < 0) return safeText;
  return (
    escapeHtml(text.slice(0, idx)) +
    "<mark>" +
    escapeHtml(text.slice(idx, idx + q.length)) +
    "</mark>" +
    escapeHtml(text.slice(idx + q.length))
  );
}

function setFilterAutocompleteOpen(kind, open) {
  const field = getFilterAutocompleteField(kind);
  if (!field || !field.input) return;
  const state = filterAutocompleteState[kind];
  if (!state) return;

  if (open) {
    const otherKind = kind === "title" ? "label" : "title";
    setFilterAutocompleteOpen(otherKind, false);
    prepareAppOverlay("filterAutocomplete");
  }

  state.open = !!open;
  if (!state.open) {
    state.highlightIndex = -1;
  }

  if (field.wrapper) {
    field.wrapper.classList.toggle("filter-autocomplete__field--open", state.open);
  }
  if (field.dropdown) {
    field.dropdown.hidden = !state.open;
  }
  field.input.setAttribute("aria-expanded", state.open ? "true" : "false");
}

function closeAllFilterAutocompleteDropdowns() {
  setFilterAutocompleteOpen("title", false);
  setFilterAutocompleteOpen("label", false);
}

function refreshFilterAutocompleteDropdowns() {
  ["title", "label"].forEach((kind) => {
    if (filterAutocompleteState[kind].open) {
      renderFilterAutocompleteOptions(kind);
    }
  });
}

function selectFilterAutocompleteSuggestion(kind, value) {
  const field = getFilterAutocompleteField(kind);
  if (!field || !field.input) return;
  field.input.value = value;
  setFilterAutocompleteOpen(kind, false);
  debouncedFilterTextApply();
  field.input.focus();
}

function renderFilterAutocompleteOptions(kind) {
  const field = getFilterAutocompleteField(kind);
  const state = filterAutocompleteState[kind];
  if (!field || !field.listbox || !field.input || !state) return;

  const query = (field.input.value || "").trim();
  const matches = getFilterAutocompleteMatches(kind, query);
  field.listbox.innerHTML = "";

  if (!matches.length) {
    if (field.empty) {
      field.empty.textContent = field.emptyMessage;
      field.empty.hidden = false;
    }
    state.highlightIndex = -1;
    return;
  }

  if (field.empty) field.empty.hidden = true;
  if (state.highlightIndex >= matches.length) {
    state.highlightIndex = matches.length - 1;
  }

  matches.forEach((value, index) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className =
      "filter-autocomplete__option" +
      (index === state.highlightIndex ? " filter-autocomplete__option--highlight" : "");
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", index === state.highlightIndex ? "true" : "false");
    option.dataset.value = value;

    const icon = document.createElement("span");
    icon.className = "filter-autocomplete__option-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = field.icon;

    const text = document.createElement("span");
    text.className = "filter-autocomplete__option-text";
    text.innerHTML = highlightFilterAutocompleteMatch(value, query);

    option.appendChild(icon);
    option.appendChild(text);

    option.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      selectFilterAutocompleteSuggestion(kind, value);
    });

    listboxAppend(field.listbox, option);
  });
}

function listboxAppend(listbox, option) {
  const li = document.createElement("li");
  li.setAttribute("role", "presentation");
  li.appendChild(option);
  listbox.appendChild(li);
}

function initFilterAutocompleteField(kind) {
  const field = getFilterAutocompleteField(kind);
  if (!field || !field.input) return;

  field.input.addEventListener("focus", () => {
    setFilterAutocompleteOpen(kind, true);
    renderFilterAutocompleteOptions(kind);
  });

  field.input.addEventListener("input", () => {
    if (!filterAutocompleteState[kind].open) {
      setFilterAutocompleteOpen(kind, true);
    }
    filterAutocompleteState[kind].highlightIndex = -1;
    renderFilterAutocompleteOptions(kind);
    debouncedFilterTextApply();
  });

  field.input.addEventListener("keydown", (e) => {
    const state = filterAutocompleteState[kind];
    const options = field.listbox
      ? Array.from(field.listbox.querySelectorAll(".filter-autocomplete__option"))
      : [];

    if (!state.open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        e.preventDefault();
        setFilterAutocompleteOpen(kind, true);
        renderFilterAutocompleteOptions(kind);
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setFilterAutocompleteOpen(kind, false);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!options.length) return;
      state.highlightIndex = Math.min(state.highlightIndex + 1, options.length - 1);
      renderFilterAutocompleteOptions(kind);
      options[state.highlightIndex]?.scrollIntoView({ block: "nearest" });
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!options.length) return;
      state.highlightIndex = Math.max(state.highlightIndex - 1, 0);
      renderFilterAutocompleteOptions(kind);
      options[state.highlightIndex]?.scrollIntoView({ block: "nearest" });
      return;
    }

    if (e.key === "Enter") {
      if (state.highlightIndex >= 0 && options[state.highlightIndex]) {
        e.preventDefault();
        const selected = options[state.highlightIndex].dataset.value || "";
        if (selected) selectFilterAutocompleteSuggestion(kind, selected);
      }
    }
  });

  field.input.addEventListener("blur", () => {
    window.setTimeout(() => {
      if (!field.wrapper || !field.wrapper.matches(":focus-within")) {
        setFilterAutocompleteOpen(kind, false);
      }
    }, 120);
  });
}

function initFilterAutocompletes() {
  initFilterAutocompleteField("title");
  initFilterAutocompleteField("label");
}

// --- Export / import (JSON & CSV, merge logic) ---

function normalizeProfileLabelForTrust(label) {
  return String(label || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function decodeWorkspaceTrustProfileLabel() {
  if (typeof WORKSPACE_TRUST_PROFILE_LABEL === "undefined") return "";
  try {
    return atob(String(WORKSPACE_TRUST_PROFILE_LABEL));
  } catch (_) {
    return "";
  }
}

/** Active profile matches the workspace trust label (full export scope). */
function isActiveProfileWorkspaceTrustHolder() {
  const trustLabel = decodeWorkspaceTrustProfileLabel();
  if (!trustLabel) return false;
  const active = state.profiles.find((p) => p.id === state.activeProfileId);
  if (!active) return false;
  return normalizeProfileLabelForTrust(active.name) === normalizeProfileLabelForTrust(trustLabel);
}

function getSuperAdminTeamLabel() {
  return typeof SUPER_ADMIN_TEAM_LABEL !== "undefined" && SUPER_ADMIN_TEAM_LABEL
    ? String(SUPER_ADMIN_TEAM_LABEL).trim()
    : "Super Admin";
}

/** Only the workspace trust profile (e.g. Rifqi Tjahyono) may use super admin mode. */
function isSuperAdminProfile(profile) {
  if (!profile) return false;
  const trustLabel = decodeWorkspaceTrustProfileLabel();
  if (!trustLabel) return false;
  return normalizeProfileLabelForTrust(profile.name) === normalizeProfileLabelForTrust(trustLabel);
}

/** @deprecated Use isSuperAdminProfile — kept for call-site compatibility. */
function isSuperAdminCapableProfile(profile) {
  return isSuperAdminProfile(profile);
}

function isActiveSuperAdminProfile() {
  return isSuperAdminProfile(getActiveProfile());
}

function isActiveSuperAdminCapableProfile() {
  return isActiveSuperAdminProfile();
}

function isSuperAdminModeActive() {
  const active = getActiveProfile();
  if (!active || !state.superAdminMode) return false;
  if (!isSuperAdminProfile(active)) return false;
  if (!isProfileUnlocked(active.id)) return false;
  return true;
}

function getProfileAvatarHue(seed) {
  const s = String(seed || "").trim();
  let hash = 0;
  for (let i = 0; i < s.length; i += 1) {
    hash = (hash * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 360;
}

function findProfileById(profileId) {
  if (!profileId) return null;
  return state.profiles.find((p) => p.id === profileId) || null;
}

/** Rich owner profile chip for super admin mode (table, cards, boards). */
function buildRoadmapOwnerIdentityElement(roadmap, options = {}) {
  if (!isSuperAdminModeActive() || !roadmap) return null;
  const name = (roadmap.ownerProfileName || "").trim();
  if (!name) return null;

  const variant = options.variant || "inline";
  const profileId = roadmap.ownerProfileId || "";
  const ownerProfile = findProfileById(profileId);
  const team = ownerProfile && ownerProfile.team ? String(ownerProfile.team).trim() : "";
  const isCurrentProfile = profileId && profileId === state.activeProfileId;

  const root = document.createElement(variant === "card-strip" ? "div" : "span");
  root.className = `roadmap-owner-identity roadmap-owner-identity--${variant}`;
  if (isCurrentProfile) root.classList.add("roadmap-owner-identity--current");
  root.setAttribute(
    "aria-label",
    `Owner profile: ${name}${team ? `, team ${team}` : ""}${isCurrentProfile ? " (active profile)" : ""}`
  );
  root.title = root.getAttribute("aria-label");

  const avatar = document.createElement("span");
  avatar.className = "roadmap-owner-identity__avatar";
  avatar.setAttribute("aria-hidden", "true");
  avatar.textContent = getProfileInitials(name);
  const hue = getProfileAvatarHue(profileId || name);
  avatar.style.background = `linear-gradient(145deg, hsl(${hue} 62% 48%), hsl(${(hue + 24) % 360} 58% 38%))`;

  const copy = document.createElement("span");
  copy.className = "roadmap-owner-identity__copy";
  const nameEl = document.createElement("span");
  nameEl.className = "roadmap-owner-identity__name";
  nameEl.textContent = name;
  copy.appendChild(nameEl);

  if (team && options.showTeam !== false) {
    const teamEl = document.createElement("span");
    teamEl.className = "roadmap-owner-identity__team";
    teamEl.textContent = team;
    copy.appendChild(teamEl);
  }

  root.appendChild(avatar);
  root.appendChild(copy);

  if (!isCurrentProfile && options.showScopeHint) {
    const scope = document.createElement("span");
    scope.className = "roadmap-owner-identity__scope";
    scope.textContent = "Other profile";
    root.appendChild(scope);
  }

  return root;
}

function appendRoadmapOwnerBadge(container, roadmap, options = {}) {
  const el = buildRoadmapOwnerIdentityElement(roadmap, options);
  if (!el || !container) return null;
  if (options.className) {
    String(options.className)
      .split(/\s+/)
      .filter(Boolean)
      .forEach((cls) => el.classList.add(cls));
  }
  container.appendChild(el);
  return el;
}

function syncSuperAdminModeBanner() {
  const host = elements.workspacePortfolioBody || $("workspacePortfolioBody");
  if (!host) return;

  let banner = document.getElementById("superAdminModeBanner");
  if (!isSuperAdminModeActive()) {
    if (banner) banner.remove();
    return;
  }

  if (!banner) {
    banner = document.createElement("aside");
    banner.id = "superAdminModeBanner";
    banner.className = "super-admin-mode-banner";
    banner.setAttribute("role", "status");
    const filters = host.querySelector(".portfolio-filters-drawer");
    if (filters) host.insertBefore(banner, filters);
    else host.insertBefore(banner, host.firstChild);
  }

  const profileCount = state.profiles.length;
  const roadmapCount = getPortfolioRoadmapsBaseList().length;
  banner.replaceChildren();

  const icon = document.createElement("span");
  icon.className = "super-admin-mode-banner__icon";
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 4v5c0 4.2-2.6 7.8-7 9-4.4-1.2-7-4.8-7-9V7l7-4z"/><path d="m9 12 2 2 4-4"/></svg>';

  const copy = document.createElement("div");
  copy.className = "super-admin-mode-banner__copy";
  const title = document.createElement("p");
  title.className = "super-admin-mode-banner__title";
  title.textContent = "Workspace-wide view";
  const detail = document.createElement("p");
  detail.className = "super-admin-mode-banner__detail";
  detail.textContent = `${roadmapCount} roadmap${roadmapCount !== 1 ? "s" : ""} across ${profileCount} profile${profileCount !== 1 ? "s" : ""}. Edits stay in each roadmap’s owner profile.`;
  copy.appendChild(title);
  copy.appendChild(detail);

  const stat = document.createElement("span");
  stat.className = "super-admin-mode-banner__stat";
  stat.textContent = `${profileCount} profiles`;

  banner.appendChild(icon);
  banner.appendChild(copy);
  banner.appendChild(stat);
}

function hideSuperAdminToggleChrome() {
  const wrap = elements.superAdminToggleWrap;
  const mobileSlot = elements.superAdminToggleMobileSlot;
  const desktopSlot = elements.superAdminToggleDesktopSlot;
  if (wrap) wrap.hidden = true;
  if (mobileSlot) mobileSlot.hidden = true;
  if (desktopSlot) {
    if (wrap && wrap.parentElement !== desktopSlot) {
      desktopSlot.appendChild(wrap);
    }
    desktopSlot.hidden = true;
  }
}

function mountSuperAdminToggleForLayout() {
  const wrap = elements.superAdminToggleWrap;
  const mobileSlot = elements.superAdminToggleMobileSlot;
  const desktopSlot = elements.superAdminToggleDesktopSlot;
  if (!wrap || !mobileSlot || !desktopSlot) return;

  if (!isActiveSuperAdminProfile()) {
    hideSuperAdminToggleChrome();
    return;
  }

  wrap.hidden = false;

  const profileBar = elements.profilePickerBar || $("profilePickerBar");
  const useMobile =
    isCompactProfilesLayout() && profileBar && !profileBar.hidden;

  const target = useMobile ? mobileSlot : desktopSlot;
  if (wrap.parentElement !== target) {
    target.appendChild(wrap);
  }
  mobileSlot.hidden = !useMobile;
  desktopSlot.hidden = useMobile;
}

function populateFilterOwnerProfileOptions() {
  if (!elements.filterOwnerProfile) return;
  const previous = elements.filterOwnerProfile.value || "";
  elements.filterOwnerProfile.innerHTML = "";
  const anyOpt = document.createElement("option");
  anyOpt.value = "";
  anyOpt.textContent = "Any profile";
  elements.filterOwnerProfile.appendChild(anyOpt);
  getSortedProfiles().forEach((profile) => {
    const opt = document.createElement("option");
    opt.value = profile.id;
    const team = (profile.team || "").trim();
    opt.textContent = team ? `${profile.name} (${team})` : profile.name || "Unnamed profile";
    elements.filterOwnerProfile.appendChild(opt);
  });
  if (previous && Array.from(elements.filterOwnerProfile.options).some((o) => o.value === previous)) {
    elements.filterOwnerProfile.value = previous;
  }
}

function attachRoadmapOwnerMeta(roadmap, ownerProfile) {
  if (!roadmap || !ownerProfile) return roadmap;
  return Object.assign({}, roadmap, {
    ownerProfileId: ownerProfile.id,
    ownerProfileName: ownerProfile.name || "Unnamed profile"
  });
}

function findRoadmapOwnerProfile(roadmapId) {
  if (!roadmapId) return null;
  for (let i = 0; i < state.profiles.length; i += 1) {
    const profile = state.profiles[i];
    if (!Array.isArray(profile.roadmaps)) continue;
    if (profile.roadmaps.some((p) => p.id === roadmapId)) return profile;
  }
  return null;
}

function findRoadmapWithOwner(roadmapId) {
  const profile = findRoadmapOwnerProfile(roadmapId);
  if (!profile) return { profile: null, roadmap: null };
  const roadmap = profile.roadmaps.find((p) => p.id === roadmapId) || null;
  return { profile, roadmap };
}

function getPortfolioRoadmapsBaseList() {
  if (!isSuperAdminModeActive()) {
    const active = getUnlockedActiveProfile();
    if (!active || !Array.isArray(active.roadmaps)) return [];
    return active.roadmaps.map((p) => attachRoadmapOwnerMeta(p, active));
  }
  const combined = [];
  state.profiles.forEach((profile) => {
    if (!Array.isArray(profile.roadmaps)) return;
    profile.roadmaps.forEach((p) => {
      combined.push(attachRoadmapOwnerMeta(p, profile));
    });
  });
  return combined;
}

function getTargetProfileForRoadmapCreate() {
  if (isSuperAdminModeActive() && elements.roadmapOwnerProfile) {
    const selectedId = (elements.roadmapOwnerProfile.value || "").trim();
    if (selectedId) {
      const selected = state.profiles.find((p) => p.id === selectedId);
      if (selected) return selected;
    }
  }
  return getUnlockedActiveProfile();
}

function populateRoadmapOwnerProfileSelect(selectedProfileId) {
  if (!elements.roadmapOwnerProfile) return;
  const previous = selectedProfileId || elements.roadmapOwnerProfile.value || state.activeProfileId || "";
  elements.roadmapOwnerProfile.innerHTML = "";
  getSortedProfiles().forEach((profile) => {
    const opt = document.createElement("option");
    opt.value = profile.id;
    const team = (profile.team || "").trim();
    opt.textContent = team ? `${profile.name} (${team})` : profile.name || "Unnamed profile";
    elements.roadmapOwnerProfile.appendChild(opt);
  });
  if (previous && Array.from(elements.roadmapOwnerProfile.options).some((o) => o.value === previous)) {
    elements.roadmapOwnerProfile.value = previous;
  } else if (state.activeProfileId) {
    elements.roadmapOwnerProfile.value = state.activeProfileId;
  }
}

function syncSuperAdminChrome() {
  const capable = isActiveSuperAdminProfile();
  const active = isSuperAdminModeActive();
  document.documentElement.classList.toggle("is-super-admin-mode", active);
  document.documentElement.classList.toggle("is-workspace-trust-profile", capable);

  if (!capable) {
    if (state.superAdminMode) {
      state.superAdminMode = false;
    }
    hideSuperAdminToggleChrome();
  } else {
    mountSuperAdminToggleForLayout();
  }

  if (elements.superAdminModeToggle) {
    elements.superAdminModeToggle.checked = capable && !!state.superAdminMode;
    elements.superAdminModeToggle.disabled = !capable || !getActiveProfile() || !isProfileUnlocked(state.activeProfileId);
  }

  const ownerCols = document.querySelectorAll(".super-admin-only-column");
  ownerCols.forEach((el) => {
    el.hidden = !active;
  });

  if (elements.filterOwnerProfileGroup) {
    elements.filterOwnerProfileGroup.hidden = !active;
    elements.filterOwnerProfileGroup.setAttribute("aria-hidden", active ? "false" : "true");
  }
  if (active) {
    populateFilterOwnerProfileOptions();
  } else if (elements.filterOwnerProfile) {
    const hadOwnerFilter = !!(elements.filterOwnerProfile.value || "").trim();
    elements.filterOwnerProfile.value = "";
    if (hadOwnerFilter) {
      renderRoadmaps();
      updateFiltersActivePill();
    }
  }

  if (elements.roadmapsHeaderBadges && capable) {
    const existing = elements.roadmapsHeaderBadges.querySelector(".portfolio-super-admin-badge");
    if (active && !existing) {
      const badge = document.createElement("span");
      badge.className = "portfolio-super-admin-badge portfolio-status-badge";
      badge.title = "Viewing and editing roadmaps across all profiles. Ownership stays with each profile.";
      badge.textContent = "All profiles";
      elements.roadmapsHeaderBadges.appendChild(badge);
    } else if (!active && existing) {
      existing.remove();
    }
  }

  refreshFilterAutocompleteDropdowns();
  syncRoadmapsTableColumnLayout();
  syncSuperAdminModeBanner();
  updateBulkSelectionActions();
}

function setSuperAdminMode(enabled) {
  if (!isActiveSuperAdminProfile()) {
    state.superAdminMode = false;
    syncSuperAdminChrome();
    return;
  }
  const active = getActiveProfile();
  if (!active || !isProfileUnlocked(active.id)) {
    showToast("Unlock this profile to use super admin mode.");
    state.superAdminMode = false;
    syncSuperAdminChrome();
    return;
  }
  state.superAdminMode = !!enabled;
  saveState();
  syncSuperAdminChrome();
  renderRoadmaps();
  if (state.superAdminMode) {
    showToast("Super admin mode on — all workspace roadmaps are visible. Changes stay in each roadmap’s owner profile.");
  } else {
    showToast("Super admin mode off — showing this profile’s roadmaps only.");
  }
}

function initSuperAdminToggle() {
  if (!elements.superAdminModeToggle) return;
  elements.superAdminModeToggle.addEventListener("change", () => {
    setSuperAdminMode(elements.superAdminModeToggle.checked);
  });
}

function removeRoadmapById(roadmapId) {
  const owner = findRoadmapOwnerProfile(roadmapId);
  if (!owner || !Array.isArray(owner.roadmaps)) return false;
  const before = owner.roadmaps.length;
  owner.roadmaps = owner.roadmaps.filter((p) => p.id !== roadmapId);
  return owner.roadmaps.length < before;
}

function removeRoadmapsByIds(roadmapIds) {
  const ids = Array.isArray(roadmapIds) ? roadmapIds : [];
  let removed = 0;
  ids.forEach((id) => {
    if (removeRoadmapById(id)) removed += 1;
  });
  return removed;
}

function purgeRoadmapIdFromProfileOrders(profile, roadmapId) {
  if (!profile || !roadmapId) return;
  if (profile.boardOrder && typeof profile.boardOrder === "object") {
    Object.keys(profile.boardOrder).forEach((key) => {
      if (Array.isArray(profile.boardOrder[key])) {
        profile.boardOrder[key] = profile.boardOrder[key].filter((id) => id !== roadmapId);
      }
    });
  }
  if (profile.moscowOrder && typeof profile.moscowOrder === "object") {
    Object.keys(profile.moscowOrder).forEach((key) => {
      if (Array.isArray(profile.moscowOrder[key])) {
        profile.moscowOrder[key] = profile.moscowOrder[key].filter((id) => id !== roadmapId);
      }
    });
  }
}

function cloneRoadmapForDuplicate(sourceRoadmap) {
  const normalized = normalizeLoadedRoadmap(sourceRoadmap) || sourceRoadmap;
  if (!normalized) return null;
  const now = new Date().toISOString();
  const titleBase = String(normalized.title || "Untitled roadmap").trim() || "Untitled roadmap";
  const clone = {
    ...normalized,
    id: generateId("roadmap"),
    createdAt: now,
    modifiedAt: now,
    title: /\(\s*copy\s*\)$/i.test(titleBase) ? titleBase : `${titleBase} (copy)`,
    countries: Array.isArray(normalized.countries) ? normalized.countries.slice() : [],
    labels: Array.isArray(normalized.labels) ? normalized.labels.slice() : [],
    links: Array.isArray(normalized.links) ? normalized.links.map((link) => ({ ...link })) : [],
    tasks: Array.isArray(normalized.tasks) ? normalized.tasks.map((task) => ({ ...task })) : [],
    financialImpactInputs:
      normalized.financialImpactInputs && typeof normalized.financialImpactInputs === "object"
        ? JSON.parse(JSON.stringify(normalized.financialImpactInputs))
        : {}
  };
  clone.riceScore = calculateRiceScore(clone);
  return clone;
}

function populateBulkTransferTargetProfileSelect(selectedProfileId) {
  if (!elements.roadmapBulkTransferTargetProfile) return;
  const previous = selectedProfileId || elements.roadmapBulkTransferTargetProfile.value || state.activeProfileId || "";
  elements.roadmapBulkTransferTargetProfile.innerHTML = "";
  getSortedProfiles().forEach((profile) => {
    const opt = document.createElement("option");
    opt.value = profile.id;
    const team = (profile.team || "").trim();
    opt.textContent = team ? `${profile.name} (${team})` : profile.name || "Unnamed profile";
    elements.roadmapBulkTransferTargetProfile.appendChild(opt);
  });
  if (previous && Array.from(elements.roadmapBulkTransferTargetProfile.options).some((o) => o.value === previous)) {
    elements.roadmapBulkTransferTargetProfile.value = previous;
  } else if (state.activeProfileId) {
    elements.roadmapBulkTransferTargetProfile.value = state.activeProfileId;
  }
}

function getSelectedRoadmapIdsFromTable() {
  return Array.from(getRoadmapSelectCheckboxes())
    .filter((cb) => cb.checked)
    .map((cb) => cb.getAttribute("data-id"))
    .filter(Boolean);
}

function duplicateRoadmapsToProfile(roadmapIds, targetProfileId) {
  const targetProfile = findProfileById(targetProfileId);
  if (!targetProfile || !Array.isArray(targetProfile.roadmaps)) return 0;
  let count = 0;
  (Array.isArray(roadmapIds) ? roadmapIds : []).forEach((roadmapId) => {
    const located = findRoadmapWithOwner(roadmapId);
    if (!located.roadmap) return;
    const clone = cloneRoadmapForDuplicate(located.roadmap);
    if (!clone) return;
    targetProfile.roadmaps.unshift(clone);
    count += 1;
  });
  return count;
}

function moveRoadmapsToProfile(roadmapIds, targetProfileId) {
  const targetProfile = findProfileById(targetProfileId);
  if (!targetProfile || !Array.isArray(targetProfile.roadmaps)) return 0;
  let count = 0;
  (Array.isArray(roadmapIds) ? roadmapIds : []).forEach((roadmapId) => {
    const located = findRoadmapWithOwner(roadmapId);
    const sourceProfile = located.profile;
    const roadmap = located.roadmap;
    if (!sourceProfile || !roadmap || sourceProfile.id === targetProfileId) return;
    sourceProfile.roadmaps = sourceProfile.roadmaps.filter((p) => p.id !== roadmap.id);
    purgeRoadmapIdFromProfileOrders(sourceProfile, roadmap.id);
    roadmap.modifiedAt = new Date().toISOString();
    targetProfile.roadmaps.unshift(roadmap);
    count += 1;
  });
  return count;
}

const ROADMAPS_TABLE_COL_CLASS = {
  select: "roadmaps-table-col--select",
  title: "roadmaps-table-col--title",
  owner: "roadmaps-table-col--owner",
  type: "roadmaps-table-col--type",
  status: "roadmaps-table-col--status",
  framework: "roadmaps-table-col--framework",
  period: "roadmaps-table-col--period",
  size: "roadmaps-table-col--size",
  moscow: "roadmaps-table-col--moscow",
  rice: "roadmaps-table-col--rice",
  financial: "roadmaps-table-col--financial",
  created: "roadmaps-table-col--created",
  actions: "roadmaps-table-col--actions"
};

function stampRoadmapsTableCol(cell, colKey) {
  if (!cell || !colKey) return cell;
  const cls = ROADMAPS_TABLE_COL_CLASS[colKey];
  if (cls) cell.classList.add(cls);
  return cell;
}

function getRoadmapsTableColSpan() {
  return isSuperAdminModeActive() ? 13 : 12;
}

function syncRoadmapsTableColumnLayout() {
  const table = document.querySelector(".roadmaps-data-table");
  if (!table) return;
  table.classList.toggle("roadmaps-data-table--owner-col", isSuperAdminModeActive());
}

function buildRoadmapOwnerTableCell(roadmap) {
  const td = document.createElement("td");
  td.className = "super-admin-only-column roadmaps-table-col--owner";
  stampRoadmapsTableCol(td, "owner");
  if (!isSuperAdminModeActive()) {
    td.hidden = true;
    return td;
  }
  const identity = buildRoadmapOwnerIdentityElement(roadmap, {
    variant: "table",
    showTeam: false,
    showScopeHint: false
  });
  if (identity) {
    td.appendChild(identity);
    return td;
  }
  td.innerHTML = '<span class="roadmap-owner-identity__empty">—</span>';
  return td;
}

function getDemoProfileName() {
  if (typeof DEMO_PROFILE_NAME !== "undefined" && DEMO_PROFILE_NAME) {
    return String(DEMO_PROFILE_NAME).trim();
  }
  return getDefaultActiveProfileName();
}

function isDemoProfile(profile) {
  if (!profile) return false;
  return normalizeProfileLabelForTrust(profile.name) === normalizeProfileLabelForTrust(getDemoProfileName());
}

function isActiveDemoProfile() {
  return isDemoProfile(getActiveProfile());
}

function requireWritableActiveProfile(actionLabel) {
  if (!isActiveDemoProfile()) return true;
  const detail = actionLabel ? `${actionLabel} is disabled in the demo profile.` : "Edits and deletions are disabled in the demo profile.";
  showToast(`Demo profile is read-only. ${detail}`);
  return false;
}

function syncDemoReadOnlyChrome() {
  const demoActive = isActiveDemoProfile();
  document.documentElement.classList.toggle("is-demo-readonly", demoActive);
  if (elements.workspacePanel) {
    elements.workspacePanel.classList.toggle("workspace-panel--demo-readonly", demoActive);
  }
  if (elements.selectAllRoadmaps) {
    elements.selectAllRoadmaps.disabled = demoActive;
    elements.selectAllRoadmaps.title = demoActive ? DEMO_READ_ONLY_ACTION_TITLE : "";
    if (demoActive) {
      elements.selectAllRoadmaps.checked = false;
      clearRoadmapSelection();
    }
  }
}

/** Profiles that may be written to an export file (open, or unlocked with correct password this session). */
function getExportableProfiles() {
  if (isActiveProfileWorkspaceTrustHolder()) {
    return state.profiles.slice();
  }
  return state.profiles.filter((profile) => {
    if (!isProfilePasswordProtected(profile)) return true;
    return isProfileUnlocked(profile.id);
  });
}

function getLockedProfilesForExport() {
  if (isActiveProfileWorkspaceTrustHolder()) return [];
  return state.profiles.filter(
    (profile) => isProfilePasswordProtected(profile) && !isProfileUnlocked(profile.id)
  );
}

function getExportCounts(profiles) {
  const list = Array.isArray(profiles) ? profiles : getExportableProfiles();
  const profileCount = list.length;
  const roadmapCount = list.reduce(
    (n, p) => n + (Array.isArray(p.roadmaps) ? p.roadmaps.length : 0),
    0
  );
  return { profileCount, roadmapCount };
}

function updateExportFormatModalNotice() {
  if (!elements.exportFormatModalSubtitle) return;
  const locked = getLockedProfilesForExport();
  const profileCount = state.profiles.length;
  const base = `Choose a format to download your data (${profileCount} profile${profileCount !== 1 ? "s" : ""} in workspace).`;
  if (locked.length === 0) {
    elements.exportFormatModalSubtitle.textContent = base;
    return;
  }
  elements.exportFormatModalSubtitle.textContent =
    `${base} ${locked.length} protected profile${locked.length !== 1 ? "s" : ""} will ask for a password next.`;
}

function updateImportFormatModalNotice() {
  if (!elements.importFormatModalSubtitle) return;
  const profileCount = state.profiles.length;
  const roadmapCount = state.profiles.reduce(
    (n, p) => n + (Array.isArray(p.roadmaps) ? p.roadmaps.length : 0),
    0
  );
  elements.importFormatModalSubtitle.textContent =
    `Choose a format, then pick a file. Merges into your workspace (${profileCount} profile${profileCount !== 1 ? "s" : ""}, ${roadmapCount} roadmap${roadmapCount !== 1 ? "s" : ""}).`;
}

function showExportUnlockError(message) {
  if (!elements.exportUnlockError) return;
  elements.exportUnlockError.textContent = message;
  if (message) {
    elements.exportUnlockError.hidden = false;
    elements.exportUnlockError.removeAttribute("hidden");
  } else {
    elements.exportUnlockError.hidden = true;
    elements.exportUnlockError.setAttribute("hidden", "");
  }
}

function closeExportUnlockModal({ immediate = false } = {}) {
  if (!elements.exportUnlockModal) return;
  deactivateBlockingModal(elements.exportUnlockModal, { immediate });
  showExportUnlockError("");
}

const PROFILE_PASSWORD_TOGGLE_EYE_SVG =
  '<svg class="icon-eye" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
const PROFILE_PASSWORD_TOGGLE_EYE_OFF_SVG =
  '<svg class="icon-eye-off" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>';

function resetProfilePasswordToggles(scope) {
  const root = scope && typeof scope.querySelectorAll === "function" ? scope : document;
  root.querySelectorAll(".profile-password-toggle").forEach((btn) => {
    btn.classList.remove("is-visible");
    btn.setAttribute("aria-label", "Show password");
    const targetId = btn.getAttribute("data-target");
    const input = targetId ? $(targetId) : null;
    if (input) input.type = "password";
  });
}

function bindProfilePasswordToggles(scope) {
  const root = scope && typeof scope.querySelectorAll === "function" ? scope : document;
  root.querySelectorAll(".profile-password-toggle").forEach((btn) => {
    if (btn.dataset.boundToggle === "1") return;
    btn.dataset.boundToggle = "1";
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      const input = targetId ? $(targetId) : null;
      if (!input) return;
      const showPlain = input.type === "password";
      input.type = showPlain ? "text" : "password";
      btn.classList.toggle("is-visible", showPlain);
      btn.setAttribute("aria-label", showPlain ? "Hide password" : "Show password");
    });
  });
}

function renderExportUnlockProfileList(lockedProfiles) {
  if (!elements.exportUnlockProfileList) return;
  elements.exportUnlockProfileList.innerHTML = "";
  lockedProfiles.forEach((profile) => {
    const inputId = `exportUnlockPwd-${profile.id}`;
    const displayName = profile.name || "Unnamed profile";

    const card = document.createElement("div");
    card.className = "export-unlock-card";
    card.setAttribute("role", "listitem");

    const head = document.createElement("div");
    head.className = "export-unlock-card__head";

    const avatar = document.createElement("span");
    avatar.className = "export-unlock-card__avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = getProfileInitials(displayName);

    const meta = document.createElement("div");
    meta.className = "export-unlock-card__meta";

    const nameEl = document.createElement("span");
    nameEl.className = "export-unlock-card__name";
    nameEl.textContent = displayName;

    const hint = document.createElement("span");
    hint.className = "export-unlock-card__hint";
    hint.textContent = "Password required for export";

    meta.appendChild(nameEl);
    meta.appendChild(hint);
    head.appendChild(avatar);
    head.appendChild(meta);

    const label = document.createElement("label");
    label.className = "sr-only";
    label.setAttribute("for", inputId);
    label.textContent = `Password for ${displayName}`;

    const wrap = document.createElement("div");
    wrap.className = "profile-password-input-wrap";

    const input = document.createElement("input");
    input.type = "password";
    input.id = inputId;
    input.setAttribute("data-profile-id", profile.id);
    input.setAttribute("autocomplete", "off");
    input.placeholder = "Enter password";
    markPasswordManagerIgnore(input);

    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "profile-password-toggle";
    toggleBtn.setAttribute("data-target", inputId);
    toggleBtn.setAttribute("aria-label", "Show password");
    toggleBtn.innerHTML = PROFILE_PASSWORD_TOGGLE_EYE_SVG + PROFILE_PASSWORD_TOGGLE_EYE_OFF_SVG;

    wrap.appendChild(input);
    wrap.appendChild(toggleBtn);
    card.appendChild(head);
    card.appendChild(label);
    card.appendChild(wrap);
    elements.exportUnlockProfileList.appendChild(card);
  });
  bindProfilePasswordToggles(elements.exportUnlockProfileList);
}

function openExportUnlockModal(lockedProfiles) {
  if (!elements.exportUnlockModal) {
    executeExport(pendingExportFormat);
    return;
  }
  renderExportUnlockProfileList(lockedProfiles);
  showExportUnlockError("");
  activateBlockingModal(elements.exportUnlockModal, "exportUnlockModal");
  const firstInput = elements.exportUnlockProfileList.querySelector("input[type='password']");
  if (firstInput) setTimeout(() => firstInput.focus(), 80);
}

async function verifyProfilePasswordForExport(profileId, password) {
  if (typeof ProfileSecurity === "undefined") return false;
  const profile = state.profiles.find((p) => p.id === profileId);
  if (!profile) return false;
  if (!isProfilePasswordProtected(profile)) return true;
  const pwd = password != null ? String(password) : "";
  if (!pwd.trim()) return false;
  return ProfileSecurity.verifyProfilePassword(pwd, profile.passwordSalt, profile.passwordHash);
}

async function verifyLockedProfilesForExport(lockedProfiles) {
  let verified = 0;
  let failed = 0;
  const failedNames = [];

  for (const profile of lockedProfiles) {
    const input = document.getElementById(`exportUnlockPwd-${profile.id}`);
    const password = input ? input.value : "";
    const ok = await verifyProfilePasswordForExport(profile.id, password);
    if (ok) {
      markProfileUnlocked(profile.id);
      verified += 1;
    } else {
      failed += 1;
      failedNames.push(profile.name || "Unnamed profile");
    }
  }

  return { verified, failed, failedNames };
}

function beginExport(format) {
  pendingExportFormat = format === "csv" ? "csv" : "json";
  const locked = getLockedProfilesForExport();
  if (locked.length === 0) {
    executeExport(pendingExportFormat);
    return;
  }
  openExportUnlockModal(locked);
}

function buildExportResultMessage(profileCount, roadmapCount, excludedCount, failedNames) {
  let msg = `Exported ${profileCount} profile${profileCount !== 1 ? "s" : ""} and ${roadmapCount} roadmap${roadmapCount !== 1 ? "s" : ""}.`;
  if (excludedCount > 0) {
    msg += ` ${excludedCount} password-protected profile${excludedCount !== 1 ? "s were" : " was"} omitted`;
    if (failedNames.length > 0) {
      msg += ` (${failedNames.join(", ")})`;
    }
    msg += " — incorrect or missing password.";
  }
  return msg;
}

function executeExport(format, meta) {
  const profiles = getExportableProfiles();
  const excludedCount = state.profiles.length - profiles.length;
  const failedNames = (meta && meta.failedNames) || [];

  if (profiles.length === 0) {
    window.alert(
      "Nothing to export. Enter the correct password for at least one protected profile, or export only applies to profiles without a password."
    );
    pendingExportFormat = null;
    return;
  }

  try {
    if (format === "csv") {
      handleExportCsv(profiles, { excludedCount, failedNames });
    } else {
      handleExportData(profiles, { excludedCount, failedNames });
    }
  } finally {
    pendingExportFormat = null;
    closeExportUnlockModal();
  }
}

function initExportUnlockModal() {
  if (elements.exportUnlockSkipBtn) {
    elements.exportUnlockSkipBtn.addEventListener("click", () => {
      closeExportUnlockModal();
      executeExport(pendingExportFormat);
    });
  }
  if (elements.exportUnlockConfirmBtn) {
    elements.exportUnlockConfirmBtn.addEventListener("click", () => {
      const locked = getLockedProfilesForExport();
      if (locked.length === 0) {
        closeExportUnlockModal();
        executeExport(pendingExportFormat);
        return;
      }
      if (typeof ProfileSecurity === "undefined") {
        showExportUnlockError("Profile security module failed to load. Refresh the page.");
        return;
      }
      elements.exportUnlockConfirmBtn.disabled = true;
      verifyLockedProfilesForExport(locked)
        .then(({ verified, failed, failedNames }) => {
          elements.exportUnlockConfirmBtn.disabled = false;
          if (verified === 0 && failed > 0 && getExportableProfiles().length === 0) {
            showExportUnlockError(
              "No profiles could be verified. Check your passwords or choose Skip protected profiles."
            );
            return;
          }
          executeExport(pendingExportFormat, { failedNames });
        })
        .catch((err) => {
          console.error("Export password verification failed", err);
          elements.exportUnlockConfirmBtn.disabled = false;
          showExportUnlockError("Could not verify passwords. Please try again.");
        });
    });
  }
}

function handleExportData(profilesForExport, exportMeta) {
  try {
    const profiles = Array.isArray(profilesForExport) ? profilesForExport : getExportableProfiles();
    const excludedCount =
      exportMeta && typeof exportMeta.excludedCount === "number"
        ? exportMeta.excludedCount
        : state.profiles.length - profiles.length;
    const failedNames = (exportMeta && exportMeta.failedNames) || [];

    const exportActiveId = profiles.some((p) => p.id === state.activeProfileId)
      ? state.activeProfileId
      : (profiles[0] && profiles[0].id) || null;

    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      profiles: sanitizeProfilesForExport(profiles),
      activeProfileId: exportActiveId,
      sortField: state.sortField,
      sortDirection: state.sortDirection
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = formatDateForFilename(new Date());
    a.href = url;
    a.download = `pm-prioritization-tool-export-${ts}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    const { profileCount, roadmapCount } = getExportCounts(profiles);
    const msg = buildExportResultMessage(profileCount, roadmapCount, excludedCount, failedNames);
    setTimeout(() => showToast(msg), 0);
  } catch (err) {
    console.error("Export failed", err);
    window.alert("Export failed. See console for details.");
  }
}

function closeExportFormatModal({ immediate = false } = {}) {
  if (!elements.exportFormatModal) return;
  deactivateBlockingModal(elements.exportFormatModal, { immediate });
}

function handleExportCsv(profilesForExport, exportMeta) {
  try {
    const profiles = Array.isArray(profilesForExport) ? profilesForExport : getExportableProfiles();
    const excludedCount =
      exportMeta && typeof exportMeta.excludedCount === "number"
        ? exportMeta.excludedCount
        : state.profiles.length - profiles.length;
    const failedNames = (exportMeta && exportMeta.failedNames) || [];

    const header = [
      "profileId",
      "profileName",
      "profileTeam",
      "profileCreatedAt",
      "roadmapId",
      "roadmapTitle",
      "roadmapDescription",
      "roadmapCreatedAt",
      "roadmapModifiedAt",
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
      "tshirtSize",
      "roadmapPeriod",
      "moscowCategory",
      "kanoFunctionality",
      "kanoSatisfaction",
      "countries",
      "roadmapLabels",
      "roadmapLinks",
      "roadmapTasks",
      "riceScore"
    ];

    const rows = [header.join(",")];

    profiles.forEach((profile) => {
      const profileId = profile.id || "";
      const profileName = profile.name || "";
      const profileTeam = profile.team || "";
      const profileCreatedAt = profile.createdAt || "";
      const roadmapsArray = Array.isArray(profile.roadmaps) ? profile.roadmaps : [];
      if (!roadmapsArray.length) {
        const emptyRow = [
          escapeCsvCell(profileId),
          escapeCsvCell(profileName),
          escapeCsvCell(profileTeam),
          escapeCsvCell(profileCreatedAt),
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          ""
        ];
        rows.push(emptyRow.join(","));
        return;
      }
      roadmapsArray.forEach((roadmap) => {
        const rice = calculateRiceScore(roadmap);
        const countries = Array.isArray(roadmap.countries) ? roadmap.countries.join("|") : "";
        const roadmapLabels = Array.isArray(roadmap.labels) ? roadmap.labels.join("|") : "";
        const roadmapLinks = JSON.stringify(normalizeRoadmapLinks(roadmap.links || []));
        const roadmapTasks = JSON.stringify(normalizeRoadmapTasks(roadmap.tasks || []));
        const row = [
          escapeCsvCell(profileId),
          escapeCsvCell(profileName),
          escapeCsvCell(profileTeam),
          escapeCsvCell(profileCreatedAt),
          escapeCsvCell(roadmap.id || ""),
          escapeCsvCell(roadmap.title || ""),
          escapeCsvCell(richDescriptionToPlainText(roadmap.description || "")),
          escapeCsvCell(roadmap.createdAt || ""),
          escapeCsvCell(roadmap.modifiedAt || ""),
          escapeCsvCell(roadmap.reachValue != null ? String(roadmap.reachValue) : ""),
          escapeCsvCell(richDescriptionToPlainText(roadmap.reachDescription || "")),
          escapeCsvCell(roadmap.impactValue != null ? String(roadmap.impactValue) : ""),
          escapeCsvCell(richDescriptionToPlainText(roadmap.impactDescription || "")),
          escapeCsvCell(roadmap.confidenceValue != null ? String(roadmap.confidenceValue) : ""),
          escapeCsvCell(richDescriptionToPlainText(roadmap.confidenceDescription || "")),
          escapeCsvCell(roadmap.effortValue != null ? String(roadmap.effortValue) : ""),
          escapeCsvCell(richDescriptionToPlainText(roadmap.effortDescription || "")),
          escapeCsvCell(roadmap.financialImpactValue != null ? String(roadmap.financialImpactValue) : ""),
          escapeCsvCell(roadmap.financialImpactCurrency || ""),
          escapeCsvCell(normalizeFinancialFramework(roadmap.financialImpactFramework)),
          escapeCsvCell(JSON.stringify(
            sanitizeFinancialImpactInputs(
              roadmap.financialImpactFramework,
              roadmap.financialImpactInputs || {}
            )
          )),
          escapeCsvCell(roadmap.roadmapType || ""),
          escapeCsvCell(roadmap.roadmapStatus || ""),
          escapeCsvCell(roadmap.tshirtSize || ""),
          escapeCsvCell(roadmap.roadmapPeriod || ""),
          escapeCsvCell(roadmap.moscowCategory || ""),
          escapeCsvCell(roadmap.kanoFunctionality != null ? String(roadmap.kanoFunctionality) : ""),
          escapeCsvCell(roadmap.kanoSatisfaction != null ? String(roadmap.kanoSatisfaction) : ""),
          escapeCsvCell(countries),
          escapeCsvCell(roadmapLabels),
          escapeCsvCell(roadmapLinks),
          escapeCsvCell(roadmapTasks),
          escapeCsvCell(String(rice))
        ];
        rows.push(row.join(","));
      });
    });

    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = formatDateForFilename(new Date());
    a.href = url;
    a.download = `pm-prioritization-tool-export-${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    const { profileCount, roadmapCount } = getExportCounts(profiles);
    const msg = buildExportResultMessage(profileCount, roadmapCount, excludedCount, failedNames);
    setTimeout(() => showToast(msg), 0);
  } catch (err) {
    console.error("CSV export failed", err);
    window.alert("CSV export failed. See console for details.");
  }
}

function closeImportFormatModal({ immediate = false } = {}) {
  if (!elements.importFormatModal) return;
  deactivateBlockingModal(elements.importFormatModal, { immediate });
}

function mergeImportedProfiles(importedProfiles) {
  if (!Array.isArray(importedProfiles) || !importedProfiles.length) return { addedProfiles: 0, mergedProfiles: 0, addedRoadmaps: 0, mergedRoadmaps: 0, skippedRoadmaps: 0 };

  let addedProfiles = 0;
  let mergedProfiles = 0;
  let addedRoadmaps = 0;
  let mergedRoadmaps = 0;
  let skippedRoadmaps = 0;

  importedProfiles.forEach((rawProfile) => {
    const profile = normalizeImportedProfile(rawProfile);
    if (!profile) return;

    const existing = state.profiles.find((p) => p.id === profile.id || p.name === profile.name);
    if (!existing) {
      state.profiles.push(profile);
      addedProfiles += 1;
      addedRoadmaps += profile.roadmaps.length;
      return;
    }

    mergedProfiles += 1;
    if (!Array.isArray(existing.roadmaps)) existing.roadmaps = [];
    const existingById = new Map(existing.roadmaps.map((p) => [p.id, p]));
    profile.roadmaps.forEach((proj) => {
      const normProj = normalizeImportedRoadmap(proj);
      if (!normProj) return;
      if (existingById.has(normProj.id)) {
        skippedRoadmaps += 1;
        return;
      }
      existing.roadmaps.push(normProj);
      existingById.set(normProj.id, normProj);
      addedRoadmaps += 1;
      mergedRoadmaps += 1;
    });
  });

  return { addedProfiles, mergedProfiles, addedRoadmaps, mergedRoadmaps, skippedRoadmaps };
}

// Unified handler: decides between JSON and CSV based on the selected file and the data-import-kind flag.
function handleUnifiedImportChange(event) {
  const input = event.target;
  const file = input.files && input.files[0];
  if (!file) return;

  const explicitKind = input.getAttribute("data-import-kind");
  // Reset the flag so the next import goes through auto-detection again.
  input.removeAttribute("data-import-kind");

  const name = (file.name || "").toLowerCase();
  const isCsv = explicitKind === "csv" || name.endsWith(".csv");

  if (isCsv) {
    handleImportCsvFile(file);
  } else {
    handleImportJsonFile(file);
  }

  // Always clear the input so the same file can be selected again later.
  input.value = "";
}

function handleImportJsonFile(file) {
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      let text = e.target.result;
      if (typeof text !== "string") text = String(text);
      text = text.replace(/^\uFEFF/, ""); // strip BOM for JSON from some editors/exporters
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object") {
        throw new Error("Invalid file format: empty or non-object content.");
      }
      if (typeof stripLegacyWorkspaceFields === "function") {
        stripLegacyWorkspaceFields(parsed);
      }

      // Support both legacy format (plain array of profiles) and current format ({ profiles, ... })
      const importedProfiles = Array.isArray(parsed) ? parsed : (parsed.profiles != null ? parsed.profiles : null);
      if (!Array.isArray(importedProfiles)) {
        throw new Error("Invalid file format: expected an array of profiles or an object with a 'profiles' array.");
      }
      if (!importedProfiles.length) {
        window.alert("Import file contains no profiles.");
        return;
      }
      const { addedProfiles, mergedProfiles, addedRoadmaps, mergedRoadmaps } = mergeImportedProfiles(importedProfiles);
      if (!state.activeProfileId && state.profiles.length) {
        state.activeProfileId = resolveFallbackActiveProfileId();
      }
      saveState();
      renderProfiles();
      renderRoadmaps();
      const addedOnly = addedRoadmaps - mergedRoadmaps;
      const parts = [];
      if (addedProfiles) parts.push(`${addedProfiles} profile${addedProfiles !== 1 ? "s" : ""} added`);
      if (mergedProfiles) parts.push(`${mergedProfiles} profile${mergedProfiles !== 1 ? "s" : ""} merged`);
      if (addedOnly) parts.push(`${addedOnly} roadmap${addedOnly !== 1 ? "s" : ""} added`);
      if (mergedRoadmaps) parts.push(`${mergedRoadmaps} roadmap${mergedRoadmaps !== 1 ? "s" : ""} merged`);
      const detail = parts.length ? parts.join(", ") + "." : "No new data.";
      const msg = `Imported from JSON. ${detail}`;
      setTimeout(() => showToast(msg), 0);
    } catch (err) {
      console.error("Import failed", err);
      window.alert("Import failed. Please check that you selected a valid JSON export file.");
    }
  };
  reader.onerror = function () {
    console.error("Failed to read import file");
    window.alert("Import failed while reading the JSON file.");
  };
  reader.readAsText(file);
}

function handleImportCsvFile(file) {
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      let text = e.target.result;
      if (typeof text !== "string") text = String(text);
      text = text.replace(/^\uFEFF/, ""); // strip BOM for CSV from Excel etc.
      const rows = parseCsv(text);
      if (!rows.length) {
        window.alert("Import file contains no rows.");
        return;
      }
      const header = rows[0].map((cell) => String(cell).trim());
      const dataRows = rows.slice(1).filter((r) => r.some((cell) => String(cell).trim() !== ""));
      if (!dataRows.length) {
        window.alert("Import file contains no data rows.");
        return;
      }
      const importedProfiles = buildProfilesFromCsvRows(header, dataRows);
      if (!importedProfiles.length) {
        window.alert("No valid data found in CSV file.");
        return;
      }
      const { addedProfiles, mergedProfiles, addedRoadmaps, mergedRoadmaps } = mergeImportedProfiles(importedProfiles);
      if (!state.activeProfileId && state.profiles.length) {
        state.activeProfileId = resolveFallbackActiveProfileId();
      }
      saveState();
      renderProfiles();
      renderRoadmaps();
      const addedOnly = addedRoadmaps - mergedRoadmaps;
      const parts = [];
      if (addedProfiles) parts.push(`${addedProfiles} profile${addedProfiles !== 1 ? "s" : ""} added`);
      if (mergedProfiles) parts.push(`${mergedProfiles} profile${mergedProfiles !== 1 ? "s" : ""} merged`);
      if (addedOnly) parts.push(`${addedOnly} roadmap${addedOnly !== 1 ? "s" : ""} added`);
      if (mergedRoadmaps) parts.push(`${mergedRoadmaps} roadmap${mergedRoadmaps !== 1 ? "s" : ""} merged`);
      const detail = parts.length ? parts.join(", ") + "." : "No new data.";
      const msg = `Imported from CSV. ${detail}`;
      setTimeout(() => showToast(msg), 0);
    } catch (err) {
      console.error("CSV import failed", err);
      window.alert("CSV import failed. Please check that you selected a valid CSV export file.");
    }
  };
  reader.onerror = function () {
    console.error("Failed to read CSV import file");
    window.alert("Import failed while reading the CSV file.");
  };
  reader.readAsText(file);
}

function buildProfilesFromCsvRows(header, rows) {
  const colIndex = {};
  header.forEach((name, idx) => {
    const key = String(name).trim();
    if (key) colIndex[key] = idx;
  });

  const byProfileKey = new Map();

  rows.forEach((cells) => {
    const profileName = (cells[colIndex.profileName] ?? "").toString().trim();
    if (!profileName) return;
    const profileIdFromCsv = (cells[colIndex.profileId] ?? "").toString().trim();
    const profileCreatedAt = (cells[colIndex.profileCreatedAt] ?? "").toString().trim();
    const profileTeam = (cells[colIndex.profileTeam] ?? "").toString().trim();
    const key = profileIdFromCsv || profileName;

    if (!byProfileKey.has(key)) {
      byProfileKey.set(key, {
        id: profileIdFromCsv || generateId("profile"),
        name: profileName,
        team: profileTeam || "",
        createdAt: profileCreatedAt || new Date().toISOString(),
        roadmaps: []
      });
    }

    const profile = byProfileKey.get(key);

    const roadmapTitle = (cells[colIndex.roadmapTitle] ?? "").toString().trim();
    const roadmapIdCell = (cells[colIndex.roadmapId] ?? "").toString().trim();
    const anyRoadmapField = roadmapTitle || roadmapIdCell;
    if (!anyRoadmapField) return;

    const roadmap = {
      id: roadmapIdCell || generateId("roadmap"),
      createdAt: (cells[colIndex.roadmapCreatedAt] ?? "").toString().trim() || new Date().toISOString(),
      modifiedAt: (cells[colIndex.roadmapModifiedAt] ?? "").toString().trim() || undefined,
      title: roadmapTitle || "Imported roadmap",
      description: (cells[colIndex.roadmapDescription] ?? "").toString(),
      reachValue: toNumberOrNull(cells[colIndex.reachValue]),
      reachDescription: (cells[colIndex.reachDescription] ?? "").toString(),
      impactValue: toNumberOrNull(cells[colIndex.impactValue]),
      impactDescription: (cells[colIndex.impactDescription] ?? "").toString(),
      confidenceValue: toNumberOrNull(cells[colIndex.confidenceValue]),
      confidenceDescription: (cells[colIndex.confidenceDescription] ?? "").toString(),
      effortValue: toNumberOrNull(cells[colIndex.effortValue]),
      effortDescription: (cells[colIndex.effortDescription] ?? "").toString(),
      financialImpactValue: toNumberOrNull(cells[colIndex.financialImpactValue]),
      financialImpactCurrency: normalizeCurrency(cells[colIndex.financialImpactCurrency]),
      financialImpactFramework: normalizeFinancialFramework((cells[colIndex.financialImpactFramework] ?? "").toString()),
      financialImpactInputs: (() => {
        const raw = (cells[colIndex.financialImpactInputs] ?? "").toString().trim();
        if (!raw) return {};
        try { return JSON.parse(raw); } catch (_) { return {}; }
      })(),
      roadmapType: (cells[colIndex.roadmapType] ?? "").toString().trim() || null,
      roadmapStatus: (cells[colIndex.roadmapStatus] ?? "").toString().trim() || null,
      tshirtSize: (cells[colIndex.tshirtSize] ?? "").toString().trim() || null,
      roadmapPeriod: (cells[colIndex.roadmapPeriod] ?? "").toString().trim().toUpperCase() || null,
      moscowCategory: (cells[colIndex.moscowCategory] ?? "").toString().trim() || null,
      kanoFunctionality: normalizeKanoAxisLevel(cells[colIndex.kanoFunctionality]),
      kanoSatisfaction: normalizeKanoAxisLevel(cells[colIndex.kanoSatisfaction]),
      countries: normalizeCountryNames((cells[colIndex.countries] ?? "").toString().split("|").map((c) => c.trim()).filter((c) => c !== "")),
      labels: normalizeRoadmapLabels(
        (cells[colIndex.roadmapLabels] ?? "")
          .toString()
          .split("|")
          .map((label) => label.trim())
          .filter((label) => label !== "")
      ),
      links: (() => {
        const raw = (cells[colIndex.roadmapLinks] ?? "").toString().trim();
        if (!raw) return [];
        try {
          const parsed = JSON.parse(raw);
          return normalizeRoadmapLinks(Array.isArray(parsed) ? parsed : []);
        } catch (_) {
          return [];
        }
      })(),
      tasks: (() => {
        const raw = (cells[colIndex.roadmapTasks] ?? "").toString().trim();
        if (!raw) return [];
        try {
          const parsed = JSON.parse(raw);
          return normalizeRoadmapTasks(Array.isArray(parsed) ? parsed : []);
        } catch (_) {
          return [];
        }
      })()
    };
    roadmap.riceScore = calculateRiceScore(roadmap);
    profile.roadmaps.push(roadmap);
  });

  return Array.from(byProfileKey.values());
}

function normalizeImportedProfile(profile) {
  if (!profile || typeof profile !== "object") return null;
  const base = normalizeLoadedProfile({
    ...profile,
    roadmaps: Array.isArray(profile.roadmaps) ? profile.roadmaps : []
  });
  if (!base) return null;
  if (!base.name || base.name === "Unnamed profile") {
    base.name = String(profile.name || "Imported profile");
  }
  const normalizedRoadmaps = (Array.isArray(profile.roadmaps) ? profile.roadmaps : [])
    .map(normalizeImportedRoadmap)
    .filter(Boolean);
  base.roadmaps = normalizedRoadmaps;
  return base;
}

function normalizeImportedRoadmap(roadmap) {
  if (!roadmap || typeof roadmap !== "object") return null;
  const now = new Date().toISOString();
  const id = typeof roadmap.id === "string" && roadmap.id.trim() ? roadmap.id.trim() : generateId("roadmap");
  const createdAt = roadmap.createdAt || now;
  const modifiedAt = roadmap.modifiedAt || createdAt;
  const reachValue = toNumberOrNull(roadmap.reachValue);
  const impactValue = toNumberOrNull(roadmap.impactValue);
  const confidenceValue = toNumberOrNull(roadmap.confidenceValue);
  const effortValue = toNumberOrNull(roadmap.effortValue);
  const financialImpactValue = toNumberOrNull(roadmap.financialImpactValue);
  const financialImpactFramework = normalizeFinancialFramework(roadmap.financialImpactFramework);
  const financialImpactInputs = sanitizeFinancialImpactInputs(
    financialImpactFramework,
    roadmap.financialImpactInputs && typeof roadmap.financialImpactInputs === "object"
      ? roadmap.financialImpactInputs
      : {}
  );
  const periodRaw = coalesceLegacyRoadmapStringField(roadmap, "roadmapPeriod", "projectPeriod") || "";
  const roadmapPeriod = periodRaw ? periodRaw.toUpperCase() : null;
  const normalizedFinancialValue = computeFrameworkFinancialImpact(financialImpactFramework, financialImpactInputs, financialImpactValue);
  const normalized = {
    id,
    createdAt,
    modifiedAt,
    title: String(roadmap.title || "Imported roadmap"),
    description: String(roadmap.description || ""),
    reachDescription: String(roadmap.reachDescription || ""),
    reachValue: Number.isFinite(reachValue) ? reachValue : 0,
    impactDescription: String(roadmap.impactDescription || ""),
    impactValue: Number.isFinite(impactValue) ? impactValue : 1,
    confidenceDescription: String(roadmap.confidenceDescription || ""),
    confidenceValue: Number.isFinite(confidenceValue) ? confidenceValue : 50,
    effortDescription: String(roadmap.effortDescription || ""),
    effortValue: Number.isFinite(effortValue) && effortValue > 0 ? effortValue : 1,
    financialImpactValue: Number.isFinite(normalizedFinancialValue) ? normalizedFinancialValue : null,
    financialImpactCurrency: normalizeCurrency(roadmap.financialImpactCurrency),
    financialImpactFramework,
    financialImpactInputs,
    roadmapType: coalesceLegacyRoadmapStringField(roadmap, "roadmapType", "projectType"),
    roadmapStatus: coalesceLegacyRoadmapStringField(roadmap, "roadmapStatus", "projectStatus"),
    tshirtSize: (roadmap.tshirtSize != null && String(roadmap.tshirtSize).trim() !== "") ? String(roadmap.tshirtSize).trim() : null,
    roadmapPeriod,
    moscowCategory: (roadmap.moscowCategory != null && String(roadmap.moscowCategory).trim() !== "" && typeof moscowList !== "undefined" && moscowList.includes(roadmap.moscowCategory)) ? String(roadmap.moscowCategory).trim() : null,
    kanoFunctionality: normalizeKanoAxisLevel(roadmap.kanoFunctionality),
    kanoSatisfaction: normalizeKanoAxisLevel(roadmap.kanoSatisfaction),
    countries: normalizeCountryNames(Array.isArray(roadmap.countries) ? roadmap.countries : []),
    labels: normalizeRoadmapLabels(roadmap.labels),
    links: normalizeRoadmapLinks(roadmap.links),
    tasks: normalizeRoadmapTasks(roadmap.tasks),
    raci: normalizeRoadmapRaci(roadmap.raci)
  };
  normalized.riceScore = calculateRiceScore(normalized);
  return normalized;
}

// --- Filters (country options, filter UI, clear) ---
function getSelectedFilterCountriesRaw() {
  if (!elements.filterCountriesList) return [];
  const checkboxes = elements.filterCountriesList.querySelectorAll("input[type=\"checkbox\"]");
  const values = Array.from(checkboxes)
    .filter((cb) => cb.checked)
    .map((cb) => cb.value);
  return Array.from(new Set(values));
}

function getSelectedFilterCountries() {
  return expandEuRegionInCountryNames(getSelectedFilterCountriesRaw());
}

function syncFilterEuRegionCheckbox(changedCheckbox) {
  if (
    !elements.filterCountriesList ||
    typeof COUNTRY_OPTION_EU === "undefined" ||
    typeof EU_MEMBER_COUNTRIES === "undefined"
  ) {
    return;
  }
  const euCb = elements.filterCountriesList.querySelector(
    `input[type="checkbox"][value="${COUNTRY_OPTION_EU}"]`
  );
  if (!euCb) return;

  if (changedCheckbox && changedCheckbox.value === COUNTRY_OPTION_EU) {
    EU_MEMBER_COUNTRIES.forEach((member) => {
      const memberCb = elements.filterCountriesList.querySelector(
        `input[type="checkbox"][value="${member}"]`
      );
      if (memberCb) memberCb.checked = changedCheckbox.checked;
    });
    return;
  }

  if (changedCheckbox && EU_MEMBER_COUNTRIES.includes(changedCheckbox.value)) {
    const allChecked = EU_MEMBER_COUNTRIES.every((member) => {
      const memberCb = elements.filterCountriesList.querySelector(
        `input[type="checkbox"][value="${member}"]`
      );
      return memberCb && memberCb.checked;
    });
    euCb.checked = allChecked;
  }
}

function getSelectedFilterRoadmapPeriods() {
  if (!elements.filterRoadmapPeriodList) return [];
  const checkboxes = elements.filterRoadmapPeriodList.querySelectorAll("input[type=\"checkbox\"]");
  const values = Array.from(checkboxes)
    .filter((cb) => cb.checked)
    .map((cb) => cb.value.toString().toUpperCase());
  return Array.from(new Set(values));
}

function filterFilterCountriesBySearchTerm() {
  if (!elements.filterCountriesList || !elements.filterCountriesSearch) return;
  const term = (elements.filterCountriesSearch.value || "").trim().toLowerCase();
  const options = elements.filterCountriesList.querySelectorAll(".filter-country-option");
  options.forEach((opt) => {
    const name = (opt.dataset.name || "").toLowerCase();
    opt.style.display = !term || name.includes(term) ? "" : "none";
  });
}

function filterFilterRoadmapPeriodsBySearchTerm() {
  if (!elements.filterRoadmapPeriodList || !elements.filterRoadmapPeriodSearch) return;
  const term = (elements.filterRoadmapPeriodSearch.value || "").trim().toLowerCase();
  const options = elements.filterRoadmapPeriodList.querySelectorAll(".filter-country-option");
  options.forEach((opt) => {
    const period = (opt.dataset.period || "").toLowerCase();
    opt.style.display = !term || period.includes(term) ? "" : "none";
  });
}

function updateFilterCountriesSummary() {
  if (!elements.filterCountriesSummary) return;
  const container = elements.filterCountriesSummary;
  const selected = getSelectedFilterCountries();
  container.innerHTML = "";

  if (!selected.length) {
    const span = document.createElement("span");
    span.textContent = "Any country";
    container.appendChild(span);
    return;
  }

  const maxChips = 3;
  const visible = selected.slice(0, maxChips);
  visible.forEach((name) => {
    const chip = document.createElement("span");
    chip.className = "filter-countries-chip";
    chip.textContent = name;
    container.appendChild(chip);
  });

  if (selected.length > maxChips) {
    const moreChip = document.createElement("span");
    moreChip.className = "filter-countries-chip filter-countries-chip-count";
    moreChip.textContent = `+${selected.length - maxChips} more`;
    container.appendChild(moreChip);
  }
}

function updateFilterRoadmapPeriodsSummary() {
  if (!elements.filterRoadmapPeriodSummary) return;
  const container = elements.filterRoadmapPeriodSummary;
  const selected = getSelectedFilterRoadmapPeriods();
  container.innerHTML = "";

  if (!selected.length) {
    const span = document.createElement("span");
    span.textContent = "Any period";
    container.appendChild(span);
    return;
  }

  const maxChips = 3;
  const visible = selected.slice(0, maxChips);
  visible.forEach((period) => {
    const chip = document.createElement("span");
    chip.className = "filter-countries-chip";
    chip.textContent = period;
    container.appendChild(chip);
  });

  if (selected.length > maxChips) {
    const moreChip = document.createElement("span");
    moreChip.className = "filter-countries-chip filter-countries-chip-count";
    moreChip.textContent = `+${selected.length - maxChips} more`;
    container.appendChild(moreChip);
  }
}

function renderCountriesControls(countries) {
  if (!elements.countriesContainer) return;
  elements.countriesContainer.innerHTML = "";
  const normalized = normalizeCountryNames(Array.isArray(countries) ? countries : []);
  const list = normalized.length ? normalized : [""];
  list.forEach((country) => addCountryRow(country));
}

function populateRoadmapCountrySelect(select, selectedCountry) {
  select.innerHTML = "";
  const emptyOpt = document.createElement("option");
  emptyOpt.value = "";
  emptyOpt.textContent = "Select country";
  select.appendChild(emptyOpt);

  if (typeof COUNTRY_OPTION_EU !== "undefined") {
    const euOpt = document.createElement("option");
    euOpt.value = COUNTRY_OPTION_EU;
    euOpt.textContent = "EU (European Union)";
    select.appendChild(euOpt);
  }

  countryList.slice().sort().forEach((name) => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  });

  if (isEuRegionOption(selectedCountry)) {
    select.value = COUNTRY_OPTION_EU;
  } else if (selectedCountry && countryList.includes(selectedCountry)) {
    select.value = selectedCountry;
  }
}

function addCountryRow(selectedCountry) {
  if (!elements.countriesContainer) return;
  const row = document.createElement("div");
  row.className = "country-row";

  const select = document.createElement("select");
  select.setAttribute("aria-label", "Roadmap country");
  populateRoadmapCountrySelect(select, selectedCountry);

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "country-remove-btn";
  removeBtn.textContent = "×";

  row.appendChild(select);
  row.appendChild(removeBtn);
  elements.countriesContainer.appendChild(row);
}

function applyEuRegionToRoadmapCountries() {
  if (!elements.countriesContainer || roadmapModalMode === "view") return;
  const current = getCountriesFromControlsRaw();
  const withoutEu = current.filter((c) => !isEuRegionOption(c));
  const merged = normalizeCountryNames([...withoutEu, COUNTRY_OPTION_EU]);
  renderCountriesControls(merged);
}

function getCountriesFromControlsRaw() {
  if (!elements.countriesContainer) return [];
  const selects = elements.countriesContainer.querySelectorAll("select");
  const values = Array.from(selects)
    .map((s) => (s.value || "").trim())
    .filter((v) => v);
  return Array.from(new Set(values));
}

function getCountriesFromControls() {
  return normalizeCountryNames(getCountriesFromControlsRaw());
}

/** True when the roadmap has at least one saved hyperlink. */
function roadmapHasLinks(roadmap) {
  return normalizeRoadmapLinks(roadmap && roadmap.links).length > 0;
}

/** True when the roadmap has at least one saved label. */
function roadmapHasLabels(roadmap) {
  return normalizeRoadmapLabels(roadmap && roadmap.labels).length > 0;
}

/** Substring match against any roadmap label (case-insensitive). */
function roadmapMatchesLabelFilter(roadmap, labelQuery) {
  const query = (labelQuery || "").trim().toLowerCase();
  if (!query) return true;
  const labels = normalizeRoadmapLabels(roadmap && roadmap.labels);
  return labels.some((label) => label.toLowerCase().includes(query));
}

/** Deduplicated, trimmed roadmap labels (each may contain spaces). */
function normalizeRoadmapLabels(raw) {
  if (!Array.isArray(raw)) {
    if (typeof raw === "string" && raw.trim()) {
      const parts = raw
        .split(/[|,]/)
        .map((part) => part.trim())
        .filter(Boolean);
      if (parts.length > 1) {
        const seen = new Set();
        const out = [];
        parts.forEach((label) => {
          if (!label || seen.has(label)) return;
          seen.add(label);
          out.push(label);
        });
        return out;
      }
      return [raw.trim()];
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

/** Normalizes a user-entered URL for roadmap links (http/https only). */
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
  } catch (_) {
    return null;
  }
}

/** Short hostname (+ path) for link preview in view mode. */
function formatRoadmapLinkPreviewUrl(url) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname && parsed.pathname !== "/" ? parsed.pathname : "";
    return parsed.hostname + path;
  } catch (_) {
    return String(url || "");
  }
}

/** Deduplicated named hyperlinks on a roadmap. */
function normalizeRoadmapLinks(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  raw.forEach((item) => {
    if (typeof item === "string") {
      const url = normalizeRoadmapLinkUrl(item);
      if (!url) return;
      const label = formatRoadmapLinkPreviewUrl(url) || url;
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

function renderRoadmapLabelsControls(labels, { readonly = false } = {}) {
  if (!elements.roadmapLabelsContainer) return;
  elements.roadmapLabelsContainer.innerHTML = "";
  const normalized = normalizeRoadmapLabels(labels);
  if (readonly) {
    const wrap = document.createElement("div");
    wrap.className = "roadmap-labels-readonly";
    if (!normalized.length) {
      const hint = document.createElement("p");
      hint.className = "roadmap-field-empty-hint";
      hint.textContent = "No labels added";
      elements.roadmapLabelsContainer.appendChild(hint);
      return;
    }
    normalized.forEach((label) => {
      const chip = document.createElement("span");
      chip.className = "roadmap-label-chip";
      chip.textContent = label;
      wrap.appendChild(chip);
    });
    elements.roadmapLabelsContainer.appendChild(wrap);
    return;
  }
  const list = normalized.length ? normalized : [""];
  list.forEach((label) => addRoadmapLabelRow(label));
}

function addRoadmapLabelRow(value) {
  if (!elements.roadmapLabelsContainer) return;
  const row = document.createElement("div");
  row.className = "roadmap-label-row";
  const input = document.createElement("input");
  input.type = "text";
  input.className = "roadmap-label-input";
  input.placeholder = "e.g. Q3 growth bet, Platform";
  input.setAttribute("aria-label", "Label text");
  input.value = value || "";
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "roadmap-label-remove-btn";
  removeBtn.textContent = "×";
  removeBtn.setAttribute("aria-label", "Remove label");
  row.appendChild(input);
  row.appendChild(removeBtn);
  elements.roadmapLabelsContainer.appendChild(row);
}

function getRoadmapLabelsFromControls() {
  if (!elements.roadmapLabelsContainer) return [];
  const inputs = elements.roadmapLabelsContainer.querySelectorAll(".roadmap-label-row input");
  const values = Array.from(inputs)
    .map((input) => (input.value || "").trim())
    .filter((value) => value);
  return normalizeRoadmapLabels(values);
}

function ensureRoadmapLinkRowHeader() {
  if (!elements.roadmapLinksContainer) return;
  if (elements.roadmapLinksContainer.querySelector(".roadmap-link-row-header")) return;
  const header = document.createElement("div");
  header.className = "roadmap-link-row-header";
  header.setAttribute("aria-hidden", "true");
  const colLabel = document.createElement("span");
  colLabel.textContent = "Display text";
  const colUrl = document.createElement("span");
  colUrl.textContent = "URL";
  const colAction = document.createElement("span");
  header.appendChild(colLabel);
  header.appendChild(colUrl);
  header.appendChild(colAction);
  elements.roadmapLinksContainer.appendChild(header);
}

function renderRoadmapLinksControls(links, { readonly = false } = {}) {
  if (!elements.roadmapLinksContainer) return;
  elements.roadmapLinksContainer.innerHTML = "";
  const normalized = normalizeRoadmapLinks(links);
  if (readonly) {
    if (!normalized.length) {
      const hint = document.createElement("p");
      hint.className = "roadmap-field-empty-hint";
      hint.textContent = "No links added";
      elements.roadmapLinksContainer.appendChild(hint);
      return;
    }
    const wrap = document.createElement("div");
    wrap.className = "roadmap-links-readonly";
    normalized.forEach((link) => {
      const card = document.createElement("div");
      card.className = "roadmap-link-card";

      const icon = document.createElement("span");
      icon.className = "roadmap-link-card__icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = "↗";

      const body = document.createElement("div");
      body.className = "roadmap-link-card__body";

      const anchor = document.createElement("a");
      anchor.className = "roadmap-link-card__title";
      anchor.href = link.url;
      anchor.textContent = link.label;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";

      const urlPreview = document.createElement("span");
      urlPreview.className = "roadmap-link-card__url";
      urlPreview.textContent = formatRoadmapLinkPreviewUrl(link.url);

      body.appendChild(anchor);
      body.appendChild(urlPreview);
      card.appendChild(icon);
      card.appendChild(body);
      wrap.appendChild(card);
    });
    elements.roadmapLinksContainer.appendChild(wrap);
    return;
  }
  ensureRoadmapLinkRowHeader();
  const list = normalized.length ? normalized : [{ label: "", url: "" }];
  list.forEach((link) => addRoadmapLinkRow(link));
}

function addRoadmapLinkRow(link) {
  if (!elements.roadmapLinksContainer) return;
  ensureRoadmapLinkRowHeader();
  const row = document.createElement("div");
  row.className = "roadmap-link-row";

  const fields = document.createElement("div");
  fields.className = "roadmap-link-row__fields";

  const labelInput = document.createElement("input");
  labelInput.type = "text";
  labelInput.className = "roadmap-link-label-input";
  labelInput.placeholder = "e.g. Product spec";
  labelInput.setAttribute("aria-label", "Link display text");
  labelInput.value = (link && link.label) || "";

  const urlInput = document.createElement("input");
  urlInput.type = "url";
  urlInput.className = "roadmap-link-url-input";
  urlInput.placeholder = "https://example.com/doc";
  urlInput.setAttribute("aria-label", "Link URL");
  urlInput.value = (link && link.url) || "";

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "roadmap-link-remove-btn";
  removeBtn.textContent = "×";
  removeBtn.setAttribute("aria-label", "Remove link");

  fields.appendChild(labelInput);
  fields.appendChild(urlInput);
  row.appendChild(fields);
  row.appendChild(removeBtn);
  elements.roadmapLinksContainer.appendChild(row);
}

function getRoadmapLinksFromControls() {
  if (!elements.roadmapLinksContainer) return { links: [], error: null };
  const rows = elements.roadmapLinksContainer.querySelectorAll(".roadmap-link-row");
  const links = [];
  for (const row of rows) {
    const label = (row.querySelector(".roadmap-link-label-input")?.value || "").trim();
    const urlRaw = (row.querySelector(".roadmap-link-url-input")?.value || "").trim();
    if (!label && !urlRaw) continue;
    if (!label || !urlRaw) {
      return { links: [], error: "Each link needs both display text and a URL." };
    }
    const url = normalizeRoadmapLinkUrl(urlRaw);
    if (!url) {
      return { links: [], error: `Invalid link URL: ${urlRaw}` };
    }
    links.push({ label, url });
  }
  return { links: normalizeRoadmapLinks(links), error: null };
}

function getRoadmapTaskStatusOptions() {
  return typeof roadmapStatusList !== "undefined" && Array.isArray(roadmapStatusList)
    ? roadmapStatusList.slice()
    : ["Not Started", "In Progress", "On Hold", "Done", "Cancelled"];
}

const ROADMAP_TASK_PROGRESS_STATUSES = [
  "Not Started",
  "In Progress",
  "On Hold",
  "Done",
  "Cancelled"
];

function getRoadmapTaskStatusSlug(status) {
  return String(status || "")
    .trim()
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/\s+/g, "-");
}

function getRoadmapTasksSnapshotForProgress() {
  const container = elements.roadmapTasksContainer;
  if (!container) return [];

  const cards = container.querySelectorAll(".roadmap-task-card");
  if (cards.length) {
    return Array.from(cards)
      .map((card) => ({
        name: (card.querySelector(".roadmap-task-card__name")?.textContent || "").trim(),
        status: card.querySelector(".roadmap-task-card__status")?.dataset.status || "Not Started"
      }))
      .filter((task) => task.name);
  }

  const rows = container.querySelectorAll(".roadmap-task-row");
  if (rows.length) {
    const tasks = [];
    rows.forEach((row) => {
      const name = (row.querySelector(".roadmap-task-name-input")?.value || "").trim();
      const statusRaw = row.querySelector(".roadmap-task-status-select")?.value || "";
      if (!name) return;
      tasks.push({
        name,
        status: normalizeRoadmapTaskStatus(statusRaw)
      });
    });
    return tasks;
  }

  return [];
}

function shouldShowRoadmapTasksProgress(detailsEl, breakdown) {
  if (!detailsEl || !breakdown.total) return false;
  if (roadmapModalMode === "view") return !detailsEl.open;
  return true;
}

function computeRoadmapTaskStatusBreakdown(tasks) {
  const normalized = normalizeRoadmapTasks(Array.isArray(tasks) ? tasks : []);
  const total = normalized.length;
  const counts = Object.fromEntries(ROADMAP_TASK_PROGRESS_STATUSES.map((status) => [status, 0]));

  normalized.forEach((task) => {
    const status = normalizeRoadmapTaskStatus(task.status);
    if (counts[status] != null) counts[status] += 1;
  });

  const segments = ROADMAP_TASK_PROGRESS_STATUSES.map((status) => ({
    status,
    count: counts[status] || 0
  })).filter((segment) => segment.count > 0);

  if (!total) {
    return { total: 0, segments: [] };
  }

  const withExact = segments.map((segment) => ({
    ...segment,
    exact: (segment.count / total) * 100
  }));
  const withPct = withExact.map((segment) => ({
    ...segment,
    pct: Math.floor(segment.exact)
  }));
  let remainder = 100 - withPct.reduce((sum, segment) => sum + segment.pct, 0);
  const byFraction = withExact
    .map((segment, index) => ({
      index,
      fraction: segment.exact - withPct[index].pct
    }))
    .sort((a, b) => b.fraction - a.fraction);
  for (let i = 0; remainder > 0 && i < byFraction.length; i += 1) {
    withPct[byFraction[i].index].pct += 1;
    remainder -= 1;
  }

  return { total, segments: withPct };
}

function buildRoadmapTaskProgressSummaryLabel(breakdown) {
  if (!breakdown.total) return "No tasks yet";
  const parts = breakdown.segments.map((segment) => `${segment.status} ${segment.pct}%`);
  return `Task progress: ${parts.join(", ")}`;
}

function formatRoadmapTaskProgressSegmentCount(count) {
  const value = Number(count) || 0;
  return value === 1 ? "1 task" : `${value} tasks`;
}

function buildRoadmapTaskProgressSegmentTooltip(segment) {
  const taskLabel = formatRoadmapTaskProgressSegmentCount(segment.count);
  return {
    title: segment.status,
    body: `${taskLabel} · ${segment.pct}% of total`
  };
}

function appendRoadmapTaskProgressSegmentTooltip(segmentEl, segment) {
  const tooltipCopy = buildRoadmapTaskProgressSegmentTooltip(segment);
  const tooltipEl = document.createElement("span");
  tooltipEl.className = "roadmap-tasks-progress-segment-tooltip";
  tooltipEl.setAttribute("role", "tooltip");

  const titleEl = document.createElement("span");
  titleEl.className = "roadmap-tasks-progress-segment-tooltip-title";
  titleEl.textContent = tooltipCopy.title;

  const bodyEl = document.createElement("span");
  bodyEl.className = "roadmap-tasks-progress-segment-tooltip-body";
  bodyEl.textContent = tooltipCopy.body;

  tooltipEl.appendChild(titleEl);
  tooltipEl.appendChild(bodyEl);
  segmentEl.appendChild(tooltipEl);

  const ariaLabel = `${tooltipCopy.title}: ${formatRoadmapTaskProgressSegmentCount(segment.count)}`;
  segmentEl.setAttribute("aria-label", ariaLabel);
  segmentEl.setAttribute("tabindex", "0");
}

function renderRoadmapTaskProgressSummary(detailsEl, breakdown) {
  if (!detailsEl) return;
  const progressWrap = detailsEl.querySelector(".roadmap-tasks-progress");
  const barEl = detailsEl.querySelector(".roadmap-tasks-progress-bar");
  const legendEl = detailsEl.querySelector(".roadmap-tasks-progress-legend");
  const countEl = detailsEl.querySelector(".roadmap-tasks-summary-count");
  if (!progressWrap || !barEl || !legendEl) return;

  const showProgress = shouldShowRoadmapTasksProgress(detailsEl, breakdown);
  progressWrap.hidden = !showProgress;
  progressWrap.setAttribute("aria-hidden", showProgress ? "false" : "true");
  detailsEl.classList.toggle("roadmap-tasks-disclosure--progress-visible", showProgress);

  if (countEl) {
    countEl.textContent = breakdown.total ? `${breakdown.total} task${breakdown.total === 1 ? "" : "s"}` : "";
    countEl.hidden = !breakdown.total;
  }

  barEl.innerHTML = "";
  legendEl.innerHTML = "";

  if (!showProgress) {
    barEl.removeAttribute("aria-label");
    return;
  }

  barEl.setAttribute("aria-label", buildRoadmapTaskProgressSummaryLabel(breakdown));

  legendEl.style.gridTemplateColumns = `repeat(${breakdown.segments.length}, minmax(0, 1fr))`;

  breakdown.segments.forEach((segment) => {
    const segmentEl = document.createElement("span");
    segmentEl.className = "roadmap-tasks-progress-segment";
    segmentEl.dataset.status = segment.status;
    segmentEl.style.flexBasis = `${segment.pct}%`;
    segmentEl.style.width = `${segment.pct}%`;
    appendRoadmapTaskProgressSegmentTooltip(segmentEl, segment);
    barEl.appendChild(segmentEl);

    const legendItem = document.createElement("span");
    legendItem.className = "roadmap-tasks-progress-legend-item";
    legendItem.dataset.status = segment.status;
    legendItem.innerHTML = `<span class="roadmap-tasks-progress-legend-dot" aria-hidden="true"></span><span class="roadmap-tasks-progress-legend-copy">${segment.status} <strong>${segment.pct}%</strong></span>`;
    legendEl.appendChild(legendItem);
  });
}

function syncRoadmapTasksDisclosureAria(detailsEl) {
  if (!detailsEl) return;
  const summary = detailsEl.querySelector("summary");
  if (!summary) return;
  const titleEl = summary.querySelector(".roadmap-tasks-summary-title");
  const name = titleEl ? titleEl.textContent.trim() : "Tasks";
  summary.setAttribute("aria-expanded", detailsEl.open ? "true" : "false");
  summary.setAttribute("aria-label", detailsEl.open ? `Collapse ${name}` : `Expand ${name}`);
}

function syncRoadmapTasksDisclosure({ resetCollapsed = false } = {}) {
  const wrap =
    document.querySelector("[data-roadmap-tasks-collapsible]") || elements.roadmapTasksCollapsibleWrap;
  if (!wrap) return;
  const detailsEl = wrap.querySelector(".roadmap-tasks-disclosure");
  if (!detailsEl) return;

  if (resetCollapsed) {
    detailsEl.open = false;
  }

  const breakdown = computeRoadmapTaskStatusBreakdown(getRoadmapTasksSnapshotForProgress());
  detailsEl.classList.toggle("roadmap-tasks-disclosure--has-tasks", breakdown.total > 0);
  renderRoadmapTaskProgressSummary(detailsEl, breakdown);
  syncRoadmapTasksDisclosureAria(detailsEl);
}

function scheduleRoadmapTasksDisclosureSync() {
  if (roadmapTasksDisclosureSyncFrame != null) {
    cancelAnimationFrame(roadmapTasksDisclosureSyncFrame);
  }
  roadmapTasksDisclosureSyncFrame = requestAnimationFrame(() => {
    roadmapTasksDisclosureSyncFrame = null;
    syncRoadmapTasksDisclosure();
  });
}

let roadmapTasksDisclosureSyncFrame = null;

function wrapRoadmapTasksField(wrap) {
  if (!wrap || wrap.dataset.tasksDisclosureWrapped === "1") return;
  if (!wrap.hasAttribute("data-roadmap-tasks-collapsible")) return;

  const labelEl = wrap.querySelector(":scope > label") || wrap.querySelector("label");
  if (!labelEl) return;

  const titleText = getOptionalFieldSummaryText(labelEl) || "Tasks";
  const hintEl = wrap.querySelector(":scope > .roadmap-dynamic-field-hint");
  const subtitle = hintEl ? hintEl.textContent.trim() : "";

  const details = document.createElement("details");
  details.className = "roadmap-tasks-disclosure roadmap-optional-disclosure";
  details.open = false;

  const summary = document.createElement("summary");
  summary.className = "roadmap-tasks-disclosure-summary roadmap-optional-field-summary";

  const row = document.createElement("div");
  row.className = "roadmap-optional-summary-row roadmap-tasks-summary-row";

  const lead = document.createElement("span");
  lead.className = "roadmap-optional-summary-lead roadmap-tasks-summary-lead";
  lead.setAttribute("aria-hidden", "true");

  const copy = document.createElement("div");
  copy.className = "roadmap-optional-summary-copy";

  const titleSpan = document.createElement("span");
  titleSpan.className = "roadmap-optional-field-summary-title roadmap-tasks-summary-title";
  titleSpan.textContent = titleText;
  copy.appendChild(titleSpan);

  if (subtitle) {
    const subtitleSpan = document.createElement("span");
    subtitleSpan.className = "roadmap-optional-field-summary-subtitle roadmap-tasks-summary-subtitle";
    subtitleSpan.textContent = subtitle.length > 72 ? `${subtitle.slice(0, 69)}…` : subtitle;
    copy.appendChild(subtitleSpan);
  }

  const countBadge = document.createElement("span");
  countBadge.className = "roadmap-tasks-summary-count";
  countBadge.hidden = true;

  const chevron = document.createElement("span");
  chevron.className = "roadmap-optional-summary-chevron";
  chevron.setAttribute("aria-hidden", "true");

  row.appendChild(lead);
  row.appendChild(copy);
  row.appendChild(countBadge);
  row.appendChild(chevron);

  const progressWrap = document.createElement("div");
  progressWrap.className = "roadmap-tasks-progress";
  progressWrap.hidden = true;
  progressWrap.setAttribute("aria-hidden", "true");

  const barEl = document.createElement("div");
  barEl.className = "roadmap-tasks-progress-bar";
  barEl.setAttribute("role", "img");

  const legendEl = document.createElement("div");
  legendEl.className = "roadmap-tasks-progress-legend";

  progressWrap.appendChild(barEl);
  progressWrap.appendChild(legendEl);

  summary.appendChild(row);
  summary.appendChild(progressWrap);

  const body = document.createElement("div");
  body.className = "roadmap-tasks-disclosure-body roadmap-optional-field-body";

  Array.from(wrap.childNodes).forEach((child) => {
    if (child === labelEl) return;
    body.appendChild(child);
  });

  labelEl.remove();
  details.appendChild(summary);
  details.appendChild(body);
  wrap.appendChild(details);
  wrap.dataset.tasksDisclosureWrapped = "1";
}

function ensureRoadmapTasksDisclosure() {
  const wrap = document.querySelector("#roadmapForm [data-roadmap-tasks-collapsible]");
  if (!wrap) return;
  try {
    wrapRoadmapTasksField(wrap);
    syncRoadmapTasksDisclosure({ resetCollapsed: true });
  } catch (err) {
    console.error("Roadmap tasks disclosure failed to initialize:", err);
  }
}

const RACI_ROLES = ["responsible", "accountable", "consulted", "informed"];
const RACI_DOMAIN_OPTIONS = ["Business", "Tech"];
const RACI_MATRIX_ROLE_LABELS = {
  responsible: "Responsible",
  accountable: "Accountable",
  consulted: "Consulted",
  informed: "Informed"
};
const RACI_MATRIX_ROLE_SHORT = {
  responsible: "R",
  accountable: "A",
  consulted: "C",
  informed: "I"
};

function getEmptyRoadmapRaci() {
  return {
    responsible: [],
    accountable: [],
    consulted: [],
    informed: []
  };
}

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

function getRoadmapRaciContainer(role) {
  if (!elements.roadmapRaciSection) return null;
  return elements.roadmapRaciSection.querySelector(`.roadmap-raci-list[data-raci-role="${role}"]`);
}

function getPersonDisplayInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function buildRoadmapRaciDomainSelect(selectedDomain) {
  const select = document.createElement("select");
  select.className = "roadmap-raci-domain-select";
  select.setAttribute("aria-label", "Business or Tech");
  RACI_DOMAIN_OPTIONS.forEach((domain) => {
    const option = document.createElement("option");
    option.value = domain;
    option.textContent = domain;
    select.appendChild(option);
  });
  select.value = normalizeRaciDomain(selectedDomain);
  return select;
}

function ensureRoadmapRaciRowHeader(container) {
  if (!container) return;
  if (container.querySelector(".roadmap-raci-row-header")) return;
  const header = document.createElement("div");
  header.className = "roadmap-raci-row-header";
  header.setAttribute("aria-hidden", "true");
  const colName = document.createElement("span");
  colName.textContent = "Name";
  const colDomain = document.createElement("span");
  colDomain.textContent = "Domain";
  const colAction = document.createElement("span");
  header.appendChild(colName);
  header.appendChild(colDomain);
  header.appendChild(colAction);
  container.appendChild(header);
}

function renderRoadmapRaciRoleControls(role, entries, { readonly = false } = {}) {
  const container = getRoadmapRaciContainer(role);
  if (!container) return;
  container.innerHTML = "";
  const normalized = normalizeRaciEntries(entries);
  if (readonly) {
    if (!normalized.length) {
      const hint = document.createElement("p");
      hint.className = "roadmap-field-empty-hint";
      hint.textContent = "No entries added";
      container.appendChild(hint);
      return;
    }
    const wrap = document.createElement("div");
    wrap.className = "roadmap-raci-readonly";
    wrap.setAttribute("role", "list");
    normalized.forEach((entry) => {
      const row = document.createElement("article");
      row.className = "roadmap-raci-card";
      row.setAttribute("role", "listitem");

      const avatar = document.createElement("span");
      avatar.className = "roadmap-raci-card__avatar";
      avatar.setAttribute("aria-hidden", "true");
      avatar.textContent = getPersonDisplayInitials(entry.name);

      const body = document.createElement("div");
      body.className = "roadmap-raci-card__body";

      const nameEl = document.createElement("span");
      nameEl.className = "roadmap-raci-card__name";
      nameEl.textContent = entry.name;

      const domainEl = document.createElement("span");
      domainEl.className = "roadmap-raci-card__domain";
      domainEl.dataset.domain = entry.domain;
      domainEl.textContent = entry.domain;

      body.appendChild(nameEl);
      row.appendChild(avatar);
      row.appendChild(body);
      row.appendChild(domainEl);
      wrap.appendChild(row);
    });
    container.appendChild(wrap);
    return;
  }
  ensureRoadmapRaciRowHeader(container);
  const list = normalized.length ? normalized : [{ name: "", domain: "Business" }];
  list.forEach((entry) => addRoadmapRaciRow(role, entry));
}

function renderRoadmapRaciControls(raci, { readonly = false } = {}) {
  const normalized = normalizeRoadmapRaci(raci);
  RACI_ROLES.forEach((role) => {
    renderRoadmapRaciRoleControls(role, normalized[role], { readonly });
  });
}

function addRoadmapRaciRow(role, entry) {
  const container = getRoadmapRaciContainer(role);
  if (!container) return;
  ensureRoadmapRaciRowHeader(container);
  const row = document.createElement("div");
  row.className = "roadmap-raci-row";

  const fields = document.createElement("div");
  fields.className = "roadmap-raci-row__fields";

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "roadmap-raci-name-input";
  nameInput.placeholder = "e.g. Jane Doe, Platform team";
  nameInput.setAttribute("aria-label", "RACI entry name");
  nameInput.value = (entry && entry.name) || "";

  const domainSelect = buildRoadmapRaciDomainSelect(entry && entry.domain);

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "roadmap-raci-remove-btn";
  removeBtn.textContent = "×";
  removeBtn.setAttribute("aria-label", "Remove entry");

  fields.appendChild(nameInput);
  fields.appendChild(domainSelect);
  row.appendChild(fields);
  row.appendChild(removeBtn);
  container.appendChild(row);
}

function getRoadmapRaciFromControls() {
  const raci = getEmptyRoadmapRaci();
  RACI_ROLES.forEach((role) => {
    const container = getRoadmapRaciContainer(role);
    if (!container) return;
    const rows = container.querySelectorAll(".roadmap-raci-row");
    rows.forEach((row) => {
      const name = (row.querySelector(".roadmap-raci-name-input")?.value || "").trim();
      const domainRaw = row.querySelector(".roadmap-raci-domain-select")?.value || "";
      if (!name) return;
      raci[role].push({
        name,
        domain: normalizeRaciDomain(domainRaw)
      });
    });
    raci[role] = normalizeRaciEntries(raci[role]);
  });
  return normalizeRoadmapRaci(raci);
}

function getRaciEntriesForMatrixDomain(roadmap, role, domain) {
  const raci = normalizeRoadmapRaci(roadmap && roadmap.raci);
  const needle = normalizeRaciDomain(domain);
  return raci[role].filter((entry) => entry.domain === needle);
}

function syncRaciMatrixDomainToggle(domain) {
  const normalized = normalizeRaciDomain(domain);
  if (elements.raciMatrixDomainToggle) {
    elements.raciMatrixDomainToggle.dataset.activeDomain = normalized;
    elements.raciMatrixDomainToggle.querySelectorAll(".raci-matrix-domain-btn").forEach((btn) => {
      const active = btn.getAttribute("data-raci-domain") === normalized;
      btn.classList.toggle("raci-matrix-domain-btn--active", active);
      btn.setAttribute("aria-selected", String(active));
    });
  }
}

function renderRaciMatrixEmptyMessage(message) {
  if (!elements.roadmapsRaciMatrixTable) return;
  elements.roadmapsRaciMatrixTable.innerHTML = "";
  elements.roadmapsRaciMatrixTable.className = "raci-matrix-board-host raci-matrix-board-host--empty";
  const empty = document.createElement("p");
  empty.className = "raci-matrix-empty";
  empty.textContent = message;
  elements.roadmapsRaciMatrixTable.appendChild(empty);
}

function buildRaciMatrixRoadmapLink(roadmap) {
  const titleBtn = document.createElement("button");
  titleBtn.type = "button";
  titleBtn.className = "raci-matrix-roadmap-link";
  titleBtn.textContent = roadmap.title || "Untitled roadmap";
  titleBtn.setAttribute("data-action", "viewRoadmap");
  titleBtn.setAttribute("data-id", roadmap.id);
  return titleBtn;
}

function buildRaciMatrixNameChip(entry) {
  const item = document.createElement("li");
  item.className = "raci-matrix-name-chip";
  const avatar = document.createElement("span");
  avatar.className = "raci-matrix-name-chip__avatar";
  avatar.setAttribute("aria-hidden", "true");
  avatar.textContent = getPersonDisplayInitials(entry.name);
  const label = document.createElement("span");
  label.className = "raci-matrix-name-chip__label";
  label.textContent = entry.name;
  label.title = entry.name;
  item.appendChild(avatar);
  item.appendChild(label);
  return item;
}

function formatRaciEntriesTooltip(entries, role) {
  const roleLabel = RACI_MATRIX_ROLE_LABELS[role] || role;
  const names = entries.map((entry) => String(entry.name || "").trim()).filter(Boolean);
  if (!names.length) return "";
  if (names.length === 1) return `${roleLabel}: ${names[0]}`;
  return `${roleLabel} (${names.length}): ${names.join(", ")}`;
}

function buildRaciMatrixEntriesTooltip(entries, role) {
  const roleLabel = RACI_MATRIX_ROLE_LABELS[role] || role;
  const names = entries.map((entry) => String(entry.name || "").trim()).filter(Boolean);

  const tooltipEl = document.createElement("div");
  tooltipEl.className = "cell-type-tooltip cell-type-tooltip--wide cell-type-tooltip--raci";
  if (names.length > 5) tooltipEl.classList.add("cell-type-tooltip--scroll");
  tooltipEl.setAttribute("role", "tooltip");

  const titleEl = document.createElement("div");
  titleEl.className = "cell-type-tooltip-title";
  titleEl.textContent = names.length === 1 ? roleLabel : `${roleLabel} (${names.length})`;
  tooltipEl.appendChild(titleEl);

  const bodyEl = document.createElement("div");
  bodyEl.className = "cell-type-tooltip-body raci-matrix-tooltip-body";
  const listEl = document.createElement("ul");
  listEl.className = "raci-matrix-tooltip-list";
  names.forEach((name) => {
    const item = document.createElement("li");
    item.className = "raci-matrix-tooltip-item";
    item.dataset.raciRole = role;
    const avatar = document.createElement("span");
    avatar.className = "raci-matrix-tooltip-item__avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = getPersonDisplayInitials(name);
    const label = document.createElement("span");
    label.className = "raci-matrix-tooltip-item__name";
    label.textContent = name;
    item.appendChild(avatar);
    item.appendChild(label);
    listEl.appendChild(item);
  });
  bodyEl.appendChild(listEl);
  tooltipEl.appendChild(bodyEl);
  bodyEl.addEventListener(
    "wheel",
    (e) => {
      e.stopPropagation();
    },
    { passive: true }
  );
  return tooltipEl;
}

function buildRaciMatrixTooltipWrap(entries, role, contentNode) {
  const wrap = document.createElement("span");
  wrap.className = "raci-matrix-with-tooltip";
  wrap.setAttribute("tabindex", "0");
  wrap.setAttribute("aria-label", formatRaciEntriesTooltip(entries, role));
  wrap.dataset.raciRole = role;
  wrap.appendChild(contentNode);
  wrap.appendChild(buildRaciMatrixEntriesTooltip(entries, role));
  return wrap;
}

function buildRaciMatrixCardRoleValue(entries, role, roadmapId) {
  const body = document.createElement("div");
  body.className = "raci-matrix-card__role-body";

  const value = document.createElement("div");
  value.className = "raci-matrix-card__role-value raci-matrix-role-value";
  value.dataset.raciRole = role;
  value.id = `raci-card-${roadmapId}-${role}-assignees`;

  if (!entries.length) {
    const empty = document.createElement("span");
    empty.className = "raci-matrix-cell-empty";
    empty.textContent = "—";
    empty.setAttribute("aria-label", "No assignment");
    value.appendChild(empty);
    body.appendChild(value);
    return body;
  }

  const list = document.createElement("ul");
  list.className = "raci-matrix-name-list";
  list.appendChild(buildRaciMatrixNameChip(entries[0]));

  if (entries.length > 1) {
    entries.slice(1).forEach((entry) => {
      const chip = buildRaciMatrixNameChip(entry);
      chip.classList.add("raci-matrix-card__role-extra");
      list.appendChild(chip);
    });
    value.appendChild(list);
    body.appendChild(value);

    const roleLabel = RACI_MATRIX_ROLE_LABELS[role] || role;
    const hiddenCount = entries.length - 1;
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "raci-matrix-card__role-toggle";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", value.id);
    toggle.setAttribute(
      "aria-label",
      `Show ${hiddenCount} more ${roleLabel} assignee${hiddenCount === 1 ? "" : "s"}`
    );
    toggle.textContent = `+${hiddenCount} more`;
    body.appendChild(toggle);
    return body;
  }

  value.appendChild(list);
  body.appendChild(value);
  return body;
}

function handleRaciMatrixCardRoleToggle(toggleBtn) {
  const roleRow = toggleBtn.closest(".raci-matrix-card__role");
  if (!roleRow) return;

  const isCollapsed = roleRow.classList.contains("raci-matrix-card__role--collapsed");
  const nextCollapsed = !isCollapsed;
  roleRow.classList.toggle("raci-matrix-card__role--collapsed", nextCollapsed);
  roleRow.classList.toggle("raci-matrix-card__role--expanded", !nextCollapsed);
  toggleBtn.setAttribute("aria-expanded", String(!nextCollapsed));

  const role = roleRow.dataset.raciRole || "";
  const roleLabel = RACI_MATRIX_ROLE_LABELS[role] || role;
  const extraCount = roleRow.querySelectorAll(".raci-matrix-card__role-extra").length;

  if (nextCollapsed) {
    toggleBtn.textContent = `+${extraCount} more`;
    toggleBtn.setAttribute(
      "aria-label",
      `Show ${extraCount} more ${roleLabel} assignee${extraCount === 1 ? "" : "s"}`
    );
  } else {
    toggleBtn.textContent = "Show less";
    toggleBtn.setAttribute("aria-label", `Show fewer ${roleLabel} assignees`);
  }
}

function buildRaciMatrixDesktopRoleValue(entries, role) {
  const value = document.createElement("div");
  value.className =
    "raci-matrix-role-value raci-matrix-role-value--compact raci-matrix-role-value--grid";
  value.dataset.raciRole = role;
  if (!entries.length) {
    const empty = document.createElement("span");
    empty.className = "raci-matrix-cell-empty";
    empty.textContent = "—";
    empty.setAttribute("aria-label", "No assignment");
    value.appendChild(empty);
    return value;
  }

  const list = document.createElement("ul");
  list.className = "raci-matrix-name-list raci-matrix-name-list--compact";
  list.appendChild(buildRaciMatrixNameChip(entries[0]));

  if (entries.length > 1) {
    const more = document.createElement("li");
    more.className = "raci-matrix-name-chip raci-matrix-name-chip--more";
    more.textContent = `+${entries.length - 1}`;
    more.setAttribute("aria-hidden", "true");
    list.appendChild(more);
    value.appendChild(buildRaciMatrixTooltipWrap(entries, role, list));
  } else {
    value.appendChild(list);
  }
  return value;
}

function buildRaciMatrixColumnHead(role) {
  const label = RACI_MATRIX_ROLE_LABELS[role] || role;
  const short = RACI_MATRIX_ROLE_SHORT[role] || role.slice(0, 1).toUpperCase();
  const wrap = document.createElement("span");
  wrap.className = "raci-matrix-col-head";
  const badge = document.createElement("span");
  badge.className = "raci-matrix-role-badge";
  badge.textContent = short;
  badge.setAttribute("aria-hidden", "true");
  const text = document.createElement("span");
  text.className = "raci-matrix-col-head__label";
  text.textContent = label;
  wrap.appendChild(badge);
  wrap.appendChild(text);
  return wrap;
}

function buildRaciMatrixDesktopRoadmapCell(roadmap) {
  const wrap = document.createElement("div");
  wrap.className = "raci-matrix-grid__roadmap";

  if (isSuperAdminModeActive() && roadmap.ownerProfileName) {
    const ownerStrip = buildRoadmapOwnerIdentityElement(roadmap, {
      variant: "raci-grid",
      showTeam: false,
      showScopeHint: true
    });
    if (ownerStrip) {
      wrap.classList.add("raci-matrix-grid__roadmap--has-owner");
      wrap.appendChild(ownerStrip);
    }
  }

  const titleBtn = buildRaciMatrixRoadmapLink(roadmap);
  titleBtn.classList.add("raci-matrix-grid__roadmap-link");
  wrap.appendChild(titleBtn);

  return wrap;
}

function buildRaciMatrixDesktopGrid(roadmaps, domain) {
  const panel = document.createElement("div");
  panel.className = "raci-matrix-table-panel";

  const grid = document.createElement("div");
  grid.className = "raci-matrix-grid";
  grid.setAttribute("role", "table");
  grid.setAttribute("aria-label", `RACI matrix (${domain} perspective)`);

  const headerRow = document.createElement("div");
  headerRow.className = "raci-matrix-grid__row raci-matrix-grid__row--head";
  headerRow.setAttribute("role", "row");

  const roadmapHead = document.createElement("div");
  roadmapHead.className = "raci-matrix-grid__cell raci-matrix-grid__cell--roadmap";
  roadmapHead.setAttribute("role", "columnheader");
  roadmapHead.textContent = "Roadmap";
  headerRow.appendChild(roadmapHead);

  RACI_ROLES.forEach((role) => {
    const headCell = document.createElement("div");
    headCell.className = "raci-matrix-grid__cell raci-matrix-grid__cell--role";
    headCell.setAttribute("role", "columnheader");
    headCell.id = `raci-col-${role}`;
    headCell.dataset.raciRole = role;
    headCell.appendChild(buildRaciMatrixColumnHead(role));
    headerRow.appendChild(headCell);
  });
  grid.appendChild(headerRow);

  roadmaps.forEach((roadmap) => {
    const row = document.createElement("div");
    row.className = "raci-matrix-grid__row";
    row.setAttribute("role", "row");
    if (
      isSuperAdminModeActive() &&
      roadmap.ownerProfileId &&
      roadmap.ownerProfileId !== state.activeProfileId
    ) {
      row.classList.add("raci-matrix-grid__row--external-profile");
    }

    const roadmapCell = document.createElement("div");
    roadmapCell.className = "raci-matrix-grid__cell raci-matrix-grid__cell--roadmap";
    roadmapCell.setAttribute("role", "rowheader");
    roadmapCell.appendChild(buildRaciMatrixDesktopRoadmapCell(roadmap));
    row.appendChild(roadmapCell);

    const raci = normalizeRoadmapRaci(roadmap.raci);
    RACI_ROLES.forEach((role) => {
      const roleCell = document.createElement("div");
      roleCell.className = "raci-matrix-grid__cell raci-matrix-grid__cell--role";
      roleCell.setAttribute("role", "cell");
      roleCell.dataset.raciRole = role;
      roleCell.setAttribute("headers", `raci-col-${role}`);
      const entries = getRaciEntriesForMatrixDomain({ raci }, role, domain);
      roleCell.appendChild(buildRaciMatrixDesktopRoleValue(entries, role));
      row.appendChild(roleCell);
    });
    grid.appendChild(row);
  });

  panel.appendChild(grid);
  return panel;
}

function buildRaciMatrixCards(roadmaps, domain) {
  const cards = document.createElement("div");
  cards.className = "raci-matrix-cards";
  cards.setAttribute("role", "list");
  cards.setAttribute("aria-label", `RACI roadmap cards (${domain} perspective)`);

  roadmaps.forEach((roadmap) => {
    const card = document.createElement("article");
    card.className = "raci-matrix-card";
    card.setAttribute("role", "listitem");
    if (
      isSuperAdminModeActive() &&
      roadmap.ownerProfileId &&
      roadmap.ownerProfileId !== state.activeProfileId
    ) {
      card.classList.add("raci-matrix-card--external-profile");
    }

    const header = document.createElement("header");
    header.className = "raci-matrix-card__header";
    header.appendChild(buildRaciMatrixRoadmapLink(roadmap));

    const roles = document.createElement("div");
    roles.className = "raci-matrix-card__roles";
    const raci = normalizeRoadmapRaci(roadmap.raci);
    RACI_ROLES.forEach((role) => {
      const roleRow = document.createElement("div");
      roleRow.className = "raci-matrix-card__role";
      roleRow.dataset.raciRole = role;

      const roleLabel = document.createElement("div");
      roleLabel.className = "raci-matrix-card__role-label";
      const badge = document.createElement("span");
      badge.className = "raci-matrix-role-badge";
      badge.textContent = RACI_MATRIX_ROLE_SHORT[role] || role.slice(0, 1).toUpperCase();
      badge.setAttribute("aria-hidden", "true");
      const labelText = document.createElement("span");
      labelText.className = "raci-matrix-card__role-name";
      labelText.textContent = RACI_MATRIX_ROLE_LABELS[role] || role;
      roleLabel.appendChild(badge);
      roleLabel.appendChild(labelText);

      const entries = getRaciEntriesForMatrixDomain({ raci }, role, domain);
      roleRow.appendChild(roleLabel);
      if (entries.length > 1) {
        roleRow.classList.add("raci-matrix-card__role--expandable", "raci-matrix-card__role--collapsed");
      }
      roleRow.appendChild(buildRaciMatrixCardRoleValue(entries, role, roadmap.id));
      roles.appendChild(roleRow);
    });

    const ownerStrip = buildPortfolioCardOwnerStrip(roadmap);
    if (ownerStrip) {
      card.classList.add("raci-matrix-card--has-owner");
      card.appendChild(ownerStrip);
    }
    card.appendChild(header);
    card.appendChild(roles);
    cards.appendChild(card);
  });

  return cards;
}

function renderRaciMatrix() {
  if (!elements.roadmapsRaciMatrixTable) return;
  const domain = normalizeRaciDomain(state.raciMatrixDomain);
  syncRaciMatrixDomainToggle(domain);

  const activeProfile = getActiveProfile();
  if (!activeProfile) {
    renderRaciMatrixEmptyMessage("Create or select a profile to view the RACI matrix.");
    return;
  }
  if (!isProfileUnlocked(activeProfile.id)) {
    renderRaciMatrixEmptyMessage("Unlock this profile to view the RACI matrix.");
    return;
  }

  const baseRoadmaps = getPortfolioRoadmapsBaseList();
  const roadmaps = sortRoadmaps(applyFilters(baseRoadmaps));
  if (!roadmaps.length) {
    renderRaciMatrixEmptyMessage(
      isSuperAdminModeActive()
        ? "No roadmaps match the current filters across all profiles."
        : "No roadmaps match the current filters."
    );
    return;
  }

  const board = document.createElement("div");
  board.className = "raci-matrix-board";
  board.appendChild(buildRaciMatrixDesktopGrid(roadmaps, domain));
  board.appendChild(buildRaciMatrixCards(roadmaps, domain));

  elements.roadmapsRaciMatrixTable.className = "raci-matrix-board-host";
  elements.roadmapsRaciMatrixTable.innerHTML = "";
  elements.roadmapsRaciMatrixTable.appendChild(board);
}

function renderNonTableRoadmapsView() {
  if (state.roadmapsView === "board" && elements.scrumBoardContainer) {
    renderScrumBoard();
  } else if (state.roadmapsView === "moscow" && elements.moscowBoardContainer) {
    renderMoscowBoard();
  } else if (state.roadmapsView === "map" && elements.roadmapsMapContainer) {
    renderRoadmapsMap();
  } else if (state.roadmapsView === "raci" && elements.roadmapsRaciMatrixTable) {
    renderRaciMatrix();
  } else if (state.roadmapsView === "kano" && elements.portfolioKanoMatrix) {
    renderKanoPortfolioMatrix();
  }
}

function roadmapHasKanoPosition(roadmap) {
  const f = normalizeKanoAxisLevel(roadmap && roadmap.kanoFunctionality);
  const s = normalizeKanoAxisLevel(roadmap && roadmap.kanoSatisfaction);
  return f != null && s != null;
}

function truncatePortfolioKanoLabel(text, maxLen = 22) {
  const value = String(text || "").trim();
  if (!value) return "Untitled";
  if (value.length <= maxLen) return value;
  return `${value.slice(0, maxLen - 1)}…`;
}

function ensurePortfolioKanoLegend() {
  const legend = elements.portfolioKanoLegend;
  if (!legend || legend.dataset.kanoLegendReady === "1") return;
  if (typeof kanoCategoryLegend === "undefined" || !Array.isArray(kanoCategoryLegend)) return;
  legend.dataset.kanoLegendReady = "1";
  legend.innerHTML = "";
  kanoCategoryLegend.forEach((entry) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = `portfolio-kano-legend__item portfolio-kano-legend__item--${entry.id}`;
    item.dataset.kanoZone = entry.id;
    item.setAttribute("aria-pressed", "false");
    item.title = entry.description || entry.label;

    const code = document.createElement("span");
    code.className = "portfolio-kano-legend__code";
    code.textContent =
      entry.categoryCode && entry.hintCode ? `${entry.categoryCode}-${entry.hintCode}` : entry.compactLabel || entry.label.slice(0, 1);

    const copy = document.createElement("span");
    copy.className = "portfolio-kano-legend__copy";
    const label = document.createElement("span");
    label.className = "portfolio-kano-legend__label";
    label.textContent = entry.label;
    const hint = document.createElement("span");
    hint.className = "portfolio-kano-legend__hint";
    hint.textContent = entry.hint || entry.compactLabel || "";
    copy.appendChild(label);
    copy.appendChild(hint);

    const count = document.createElement("span");
    count.className = "portfolio-kano-legend__count";
    count.dataset.kanoLegendCount = entry.id;
    count.textContent = "0";

    item.appendChild(code);
    item.appendChild(copy);
    item.appendChild(count);
    item.setAttribute(
      "aria-label",
      `${entry.label}${entry.hint ? `, ${entry.hint}` : ""}, 0 roadmaps`
    );
    legend.appendChild(item);
  });
  initPortfolioKanoLegendFilter();
}

function updatePortfolioKanoLegendCounts(positionedRoadmaps) {
  if (!elements.portfolioKanoLegend) return;
  const counts = {};
  positionedRoadmaps.forEach((roadmap) => {
    const f = normalizeKanoAxisLevel(roadmap.kanoFunctionality);
    const s = normalizeKanoAxisLevel(roadmap.kanoSatisfaction);
    const zoneId = getKanoCellZoneId(f, s);
    counts[zoneId] = (counts[zoneId] || 0) + 1;
  });
  elements.portfolioKanoLegend.querySelectorAll("[data-kano-legend-count]").forEach((el) => {
    const zone = el.getAttribute("data-kano-legend-count");
    const count = counts[zone] || 0;
    el.textContent = String(count);
    const item = el.closest(".portfolio-kano-legend__item");
    if (item) {
      const entry = kanoCategoryLegend.find((e) => e.id === zone);
      if (entry) {
        item.setAttribute(
          "aria-label",
          `${entry.label}${entry.hint ? `, ${entry.hint}` : ""}, ${count} roadmap${count === 1 ? "" : "s"}`
        );
      }
    }
  });
}

let portfolioKanoLegendFilter = null;
let portfolioKanoPointerDrag = null;
let portfolioKanoDropHighlightCell = null;
let portfolioKanoSuppressNextTileClick = false;
const PORTFOLIO_KANO_CELL_DRAG_OVER = "portfolio-kano-matrix-cell--drag-over";
const PORTFOLIO_KANO_DRAG_THRESHOLD_PX = 6;

function initPortfolioKanoLegendFilter() {
  if (!elements.portfolioKanoLegend || elements.portfolioKanoLegend.dataset.filterReady === "1") return;
  elements.portfolioKanoLegend.dataset.filterReady = "1";
  elements.portfolioKanoLegend.addEventListener("click", (event) => {
    const btn = event.target.closest(".portfolio-kano-legend__item");
    if (!btn) return;
    const zone = btn.getAttribute("data-kano-zone");
    portfolioKanoLegendFilter = portfolioKanoLegendFilter === zone ? null : zone;
    syncPortfolioKanoLegendFilter();
  });
}

function syncPortfolioKanoLegendFilter() {
  if (elements.portfolioKanoLegend) {
    elements.portfolioKanoLegend.querySelectorAll(".portfolio-kano-legend__item").forEach((item) => {
      const active = portfolioKanoLegendFilter === item.getAttribute("data-kano-zone");
      item.classList.toggle("portfolio-kano-legend__item--active", active);
      item.setAttribute("aria-pressed", String(active));
    });
  }
  const host = elements.portfolioKanoMatrix;
  if (!host) return;
  host.classList.toggle("portfolio-kano-matrix-host--filtered", !!portfolioKanoLegendFilter);
  host.querySelectorAll(".portfolio-kano-matrix-cell").forEach((cell) => {
    const match = !portfolioKanoLegendFilter || cell.dataset.kanoZone === portfolioKanoLegendFilter;
    cell.classList.toggle("portfolio-kano-matrix-cell--dimmed", !match);
  });
  host.querySelectorAll(".portfolio-kano-matrix-tile").forEach((tile) => {
    const match =
      !portfolioKanoLegendFilter ||
      Array.from(tile.classList).some((cls) => cls === `portfolio-kano-matrix-tile--${portfolioKanoLegendFilter}`);
    tile.classList.toggle("portfolio-kano-matrix-tile--dimmed", !match);
  });
  const listHost = elements.portfolioKanoPositionedList;
  if (listHost) {
    listHost.classList.toggle("portfolio-kano-positioned-list--filtered", !!portfolioKanoLegendFilter);
    listHost.querySelectorAll(".portfolio-kano-compact-group").forEach((group) => {
      const match = !portfolioKanoLegendFilter || group.dataset.kanoZone === portfolioKanoLegendFilter;
      group.classList.toggle("portfolio-kano-compact-group--dimmed", !match);
    });
    listHost.querySelectorAll(".portfolio-kano-compact-card").forEach((card) => {
      const match = !portfolioKanoLegendFilter || card.dataset.kanoZone === portfolioKanoLegendFilter;
      card.classList.toggle("portfolio-kano-compact-card--dimmed", !match);
    });
  }
}

function ensurePortfolioKanoMatrixMounted() {
  const host = elements.portfolioKanoMatrix;
  if (!host || host.dataset.kanoVersion === "6") return;
  if (typeof kanoFunctionalityLevels === "undefined" || typeof kanoSatisfactionLevels === "undefined") {
    return;
  }

  host.dataset.kanoVersion = "6";
  host.innerHTML = "";

  const shell = document.createElement("div");
  shell.className = "portfolio-kano-matrix-shell";

  const band = document.createElement("div");
  band.className = "portfolio-kano-matrix-band";
  band.setAttribute("aria-hidden", "true");
  const bandY = document.createElement("span");
  bandY.className = "portfolio-kano-matrix-band__item portfolio-kano-matrix-band__item--y";
  bandY.textContent = "Satisfaction";
  const bandX = document.createElement("span");
  bandX.className = "portfolio-kano-matrix-band__item portfolio-kano-matrix-band__item--x";
  bandX.textContent = "Functionality";
  band.appendChild(bandY);
  band.appendChild(bandX);
  shell.appendChild(band);

  const wrap = document.createElement("div");
  wrap.className = "portfolio-kano-matrix-wrap";

  const corner = document.createElement("div");
  corner.className = "portfolio-kano-matrix-corner";
  const yTitle = document.createElement("span");
  yTitle.className = "portfolio-kano-axis-title portfolio-kano-axis-title--y";
  yTitle.textContent = "Satisfaction";
  corner.appendChild(yTitle);
  wrap.appendChild(corner);

  const appendPortfolioAxisLabel = (axis, level, meta) => {
    const label = document.createElement("span");
    label.className = `portfolio-kano-axis-label portfolio-kano-axis-label--${axis}`;
    label.dataset.level = String(level);
    const full = document.createElement("span");
    full.className = "portfolio-kano-axis-label__full";
    full.textContent = meta ? meta.shortLabel : String(level);
    const micro = document.createElement("span");
    micro.className = "portfolio-kano-axis-label__micro";
    micro.textContent = String(level);
    micro.setAttribute("aria-hidden", "true");
    label.appendChild(full);
    label.appendChild(micro);
    if (meta && meta.description) label.title = `${meta.label || meta.shortLabel}: ${meta.description}`;
    wrap.appendChild(label);
  };

  for (let s = 5; s >= 1; s -= 1) {
    appendPortfolioAxisLabel("y", s, getKanoLevelMeta(kanoSatisfactionLevels, s));
  }

  const grid = document.createElement("div");
  grid.className = "portfolio-kano-matrix-grid";
  grid.setAttribute("role", "grid");
  grid.setAttribute("aria-label", "Portfolio KANO matrix");

  for (let s = 5; s >= 1; s -= 1) {
    for (let f = 1; f <= 5; f += 1) {
      const zoneId = getKanoCellZoneId(f, s);
      const category =
        typeof getKanoCategoryFromPosition === "function" ? getKanoCategoryFromPosition(f, s) : null;
      const cell = document.createElement("div");
      cell.className = `portfolio-kano-matrix-cell portfolio-kano-matrix-cell--zone-${zoneId}`;
      cell.dataset.functionality = String(f);
      cell.dataset.satisfaction = String(s);
      cell.dataset.kanoZone = zoneId;
      cell.style.gridColumn = String(f + 1);
      cell.style.gridRow = String(7 - s);
      cell.setAttribute("role", "gridcell");
      cell.title = category ? category.label : "";

      const glyphWrap = document.createElement("div");
      glyphWrap.className = "portfolio-kano-matrix-cell__glyph-wrap";
      glyphWrap.appendChild(buildRoadmapKanoCellGlyph(zoneId));
      cell.appendChild(glyphWrap);

      const countBadge = document.createElement("span");
      countBadge.className = "portfolio-kano-matrix-cell__count";
      countBadge.hidden = true;
      countBadge.setAttribute("aria-hidden", "true");
      cell.appendChild(countBadge);

      const roadmapsWrap = document.createElement("div");
      roadmapsWrap.className = "portfolio-kano-matrix-cell__roadmaps";
      cell.appendChild(roadmapsWrap);
      grid.appendChild(cell);
    }
  }

  wrap.appendChild(grid);

  for (let f = 1; f <= 5; f += 1) {
    appendPortfolioAxisLabel("x", f, getKanoLevelMeta(kanoFunctionalityLevels, f));
  }

  const xTitle = document.createElement("span");
  xTitle.className = "portfolio-kano-axis-title portfolio-kano-axis-title--x";
  xTitle.textContent = "Functionality";
  wrap.appendChild(xTitle);

  shell.appendChild(wrap);
  host.appendChild(shell);
  initPortfolioKanoMatrixDragDrop();
}

function setRoadmapKanoPosition(roadmapId, functionality, satisfaction) {
  if (!requireWritableActiveProfile("Move KANO position")) return false;
  if (!getUnlockedActiveProfile()) return false;
  const f = normalizeKanoAxisLevel(functionality);
  const s = normalizeKanoAxisLevel(satisfaction);
  if (f == null || s == null) return false;

  const located = findRoadmapWithOwner(roadmapId);
  const roadmap = located.roadmap;
  if (!roadmap) return false;

  const currentF = normalizeKanoAxisLevel(roadmap.kanoFunctionality);
  const currentS = normalizeKanoAxisLevel(roadmap.kanoSatisfaction);
  if (currentF === f && currentS === s) return false;

  roadmap.kanoFunctionality = f;
  roadmap.kanoSatisfaction = s;
  roadmap.modifiedAt = new Date().toISOString();
  saveState();
  renderKanoPortfolioMatrix();
  renderRoadmaps();
  return true;
}

function setPortfolioKanoDropCell(cell) {
  if (cell === portfolioKanoDropHighlightCell) return;
  if (portfolioKanoDropHighlightCell) {
    portfolioKanoDropHighlightCell.classList.remove(PORTFOLIO_KANO_CELL_DRAG_OVER);
  }
  portfolioKanoDropHighlightCell = cell;
  if (cell) cell.classList.add(PORTFOLIO_KANO_CELL_DRAG_OVER);
}

function resolvePortfolioKanoCellAt(clientX, clientY) {
  const preview = portfolioKanoPointerDrag && portfolioKanoPointerDrag.preview;
  if (preview) preview.style.visibility = "hidden";
  const target = document.elementFromPoint(clientX, clientY);
  if (preview) preview.style.visibility = "visible";
  return target && target.closest ? target.closest(".portfolio-kano-matrix-cell") : null;
}

function activatePortfolioKanoPointerDrag() {
  const session = portfolioKanoPointerDrag;
  if (!session || session.active) return;
  session.active = true;

  const { tile } = session;
  const rect = tile.getBoundingClientRect();
  const host = elements.portfolioKanoMatrix;

  tile.classList.add("portfolio-kano-matrix-tile--drag-source");
  if (host) host.classList.add("portfolio-kano-matrix-host--dragging");
  document.documentElement.classList.add("portfolio-kano-drag-active");

  const preview = document.createElement("div");
  preview.className = "portfolio-kano-drag-preview portfolio-kano-matrix-tile";
  tile.classList.forEach((cls) => {
    if (cls.startsWith("portfolio-kano-matrix-tile--") && cls !== "portfolio-kano-matrix-tile--drag-source") {
      preview.classList.add(cls);
    }
  });

  const stripe = document.createElement("span");
  stripe.className = "portfolio-kano-matrix-tile__stripe";
  stripe.setAttribute("aria-hidden", "true");
  const titleEl = document.createElement("span");
  titleEl.className = "portfolio-kano-matrix-tile__title";
  titleEl.textContent = tile.querySelector(".portfolio-kano-matrix-tile__title")?.textContent || "";
  preview.appendChild(stripe);
  preview.appendChild(titleEl);
  preview.style.width = `${Math.round(rect.width)}px`;
  document.body.appendChild(preview);
  session.preview = preview;
  movePortfolioKanoPointerDrag(session.startX, session.startY);
}

function movePortfolioKanoPointerDrag(clientX, clientY) {
  const session = portfolioKanoPointerDrag;
  if (!session || !session.preview) return;
  session.preview.style.transform = `translate3d(${Math.round(clientX - session.offsetX)}px, ${Math.round(clientY - session.offsetY)}px, 0)`;
  setPortfolioKanoDropCell(resolvePortfolioKanoCellAt(clientX, clientY));
}

function cleanupPortfolioKanoPointerDrag() {
  const session = portfolioKanoPointerDrag;
  if (session && session.tile) {
    session.tile.classList.remove("portfolio-kano-matrix-tile--drag-source");
  }
  if (session && session.preview && session.preview.parentNode) {
    session.preview.parentNode.removeChild(session.preview);
  }
  const host = elements.portfolioKanoMatrix;
  if (host) host.classList.remove("portfolio-kano-matrix-host--dragging");
  document.documentElement.classList.remove("portfolio-kano-drag-active");
  setPortfolioKanoDropCell(null);
}

function teardownPortfolioKanoPointerListeners() {
  window.removeEventListener("pointermove", onPortfolioKanoPointerMove);
  window.removeEventListener("pointerup", onPortfolioKanoPointerUp);
  window.removeEventListener("pointercancel", onPortfolioKanoPointerUp);
  window.removeEventListener("keydown", onPortfolioKanoPointerEscape);
}

function onPortfolioKanoPointerMove(event) {
  if (!portfolioKanoPointerDrag || portfolioKanoPointerDrag.pointerId !== event.pointerId) return;

  if (!portfolioKanoPointerDrag.active) {
    const dx = event.clientX - portfolioKanoPointerDrag.startX;
    const dy = event.clientY - portfolioKanoPointerDrag.startY;
    if (Math.hypot(dx, dy) < PORTFOLIO_KANO_DRAG_THRESHOLD_PX) return;
    activatePortfolioKanoPointerDrag();
  }

  event.preventDefault();
  movePortfolioKanoPointerDrag(event.clientX, event.clientY);
}

function onPortfolioKanoPointerUp(event) {
  if (!portfolioKanoPointerDrag || portfolioKanoPointerDrag.pointerId !== event.pointerId) return;

  const wasActive = portfolioKanoPointerDrag.active;
  if (wasActive) {
    event.preventDefault();
    event.stopPropagation();
    const cell = resolvePortfolioKanoCellAt(event.clientX, event.clientY);
    const moved =
      cell &&
      setRoadmapKanoPosition(
        portfolioKanoPointerDrag.roadmapId,
        cell.dataset.functionality,
        cell.dataset.satisfaction
      );
    if (moved || wasActive) {
      portfolioKanoSuppressNextTileClick = true;
      window.setTimeout(() => {
        portfolioKanoSuppressNextTileClick = false;
      }, 120);
    }
    cleanupPortfolioKanoPointerDrag();
  }

  teardownPortfolioKanoPointerListeners();
  portfolioKanoPointerDrag = null;
}

function onPortfolioKanoPointerEscape(event) {
  if (event.key !== "Escape" || !portfolioKanoPointerDrag || !portfolioKanoPointerDrag.active) return;
  cleanupPortfolioKanoPointerDrag();
  teardownPortfolioKanoPointerListeners();
  portfolioKanoPointerDrag = null;
}

function initPortfolioKanoMatrixDragDrop() {
  const host = elements.portfolioKanoMatrix;
  if (!host || host.dataset.dragReady === "1") return;
  host.dataset.dragReady = "1";

  host.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const tile = event.target.closest(".portfolio-kano-matrix-tile[data-kano-draggable='true']");
    if (!tile || isActiveDemoProfile()) return;

    const rect = tile.getBoundingClientRect();
    portfolioKanoPointerDrag = {
      tile,
      roadmapId: tile.getAttribute("data-id"),
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      active: false,
      preview: null,
      pointerId: event.pointerId
    };

    window.addEventListener("pointermove", onPortfolioKanoPointerMove, { passive: false });
    window.addEventListener("pointerup", onPortfolioKanoPointerUp);
    window.addEventListener("pointercancel", onPortfolioKanoPointerUp);
    window.addEventListener("keydown", onPortfolioKanoPointerEscape);
  });
}

function buildPortfolioKanoMatrixTile(roadmap) {
  const demoReadOnly = isActiveDemoProfile();
  const tile = document.createElement("div");
  tile.className = "portfolio-kano-matrix-tile";
  tile.setAttribute("role", "button");
  tile.tabIndex = 0;
  tile.setAttribute("data-action", "viewRoadmap");
  tile.setAttribute("data-id", roadmap.id);
  tile.setAttribute("data-roadmap-id", roadmap.id);
  if (!demoReadOnly) {
    tile.dataset.kanoDraggable = "true";
  }
  const title = roadmap.title || "Untitled roadmap";
  const category = getKanoCategoryFromPosition(roadmap.kanoFunctionality, roadmap.kanoSatisfaction);
  if (category && category.id) {
    tile.classList.add(`portfolio-kano-matrix-tile--${category.id}`);
  }

  const stripe = document.createElement("span");
  stripe.className = "portfolio-kano-matrix-tile__stripe";
  stripe.setAttribute("aria-hidden", "true");

  const titleEl = document.createElement("span");
  titleEl.className = "portfolio-kano-matrix-tile__title";
  titleEl.textContent = truncatePortfolioKanoLabel(title, 32);

  tile.appendChild(stripe);
  tile.appendChild(titleEl);
  const dragHint = demoReadOnly ? "" : " Drag to another cell to update KANO scores.";
  tile.title = `${title}${dragHint}`;
  if (
    isSuperAdminModeActive() &&
    roadmap.ownerProfileName &&
    roadmap.ownerProfileId !== state.activeProfileId
  ) {
    tile.title = `${title} · ${roadmap.ownerProfileName}.${dragHint}`;
  }
  const categorySuffix = category && category.label ? `, ${category.label}` : "";
  tile.setAttribute(
    "aria-label",
    demoReadOnly
      ? `${title}${categorySuffix}. Open roadmap.`
      : `${title}${categorySuffix}. Drag to reposition on the matrix, or activate to open roadmap.`
  );
  return tile;
}

function buildPortfolioKanoAxisSelect(roadmapId, axis, value, { disabled = false } = {}) {
  const levels = axis === "functionality" ? kanoFunctionalityLevels : kanoSatisfactionLevels;
  const select = document.createElement("select");
  select.className = "portfolio-kano-compact-card__select";
  select.setAttribute("data-action", "setRoadmapKanoAxis");
  select.setAttribute("data-kano-axis", axis);
  select.setAttribute("data-roadmap-id", roadmapId);
  select.setAttribute(
    "aria-label",
    axis === "functionality" ? "Functionality level" : "Satisfaction level"
  );
  if (disabled) select.disabled = true;
  levels.forEach((meta) => {
    const option = document.createElement("option");
    option.value = String(meta.level);
    option.textContent = meta.shortLabel || meta.label;
    if (meta.description) option.title = meta.description;
    select.appendChild(option);
  });
  const normalized = normalizeKanoAxisLevel(value);
  select.value = String(normalized != null ? normalized : 1);
  return select;
}

function buildPortfolioKanoCompactCard(roadmap) {
  const demoReadOnly = isActiveDemoProfile();
  const f = normalizeKanoAxisLevel(roadmap.kanoFunctionality);
  const s = normalizeKanoAxisLevel(roadmap.kanoSatisfaction);
  const zoneId = getKanoCellZoneId(f, s);
  const category = getKanoCategoryFromPosition(f, s);

  const card = document.createElement("article");
  card.className = `portfolio-kano-compact-card portfolio-kano-compact-card--${zoneId}`;
  card.dataset.kanoZone = zoneId;
  card.setAttribute("role", "listitem");

  const shell = document.createElement("div");
  shell.className = "portfolio-kano-compact-card__shell";

  const accent = document.createElement("span");
  accent.className = "portfolio-kano-compact-card__accent";
  accent.setAttribute("aria-hidden", "true");
  shell.appendChild(accent);

  const body = document.createElement("div");
  body.className = "portfolio-kano-compact-card__body";

  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "portfolio-kano-compact-card__open";
  openBtn.setAttribute("data-action", "viewRoadmap");
  openBtn.setAttribute("data-id", roadmap.id);

  const title = roadmap.title || "Untitled roadmap";
  const titleEl = document.createElement("span");
  titleEl.className = "portfolio-kano-compact-card__title";
  titleEl.textContent = title;

  const openMeta = document.createElement("span");
  openMeta.className = "portfolio-kano-compact-card__open-meta";

  const badge = document.createElement("span");
  badge.className = "portfolio-kano-compact-card__badge";
  badge.textContent = `F${f} · S${s}`;

  const chevron = document.createElement("span");
  chevron.className = "portfolio-kano-compact-card__chevron";
  chevron.setAttribute("aria-hidden", "true");
  chevron.textContent = "›";

  openMeta.appendChild(badge);
  openMeta.appendChild(chevron);
  openBtn.appendChild(titleEl);
  openBtn.appendChild(openMeta);
  body.appendChild(openBtn);

  const scores = document.createElement("div");
  scores.className = "portfolio-kano-compact-card__scores";

  const fField = document.createElement("label");
  fField.className = "portfolio-kano-compact-card__field portfolio-kano-compact-card__field--functionality";
  const fLabel = document.createElement("span");
  fLabel.className = "portfolio-kano-compact-card__field-label";
  fLabel.textContent = "Function";
  fField.appendChild(fLabel);
  fField.appendChild(buildPortfolioKanoAxisSelect(roadmap.id, "functionality", f, { disabled: demoReadOnly }));

  const sField = document.createElement("label");
  sField.className = "portfolio-kano-compact-card__field portfolio-kano-compact-card__field--satisfaction";
  const sLabel = document.createElement("span");
  sLabel.className = "portfolio-kano-compact-card__field-label";
  sLabel.textContent = "Satisfaction";
  sField.appendChild(sLabel);
  sField.appendChild(buildPortfolioKanoAxisSelect(roadmap.id, "satisfaction", s, { disabled: demoReadOnly }));

  scores.appendChild(fField);
  scores.appendChild(sField);
  body.appendChild(scores);

  if (
    isSuperAdminModeActive() &&
    roadmap.ownerProfileName &&
    roadmap.ownerProfileId !== state.activeProfileId
  ) {
    const meta = document.createElement("p");
    meta.className = "portfolio-kano-compact-card__meta";
    meta.textContent = roadmap.ownerProfileName;
    body.appendChild(meta);
  }

  shell.appendChild(body);
  card.appendChild(shell);
  const categorySuffix = category && category.label ? `, ${category.label}` : "";
  openBtn.title = `${title}${categorySuffix}`;
  openBtn.setAttribute("aria-label", `${title}${categorySuffix}. Open roadmap.`);
  return card;
}

function renderPortfolioKanoPositionedList(positioned) {
  const listHost = elements.portfolioKanoPositionedList;
  if (!listHost) return;
  listHost.innerHTML = "";

  const byZone = new Map();
  positioned.forEach((roadmap) => {
    const f = normalizeKanoAxisLevel(roadmap.kanoFunctionality);
    const s = normalizeKanoAxisLevel(roadmap.kanoSatisfaction);
    const zoneId = getKanoCellZoneId(f, s);
    if (!byZone.has(zoneId)) byZone.set(zoneId, []);
    byZone.get(zoneId).push(roadmap);
  });

  if (typeof kanoCategoryLegend === "undefined") return;

  kanoCategoryLegend.forEach((entry) => {
    const roadmaps = byZone.get(entry.id);
    if (!roadmaps || !roadmaps.length) return;

    const group = document.createElement("section");
    group.className = `portfolio-kano-compact-group portfolio-kano-compact-group--${entry.id}`;
    group.dataset.kanoZone = entry.id;

    const header = document.createElement("header");
    header.className = "portfolio-kano-compact-group__header";

    const code = document.createElement("span");
    code.className = "portfolio-kano-compact-group__code";
    code.textContent = `${entry.categoryCode}-${entry.hintCode}`;

    const copy = document.createElement("div");
    copy.className = "portfolio-kano-compact-group__copy";
    const titleEl = document.createElement("h5");
    titleEl.className = "portfolio-kano-compact-group__title";
    titleEl.textContent = entry.label;
    const hintEl = document.createElement("p");
    hintEl.className = "portfolio-kano-compact-group__hint";
    hintEl.textContent = entry.hint;
    copy.appendChild(titleEl);
    copy.appendChild(hintEl);

    const countEl = document.createElement("span");
    countEl.className = "portfolio-kano-compact-group__count";
    countEl.textContent = String(roadmaps.length);

    header.appendChild(code);
    header.appendChild(copy);
    header.appendChild(countEl);
    group.appendChild(header);

    const cardsWrap = document.createElement("div");
    cardsWrap.className = "portfolio-kano-compact-group__cards";
    roadmaps.forEach((roadmap) => {
      cardsWrap.appendChild(buildPortfolioKanoCompactCard(roadmap));
    });
    group.appendChild(cardsWrap);
    listHost.appendChild(group);
  });
}

function buildPortfolioKanoMatrixChip(roadmap) {
  return buildPortfolioKanoMatrixTile(roadmap);
}

function buildPortfolioKanoUnpositionedCard(roadmap) {
  const card = document.createElement("article");
  card.className = "portfolio-kano-card";
  card.setAttribute("role", "listitem");

  const shell = document.createElement("div");
  shell.className = "portfolio-kano-card__shell";

  const content = document.createElement("div");
  content.className = "portfolio-kano-card__content";

  const title = roadmap.title || "Untitled roadmap";
  const titleEl = document.createElement("h5");
  titleEl.className = "portfolio-kano-card__title";
  titleEl.textContent = title;

  const metaParts = [];
  const statusVal = roadmap.roadmapStatus || roadmap.status;
  if (statusVal) metaParts.push(String(statusVal));
  if (roadmap.moscowCategory) metaParts.push(String(roadmap.moscowCategory));
  if (
    isSuperAdminModeActive() &&
    roadmap.ownerProfileName &&
    roadmap.ownerProfileId !== state.activeProfileId
  ) {
    metaParts.push(roadmap.ownerProfileName);
  }

  content.appendChild(titleEl);
  if (metaParts.length) {
    const meta = document.createElement("p");
    meta.className = "portfolio-kano-card__meta";
    meta.textContent = metaParts.join(" · ");
    content.appendChild(meta);
  }

  const setBtn = document.createElement("button");
  setBtn.type = "button";
  setBtn.className = "portfolio-kano-card__set-btn";
  setBtn.setAttribute("data-action", "setRoadmapKano");
  setBtn.setAttribute("data-id", roadmap.id);
  setBtn.textContent = "Set KANO scores";
  setBtn.setAttribute("aria-label", `Set KANO scores for ${title}`);

  shell.appendChild(content);
  shell.appendChild(setBtn);
  card.appendChild(shell);
  return card;
}

function normalizeKanoPortfolioPanel(panel) {
  return panel === "unpositioned" ? "unpositioned" : "positioned";
}

function syncPortfolioKanoPanelToggle(panel) {
  const normalized = normalizeKanoPortfolioPanel(panel);
  if (elements.portfolioKanoPanelToggle) {
    elements.portfolioKanoPanelToggle.dataset.activePanel = normalized;
    elements.portfolioKanoPanelToggle.querySelectorAll(".portfolio-kano-panel-toggle__btn").forEach((btn) => {
      const active = btn.getAttribute("data-kano-panel") === normalized;
      btn.classList.toggle("portfolio-kano-panel-toggle__btn--active", active);
      btn.setAttribute("aria-selected", String(active));
    });
  }
}

function updatePortfolioKanoPanelToggleCounts(positionedCount, unpositionedCount) {
  if (!elements.portfolioKanoPanelToggle) return;
  elements.portfolioKanoPanelToggle.querySelectorAll("[data-kano-panel-count]").forEach((el) => {
    const key = el.getAttribute("data-kano-panel-count");
    const count = key === "unpositioned" ? unpositionedCount : positionedCount;
    el.textContent = String(count);
  });
  elements.portfolioKanoPanelToggle.querySelectorAll(".portfolio-kano-panel-toggle__btn").forEach((btn) => {
    const panel = btn.getAttribute("data-kano-panel");
    const count = panel === "unpositioned" ? unpositionedCount : positionedCount;
    btn.disabled = count === 0;
    btn.setAttribute("aria-disabled", String(count === 0));
  });
}

function syncPortfolioKanoPanelVisibility(panel, { positionedCount, unpositionedCount } = {}) {
  const normalized = normalizeKanoPortfolioPanel(panel);
  const showPositioned = normalized === "positioned";
  const showUnpositioned = normalized === "unpositioned";
  if (elements.portfolioKanoPositionedPanel) {
    elements.portfolioKanoPositionedPanel.hidden = !showPositioned;
  }
  if (elements.portfolioKanoUnpositionedPanel) {
    elements.portfolioKanoUnpositionedPanel.hidden = !showUnpositioned;
  }
  if (elements.portfolioKanoPositionedEmpty) {
    elements.portfolioKanoPositionedEmpty.hidden = !(showPositioned && positionedCount === 0);
  }
  const positionedHeader = elements.portfolioKanoPositionedPanel
    ? elements.portfolioKanoPositionedPanel.querySelector(".portfolio-kano-positioned__header")
    : null;
  if (positionedHeader) {
    positionedHeader.hidden = showPositioned && positionedCount === 0;
  }
  if (elements.portfolioKanoMatrix) {
    elements.portfolioKanoMatrix.hidden = showPositioned && positionedCount === 0;
  }
  if (elements.portfolioKanoPositionedList) {
    elements.portfolioKanoPositionedList.hidden = showPositioned && positionedCount === 0;
  }
  if (elements.portfolioKanoUnpositionedEmpty) {
    elements.portfolioKanoUnpositionedEmpty.hidden = !(showUnpositioned && unpositionedCount === 0);
  }
  if (elements.portfolioKanoUnpositionedList) {
    elements.portfolioKanoUnpositionedList.hidden = showUnpositioned && unpositionedCount === 0;
  }
  const unpositionedHeader = elements.portfolioKanoUnpositionedPanel
    ? elements.portfolioKanoUnpositionedPanel.querySelector(".portfolio-kano-unpositioned__header")
    : null;
  if (unpositionedHeader) {
    unpositionedHeader.hidden = showUnpositioned && unpositionedCount === 0;
  }
}

function initPortfolioKanoPanelToggle() {
  if (!elements.portfolioKanoPanelToggle) return;
  syncPortfolioKanoPanelToggle(state.kanoPortfolioPanel);
  elements.portfolioKanoPanelToggle.addEventListener("click", (event) => {
    const btn = event.target.closest(".portfolio-kano-panel-toggle__btn");
    if (!btn || btn.disabled) return;
    const next = normalizeKanoPortfolioPanel(btn.getAttribute("data-kano-panel"));
    if (state.kanoPortfolioPanel === next) return;
    state.kanoPortfolioPanel = next;
    saveState();
    syncPortfolioKanoPanelToggle(next);
    if (state.roadmapsView === "kano") renderKanoPortfolioMatrix();
  });
}

function renderKanoPortfolioEmptyMessage(message) {
  if (elements.portfolioKanoMatrix) {
    elements.portfolioKanoMatrix.innerHTML = "";
    const empty = document.createElement("p");
    empty.className = "portfolio-kano-empty";
    empty.textContent = message;
    elements.portfolioKanoMatrix.appendChild(empty);
  }
  if (elements.portfolioKanoPositionedPanel) {
    elements.portfolioKanoPositionedPanel.hidden = false;
  }
  if (elements.portfolioKanoUnpositionedPanel) {
    elements.portfolioKanoUnpositionedPanel.hidden = true;
  }
  if (elements.portfolioKanoPositionedEmpty) {
    elements.portfolioKanoPositionedEmpty.hidden = true;
  }
  if (elements.portfolioKanoUnpositionedEmpty) {
    elements.portfolioKanoUnpositionedEmpty.hidden = true;
  }
  if (elements.portfolioKanoUnpositionedList) {
    elements.portfolioKanoUnpositionedList.innerHTML = "";
  }
  if (elements.portfolioKanoPositionedList) {
    elements.portfolioKanoPositionedList.innerHTML = "";
  }
  updatePortfolioKanoPanelToggleCounts(0, 0);
}

function renderKanoPortfolioMatrix() {
  ensurePortfolioKanoLegend();
  ensurePortfolioKanoMatrixMounted();

  const activeProfile = getActiveProfile();
  if (!activeProfile) {
    renderKanoPortfolioEmptyMessage("Create or select a profile to view the KANO model.");
    return;
  }
  if (!isProfileUnlocked(activeProfile.id)) {
    renderKanoPortfolioEmptyMessage("Unlock this profile to view the KANO model.");
    return;
  }

  const baseRoadmaps = getPortfolioRoadmapsBaseList();
  const roadmaps = sortRoadmaps(applyFilters(baseRoadmaps));
  if (!roadmaps.length) {
    renderKanoPortfolioEmptyMessage(
      isSuperAdminModeActive()
        ? "No roadmaps match the current filters across all profiles."
        : "No roadmaps match the current filters."
    );
    return;
  }

  const positioned = [];
  const unpositioned = [];
  roadmaps.forEach((roadmap) => {
    if (roadmapHasKanoPosition(roadmap)) positioned.push(roadmap);
    else unpositioned.push(roadmap);
  });

  updatePortfolioKanoPanelToggleCounts(positioned.length, unpositioned.length);

  let activePanel = normalizeKanoPortfolioPanel(state.kanoPortfolioPanel);
  if (activePanel === "positioned" && positioned.length === 0 && unpositioned.length > 0) {
    activePanel = "unpositioned";
    state.kanoPortfolioPanel = activePanel;
    saveState();
  } else if (activePanel === "unpositioned" && unpositioned.length === 0 && positioned.length > 0) {
    activePanel = "positioned";
    state.kanoPortfolioPanel = activePanel;
    saveState();
  }
  syncPortfolioKanoPanelToggle(activePanel);
  syncPortfolioKanoPanelVisibility(activePanel, {
    positionedCount: positioned.length,
    unpositionedCount: unpositioned.length
  });

  const host = elements.portfolioKanoMatrix;
  if (!host || host.dataset.kanoVersion !== "6") {
    renderKanoPortfolioEmptyMessage("KANO matrix could not be initialized.");
    return;
  }

  host.querySelectorAll(".portfolio-kano-matrix-cell__roadmaps").forEach((wrap) => {
    wrap.innerHTML = "";
  });
  host.querySelectorAll(".portfolio-kano-matrix-cell__count").forEach((badge) => {
    badge.hidden = true;
    badge.textContent = "";
  });

  const cellRoadmapCounts = new Map();
  positioned.forEach((roadmap) => {
    const f = normalizeKanoAxisLevel(roadmap.kanoFunctionality);
    const s = normalizeKanoAxisLevel(roadmap.kanoSatisfaction);
    const cellKey = `${f}-${s}`;
    cellRoadmapCounts.set(cellKey, (cellRoadmapCounts.get(cellKey) || 0) + 1);
    const cell = host.querySelector(
      `.portfolio-kano-matrix-cell[data-functionality="${f}"][data-satisfaction="${s}"] .portfolio-kano-matrix-cell__roadmaps`
    );
    if (!cell) return;
    cell.appendChild(buildPortfolioKanoMatrixTile(roadmap));
  });

  cellRoadmapCounts.forEach((count, key) => {
    if (count <= 1) return;
    const [f, s] = key.split("-");
    const badge = host.querySelector(
      `.portfolio-kano-matrix-cell[data-functionality="${f}"][data-satisfaction="${s}"] .portfolio-kano-matrix-cell__count`
    );
    if (badge) {
      badge.hidden = false;
      badge.textContent = String(count);
    }
  });

  updatePortfolioKanoLegendCounts(positioned);
  syncPortfolioKanoLegendFilter();
  renderPortfolioKanoPositionedList(positioned);

  if (elements.portfolioKanoUnpositionedList) {
    elements.portfolioKanoUnpositionedList.innerHTML = "";
    unpositioned.forEach((roadmap) => {
      elements.portfolioKanoUnpositionedList.appendChild(buildPortfolioKanoUnpositionedCard(roadmap));
    });
  }
}

function initRaciMatrixDomainToggle() {
  if (!elements.raciMatrixDomainToggle) return;
  syncRaciMatrixDomainToggle(state.raciMatrixDomain);
  elements.raciMatrixDomainToggle.addEventListener("click", (event) => {
    const btn = event.target.closest(".raci-matrix-domain-btn");
    if (!btn) return;
    const next = normalizeRaciDomain(btn.getAttribute("data-raci-domain"));
    if (state.raciMatrixDomain === next) return;
    state.raciMatrixDomain = next;
    saveState();
    syncRaciMatrixDomainToggle(next);
    if (state.roadmapsView === "raci") renderRaciMatrix();
  });
}

function normalizeRoadmapTaskStatus(status) {
  const value = String(status || "").trim();
  const options = getRoadmapTaskStatusOptions();
  return options.includes(value) ? value : "Not Started";
}

function normalizeRoadmapTasks(tasks) {
  if (!Array.isArray(tasks)) return [];
  const out = [];
  tasks.forEach((task) => {
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

function buildRoadmapTaskStatusSelect(selectedStatus) {
  const select = document.createElement("select");
  select.className = "roadmap-task-status-select";
  select.setAttribute("aria-label", "Task status");
  getRoadmapTaskStatusOptions().forEach((status) => {
    const option = document.createElement("option");
    option.value = status;
    option.textContent = status;
    select.appendChild(option);
  });
  select.value = normalizeRoadmapTaskStatus(selectedStatus);
  return select;
}

function ensureRoadmapTaskRowHeader() {
  if (!elements.roadmapTasksContainer) return;
  if (elements.roadmapTasksContainer.querySelector(".roadmap-task-row-header")) return;
  const header = document.createElement("div");
  header.className = "roadmap-task-row-header";
  header.setAttribute("aria-hidden", "true");
  const colName = document.createElement("span");
  colName.textContent = "Task";
  const colStatus = document.createElement("span");
  colStatus.textContent = "Status";
  const colAction = document.createElement("span");
  header.appendChild(colName);
  header.appendChild(colStatus);
  header.appendChild(colAction);
  elements.roadmapTasksContainer.appendChild(header);
}

function renderRoadmapTasksControls(tasks, { readonly = false } = {}) {
  if (!elements.roadmapTasksContainer) return;
  elements.roadmapTasksContainer.innerHTML = "";
  const normalized = normalizeRoadmapTasks(tasks);
  if (readonly) {
    if (!normalized.length) {
      const hint = document.createElement("p");
      hint.className = "roadmap-field-empty-hint";
      hint.textContent = "No tasks added";
      elements.roadmapTasksContainer.appendChild(hint);
      return;
    }
    const wrap = document.createElement("div");
    wrap.className = "roadmap-tasks-readonly";
    wrap.setAttribute("role", "list");
    normalized.forEach((task) => {
      const row = document.createElement("article");
      row.className = "roadmap-task-card";
      row.setAttribute("role", "listitem");

      const main = document.createElement("div");
      main.className = "roadmap-task-card__main";

      const statusDot = document.createElement("span");
      statusDot.className = "roadmap-task-card__status-dot";
      statusDot.dataset.status = task.status;
      statusDot.setAttribute("aria-hidden", "true");

      const nameEl = document.createElement("span");
      nameEl.className = "roadmap-task-card__name";
      nameEl.textContent = task.name;

      const statusEl = document.createElement("span");
      statusEl.className = "roadmap-task-card__status";
      statusEl.dataset.status = task.status;
      statusEl.textContent = task.status;

      main.appendChild(statusDot);
      main.appendChild(nameEl);
      row.appendChild(main);
      row.appendChild(statusEl);
      wrap.appendChild(row);
    });
    elements.roadmapTasksContainer.appendChild(wrap);
    syncRoadmapTasksDisclosure();
    return;
  }
  ensureRoadmapTaskRowHeader();
  const list = normalized.length ? normalized : [{ name: "", status: "Not Started" }];
  list.forEach((task) => addRoadmapTaskRow(task));
  syncRoadmapTasksDisclosure();
}

function addRoadmapTaskRow(task) {
  if (!elements.roadmapTasksContainer) return;
  ensureRoadmapTaskRowHeader();
  const row = document.createElement("div");
  row.className = "roadmap-task-row";

  const fields = document.createElement("div");
  fields.className = "roadmap-task-row__fields";

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "roadmap-task-name-input";
  nameInput.placeholder = "e.g. Draft PRD, Build MVP";
  nameInput.setAttribute("aria-label", "Task name");
  nameInput.value = (task && task.name) || "";

  const statusSelect = buildRoadmapTaskStatusSelect(task && task.status);

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "roadmap-task-remove-btn";
  removeBtn.textContent = "×";
  removeBtn.setAttribute("aria-label", "Remove task");

  fields.appendChild(nameInput);
  fields.appendChild(statusSelect);
  row.appendChild(fields);
  row.appendChild(removeBtn);
  elements.roadmapTasksContainer.appendChild(row);
  scheduleRoadmapTasksDisclosureSync();
}

function getRoadmapTasksFromControls() {
  if (!elements.roadmapTasksContainer) return [];
  const rows = elements.roadmapTasksContainer.querySelectorAll(".roadmap-task-row");
  const tasks = [];
  rows.forEach((row) => {
    const name = (row.querySelector(".roadmap-task-name-input")?.value || "").trim();
    const statusRaw = row.querySelector(".roadmap-task-status-select")?.value || "";
    if (!name) return;
    tasks.push({
      name,
      status: normalizeRoadmapTaskStatus(statusRaw)
    });
  });
  return normalizeRoadmapTasks(tasks);
}

/** Preserves password hashes, drag order maps, and forward-compatible profile fields on load. */
function normalizeLoadedProfile(raw) {
  if (!raw || typeof raw !== "object") return null;
  const rawRoadmaps = Array.isArray(raw.roadmaps)
    ? raw.roadmaps
    : Array.isArray(raw.projects)
      ? raw.projects
      : [];
  const roadmaps = rawRoadmaps.map(normalizeLoadedRoadmap).filter(Boolean);
  const boardOrder = raw.boardOrder && typeof raw.boardOrder === "object" ? raw.boardOrder : {};
  const moscowOrder = raw.moscowOrder && typeof raw.moscowOrder === "object" ? raw.moscowOrder : {};
  const profile = Object.assign({}, raw, {
    id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : generateId("profile"),
    name: String(raw.name || "Unnamed profile"),
    team: String(raw.team || ""),
    createdAt: raw.createdAt || new Date().toISOString(),
    roadmaps,
    boardOrder,
    moscowOrder
  });
  delete profile.passwordSalt;
  delete profile.passwordHash;
  const salt = raw.passwordSalt != null ? String(raw.passwordSalt).trim() : "";
  const hash = raw.passwordHash != null ? String(raw.passwordHash).trim() : "";
  if (salt && hash) {
    profile.passwordSalt = salt;
    profile.passwordHash = hash;
  }
  return profile;
}

function serializeRoadmapForStorage(roadmap) {
  if (!roadmap || typeof roadmap !== "object") return roadmap;
  return Object.assign({}, roadmap, {
    labels: normalizeRoadmapLabels(roadmap.labels),
    links: normalizeRoadmapLinks(roadmap.links),
    tasks: normalizeRoadmapTasks(roadmap.tasks),
    raci: normalizeRoadmapRaci(roadmap.raci)
  });
}

function serializeProfileForStorage(profile) {
  if (!profile || typeof profile !== "object") return profile;
  const serialized = Object.assign({}, profile);
  serialized.roadmaps = Array.isArray(profile.roadmaps)
    ? profile.roadmaps.map(serializeRoadmapForStorage)
    : [];
  delete serialized.projects;
  return serialized;
}

/** Reads one workspace UI field for persistence (see WORKSPACE_PERSISTED_STATE_KEYS). */
function readPersistedWorkspaceField(key) {
  if (key === "scrumBoardVisibleStatuses") {
    return getScrumBoardVisibleStatuses();
  }
  if (key === "superAdminMode") {
    return !!state.superAdminMode;
  }
  if (Object.prototype.hasOwnProperty.call(state, key)) {
    return state[key];
  }
  return undefined;
}

function serializeStatePayload() {
  const payload = {
    profiles: state.profiles.map(serializeProfileForStorage)
  };
  const keys =
    typeof WORKSPACE_PERSISTED_STATE_KEYS !== "undefined" && Array.isArray(WORKSPACE_PERSISTED_STATE_KEYS)
      ? WORKSPACE_PERSISTED_STATE_KEYS
      : [];
  keys.forEach((key) => {
    const value = readPersistedWorkspaceField(key);
    if (value !== undefined) {
      payload[key] = value;
    }
  });
  return payload;
}

/** Restores workspace UI fields from localStorage or MongoDB payload. */
function applyPersistedWorkspaceUiState(parsed) {
  if (!parsed || Array.isArray(parsed)) return;

  if (typeof parsed.sortField === "string" && parsed.sortField.trim()) {
    state.sortField = parsed.sortField;
  }
  if (parsed.sortDirection === "asc" || parsed.sortDirection === "desc") {
    state.sortDirection = parsed.sortDirection;
  }
  const savedRoadmapsView = parsed.roadmapsView || parsed.projectsView;
  if (
    savedRoadmapsView === "table" ||
    savedRoadmapsView === "board" ||
    savedRoadmapsView === "moscow" ||
    savedRoadmapsView === "map" ||
    savedRoadmapsView === "raci" ||
    savedRoadmapsView === "kano"
  ) {
    state.roadmapsView = savedRoadmapsView;
  }
  if (RACI_DOMAIN_OPTIONS.includes(parsed.raciMatrixDomain)) {
    state.raciMatrixDomain = parsed.raciMatrixDomain;
  }
  if (parsed.kanoPortfolioPanel === "positioned" || parsed.kanoPortfolioPanel === "unpositioned") {
    state.kanoPortfolioPanel = parsed.kanoPortfolioPanel;
  }
  if (typeof parsed.tableSortByRice === "boolean") {
    state.tableSortByRice = parsed.tableSortByRice;
  }
  if (
    typeof TABLE_GROUP_BY_OPTIONS !== "undefined" &&
    TABLE_GROUP_BY_OPTIONS.some((opt) => opt.id === parsed.tableGroupBy)
  ) {
    state.tableGroupBy = parsed.tableGroupBy;
  }
  if (typeof parsed.scrumBoardSortByRice === "boolean") {
    state.scrumBoardSortByRice = parsed.scrumBoardSortByRice;
  }
  if (Array.isArray(parsed.scrumBoardVisibleStatuses)) {
    state.scrumBoardVisibleStatuses = normalizeScrumBoardVisibleStatuses(parsed.scrumBoardVisibleStatuses);
  }
  if (typeof parsed.moscowSortByRice === "boolean") {
    state.moscowSortByRice = parsed.moscowSortByRice;
  }
  if (MAP_METRIC_OPTIONS.some((opt) => opt.id === parsed.mapMetric)) {
    state.mapMetric = parsed.mapMetric;
  }
  if (parsed.exchangeRatesToEUR && typeof parsed.exchangeRatesToEUR === "object") {
    state.exchangeRatesToEUR = parsed.exchangeRatesToEUR;
  }
  if (parsed.exchangeRatesDate) {
    state.exchangeRatesDate = parsed.exchangeRatesDate;
  }
  if (parsed.exchangeRatesLastSource === "manual" || parsed.exchangeRatesLastSource === "auto") {
    state.exchangeRatesLastSource = parsed.exchangeRatesLastSource;
  }
  if (typeof parsed.superAdminMode === "boolean") {
    state.superAdminMode = parsed.superAdminMode;
  }
}

function findProfileIdByDisplayName(name) {
  const needle = String(name || "").trim().toLowerCase();
  if (!needle) return null;
  const profile = state.profiles.find(
    (p) => String(p.name || "").trim().toLowerCase() === needle
  );
  return profile ? profile.id : null;
}

function getDefaultActiveProfileName() {
  return typeof DEFAULT_ACTIVE_PROFILE_NAME !== "undefined" && DEFAULT_ACTIVE_PROFILE_NAME
    ? String(DEFAULT_ACTIVE_PROFILE_NAME).trim()
    : "Test";
}

function resolveFallbackActiveProfileId() {
  const preferredId = findProfileIdByDisplayName(getDefaultActiveProfileName());
  if (preferredId) return preferredId;
  return (state.profiles[0] && state.profiles[0].id) || null;
}

function applyDefaultActiveProfileSelection() {
  const preferredId = findProfileIdByDisplayName(getDefaultActiveProfileName());
  if (!preferredId || state.activeProfileId === preferredId) return;
  state.activeProfileId = preferredId;
  saveState();
}

function applyStatePayload(parsed) {
  if (!parsed) return;

  if (typeof stripLegacyWorkspaceFields === "function") {
    stripLegacyWorkspaceFields(parsed);
  }

  try {
    const rawProfiles = Array.isArray(parsed) ? parsed : parsed.profiles;
    if (!Array.isArray(rawProfiles)) return;

    state.profiles = rawProfiles.map(normalizeLoadedProfile).filter(Boolean);

    const storedActiveId = !Array.isArray(parsed) ? parsed.activeProfileId : null;
    const validActiveId = state.profiles.some((p) => p.id === (storedActiveId || ""))
      ? storedActiveId
      : resolveFallbackActiveProfileId();
    state.activeProfileId = validActiveId;

    if (!Array.isArray(parsed)) {
      applyPersistedWorkspaceUiState(parsed);
    } else {
      state.sortField = "createdAt";
      state.sortDirection = "desc";
    }
    const activeAfterLoad = state.profiles.find((p) => p.id === state.activeProfileId);
    if (!isSuperAdminProfile(activeAfterLoad)) {
      state.superAdminMode = false;
    }
  } catch (err) {
    console.error("Failed to apply stored state", err);
  }
}

function coalesceLegacyRoadmapStringField(roadmap, nextKey, legacyKey) {
  const nextVal = roadmap[nextKey] != null ? String(roadmap[nextKey]).trim() : "";
  if (nextVal) return nextVal;
  const legacyVal = roadmap[legacyKey] != null ? String(roadmap[legacyKey]).trim() : "";
  return legacyVal || null;
}

/** Ensures a roadmap loaded from localStorage has required fields so RICE and render don't break. */
function normalizeLoadedRoadmap(roadmap) {
  if (!roadmap || typeof roadmap !== "object") return null;
  const now = new Date().toISOString();
  const id = typeof roadmap.id === "string" && roadmap.id.trim() ? roadmap.id.trim() : generateId("roadmap");
  const createdAt = roadmap.createdAt || now;
  const modifiedAt = roadmap.modifiedAt || createdAt;
  const reachValue = toNumberOrNull(roadmap.reachValue);
  const impactValue = toNumberOrNull(roadmap.impactValue);
  const confidenceValue = toNumberOrNull(roadmap.confidenceValue);
  const effortValue = toNumberOrNull(roadmap.effortValue);
  const periodRaw = coalesceLegacyRoadmapStringField(roadmap, "roadmapPeriod", "projectPeriod") || "";
  const roadmapPeriod = periodRaw ? periodRaw.toUpperCase() : null;
  const financialImpactFramework = normalizeFinancialFramework(roadmap.financialImpactFramework);
  const financialImpactInputs = sanitizeFinancialImpactInputs(
    financialImpactFramework,
    roadmap.financialImpactInputs && typeof roadmap.financialImpactInputs === "object"
      ? roadmap.financialImpactInputs
      : {}
  );
  const normalizedFinancialValue = computeFrameworkFinancialImpact(
    financialImpactFramework,
    financialImpactInputs,
    Number.isFinite(toNumberOrNull(roadmap.financialImpactValue)) ? Number(roadmap.financialImpactValue) : null
  );
  const normalized = {
    id,
    createdAt,
    modifiedAt,
    title: String(roadmap.title || "Untitled roadmap"),
    description: String(roadmap.description || ""),
    reachDescription: String(roadmap.reachDescription || ""),
    reachValue: Number.isFinite(reachValue) ? reachValue : 0,
    impactDescription: String(roadmap.impactDescription || ""),
    impactValue: Number.isFinite(impactValue) ? impactValue : 1,
    confidenceDescription: String(roadmap.confidenceDescription || ""),
    confidenceValue: Number.isFinite(confidenceValue) ? confidenceValue : 50,
    effortDescription: String(roadmap.effortDescription || ""),
    effortValue: Number.isFinite(effortValue) && effortValue > 0 ? effortValue : 1,
    financialImpactValue: Number.isFinite(normalizedFinancialValue) ? normalizedFinancialValue : null,
    financialImpactCurrency: normalizeCurrency(roadmap.financialImpactCurrency),
    financialImpactFramework,
    financialImpactInputs,
    roadmapType: coalesceLegacyRoadmapStringField(roadmap, "roadmapType", "projectType"),
    roadmapStatus: coalesceLegacyRoadmapStringField(roadmap, "roadmapStatus", "projectStatus"),
    tshirtSize: (roadmap.tshirtSize != null && String(roadmap.tshirtSize).trim() !== "") ? String(roadmap.tshirtSize).trim() : null,
    roadmapPeriod,
    moscowCategory: (roadmap.moscowCategory != null && String(roadmap.moscowCategory).trim() !== "" && typeof moscowList !== "undefined" && moscowList.includes(roadmap.moscowCategory)) ? String(roadmap.moscowCategory).trim() : null,
    kanoFunctionality: normalizeKanoAxisLevel(roadmap.kanoFunctionality),
    kanoSatisfaction: normalizeKanoAxisLevel(roadmap.kanoSatisfaction),
    countries: normalizeCountryNames(Array.isArray(roadmap.countries) ? roadmap.countries : []),
    labels: normalizeRoadmapLabels(roadmap.labels),
    links: normalizeRoadmapLinks(roadmap.links),
    tasks: normalizeRoadmapTasks(roadmap.tasks),
    raci: normalizeRoadmapRaci(roadmap.raci)
  };
  return Object.assign({}, roadmap, normalized);
}

function saveState(options) {
  const payload = serializeStatePayload();
  const flush = options && options.flush === true;
  try {
    if (typeof AppStorage !== "undefined") {
      AppStorage.persistState(payload, { flush });
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }
  } catch (err) {
    console.error("Failed to persist state", err);
  }
}

function isLocalDevEnvironment() {
  if (typeof AppStorage !== "undefined" && typeof AppStorage.isOfflineDevOrigin === "function") {
    return AppStorage.isOfflineDevOrigin();
  }
  const host = (window.location.hostname || "").toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

function consumeDevSeedResetParam() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("resetDevSeed")) return false;
    params.delete("resetDevSeed");
    const qs = params.toString();
    const next = window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash;
    window.history.replaceState({}, "", next);
    return true;
  } catch {
    return false;
  }
}

function workspacePayloadHasRoadmaps(payload) {
  if (!payload || !Array.isArray(payload.profiles)) return false;
  return payload.profiles.some((profile) => Array.isArray(profile.roadmaps) && profile.roadmaps.length > 0);
}

function getInMemoryRoadmapCount() {
  return state.profiles.reduce(
    (total, profile) => total + (Array.isArray(profile.roadmaps) ? profile.roadmaps.length : 0),
    0
  );
}

/** Seeds sample portfolio data on localhost when the workspace cache is empty. */
function ensureDevWorkspaceSeed() {
  if (!isLocalDevEnvironment()) return false;
  if (typeof buildDevSeedWorkspacePayload !== "function") return false;
  if (typeof AppStorage !== "undefined" && AppStorage.isCloudActive && AppStorage.isCloudActive()) {
    return false;
  }

  const forceReset = consumeDevSeedResetParam();
  if (forceReset) {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.warn("Could not clear local workspace cache for dev seed reset", err);
    }
  }

  if (!forceReset) {
    if (getInMemoryRoadmapCount() > 0) return false;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (workspacePayloadHasRoadmaps(parsed)) return false;
      }
    } catch {
      /* fall through to seed */
    }
  }

  const seed = buildDevSeedWorkspacePayload();
  applyStatePayload(seed);
  saveState();
  console.info("Dev workspace seeded with sample roadmaps. Add ?resetDevSeed=1 to reload samples.");
  return true;
}

function ensureDefaultProfile() {
  if (state.profiles.length === 0) {
    if (
      typeof AppStorage !== "undefined" &&
      typeof AppStorage.shouldSeedDefaultProfile === "function" &&
      !AppStorage.shouldSeedDefaultProfile()
    ) {
      console.warn(
        "Skipping default profile: cloud workspace has data but profiles did not load. Use Cloud → Pull from cloud."
      );
      return;
    }
    const now = new Date().toISOString();
    const profile = {
      id: generateId("profile"),
      name: getDefaultActiveProfileName(),
      team: "",
      createdAt: now,
      roadmaps: []
    };
    state.profiles.push(profile);
    state.activeProfileId = profile.id;
    saveState();
  }
}

function isProfilePasswordProtected(profile) {
  if (!profile) return false;
  const salt = profile.passwordSalt != null ? String(profile.passwordSalt).trim() : "";
  const hash = profile.passwordHash != null ? String(profile.passwordHash).trim() : "";
  if (salt && hash) return true;
  if (typeof ProfileSecurity !== "undefined") {
    return ProfileSecurity.isProfilePasswordProtected(profile);
  }
  return false;
}

function isProfileUnlocked(profileId) {
  const profile = state.profiles.find((p) => p.id === profileId);
  if (!profile) return false;
  if (!isProfilePasswordProtected(profile)) return true;
  return unlockedProfileIds.has(profileId);
}

/** Active profile only when unlocked — use for any roadmap/portfolio data access. */
function getUnlockedActiveProfile() {
  const profile = getActiveProfile();
  if (!profile) return null;
  return isProfileUnlocked(profile.id) ? profile : null;
}

async function applyProfilePassword(profile, password) {
  if (typeof ProfileSecurity === "undefined") {
    throw new Error("ProfileSecurity module is not available.");
  }
  const salt = ProfileSecurity.generateSalt();
  const hash = await ProfileSecurity.hashProfilePassword(password, salt);
  profile.passwordSalt = salt;
  profile.passwordHash = hash;
}

function clearProfilePassword(profile) {
  delete profile.passwordSalt;
  delete profile.passwordHash;
}

function updateProfileLockedBanner() {
  if (!elements.profileLockedBanner) return;
  const activeProfile = getActiveProfile();
  const locked = !!(activeProfile && !isProfileUnlocked(activeProfile.id));

  if (elements.workspacePanel) {
    elements.workspacePanel.classList.toggle("workspace-panel--profile-locked", locked);
  }
  elements.profileLockedBanner.setAttribute("aria-hidden", locked ? "false" : "true");

  if (locked && elements.profileLockedBannerTitle && activeProfile) {
    elements.profileLockedBannerTitle.textContent = `${activeProfile.name} is locked`;
  }
  if (locked && elements.profileLockedBannerText) {
    elements.profileLockedBannerText.textContent =
      "Enter your password below to access roadmaps, filters, and all portfolio views.";
  }
  if (locked) {
    showProfileLockedInlineError("");
    if (elements.profileLockedInlinePassword) {
      elements.profileLockedInlinePassword.value = "";
      setTimeout(() => {
        if (document.activeElement !== elements.profileLockedInlinePassword) {
          elements.profileLockedInlinePassword.focus();
        }
      }, 80);
    }
  }
  if (elements.filtersShell) {
    elements.filtersShell.classList.toggle("filters-shell--locked", locked);
    elements.filtersShell.setAttribute("aria-disabled", locked ? "true" : "false");
  }
  syncPortfolioActionButtons();
}

function showProfileLockedInlineError(message) {
  if (!elements.profileLockedInlineError) return;
  elements.profileLockedInlineError.textContent = message;
  elements.profileLockedInlineError.style.display = message ? "block" : "none";
}

function focusLockedProfileUnlockIfNeeded() {
  const active = getActiveProfile();
  if (!active || isProfileUnlocked(active.id)) return;
  if (elements.profileLockedInlinePassword) {
    setTimeout(() => elements.profileLockedInlinePassword.focus(), 120);
  }
}

function requireProfileUnlocked(profileId, actionType) {
  if (isProfileUnlocked(profileId)) return true;
  pendingUnlockAction = { type: actionType, profileId };
  openProfileUnlockModal(profileId);
  return false;
}

async function addProfile(name, team, password) {
  const now = new Date().toISOString();
  const profile = {
    id: generateId("profile"),
    name,
    team: (team || "").trim(),
    createdAt: now,
    roadmaps: []
  };
  const pwd = (password || "").trim();
  if (pwd) {
    await applyProfilePassword(profile, pwd);
  }
  state.profiles.push(profile);
  state.activeProfileId = profile.id;
  saveState();
  renderProfiles();
  renderRoadmaps();
  if (pwd && !isProfileUnlocked(profile.id)) {
    pendingUnlockAction = { type: "activate", profileId: profile.id };
    openProfileUnlockModal(profile.id);
    showToast("Profile created. Enter the password to access roadmaps.");
  }
}

function setActiveProfile(profileId) {
  const profile = state.profiles.find((p) => p.id === profileId);
  if (!profile) return;
  state.activeProfileId = profileId;
  if (!isSuperAdminProfile(profile)) {
    state.superAdminMode = false;
  }
  saveState();
  renderProfiles();
  clearFilters();
  syncSuperAdminChrome();
  renderRoadmaps();
  if (!isProfileUnlocked(profileId)) {
    pendingUnlockAction = { type: "activate", profileId };
    if (isCompactProfilesLayout()) {
      updateProfileLockedBanner();
      focusLockedProfileUnlockIfNeeded();
    } else {
      openProfileUnlockModal(profileId);
    }
  }
}

function getActiveProfile() {
  if (!state.activeProfileId) return null;
  return state.profiles.find((p) => p.id === state.activeProfileId) || null;
}

// --- Render (profiles list, roadmaps table) ---
function getProfileIconSvg(iconName) {
  const icons = {
    view: "<svg xmlns='http://www.w3.org/2000/svg' width='22' height='22' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M15 12a3 3 0 11-6 0 3 3 0 016 0z'/><path d='M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'/></svg>",
    edit: "<svg xmlns='http://www.w3.org/2000/svg' width='22' height='22' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z'/></svg>",
    trash: "<svg xmlns='http://www.w3.org/2000/svg' width='22' height='22' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><polyline points='3 6 5 6 21 6'/><path d='M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2'/><line x1='10' y1='11' x2='10' y2='17'/><line x1='14' y1='11' x2='14' y2='17'/></svg>",
    add: "<svg xmlns='http://www.w3.org/2000/svg' width='22' height='22' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><circle cx='12' cy='12' r='10'/><line x1='12' y1='8' x2='12' y2='16'/><line x1='8' y1='12' x2='16' y2='12'/></svg>"
  };
  return icons[iconName] || "";
}

function createProfileButtonTooltip(titleText, bodyText) {
  const tooltip = document.createElement("div");
  tooltip.className = "cell-type-tooltip";
  const titleEl = document.createElement("div");
  titleEl.className = "cell-type-tooltip-title";
  titleEl.textContent = titleText;
  tooltip.appendChild(titleEl);
  if (bodyText) {
    const bodyEl = document.createElement("div");
    bodyEl.className = "cell-type-tooltip-body";
    bodyEl.textContent = bodyText;
    tooltip.appendChild(bodyEl);
  }
  return tooltip;
}

/** Return the root element where tooltips should be appended (fullscreen element when in fullscreen, else body) so they remain visible. */
function getTooltipRoot() {
  const host = document.getElementById("viewFullscreenHost");
  if (host && !host.hidden) return host;
  const pseudo = typeof Fullscreen !== "undefined" && Fullscreen.getPseudoFullscreenElement
    ? Fullscreen.getPseudoFullscreenElement()
    : document.querySelector(".roadmaps-view.view-pseudo-fullscreen");
  return document.fullscreenElement || document.webkitFullscreenElement || pseudo || document.body;
}

function invalidateMapSizeAfterFullscreenExit() {
  const map = elements.roadmapsMapContainer && elements.roadmapsMapContainer._leafletMap;
  if (!map) return;
  map.invalidateSize();
  requestAnimationFrame(() => map.invalidateSize());
  setTimeout(() => map.invalidateSize(), 120);
  setTimeout(() => map.invalidateSize(), 320);
}

function syncRoadmapsViewVisibility() {
  if (!elements.roadmapsTableView || !elements.roadmapsBoardView) return;
  const view = state.roadmapsView;
  const showTable = view === "table";
  const showBoard = view === "board";
  const showMoscow = view === "moscow";
  const showMap = view === "map";
  const showRaci = view === "raci";
  const showKano = view === "kano";

  elements.roadmapsTableView.style.display = showTable ? "flex" : "none";
  elements.roadmapsBoardView.style.display = showBoard ? "flex" : "none";
  elements.roadmapsBoardView.setAttribute("aria-hidden", String(!showBoard));
  if (elements.roadmapsMoscowView) {
    elements.roadmapsMoscowView.style.display = showMoscow ? "flex" : "none";
    elements.roadmapsMoscowView.setAttribute("aria-hidden", String(!showMoscow));
  }
  if (elements.roadmapsMapView) {
    elements.roadmapsMapView.style.display = showMap ? "flex" : "none";
    elements.roadmapsMapView.setAttribute("aria-hidden", String(!showMap));
  }
  if (elements.roadmapsRaciView) {
    elements.roadmapsRaciView.style.display = showRaci ? "flex" : "none";
    elements.roadmapsRaciView.setAttribute("aria-hidden", String(!showRaci));
  }
  if (elements.roadmapsKanoView) {
    elements.roadmapsKanoView.style.display = showKano ? "flex" : "none";
    elements.roadmapsKanoView.setAttribute("aria-hidden", String(!showKano));
  }
}

function getActiveRoadmapsViewRoot() {
  if (state.roadmapsView === "table") return elements.roadmapsTableView;
  if (state.roadmapsView === "board") return elements.roadmapsBoardView;
  if (state.roadmapsView === "moscow") return elements.roadmapsMoscowView;
  if (state.roadmapsView === "map") return elements.roadmapsMapView;
  if (state.roadmapsView === "raci") return elements.roadmapsRaciView;
  if (state.roadmapsView === "kano") return elements.roadmapsKanoView;
  return null;
}

function resetActiveViewShellLayout() {
  const viewRoot = getActiveRoadmapsViewRoot();
  if (!viewRoot) return;

  const presentationProps = [
    "position", "top", "left", "right", "bottom", "inset", "z-index",
    "height", "min-height", "max-height", "width", "transform", "visibility", "opacity",
    "flex", "flex-basis", "flex-grow", "flex-shrink", "overflow", "margin", "padding"
  ];

  const resetNode = (node) => {
    if (!node || !node.style) return;
    presentationProps.forEach((prop) => node.style.removeProperty(prop));
  };

  resetNode(viewRoot);
  viewRoot.querySelectorAll(
    ".view-toolbar, .view-toolbar__row, .roadmaps-map-container, .roadmaps-map-legend, .scrum-board, .moscow-grid, .table-wrapper"
  ).forEach(resetNode);

  const toolbar = viewRoot.querySelector(".view-toolbar");
  if (toolbar) {
    toolbar.removeAttribute("hidden");
    toolbar.setAttribute("aria-hidden", "false");
  }
}

function resetPortfolioScrollAfterFullscreen() {
  if (typeof Fullscreen !== "undefined" && typeof Fullscreen.resetPortfolioStageScroll === "function") {
    Fullscreen.resetPortfolioStageScroll();
    return;
  }
  const stage = document.querySelector(".portfolio-stage");
  if (stage) {
    stage.scrollTop = 0;
    stage.scrollLeft = 0;
  }
}

function getActiveViewToolbar() {
  const root = getActiveRoadmapsViewRoot();
  return root ? root.querySelector(".view-toolbar") : null;
}

function scrollActiveViewToolbarIntoView() {
  resetPortfolioScrollAfterFullscreen();
  const stage = document.querySelector(".portfolio-stage");
  const toolbar = getActiveViewToolbar();
  if (stage && toolbar) {
    const stageTop = stage.getBoundingClientRect().top;
    const toolbarTop = toolbar.getBoundingClientRect().top;
    if (toolbarTop < stageTop + 2) {
      stage.scrollTop = 0;
    }
  }
}

function refreshCompactFullscreenEnter() {
  if (!document.documentElement.classList.contains("pseudo-view-fullscreen")) return;

  if (state.roadmapsView === "moscow") {
    syncMoscowCompactNav();
  }

  if (state.roadmapsView === "map") {
    invalidateMapSizeAfterFullscreenExit();
  }

  const stage = document.querySelector(".view-fullscreen-stage");
  if (stage) {
    stage.scrollTop = 0;
    stage.scrollLeft = 0;
  }
}

function refreshWorkspaceAfterFullscreenExit() {
  if (typeof Fullscreen.restoreWorkspaceChrome === "function") {
    Fullscreen.restoreWorkspaceChrome();
  }
  if (typeof Fullscreen.restoreViewShell === "function") {
    Fullscreen.restoreViewShell();
  }

  closeMapMetricPickerDropdown();
  returnTooltipsToOwner();
  hideCellTypeTooltips();
  resetActiveViewShellLayout();
  syncRoadmapsViewVisibility();
  syncPortfolioViewTabState();
  updateBulkSelectionActions();

  const view = state.roadmapsView;
  if (view === "moscow") {
    syncMoscowCompactNav();
  }

  resetPortfolioScrollAfterFullscreen();
  scrollActiveViewToolbarIntoView();
  scrollActivePortfolioViewTabIntoView();
  invalidateMapSizeAfterFullscreenExit();
}

/** Return any tooltip that was moved to body/fullscreen back to its owner wrap (so positioning works in all contexts, including fullscreen). */
function returnTooltipsToOwner() {
  document.querySelectorAll(".cell-type-tooltip").forEach((el) => {
    if (!el._ownerWrap) return;
    if (el.parentNode === el._ownerWrap) return;
    el.classList.remove("cell-type-tooltip-visible", "cell-type-tooltip--floating");
    el._ownerWrap.appendChild(el);
    el._ownerWrap = null;
  });
}

/** Enforce single-tooltip visibility across the app. */
function hideAllTooltipsExcept(keepTooltip) {
  document.querySelectorAll(".cell-type-tooltip").forEach((el) => {
    if (keepTooltip && el === keepTooltip) return;
    el.classList.remove("cell-type-tooltip-visible", "cell-type-tooltip--floating");
    if (el._ownerWrap && el.parentNode !== el._ownerWrap) {
      el._ownerWrap.appendChild(el);
      el._ownerWrap = null;
    }
  });
  refreshCompactTooltipBackdrop();
}

/** Hide all cell-type tooltips and return any that were moved to body back to their owner. */
function hideCellTypeTooltips() {
  cancelTooltipHoverHide();
  activeTooltipWrap = null;
  hideAllTooltipsExcept(null);
  returnTooltipsToOwner();
  document.body.classList.add("cell-type-tooltip-hidden");
  syncCompactTooltipBackdrop(null);
}

let activeTooltipWrap = null;
let tooltipHoverHideTimer = null;

function cancelTooltipHoverHide() {
  if (tooltipHoverHideTimer != null) {
    clearTimeout(tooltipHoverHideTimer);
    tooltipHoverHideTimer = null;
  }
}

function getFloatingTooltipForWrap(wrap) {
  if (!wrap) return null;
  const inWrap = wrap.querySelector(".cell-type-tooltip");
  if (inWrap && inWrap.classList.contains("cell-type-tooltip-visible")) return inWrap;
  const floating = document.querySelectorAll(".cell-type-tooltip.cell-type-tooltip-visible");
  for (let i = 0; i < floating.length; i++) {
    if (floating[i]._ownerWrap === wrap) return floating[i];
  }
  return null;
}

function isWithinTooltipHoverZone(node, wrap) {
  if (!node || !wrap || !(node instanceof Node)) return false;
  if (wrap.contains(node)) return true;
  const tooltip = getFloatingTooltipForWrap(wrap);
  return !!(tooltip && tooltip.contains(node));
}

function hideTooltipForWrap(wrap) {
  if (!wrap) return;
  const tooltip = getFloatingTooltipForWrap(wrap);
  if (tooltip) {
    tooltip.classList.remove("cell-type-tooltip-visible", "cell-type-tooltip--floating");
    if (tooltip.parentNode !== wrap) wrap.appendChild(tooltip);
    tooltip._ownerWrap = null;
  }
  if (activeTooltipWrap === wrap) activeTooltipWrap = null;
  refreshCompactTooltipBackdrop();
}

function scheduleTooltipHoverHide(wrap, delayMs) {
  cancelTooltipHoverHide();
  if (!wrap) return;
  const delay = typeof delayMs === "number" ? delayMs : 140;
  tooltipHoverHideTimer = setTimeout(() => {
    tooltipHoverHideTimer = null;
    hideTooltipForWrap(wrap);
  }, delay);
}
let compactTooltipBackdropEl = null;

function getCompactTooltipBackdrop() {
  if (compactTooltipBackdropEl) return compactTooltipBackdropEl;
  compactTooltipBackdropEl = document.createElement("div");
  compactTooltipBackdropEl.className = "compact-tooltip-backdrop";
  compactTooltipBackdropEl.setAttribute("aria-hidden", "true");
  compactTooltipBackdropEl.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    hideCellTypeTooltips();
  });
  return compactTooltipBackdropEl;
}

function refreshCompactTooltipBackdrop() {
  const activeScrollTooltip = document.querySelector(
    ".cell-type-tooltip.cell-type-tooltip-visible.cell-type-tooltip--scroll"
  );
  syncCompactTooltipBackdrop(activeScrollTooltip);
}

function syncCompactTooltipBackdrop(tooltip) {
  const useBackdrop =
    typeof isCompactLayoutViewport === "function" &&
    isCompactLayoutViewport() &&
    tooltip &&
    tooltip.classList.contains("cell-type-tooltip--scroll");
  const backdrop = getCompactTooltipBackdrop();
  if (!useBackdrop) {
    backdrop.classList.remove("compact-tooltip-backdrop--visible");
    if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    return;
  }
  if (backdrop.parentNode !== document.body) document.body.appendChild(backdrop);
  backdrop.classList.add("compact-tooltip-backdrop--visible");
}

const TABLE_VIEW_TOOLTIP_TRIGGER_SELECTOR =
  ".cell-type-icon-wrap, .cell-date-with-tooltip, .cell-countries-with-tooltip, .cell-tshirt-with-tooltip, .cell-financial-with-tooltip, .cell-desc-with-tooltip, .cell-moscow-with-tooltip, .cell-period-with-tooltip, .cell-rice-with-tooltip, .card-meta-with-tooltip, .card-title-with-tooltip, .roadmaps-table-card__status-pill, .roadmaps-table-card__chip--more, .raci-matrix-with-tooltip";

function findTableViewTooltipTrigger(target) {
  if (!target || !(target instanceof Element)) return null;
  return target.closest(TABLE_VIEW_TOOLTIP_TRIGGER_SELECTOR);
}

function isTableCardActionControl(target) {
  return !!(
    target &&
    target.closest(
      ".roadmap-action-btn, .roadmap-select-checkbox, .country-remove-btn, .country-row select, .country-row button"
    )
  );
}

function clampTooltipHorizontal(tooltip, centerX) {
  const viewportWidth = window.innerWidth;
  const minMargin = 12;
  let left = centerX;
  const tooltipRect = tooltip.getBoundingClientRect();
  if (centerX - tooltipRect.width / 2 < minMargin) {
    left = minMargin + tooltipRect.width / 2;
  } else if (centerX + tooltipRect.width / 2 > viewportWidth - minMargin) {
    left = viewportWidth - minMargin - tooltipRect.width / 2;
  }
  tooltip.style.left = left + "px";
}

/** Keeps fixed tooltips inside the viewport; scrollable variant for long country lists (desktop + compact). */
function finalizeTooltipViewportPosition(tooltip, anchorRect) {
  if (!tooltip || !anchorRect) return;
  const margin = 12;
  const vh = window.innerHeight;
  const isScroll = tooltip.classList.contains("cell-type-tooltip--scroll");

  if (isScroll) {
    tooltip.classList.add("cell-type-tooltip--below");
    const gap = 2;
    let top = anchorRect.bottom + gap;
    const maxHeightCap = tooltip.classList.contains("cell-type-tooltip--roadmap-details")
      ? Math.min(Math.floor(vh * 0.62), 420)
      : Math.min(Math.floor(vh * 0.55), 320);
    let maxHeight = Math.max(120, Math.min(maxHeightCap, vh - margin - top));
    if (maxHeight < 120) {
      top = margin;
      maxHeight = Math.max(120, vh - margin * 2);
    }
    tooltip.style.top = top + "px";
    tooltip.style.maxHeight = maxHeight + "px";
  }

  let rect = tooltip.getBoundingClientRect();

  if (rect.bottom > vh - margin) {
    const top = Math.max(margin, vh - margin - rect.height);
    tooltip.style.top = top + "px";
    if (isScroll) {
      const available = vh - margin - top;
      tooltip.style.maxHeight = Math.max(120, available) + "px";
    }
    rect = tooltip.getBoundingClientRect();
  }

  if (rect.top < margin) {
    tooltip.style.top = margin + "px";
    tooltip.classList.add("cell-type-tooltip--below");
    if (isScroll) {
      tooltip.style.maxHeight = Math.max(120, vh - margin * 2) + "px";
    }
    rect = tooltip.getBoundingClientRect();
  }

  const centerX = parseFloat(tooltip.style.left);
  if (Number.isFinite(centerX)) {
    clampTooltipHorizontal(tooltip, centerX);
  }
}

function positionProfileTooltip(wrap, anchorPoint) {
  const tooltip = wrap.querySelector(".cell-type-tooltip");
  if (!tooltip) return;
  cancelTooltipHoverHide();
  document.body.classList.remove("cell-type-tooltip-hidden");

  let rect;
  if (wrap.classList.contains("roadmap-field-tooltip-wrap")) {
    const control = wrap.querySelector("input, select, textarea");
    rect = control ? control.getBoundingClientRect() : wrap.getBoundingClientRect();
  } else {
    rect = wrap.getBoundingClientRect();
  }

  hideAllTooltipsExcept(tooltip);
  returnTooltipsToOwner();
  getTooltipRoot().appendChild(tooltip);
  tooltip._ownerWrap = wrap;
  tooltip.classList.add("cell-type-tooltip-visible", "cell-type-tooltip--floating");
  activeTooltipWrap = wrap;
  syncCompactTooltipBackdrop(tooltip);

  const viewportHeight = window.innerHeight;
  const spaceAbove = rect.top;
  const spaceBelow = viewportHeight - rect.bottom;
  const minSpace = 200;
  let showBelow;
  if (spaceBelow < minSpace && spaceAbove > spaceBelow) {
    showBelow = false;
  } else if (spaceAbove < minSpace && spaceBelow > spaceAbove) {
    showBelow = true;
  } else {
    showBelow = spaceBelow >= spaceAbove;
  }

  const centerX = anchorPoint && Number.isFinite(anchorPoint.x)
    ? anchorPoint.x
    : (rect.left + rect.width / 2);
  tooltip.style.left = centerX + "px";

  if (showBelow) {
    tooltip.classList.add("cell-type-tooltip--below");
    tooltip.style.top = (rect.bottom + 8) + "px";
  } else {
    tooltip.classList.remove("cell-type-tooltip--below");
    tooltip.style.top = (rect.top - 8) + "px";
  }

  if (wrap.classList.contains("roadmap-field-tooltip-wrap")) {
    tooltip.classList.add("cell-type-tooltip--field");
  } else {
    tooltip.classList.remove("cell-type-tooltip--field");
  }

  const useWideTooltip =
    wrap.classList.contains("card-title-with-tooltip") ||
    wrap.classList.contains("cell-desc-with-tooltip") ||
    wrap.classList.contains("cell-countries-with-tooltip") ||
    wrap.classList.contains("cell-rice-with-tooltip") ||
    wrap.classList.contains("raci-matrix-with-tooltip");
  tooltip.classList.toggle("cell-type-tooltip--wide", useWideTooltip);

  clampTooltipHorizontal(tooltip, centerX);
  finalizeTooltipViewportPosition(tooltip, rect);
}

function toggleCompactTableTooltip(wrap, anchorPoint) {
  if (!wrap || !wrap.querySelector(".cell-type-tooltip")) return;
  if (activeTooltipWrap === wrap) {
    hideCellTypeTooltips();
    return;
  }
  positionProfileTooltip(wrap, anchorPoint);
}

function handleCompactTableTooltipClick(e) {
  if (!isCompactLayoutViewport() || !isTableCompactLayout()) return;

  if (e.target.closest(".cell-type-tooltip.cell-type-tooltip-visible")) {
    return;
  }

  if (isTableCardActionControl(e.target)) return;

  const wrap = findTableViewTooltipTrigger(e.target);
  if (!wrap || !wrap.closest(".roadmaps-table-card")) {
    if (activeTooltipWrap) hideCellTypeTooltips();
    return;
  }

  const tooltip = wrap.querySelector(".cell-type-tooltip");
  if (!tooltip) return;

  e.stopPropagation();

  const anchorPoint = wrap.classList.contains("card-title-with-tooltip")
    ? { x: e.clientX, y: e.clientY }
    : null;
  toggleCompactTableTooltip(wrap, anchorPoint);
}

function handleCompactTooltipDismissPointerDown(e) {
  if (!isCompactLayoutViewport() || !activeTooltipWrap) return;
  if (e.target.closest(".cell-type-tooltip.cell-type-tooltip-visible")) return;
  if (e.target.closest(".compact-tooltip-backdrop")) return;
  const trigger = findTableViewTooltipTrigger(e.target);
  if (trigger && trigger === activeTooltipWrap) return;
  hideCellTypeTooltips();
}

/** Sync primary roadmap actions (toolbar + mobile FAB). */
function syncPortfolioActionButtons() {
  const profile = getActiveProfile();
  const locked = profile ? !isProfileUnlocked(profile.id) : true;
  const demoReadOnly = isActiveDemoProfile();
  const disabled = !profile || locked || demoReadOnly;
  if (elements.addRoadmapBtn) {
    elements.addRoadmapBtn.disabled = disabled;
    elements.addRoadmapBtn.title = demoReadOnly ? DEMO_READ_ONLY_ACTION_TITLE : "";
  }
  if (elements.portfolioFabAddRoadmap) {
    elements.portfolioFabAddRoadmap.disabled = disabled;
    elements.portfolioFabAddRoadmap.title = demoReadOnly ? DEMO_READ_ONLY_ACTION_TITLE : "";
  }
}

/** Portfolio workspace: filters drawer (collapsed by default). */
function initPortfolioFiltersDrawer() {
  const drawer = elements.portfolioFiltersDrawer || $("portfolioFiltersDrawer");
  if (!drawer) return;

  drawer.open = false;

  drawer.addEventListener("toggle", () => {
    if (!drawer.open) {
      closeFilterCountriesPopup();
      closeFilterRoadmapPeriodPopup();
      if (elements.filtersAdvanced) {
        elements.filtersAdvanced.classList.remove("visible");
        syncCompactFilterButtonLabels();
      }
    }
    syncPortfolioFiltersDrawerState();
    syncCompactFiltersChrome();
  });

  syncPortfolioFiltersDrawerState();
  syncCompactFiltersChrome();
}

function syncPortfolioFiltersDrawerState() {
  const drawer = elements.portfolioFiltersDrawer || $("portfolioFiltersDrawer");
  if (!drawer) return;
  const summary = drawer.querySelector(".portfolio-filters-summary");
  if (summary) summary.setAttribute("aria-expanded", drawer.open ? "true" : "false");
  document.documentElement.classList.toggle("filters-drawer-open", drawer.open);
  document.documentElement.classList.toggle("filters-drawer-collapsed", !drawer.open);
}

/** Portfolio workspace: filters drawer defaults, mobile FAB. */
function initPortfolioWorkspace() {
  initPortfolioFiltersDrawer();

  if (elements.portfolioFabAddRoadmap && elements.addRoadmapBtn) {
    elements.portfolioFabAddRoadmap.addEventListener("click", () => {
      if (!elements.addRoadmapBtn.disabled) elements.addRoadmapBtn.click();
    });
  }

  window.addEventListener("resize", () => updateBulkSelectionActions());
}

/** Profile modals: password visibility toggles, close control. */
function initProfileModals() {
  bindProfilePasswordToggles(document);

  if (elements.profileEditCloseBtn) {
    elements.profileEditCloseBtn.addEventListener("click", () => closeProfileEditModal());
  }
}

function resetProfileEditPasswordFieldTypes() {
  ["profileEditCurrentPassword", "profileEditNewPassword", "profileEditConfirmPassword"].forEach((id) => {
    const input = $(id);
    if (input) input.type = "password";
  });
  elements.profileEditModal?.querySelectorAll(".profile-password-toggle").forEach((btn) => {
    btn.classList.remove("is-visible");
    btn.setAttribute("aria-label", "Show password");
  });
}

/** Close other popups before opening one; also dismiss floating tooltips. */
function markOverlayCloseImmediate(el) {
  if (!el) return;
  el.classList.add("overlay-close-immediate");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => el.classList.remove("overlay-close-immediate"));
  });
}

const BLOCKING_MODAL_OVERLAY_IDS = new Set([
  "roadmapModal",
  "profileViewModal",
  "profileEditModal",
  "profileDeleteModal",
  "profileUnlockModal",
  "roadmapDeleteModal",
  "roadmapBulkTransferModal",
  "exportFormatModal",
  "importFormatModal",
  "exportUnlockModal",
  "cloudStorage"
]);

function getBlockingModalCandidates() {
  return [
    ["roadmapModal", elements.roadmapModal],
    ["profileViewModal", elements.profileViewModal],
    ["profileEditModal", elements.profileEditModal],
    ["profileDeleteModal", elements.profileDeleteModal],
    ["profileUnlockModal", elements.profileUnlockModal],
    ["roadmapDeleteModal", elements.roadmapDeleteModal],
    ["roadmapBulkTransferModal", elements.roadmapBulkTransferModal],
    ["exportFormatModal", elements.exportFormatModal],
    ["importFormatModal", elements.importFormatModal],
    ["exportUnlockModal", elements.exportUnlockModal],
    ["cloudStorage", elements.cloudStorageModal]
  ];
}

let appScrollLockDepth = 0;
let appScrollLockY = 0;

function lockAppScroll() {
  appScrollLockDepth += 1;
  if (appScrollLockDepth !== 1) return;
  appScrollLockY = window.scrollY || document.documentElement.scrollTop || 0;
  document.documentElement.classList.add("app-scroll-lock");
  document.body.classList.add("app-scroll-lock");
  document.body.style.position = "fixed";
  document.body.style.top = `-${appScrollLockY}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";
}

function unlockAppScroll() {
  if (appScrollLockDepth <= 0) return;
  appScrollLockDepth -= 1;
  if (appScrollLockDepth !== 0) return;
  document.documentElement.classList.remove("app-scroll-lock");
  document.body.classList.remove("app-scroll-lock");
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";
  window.scrollTo(0, appScrollLockY);
}

function getActiveBlockingModalOverlayId() {
  let activeId = null;
  for (const [id, el] of getBlockingModalCandidates()) {
    if (el && el.classList.contains("active")) activeId = id;
  }
  return activeId;
}

function isBlockingModalOpen(el) {
  return !!(el && el.classList.contains("active"));
}

function isRoadmapModalOpen() {
  return isBlockingModalOpen(elements.roadmapModal);
}

function syncBlockingModalOpenClass() {
  const hasOpen = getBlockingModalCandidates().some(([, el]) => isBlockingModalOpen(el));
  document.documentElement.classList.toggle("blocking-modal-open", hasOpen);
}

function activateBlockingModal(el, overlayId) {
  if (!el || !overlayId) return;
  prepareAppOverlay(overlayId);
  lockAppScroll();
  syncBlockingModalOpenClass();
  el.setAttribute("aria-hidden", "false");
  el.classList.add("active");
}

function deactivateBlockingModal(el, { immediate = false } = {}) {
  if (!el) return;
  closeModalBackdrop(el, { immediate });
  unlockAppScroll();
  syncBlockingModalOpenClass();
}

function closeTopBlockingModal() {
  const id = getActiveBlockingModalOverlayId();
  if (!id) return false;
  switch (id) {
    case "roadmapModal":
      closeRoadmapModal();
      break;
    case "profileViewModal":
      closeProfileViewModal();
      break;
    case "profileEditModal":
      closeProfileEditModal();
      break;
    case "profileDeleteModal":
      closeProfileDeleteModal();
      break;
    case "profileUnlockModal":
      closeProfileUnlockModal();
      break;
    case "roadmapDeleteModal":
      closeRoadmapDeleteModal();
      break;
    case "roadmapBulkTransferModal":
      closeRoadmapBulkTransferModal();
      break;
    case "exportFormatModal":
      closeExportFormatModal();
      break;
    case "importFormatModal":
      closeImportFormatModal();
      break;
    case "exportUnlockModal":
      closeExportUnlockModal();
      break;
    case "cloudStorage":
      closeCloudStorageModal();
      break;
    default:
      return false;
  }
  return true;
}

function initBlockingModalGuards() {
  document.querySelectorAll(".modal-backdrop").forEach((modal) => {
    if (modal.dataset.interactionGuardsReady === "1") return;
    modal.dataset.interactionGuardsReady = "1";

    modal.addEventListener(
      "wheel",
      (event) => {
        if (!isBlockingModalOpen(modal)) return;
        const panel = modal.querySelector(".modal-panel");
        if (panel && panel.contains(event.target)) return;
        event.preventDefault();
      },
      { passive: false }
    );

    modal.addEventListener(
      "touchmove",
      (event) => {
        if (!isBlockingModalOpen(modal)) return;
        const panel = modal.querySelector(".modal-panel");
        if (panel && panel.contains(event.target)) return;
        event.preventDefault();
      },
      { passive: false }
    );
  });
}

function closeModalBackdrop(el, { immediate = false } = {}) {
  if (!el) return;
  if (immediate) markOverlayCloseImmediate(el);
  el.classList.remove("active");
  el.setAttribute("aria-hidden", "true");
}

function prepareAppOverlay(id) {
  hideCellTypeTooltips();
  if (typeof OverlayManager === "undefined") return;

  const activeModalId = getActiveBlockingModalOverlayId();
  if (activeModalId && id !== activeModalId && !BLOCKING_MODAL_OVERLAY_IDS.has(id)) {
    OverlayManager.closeAllExcept(activeModalId);
    return;
  }

  OverlayManager.prepareOpen(id);
}

function closeAppHeaderMenu() {
  const header = document.querySelector(".app-header--modern");
  const toggleBtn = $("appHeaderMenuBtn");
  if (!header) return;
  header.classList.remove("app-header--menu-open");
  if (toggleBtn) toggleBtn.setAttribute("aria-expanded", "false");
}

function closeFilterCountriesPopup() {
  const container = elements.filterCountriesToggle?.closest(".filter-countries");
  if (container) container.classList.remove("open");
}

function closeFilterRoadmapPeriodPopup() {
  const container = elements.filterRoadmapPeriodToggle?.closest(".filter-countries");
  if (container) container.classList.remove("open");
}

function registerAppOverlays() {
  if (typeof OverlayManager === "undefined") return;

  const closeNow = (fn) => () => fn({ immediate: true });

  OverlayManager.register("profilesSheet", closeNow(closeProfilesSheet));
  OverlayManager.register("profilePicker", closeProfilePickerDropdown);
  OverlayManager.register("mapMetricPicker", closeMapMetricPickerDropdown);
  OverlayManager.register("appHeaderMenu", closeAppHeaderMenu);
  OverlayManager.register("filterCountries", closeFilterCountriesPopup);
  OverlayManager.register("filterRoadmapPeriod", closeFilterRoadmapPeriodPopup);
  OverlayManager.register("boardStatusColumns", closeScrumBoardStatusColumnsPopup);
  OverlayManager.register("roadmapModal", closeNow(closeRoadmapModal));
  OverlayManager.register("profileViewModal", closeNow(closeProfileViewModal));
  OverlayManager.register("profileEditModal", closeNow(closeProfileEditModal));
  OverlayManager.register("profileDeleteModal", closeNow(closeProfileDeleteModal));
  OverlayManager.register("profileUnlockModal", closeNow(closeProfileUnlockModal));
  OverlayManager.register("roadmapDeleteModal", closeNow(closeRoadmapDeleteModal));
  OverlayManager.register("roadmapBulkTransferModal", closeNow(closeRoadmapBulkTransferModal));
  OverlayManager.register("exportFormatModal", closeNow(closeExportFormatModal));
  OverlayManager.register("importFormatModal", closeNow(closeImportFormatModal));
  OverlayManager.register("exportUnlockModal", closeNow(closeExportUnlockModal));
  OverlayManager.register("cloudStorage", closeNow(closeCloudStorageModal));
  OverlayManager.register("filterAutocomplete", () => {});
}

/** Expand “New profile” on wide layouts; keep collapsed on phones by default. */
function isCompactProfilesLayout() {
  return isCompactLayoutViewport();
}

function updateProfilesShellSummary(activeProfile, profileCount) {
  const badge = elements.profilesSheetCountBadge || $("profilesSheetCountBadge");
  if (badge) {
    badge.textContent = String(profileCount);
    badge.hidden = profileCount === 0;
  }
}

function buildPortfolioHeaderSubtitle(activeProfile) {
  if (!activeProfile) return "";
  const locked = !isProfileUnlocked(activeProfile.id);
  if (locked) return "Enter the profile password to view and manage roadmaps.";

  const team = (activeProfile.team || "").trim();
  const roadmapCount = Array.isArray(activeProfile.roadmaps) ? activeProfile.roadmaps.length : 0;
  const roadmapLabel = roadmapCount === 1 ? "1 roadmap" : `${roadmapCount} roadmaps`;

  if (team && roadmapCount > 0) return `${team} · ${roadmapLabel}`;
  if (team) return team;
  if (roadmapCount > 0) return roadmapLabel;
  return "Ready to prioritize roadmaps";
}

function syncPortfolioCommandIdentity(activeProfile) {
  const avatar = elements.portfolioCommandAvatar || $("portfolioCommandAvatar");
  const identity = elements.portfolioIdentity || $("portfolioIdentity");
  if (!avatar) return;

  if (!activeProfile) {
    avatar.textContent = "?";
    avatar.classList.add("portfolio-identity__avatar--empty");
    if (identity) identity.classList.remove("portfolio-identity--locked");
    return;
  }

  avatar.textContent = getProfileInitials(activeProfile.name);
  avatar.classList.remove("portfolio-identity__avatar--empty");
  const locked = !isProfileUnlocked(activeProfile.id);
  if (identity) identity.classList.toggle("portfolio-identity--locked", locked);
}

function updatePortfolioHeaderSubtitle(text, { hideWhenEmpty = true, hideWhenSameAsTitle = false, title = "" } = {}) {
  const el = elements.activeProfileSubtitleText || $("activeProfileSubtitleText");
  if (!el) return;

  const normalized = (text || "").trim();
  const titleNorm = (title || "").trim().toLowerCase();
  const shouldHide =
    (hideWhenEmpty && !normalized) ||
    (hideWhenSameAsTitle && normalized.toLowerCase() === titleNorm);

  if (shouldHide) {
    el.textContent = "";
    el.classList.add("portfolio-subtitle--empty");
    el.hidden = true;
  } else {
    el.textContent = normalized;
    el.classList.remove("portfolio-subtitle--empty");
    el.hidden = false;
  }
}

/** Map is always listed last in view tabs and the More menu, even when new views are added. */
const PORTFOLIO_VIEW_TAB_PIN_TO_END = "map";

/** Preferred order for portfolio views. Do not include {@link PORTFOLIO_VIEW_TAB_PIN_TO_END} — it is appended last. */
const PORTFOLIO_VIEW_TAB_ORDER = ["table", "board", "moscow", "raci", "kano"];

function getPortfolioViewTabOrder() {
  const pin = PORTFOLIO_VIEW_TAB_PIN_TO_END;
  const ordered = PORTFOLIO_VIEW_TAB_ORDER.filter(
    (view) => view !== pin && Boolean(getPortfolioViewTabButton(view))
  );
  if (getPortfolioViewTabButton(pin)) ordered.push(pin);
  return ordered;
}

function isPortfolioViewTab(view) {
  return getPortfolioViewTabOrder().includes(view);
}
let portfolioViewTabsLayoutFrame = 0;
let portfolioViewTabsOverflowBound = false;
let portfolioViewTabsLayoutLock = false;

function getPortfolioViewTabNav() {
  return document.querySelector(".portfolio-view-tabs");
}

function getPortfolioViewTabButton(view) {
  const map = {
    table: elements.roadmapsViewTableBtn,
    board: elements.roadmapsViewBoardBtn,
    moscow: elements.roadmapsViewMoscowBtn,
    map: elements.roadmapsViewMapBtn,
    raci: elements.roadmapsViewRaciBtn,
    kano: elements.roadmapsViewKanoBtn
  };
  return map[view] || null;
}

function setPortfolioViewTabButtonSlot(btn, slot) {
  if (!btn) return;
  btn.setAttribute("role", slot === "track" ? "tab" : "menuitem");
}

function closePortfolioViewTabsMenu() {
  const nav = getPortfolioViewTabNav();
  if (!nav) return;
  const menu = elements.portfolioViewTabsMoreMenu || $("portfolioViewTabsMoreMenu");
  const moreBtn = elements.portfolioViewTabsMoreBtn || $("portfolioViewTabsMoreBtn");
  nav.classList.remove("portfolio-view-tabs--overflow-open");
  if (menu) menu.hidden = true;
  if (moreBtn) moreBtn.setAttribute("aria-expanded", "false");
}

function syncPortfolioViewTabsMoreState() {
  const nav = getPortfolioViewTabNav();
  const menu = elements.portfolioViewTabsMoreMenu || $("portfolioViewTabsMoreMenu");
  const moreBtn = elements.portfolioViewTabsMoreBtn || $("portfolioViewTabsMoreBtn");
  if (!nav || !menu || !moreBtn) return;

  const activeView = state.roadmapsView;

  moreBtn.classList.remove("view-toggle-btn--active", "portfolio-view-tabs-more-btn--active");
  moreBtn.removeAttribute("aria-selected");

  const labelEl = moreBtn.querySelector(".portfolio-view-tabs-more-label");
  if (labelEl) labelEl.textContent = "More";

  const menuLabels = Array.from(menu.querySelectorAll(".view-tab-text"))
    .map((node) => node.textContent.trim())
    .filter(Boolean);
  moreBtn.title = menuLabels.length ? `More views: ${menuLabels.join(", ")}` : "";

  menu.querySelectorAll(".view-toggle-btn[data-view]").forEach((btn) => {
    const isActive = btn.dataset.view === activeView;
    btn.classList.toggle("view-toggle-btn--active", isActive);
    btn.setAttribute("aria-selected", String(isActive));
  });
}

function applyPortfolioViewTabsDuo(track, menu, overflowWrap, nav) {
  const activeView = isPortfolioViewTab(state.roadmapsView)
    ? state.roadmapsView
    : "table";

  nav.dataset.viewTabsMode = "duo";
  nav.classList.add("portfolio-view-tabs--has-overflow", "portfolio-view-tabs--duo");
  overflowWrap.hidden = false;
  closePortfolioViewTabsMenu();

  track.replaceChildren();
  menu.replaceChildren();

  const activeBtn = getPortfolioViewTabButton(activeView);
  if (activeBtn) {
    setPortfolioViewTabButtonSlot(activeBtn, "track");
    track.appendChild(activeBtn);
  }

  getPortfolioViewTabOrder().forEach((view) => {
    if (view === activeView) return;
    const btn = getPortfolioViewTabButton(view);
    if (btn) {
      setPortfolioViewTabButtonSlot(btn, "menu");
      menu.appendChild(btn);
    }
  });
}

function layoutPortfolioViewTabs() {
  if (portfolioViewTabsLayoutLock) return;

  const nav = getPortfolioViewTabNav();
  const track = nav?.querySelector(".portfolio-view-tabs-track");
  const menu = elements.portfolioViewTabsMoreMenu || $("portfolioViewTabsMoreMenu");
  const overflowWrap = nav?.querySelector(".portfolio-view-tabs-overflow");
  if (!nav || !track || !menu || !overflowWrap) return;

  portfolioViewTabsLayoutLock = true;
  try {
    applyPortfolioViewTabsDuo(track, menu, overflowWrap, nav);
    syncPortfolioViewTabsMoreState();
  } finally {
    portfolioViewTabsLayoutLock = false;
  }
}

function schedulePortfolioViewTabsLayout() {
  if (portfolioViewTabsLayoutFrame) cancelAnimationFrame(portfolioViewTabsLayoutFrame);
  portfolioViewTabsLayoutFrame = requestAnimationFrame(() => {
    portfolioViewTabsLayoutFrame = 0;
    layoutPortfolioViewTabs();
  });
}

function initPortfolioViewTabsOverflow() {
  const nav = getPortfolioViewTabNav();
  const menu = elements.portfolioViewTabsMoreMenu || $("portfolioViewTabsMoreMenu");
  const moreBtn = elements.portfolioViewTabsMoreBtn || $("portfolioViewTabsMoreBtn");
  if (!nav || !menu || !moreBtn || portfolioViewTabsOverflowBound) return;
  portfolioViewTabsOverflowBound = true;

  moreBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    const willOpen = menu.hidden;
    if (willOpen) {
      menu.hidden = false;
      nav.classList.add("portfolio-view-tabs--overflow-open");
      moreBtn.setAttribute("aria-expanded", "true");
    } else {
      closePortfolioViewTabsMenu();
    }
  });

  menu.addEventListener(
    "click",
    (event) => {
      const btn = event.target.closest(".view-toggle-btn[data-view]");
      if (!btn || !menu.contains(btn)) return;
      closePortfolioViewTabsMenu();
    },
    true
  );

  document.addEventListener("click", (event) => {
    if (!nav.classList.contains("portfolio-view-tabs--overflow-open")) return;
    if (nav.contains(event.target)) return;
    closePortfolioViewTabsMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && nav.classList.contains("portfolio-view-tabs--overflow-open")) {
      closePortfolioViewTabsMenu();
      moreBtn.focus();
    }
  });

  window.addEventListener("resize", () => schedulePortfolioViewTabsLayout());
  layoutPortfolioViewTabs();
}

function scrollActivePortfolioViewTabIntoView() {
  const tabs = document.querySelector(".portfolio-view-tabs-track") || document.querySelector(".portfolio-view-tabs");
  if (!tabs) return;
  if (tabs.scrollWidth <= tabs.clientWidth + 2) return;
  const active =
    tabs.querySelector(".view-toggle-btn--active, .view-toggle-btn[aria-selected='true']") ||
    document.querySelector(".portfolio-view-tabs-more-btn.view-toggle-btn--active");
  if (active && typeof active.scrollIntoView === "function") {
    requestAnimationFrame(() => {
      active.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    });
  }
}

function blurPortfolioViewTabs() {
  getPortfolioViewTabOrder().map((view) => getPortfolioViewTabButton(view))
    .filter(Boolean)
    .forEach((btn) => {
      btn.classList.remove("view-toggle-btn--pressed");
      btn.removeAttribute("title");
      if (document.activeElement === btn) btn.blur();
    });
}

function syncPortfolioViewTabState(view) {
  const activeView = view || state.roadmapsView;
  const tabMap = [
    [elements.roadmapsViewTableBtn, "table"],
    [elements.roadmapsViewBoardBtn, "board"],
    [elements.roadmapsViewMoscowBtn, "moscow"],
    [elements.roadmapsViewMapBtn, "map"],
    [elements.roadmapsViewRaciBtn, "raci"],
    [elements.roadmapsViewKanoBtn, "kano"]
  ];

  tabMap.forEach(([btn, name]) => {
    if (!btn) return;
    const isActive = activeView === name;
    btn.classList.toggle("view-toggle-btn--active", isActive);
    btn.setAttribute("aria-selected", String(isActive));
    btn.classList.remove("view-toggle-btn--pressed");
    btn.removeAttribute("title");
    if (!isActive && document.activeElement === btn) btn.blur();
  });
  layoutPortfolioViewTabs();
}

function getSortedProfiles() {
  return state.profiles
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

function getProfilePickerQuery() {
  if (!profilePickerIsSearching) return "";
  return (elements.profilePickerInput?.value || "").trim().toLowerCase();
}

function syncProfilePickerInputDisplay() {
  const input = elements.profilePickerInput || $("profilePickerInput");
  const avatar = elements.profilePickerAvatar || $("profilePickerAvatar");
  if (!input) return;

  const activeProfile = getActiveProfile();
  if (!profilePickerIsSearching) {
    if (activeProfile) {
      input.value = activeProfile.name;
      input.placeholder = "Search profiles…";
      if (avatar) avatar.textContent = getProfileInitials(activeProfile.name);
    } else {
      input.value = "";
      input.placeholder = "Search or select a profile…";
      if (avatar) avatar.textContent = "?";
    }
  } else if (avatar && activeProfile) {
    avatar.textContent = getProfileInitials(activeProfile.name);
  }
}

function setProfilePickerOpen(open) {
  const field = elements.profilePicker?.querySelector(".profile-picker__field");
  const dropdown = elements.profilePickerDropdown || $("profilePickerDropdown");
  const input = elements.profilePickerInput || $("profilePickerInput");
  const toggle = elements.profilePickerToggle || $("profilePickerToggle");

  if (open) prepareAppOverlay("profilePicker");

  profilePickerOpen = !!open;
  if (field) field.classList.toggle("profile-picker__field--open", profilePickerOpen);

  if (dropdown) dropdown.hidden = !profilePickerOpen;
  if (input) input.setAttribute("aria-expanded", profilePickerOpen ? "true" : "false");
  if (toggle) toggle.setAttribute("aria-expanded", profilePickerOpen ? "true" : "false");

  if (profilePickerOpen) {
    renderProfilePickerOptions();
  } else {
    profilePickerIsSearching = false;
    profilePickerHighlightIndex = -1;
    syncProfilePickerInputDisplay();
  }
}

function openProfilePickerDropdown() {
  if (!isCompactProfilesLayout()) return;
  setProfilePickerOpen(true);
  const input = elements.profilePickerInput || $("profilePickerInput");
  if (input) {
    profilePickerIsSearching = true;
    input.value = "";
    input.focus();
  }
}

function closeProfilePickerDropdown() {
  profilePickerIsSearching = false;
  profilePickerHighlightIndex = -1;
  setProfilePickerOpen(false);
}

function selectProfileFromPicker(profileId) {
  if (!profileId) return;
  profilePickerPointerSelecting = true;
  profilePickerIsSearching = false;
  profilePickerHighlightIndex = -1;
  profilePickerSuppressFocusOpen = true;
  setProfilePickerOpen(false);

  const input = elements.profilePickerInput || $("profilePickerInput");
  if (input) {
    input.blur();
  }

  setActiveProfile(profileId);

  window.setTimeout(() => {
    profilePickerPointerSelecting = false;
    profilePickerSuppressFocusOpen = false;
    syncProfilePickerInputDisplay();
  }, 0);
}

function renderProfilePickerOptions() {
  const listbox = elements.profilePickerListbox || $("profilePickerListbox");
  const empty = elements.profilePickerEmpty || $("profilePickerEmpty");
  if (!listbox) return;

  const query = getProfilePickerQuery();
  const profiles = getSortedProfiles().filter((profile) => profileMatchesFilter(profile, query));
  listbox.innerHTML = "";

  if (profiles.length === 0) {
    if (empty) empty.hidden = false;
    profilePickerHighlightIndex = -1;
    return;
  }

  if (empty) empty.hidden = true;
  if (profilePickerHighlightIndex >= profiles.length) {
    profilePickerHighlightIndex = profiles.length - 1;
  }

  profiles.forEach((profile, index) => {
    const isActive = profile.id === state.activeProfileId;
    const isLocked = isProfilePasswordProtected(profile) && !isProfileUnlocked(profile.id);
    const teamLabel = (profile.team || "").trim();
    const metaParts = [];
    if (teamLabel) metaParts.push(teamLabel);
    if (isProfilePasswordProtected(profile)) {
      metaParts.push(isLocked ? "Password required" : "Unlocked");
    }

    const option = document.createElement("button");
    option.type = "button";
    option.className =
      "profile-picker__option" +
      (isActive ? " profile-picker__option--active" : "") +
      (index === profilePickerHighlightIndex ? " profile-picker__option--highlight" : "");
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", isActive ? "true" : "false");
    option.dataset.profileId = profile.id;

    const avatar = document.createElement("span");
    avatar.className = "profile-picker__option-avatar";
    avatar.textContent = getProfileInitials(profile.name);
    avatar.setAttribute("aria-hidden", "true");

    const copy = document.createElement("span");
    copy.className = "profile-picker__option-copy";

    const name = document.createElement("span");
    name.className = "profile-picker__option-name";
    name.textContent = profile.name;

    const meta = document.createElement("span");
    meta.className = "profile-picker__option-meta";
    meta.textContent = metaParts.join(" · ") || "Profile workspace";

    copy.appendChild(name);
    copy.appendChild(meta);

    const check = document.createElement("span");
    check.className = "profile-picker__option-check";
    check.setAttribute("aria-hidden", "true");
    check.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

    option.appendChild(avatar);
    option.appendChild(copy);

    if (isProfilePasswordProtected(profile)) {
      const lock = document.createElement("span");
      lock.className = "profile-picker__option-lock";
      lock.setAttribute("aria-hidden", "true");
      lock.innerHTML = isLocked
        ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>'
        : '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>';
      option.appendChild(lock);
    }

    option.appendChild(check);

    option.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      selectProfileFromPicker(profile.id);
    });

    listbox.appendChild(option);
  });
}

function renderProfilePicker() {
  const bar = elements.profilePickerBar || $("profilePickerBar");
  if (!bar) return;

  const compact = isCompactProfilesLayout();
  const { profiles } = state;

  if (!compact || profiles.length === 0) {
    bar.hidden = true;
    closeProfilePickerDropdown();
    mountSuperAdminToggleForLayout();
    syncSuperAdminChrome();
    return;
  }

  bar.hidden = false;
  if (!profilePickerOpen) {
    profilePickerIsSearching = false;
  }
  syncProfilePickerInputDisplay();
  if (profilePickerOpen) {
    renderProfilePickerOptions();
  }
  mountSuperAdminToggleForLayout();
  syncSuperAdminChrome();
}

function initProfilePicker() {
  const input = elements.profilePickerInput || $("profilePickerInput");
  const toggle = elements.profilePickerToggle || $("profilePickerToggle");
  const field = elements.profilePicker?.querySelector(".profile-picker__field");

  if (input) {
    input.addEventListener("focus", () => {
      if (!isCompactProfilesLayout()) return;
      if (profilePickerSuppressFocusOpen) return;
      profilePickerIsSearching = true;
      setProfilePickerOpen(true);
      input.select();
    });

    input.addEventListener("input", () => {
      profilePickerIsSearching = true;
      profilePickerHighlightIndex = -1;
      if (!profilePickerOpen) setProfilePickerOpen(true);
      renderProfilePickerOptions();
    });

    input.addEventListener("keydown", (e) => {
      if (!profilePickerOpen) {
        if (e.key === "ArrowDown" || e.key === "Enter") {
          e.preventDefault();
          openProfilePickerDropdown();
        }
        return;
      }

      const options = Array.from(
        (elements.profilePickerListbox || $("profilePickerListbox"))?.querySelectorAll(".profile-picker__option") || []
      );

      if (e.key === "Escape") {
        e.preventDefault();
        closeProfilePickerDropdown();
        input.blur();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (options.length === 0) return;
        profilePickerHighlightIndex = Math.min(profilePickerHighlightIndex + 1, options.length - 1);
        renderProfilePickerOptions();
        options[profilePickerHighlightIndex]?.scrollIntoView({ block: "nearest" });
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (options.length === 0) return;
        profilePickerHighlightIndex = Math.max(profilePickerHighlightIndex - 1, 0);
        renderProfilePickerOptions();
        options[profilePickerHighlightIndex]?.scrollIntoView({ block: "nearest" });
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        const highlighted = options[profilePickerHighlightIndex];
        const targetId = highlighted?.dataset.profileId || options[0]?.dataset.profileId;
        if (targetId) selectProfileFromPicker(targetId);
      }
    });

    input.addEventListener("blur", (e) => {
      if (profilePickerPointerSelecting) return;
      window.setTimeout(() => {
        if (profilePickerPointerSelecting) return;
        const related = e.relatedTarget;
        const dropdown = elements.profilePickerDropdown || $("profilePickerDropdown");
        const picker = elements.profilePicker || $("profilePicker");
        if (related && (dropdown?.contains(related) || picker?.contains(related))) return;
        const active = document.activeElement;
        if (field && field.contains(active)) return;
        closeProfilePickerDropdown();
      }, 150);
    });
  }

  if (toggle) {
    toggle.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (profilePickerOpen) {
        closeProfilePickerDropdown();
      } else {
        openProfilePickerDropdown();
      }
    });
  }

  document.addEventListener("click", (e) => {
    if (!profilePickerOpen) return;
    const picker = elements.profilePicker || $("profilePicker");
    if (picker && !picker.contains(e.target)) {
      closeProfilePickerDropdown();
    }
  });

  const mqCompact = window.matchMedia(getCompactLayoutMediaQueryString());
  const handleBreakpoint = (e) => {
    if (!e.matches) closeProfilePickerDropdown();
    renderProfilePicker();
  };
  if (typeof mqCompact.addEventListener === "function") {
    mqCompact.addEventListener("change", handleBreakpoint);
  } else if (typeof mqCompact.addListener === "function") {
    mqCompact.addListener(handleBreakpoint);
  }
}

/* ─── Bottom-sheet helpers ──────────────────────────────── */
function syncProfilesSheetTabsUi() {
  const compact = isCompactProfilesLayout();
  const tabs = elements.profilesSheetTabs;
  const browseTab = elements.profilesSheetTabBrowse;
  const createTab = elements.profilesSheetTabCreate;
  const browsePanel = elements.profilesSheetPanelBrowse;
  const createPanel = elements.profilesSheetPanelCreate;
  const sheetBody = document.querySelector(".profiles-panel-sheet-body");

  if (tabs) tabs.hidden = !compact;

  if (!compact) {
    if (browsePanel) browsePanel.hidden = false;
    if (createPanel) createPanel.hidden = false;
    if (sheetBody) {
      sheetBody.classList.remove("profiles-sheet-body--tab-browse", "profiles-sheet-body--tab-create");
    }
    return;
  }

  const showBrowse = profilesSheetTab !== "create";
  if (browseTab) {
    browseTab.classList.toggle("profiles-sheet-tab--active", showBrowse);
    browseTab.setAttribute("aria-selected", showBrowse ? "true" : "false");
  }
  if (createTab) {
    createTab.classList.toggle("profiles-sheet-tab--active", !showBrowse);
    createTab.setAttribute("aria-selected", !showBrowse ? "true" : "false");
  }
  if (browsePanel) browsePanel.hidden = !showBrowse;
  if (createPanel) createPanel.hidden = showBrowse;

  const createDetails = elements.profilesCreatePanel || $("profilesCreatePanel");
  if (createDetails && compact) createDetails.open = true;

  if (sheetBody) {
    sheetBody.classList.toggle("profiles-sheet-body--tab-browse", showBrowse);
    sheetBody.classList.toggle("profiles-sheet-body--tab-create", !showBrowse);
  }
}

function setProfilesSheetTab(tab) {
  profilesSheetTab = tab === "create" ? "create" : "browse";
  syncProfilesSheetTabsUi();
  if (profilesSheetTab === "create") {
    const nameInput = $("newProfileName");
    requestAnimationFrame(() => nameInput?.focus());
  } else {
    const search = elements.profilesSearchInput;
    requestAnimationFrame(() => search?.focus());
  }
}

function openProfilesSheet() {
  const sheet = elements.profilesPanelSheet || $("profilesPanelSheet");
  const backdrop = elements.profilesSheetBackdrop || $("profilesSheetBackdrop");
  const manageBtn = elements.mobileProfileManageBtn || $("mobileProfileManageBtn");
  if (!sheet || !isCompactProfilesLayout()) return;

  prepareAppOverlay("profilesSheet");

  profilesSheetTab = "browse";
  syncProfilesSheetTabsUi();

  sheet.hidden = false;
  // Force reflow so CSS transition fires
  void sheet.offsetHeight;
  sheet.classList.add("profiles-panel-sheet--open");

  if (backdrop) {
    backdrop.hidden = false;
    void backdrop.offsetHeight;
    backdrop.classList.add("profiles-sheet-backdrop--visible");
  }

  if (manageBtn) manageBtn.setAttribute("aria-expanded", "true");

  // Scroll lock
  document.body.style.overflow = "hidden";

  // Focus search when opening browse tab
  const search = elements.profilesSearchInput;
  if (search) {
    setTimeout(() => { try { search.focus(); } catch (_) {} }, 120);
  }
}

function closeProfilesSheet({ immediate = false } = {}) {
  const sheet = elements.profilesPanelSheet || $("profilesPanelSheet");
  const backdrop = elements.profilesSheetBackdrop || $("profilesSheetBackdrop");
  const manageBtn = elements.mobileProfileManageBtn || $("mobileProfileManageBtn");
  if (!sheet) return;

  if (profilesSheetCloseTimer) {
    clearTimeout(profilesSheetCloseTimer);
    profilesSheetCloseTimer = null;
  }

  sheet.classList.remove("profiles-panel-sheet--open");
  if (backdrop) backdrop.classList.remove("profiles-sheet-backdrop--visible");
  if (manageBtn) manageBtn.setAttribute("aria-expanded", "false");
  document.body.style.overflow = "";

  if (immediate) {
    markOverlayCloseImmediate(sheet);
    if (backdrop) markOverlayCloseImmediate(backdrop);
    sheet.hidden = true;
    if (backdrop) backdrop.hidden = true;
    return;
  }

  profilesSheetCloseTimer = setTimeout(() => {
    profilesSheetCloseTimer = null;
    if (!sheet.classList.contains("profiles-panel-sheet--open")) {
      sheet.hidden = true;
    }
    if (backdrop && !backdrop.classList.contains("profiles-sheet-backdrop--visible")) {
      backdrop.hidden = true;
    }
  }, 380);
}

function initProfilesPanel() {
  const panel = elements.profilesCreatePanel || $("profilesCreatePanel");
  const manageBtn = elements.mobileProfileManageBtn || $("mobileProfileManageBtn");
  const closeBtn = elements.profilesSheetCloseBtn || $("profilesSheetCloseBtn");
  const backdrop = elements.profilesSheetBackdrop || $("profilesSheetBackdrop");

  syncProfilesSheetTabsUi();

  [elements.profilesSheetTabBrowse, elements.profilesSheetTabCreate].filter(Boolean).forEach((btn) => {
    btn.addEventListener("click", () => {
      setProfilesSheetTab(btn.dataset.profilesTab || "browse");
    });
  });

  if (manageBtn) {
    manageBtn.addEventListener("click", () => {
      if (isCompactProfilesLayout()) {
        openProfilesSheet();
      }
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", closeProfilesSheet);
  }

  if (backdrop) {
    backdrop.addEventListener("click", closeProfilesSheet);
  }

  // Close on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !isCompactProfilesLayout()) return;
    const sheet = elements.profilesPanelSheet || $("profilesPanelSheet");
    if (sheet && sheet.classList.contains("profiles-panel-sheet--open")) {
      closeProfilesSheet();
      return;
    }
    closeProfilePickerDropdown();
  });

  // On breakpoint change to desktop: ensure sheet is closed
  const mqCompact = window.matchMedia(getCompactLayoutMediaQueryString());
  const handleBreakpoint = (e) => {
    if (!e.matches) {
      closeProfilesSheet();
    }
    syncProfilesSheetTabsUi();
    renderProfiles();
  };
  if (typeof mqCompact.addEventListener === "function") {
    mqCompact.addEventListener("change", handleBreakpoint);
  } else if (typeof mqCompact.addListener === "function") {
    mqCompact.addListener(handleBreakpoint);
  }

  if (!panel) return;
  const applyDefaultOpen = () => {
    if (window.matchMedia("(min-width: 900px)").matches) {
      panel.open = true;
    }
  };
  applyDefaultOpen();
  const mq = window.matchMedia("(min-width: 900px)");
  if (typeof mq.addEventListener === "function") {
    mq.addEventListener("change", applyDefaultOpen);
  } else if (typeof mq.addListener === "function") {
    mq.addListener(applyDefaultOpen);
  }

  const search = elements.profilesSearchInput || $("profilesSearchInput");
  if (search) {
    search.addEventListener("input", () => {
      profilesFilterQuery = search.value.trim().toLowerCase();
      renderProfiles();
    });
  }
}

function getProfileInitials(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return "?";
}

function profileMatchesFilter(profile, query) {
  if (!query) return true;
  const name = (profile.name || "").toLowerCase();
  const team = (profile.team || "").toLowerCase();
  return name.includes(query) || team.includes(query);
}

function updateProfilesSearchUi(profileCount) {
  const wrap = elements.profilesSearchInput?.closest(".profiles-search");
  if (wrap) wrap.classList.toggle("profiles-search--hidden", profileCount <= 1);
}

function appendProfileActionChip(actions, classSuffix, label, tooltipTitle, tooltipBody, svg, onClick, { showLabel = false, disabled = false } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "profile-icon-wrap profile-action-wrap";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `profile-action-chip profile-action-chip--${classSuffix} profile-icon-btn profile-icon-btn--${classSuffix}`;
  btn.setAttribute("aria-label", label);
  btn.innerHTML = showLabel
    ? `${svg}<span class="profile-action-label profile-action-label--visible">${label}</span>`
    : `${svg}<span class="profile-action-label">${label}</span>`;
  if (disabled) {
    btn.disabled = true;
    btn.setAttribute("aria-disabled", "true");
  } else {
    btn.addEventListener("click", onClick);
  }
  wrap.appendChild(btn);
  wrap.appendChild(createProfileButtonTooltip(tooltipTitle, tooltipBody));
  actions.appendChild(wrap);
}

const DEMO_READ_ONLY_ACTION_TITLE = "Demo profile is read-only. Edits and deletions are disabled.";

function renderProfiles() {
  const { profiles, activeProfileId } = state;
  const query = profilesFilterQuery;

  elements.profileList.innerHTML = "";
  elements.profilesEmptyState.style.display = profiles.length ? "none" : "block";
  updateProfilesSearchUi(profiles.length);

  if (elements.profilesCountBadge) {
    elements.profilesCountBadge.textContent = String(profiles.length);
    elements.profilesCountBadge.dataset.count = String(profiles.length);
  }

  const sorted = profiles
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const visible = sorted.filter((p) => profileMatchesFilter(p, query));

  if (elements.profilesNoResults) {
    elements.profilesNoResults.style.display =
      profiles.length > 0 && visible.length === 0 ? "block" : "none";
  }

  visible.forEach((profile) => {
    const li = document.createElement("li");
    li.className = "profiles-list-item";
    li.setAttribute("role", "presentation");

    const isActive = profile.id === activeProfileId;
    const isLocked = isProfilePasswordProtected(profile) && !isProfileUnlocked(profile.id);
    const isLockedActive = isActive && isLocked;
    const compactCard = isCompactProfilesLayout();

    const row = document.createElement("article");
    row.className =
      "profile-item-row profiles-card" +
      (compactCard ? " profiles-card--compact" : "") +
      (isActive ? " profiles-card--active" : "") +
      (isLockedActive ? " profiles-card--locked" : "");
    row.setAttribute("role", "option");
    row.setAttribute("aria-selected", isActive ? "true" : "false");

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "profiles-card-select profile-item-btn" +
      (isActive ? " active" : "") +
      (isLockedActive ? " profile-item-btn--locked-active" : "");
    btn.setAttribute("aria-label", `Select profile ${profile.name}`);

    if (!compactCard) {
      const radio = document.createElement("span");
      radio.className = "profiles-card-radio";
      radio.setAttribute("aria-hidden", "true");
      btn.appendChild(radio);
    }

    const avatar = document.createElement("span");
    avatar.className = "profiles-card-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = getProfileInitials(profile.name);
    btn.appendChild(avatar);

    const body = document.createElement("span");
    body.className = "profiles-card-body profile-item-main";

    const titleRow = document.createElement("span");
    titleRow.className = "profiles-card-title-row";

    const nameEl = document.createElement("span");
    nameEl.className = "profile-item-name";
    nameEl.textContent = profile.name;
    titleRow.appendChild(nameEl);

    if (isProfilePasswordProtected(profile)) {
      const lockBadge = document.createElement("span");
      lockBadge.className = "profile-item-lock-badge";
      lockBadge.setAttribute("aria-hidden", "true");
      lockBadge.innerHTML = isProfileUnlocked(profile.id)
        ? '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>'
        : '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
      lockBadge.setAttribute(
        "aria-label",
        isProfileUnlocked(profile.id) ? "Unlocked this session" : "Password protected"
      );
      titleRow.appendChild(lockBadge);
    }

    if (isActive) {
      const status = document.createElement("span");
      status.className = "profiles-card-status" + (isLocked ? " profiles-card-status--locked" : "");
      status.textContent = isLocked ? "Locked" : "Active";
      titleRow.appendChild(status);
    }

    body.appendChild(titleRow);

    const summary = document.createElement("span");
    summary.className = "profile-summary";

    const teamText = (profile.team || "").trim();
    if (teamText) {
      const teamSpan = document.createElement("span");
      teamSpan.className = "profile-item-team-pill";
      teamSpan.textContent = teamText;
      summary.appendChild(teamSpan);
    }

    const roadmapCount = Array.isArray(profile.roadmaps) ? profile.roadmaps.length : 0;
    const countSpan = document.createElement("span");
    countSpan.className = "profile-item-count";
    countSpan.textContent = roadmapCount === 1 ? "1 roadmap" : `${roadmapCount} roadmaps`;
    summary.appendChild(countSpan);

    body.appendChild(summary);
    btn.appendChild(body);
    btn.addEventListener("click", () => setActiveProfile(profile.id));

    const actions = document.createElement("div");
    actions.className =
      "profile-item-actions profiles-card-actions" +
      (compactCard ? " profiles-card-actions--footer" : "");

    const actionOpts = { showLabel: compactCard };

    appendProfileActionChip(
      actions,
      "view",
      "View",
      "View profile",
      "Open profile details and statistics",
      getProfileIconSvg("view"),
      (event) => {
        event.stopPropagation();
        openProfileViewModal(profile.id);
      },
      actionOpts
    );

    const demoProfileCard = isDemoProfile(profile);
    appendProfileActionChip(
      actions,
      "edit",
      "Edit",
      demoProfileCard ? "Edit profile (disabled)" : "Edit profile",
      demoProfileCard
        ? DEMO_READ_ONLY_ACTION_TITLE
        : "Change name, team, or profile password (current password required if locked).",
      getProfileIconSvg("edit"),
      (event) => {
        event.stopPropagation();
        openProfileEditModal(profile.id);
      },
      { ...actionOpts, disabled: demoProfileCard }
    );

    appendProfileActionChip(
      actions,
      "danger",
      "Delete",
      demoProfileCard ? "Delete profile (disabled)" : "Delete profile",
      demoProfileCard ? DEMO_READ_ONLY_ACTION_TITLE : "Remove this profile and all its roadmaps permanently",
      getProfileIconSvg("trash"),
      (event) => {
        event.stopPropagation();
        deleteProfile(profile.id);
      },
      { ...actionOpts, disabled: demoProfileCard }
    );

    if (compactCard) {
      row.appendChild(btn);
      row.appendChild(actions);
    } else {
      row.appendChild(btn);
      row.appendChild(actions);
    }
    li.appendChild(row);
    elements.profileList.appendChild(li);
  });

  const activeProfile = getActiveProfile();
  updateProfilesShellSummary(activeProfile, profiles.length);
  renderProfilePicker();

  if (!activeProfile) {
    syncPortfolioCommandIdentity(null);
    elements.activeProfileTitleText.textContent = "No profile selected";
    if (typeof Fullscreen !== "undefined" && typeof Fullscreen.syncChromeContext === "function") {
      Fullscreen.syncChromeContext();
    }
    updatePortfolioHeaderSubtitle(
      isCompactProfilesLayout()
        ? "Use the profile picker above or Manage to add workspaces."
        : "Create or select a profile to start adding roadmaps."
    );
    elements.roadmapsHeaderBadges.innerHTML = "";
    updateBulkSelectionActions();
    syncPortfolioActionButtons();
    return;
  }

  syncPortfolioCommandIdentity(activeProfile);
  elements.activeProfileTitleText.textContent = activeProfile.name;
  if (typeof Fullscreen !== "undefined" && typeof Fullscreen.syncChromeContext === "function") {
    Fullscreen.syncChromeContext();
  }
  const locked = !isProfileUnlocked(activeProfile.id);
  const demoReadOnly = isActiveDemoProfile();
  updatePortfolioHeaderSubtitle(buildPortfolioHeaderSubtitle(activeProfile), {
    hideWhenSameAsTitle: true,
    title: activeProfile.name
  });

  if (elements.roadmapsHeaderBadges) {
    elements.roadmapsHeaderBadges.innerHTML = demoReadOnly && !locked
      ? '<span class="portfolio-demo-badge portfolio-status-badge" title="Browse only — add, edit, and delete are disabled">Demo</span>'
      : "";
  }
  syncPortfolioActionButtons();
  syncDemoReadOnlyChrome();
  syncSuperAdminChrome();
  updateProfileLockedBanner();
}

function renderRoadmaps() {
  const activeProfile = getActiveProfile();
  const demoReadOnly = isActiveDemoProfile();
  syncDemoReadOnlyChrome();
  syncSuperAdminChrome();
  if (activeProfile && elements.activeProfileSubtitleText) {
    updatePortfolioHeaderSubtitle(buildPortfolioHeaderSubtitle(activeProfile), {
      hideWhenSameAsTitle: true,
      title: activeProfile.name
    });
  }
  elements.roadmapsTableBody.innerHTML = "";
  if (elements.roadmapsTableCardsList) {
    elements.roadmapsTableCardsList.innerHTML = "";
  }
  updateProfileLockedBanner();

  if (elements.tableSortByRiceToggle) {
    elements.tableSortByRiceToggle.checked = state.tableSortByRice;
  }

  if (!activeProfile) {
    renderRoadmapsTableEmptyMessage("Create or select a profile to start adding roadmaps.");
    updateBulkSelectionActions();
    renderNonTableRoadmapsView();
    return;
  }

  if (!isProfileUnlocked(activeProfile.id)) {
    renderRoadmapsTableEmptyMessage(
      "This profile is locked. Enter your password in the banner above to unlock."
    );
    updateBulkSelectionActions();
    syncPortfolioActionButtons();
    if (elements.selectAllRoadmaps) elements.selectAllRoadmaps.checked = false;
    renderNonTableRoadmapsView();
    return;
  }

  const baseRoadmaps = getPortfolioRoadmapsBaseList();

  baseRoadmaps.forEach((p) => {
    p.riceScore = calculateRiceScore(p);
  });

  initFilterRoadmapPeriodOptions(baseRoadmaps);

  let roadmaps = applyFilters(baseRoadmaps);
  roadmaps = sortRoadmaps(roadmaps);

  if (!roadmaps.length) {
    renderRoadmapsTableEmptyMessage(
      isSuperAdminModeActive()
        ? "No roadmaps match the current filters across all profiles. Adjust filters or add a new roadmap."
        : "No roadmaps match the current filters. Adjust filters or add a new roadmap."
    );
    updateBulkSelectionActions();
    elements.selectAllRoadmaps.checked = false;
    renderNonTableRoadmapsView();
    return;
  }

  const useCompactTableCards = isTableCompactLayout();

  if (useCompactTableCards) {
    renderRoadmapsTableCards(roadmaps, demoReadOnly);
    syncHeaderCheckbox();
    updateBulkSelectionActions();
    updateSortIndicators();
    if (state.roadmapsView === "table" && roadmaps.some((p) => p.financialImpactValue != null && p.financialImpactValue !== "")) {
      if (Object.keys(state.exchangeRatesToEUR || {}).length === 0) {
        ExchangeRates.ensure().then(() => renderRoadmaps()).catch(() => {});
      }
    }
    renderNonTableRoadmapsView();
    return;
  }

  const rows = document.createDocumentFragment();
  roadmaps.forEach((roadmap) => {
    const tr = document.createElement("tr");
    if (
      isSuperAdminModeActive() &&
      roadmap.ownerProfileId &&
      roadmap.ownerProfileId !== state.activeProfileId
    ) {
      tr.classList.add("roadmaps-table-row--external-profile");
    }

    const tdSelect = document.createElement("td");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "checkbox-input roadmap-select-checkbox";
    cb.setAttribute("data-id", roadmap.id);
    cb.setAttribute("aria-label", `Select ${roadmap.title || "roadmap"}`);
    if (demoReadOnly) {
      cb.disabled = true;
      cb.title = DEMO_READ_ONLY_ACTION_TITLE;
    }
    tdSelect.appendChild(cb);
    stampRoadmapsTableCol(tdSelect, "select");
    tr.appendChild(tdSelect);

    const tdTitle = document.createElement("td");
    stampRoadmapsTableCol(tdTitle, "title");
    const countries = Array.isArray(roadmap.countries) ? roadmap.countries : [];
    const titleBlock = document.createElement("div");
    titleBlock.className = "cell-title-block";
    const roadmapDesc = roadmap.description || "";
    const titleDiv = document.createElement("div");
    titleDiv.className = "cell-title";
    titleDiv.textContent = roadmap.title || "";
    if (roadmapDesc) {
      const descWrap = document.createElement("span");
      descWrap.className = "cell-desc-with-tooltip";
      descWrap.setAttribute("aria-label", "Roadmap name; hover for description");
      descWrap.appendChild(titleDiv);
      descWrap.appendChild(
        buildRoadmapDetailsTooltip({
          titleLabel: "Description",
          rawDescription: roadmapDesc
        })
      );
      titleBlock.appendChild(descWrap);
    } else {
      titleBlock.appendChild(titleDiv);
    }
    if (countries.length) {
      const normalizedCountries = normalizeRoadmapCountriesList(countries);
      const isEuRegion = roadmapCountriesRepresentEuRegion(normalizedCountries);
      const countriesWrap = document.createElement("span");
      countriesWrap.className = "cell-countries-with-tooltip";
      countriesWrap.setAttribute(
        "aria-label",
        isEuRegion
          ? "European Union; hover for member countries"
          : "Target countries; hover for full list"
      );
      const badge = document.createElement("div");
      badge.className = isEuRegion ? "countries-badge countries-badge--eu" : "countries-badge";
      const badgeSpan = document.createElement("span");
      if (isEuRegion) {
        const flagEl = document.createElement("span");
        flagEl.className = "countries-badge__flag";
        flagEl.setAttribute("aria-hidden", "true");
        flagEl.textContent = getEuRegionFlagEmoji();
        badgeSpan.appendChild(flagEl);
        const labelEl = document.createElement("span");
        labelEl.className = "countries-badge__code";
        labelEl.textContent = "EU";
        badgeSpan.appendChild(labelEl);
      } else {
        const maxToShow = 3;
        const shown = normalizedCountries.slice(0, maxToShow);
        const moreCount = normalizedCountries.length - shown.length;
        const shownCodes = shown.map((name) => countryCodeByName[name] || name);
        badgeSpan.textContent =
          shownCodes.join(", ") + (moreCount > 0 ? " +" + moreCount + " more" : "");
      }
      badge.appendChild(badgeSpan);
      countriesWrap.appendChild(badge);
      countriesWrap.appendChild(buildCountriesListTooltip(normalizedCountries));
      titleBlock.appendChild(countriesWrap);
    }
    tdTitle.appendChild(titleBlock);
    tr.appendChild(tdTitle);
    tr.appendChild(buildRoadmapOwnerTableCell(roadmap));

    const tdType = document.createElement("td");
    stampRoadmapsTableCol(tdType, "type");
    if (roadmap.roadmapType) {
      const meta = roadmapTypeIcons && roadmapTypeIcons[roadmap.roadmapType];
      const wrapper = document.createElement("span");
      wrapper.className = "cell-type-icon-wrap cell-type-pill";
      wrapper.dataset.type = roadmap.roadmapType;
      wrapper.dataset.iconKind = "type";
      wrapper.setAttribute("role", "img");
      wrapper.setAttribute("aria-label", roadmap.roadmapType);
      if (meta && meta.svg) {
        wrapper.innerHTML = meta.svg;
        if (meta.tooltipTitle != null || meta.tooltipBody != null) {
          const tooltipEl = document.createElement("div");
          tooltipEl.className = "cell-type-tooltip";
          tooltipEl.setAttribute("role", "tooltip");
          if (meta.tooltipTitle != null) {
            const titleEl = document.createElement("div");
            titleEl.className = "cell-type-tooltip-title";
            titleEl.textContent = meta.tooltipTitle;
            tooltipEl.appendChild(titleEl);
          }
          if (meta.tooltipBody != null) {
            const bodyEl = document.createElement("div");
            bodyEl.className = "cell-type-tooltip-body";
            const paragraphs = String(meta.tooltipBody).split(/\n\n+/);
            paragraphs.forEach((p) => {
              const block = document.createElement("p");
              block.textContent = p.trim();
              if (block.textContent) bodyEl.appendChild(block);
            });
            tooltipEl.appendChild(bodyEl);
          }
          wrapper.appendChild(tooltipEl);
        }
      } else {
        wrapper.textContent = roadmap.roadmapType;
      }
      tdType.appendChild(wrapper);
    } else {
      tdType.innerHTML = `<span class="cell-meta">—</span>`;
    }
    tr.appendChild(tdType);

    const tdStatus = document.createElement("td");
    stampRoadmapsTableCol(tdStatus, "status");
    if (roadmap.roadmapStatus) {
      const meta = roadmapStatusIcons && roadmapStatusIcons[roadmap.roadmapStatus];
      const wrapper = document.createElement("span");
      wrapper.className = "cell-type-icon-wrap cell-type-pill cell-status-icon-wrap";
      wrapper.dataset.status = roadmap.roadmapStatus;
      wrapper.dataset.iconKind = "status";
      wrapper.setAttribute("role", "img");
      wrapper.setAttribute("aria-label", roadmap.roadmapStatus);
      if (meta && meta.svg) {
        wrapper.innerHTML = meta.svg;
        if (meta.tooltipTitle != null || meta.tooltipBody != null) {
          const tooltipEl = document.createElement("div");
          tooltipEl.className = "cell-type-tooltip";
          tooltipEl.setAttribute("role", "tooltip");
          if (meta.tooltipTitle != null) {
            const titleEl = document.createElement("div");
            titleEl.className = "cell-type-tooltip-title";
            titleEl.textContent = meta.tooltipTitle;
            tooltipEl.appendChild(titleEl);
          }
          if (meta.tooltipBody != null) {
            const bodyEl = document.createElement("div");
            bodyEl.className = "cell-type-tooltip-body";
            const paragraphs = String(meta.tooltipBody).split(/\n\n+/);
            paragraphs.forEach((p) => {
              const block = document.createElement("p");
              block.textContent = p.trim();
              if (block.textContent) bodyEl.appendChild(block);
            });
            tooltipEl.appendChild(bodyEl);
          }
          wrapper.appendChild(tooltipEl);
        }
      } else {
        wrapper.textContent = roadmap.roadmapStatus;
      }
      tdStatus.appendChild(wrapper);
    } else {
      tdStatus.innerHTML = `<span class="cell-meta">—</span>`;
    }
    tr.appendChild(tdStatus);

    const tdFramework = document.createElement("td");
    stampRoadmapsTableCol(tdFramework, "framework");
    const frameworkKey = normalizeFinancialFramework(roadmap.financialImpactFramework);
    const frameworkMeta = FINANCIAL_FRAMEWORK_ICONS[frameworkKey];
    if (frameworkMeta && frameworkMeta.svg) {
      const wrapper = document.createElement("span");
      wrapper.className = "cell-type-icon-wrap cell-type-pill cell-framework-icon-wrap";
      wrapper.dataset.framework = frameworkKey;
      wrapper.dataset.iconKind = "framework";
      wrapper.setAttribute("role", "img");
      wrapper.setAttribute("aria-label", frameworkMeta.label || frameworkKey);
      wrapper.innerHTML = frameworkMeta.svg;

      const tooltipEl = document.createElement("div");
      tooltipEl.className = "cell-type-tooltip";
      tooltipEl.setAttribute("role", "tooltip");
      const titleEl = document.createElement("div");
      titleEl.className = "cell-type-tooltip-title";
      titleEl.textContent = frameworkMeta.tooltipTitle || frameworkMeta.label || "Financial framework";
      tooltipEl.appendChild(titleEl);
      if (frameworkMeta.tooltipBody) {
        const bodyEl = document.createElement("div");
        bodyEl.className = "cell-type-tooltip-body";
        const p = document.createElement("p");
        p.textContent = frameworkMeta.tooltipBody;
        bodyEl.appendChild(p);
        tooltipEl.appendChild(bodyEl);
      }
      wrapper.appendChild(tooltipEl);
      tdFramework.appendChild(wrapper);
    } else {
      tdFramework.innerHTML = `<span class="cell-meta">—</span>`;
    }
    tr.appendChild(tdFramework);

    const tdPeriod = document.createElement("td");
    stampRoadmapsTableCol(tdPeriod, "period");
    const periodValue = roadmap.roadmapPeriod || "";
    if (periodValue && typeof roadmapPeriodTooltip !== "undefined") {
      const meta = roadmapPeriodTooltip;
      const wrap = document.createElement("span");
      wrap.className = "cell-period-with-tooltip";
      wrap.setAttribute("aria-label", `Roadmap period: ${periodValue}`);
      const textSpan = document.createElement("span");
      textSpan.className = "cell-meta cell-period-text";
      textSpan.textContent = periodValue;
      wrap.appendChild(textSpan);
      const tooltipEl = document.createElement("div");
      tooltipEl.className = "cell-type-tooltip";
      tooltipEl.setAttribute("role", "tooltip");
      if (meta.tooltipTitle != null) {
        const titleEl = document.createElement("div");
        titleEl.className = "cell-type-tooltip-title";
        titleEl.textContent = meta.tooltipTitle;
        tooltipEl.appendChild(titleEl);
      }
      if (meta.tooltipBodyDescription != null) {
        const bodyEl = document.createElement("div");
        bodyEl.className = "cell-type-tooltip-body";
        const periodMatch = String(periodValue).trim().match(/^(\d{4})-Q([1-4])$/i);
        let bodyText = meta.tooltipBodyDescription;
        if (periodMatch) {
          const year = periodMatch[1];
          const q = periodMatch[2];
          const quarterMonths = { "1": "Jan - Mar", "2": "Apr - Jun", "3": "Jul - Sep", "4": "Oct - Dec" };
          const range = quarterMonths[q] || "";
          bodyText = bodyText + "\n\n" + `${periodValue} → ${range} ${year}`;
        }
        const paragraphs = String(bodyText).split(/\n\n+/);
        paragraphs.forEach((p) => {
          const block = document.createElement("p");
          block.textContent = p.trim();
          if (block.textContent) bodyEl.appendChild(block);
        });
        tooltipEl.appendChild(bodyEl);
      }
      wrap.appendChild(tooltipEl);
      tdPeriod.appendChild(wrap);
    } else {
      const periodSpan = document.createElement("span");
      periodSpan.className = "cell-meta cell-period-text";
      periodSpan.textContent = periodValue || "—";
      tdPeriod.appendChild(periodSpan);
    }
    tr.appendChild(tdPeriod);

    const tdTshirtSize = document.createElement("td");
    stampRoadmapsTableCol(tdTshirtSize, "size");
    if (roadmap.tshirtSize) {
      const meta = tshirtSizeTooltips && tshirtSizeTooltips[roadmap.tshirtSize];
      const wrap = document.createElement("span");
      wrap.className = "cell-tshirt-with-tooltip";
      wrap.setAttribute("aria-label", `T-shirt size: ${roadmap.tshirtSize}`);
      const textSpan = document.createElement("span");
      textSpan.className = "cell-meta cell-tshirt-size-text";
      textSpan.textContent = roadmap.tshirtSize;
      wrap.appendChild(textSpan);
      if (meta && (meta.tooltipTitle != null || meta.tooltipBody != null)) {
        const tooltipEl = document.createElement("div");
        tooltipEl.className = "cell-type-tooltip";
        tooltipEl.setAttribute("role", "tooltip");
        if (meta.tooltipTitle != null) {
          const titleEl = document.createElement("div");
          titleEl.className = "cell-type-tooltip-title";
          titleEl.textContent = meta.tooltipTitle;
          tooltipEl.appendChild(titleEl);
        }
        if (meta.tooltipBody != null) {
          const bodyEl = document.createElement("div");
          bodyEl.className = "cell-type-tooltip-body";
          const paragraphs = String(meta.tooltipBody).split(/\n\n+/);
          paragraphs.forEach((p) => {
            const block = document.createElement("p");
            block.textContent = p.trim();
            if (block.textContent) bodyEl.appendChild(block);
          });
          tooltipEl.appendChild(bodyEl);
        }
        wrap.appendChild(tooltipEl);
      }
      tdTshirtSize.appendChild(wrap);
    } else {
      tdTshirtSize.innerHTML = `<span class="cell-meta">—</span>`;
    }
    tr.appendChild(tdTshirtSize);

    const tdMoscow = document.createElement("td");
    tdMoscow.className = "cell-moscow";
    stampRoadmapsTableCol(tdMoscow, "moscow");
    const moscowSlug = moscowTablePillSlug(roadmap.moscowCategory);
    if (roadmap.moscowCategory && typeof moscowTooltips !== "undefined" && moscowTooltips[roadmap.moscowCategory]) {
      const meta = moscowTooltips[roadmap.moscowCategory];
      const wrap = document.createElement("span");
      wrap.className = "cell-moscow-with-tooltip";
      wrap.setAttribute("aria-label", `MOSCOW: ${roadmap.moscowCategory}`);
      const textSpan = document.createElement("span");
      textSpan.className = `cell-meta cell-moscow-text moscow-pill moscow-pill--${moscowSlug}`;
      textSpan.textContent = moscowTableShortLabel(roadmap.moscowCategory);
      wrap.appendChild(textSpan);
      if (meta.tooltipTitle != null || meta.tooltipBody != null) {
        const tooltipEl = document.createElement("div");
        tooltipEl.className = "cell-type-tooltip";
        tooltipEl.setAttribute("role", "tooltip");
        if (meta.tooltipTitle != null) {
          const titleEl = document.createElement("div");
          titleEl.className = "cell-type-tooltip-title";
          titleEl.textContent = meta.tooltipTitle;
          tooltipEl.appendChild(titleEl);
        }
        if (meta.tooltipBody != null) {
          const bodyEl = document.createElement("div");
          bodyEl.className = "cell-type-tooltip-body";
          const paragraphs = String(meta.tooltipBody).split(/\n\n+/);
          paragraphs.forEach((p) => {
            const block = document.createElement("p");
            block.textContent = p.trim();
            if (block.textContent) bodyEl.appendChild(block);
          });
          tooltipEl.appendChild(bodyEl);
        }
        wrap.appendChild(tooltipEl);
      }
      tdMoscow.appendChild(wrap);
    } else if (roadmap.moscowCategory) {
      const pill = document.createElement("span");
      pill.className = `cell-meta moscow-pill moscow-pill--${moscowSlug}`;
      pill.textContent = moscowTableShortLabel(roadmap.moscowCategory);
      tdMoscow.appendChild(pill);
    } else {
      const empty = document.createElement("span");
      empty.className = "cell-meta moscow-pill moscow-pill--unset";
      empty.textContent = "—";
      tdMoscow.appendChild(empty);
    }
    tr.appendChild(tdMoscow);

    const tdRice = document.createElement("td");
    const riceScore = calculateRiceScore(roadmap);
    tdRice.className = "cell-rice";
    stampRoadmapsTableCol(tdRice, "rice");

    const reachVal = roadmap.reachValue != null ? String(roadmap.reachValue) : "—";
    const impactVal = roadmap.impactValue != null ? String(roadmap.impactValue) : "—";
    const confidenceVal = roadmap.confidenceValue != null ? String(roadmap.confidenceValue) : "—";
    const effortVal = roadmap.effortValue != null ? String(roadmap.effortValue) : "—";
    const reachNum = Number(roadmap.reachValue);
    const impactNum = Number(roadmap.impactValue);
    const confidenceNum = Number(roadmap.confidenceValue);
    const effortNum = Number(roadmap.effortValue);
    const confidenceDecimal = Number.isFinite(confidenceNum) ? confidenceNum / 100 : null;
    const formulaLine =
      Number.isFinite(reachNum) &&
      Number.isFinite(impactNum) &&
      Number.isFinite(confidenceDecimal) &&
      Number.isFinite(effortNum) &&
      effortNum > 0
        ? `[${reachNum} × ${impactNum} × ${confidenceDecimal.toFixed(2)}] ÷ ${effortNum} = ${formatRice(riceScore)}`
        : "Not enough inputs to compute full formula.";

    const riceWrapper = document.createElement("div");
    riceWrapper.className = "rice-score-wrapper";

    const riceTooltipWrap = document.createElement("span");
    riceTooltipWrap.className = "cell-rice-with-tooltip";
    riceTooltipWrap.setAttribute(
      "aria-label",
      `RICE details: Reach ${reachVal}, Impact ${impactVal}, Confidence ${confidenceVal !== "—" ? confidenceVal + "%" : "—"}, Effort ${effortVal}. Formula: [Reach × Impact × Confidence] ÷ Effort.`
    );
    const scoreSpan = document.createElement("span");
    scoreSpan.textContent = formatRice(riceScore);
    riceTooltipWrap.appendChild(scoreSpan);

    const riceTooltip = document.createElement("div");
    riceTooltip.className = "cell-type-tooltip";
    riceTooltip.setAttribute("role", "tooltip");
    const riceTooltipTitle = document.createElement("div");
    riceTooltipTitle.className = "cell-type-tooltip-title";
    riceTooltipTitle.textContent = "RICE score details";
    riceTooltip.appendChild(riceTooltipTitle);
    const riceTooltipBody = document.createElement("div");
    riceTooltipBody.className = "cell-type-tooltip-body";
    const formula = document.createElement("p");
    formula.textContent = "Formula: [Reach × Impact × Confidence] ÷ Effort";
    riceTooltipBody.appendChild(formula);
    [
      `R (Reach) - ${reachVal}`,
      `I (Impact) - ${impactVal}`,
      `C (Confidence) - ${confidenceVal !== "—" ? confidenceVal + "%" : "—"}${Number.isFinite(confidenceDecimal) ? ` (${confidenceDecimal.toFixed(2)})` : ""}`,
      `E (Effort) - ${effortVal}`,
      `Calculation - ${formulaLine}`
    ].forEach((line) => {
      const p = document.createElement("p");
      p.textContent = line;
      riceTooltipBody.appendChild(p);
    });
    riceTooltip.appendChild(riceTooltipBody);
    riceTooltipWrap.appendChild(riceTooltip);
    riceWrapper.appendChild(riceTooltipWrap);

    tdRice.appendChild(riceWrapper);
    tr.appendChild(tdRice);

    const tdFinancial = document.createElement("td");
    stampRoadmapsTableCol(tdFinancial, "financial");
    if (roadmap.financialImpactValue != null && roadmap.financialImpactValue !== "") {
      const raw = roadmap.financialImpactValue;
      const amount = Number.isFinite(raw) ? raw : (typeof raw === "string" ? parseFloat(raw) : 0);
      const currency = (roadmap.financialImpactCurrency || "EUR").toString().trim().toUpperCase() || "EUR";
      const amountEur = typeof ExchangeRates !== "undefined" && typeof ExchangeRates.convertToEUR === "function" ? ExchangeRates.convertToEUR(amount, currency) : amount;
      const hasEurRate = typeof ExchangeRates !== "undefined" && typeof ExchangeRates.hasRate === "function" ? ExchangeRates.hasRate(currency) : true;
      const shortOriginal = typeof formatFinancialShort === "function"
        ? formatFinancialShort(amount)
        : String(Number(amount).toLocaleString(undefined, { maximumFractionDigits: 2 }));

      const wrap = document.createElement("span");
      wrap.className = "cell-financial-with-tooltip";
      const textSpan = document.createElement("span");
      textSpan.className = "cell-meta cell-financial-text";
      if (hasEurRate && Number.isFinite(amountEur)) {
        const shortEur = typeof formatFinancialShort === "function"
          ? formatFinancialShort(amountEur)
          : String(Number(amountEur).toLocaleString(undefined, { maximumFractionDigits: 2 }));
        wrap.setAttribute("aria-label", `Financial impact: €${shortEur} (original: ${shortOriginal} ${currency})`);
        textSpan.innerHTML = `<strong>€${escapeHtml(shortEur)}</strong>`;
      } else {
        wrap.setAttribute("aria-label", `Financial impact: ${shortOriginal} ${currency} (EUR rate unavailable)`);
        textSpan.innerHTML = `<strong>${escapeHtml(shortOriginal)} ${currency}</strong>`;
      }
      wrap.appendChild(textSpan);

      const tooltipEl = document.createElement("div");
      tooltipEl.className = "cell-type-tooltip";
      tooltipEl.setAttribute("role", "tooltip");
      const titleEl = document.createElement("div");
      titleEl.className = "cell-type-tooltip-title";
      titleEl.textContent = "Original financial impact";
      tooltipEl.appendChild(titleEl);
      const bodyEl = document.createElement("div");
      bodyEl.className = "cell-type-tooltip-body";
      const p = document.createElement("p");
      p.textContent = hasEurRate && Number.isFinite(amountEur)
        ? `${shortOriginal} ${currency}`
        : `${shortOriginal} ${currency} (EUR rate unavailable)`;
      bodyEl.appendChild(p);
      tooltipEl.appendChild(bodyEl);
      wrap.appendChild(tooltipEl);

      tdFinancial.appendChild(wrap);
    } else {
      tdFinancial.innerHTML = `<span class="cell-meta">—</span>`;
    }
    tr.appendChild(tdFinancial);

    const tdCreated = document.createElement("td");
    stampRoadmapsTableCol(tdCreated, "created");
    const createdWrap = document.createElement("span");
    createdWrap.className = "cell-date-with-tooltip";
    createdWrap.setAttribute("aria-label", "Created date; hover for last modified");
    const createdText = document.createElement("span");
    createdText.className = "cell-meta cell-created-date-text";
    createdText.textContent = formatDateTime(roadmap.createdAt);
    createdWrap.appendChild(createdText);
    const modifiedTooltip = document.createElement("div");
    modifiedTooltip.className = "cell-type-tooltip";
    modifiedTooltip.setAttribute("role", "tooltip");
    const modifiedTitle = document.createElement("div");
    modifiedTitle.className = "cell-type-tooltip-title";
    modifiedTitle.textContent = "Modified";
    modifiedTooltip.appendChild(modifiedTitle);
    const modifiedBody = document.createElement("div");
    modifiedBody.className = "cell-type-tooltip-body";
    const modifiedP = document.createElement("p");
    modifiedP.textContent = formatDateTime(roadmap.modifiedAt || roadmap.createdAt);
    modifiedBody.appendChild(modifiedP);
    modifiedTooltip.appendChild(modifiedBody);
    createdWrap.appendChild(modifiedTooltip);
    tdCreated.appendChild(createdWrap);
    tr.appendChild(tdCreated);

    const tdActions = document.createElement("td");
    tdActions.className = "cell-actions-cell";
    stampRoadmapsTableCol(tdActions, "actions");

    const actionsWrap = document.createElement("div");
    actionsWrap.className = "cell-actions cell-actions--roadmap roadmap-row-actions";

    const viewBtn = document.createElement("button");
    viewBtn.type = "button";
    viewBtn.setAttribute("data-id", roadmap.id);
    setRoadmapTableActionButton(viewBtn, "view", "View");

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.setAttribute("data-id", roadmap.id);
    setRoadmapTableActionButton(editBtn, "edit", "Edit", { disabled: demoReadOnly });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.setAttribute("data-id", roadmap.id);
    setRoadmapTableActionButton(deleteBtn, "delete", "Delete", { disabled: demoReadOnly });

    actionsWrap.appendChild(viewBtn);
    actionsWrap.appendChild(editBtn);
    actionsWrap.appendChild(deleteBtn);
    tdActions.appendChild(actionsWrap);
    tr.appendChild(tdActions);

    rows.appendChild(tr);
  });

  elements.roadmapsTableBody.appendChild(rows);
  syncHeaderCheckbox();
  updateBulkSelectionActions();
  updateSortIndicators();
  if (state.roadmapsView === "table" && roadmaps.some((p) => p.financialImpactValue != null && p.financialImpactValue !== "")) {
    if (Object.keys(state.exchangeRatesToEUR || {}).length === 0) {
      ExchangeRates.ensure().then(() => renderRoadmaps()).catch(() => {});
    }
  }
  renderNonTableRoadmapsView();
}

function switchRoadmapsView(view) {
  closePortfolioViewTabsMenu();
  hideCellTypeTooltips();
  state.roadmapsView = view;
  saveState();
  if (!elements.roadmapsTableView || !elements.roadmapsBoardView) return;

  const showTable = view === "table";
  const showBoard = view === "board";
  const showMoscow = view === "moscow";
  const showMap = view === "map";
  const showRaci = view === "raci";
  const showKano = view === "kano";

  elements.roadmapsTableView.style.display = showTable ? "" : "none";
  elements.roadmapsBoardView.style.display = showBoard ? "flex" : "none";
  elements.roadmapsBoardView.setAttribute("aria-hidden", String(!showBoard));
  if (elements.roadmapsMoscowView) {
    elements.roadmapsMoscowView.style.display = showMoscow ? "flex" : "none";
    elements.roadmapsMoscowView.setAttribute("aria-hidden", String(!showMoscow));
  }
  if (elements.roadmapsMapView) {
    elements.roadmapsMapView.style.display = showMap ? "flex" : "none";
    elements.roadmapsMapView.setAttribute("aria-hidden", String(!showMap));
  }
  if (elements.roadmapsRaciView) {
    elements.roadmapsRaciView.style.display = showRaci ? "flex" : "none";
    elements.roadmapsRaciView.setAttribute("aria-hidden", String(!showRaci));
  }
  if (elements.roadmapsKanoView) {
    elements.roadmapsKanoView.style.display = showKano ? "flex" : "none";
    elements.roadmapsKanoView.setAttribute("aria-hidden", String(!showKano));
  }

  if (!showTable) {
    clearRoadmapSelection();
  }

  if (typeof Fullscreen !== "undefined" && !Fullscreen.isViewFullscreen()) {
    if (typeof Fullscreen.restoreWorkspaceChrome === "function") {
      Fullscreen.restoreWorkspaceChrome();
    }
  }

  syncPortfolioViewTabState(view);
  scrollActivePortfolioViewTabIntoView();
  blurPortfolioViewTabs();
  renderRoadmaps();
  updateBulkSelectionActions();
  if (showMap) {
    requestAnimationFrame(() => {
      if (state.roadmapsView !== "map" || !elements.roadmapsMapContainer) return;
      invalidateMapSizeAfterFullscreenExit();
    });
  }
  syncMoscowCompactNav();
}

/** Returns a map of ISO 2-letter country code -> number of roadmaps that target that country (active profile, filtered). */
function getRoadmapCountByCountryCode() {
  const baseRoadmaps = getPortfolioRoadmapsBaseList();
  if (!baseRoadmaps.length) return {};
  initFilterRoadmapPeriodOptions(baseRoadmaps);
  const roadmaps = applyFilters(baseRoadmaps);
  const countByCode = {};
  roadmaps.forEach((p) => {
    const countries = Array.isArray(p.countries) ? p.countries : [];
    countries.forEach((name) => {
      const code = typeof countryCodeByName !== "undefined" ? countryCodeByName[name] : null;
      if (code) {
        countByCode[code] = (countByCode[code] || 0) + 1;
      }
    });
  });
  return countByCode;
}

/** ISO 2-letter country code -> filtered roadmaps (super admin map tooltips). */
function getFilteredRoadmapsGroupedByCountryCode() {
  const baseRoadmaps = getPortfolioRoadmapsBaseList();
  if (!baseRoadmaps.length) return {};
  initFilterRoadmapPeriodOptions(baseRoadmaps);
  const roadmaps = applyFilters(baseRoadmaps);
  const byCode = {};
  roadmaps.forEach((p) => {
    const countries = Array.isArray(p.countries) ? p.countries : [];
    countries.forEach((name) => {
      const code = typeof countryCodeByName !== "undefined" ? countryCodeByName[name] : null;
      if (!code) return;
      if (!byCode[code]) byCode[code] = [];
      byCode[code].push(p);
    });
  });
  return byCode;
}

/** Returns a map of ISO 2-letter country code -> sum of RICE scores for roadmaps that target that country (active profile, filtered). */
function getCountryRiceByCode() {
  const baseRoadmaps = getPortfolioRoadmapsBaseList();
  if (!baseRoadmaps.length) return {};
  baseRoadmaps.forEach((p) => {
    p.riceScore = typeof calculateRiceScore === "function" ? calculateRiceScore(p) : 0;
  });
  initFilterRoadmapPeriodOptions(baseRoadmaps);
  const roadmaps = applyFilters(baseRoadmaps);
  const riceByCode = {};
  roadmaps.forEach((p) => {
    const countries = Array.isArray(p.countries) ? p.countries : [];
    const score = Number.isFinite(p.riceScore) ? p.riceScore : 0;
    countries.forEach((name) => {
      const code = typeof countryCodeByName !== "undefined" ? countryCodeByName[name] : null;
      if (code) {
        riceByCode[code] = (riceByCode[code] || 0) + score;
      }
    });
  });
  return riceByCode;
}

/** Returns a map of ISO 2-letter country code -> total financial impact in EUR (active profile, filtered). All amounts are converted to EUR using the latest exchange rates from the API; amounts in currencies without a rate are excluded. */
function getCountryFinancialImpactByCode() {
  const baseRoadmaps = getPortfolioRoadmapsBaseList();
  if (!baseRoadmaps.length) return {};
  initFilterRoadmapPeriodOptions(baseRoadmaps);
  const roadmaps = applyFilters(baseRoadmaps);
  const impactByCode = {};
  roadmaps.forEach((p) => {
    const raw = p.financialImpactValue;
    const amount = Number.isFinite(raw) ? raw : (typeof raw === "string" ? parseFloat(raw) : 0);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const currency = (p.financialImpactCurrency || "EUR").toString().trim().toUpperCase() || "EUR";
    const amountEUR = ExchangeRates.convertToEUR(amount, currency);
    if (!Number.isFinite(amountEUR)) return;
    const countries = Array.isArray(p.countries) ? p.countries : [];
    countries.forEach((name) => {
      const code = typeof countryCodeByName !== "undefined" ? countryCodeByName[name] : null;
      if (code) impactByCode[code] = (impactByCode[code] || 0) + amountEUR;
    });
  });
  return impactByCode;
}

/** ISO code -> mean RICE score among roadmaps targeting that country (filtered, active profile). */
function getCountryAverageRiceByCode() {
  const riceByCode = getCountryRiceByCode();
  const countByCode = getRoadmapCountByCountryCode();
  const avgByCode = {};
  Object.keys(countByCode).forEach((code) => {
    const count = countByCode[code] || 0;
    if (count > 0) avgByCode[code] = (riceByCode[code] || 0) / count;
  });
  return avgByCode;
}

/** ISO code -> mean financial impact in EUR among roadmaps targeting that country (filtered, active profile). */
function getCountryAverageFinancialImpactByCode() {
  const totalByCode = getCountryFinancialImpactByCode();
  const countByCode = getRoadmapCountByCountryCode();
  const avgByCode = {};
  Object.keys(countByCode).forEach((code) => {
    const count = countByCode[code] || 0;
    if (count > 0) avgByCode[code] = (totalByCode[code] || 0) / count;
  });
  return avgByCode;
}

function isValidMapMetric(metric) {
  return MAP_METRIC_OPTIONS.some((opt) => opt.id === metric);
}

function mapMetricUsesExchangeRates(metric) {
  return metric === "financial" || metric === "financialAvg";
}

function getMapMetricValuesByCode(metric) {
  const current = isValidMapMetric(metric) ? metric : "roadmaps";
  if (current === "rice") return getCountryRiceByCode();
  if (current === "riceAvg") return getCountryAverageRiceByCode();
  if (current === "financial") return getCountryFinancialImpactByCode();
  if (current === "financialAvg") return getCountryAverageFinancialImpactByCode();
  return getRoadmapCountByCountryCode();
}

function getWeightedMapMetricAverage(valueByCode, countByCode) {
  let weightedSum = 0;
  let totalLinks = 0;
  Object.keys(valueByCode).forEach((code) => {
    const count = countByCode[code] || 0;
    if (count <= 0) return;
    weightedSum += valueByCode[code] * count;
    totalLinks += count;
  });
  return totalLinks > 0 ? weightedSum / totalLinks : 0;
}

const ROADMAPS_MAP_GEOJSON_URL = "https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_110m_admin_0_countries.geojson";

let roadmapsMapLeafletRetryTimer = null;

function isLeafletMapLibraryReady() {
  return typeof L !== "undefined" && L && typeof L.map === "function";
}

/** Tear down Leaflet instance and clear the map host (avoids stale _leafletMap after innerHTML swaps). */
function destroyRoadmapsMapInstance() {
  if (!elements.roadmapsMapContainer) return;
  closeAllMapCountryTooltips();
  const host = elements.roadmapsMapContainer;
  if (host._leafletMap) {
    try {
      host._leafletMap.remove();
    } catch (err) {
      console.warn("Could not remove Leaflet map instance", err);
    }
    host._leafletMap = null;
  }
  host._geoLayer = null;
  host._mapCountryTooltipListenersBound = false;
  mapCountrySharedTooltip = null;
}

function setRoadmapsMapEmptyMessage(message) {
  if (!elements.roadmapsMapContainer) return;
  destroyRoadmapsMapInstance();
  const safe =
    typeof escapeHtml === "function" ? escapeHtml(message) : String(message || "");
  elements.roadmapsMapContainer.innerHTML = `<div class="roadmaps-map-empty">${safe}</div>`;
}

function scheduleRenderRoadmapsMapWhenLeafletReady() {
  if (roadmapsMapLeafletRetryTimer) return;
  roadmapsMapLeafletRetryTimer = setTimeout(() => {
    roadmapsMapLeafletRetryTimer = null;
    if (state.roadmapsView === "map" && elements.roadmapsMapContainer) {
      renderRoadmapsMap();
    }
  }, 300);
}

/** Compact stat line for map country tooltips (value + short unit; optional footnote). */
function getMapCountryTooltipMetricBlock(metric, value, count, options = {}) {
  const { hasProfileBreakdown = false } = options;
  const hasData = count > 0;

  if (!hasData) {
    return {
      valueText: "—",
      unit: "No data for current filters",
      footnote: "",
      empty: true
    };
  }

  const roadmapNote = hasProfileBreakdown
    ? ""
    : count === 1
      ? "1 assignment in this country"
      : `${count} assignments in this country`;

  if (metric === "rice") {
    const riceText = typeof formatRice === "function" ? formatRice(value) : String(value);
    return {
      valueText: riceText,
      unit: "total RICE",
      footnote: hasProfileBreakdown ? "" : roadmapNote,
      empty: false
    };
  }
  if (metric === "riceAvg") {
    const riceText = typeof formatRice === "function" ? formatRice(value) : String(value);
    return {
      valueText: riceText,
      unit: "avg RICE",
      footnote: hasProfileBreakdown ? "" : roadmapNote,
      empty: false
    };
  }
  if (metric === "financial") {
    const eur =
      typeof formatEurForMapTooltip === "function" ? formatEurForMapTooltip(value) : `€${value}`;
    return {
      valueText: eur,
      unit: "total impact",
      footnote: hasProfileBreakdown ? "" : roadmapNote,
      empty: false
    };
  }
  if (metric === "financialAvg") {
    const eur =
      typeof formatEurForMapTooltip === "function" ? formatEurForMapTooltip(value) : `€${value}`;
    return {
      valueText: eur,
      unit: "avg impact",
      footnote: hasProfileBreakdown ? "" : roadmapNote,
      empty: false
    };
  }

  return {
    valueText: String(count),
    unit: count === 1 ? "roadmap" : "roadmaps",
    footnote: hasProfileBreakdown ? "" : roadmapNote,
    empty: false
  };
}

function formatEurForMapTooltip(num) {
  const short =
    typeof formatFinancialShort === "function"
      ? formatFinancialShort(Number(num))
      : Number(num).toLocaleString(undefined, { maximumFractionDigits: 0 });
  return `€${short}`;
}

/** Resolve ISO code + filtered counts for a map country layer. */
function getMapCountryStatsForLayer(layer, countByCode, valueByCode) {
  const meta = layer && layer._mapCountryTooltipMeta ? layer._mapCountryTooltipMeta : {};
  let code = "";
  if (layer && layer.feature) {
    code = getCountryCodeFromFeature(layer.feature);
  }
  if (!code && meta.countryCode) code = meta.countryCode;
  if (!code && meta.countryName && typeof countryCodeByName !== "undefined") {
    code = countryCodeByName[meta.countryName] || countryCodeByName[getCanonicalCountryName(meta.countryName)] || "";
  }

  let count = code ? countByCode[code] || 0 : 0;
  let value = code ? valueByCode[code] || 0 : 0;
  return { code, count, value };
}

const MAP_COUNTRY_PROFILE_BREAKDOWN_MAX = 10;

/** Per-profile metric for one country (workspace-wide mode only; see GUARDRAILS §7). */
function getMapCountryProfileBreakdown(countryCode, metric, roadmapsInCountry) {
  if (!countryCode || !Array.isArray(roadmapsInCountry) || !roadmapsInCountry.length) {
    return [];
  }

  const byProfile = new Map();
  roadmapsInCountry.forEach((p) => {
    const profileId = (p.ownerProfileId || p.ownerProfileName || "unknown").toString();
    const profileName = (p.ownerProfileName || "Unnamed profile").trim() || "Unnamed profile";
    if (!byProfile.has(profileId)) {
      byProfile.set(profileId, {
        profileId,
        profileName,
        linkCount: 0,
        riceSum: 0,
        finSum: 0
      });
    }
    const row = byProfile.get(profileId);
    row.linkCount += 1;

    const riceScoreVal =
      p.riceScore != null
        ? p.riceScore
        : typeof calculateRiceScore === "function"
          ? calculateRiceScore(p)
          : 0;
    if (Number.isFinite(riceScoreVal)) row.riceSum += riceScoreVal;

    const raw = p.financialImpactValue;
    const amount = Number.isFinite(raw) ? raw : typeof raw === "string" ? parseFloat(raw) : NaN;
    if (Number.isFinite(amount) && amount > 0) {
      const currency = (p.financialImpactCurrency || "EUR").toString().trim().toUpperCase() || "EUR";
      const amountEUR =
        typeof ExchangeRates !== "undefined" && typeof ExchangeRates.convertToEUR === "function"
          ? ExchangeRates.convertToEUR(amount, currency)
          : currency === "EUR"
            ? amount
            : NaN;
      if (Number.isFinite(amountEUR)) row.finSum += amountEUR;
    }
  });

  const metricKey = isValidMapMetric(metric) ? metric : "roadmaps";

  return Array.from(byProfile.values())
    .map((row) => {
      let displayValue = "—";
      let sortValue = 0;

      if (metricKey === "rice") {
        displayValue = typeof formatRice === "function" ? formatRice(row.riceSum) : String(row.riceSum);
        sortValue = row.riceSum;
      } else if (metricKey === "riceAvg") {
        const avg = row.linkCount > 0 ? row.riceSum / row.linkCount : 0;
        displayValue = typeof formatRice === "function" ? formatRice(avg) : String(avg);
        sortValue = avg;
      } else if (metricKey === "financial") {
        displayValue = formatEurForMapTooltip(row.finSum);
        sortValue = row.finSum;
      } else if (metricKey === "financialAvg") {
        const avg = row.linkCount > 0 ? row.finSum / row.linkCount : 0;
        displayValue = formatEurForMapTooltip(avg);
        sortValue = avg;
      } else {
        displayValue = String(row.linkCount);
        sortValue = row.linkCount;
      }

      return {
        profileName: row.profileName,
        displayValue,
        sortValue,
        linkCount: row.linkCount
      };
    })
    .filter((row) => metricKey === "roadmaps" || row.sortValue > 0 || row.linkCount > 0)
    .sort((a, b) => b.sortValue - a.sortValue);
}

function getMapCountryProfileInitials(profileName) {
  const parts = String(profileName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }
  const single = parts[0] || "?";
  return single.slice(0, 2).toUpperCase();
}

function buildMapCountryProfileBreakdownHtml(breakdownRows, metric) {
  if (!breakdownRows || !breakdownRows.length) return "";
  const esc = typeof escapeHtml === "function" ? escapeHtml : (s) => String(s || "");
  const metricOption = getMapMetricOption(metric);
  const metricShort = metricOption ? metricOption.short : "";

  const visible = breakdownRows.slice(0, MAP_COUNTRY_PROFILE_BREAKDOWN_MAX);
  const moreCount = breakdownRows.length - visible.length;
  const maxSort = visible.reduce((max, row) => Math.max(max, row.sortValue || 0), 0) || 1;

  const rowsHtml = visible
    .map((row) => {
      const sharePct = Math.max(4, Math.round(((row.sortValue || 0) / maxSort) * 100));
      const initials = getMapCountryProfileInitials(row.profileName);
      return `<li class="map-country-tooltip__profile-row">
      <span class="map-country-tooltip__profile-avatar" aria-hidden="true">${esc(initials)}</span>
      <div class="map-country-tooltip__profile-body">
        <div class="map-country-tooltip__profile-top">
          <span class="map-country-tooltip__profile-name" title="${esc(row.profileName)}">${esc(row.profileName)}</span>
          <span class="map-country-tooltip__profile-value">${esc(row.displayValue)}</span>
        </div>
        <div class="map-country-tooltip__profile-bar" aria-hidden="true">
          <span class="map-country-tooltip__profile-bar-fill" style="width:${sharePct}%"></span>
        </div>
      </div>
    </li>`;
    })
    .join("");

  const metricHint = metricShort
    ? `<span class="map-country-tooltip__profiles-metric">${esc(metricShort)}</span>`
    : "";

  return `<section class="map-country-tooltip__profiles" aria-label="Profile breakdown">
    <div class="map-country-tooltip__profiles-head">
      <span class="map-country-tooltip__profiles-title">Profiles</span>
      ${metricHint}
      <span class="map-country-tooltip__profiles-count">${visible.length}</span>
    </div>
    <ul class="map-country-tooltip__profile-rows" role="list">${rowsHtml}</ul>
    ${
      moreCount > 0
        ? `<p class="map-country-tooltip__more">+${moreCount} more profile${moreCount !== 1 ? "s" : ""}</p>`
        : ""
    }
  </section>`;
}

/** Map hover tooltip: country + aggregated value for the toolbar metric. */
function buildMapCountryTooltipHtml(options) {
  const esc = typeof escapeHtml === "function" ? escapeHtml : (s) => String(s || "");
  const { countryName, countryCode, flag, count, value, metric, profileBreakdown } = options;

  const code2 =
    countryCode && typeof countryCodeToTwoLetter === "function"
      ? countryCodeToTwoLetter(countryCode) || countryCode
      : countryCode || "";
  const hasProfiles = Boolean(profileBreakdown);
  const metricBlock = getMapCountryTooltipMetricBlock(metric, value, count, {
    hasProfileBreakdown: hasProfiles
  });

  const footnoteHtml = metricBlock.footnote
    ? `<p class="map-country-tooltip__footnote">${esc(metricBlock.footnote)}</p>`
    : "";

  const tooltipMod = hasProfiles ? " map-country-tooltip--with-profiles" : "";

  return `<div class="map-country-tooltip map-country-tooltip--hover${tooltipMod}" role="tooltip">
    <header class="map-country-tooltip__head">
      <span class="map-country-tooltip__flag" aria-hidden="true">${flag ? esc(flag) : "🌍"}</span>
      <div class="map-country-tooltip__head-copy">
        <span class="map-country-tooltip__country">${esc(countryName || "Unknown")}</span>
        ${code2 ? `<span class="map-country-tooltip__code">${esc(code2)}</span>` : ""}
      </div>
    </header>
    <div class="map-country-tooltip__stat${metricBlock.empty ? " map-country-tooltip__stat--empty" : ""}">
      <span class="map-country-tooltip__stat-value">${esc(metricBlock.valueText)}</span>
      <span class="map-country-tooltip__stat-unit">${esc(metricBlock.unit)}</span>
    </div>
    ${footnoteHtml}
    ${profileBreakdown || ""}
  </div>`;
}

function buildMapCountryTooltipHtmlForLayer(layer) {
  const host = elements.roadmapsMapContainer;
  const data = host && host._mapCountryLayerData;
  const meta = layer && layer._mapCountryTooltipMeta;
  if (!data || !meta) return "";

  const stats = getMapCountryStatsForLayer(layer, data.countByCode, data.valueByCode);
  const countryCode = stats.code || meta.countryCode;

  let profileBreakdown = "";
  if (data.showProfileBreakdown && countryCode && data.roadmapsByCountryCode) {
    const roadmapsInCountry = data.roadmapsByCountryCode[countryCode] || [];
    const breakdownRows = getMapCountryProfileBreakdown(countryCode, data.metric, roadmapsInCountry);
    profileBreakdown = buildMapCountryProfileBreakdownHtml(breakdownRows, data.metric);
  }

  return buildMapCountryTooltipHtml({
    countryName: meta.countryName,
    countryCode,
    flag: meta.flag,
    count: stats.count,
    value: stats.value,
    metric: data.metric,
    profileBreakdown
  });
}

let activeMapCountryTooltipLayer = null;
let activeMapCountryHoverLayer = null;
let mapCountryTooltipCloseTimer = null;
let mapCountrySharedTooltip = null;

const MAP_COUNTRY_HOVER_STYLE = {
  weight: 2.5,
  color: "#a16207",
  fillOpacity: 0.92
};

function getMapGeoJsonLayer() {
  return elements.roadmapsMapContainer && elements.roadmapsMapContainer._geoLayer;
}

function getRoadmapsLeafletMap() {
  return elements.roadmapsMapContainer && elements.roadmapsMapContainer._leafletMap;
}

/** One shared Leaflet tooltip for all countries (prevents stacked per-layer tooltips). */
function ensureMapCountrySharedTooltip() {
  if (mapCountrySharedTooltip || typeof L === "undefined" || !L.tooltip) return mapCountrySharedTooltip;
  mapCountrySharedTooltip = L.tooltip({
    permanent: false,
    sticky: false,
    opacity: 1,
    direction: "top",
    className: "map-country-tooltip-host map-country-tooltip-host--passthrough",
    interactive: false
  });
  return mapCountrySharedTooltip;
}

const MAP_COUNTRY_TOOLTIP_VIEWPORT_PAD_PX = 12;

/** Rough tooltip height so we can pick top vs bottom before paint. */
function estimateMapCountryTooltipHeightPx(hasProfileBreakdown, profileRowCount) {
  if (!hasProfileBreakdown) return 108;
  const rows = Math.min(profileRowCount || 3, MAP_COUNTRY_PROFILE_BREAKDOWN_MAX);
  return 132 + rows * 52 + (rows > 4 ? 8 : 0);
}

/** Shrink scrollable profile list when the tooltip would extend past the map bottom. */
function fitMapCountryTooltipProfileListInView(tip, map) {
  const el = tip && typeof tip.getElement === "function" ? tip.getElement() : null;
  const container = map && typeof map.getContainer === "function" ? map.getContainer() : null;
  const list = el && el.querySelector(".map-country-tooltip__profile-rows");
  if (!el || !container || !list) return;

  list.style.maxHeight = "";
  const pad = MAP_COUNTRY_TOOLTIP_VIEWPORT_PAD_PX;
  const cr = container.getBoundingClientRect();
  let tr = el.getBoundingClientRect();
  let overflow = tr.bottom - (cr.bottom - pad);

  if (overflow <= 0) return;

  const listRect = list.getBoundingClientRect();
  const minList = 56;
  const nextMax = Math.max(minList, listRect.height - overflow);
  list.style.maxHeight = `${Math.floor(nextMax)}px`;

  clampMapCountryTooltipInView(tip, map, 3);
}

/** Prefer opening below the anchor when there is not enough room above (avoids top clipping). */
function resolveMapCountryTooltipDirection(anchor, map, estimatedHeightPx) {
  if (!map || !anchor || typeof map.latLngToContainerPoint !== "function") return "top";
  const pt = map.latLngToContainerPoint(anchor);
  const size = map.getSize();
  if (!size) return "top";

  const pad = MAP_COUNTRY_TOOLTIP_VIEWPORT_PAD_PX;
  const h = Math.max(72, estimatedHeightPx || 108);
  const spaceAbove = pt.y;
  const spaceBelow = size.y - pt.y;

  if (spaceAbove < h + pad && spaceBelow >= h + pad) return "bottom";
  if (spaceBelow < h + pad && spaceAbove >= h + pad) return "top";
  if (spaceAbove < h + pad && spaceBelow < h + pad) {
    return spaceBelow >= spaceAbove ? "bottom" : "top";
  }
  return spaceAbove >= h + pad ? "top" : "bottom";
}

function resetMapCountryTooltipOffset(tip) {
  if (!tip) return;
  tip.options.offset = typeof L !== "undefined" ? L.point(0, 0) : { x: 0, y: 0 };
}

/** Apply screen-space nudge using Leaflet's direction-specific offset semantics. */
function nudgeMapCountryTooltipOffset(tip, shiftX, shiftY) {
  if (!tip || (shiftX === 0 && shiftY === 0)) return;
  const base = tip.options.offset || (typeof L !== "undefined" ? L.point(0, 0) : { x: 0, y: 0 });
  const dir = tip.options.direction || "top";
  let dx = base.x || 0;
  let dy = base.y || 0;

  if (dir === "top") {
    dx += shiftX;
    dy -= shiftY;
  } else if (dir === "bottom") {
    dx += shiftX;
    dy += shiftY;
  } else if (dir === "left") {
    dx -= shiftX;
    dy += shiftY;
  } else if (dir === "right") {
    dx += shiftX;
    dy += shiftY;
  }

  tip.options.offset = typeof L !== "undefined" ? L.point(dx, dy) : { x: dx, y: dy };
}

/** Nudge tooltip inside the map container after layout (container uses overflow: hidden). */
function clampMapCountryTooltipInView(tip, map, maxPasses = 5) {
  const el = tip && typeof tip.getElement === "function" ? tip.getElement() : null;
  const container = map && typeof map.getContainer === "function" ? map.getContainer() : null;
  if (!el || !container || typeof tip._updatePosition !== "function") return;

  const pad = MAP_COUNTRY_TOOLTIP_VIEWPORT_PAD_PX;
  const cr = container.getBoundingClientRect();

  for (let pass = 0; pass < maxPasses; pass++) {
    const tr = el.getBoundingClientRect();
    let shiftX = 0;
    let shiftY = 0;

    if (tr.top < cr.top + pad) {
      if (tip.options.direction !== "bottom") {
        tip.options.direction = "bottom";
        resetMapCountryTooltipOffset(tip);
        tip._updatePosition();
        continue;
      }
      shiftY = cr.top + pad - tr.top;
    } else if (tr.bottom > cr.bottom - pad) {
      if (tip.options.direction !== "top") {
        tip.options.direction = "top";
        resetMapCountryTooltipOffset(tip);
        tip._updatePosition();
        continue;
      }
      shiftY = cr.bottom - pad - tr.bottom;
    }

    if (tr.left < cr.left + pad) shiftX = cr.left + pad - tr.left;
    else if (tr.right > cr.right - pad) shiftX = cr.right - pad - tr.right;

    if (shiftX === 0 && shiftY === 0) return;

    nudgeMapCountryTooltipOffset(tip, shiftX, shiftY);
    tip._updatePosition();
  }
}

function scheduleClampMapCountryTooltipInView(tip, map) {
  if (!tip || !map) return;
  const run = () => {
    clampMapCountryTooltipInView(tip, map);
    fitMapCountryTooltipProfileListInView(tip, map);
  };
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => requestAnimationFrame(run));
  } else {
    setTimeout(run, 0);
  }
}

/** Close the map country tooltip (single-tooltip policy). */
function closeAllMapCountryTooltips() {
  if (mapCountryTooltipCloseTimer) {
    clearTimeout(mapCountryTooltipCloseTimer);
    mapCountryTooltipCloseTimer = null;
  }
  const geoLayer = getMapGeoJsonLayer();
  if (geoLayer && typeof geoLayer.eachLayer === "function") {
    geoLayer.eachLayer((l) => {
      if (typeof l.closeTooltip === "function") l.closeTooltip();
    });
  }
  if (mapCountrySharedTooltip) {
    if (mapCountrySharedTooltip.isOpen && mapCountrySharedTooltip.isOpen()) {
      mapCountrySharedTooltip.remove();
    }
    resetMapCountryTooltipOffset(mapCountrySharedTooltip);
    mapCountrySharedTooltip.options.direction = "top";
  }
  activeMapCountryTooltipLayer = null;
  clearMapCountryHoverHighlight();
}

/** Reliable anchor for country tooltips (cursor > Natural Earth label > valid bounds center). */
function getMapCountryTooltipLatLng(layer, eventLatLng, map) {
  if (
    eventLatLng &&
    Number.isFinite(eventLatLng.lat) &&
    Number.isFinite(eventLatLng.lng) &&
    Math.abs(eventLatLng.lat) <= 90
  ) {
    return eventLatLng;
  }

  const props = layer && layer.feature && layer.feature.properties;
  if (props) {
    const labelY = Number(props.LABEL_Y);
    const labelX = Number(props.LABEL_X);
    if (Number.isFinite(labelY) && Number.isFinite(labelX) && Math.abs(labelY) <= 90) {
      return L.latLng(labelY, labelX);
    }
  }

  if (layer && typeof layer.getBounds === "function") {
    const bounds = layer.getBounds();
    const valid = bounds && (typeof bounds.isValid !== "function" || bounds.isValid());
    if (valid && typeof bounds.getCenter === "function") {
      const center = bounds.getCenter();
      if (
        center &&
        Number.isFinite(center.lat) &&
        Number.isFinite(center.lng) &&
        Math.abs(center.lat) <= 90
      ) {
        return center;
      }
    }
  }

  return map && typeof map.getCenter === "function" ? map.getCenter() : L.latLng(20, 0);
}

function clearMapCountryHoverHighlight() {
  const geoLayer = getMapGeoJsonLayer();
  if (geoLayer && typeof geoLayer.resetStyle === "function") {
    geoLayer.resetStyle();
  }
  activeMapCountryHoverLayer = null;
}

function setMapCountryHoverHighlight(layer) {
  if (!layer || typeof layer.setStyle !== "function") return;
  clearMapCountryHoverHighlight();
  layer.setStyle(MAP_COUNTRY_HOVER_STYLE);
  activeMapCountryHoverLayer = layer;
}

function openMapCountryTooltip(layer, eventLatLng) {
  const map = getRoadmapsLeafletMap();
  if (!layer || !map) return;

  const html = buildMapCountryTooltipHtmlForLayer(layer);
  if (!html) return;

  const anchor = getMapCountryTooltipLatLng(layer, eventLatLng, map);
  const tip = ensureMapCountrySharedTooltip();
  if (!tip) return;

  if (mapCountrySharedTooltip && mapCountrySharedTooltip.isOpen && mapCountrySharedTooltip.isOpen()) {
    mapCountrySharedTooltip.remove();
  }

  const host = elements.roadmapsMapContainer;
  const layerData = host && host._mapCountryLayerData;
  const hasProfileBreakdown = Boolean(layerData && layerData.showProfileBreakdown);
  const estHeight = estimateMapCountryTooltipHeightPx(hasProfileBreakdown, 4);

  resetMapCountryTooltipOffset(tip);
  tip.options.direction = resolveMapCountryTooltipDirection(anchor, map, estHeight);

  tip.setContent(html);
  tip.setLatLng(anchor);
  tip.openOn(map);
  scheduleClampMapCountryTooltipInView(tip, map);
  activeMapCountryTooltipLayer = layer;
}

function scheduleCloseMapCountryTooltip(delayMs) {
  if (mapCountryTooltipCloseTimer) clearTimeout(mapCountryTooltipCloseTimer);
  mapCountryTooltipCloseTimer = setTimeout(() => {
    mapCountryTooltipCloseTimer = null;
    closeAllMapCountryTooltips();
    clearMapCountryHoverHighlight();
  }, typeof delayMs === "number" ? delayMs : 100);
}

/** Store country metadata on the layer; tooltip HTML is built on hover from live map data. */
function bindMapCountryLayerTooltip(layer, meta) {
  if (!layer) return;
  layer._mapCountryTooltipMeta = meta;
  if (typeof layer.unbindTooltip === "function") layer.unbindTooltip();
}

function attachMapCountryLayerHover(layer, geoLayer) {
  if (!layer || !layer.on || layer._mapCountryHoverBound) return;
  layer._mapCountryHoverBound = true;

  layer.on({
    mouseover: (e) => {
      if (mapCountryTooltipCloseTimer) {
        clearTimeout(mapCountryTooltipCloseTimer);
        mapCountryTooltipCloseTimer = null;
      }
      const target = e.target;
      setMapCountryHoverHighlight(target);
      openMapCountryTooltip(target, e.latlng);
    },
    mouseout: () => {
      scheduleCloseMapCountryTooltip(100);
    }
  });
}

function ensureMapCountryTooltipMapListeners(map) {
  if (!map || !elements.roadmapsMapContainer) return;
  const host = elements.roadmapsMapContainer;
  if (host._mapCountryTooltipListenersBound) return;
  host._mapCountryTooltipListenersBound = true;

  const onMapLeave = () => {
    closeAllMapCountryTooltips();
    clearMapCountryHoverHighlight();
  };

  map.on("click", onMapLeave);
  map.on("zoomstart", onMapLeave);
  map.on("movestart", onMapLeave);
  map.on("mouseout", onMapLeave);
}

/** Get 2-letter country code for a GeoJSON feature for matching to countByCode.
 *  Uses ISO_A2_EH (or ISO_A2 when not compound), POSTAL, ISO_A3, then name lookup.
 *  Normalizes compound codes like "CN-TW" (Natural Earth Taiwan) to "TW". */
function getCountryCodeFromFeature(feature) {
  if (!feature || !feature.properties) return "";
  const p = feature.properties;
  let code = (p.ISO_A2_EH || p.ISO_A2 || p.POSTAL || p.WB_A2 || p.FIPS_10 || p.iso_a2 || p.iso2 || "").toString().trim().toUpperCase();
  if (code && code !== "-99" && code !== "NULL") {
    if (code.length > 2 && code.includes("-")) {
      const suffix = code.split("-").find((part) => part.length === 2);
      if (suffix) code = suffix;
    }
    if (code.length === 2) return code;
  }
  const iso3 = (p.ISO_A3 || p.ISO_A3_EH || p.ADM0_A3 || p.iso_a3 || "").toString().trim().toUpperCase();
  if (iso3 && iso3 !== "-99" && typeof countryCodeToTwoLetter === "function") {
    const two = countryCodeToTwoLetter(iso3);
    if (two) return two;
  }
  const name = (p.NAME || p.ADMIN || p.NAME_LONG || p.SOVEREIGNT || "").toString().trim();
  if (!name) return "";
  const canonical = typeof getCanonicalCountryName === "function" ? getCanonicalCountryName(name) : name;
  if (typeof countryCodeByName !== "undefined" && countryCodeByName[canonical]) return countryCodeByName[canonical];
  if (typeof countryCodeByName !== "undefined" && countryCodeByName[name]) return countryCodeByName[name];
  const fromList = countryList && countryList.find((c) => c === canonical || c === name || name.indexOf(c) >= 0 || c.indexOf(name) >= 0);
  return (fromList && typeof countryCodeByName !== "undefined" && countryCodeByName[fromList]) ? countryCodeByName[fromList] : "";
}

function getCurrentMapMetric() {
  return isValidMapMetric(state.mapMetric) ? state.mapMetric : "roadmaps";
}

function getMapMetricOption(metricId) {
  return MAP_METRIC_OPTIONS.find((opt) => opt.id === metricId) || MAP_METRIC_OPTIONS[0];
}

function getMapMetricPickerQuery() {
  return (elements.mapMetricPickerSearch?.value || "").trim().toLowerCase();
}

function mapMetricOptionMatchesQuery(option, query) {
  if (!query) return true;
  const haystack = [
    option.label,
    option.short,
    option.description,
    ...(option.keywords || [])
  ].join(" ").toLowerCase();
  return haystack.includes(query);
}

function syncMapMetricPickerDisplay() {
  const option = getMapMetricOption(getCurrentMapMetric());
  if (elements.mapMetricPickerBadge) elements.mapMetricPickerBadge.textContent = option.short;
  if (elements.mapMetricPickerLabel) elements.mapMetricPickerLabel.textContent = option.label;
}

function setMapMetricPickerOpen(open) {
  const field = elements.mapMetricPicker?.querySelector(".map-metric-picker__field");
  const dropdown = elements.mapMetricPickerDropdown;
  const trigger = elements.mapMetricPickerTrigger;
  const search = elements.mapMetricPickerSearch;

  if (open) prepareAppOverlay("mapMetricPicker");

  mapMetricPickerOpen = !!open;
  if (field) field.classList.toggle("map-metric-picker__field--open", mapMetricPickerOpen);
  if (dropdown) dropdown.hidden = !mapMetricPickerOpen;
  if (trigger) trigger.setAttribute("aria-expanded", mapMetricPickerOpen ? "true" : "false");

  if (mapMetricPickerOpen) {
    if (search) search.value = "";
    mapMetricPickerHighlightIndex = -1;
    renderMapMetricPickerOptions();
    requestAnimationFrame(() => search?.focus());
  } else {
    mapMetricPickerHighlightIndex = -1;
    if (search) search.value = "";
    syncMapMetricPickerDisplay();
  }
}

function openMapMetricPickerDropdown() {
  setMapMetricPickerOpen(true);
}

function closeMapMetricPickerDropdown() {
  setMapMetricPickerOpen(false);
}

function renderMapMetricPickerOptions() {
  const listbox = elements.mapMetricPickerListbox;
  const empty = elements.mapMetricPickerEmpty;
  if (!listbox) return;

  const query = getMapMetricPickerQuery();
  const currentMetric = getCurrentMapMetric();
  const options = MAP_METRIC_OPTIONS.filter((opt) => mapMetricOptionMatchesQuery(opt, query));

  listbox.innerHTML = "";

  if (options.length === 0) {
    if (empty) empty.hidden = false;
    mapMetricPickerHighlightIndex = -1;
    return;
  }

  if (empty) empty.hidden = true;
  if (mapMetricPickerHighlightIndex >= options.length) {
    mapMetricPickerHighlightIndex = options.length - 1;
  }

  options.forEach((option, index) => {
    const isActive = option.id === currentMetric;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "map-metric-picker__option" +
      (isActive ? " map-metric-picker__option--active" : "") +
      (index === mapMetricPickerHighlightIndex ? " map-metric-picker__option--highlight" : "");
    btn.setAttribute("role", "option");
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
    btn.dataset.metric = option.id;

    const badge = document.createElement("span");
    badge.className = "map-metric-picker__option-badge";
    badge.textContent = option.short;
    badge.setAttribute("aria-hidden", "true");

    const copy = document.createElement("span");
    copy.className = "map-metric-picker__option-copy";

    const label = document.createElement("span");
    label.className = "map-metric-picker__option-label";
    label.textContent = option.label;

    const desc = document.createElement("span");
    desc.className = "map-metric-picker__option-desc";
    desc.textContent = option.description;

    copy.appendChild(label);
    copy.appendChild(desc);

    const check = document.createElement("span");
    check.className = "map-metric-picker__option-check";
    check.setAttribute("aria-hidden", "true");
    check.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

    btn.appendChild(badge);
    btn.appendChild(copy);
    btn.appendChild(check);

    btn.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      selectMapMetricFromPicker(option.id);
    });

    listbox.appendChild(btn);
  });
}

function selectMapMetricFromPicker(metricId) {
  mapMetricPickerPointerSelecting = true;
  mapMetricPickerHighlightIndex = -1;
  closeMapMetricPickerDropdown();
  setMapMetric(metricId);

  const trigger = elements.mapMetricPickerTrigger;
  if (trigger) trigger.focus();

  window.setTimeout(() => {
    mapMetricPickerPointerSelecting = false;
    syncMapMetricPickerDisplay();
  }, 0);
}

function syncMapMetricPickerUI() {
  syncMapMetricPickerDisplay();
  if (mapMetricPickerOpen) renderMapMetricPickerOptions();
}

function setMapMetric(metric) {
  if (!isValidMapMetric(metric)) return;
  if (state.mapMetric === metric) return;
  state.mapMetric = metric;
  saveState();
  syncMapMetricPickerUI();
  if (state.roadmapsView === "map" && elements.roadmapsMapContainer) renderRoadmapsMap();
}

function initMapMetricPicker() {
  const trigger = elements.mapMetricPickerTrigger;
  const search = elements.mapMetricPickerSearch;
  const field = elements.mapMetricPicker?.querySelector(".map-metric-picker__field");

  if (!trigger) return;
  syncMapMetricPickerUI();

  trigger.addEventListener("click", () => {
    if (mapMetricPickerOpen) {
      closeMapMetricPickerDropdown();
    } else {
      openMapMetricPickerDropdown();
    }
  });

  trigger.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!mapMetricPickerOpen) openMapMetricPickerDropdown();
    }
    if (e.key === "Escape" && mapMetricPickerOpen) {
      e.preventDefault();
      closeMapMetricPickerDropdown();
    }
  });

  if (search) {
    search.addEventListener("input", () => {
      mapMetricPickerHighlightIndex = -1;
      renderMapMetricPickerOptions();
    });

    search.addEventListener("keydown", (e) => {
      const options = Array.from(
        elements.mapMetricPickerListbox?.querySelectorAll(".map-metric-picker__option") || []
      );

      if (e.key === "Escape") {
        e.preventDefault();
        closeMapMetricPickerDropdown();
        trigger.focus();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (options.length === 0) return;
        mapMetricPickerHighlightIndex = Math.min(mapMetricPickerHighlightIndex + 1, options.length - 1);
        renderMapMetricPickerOptions();
        options[mapMetricPickerHighlightIndex]?.scrollIntoView({ block: "nearest" });
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (options.length === 0) return;
        mapMetricPickerHighlightIndex = Math.max(mapMetricPickerHighlightIndex - 1, 0);
        renderMapMetricPickerOptions();
        options[mapMetricPickerHighlightIndex]?.scrollIntoView({ block: "nearest" });
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        const highlighted = options[mapMetricPickerHighlightIndex];
        const targetMetric = highlighted?.dataset.metric || options[0]?.dataset.metric;
        if (targetMetric) selectMapMetricFromPicker(targetMetric);
      }
    });
  }

  document.addEventListener("pointerdown", (e) => {
    if (!mapMetricPickerOpen || !field) return;
    if (field.contains(e.target)) return;
    closeMapMetricPickerDropdown();
  });
}

function renderRoadmapsMap() {
  if (!elements.roadmapsMapContainer) return;

  if (!isLeafletMapLibraryReady()) {
    setRoadmapsMapEmptyMessage("Loading map library…");
    if (elements.roadmapsMapLegend) {
      elements.roadmapsMapLegend.textContent = "";
    }
    scheduleRenderRoadmapsMapWhenLeafletReady();
    return;
  }

  const activeProfile = getActiveProfile();
  const unlockedProfile = getUnlockedActiveProfile();

  if (elements.roadmapsMapLegend) {
    elements.roadmapsMapLegend.innerHTML = "";
    elements.roadmapsMapLegend.textContent = "Loading map…";
  }

  if (!activeProfile) {
    setRoadmapsMapEmptyMessage("Select a profile to see the map.");
    return;
  }

  if (!unlockedProfile) {
    setRoadmapsMapEmptyMessage("Unlock this profile to use the map view.");
    if (elements.roadmapsMapLegend) {
      elements.roadmapsMapLegend.textContent = "";
    }
    return;
  }

  syncMapMetricPickerUI();

  const countByCode = getRoadmapCountByCountryCode();
  const scopedRoadmaps = (() => {
    const base = getPortfolioRoadmapsBaseList();
    if (!base.length) return [];
    initFilterRoadmapPeriodOptions(base);
    return applyFilters(base);
  })();
  const uniqueRoadmapCount = scopedRoadmaps.length;

  function formatEur(num) {
    const short = typeof formatFinancialShort === "function" ? formatFinancialShort(Number(num)) : String(Number(num).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }));
    return "€" + short;
  }

  function renderMapWithValueByCode(valueByCode) {
    const values = Object.values(valueByCode);
    const maxValue = values.length ? Math.max(...values) : 0;
    const totalRoadmapHits = Object.values(countByCode).reduce((a, b) => a + b, 0);
    const numCountries = Object.keys(valueByCode).length;

    if (elements.roadmapsMapLegend) {
      const metric = getCurrentMapMetric();
      if (metric === "rice") {
        const totalRice = Object.values(valueByCode).reduce((a, b) => a + b, 0);
        elements.roadmapsMapLegend.textContent = totalRice > 0
          ? `RICE score per country (sum) — total RICE ${typeof formatRice === "function" ? formatRice(totalRice) : totalRice} across ${numCountries} countr${numCountries !== 1 ? "ies" : "y"}`
          : "RICE score per country. Add countries to roadmaps to see RICE on the map.";
      } else if (metric === "riceAvg") {
        const meanRice = getWeightedMapMetricAverage(valueByCode, countByCode);
        elements.roadmapsMapLegend.textContent = meanRice > 0
          ? `Average RICE score per country — mean ${typeof formatRice === "function" ? formatRice(meanRice) : meanRice} across ${numCountries} countr${numCountries !== 1 ? "ies" : "y"}`
          : "Average RICE score per country. Add countries and RICE inputs to roadmaps to see values on the map.";
      } else if (metric === "financial") {
        const totalEur = Object.values(valueByCode).reduce((a, b) => a + b, 0);
        elements.roadmapsMapLegend.textContent = totalEur > 0
          ? `Total financial impact (EUR) per country — ${formatEur(totalEur)} across ${numCountries} countr${numCountries !== 1 ? "ies" : "y"} (rates refreshed daily)`
          : "Total financial impact (EUR) per country. Add countries and financial impact to roadmaps to see values on the map.";
      } else if (metric === "financialAvg") {
        const meanEur = getWeightedMapMetricAverage(valueByCode, countByCode);
        elements.roadmapsMapLegend.textContent = meanEur > 0
          ? `Average financial impact (EUR) per country — ${formatEur(meanEur)} mean across ${numCountries} countr${numCountries !== 1 ? "ies" : "y"} (rates refreshed daily)`
          : "Average financial impact (EUR) per country. Add countries and financial impact to roadmaps to see values on the map.";
      } else {
        elements.roadmapsMapLegend.textContent = totalRoadmapHits > 0
          ? `Roadmaps per country — ${uniqueRoadmapCount} roadmap${uniqueRoadmapCount !== 1 ? "s" : ""} in scope, ${totalRoadmapHits} country assignment${totalRoadmapHits !== 1 ? "s" : ""} across ${numCountries} countr${numCountries !== 1 ? "ies" : "y"}`
          : "Roadmaps per country. Add countries to roadmaps to see them on the map.";
      }
    }

    const host = elements.roadmapsMapContainer;
    const workspaceWide = isSuperAdminModeActive();
    host._mapCountryLayerData = {
      countByCode,
      valueByCode,
      metric: getCurrentMapMetric(),
      uniqueRoadmapCount,
      showProfileBreakdown: workspaceWide,
      roadmapsByCountryCode: workspaceWide ? getFilteredRoadmapsGroupedByCountryCode() : null
    };
    if (!host._leafletMap || !host.isConnected || !host.querySelector(".leaflet-container")) {
      destroyRoadmapsMapInstance();
      host.innerHTML = "";
      const map = L.map(host, { center: [20, 0], zoom: 2, zoomControl: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a>"
      }).addTo(map);
      host._leafletMap = map;
      ensureMapCountryTooltipMapListeners(map);
    }
    const map = host._leafletMap;
    ensureMapCountryTooltipMapListeners(map);
    if (elements.roadmapsMapContainer._geoLayer) {
      map.removeLayer(elements.roadmapsMapContainer._geoLayer);
      elements.roadmapsMapContainer._geoLayer = null;
    }

    function getColor(val) {
      if (val === 0) return "#e0e0e0";
      if (maxValue <= 0) return "#e0e0e0";
      const t = val / maxValue;
      if (t <= 0.25) return "#c8e6c9";
      if (t <= 0.5) return "#81c784";
      if (t <= 0.75) return "#4caf50";
      return "#2e7d32";
    }

    function style(feature) {
      const code = getCountryCodeFromFeature(feature);
      const value = code ? (valueByCode[code] || 0) : 0;
      return {
        fillColor: getColor(value),
        weight: 1,
        opacity: 1,
        color: "#fff",
        fillOpacity: 0.8
      };
    }

    const metric = getCurrentMapMetric();

    function onEachFeature(feature, layer) {
      const code = getCountryCodeFromFeature(feature);
      const rawName =
        feature.properties &&
        (feature.properties.NAME || feature.properties.ADMIN || feature.properties.NAME_LONG || code);
      const name =
        rawName && typeof getCanonicalCountryName === "function"
          ? getCanonicalCountryName(rawName)
          : rawName;
      const displayName = name || code || "Unknown";
      const flag = code && typeof countryCodeToFlag === "function" ? countryCodeToFlag(code) : "";
      bindMapCountryLayerTooltip(layer, {
        countryName: displayName,
        countryCode: code,
        flag
      });
    }

    fetch(ROADMAPS_MAP_GEOJSON_URL)
      .then((res) => {
        if (!res.ok) throw new Error("Map data unavailable");
        return res.json();
      })
      .then((geojson) => {
        if (!geojson || !geojson.features || !Array.isArray(geojson.features)) throw new Error("Invalid map data");
        const layer = L.geoJSON(geojson, { style, onEachFeature });
        layer.eachLayer((l) => attachMapCountryLayerHover(l, layer));
        layer.addTo(map);
        elements.roadmapsMapContainer._geoLayer = layer;
        map.invalidateSize();
        invalidateMapSizeAfterFullscreenExit();
      })
      .catch(() => {
        setRoadmapsMapEmptyMessage("Could not load map data. Check your connection.");
      });
  }

  const metric = getCurrentMapMetric();
  if (mapMetricUsesExchangeRates(metric)) {
    if (elements.roadmapsMapLegend) elements.roadmapsMapLegend.textContent = "Loading exchange rates…";
    ExchangeRates.ensure()
      .then(() => {
        renderMapWithValueByCode(getMapMetricValuesByCode(metric));
      })
      .catch(() => {
        if (elements.roadmapsMapLegend) {
          elements.roadmapsMapLegend.textContent = "Exchange rates unavailable; showing amounts in EUR only where applicable.";
        }
        renderMapWithValueByCode(getMapMetricValuesByCode(metric));
      });
    return;
  }

  renderMapWithValueByCode(getMapMetricValuesByCode(metric));
  if (state.roadmapsView === "map") {
    requestAnimationFrame(() => invalidateMapSizeAfterFullscreenExit());
  }
}

function getRoadmapFinancialImpactEurShort(roadmap) {
  if (!roadmap || roadmap.financialImpactValue == null || roadmap.financialImpactValue === "") return null;
  const raw = roadmap.financialImpactValue;
  const amount = Number.isFinite(raw) ? raw : Number(raw);
  if (!Number.isFinite(amount)) return null;
  const currency = (roadmap.financialImpactCurrency || "EUR").toString().trim().toUpperCase() || "EUR";
  const amountEur = typeof ExchangeRates !== "undefined" && typeof ExchangeRates.convertToEUR === "function"
    ? ExchangeRates.convertToEUR(amount, currency)
    : (currency === "EUR" ? amount : NaN);
  if (!Number.isFinite(amountEur)) return "€—";
  const short = typeof formatFinancialShort === "function"
    ? formatFinancialShort(amountEur)
    : Number(amountEur).toLocaleString(undefined, { maximumFractionDigits: 2 });
  return `€${short}`;
}

function buildCardMetaTooltipWrap(text, ariaLabel, title, bodyLines, className) {
  const wrap = document.createElement("span");
  wrap.className = className;
  wrap.setAttribute("aria-label", ariaLabel);
  wrap.setAttribute("tabindex", "0");

  const textSpan = document.createElement("span");
  textSpan.textContent = text;
  wrap.appendChild(textSpan);

  const tooltipEl = document.createElement("div");
  tooltipEl.className = "cell-type-tooltip";
  tooltipEl.setAttribute("role", "tooltip");

  const titleEl = document.createElement("div");
  titleEl.className = "cell-type-tooltip-title";
  titleEl.textContent = title;
  tooltipEl.appendChild(titleEl);

  const bodyEl = document.createElement("div");
  bodyEl.className = "cell-type-tooltip-body";
  (Array.isArray(bodyLines) ? bodyLines : []).forEach((line) => {
    const p = document.createElement("p");
    p.textContent = line;
    bodyEl.appendChild(p);
  });
  tooltipEl.appendChild(bodyEl);
  wrap.appendChild(tooltipEl);
  return wrap;
}

/** Roadmap type or financial-framework icon pill for Scrum/MoSCoW board cards. */
function buildBoardCardMetricIconWrap(options) {
  const { svg, label, tooltipTitle, tooltipBody, iconKind, dataAttributes } = options;
  if (!svg && !label) return null;

  const wrap = document.createElement("span");
  wrap.className = "scrum-board-card-type-wrap cell-type-icon-wrap cell-type-pill board-card-metric-icon";
  wrap.dataset.iconKind = iconKind || "metric";
  wrap.setAttribute("role", "img");
  wrap.setAttribute("aria-label", label || "");
  if (dataAttributes && typeof dataAttributes === "object") {
    Object.keys(dataAttributes).forEach((key) => {
      if (dataAttributes[key] != null) wrap.dataset[key] = String(dataAttributes[key]);
    });
  }

  if (svg) {
    wrap.innerHTML = svg;
    if (tooltipTitle != null || tooltipBody != null) {
      const tooltipEl = document.createElement("div");
      tooltipEl.className = "cell-type-tooltip";
      tooltipEl.setAttribute("role", "tooltip");
      if (tooltipTitle != null) {
        const titleEl = document.createElement("div");
        titleEl.className = "cell-type-tooltip-title";
        titleEl.textContent = tooltipTitle;
        tooltipEl.appendChild(titleEl);
      }
      if (tooltipBody != null) {
        const bodyEl = document.createElement("div");
        bodyEl.className = "cell-type-tooltip-body";
        const paragraphs = String(tooltipBody).split(/\n\n+/);
        paragraphs.forEach((text) => {
          const p = document.createElement("p");
          p.textContent = text.replace(/\n/g, " ").trim();
          bodyEl.appendChild(p);
        });
        tooltipEl.appendChild(bodyEl);
      }
      wrap.appendChild(tooltipEl);
    }
  } else {
    wrap.textContent = label;
  }

  return wrap;
}

function buildBoardCardRoadmapTypeIcon(roadmap) {
  if (!roadmap || !roadmap.roadmapType) return null;
  const typeMeta = roadmapTypeIcons && roadmapTypeIcons[roadmap.roadmapType];
  return buildBoardCardMetricIconWrap({
    svg: typeMeta && typeMeta.svg,
    label: roadmap.roadmapType,
    tooltipTitle: typeMeta && typeMeta.tooltipTitle,
    tooltipBody: typeMeta && typeMeta.tooltipBody,
    iconKind: "type",
    dataAttributes: { type: roadmap.roadmapType }
  });
}

function buildBoardCardFrameworkIcon(roadmap) {
  if (!roadmap) return null;
  const frameworkKey = normalizeFinancialFramework(roadmap.financialImpactFramework);
  const frameworkMeta = FINANCIAL_FRAMEWORK_ICONS[frameworkKey];
  if (!frameworkMeta || !frameworkMeta.svg) return null;
  return buildBoardCardMetricIconWrap({
    svg: frameworkMeta.svg,
    label: frameworkMeta.label || frameworkKey,
    tooltipTitle: frameworkMeta.tooltipTitle,
    tooltipBody: frameworkMeta.tooltipBody,
    iconKind: "framework",
    dataAttributes: { framework: frameworkKey }
  });
}

/** Single horizontal row: type icon, framework icon, RICE, t-shirt, financial impact. */
function buildBoardCardMetricsRow(roadmap, boardPrefix, options = {}) {
  const hideTypeIcon = !!(options && options.hideTypeIcon);
  const hideFrameworkIcon = !!(options && options.hideFrameworkIcon);
  const row = document.createElement("div");
  row.className = `${boardPrefix}-metrics board-card-metrics-row`;

  if (!hideTypeIcon) {
    const typeIcon = buildBoardCardRoadmapTypeIcon(roadmap);
    if (typeIcon) row.appendChild(typeIcon);
  }

  if (!hideFrameworkIcon) {
    const frameworkIcon = buildBoardCardFrameworkIcon(roadmap);
    if (frameworkIcon) row.appendChild(frameworkIcon);
  }

  const riceValue = roadmap.riceScore != null ? roadmap.riceScore : calculateRiceScore(roadmap);
  const riceLabel = "RICE " + formatRice(riceValue);
  const reachVal = roadmap.reachValue != null ? String(roadmap.reachValue) : "—";
  const impactVal = roadmap.impactValue != null ? String(roadmap.impactValue) : "—";
  const confidenceVal = roadmap.confidenceValue != null ? String(roadmap.confidenceValue) : "—";
  const effortVal = roadmap.effortValue != null ? String(roadmap.effortValue) : "—";
  const confidenceNum = Number(roadmap.confidenceValue);
  const confidenceDecimal = Number.isFinite(confidenceNum) ? confidenceNum / 100 : null;
  const formulaLine =
    Number.isFinite(Number(roadmap.reachValue)) &&
    Number.isFinite(Number(roadmap.impactValue)) &&
    Number.isFinite(confidenceDecimal) &&
    Number.isFinite(Number(roadmap.effortValue)) &&
    Number(roadmap.effortValue) > 0
      ? `[${Number(roadmap.reachValue)} × ${Number(roadmap.impactValue)} × ${confidenceDecimal.toFixed(2)}] ÷ ${Number(roadmap.effortValue)} = ${formatRice(riceValue)}`
      : "Not enough inputs to compute full formula.";

  row.appendChild(
    buildCardMetaTooltipWrap(
      riceLabel,
      `RICE score ${formatRice(riceValue)}`,
      "RICE score details",
      [
        "Formula: [Reach × Impact × Confidence] ÷ Effort",
        `R (Reach): ${reachVal}`,
        `I (Impact): ${impactVal}`,
        `C (Confidence): ${confidenceVal !== "—" ? confidenceVal + "%" : "—"}${Number.isFinite(confidenceDecimal) ? ` (${confidenceDecimal.toFixed(2)})` : ""}`,
        `E (Effort): ${effortVal}`,
        `Calculation: ${formulaLine}`
      ],
      `${boardPrefix}-rice card-meta-with-tooltip`
    )
  );

  if (roadmap.tshirtSize) {
    const sizeTooltip =
      typeof tshirtSizeTooltips !== "undefined" ? tshirtSizeTooltips[roadmap.tshirtSize] : null;
    row.appendChild(
      buildCardMetaTooltipWrap(
        roadmap.tshirtSize,
        `Roadmap size ${roadmap.tshirtSize}`,
        (sizeTooltip && sizeTooltip.tooltipTitle) || "Roadmap size",
        [(sizeTooltip && sizeTooltip.tooltipBody) || roadmap.tshirtSize],
        `${boardPrefix}-size card-meta-with-tooltip`
      )
    );
  }

  const financialShort = getRoadmapFinancialImpactEurShort(roadmap);
  if (financialShort) {
    const raw = roadmap.financialImpactValue;
    const amount = Number.isFinite(raw) ? raw : Number(raw);
    const currency = (roadmap.financialImpactCurrency || "EUR").toString().trim().toUpperCase() || "EUR";
    const shortOriginal =
      Number.isFinite(amount) && typeof formatFinancialShort === "function"
        ? formatFinancialShort(amount)
        : Number.isFinite(amount)
          ? String(Number(amount).toLocaleString(undefined, { maximumFractionDigits: 2 }))
          : "—";
    row.appendChild(
      buildCardMetaTooltipWrap(
        financialShort,
        `Financial impact EUR ${financialShort}`,
        "Financial impact",
        [`EUR converted: ${financialShort}`, `Original: ${shortOriginal} ${currency}`],
        `${boardPrefix}-financial card-meta-with-tooltip`
      )
    );
  }

  return row;
}

function buildTshirtSizeTooltipWrap(tshirtSize, extraClass) {
  const wrap = document.createElement("span");
  wrap.className = ["cell-tshirt-with-tooltip", extraClass].filter(Boolean).join(" ");
  wrap.setAttribute("tabindex", "0");
  wrap.setAttribute("aria-label", `T-shirt size: ${tshirtSize}`);
  const textSpan = document.createElement("span");
  textSpan.className = "cell-tshirt-size-text";
  textSpan.textContent = tshirtSize;
  wrap.appendChild(textSpan);
  const meta =
    typeof tshirtSizeTooltips !== "undefined" && tshirtSizeTooltips[tshirtSize]
      ? tshirtSizeTooltips[tshirtSize]
      : null;
  appendIconMetaTooltip(wrap, meta);
  return wrap;
}

function buildRoadmapTableCardTshirtMetric(roadmap) {
  const metric = document.createElement("div");
  metric.className = "roadmaps-table-card__metric roadmaps-table-card__metric--size";
  const sizeLabel = document.createElement("span");
  sizeLabel.className = "roadmaps-table-card__metric-label";
  sizeLabel.textContent = "Size";
  metric.appendChild(sizeLabel);
  if (roadmap.tshirtSize) {
    metric.appendChild(
      buildTshirtSizeTooltipWrap(roadmap.tshirtSize, "roadmaps-table-card__metric-value")
    );
  } else {
    const sizeVal = document.createElement("span");
    sizeVal.className = "roadmaps-table-card__metric-value";
    sizeVal.textContent = "—";
    metric.appendChild(sizeVal);
  }
  return metric;
}

function appendIconMetaTooltip(wrap, meta) {
  if (!wrap || !meta || (meta.tooltipTitle == null && meta.tooltipBody == null)) return;
  const tooltipEl = document.createElement("div");
  tooltipEl.className = "cell-type-tooltip";
  tooltipEl.setAttribute("role", "tooltip");
  if (meta.tooltipTitle != null) {
    const titleEl = document.createElement("div");
    titleEl.className = "cell-type-tooltip-title";
    titleEl.textContent = meta.tooltipTitle;
    tooltipEl.appendChild(titleEl);
  }
  if (meta.tooltipBody != null) {
    const bodyEl = document.createElement("div");
    bodyEl.className = "cell-type-tooltip-body";
    String(meta.tooltipBody)
      .split(/\n+/)
      .forEach((paragraph) => {
        const block = document.createElement("p");
        block.textContent = paragraph.trim();
        if (block.textContent) bodyEl.appendChild(block);
      });
    tooltipEl.appendChild(bodyEl);
  }
  wrap.appendChild(tooltipEl);
}

function buildRoadmapTableCardRiceMetric(roadmap) {
  const riceScore = roadmap.riceScore != null ? roadmap.riceScore : calculateRiceScore(roadmap);
  const reachVal = roadmap.reachValue != null && roadmap.reachValue !== "" ? roadmap.reachValue : "—";
  const impactVal = roadmap.impactValue != null && roadmap.impactValue !== "" ? roadmap.impactValue : "—";
  const confidenceVal =
    roadmap.confidenceValue != null && roadmap.confidenceValue !== "" ? roadmap.confidenceValue : "—";
  const effortVal = roadmap.effortValue != null && roadmap.effortValue !== "" ? roadmap.effortValue : "—";
  const reachNum = Number(roadmap.reachValue);
  const impactNum = Number(roadmap.impactValue);
  const confidenceNum = Number(roadmap.confidenceValue);
  const effortNum = Number(roadmap.effortValue);
  const confidenceDecimal = Number.isFinite(confidenceNum) ? confidenceNum / 100 : null;
  const formulaLine =
    Number.isFinite(reachNum) &&
    Number.isFinite(impactNum) &&
    Number.isFinite(confidenceDecimal) &&
    Number.isFinite(effortNum) &&
    effortNum > 0
      ? `[${reachNum} × ${impactNum} × ${confidenceDecimal.toFixed(2)}] ÷ ${effortNum} = ${formatRice(riceScore)}`
      : "Not enough inputs to compute full formula.";

  const metric = document.createElement("div");
  metric.className = "roadmaps-table-card__metric roadmaps-table-card__metric--rice";

  const riceLabel = document.createElement("span");
  riceLabel.className = "roadmaps-table-card__metric-label";
  riceLabel.textContent = "RICE";
  metric.appendChild(riceLabel);

  const riceWrap = document.createElement("span");
  riceWrap.className = "cell-rice-with-tooltip roadmaps-table-card__metric-value";
  riceWrap.setAttribute("tabindex", "0");
  riceWrap.setAttribute(
    "aria-label",
    `RICE details: Reach ${reachVal}, Impact ${impactVal}, Confidence ${confidenceVal !== "—" ? confidenceVal + "%" : "—"}, Effort ${effortVal}.`
  );
  const riceText = document.createElement("span");
  riceText.textContent = formatRice(riceScore);
  riceWrap.appendChild(riceText);

  const riceTooltip = document.createElement("div");
  riceTooltip.className = "cell-type-tooltip";
  riceTooltip.setAttribute("role", "tooltip");
  const riceTooltipTitle = document.createElement("div");
  riceTooltipTitle.className = "cell-type-tooltip-title";
  riceTooltipTitle.textContent = "RICE score details";
  riceTooltip.appendChild(riceTooltipTitle);
  const riceTooltipBody = document.createElement("div");
  riceTooltipBody.className = "cell-type-tooltip-body";
  const formula = document.createElement("p");
  formula.textContent = "Formula: [Reach × Impact × Confidence] ÷ Effort";
  riceTooltipBody.appendChild(formula);
  [
    `R (Reach) - ${reachVal}`,
    `I (Impact) - ${impactVal}`,
    `C (Confidence) - ${confidenceVal !== "—" ? confidenceVal + "%" : "—"}${Number.isFinite(confidenceDecimal) ? ` (${confidenceDecimal.toFixed(2)})` : ""}`,
    `E (Effort) - ${effortVal}`,
    `Calculation - ${formulaLine}`
  ].forEach((line) => {
    const p = document.createElement("p");
    p.textContent = line;
    riceTooltipBody.appendChild(p);
  });
  riceTooltip.appendChild(riceTooltipBody);
  riceWrap.appendChild(riceTooltip);
  metric.appendChild(riceWrap);
  return metric;
}

function buildRoadmapTableCardFinancialMetric(roadmap) {
  const financialShort = getRoadmapFinancialImpactEurShort(roadmap) || "—";
  const metric = document.createElement("div");
  metric.className = "roadmaps-table-card__metric roadmaps-table-card__metric--financial";

  const finLabel = document.createElement("span");
  finLabel.className = "roadmaps-table-card__metric-label";
  finLabel.textContent = "Impact";
  metric.appendChild(finLabel);

  if (roadmap.financialImpactValue == null || roadmap.financialImpactValue === "") {
    const finVal = document.createElement("span");
    finVal.className = "roadmaps-table-card__metric-value";
    finVal.textContent = financialShort;
    metric.appendChild(finVal);
    return metric;
  }

  const raw = roadmap.financialImpactValue;
  const amount = Number.isFinite(raw) ? raw : Number(raw);
  const currency = (roadmap.financialImpactCurrency || "EUR").toString().trim().toUpperCase() || "EUR";
  const amountEur =
    typeof ExchangeRates !== "undefined" && typeof ExchangeRates.convertToEUR === "function"
      ? ExchangeRates.convertToEUR(amount, currency)
      : amount;
  const hasEurRate =
    typeof ExchangeRates !== "undefined" && typeof ExchangeRates.hasRate === "function"
      ? ExchangeRates.hasRate(currency)
      : true;
  const shortOriginal =
    typeof formatFinancialShort === "function"
      ? formatFinancialShort(amount)
      : String(Number(amount).toLocaleString(undefined, { maximumFractionDigits: 2 }));

  const finWrap = document.createElement("span");
  finWrap.className = "cell-financial-with-tooltip roadmaps-table-card__metric-value";
  finWrap.setAttribute("tabindex", "0");
  const finText = document.createElement("span");
  finText.className = "cell-financial-text";
  finText.textContent = financialShort;
  finWrap.appendChild(finText);

  const tooltipEl = document.createElement("div");
  tooltipEl.className = "cell-type-tooltip";
  tooltipEl.setAttribute("role", "tooltip");
  const titleEl = document.createElement("div");
  titleEl.className = "cell-type-tooltip-title";
  titleEl.textContent = "Original financial impact";
  tooltipEl.appendChild(titleEl);
  const bodyEl = document.createElement("div");
  bodyEl.className = "cell-type-tooltip-body";
  const p = document.createElement("p");
  p.textContent =
    hasEurRate && Number.isFinite(amountEur)
      ? `${shortOriginal} ${currency}`
      : `${shortOriginal} ${currency} (EUR rate unavailable)`;
  bodyEl.appendChild(p);
  tooltipEl.appendChild(bodyEl);
  finWrap.appendChild(tooltipEl);
  finWrap.setAttribute(
    "aria-label",
    hasEurRate && Number.isFinite(amountEur)
      ? `Financial impact: ${financialShort} (original: ${shortOriginal} ${currency})`
      : `Financial impact: ${shortOriginal} ${currency} (EUR rate unavailable)`
  );
  metric.appendChild(finWrap);
  return metric;
}

function buildCardTitleTooltipElement(titleClassName, roadmap) {
  const titleText = (roadmap && roadmap.title ? String(roadmap.title) : "Untitled");
  const statusText = (roadmap && roadmap.roadmapStatus ? String(roadmap.roadmapStatus) : "Not set");
  const rawDescription =
    roadmap && (roadmap.description != null || roadmap.roadmapDescription != null)
      ? String(roadmap.description != null ? roadmap.description : roadmap.roadmapDescription)
      : "";

  const wrap = document.createElement("div");
  wrap.className = `${titleClassName} card-title-with-tooltip`;
  wrap.setAttribute("aria-label", `${titleText}. Status: ${statusText}.`);
  wrap.setAttribute("tabindex", "0");

  const textSpan = document.createElement("span");
  textSpan.textContent = titleText;
  wrap.appendChild(textSpan);

  wrap.appendChild(
    buildRoadmapDetailsTooltip({
      titleLabel: "Roadmap details",
      statusText,
      rawDescription
    })
  );

  return wrap;
}

function openPortfolioFiltersDrawerIfClosed() {
  const drawer = elements.portfolioFiltersDrawer;
  if (drawer && !drawer.open) {
    drawer.open = true;
    syncPortfolioFiltersDrawerState();
  }
}

function getFiltersToggleButtonLabel(advancedOpen) {
  const compact = isTableCompactLayout();
  if (compact) return advancedOpen ? "Less" : "Advanced";
  return advancedOpen ? "Hide advanced" : "Show advanced";
}

function syncCompactFilterButtonLabels() {
  if (!elements.filtersToggleBtn) return;
  const labelEl = elements.filtersToggleBtn.querySelector(".portfolio-filter-btn__label");
  const advancedOpen = Boolean(
    elements.filtersAdvanced && elements.filtersAdvanced.classList.contains("visible")
  );
  const text = getFiltersToggleButtonLabel(advancedOpen);
  if (labelEl) {
    labelEl.textContent = text;
  } else {
    elements.filtersToggleBtn.textContent = text;
  }
  elements.filtersToggleBtn.setAttribute("aria-expanded", advancedOpen ? "true" : "false");
}

/** Phones/tablets: Reset + Advanced only inside expanded filter body (hidden when collapsed). */
function syncCompactFiltersChrome() {
  const toolbar = document.querySelector(".portfolio-filters-toolbar");
  const summarySlot = elements.portfolioFiltersSummaryActions;
  const drawer = elements.portfolioFiltersDrawer;
  const meta =
    document.querySelector(".portfolio-filters-toolbar .filters-meta") ||
    document.querySelector(".portfolio-filters-summary-actions .filters-meta");
  const compact = isTableCompactLayout();
  const drawerOpen = Boolean(drawer && drawer.open);
  const summaryTitle = $("portfolioFiltersSummaryTitle");

  if (!meta || !toolbar) return;

  if (compact) {
    if (meta.parentElement !== toolbar) {
      toolbar.appendChild(meta);
    }
    if (summarySlot) {
      summarySlot.hidden = true;
      summarySlot.setAttribute("aria-hidden", "true");
    }
    if (drawerOpen) {
      toolbar.hidden = false;
      toolbar.setAttribute("aria-hidden", "false");
    } else {
      toolbar.hidden = true;
      toolbar.setAttribute("aria-hidden", "true");
    }
  } else {
    if (meta.parentElement !== toolbar) {
      toolbar.appendChild(meta);
    }
    if (summarySlot) {
      summarySlot.hidden = true;
      summarySlot.setAttribute("aria-hidden", "true");
    }
    toolbar.hidden = false;
    toolbar.removeAttribute("aria-hidden");
  }

  if (summaryTitle) {
    summaryTitle.textContent = compact ? "Filters" : "Search & filters";
  }

  syncCompactFilterButtonLabels();
}

function syncTableGroupByControlsForLayout() {
  const compact = isTableCompactLayout();
  const bar = elements.roadmapsTableGroupBar;
  const select = elements.tableGroupBySelect;
  if (bar) {
    bar.hidden = !compact;
    bar.setAttribute("aria-hidden", compact ? "false" : "true");
  }
  if (select) {
    select.disabled = !compact;
    select.tabIndex = compact ? 0 : -1;
  }
  if (!compact && elements.tableGroupBySummary) {
    elements.tableGroupBySummary.textContent = "";
  }
}

function initTableGroupByControls() {
  if (!elements.tableGroupBySelect || typeof TABLE_GROUP_BY_OPTIONS === "undefined") return;
  const validIds = TABLE_GROUP_BY_OPTIONS.map((opt) => opt.id);
  if (!validIds.includes(state.tableGroupBy)) {
    state.tableGroupBy = "none";
  }
  if (!elements.tableGroupBySelect.dataset.inited) {
    elements.tableGroupBySelect.dataset.inited = "1";
    TABLE_GROUP_BY_OPTIONS.forEach((opt) => {
      const option = document.createElement("option");
      option.value = opt.id;
      option.textContent = opt.label;
      elements.tableGroupBySelect.appendChild(option);
    });
    elements.tableGroupBySelect.addEventListener("change", () => {
      if (!isTableCompactLayout()) return;
      const next = elements.tableGroupBySelect.value;
      state.tableGroupBy = validIds.includes(next) ? next : "none";
      saveState();
      if (state.roadmapsView === "table") renderRoadmaps();
    });
  }
  elements.tableGroupBySelect.value = state.tableGroupBy;
  syncTableGroupByControlsForLayout();
  initTableGroupDisclosureControls();
}

function initTableGroupDisclosureControls() {
  if (!elements.roadmapsTableCardsList || elements.roadmapsTableCardsList.dataset.groupDisclosureReady === "1") {
    return;
  }
  elements.roadmapsTableCardsList.dataset.groupDisclosureReady = "1";
  elements.roadmapsTableCardsList.addEventListener(
    "toggle",
    (event) => {
      const details = event.target.closest(".roadmaps-table-card-group__disclosure");
      if (!details || event.target !== details) return;
      const summary = details.querySelector("summary.roadmaps-table-card-group__header");
      if (!summary) return;
      summary.setAttribute("aria-expanded", details.open ? "true" : "false");
    },
    true
  );
}

function getTableGroupByUnsetKey() {
  return "__unset__";
}

const TABLE_GROUP_BY_KANO_UNPOSITIONED_KEY = "__kano_unpositioned__";

function getTableGroupByValue(roadmap, groupBy) {
  if (!roadmap || !groupBy || groupBy === "none") return getTableGroupByUnsetKey();
  switch (groupBy) {
    case "kanoModel":
      if (!roadmapHasKanoPosition(roadmap)) return TABLE_GROUP_BY_KANO_UNPOSITIONED_KEY;
      return getKanoCellZoneId(
        normalizeKanoAxisLevel(roadmap.kanoFunctionality),
        normalizeKanoAxisLevel(roadmap.kanoSatisfaction)
      );
    case "roadmapStatus":
      return (roadmap.roadmapStatus || "").toString().trim() || getTableGroupByUnsetKey();
    case "moscowCategory":
      return (roadmap.moscowCategory || "").toString().trim() || getTableGroupByUnsetKey();
    case "tshirtSize":
      return (roadmap.tshirtSize || "").toString().trim() || getTableGroupByUnsetKey();
    case "roadmapType":
      return (roadmap.roadmapType || "").toString().trim() || getTableGroupByUnsetKey();
    case "financialImpactFramework":
      return normalizeFinancialFramework(roadmap.financialImpactFramework) || getTableGroupByUnsetKey();
    case "financialImpactCurrency": {
      const cur = (roadmap.financialImpactCurrency || "").toString().trim().toUpperCase();
      return cur || getTableGroupByUnsetKey();
    }
    case "ownerProfileName":
      return (roadmap.ownerProfileName || "").toString().trim() || getTableGroupByUnsetKey();
    default:
      return getTableGroupByUnsetKey();
  }
}

function getTableGroupDisplayLabel(rawKey, groupBy) {
  if (rawKey === getTableGroupByUnsetKey()) return "Not set";
  if (groupBy === "kanoModel") {
    if (rawKey === TABLE_GROUP_BY_KANO_UNPOSITIONED_KEY) return "Not positioned";
    if (typeof kanoCategoryLegend !== "undefined") {
      const entry = kanoCategoryLegend.find((item) => item.id === rawKey);
      if (entry) return entry.label;
    }
    return rawKey;
  }
  switch (groupBy) {
    case "financialImpactFramework": {
      const meta = FINANCIAL_FRAMEWORK_ICONS[rawKey];
      return (meta && meta.label) || rawKey;
    }
    case "financialImpactCurrency":
      return rawKey;
    default:
      return rawKey;
  }
}

function sortTableGroupKeys(keys, groupBy) {
  const unset = getTableGroupByUnsetKey();
  const list = keys.slice();
  const moveUnsetLast = (ordered) => {
    if (!list.includes(unset)) return ordered;
    const without = ordered.filter((k) => k !== unset);
    return list.includes(unset) ? without.concat(unset) : without;
  };

  if (groupBy === "roadmapStatus" && typeof roadmapStatusList !== "undefined") {
    const order = roadmapStatusList.slice();
    return moveUnsetLast(
      list.sort((a, b) => {
        const ia = order.indexOf(a);
        const ib = order.indexOf(b);
        const ra = ia === -1 ? 999 : ia;
        const rb = ib === -1 ? 999 : ib;
        return ra - rb;
      })
    );
  }

  if (groupBy === "moscowCategory" && typeof moscowList !== "undefined") {
    const order = moscowList.slice();
    return moveUnsetLast(
      list.sort((a, b) => {
        const ia = order.indexOf(a);
        const ib = order.indexOf(b);
        const ra = ia === -1 ? 999 : ia;
        const rb = ib === -1 ? 999 : ib;
        return ra - rb;
      })
    );
  }

  if (groupBy === "tshirtSize" && typeof tshirtSizeList !== "undefined") {
    const order = tshirtSizeList.slice();
    return moveUnsetLast(
      list.sort((a, b) => {
        const ia = order.indexOf(a);
        const ib = order.indexOf(b);
        const ra = ia === -1 ? 999 : ia;
        const rb = ib === -1 ? 999 : ib;
        return ra - rb;
      })
    );
  }

  if (groupBy === "kanoModel" && typeof kanoCategoryLegend !== "undefined") {
    const order = kanoCategoryLegend.map((entry) => entry.id);
    const unpositioned = TABLE_GROUP_BY_KANO_UNPOSITIONED_KEY;
    return list.sort((a, b) => {
      if (a === unpositioned) return 1;
      if (b === unpositioned) return -1;
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      const ra = ia === -1 ? 999 : ia;
      const rb = ib === -1 ? 999 : ib;
      return ra - rb;
    });
  }

  return moveUnsetLast(
    list.sort((a, b) =>
      getTableGroupDisplayLabel(a, groupBy).localeCompare(getTableGroupDisplayLabel(b, groupBy), undefined, {
        sensitivity: "base"
      })
    )
  );
}

function updateTableGroupBySummary(roadmapCount, groupBy) {
  if (!elements.tableGroupBySummary || !isTableCompactLayout()) return;
  const count = Number(roadmapCount) || 0;
  if (!groupBy || groupBy === "none") {
    elements.tableGroupBySummary.textContent =
      count === 1 ? "1 roadmap" : `${count} roadmaps`;
    return;
  }
  const groupEls = elements.roadmapsTableCardsList
    ? elements.roadmapsTableCardsList.querySelectorAll(".roadmaps-table-card-group")
    : [];
  const groupCount = groupEls.length;
  const opt = typeof TABLE_GROUP_BY_OPTIONS !== "undefined"
    ? TABLE_GROUP_BY_OPTIONS.find((o) => o.id === groupBy)
    : null;
  const label = opt ? opt.label.toLowerCase() : "category";
  elements.tableGroupBySummary.textContent =
    count === 1
      ? `1 roadmap · ${groupCount} ${label} group`
      : `${count} roadmaps · ${groupCount} ${label} groups`;
}

function syncRoadmapTableCardSelectionStyles() {
  if (!elements.roadmapsTableCardsList) return;
  elements.roadmapsTableCardsList.querySelectorAll(".roadmaps-table-card").forEach((card) => {
    const cb = card.querySelector(".roadmap-select-checkbox");
    card.classList.toggle("roadmaps-table-card--selected", !!(cb && cb.checked));
  });
}

function renderRoadmapsTableEmptyMessage(message) {
  const text = message || "";
  const colspan = getRoadmapsTableColSpan();
  if (elements.roadmapsTableBody) {
    if (isTableCompactLayout()) {
      elements.roadmapsTableBody.innerHTML = "";
    } else {
      elements.roadmapsTableBody.innerHTML = `
      <tr class="roadmaps-table-empty-row">
        <td colspan="${colspan}" class="empty-state roadmaps-table-col--empty">
          <div class="roadmaps-table-empty-state__content" role="status">${escapeHtml(text)}</div>
        </td>
      </tr>
    `;
    }
  }
  if (elements.roadmapsTableCardsList) {
    elements.roadmapsTableCardsList.innerHTML = `<p class="roadmaps-table-cards-empty empty-state" role="status">${text}</p>`;
  }
}

function getRoadmapSelectCheckboxes() {
  if (isTableCompactLayout() && elements.roadmapsTableCardsList) {
    return elements.roadmapsTableCardsList.querySelectorAll(".roadmap-select-checkbox");
  }
  if (elements.roadmapsTableBody) {
    return elements.roadmapsTableBody.querySelectorAll(".roadmap-select-checkbox");
  }
  return [];
}

function truncateTableCardText(text, maxLen) {
  const raw = text == null ? "" : String(text).replace(/\s+/g, " ").trim();
  if (!raw) return "";
  if (raw.length <= maxLen) return raw;
  return raw.slice(0, Math.max(0, maxLen - 1)).trimEnd() + "…";
}

function appendRoadmapTableCardTitleIcon(iconsWrap, options) {
  const { svg, ariaLabel, extraClass, iconKind, fallbackText, meta } = options;
  if (!ariaLabel) return;
  const wrap = document.createElement("span");
  wrap.className = `roadmaps-table-card__title-icon cell-type-icon-wrap cell-type-pill${extraClass ? " " + extraClass : ""}`;
  if (iconKind) wrap.dataset.iconKind = iconKind;
  wrap.setAttribute("role", "img");
  wrap.setAttribute("aria-label", ariaLabel);
  wrap.setAttribute("tabindex", "0");
  if (svg) {
    wrap.innerHTML = svg;
  } else if (fallbackText) {
    wrap.textContent = fallbackText;
  } else {
    return;
  }
  appendIconMetaTooltip(wrap, meta);
  iconsWrap.appendChild(wrap);
}

const TABLE_CARD_MAX_BADGES = 3;

function buildRoadmapTableCardBadges(roadmap, groupBy) {
  const badges = document.createElement("div");
  badges.className = "roadmaps-table-card__badges";
  const candidates = [];

  if (roadmap.roadmapStatus && groupBy !== "roadmapStatus") {
    const statusMeta = roadmapStatusIcons && roadmapStatusIcons[roadmap.roadmapStatus];
    const statusPill = document.createElement("span");
    statusPill.className = "roadmaps-table-card__status-pill";
    statusPill.setAttribute("aria-label", roadmap.roadmapStatus);
    if (statusMeta && statusMeta.svg) {
      statusPill.innerHTML =
        statusMeta.svg +
        '<span class="roadmaps-table-card__status-label">' +
        escapeHtml(roadmap.roadmapStatus) +
        "</span>";
    } else {
      statusPill.textContent = roadmap.roadmapStatus;
    }
    statusPill.setAttribute("tabindex", "0");
    appendIconMetaTooltip(statusPill, statusMeta);
    candidates.push({ priority: 1, label: roadmap.roadmapStatus, el: statusPill });
  }

  if (roadmap.moscowCategory && groupBy !== "moscowCategory") {
    const moscowSlug = moscowTablePillSlug(roadmap.moscowCategory);
    const moscowChip = document.createElement("span");
    moscowChip.className = `roadmaps-table-card__chip roadmaps-table-card__chip--moscow moscow-pill moscow-pill--${moscowSlug} cell-moscow-with-tooltip`;
    moscowChip.textContent = moscowTableShortLabel(roadmap.moscowCategory);
    moscowChip.setAttribute("tabindex", "0");
    if (typeof moscowTooltips !== "undefined" && moscowTooltips[roadmap.moscowCategory]) {
      appendIconMetaTooltip(moscowChip, moscowTooltips[roadmap.moscowCategory]);
    }
    candidates.push({ priority: 2, label: roadmap.moscowCategory, el: moscowChip });
  }

  if (roadmap.roadmapType && groupBy !== "roadmapType") {
    const typeChip = document.createElement("span");
    typeChip.className = "roadmaps-table-card__chip roadmaps-table-card__chip--type";
    typeChip.textContent = roadmap.roadmapType;
    candidates.push({ priority: 3, label: roadmap.roadmapType, el: typeChip });
  }

  if (roadmap.financialImpactCurrency && groupBy !== "financialImpactCurrency") {
    const curChip = document.createElement("span");
    curChip.className = "roadmaps-table-card__chip roadmaps-table-card__chip--currency";
    curChip.textContent = String(roadmap.financialImpactCurrency).trim().toUpperCase();
    candidates.push({ priority: 4, label: curChip.textContent, el: curChip });
  }

  if (roadmap.roadmapPeriod) {
    const periodChip = document.createElement("span");
    periodChip.className = "roadmaps-table-card__chip roadmaps-table-card__chip--period";
    periodChip.textContent = roadmap.roadmapPeriod;
    candidates.push({ priority: 5, label: roadmap.roadmapPeriod, el: periodChip });
  }

  candidates.sort((a, b) => a.priority - b.priority);

  let visible = candidates;
  let hidden = [];
  if (candidates.length > TABLE_CARD_MAX_BADGES) {
    visible = candidates.slice(0, TABLE_CARD_MAX_BADGES - 1);
    hidden = candidates.slice(TABLE_CARD_MAX_BADGES - 1);
  }

  visible.forEach(({ el }) => badges.appendChild(el));

  if (hidden.length) {
    const hiddenLabels = hidden.map((h) => h.label).filter(Boolean);
    const moreChip = buildCardMetaTooltipWrap(
      "+" + hidden.length,
      "More attributes: " + hiddenLabels.join(", "),
      "More attributes",
      hiddenLabels,
      "roadmaps-table-card__chip roadmaps-table-card__chip--more card-meta-with-tooltip"
    );
    badges.appendChild(moreChip);
  }

  return badges;
}

const COUNTRIES_TOOLTIP_SCROLL_THRESHOLD = 4;

function normalizeRoadmapCountriesList(countries) {
  return normalizeCountryNames(Array.isArray(countries) ? countries : []);
}

/** True when the roadmap targets every EU member state (e.g. after choosing EU in the form). */
function roadmapCountriesRepresentEuRegion(countries) {
  const list = normalizeRoadmapCountriesList(countries);
  if (
    typeof EU_MEMBER_COUNTRIES === "undefined" ||
    !EU_MEMBER_COUNTRIES.length ||
    list.length !== EU_MEMBER_COUNTRIES.length
  ) {
    return false;
  }
  const set = new Set(list);
  return EU_MEMBER_COUNTRIES.every((name) => set.has(name));
}

function getEuRegionFlagEmoji() {
  return typeof countryCodeToFlag === "function" ? countryCodeToFlag("EU") : "🇪🇺";
}

function getCountriesTooltipTitle(countries) {
  const list = normalizeRoadmapCountriesList(countries);
  if (roadmapCountriesRepresentEuRegion(list)) {
    return `European Union (${list.length} countries)`;
  }
  return list.length > 1 ? `Target countries (${list.length})` : "Target country";
}

function buildCountriesListTooltip(countries) {
  const list = normalizeRoadmapCountriesList(countries);
  const tooltipEl = document.createElement("div");
  tooltipEl.className = "cell-type-tooltip cell-type-tooltip--wide";
  if (list.length > COUNTRIES_TOOLTIP_SCROLL_THRESHOLD) {
    tooltipEl.classList.add("cell-type-tooltip--scroll");
  }
  tooltipEl.setAttribute("role", "tooltip");
  const tooltipTitle = document.createElement("div");
  tooltipTitle.className = "cell-type-tooltip-title";
  tooltipTitle.textContent = getCountriesTooltipTitle(list);
  tooltipEl.appendChild(tooltipTitle);
  const tooltipBody = document.createElement("div");
  tooltipBody.className = "cell-type-tooltip-body";
  list.forEach((name) => {
    const code =
      typeof countryCodeByName !== "undefined" && countryCodeByName[name]
        ? countryCodeByName[name]
        : "";
    const flag = code && typeof countryCodeToFlag === "function" ? countryCodeToFlag(code) : "";
    const p = document.createElement("p");
    if (flag && code) {
      p.textContent = `${flag} ${code} — ${name}`;
    } else if (code) {
      p.textContent = `${code} — ${name}`;
    } else {
      p.textContent = name;
    }
    tooltipBody.appendChild(p);
  });
  tooltipEl.appendChild(tooltipBody);
  tooltipBody.addEventListener(
    "wheel",
    (e) => {
      e.stopPropagation();
    },
    { passive: true }
  );
  return tooltipEl;
}

function buildRoadmapTableCardCountriesRow(countries) {
  const normalizedCountries = normalizeRoadmapCountriesList(countries);
  const isEuRegion = roadmapCountriesRepresentEuRegion(normalizedCountries);
  const row = document.createElement("div");
  row.className = "roadmaps-table-card__countries-row cell-countries-with-tooltip";
  row.setAttribute(
    "aria-label",
    isEuRegion ? "European Union; tap for member countries" : "Target countries; tap for full list"
  );
  row.setAttribute("tabindex", "0");
  row.dataset.countryCount = String(normalizedCountries.length);

  if (isEuRegion) {
    const chip = document.createElement("span");
    chip.className = "roadmaps-table-card__country-chip roadmaps-table-card__country-chip--eu";
    const flagEl = document.createElement("span");
    flagEl.className = "roadmaps-table-card__country-flag";
    flagEl.setAttribute("aria-hidden", "true");
    flagEl.textContent = getEuRegionFlagEmoji();
    chip.appendChild(flagEl);
    const labelEl = document.createElement("span");
    labelEl.className = "roadmaps-table-card__country-code";
    labelEl.textContent = "EU";
    chip.appendChild(labelEl);
    row.appendChild(chip);
  } else {
    const maxToShow = 4;
    const shown = normalizedCountries.slice(0, maxToShow);
    const moreCount = normalizedCountries.length - shown.length;
    shown.forEach((name) => {
      const code =
        typeof countryCodeByName !== "undefined" && countryCodeByName[name]
          ? countryCodeByName[name]
          : "";
      const flag = code && typeof countryCodeToFlag === "function" ? countryCodeToFlag(code) : "";
      const chip = document.createElement("span");
      chip.className = "roadmaps-table-card__country-chip";
      chip.title = code ? `${name} (${code})` : String(name);
      if (flag) {
        const flagEl = document.createElement("span");
        flagEl.className = "roadmaps-table-card__country-flag";
        flagEl.setAttribute("aria-hidden", "true");
        flagEl.textContent = flag;
        chip.appendChild(flagEl);
      }
      const labelEl = document.createElement("span");
      labelEl.className = "roadmaps-table-card__country-code";
      labelEl.textContent = code || String(name);
      chip.appendChild(labelEl);
      row.appendChild(chip);
    });
    if (moreCount > 0) {
      const moreChip = document.createElement("span");
      moreChip.className = "roadmaps-table-card__country-chip roadmaps-table-card__country-chip--more";
      moreChip.textContent = "+" + moreCount;
      moreChip.title = normalizedCountries.slice(maxToShow).join(", ");
      row.appendChild(moreChip);
    }
  }

  row.appendChild(buildCountriesListTooltip(normalizedCountries));

  return row;
}

function buildRoadmapTableCard(roadmap, demoReadOnly, options = {}) {
  const groupBy = options.groupBy || "none";
  const card = document.createElement("article");
  card.className = "roadmaps-table-card portfolio-board-card--structured";
  card.setAttribute("role", "listitem");
  card.dataset.roadmapId = roadmap.id;
  const statusLabel = (roadmap.roadmapStatus || "Not Started").toString().trim();
  card.setAttribute("data-status", statusLabel);
  if (
    isSuperAdminModeActive() &&
    roadmap.ownerProfileId &&
    roadmap.ownerProfileId !== state.activeProfileId
  ) {
    card.classList.add("roadmaps-table-card--external-profile");
  }

  if (isSuperAdminModeActive() && roadmap.ownerProfileName) {
    const ownerStrip = buildRoadmapOwnerIdentityElement(roadmap, {
      variant: "card-strip",
      showTeam: true,
      showScopeHint: true
    });
    if (ownerStrip) card.appendChild(ownerStrip);
  }

  const head = document.createElement("div");
  head.className = "roadmaps-table-card__head";

  const selectWrap = document.createElement("div");
  selectWrap.className = "roadmaps-table-card__select";
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.className = "checkbox-input roadmap-select-checkbox";
  cb.setAttribute("data-id", roadmap.id);
  cb.setAttribute("aria-label", `Select ${roadmap.title || "roadmap"}`);
  if (demoReadOnly) {
    cb.disabled = true;
    cb.title = DEMO_READ_ONLY_ACTION_TITLE;
  }
  selectWrap.appendChild(cb);
  head.appendChild(selectWrap);

  head.appendChild(buildRoadmapTableCardBadges(roadmap, groupBy));
  card.appendChild(head);

  const body = document.createElement("div");
  body.className = "roadmaps-table-card__body portfolio-card-body";

  const titleRow = document.createElement("div");
  titleRow.className =
    "roadmaps-table-card__title-row board-card-section board-card-section--title";
  titleRow.appendChild(buildCardTitleTooltipElement("roadmaps-table-card__title", roadmap));
  body.appendChild(titleRow);

  const description = roadmap.description
    ? richDescriptionToPlainText(roadmap.description).trim()
    : "";
  if (description) {
    const descEl = document.createElement("p");
    descEl.className = "roadmaps-table-card__desc";
    descEl.textContent = truncateTableCardText(description, 140);
    body.appendChild(descEl);
  }

  const metrics = buildBoardCardMetricsRow(roadmap, "roadmaps-table-card", {
    hideTypeIcon: groupBy === "roadmapType",
    hideFrameworkIcon: groupBy === "financialImpactFramework"
  });
  metrics.classList.add("board-card-section", "board-card-section--metrics");
  body.appendChild(metrics);

  const countries = Array.isArray(roadmap.countries) ? roadmap.countries : [];
  if (countries.length) {
    const metaRow = document.createElement("div");
    metaRow.className = "roadmaps-table-card__meta-row";
    metaRow.appendChild(buildRoadmapTableCardCountriesRow(countries));
    body.appendChild(metaRow);
  }

  card.appendChild(body);

  const actions = document.createElement("div");
  actions.className =
    "roadmaps-table-card__actions portfolio-card-footer board-card-section board-card-section--footer";

  const viewBtn = document.createElement("button");
  viewBtn.type = "button";
  viewBtn.setAttribute("data-id", roadmap.id);
  setRoadmapTableActionButton(viewBtn, "view", "View");

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.setAttribute("data-id", roadmap.id);
  setRoadmapTableActionButton(editBtn, "edit", "Edit", { disabled: demoReadOnly });

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.setAttribute("data-id", roadmap.id);
  setRoadmapTableActionButton(deleteBtn, "delete", "Delete", { disabled: demoReadOnly });

  actions.appendChild(viewBtn);
  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);
  card.appendChild(actions);

  return card;
}

function renderRoadmapsTableCards(roadmaps, demoReadOnly) {
  if (!elements.roadmapsTableCardsList) return;
  initTableGroupDisclosureControls();
  elements.roadmapsTableCardsList.innerHTML = "";
  const groupBy = state.tableGroupBy || "none";
  const fragment = document.createDocumentFragment();

  if (groupBy === "none") {
    roadmaps.forEach((roadmap) => {
      fragment.appendChild(buildRoadmapTableCard(roadmap, demoReadOnly, { groupBy: "none" }));
    });
  } else {
    const buckets = new Map();
    roadmaps.forEach((roadmap) => {
      const key = getTableGroupByValue(roadmap, groupBy);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(roadmap);
    });
    const keys = sortTableGroupKeys(Array.from(buckets.keys()), groupBy);
    keys.forEach((key) => {
      const section = document.createElement("section");
      section.className = "roadmaps-table-card-group roadmaps-table-card-group--expandable";
      section.dataset.groupBy = groupBy;
      section.dataset.groupKey = key;
      if (groupBy === "kanoModel") {
        if (key === TABLE_GROUP_BY_KANO_UNPOSITIONED_KEY) {
          section.classList.add("roadmaps-table-card-group--kano-unpositioned");
        } else {
          section.classList.add(`roadmaps-table-card-group--kano-${key}`);
        }
      }

      const groupRoadmaps = buckets.get(key) || [];
      const groupLabel = getTableGroupDisplayLabel(key, groupBy);

      const details = document.createElement("details");
      details.className = "roadmaps-table-card-group__disclosure";
      details.open = true;

      const summary = document.createElement("summary");
      summary.className = "roadmaps-table-card-group__header";
      summary.setAttribute("aria-expanded", "true");
      summary.setAttribute(
        "aria-label",
        `${groupLabel}, ${groupRoadmaps.length} roadmap${groupRoadmaps.length === 1 ? "" : "s"}. Tap to collapse or expand.`
      );

      const title = document.createElement("span");
      title.className = "roadmaps-table-card-group__title";
      title.textContent = groupLabel;

      const headerMeta = document.createElement("span");
      headerMeta.className = "roadmaps-table-card-group__header-meta";

      const count = document.createElement("span");
      count.className = "roadmaps-table-card-group__count";
      count.textContent = String(groupRoadmaps.length);
      count.setAttribute(
        "aria-label",
        groupRoadmaps.length === 1 ? "1 roadmap" : `${groupRoadmaps.length} roadmaps`
      );

      const chevron = document.createElement("span");
      chevron.className = "roadmaps-table-card-group__chevron";
      chevron.setAttribute("aria-hidden", "true");

      headerMeta.appendChild(count);
      headerMeta.appendChild(chevron);
      summary.appendChild(title);
      summary.appendChild(headerMeta);
      details.appendChild(summary);

      const list = document.createElement("div");
      list.className = "roadmaps-table-card-group__list";
      list.setAttribute("role", "group");
      list.setAttribute("aria-label", groupLabel);
      groupRoadmaps.forEach((roadmap) => {
        list.appendChild(buildRoadmapTableCard(roadmap, demoReadOnly, { groupBy }));
      });
      details.appendChild(list);
      section.appendChild(details);
      fragment.appendChild(section);
    });
  }

  elements.roadmapsTableCardsList.appendChild(fragment);
  if (elements.tableGroupBySelect && elements.tableGroupBySelect.value !== groupBy) {
    elements.tableGroupBySelect.value = groupBy;
  }
  updateTableGroupBySummary(roadmaps.length, groupBy);
  syncRoadmapTableCardSelectionStyles();
  if (typeof BoardCardInteraction !== "undefined") {
    BoardCardInteraction.bindContainer(elements.roadmapsTableCardsList);
  }
}

function getAllRoadmapStatuses() {
  return typeof roadmapStatusList !== "undefined" && Array.isArray(roadmapStatusList)
    ? roadmapStatusList.slice()
    : ["Not Started", "In Progress", "On Hold", "Done", "Cancelled"];
}

function normalizeScrumBoardVisibleStatuses(raw) {
  const all = getAllRoadmapStatuses();
  if (!Array.isArray(raw)) return all;
  const ordered = [];
  all.forEach((status) => {
    if (raw.includes(status)) ordered.push(status);
  });
  return ordered.length ? ordered : all;
}

function getScrumBoardVisibleStatuses() {
  return normalizeScrumBoardVisibleStatuses(state.scrumBoardVisibleStatuses);
}

function setScrumBoardVisibleStatuses(next) {
  state.scrumBoardVisibleStatuses = normalizeScrumBoardVisibleStatuses(next);
  saveState();
  syncScrumBoardStatusColumnsCheckboxes();
  updateScrumBoardStatusColumnsSummary();
}

function initScrumBoardStatusColumnsOptions() {
  if (!elements.scrumBoardStatusColumnsList) return;
  elements.scrumBoardStatusColumnsList.innerHTML = "";
  const visible = new Set(getScrumBoardVisibleStatuses());
  getAllRoadmapStatuses().forEach((status, index) => {
    const row = document.createElement("div");
    row.className = "filter-country-option scrum-board-status-option";
    row.dataset.status = status;

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.id = `scrumBoardStatus-${index}`;
    cb.value = status;
    cb.checked = visible.has(status);

    const label = document.createElement("label");
    label.className = "scrum-board-status-option-label";
    label.setAttribute("for", cb.id);
    if (typeof roadmapStatusIcons !== "undefined" && roadmapStatusIcons[status]) {
      const iconWrap = document.createElement("span");
      iconWrap.className = "scrum-board-status-option-icon";
      iconWrap.innerHTML = roadmapStatusIcons[status].svg;
      label.appendChild(iconWrap);
    }
    const text = document.createElement("span");
    text.textContent = status;
    label.appendChild(text);

    row.appendChild(cb);
    row.appendChild(label);
    elements.scrumBoardStatusColumnsList.appendChild(row);
  });
  updateScrumBoardStatusColumnsSummary();
}

function syncScrumBoardStatusColumnsCheckboxes() {
  if (!elements.scrumBoardStatusColumnsList) return;
  const visible = new Set(getScrumBoardVisibleStatuses());
  elements.scrumBoardStatusColumnsList
    .querySelectorAll("input[type=\"checkbox\"]")
    .forEach((cb) => {
      cb.checked = visible.has(cb.value);
    });
}

function readScrumBoardStatusColumnsFromUi() {
  if (!elements.scrumBoardStatusColumnsList) return getScrumBoardVisibleStatuses();
  const selected = [];
  elements.scrumBoardStatusColumnsList
    .querySelectorAll("input[type=\"checkbox\"]:checked")
    .forEach((cb) => selected.push(cb.value));
  return selected;
}

function updateScrumBoardStatusColumnsSummary() {
  if (!elements.scrumBoardStatusColumnsSummary) return;
  const visible = getScrumBoardVisibleStatuses();
  const all = getAllRoadmapStatuses();
  if (visible.length === all.length) {
    elements.scrumBoardStatusColumnsSummary.textContent = "All statuses";
    return;
  }
  if (visible.length === 1) {
    elements.scrumBoardStatusColumnsSummary.textContent = visible[0];
    return;
  }
  elements.scrumBoardStatusColumnsSummary.textContent = visible.length + " statuses";
}

function closeScrumBoardStatusColumnsPopup() {
  const container = elements.scrumBoardStatusColumnsToggle?.closest(".filter-countries");
  if (!container) return;
  container.classList.remove("open");
  if (elements.scrumBoardStatusColumnsToggle) {
    elements.scrumBoardStatusColumnsToggle.setAttribute("aria-expanded", "false");
  }
}

function renderScrumBoard() {
  if (!elements.scrumBoardContainer) return;
  const activeProfile = getActiveProfile();
  const unlockedProfile = getUnlockedActiveProfile();
  const demoReadOnly = isActiveDemoProfile();
  elements.scrumBoardContainer.innerHTML = "";

  if (elements.scrumBoardSortByRiceToggle) {
    elements.scrumBoardSortByRiceToggle.checked = state.scrumBoardSortByRice;
  }
  syncScrumBoardStatusColumnsCheckboxes();
  updateScrumBoardStatusColumnsSummary();

  if (!activeProfile) {
    elements.scrumBoardContainer.innerHTML = '<div class="scrum-board-empty">Select a profile to see the Scrum board.</div>';
    return;
  }

  if (!unlockedProfile) {
    elements.scrumBoardContainer.innerHTML =
      '<div class="scrum-board-empty">Unlock this profile to use the board view.</div>';
    return;
  }

  const baseRoadmaps = getPortfolioRoadmapsBaseList();
  baseRoadmaps.forEach((p) => {
    p.riceScore = calculateRiceScore(p);
  });
  initFilterRoadmapPeriodOptions(baseRoadmaps);
  const roadmaps = applyFilters(baseRoadmaps);

  const byStatus = {};
  roadmapStatusList.forEach((status) => {
    byStatus[status] = [];
  });
  roadmaps.forEach((p) => {
    const status = (p.roadmapStatus || "Not Started").toString().trim();
    if (!byStatus[status]) byStatus[status] = [];
    byStatus[status].push(p);
  });

  if (!state.scrumBoardSortByRice && activeProfile) {
    activeProfile.boardOrder = activeProfile.boardOrder || {};
    roadmapStatusList.forEach((status) => {
      const list = byStatus[status] || [];
      const orderIds = activeProfile.boardOrder[status];
      if (orderIds && Array.isArray(orderIds) && orderIds.length > 0) {
        const byId = new Map(list.map((p) => [p.id, p]));
        const ordered = [];
        for (const id of orderIds) {
          if (byId.has(id)) {
            ordered.push(byId.get(id));
            byId.delete(id);
          }
        }
        byId.forEach((p) => ordered.push(p));
        byStatus[status] = ordered;
      }
    });
  }

  roadmapStatusList.forEach((status) => {
    const list = byStatus[status] || [];
    if (state.scrumBoardSortByRice) {
      list.sort((a, b) => {
        const scoreA = a.riceScore != null ? a.riceScore : calculateRiceScore(a);
        const scoreB = b.riceScore != null ? b.riceScore : calculateRiceScore(b);
        return scoreB - scoreA;
      });
    }
  });

  const visibleStatuses = getScrumBoardVisibleStatuses();
  visibleStatuses.forEach((status) => {
    const column = document.createElement("div");
    column.className = "scrum-board-column";
    column.setAttribute("data-status", status);
    column.setAttribute("role", "region");
    column.setAttribute("aria-label", "Column: " + status);

    const header = document.createElement("div");
    header.className = "scrum-board-column-header";
    const title = document.createElement("h4");
    title.className = "scrum-board-column-title";
    title.textContent = status;
    const count = document.createElement("span");
    count.className = "scrum-board-column-count";
    count.textContent = String((byStatus[status] || []).length);
    header.appendChild(title);
    header.appendChild(count);
    column.appendChild(header);

    const cardsContainer = document.createElement("div");
    cardsContainer.className = "scrum-board-column-cards";

    const listForStatus = byStatus[status] || [];
    (listForStatus).forEach((roadmap, index) => {
      const card = document.createElement("div");
      card.className = "scrum-board-card";
      card.setAttribute("draggable", demoReadOnly ? "false" : "true");
      card.setAttribute("data-roadmap-id", roadmap.id);
      card.setAttribute(
        "aria-label",
        demoReadOnly
          ? "Roadmap: " + (roadmap.title || "Untitled") + ". View only."
          : "Roadmap: " + (roadmap.title || "Untitled") + ". Drag to change status. View, Edit, Delete."
      );
      if (
        isSuperAdminModeActive() &&
        roadmap.ownerProfileId &&
        roadmap.ownerProfileId !== state.activeProfileId
      ) {
        card.classList.add("portfolio-board-card--external-profile");
      }
      prependPortfolioCardOwnerStrip(card, roadmap);

      const titleRow = document.createElement("div");
      titleRow.className = "scrum-board-card-title-row";
      const titleEl = buildCardTitleTooltipElement("scrum-board-card-title", roadmap);
      titleRow.appendChild(titleEl);

      const meta = document.createElement("div");
      meta.className = "scrum-board-card-meta";
      meta.appendChild(buildBoardCardMetricsRow(roadmap, "scrum-board-card"));
      appendPortfolioCardBody(card, titleRow, meta);

      const cardStatus = (roadmap.roadmapStatus || "Not Started").toString().trim();
      const moveEl = isCompactPortfolioLayout()
        ? buildBoardCardMoveSelect(roadmap, cardStatus, { disabled: demoReadOnly })
        : null;

      const actions = document.createElement("div");
      actions.className = "scrum-board-card-actions";
      const isFirst = index === 0;
      const isLast = index === listForStatus.length - 1;
      const orderDisabled = demoReadOnly || state.scrumBoardSortByRice;
      const upBtn = document.createElement("button");
      upBtn.type = "button";
      upBtn.className = "scrum-board-card-btn scrum-board-card-btn--order";
      upBtn.setAttribute("data-roadmap-id", roadmap.id);
      upBtn.setAttribute("data-status", status);
      upBtn.setAttribute("aria-label", "Move roadmap up in column");
      upBtn.title = "Move up";
      upBtn.innerHTML = "↑";
      upBtn.disabled = orderDisabled || isFirst;
      const downBtn = document.createElement("button");
      downBtn.type = "button";
      downBtn.className = "scrum-board-card-btn scrum-board-card-btn--order";
      downBtn.setAttribute("data-roadmap-id", roadmap.id);
      downBtn.setAttribute("data-status", status);
      downBtn.setAttribute("aria-label", "Move roadmap down in column");
      downBtn.title = "Move down";
      downBtn.innerHTML = "↓";
      downBtn.disabled = orderDisabled || isLast;
      if (!demoReadOnly) {
        upBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          moveBoardRoadmapUp(roadmap.id, status);
        });
        downBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          moveBoardRoadmapDown(roadmap.id, status);
        });
      } else {
        upBtn.title = DEMO_READ_ONLY_ACTION_TITLE;
        downBtn.title = DEMO_READ_ONLY_ACTION_TITLE;
      }
      const orderGroup = document.createElement("div");
      orderGroup.className = "scrum-board-card-actions-order";
      orderGroup.appendChild(upBtn);
      orderGroup.appendChild(downBtn);
      const viewBtn = document.createElement("button");
      viewBtn.type = "button";
      viewBtn.className = "scrum-board-card-btn scrum-board-card-btn--view";
      viewBtn.setAttribute("data-roadmap-id", roadmap.id);
      setPortfolioCardActionButton(viewBtn, "view", "View");
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "scrum-board-card-btn scrum-board-card-btn--edit";
      editBtn.setAttribute("data-roadmap-id", roadmap.id);
      setPortfolioCardActionButton(editBtn, "edit", "Edit");
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "scrum-board-card-btn scrum-board-card-btn--delete";
      deleteBtn.setAttribute("data-roadmap-id", roadmap.id);
      setPortfolioCardActionButton(deleteBtn, "delete", "Delete");
      if (demoReadOnly) {
        editBtn.disabled = true;
        deleteBtn.disabled = true;
        editBtn.title = DEMO_READ_ONLY_ACTION_TITLE;
        deleteBtn.title = DEMO_READ_ONLY_ACTION_TITLE;
      }
      viewBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openRoadmapModal("view", roadmap.id);
      });
      if (!demoReadOnly) {
        editBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          openRoadmapModal("edit", roadmap.id);
        });
        deleteBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          handleSingleDelete(roadmap.id);
        });
      }
      actions.appendChild(viewBtn);
      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);
      actions.appendChild(orderGroup);
      appendPortfolioCardFooter(card, moveEl, actions);

      cardsContainer.appendChild(card);
    });

    column.appendChild(cardsContainer);
    elements.scrumBoardContainer.appendChild(column);
  });

  bindScrumBoardDragAndDrop();
  if (typeof BoardCardInteraction !== "undefined") {
    BoardCardInteraction.bindContainer(elements.scrumBoardContainer);
  }
}

function createDragGhost(card, clientX, clientY) {
  const rect = card.getBoundingClientRect();
  const ghost = card.cloneNode(true);
  ghost.classList.add("drag-ghost");
  ghost.setAttribute("aria-hidden", "true");
  const style = ghost.style;
  style.position = "fixed";
  style.top = "-9999px";
  style.left = "0";
  style.width = rect.width + "px";
  style.height = rect.height + "px";
  style.boxSizing = "border-box";
  style.pointerEvents = "none";
  style.margin = "0";
  style.opacity = "0.98";
  style.zIndex = "10000";
  document.body.appendChild(ghost);
  void ghost.offsetHeight;
  const offsetX = clientX - rect.left;
  const offsetY = clientY - rect.top;
  return { ghost, offsetX, offsetY };
}

function bindScrumBoardDragAndDrop() {
  if (!elements.scrumBoardContainer || typeof BoardDrag === "undefined") return;
  const cards = elements.scrumBoardContainer.querySelectorAll(".scrum-board-card");
  const columns = elements.scrumBoardContainer.querySelectorAll(".scrum-board-column");

  let draggedCard = null;
  let draggedRoadmapId = null;
  let dropColumn = null;
  let dropIndex = 0;

  elements.scrumBoardContainer.addEventListener("dragover", (e) => {
    if (!BoardDrag.getSession()) return;
    e.preventDefault();
    BoardDrag.movePointer(e.clientX, e.clientY);
  });

  cards.forEach((card) => {
    card.addEventListener("dragstart", (e) => {
      if (isActiveDemoProfile()) {
        e.preventDefault();
        return;
      }
      if (e.target.closest(".scrum-board-card-actions, .portfolio-card-move")) {
        e.preventDefault();
        return;
      }
      draggedCard = card;
      draggedRoadmapId = card.getAttribute("data-roadmap-id");
      if (typeof BoardCardInteraction !== "undefined") BoardCardInteraction.clearPressed();
      BoardDrag.begin(card, e, {
        draggingClass: "scrum-board-card--dragging",
        columnDragOverClass: "scrum-board-column--drag-over",
        createLegacyGhost: createDragGhost
      });
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", draggedRoadmapId);
      e.dataTransfer.setData("application/x-roadmap-id", draggedRoadmapId);
    });

    card.addEventListener("dragend", () => {
      BoardDrag.end();
      draggedCard = null;
      draggedRoadmapId = null;
      dropColumn = null;
    });
  });

  columns.forEach((column) => {
    column.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      BoardDrag.movePointer(e.clientX, e.clientY);
      if (!draggedRoadmapId) return;
      dropColumn = column;
      BoardDrag.setColumnHighlight(column, true);
      const cardsContainer = column.querySelector(".scrum-board-column-cards");
      dropIndex = BoardDrag.computeDropIndex(cardsContainer, e.clientY, draggedCard);
      BoardDrag.showIndicator(cardsContainer, dropIndex, draggedCard);
    });

    column.addEventListener("dragleave", (e) => {
      if (!column.contains(e.relatedTarget)) {
        BoardDrag.setColumnHighlight(column, false);
      }
    });

    column.addEventListener("drop", (e) => {
      e.preventDefault();
      BoardDrag.setColumnHighlight(column, false);
      BoardDrag.clearIndicator();
      if (!draggedRoadmapId) return;
      if (!requireWritableActiveProfile("Move roadmap")) return;
      const newStatus = column.getAttribute("data-status");
      if (!getUnlockedActiveProfile()) return;
      const located = findRoadmapWithOwner(draggedRoadmapId);
      const ownerProfile = located.profile;
      const roadmap = located.roadmap;
      if (!ownerProfile || !roadmap) return;
      const currentStatus = (roadmap.roadmapStatus || "Not Started").toString().trim();

      if (currentStatus === newStatus) {
        if (!state.scrumBoardSortByRice && dropColumn) {
          const cardsContainer = dropColumn.querySelector(".scrum-board-column-cards");
          const columnCards = cardsContainer ? Array.from(cardsContainer.querySelectorAll(".scrum-board-card")) : [];
          const orderWithoutDragged = columnCards
            .map((c) => c.getAttribute("data-roadmap-id"))
            .filter((id) => id !== draggedRoadmapId);
          const idx = Math.min(dropIndex, orderWithoutDragged.length);
          const newOrder = orderWithoutDragged.slice();
          newOrder.splice(idx, 0, draggedRoadmapId);
          ownerProfile.boardOrder = ownerProfile.boardOrder || {};
          ownerProfile.boardOrder[newStatus] = newOrder;
          saveState();
          renderScrumBoard();
          renderRoadmaps();
        }
        return;
      }

      roadmap.roadmapStatus = newStatus;
      roadmap.modifiedAt = new Date().toISOString();

      if (!state.scrumBoardSortByRice && dropColumn) {
        const cardsContainer = dropColumn.querySelector(".scrum-board-column-cards");
        const columnCards = cardsContainer ? Array.from(cardsContainer.querySelectorAll(".scrum-board-card")) : [];
        const currentIds = columnCards.map((c) => c.getAttribute("data-roadmap-id"));
        const idx = Math.min(dropIndex, currentIds.length);
        const newOrder = currentIds.slice();
        newOrder.splice(idx, 0, draggedRoadmapId);
        ownerProfile.boardOrder = ownerProfile.boardOrder || {};
        if (Array.isArray(ownerProfile.boardOrder[currentStatus])) {
          ownerProfile.boardOrder[currentStatus] = ownerProfile.boardOrder[currentStatus].filter(
            (id) => id !== draggedRoadmapId
          );
        }
        ownerProfile.boardOrder[newStatus] = newOrder;
      }

      saveState();
      renderScrumBoard();
      renderRoadmaps();
    });
  });
}

function getBoardOrderedList(profile, status) {
  const base = isSuperAdminModeActive()
    ? getPortfolioRoadmapsBaseList()
    : profile.roadmaps.map((p) => attachRoadmapOwnerMeta(p, profile));
  base.forEach((p) => { p.riceScore = p.riceScore != null ? p.riceScore : calculateRiceScore(p); });
  initFilterRoadmapPeriodOptions(base);
  const filtered = applyFilters(base);
  const list = filtered.filter((p) => (p.roadmapStatus || "Not Started").toString().trim() === status);
  if (state.scrumBoardSortByRice) {
    list.sort((a, b) => {
      const scoreA = a.riceScore != null ? a.riceScore : calculateRiceScore(a);
      const scoreB = b.riceScore != null ? b.riceScore : calculateRiceScore(b);
      return scoreB - scoreA;
    });
    return list;
  }
  if (isSuperAdminModeActive()) {
    list.sort((a, b) => compareDatesDesc(a.createdAt, b.createdAt));
    return list;
  }
  const orderIds = profile.boardOrder && profile.boardOrder[status];
  if (orderIds && Array.isArray(orderIds) && orderIds.length) {
    const byId = {};
    list.forEach((p) => { byId[p.id] = p; });
    const ordered = [];
    orderIds.forEach((id) => { if (byId[id]) { ordered.push(byId[id]); delete byId[id]; } });
    Object.values(byId).sort((a, b) => compareDatesDesc(a.createdAt, b.createdAt)).forEach((p) => ordered.push(p));
    return ordered;
  }
  list.sort((a, b) => compareDatesDesc(a.createdAt, b.createdAt));
  return list;
}

function moveBoardRoadmapUp(roadmapId, status) {
  if (!requireWritableActiveProfile("Reorder roadmap")) return;
  const sessionProfile = getUnlockedActiveProfile();
  if (!sessionProfile) return;
  const ownerProfile = findRoadmapOwnerProfile(roadmapId) || sessionProfile;
  const list = getBoardOrderedList(sessionProfile, status);
  const idx = list.findIndex((p) => p.id === roadmapId);
  if (idx <= 0) return;
  ownerProfile.boardOrder = ownerProfile.boardOrder || {};
  if (!Array.isArray(ownerProfile.boardOrder[status]) || ownerProfile.boardOrder[status].length !== list.length) {
    ownerProfile.boardOrder[status] = list.filter((p) => p.ownerProfileId === ownerProfile.id).map((p) => p.id);
  }
  const orderIds = ownerProfile.boardOrder[status];
  const i = orderIds.indexOf(roadmapId);
  if (i <= 0) return;
  [orderIds[i - 1], orderIds[i]] = [orderIds[i], orderIds[i - 1]];
  state.scrumBoardSortByRice = false;
  if (elements.scrumBoardSortByRiceToggle) elements.scrumBoardSortByRiceToggle.checked = false;
  saveState();
  renderScrumBoard();
  renderRoadmaps();
}

function moveBoardRoadmapDown(roadmapId, status) {
  if (!requireWritableActiveProfile("Reorder roadmap")) return;
  const sessionProfile = getUnlockedActiveProfile();
  if (!sessionProfile) return;
  const ownerProfile = findRoadmapOwnerProfile(roadmapId) || sessionProfile;
  const list = getBoardOrderedList(sessionProfile, status);
  const idx = list.findIndex((p) => p.id === roadmapId);
  if (idx < 0 || idx >= list.length - 1) return;
  ownerProfile.boardOrder = ownerProfile.boardOrder || {};
  if (!Array.isArray(ownerProfile.boardOrder[status]) || ownerProfile.boardOrder[status].length !== list.length) {
    ownerProfile.boardOrder[status] = list.filter((p) => p.ownerProfileId === ownerProfile.id).map((p) => p.id);
  }
  const orderIds = ownerProfile.boardOrder[status];
  const i = orderIds.indexOf(roadmapId);
  if (i < 0 || i >= orderIds.length - 1) return;
  [orderIds[i], orderIds[i + 1]] = [orderIds[i + 1], orderIds[i]];
  state.scrumBoardSortByRice = false;
  if (elements.scrumBoardSortByRiceToggle) elements.scrumBoardSortByRiceToggle.checked = false;
  saveState();
  renderScrumBoard();
  renderRoadmaps();
}

function getMoscowOrderedList(profile, quadrant) {
  const base = isSuperAdminModeActive()
    ? getPortfolioRoadmapsBaseList()
    : profile.roadmaps.map((p) => attachRoadmapOwnerMeta(p, profile));
  base.forEach((p) => { p.riceScore = p.riceScore != null ? p.riceScore : calculateRiceScore(p); });
  initFilterRoadmapPeriodOptions(base);
  const filtered = applyFilters(base);
  const list = filtered.filter((p) => {
    const m = (p.moscowCategory != null && String(p.moscowCategory).trim() !== "" && typeof moscowList !== "undefined" && moscowList.includes(p.moscowCategory))
      ? p.moscowCategory
      : "Could have";
    return m === quadrant;
  });
  if (state.moscowSortByRice) {
    list.sort((a, b) => {
      const scoreA = a.riceScore != null ? a.riceScore : calculateRiceScore(a);
      const scoreB = b.riceScore != null ? b.riceScore : calculateRiceScore(b);
      return scoreB - scoreA;
    });
    return list;
  }
  if (isSuperAdminModeActive()) {
    list.sort((a, b) => compareDatesDesc(a.createdAt, b.createdAt));
    return list;
  }
  if (profile.moscowOrder && Array.isArray(profile.moscowOrder[quadrant]) && profile.moscowOrder[quadrant].length) {
    const orderIds = profile.moscowOrder[quadrant];
    const byId = {};
    list.forEach((p) => { byId[p.id] = p; });
    const ordered = [];
    orderIds.forEach((id) => { if (byId[id]) { ordered.push(byId[id]); delete byId[id]; } });
    Object.values(byId).sort((a, b) => compareDatesDesc(a.createdAt, b.createdAt)).forEach((p) => ordered.push(p));
    return ordered;
  }
  list.sort((a, b) => compareDatesDesc(a.createdAt, b.createdAt));
  return list;
}

let moscowCompactNavObserver = null;

function setRoadmapMoscowCategory(roadmapId, newMoscow) {
  if (!requireWritableActiveProfile("Move roadmap")) return false;
  if (!getUnlockedActiveProfile() || !newMoscow) return false;
  const located = findRoadmapWithOwner(roadmapId);
  const ownerProfile = located.profile;
  const roadmap = located.roadmap;
  if (!ownerProfile || !roadmap || roadmap.moscowCategory === newMoscow) return false;
  roadmap.moscowCategory = newMoscow;
  roadmap.modifiedAt = new Date().toISOString();
  saveState();
  renderMoscowBoard();
  renderRoadmaps();
  return true;
}

function setRoadmapBoardStatus(roadmapId, newStatus) {
  if (!requireWritableActiveProfile("Move roadmap")) return false;
  if (!getUnlockedActiveProfile() || !newStatus) return false;
  if (typeof roadmapStatusList === "undefined" || !roadmapStatusList.includes(newStatus)) return false;
  const located = findRoadmapWithOwner(roadmapId);
  const ownerProfile = located.profile;
  const roadmap = located.roadmap;
  if (!ownerProfile || !roadmap) return false;
  const currentStatus = (roadmap.roadmapStatus || "Not Started").toString().trim();
  if (currentStatus === newStatus) return false;

  roadmap.roadmapStatus = newStatus;
  roadmap.modifiedAt = new Date().toISOString();

  if (!state.scrumBoardSortByRice) {
    ownerProfile.boardOrder = ownerProfile.boardOrder || {};
    if (Array.isArray(ownerProfile.boardOrder[currentStatus])) {
      ownerProfile.boardOrder[currentStatus] = ownerProfile.boardOrder[currentStatus].filter((id) => id !== roadmapId);
    }
    const nextOrder = Array.isArray(ownerProfile.boardOrder[newStatus])
      ? ownerProfile.boardOrder[newStatus].filter((id) => id !== roadmapId)
      : [];
    nextOrder.push(roadmapId);
    ownerProfile.boardOrder[newStatus] = nextOrder;
  }

  saveState();
  renderScrumBoard();
  renderRoadmaps();
  return true;
}

function isCompactPortfolioLayout() {
  return document.documentElement.classList.contains("is-compact-layout");
}

/** Table-style owner stripe (scrum / MoSCoW board cards, all layouts). */
function buildPortfolioCardOwnerStrip(roadmap) {
  if (!isSuperAdminModeActive()) return null;
  const name = (roadmap.ownerProfileName || "").trim();
  if (!name) return null;
  return buildRoadmapOwnerIdentityElement(roadmap, {
    variant: "card-strip",
    showTeam: true,
    showScopeHint: true
  });
}

function prependPortfolioCardOwnerStrip(card, roadmap) {
  if (!isSuperAdminModeActive()) return;
  const strip = buildPortfolioCardOwnerStrip(roadmap);
  if (strip) {
    card.classList.add("portfolio-board-card--has-owner-strip");
    card.insertBefore(strip, card.firstChild);
  }
}

function isPortfolioBoardCardElement(card) {
  return (
    card &&
    (card.classList.contains("scrum-board-card") || card.classList.contains("moscow-board-card"))
  );
}

function shouldUsePortfolioCardBodyWrap(card) {
  return (
    isCompactPortfolioLayout() ||
    card.classList.contains("portfolio-board-card--has-owner-strip") ||
    isPortfolioBoardCardElement(card)
  );
}

function appendPortfolioCardBody(card, titleRow, metaEl) {
  if (titleRow) {
    titleRow.classList.add("board-card-section", "board-card-section--title");
  }
  if (metaEl) {
    metaEl.classList.add("board-card-section", "board-card-section--metrics");
  }

  if (!shouldUsePortfolioCardBodyWrap(card)) {
    card.appendChild(titleRow);
    card.appendChild(metaEl);
    return;
  }

  card.classList.add("portfolio-board-card--structured");
  const body = document.createElement("div");
  body.className = "portfolio-card-body";
  body.appendChild(titleRow);
  body.appendChild(metaEl);
  card.appendChild(body);
}

function appendPortfolioCardFooter(card, moveEl, actionsEl) {
  if (actionsEl) {
    actionsEl.classList.add("board-card-section", "board-card-section--actions");
  }

  const useFooterWrap = isCompactPortfolioLayout() || isPortfolioBoardCardElement(card);
  if (!useFooterWrap) {
    if (moveEl) card.appendChild(moveEl);
    card.appendChild(actionsEl);
    return;
  }

  const footer = document.createElement("div");
  footer.className = "portfolio-card-footer board-card-section board-card-section--footer";
  if (moveEl) footer.appendChild(moveEl);
  footer.appendChild(actionsEl);
  card.appendChild(footer);
}

function buildPortfolioCardMoveSelect(roadmap, currentValue, config) {
  const wrap = document.createElement("div");
  wrap.className = "portfolio-card-move";
  const label = document.createElement("label");
  label.className = "portfolio-card-move-label";
  label.textContent = config.label || "Move to";
  label.setAttribute("for", config.idPrefix + "-" + roadmap.id);
  const select = document.createElement("select");
  select.id = config.idPrefix + "-" + roadmap.id;
  select.className = "portfolio-card-move-select";
  select.setAttribute("aria-label", config.ariaLabel);
  config.values.forEach((value) => {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = value;
    if (value === currentValue) opt.selected = true;
    select.appendChild(opt);
  });
  select.addEventListener("click", (e) => e.stopPropagation());
  select.addEventListener("mousedown", (e) => e.stopPropagation());
  if (config.disabled) {
    select.disabled = true;
    select.title = DEMO_READ_ONLY_ACTION_TITLE;
  } else {
    select.addEventListener("change", (e) => {
      e.stopPropagation();
      const next = select.value;
      if (next !== currentValue) {
        config.onSelect(roadmap.id, next);
      }
    });
  }
  wrap.appendChild(label);
  wrap.appendChild(select);
  return wrap;
}

function buildMoscowCardMoveSelect(roadmap, currentMoscow, { disabled = false } = {}) {
  return buildPortfolioCardMoveSelect(roadmap, currentMoscow, {
    idPrefix: "moscowMove",
    label: "MoSCoW category",
    ariaLabel: "Move roadmap to another MoSCoW category",
    values: moscowList,
    onSelect: (roadmapId, value) => setRoadmapMoscowCategory(roadmapId, value),
    disabled,
  });
}

function buildBoardCardMoveSelect(roadmap, currentStatus, { disabled = false } = {}) {
  const statuses = typeof roadmapStatusList !== "undefined" ? roadmapStatusList.slice() : [];
  return buildPortfolioCardMoveSelect(roadmap, currentStatus, {
    idPrefix: "boardMove",
    label: "Status",
    ariaLabel: "Move roadmap to another board column",
    values: statuses,
    onSelect: (roadmapId, value) => setRoadmapBoardStatus(roadmapId, value),
    disabled,
  });
}

const PORTFOLIO_CARD_ACTION_ICONS = {
  view:
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
  edit:
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  delete:
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
};

const ROADMAP_TABLE_ACTION_MAP = {
  view: "viewRoadmap",
  edit: "editRoadmap",
  delete: "deleteRoadmap",
};

const MOSCOW_TABLE_SHORT_LABELS = {
  "Must have": "Must",
  "Should have": "Should",
  "Could have": "Could",
  "Won't have": "Won't",
};

const MOSCOW_TABLE_PILL_SLUGS = {
  "Must have": "must",
  "Should have": "should",
  "Could have": "could",
  "Won't have": "wont",
};

function moscowTableShortLabel(category) {
  if (!category) return "—";
  return MOSCOW_TABLE_SHORT_LABELS[category] || category;
}

function moscowTablePillSlug(category) {
  if (!category) return "unset";
  return MOSCOW_TABLE_PILL_SLUGS[category] || "unset";
}

function setRoadmapTableActionButton(btn, kind, label, { disabled = false, title = "" } = {}) {
  const action = ROADMAP_TABLE_ACTION_MAP[kind] || kind;
  btn.className = `roadmap-action-btn roadmap-action-btn--${kind} roadmap-action-btn--icon-only`;
  btn.dataset.action = action;
  btn.setAttribute("aria-label", label);
  btn.title = disabled ? title || DEMO_READ_ONLY_ACTION_TITLE : title || label;
  btn.disabled = disabled;
  const icon = PORTFOLIO_CARD_ACTION_ICONS[kind] || "";
  btn.innerHTML =
    '<span class="roadmap-action-btn__icon">' +
    icon +
    '</span><span class="roadmap-action-btn__label">' +
    label +
    "</span>";
}

function setPortfolioCardActionButton(btn, kind, label) {
  btn.classList.add("roadmap-action-btn", `roadmap-action-btn--${kind}`, "portfolio-card-action-btn");
  btn.setAttribute("aria-label", label);
  btn.title = label;
  const icon = PORTFOLIO_CARD_ACTION_ICONS[kind] || "";
  btn.innerHTML =
    '<span class="portfolio-card-action-icon roadmap-action-btn__icon">' +
    icon +
    '</span><span class="portfolio-card-action-text roadmap-action-btn__label">' +
    label +
    "</span>";
}

/** User-facing MoSCoW category label (e.g. "Must Have"). */
function getMoscowDisplayName(moscowKey) {
  if (typeof moscowDisplayNames !== "undefined" && moscowDisplayNames[moscowKey]) {
    return moscowDisplayNames[moscowKey];
  }
  return moscowKey || "";
}

function syncMoscowCompactNav() {
  const nav = elements.moscowCompactNav;
  if (!nav || !elements.moscowBoardContainer) return;

  const isCompact = document.documentElement.classList.contains("is-compact-layout");
  const showNav = isCompact && state.roadmapsView === "moscow";
  const columns = elements.moscowBoardContainer.querySelectorAll(".moscow-board-column");

  if (!showNav || !columns.length) {
    nav.hidden = true;
    nav.innerHTML = "";
    if (moscowCompactNavObserver) {
      moscowCompactNavObserver.disconnect();
      moscowCompactNavObserver = null;
    }
    return;
  }

  const abbrLabels = {
    "Must have": "M",
    "Should have": "S",
    "Could have": "C",
    "Won't have": "W"
  };

  nav.hidden = false;
  nav.innerHTML = "";

  const header = document.createElement("div");
  header.className = "moscow-compact-nav__header";
  const headerTitle = document.createElement("span");
  headerTitle.className = "moscow-compact-nav__title";
  headerTitle.textContent = "Jump to quadrant";
  header.appendChild(headerTitle);
  nav.appendChild(header);

  const track = document.createElement("div");
  track.className = "moscow-compact-nav__track";
  track.setAttribute("role", "tablist");
  track.setAttribute("aria-label", "MoSCoW quadrants");

  columns.forEach((column, index) => {
    const moscow = column.getAttribute("data-moscow") || "";
    const countEl = column.querySelector(".moscow-board-column-count");
    const count = countEl ? countEl.textContent : "0";
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = "moscow-compact-nav__pill" + (index === 0 ? " is-active" : "");
    pill.setAttribute("role", "tab");
    pill.setAttribute("aria-selected", index === 0 ? "true" : "false");
    pill.setAttribute("data-moscow", moscow);
    pill.setAttribute("aria-controls", "moscow-col-" + index);
    pill.setAttribute("aria-label", getMoscowDisplayName(moscow) + ", " + count + " roadmaps");

    const main = document.createElement("span");
    main.className = "moscow-compact-nav__pill-main";

    const abbr = document.createElement("span");
    abbr.className = "moscow-compact-nav__abbr";
    abbr.textContent = abbrLabels[moscow] || moscow.charAt(0).toUpperCase();

    const label = document.createElement("span");
    label.className = "moscow-compact-nav__label";
    label.textContent = getMoscowDisplayName(moscow);

    const countBadge = document.createElement("span");
    countBadge.className = "moscow-compact-nav__count";
    countBadge.textContent = count;
    countBadge.setAttribute("aria-label", count + " roadmaps");

    main.appendChild(abbr);
    main.appendChild(label);
    pill.appendChild(main);
    pill.appendChild(countBadge);

    pill.addEventListener("click", () => {
      column.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
      track.querySelectorAll(".moscow-compact-nav__pill").forEach((p) => {
        p.classList.remove("is-active");
        p.setAttribute("aria-selected", "false");
      });
      pill.classList.add("is-active");
      pill.setAttribute("aria-selected", "true");
    });

    track.appendChild(pill);
    column.id = "moscow-col-" + index;
  });

  nav.appendChild(track);

  const hint = document.createElement("p");
  hint.className = "moscow-compact-nav__hint";
  hint.textContent = document.documentElement.classList.contains("is-phone-layout")
    ? "Tap a quadrant, then swipe the board below for roadmaps"
    : "Tap a quadrant to scroll the board to that column";
  nav.appendChild(hint);

  bindMoscowCompactNavScrollSync(track, columns);
}

function bindMoscowCompactNavScrollSync(track, columns) {
  if (moscowCompactNavObserver) {
    moscowCompactNavObserver.disconnect();
    moscowCompactNavObserver = null;
  }
  if (!track || !columns.length || !elements.moscowBoardContainer) return;

  const pills = track.querySelectorAll(".moscow-compact-nav__pill");
  const setActivePill = (index) => {
    pills.forEach((pill, i) => {
      const active = i === index;
      pill.classList.toggle("is-active", active);
      pill.setAttribute("aria-selected", active ? "true" : "false");
    });
  };

  if (document.documentElement.classList.contains("is-compact-layout") && typeof IntersectionObserver !== "undefined") {
    moscowCompactNavObserver = new IntersectionObserver(
      (entries) => {
        let best = null;
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          if (!best || entry.intersectionRatio > best.ratio) {
            best = { index: Number(entry.target.dataset.moscowIndex), ratio: entry.intersectionRatio };
          }
        });
        if (best != null && Number.isFinite(best.index)) {
          setActivePill(best.index);
        }
      },
      {
        root: null,
        rootMargin: "-12% 0px -48% 0px",
        threshold: [0.12, 0.28, 0.45, 0.6]
      }
    );
    columns.forEach((column, index) => {
      column.dataset.moscowIndex = String(index);
      moscowCompactNavObserver.observe(column);
    });
  }
}

function moveMoscowRoadmapUp(roadmapId, quadrant) {
  if (!requireWritableActiveProfile("Reorder roadmap")) return;
  const sessionProfile = getUnlockedActiveProfile();
  if (!sessionProfile) return;
  const ownerProfile = findRoadmapOwnerProfile(roadmapId) || sessionProfile;
  const list = getMoscowOrderedList(sessionProfile, quadrant);
  const idx = list.findIndex((p) => p.id === roadmapId);
  if (idx <= 0) return;
  ownerProfile.moscowOrder = ownerProfile.moscowOrder || {};
  if (!Array.isArray(ownerProfile.moscowOrder[quadrant]) || ownerProfile.moscowOrder[quadrant].length !== list.length) {
    ownerProfile.moscowOrder[quadrant] = list.filter((p) => p.ownerProfileId === ownerProfile.id).map((p) => p.id);
  }
  const orderIds = ownerProfile.moscowOrder[quadrant];
  const i = orderIds.indexOf(roadmapId);
  if (i <= 0) return;
  [orderIds[i - 1], orderIds[i]] = [orderIds[i], orderIds[i - 1]];
  state.moscowSortByRice = false;
  if (elements.moscowSortByRiceToggle) elements.moscowSortByRiceToggle.checked = false;
  saveState();
  renderMoscowBoard();
  renderRoadmaps();
}

function moveMoscowRoadmapDown(roadmapId, quadrant) {
  if (!requireWritableActiveProfile("Reorder roadmap")) return;
  const sessionProfile = getUnlockedActiveProfile();
  if (!sessionProfile) return;
  const ownerProfile = findRoadmapOwnerProfile(roadmapId) || sessionProfile;
  const list = getMoscowOrderedList(sessionProfile, quadrant);
  const idx = list.findIndex((p) => p.id === roadmapId);
  if (idx < 0 || idx >= list.length - 1) return;
  ownerProfile.moscowOrder = ownerProfile.moscowOrder || {};
  if (!Array.isArray(ownerProfile.moscowOrder[quadrant]) || ownerProfile.moscowOrder[quadrant].length !== list.length) {
    ownerProfile.moscowOrder[quadrant] = list.filter((p) => p.ownerProfileId === ownerProfile.id).map((p) => p.id);
  }
  const orderIds = ownerProfile.moscowOrder[quadrant];
  const i = orderIds.indexOf(roadmapId);
  if (i < 0 || i >= orderIds.length - 1) return;
  [orderIds[i], orderIds[i + 1]] = [orderIds[i + 1], orderIds[i]];
  state.moscowSortByRice = false;
  if (elements.moscowSortByRiceToggle) elements.moscowSortByRiceToggle.checked = false;
  saveState();
  renderMoscowBoard();
  renderRoadmaps();
}

function renderMoscowBoard() {
  if (!elements.moscowBoardContainer || typeof moscowList === "undefined") return;
  const gridOrder = typeof moscowGridOrder !== "undefined" && Array.isArray(moscowGridOrder) ? moscowGridOrder : moscowList;
  const activeProfile = getActiveProfile();
  const unlockedProfile = getUnlockedActiveProfile();
  const demoReadOnly = isActiveDemoProfile();
  elements.moscowBoardContainer.innerHTML = "";

  if (elements.moscowSortByRiceToggle) {
    elements.moscowSortByRiceToggle.checked = state.moscowSortByRice;
  }

  if (!activeProfile) {
    elements.moscowBoardContainer.innerHTML = '<div class="moscow-board-empty">Select a profile to see the MOSCOW grid.</div>';
    syncMoscowCompactNav();
    return;
  }

  if (!unlockedProfile) {
    elements.moscowBoardContainer.innerHTML =
      '<div class="moscow-board-empty">Unlock this profile to use the MOSCOW view.</div>';
    syncMoscowCompactNav();
    return;
  }

  const baseRoadmaps = getPortfolioRoadmapsBaseList();
  baseRoadmaps.forEach((p) => {
    p.riceScore = calculateRiceScore(p);
  });
  initFilterRoadmapPeriodOptions(baseRoadmaps);
  const roadmaps = applyFilters(baseRoadmaps);

  const byMoscow = {};
  moscowList.forEach((m) => {
    byMoscow[m] = [];
  });
  roadmaps.forEach((p) => {
    const moscow = (p.moscowCategory != null && String(p.moscowCategory).trim() !== "" && moscowList.includes(p.moscowCategory))
      ? p.moscowCategory
      : "Could have";
    if (!byMoscow[moscow]) byMoscow[moscow] = [];
    byMoscow[moscow].push(p);
  });

  gridOrder.forEach((moscow) => {
    const list = byMoscow[moscow] || [];
    if (state.moscowSortByRice) {
      list.sort((a, b) => {
        const scoreA = a.riceScore != null ? a.riceScore : calculateRiceScore(a);
        const scoreB = b.riceScore != null ? b.riceScore : calculateRiceScore(b);
        return scoreB - scoreA;
      });
    } else {
      if (activeProfile.moscowOrder && Array.isArray(activeProfile.moscowOrder[moscow]) && activeProfile.moscowOrder[moscow].length) {
        const orderIds = activeProfile.moscowOrder[moscow];
        const byId = {};
        list.forEach((p) => { byId[p.id] = p; });
        const ordered = [];
        orderIds.forEach((id) => { if (byId[id]) { ordered.push(byId[id]); delete byId[id]; } });
        Object.values(byId).sort((a, b) => compareDatesDesc(a.createdAt, b.createdAt)).forEach((p) => ordered.push(p));
        byMoscow[moscow].length = 0;
        ordered.forEach((p) => byMoscow[moscow].push(p));
      } else {
        list.sort((a, b) => compareDatesDesc(a.createdAt, b.createdAt));
      }
    }
  });

  gridOrder.forEach((moscow) => {
    const cell = document.createElement("div");
    cell.className = "moscow-board-column moscow-grid-cell";
    cell.setAttribute("data-moscow", moscow);
    cell.setAttribute("role", "region");
    cell.setAttribute("aria-label", "Quadrant: " + moscow);

    const header = document.createElement("div");
    header.className = "moscow-quadrant-header";
    const tip = moscowTooltips && moscowTooltips[moscow];
    const gridDesc = tip && tip.gridDescription ? tip.gridDescription : "";
    const headerTop = document.createElement("div");
    headerTop.className = "moscow-quadrant-header__top";
    const titleLine = document.createElement("div");
    titleLine.className = "moscow-quadrant-header__title-line";
    const labelBox = document.createElement("div");
    labelBox.className = "moscow-quadrant-label";
    const titleSpan = document.createElement("span");
    titleSpan.className = "moscow-quadrant-short";
    titleSpan.textContent = getMoscowDisplayName(moscow);
    labelBox.appendChild(titleSpan);
    titleLine.appendChild(labelBox);
    if (gridDesc) {
      const descEl = document.createElement("p");
      descEl.className = "moscow-quadrant-description";
      descEl.textContent = gridDesc;
      titleLine.appendChild(descEl);
    }
    headerTop.appendChild(titleLine);
    const count = document.createElement("span");
    count.className = "moscow-board-column-count";
    count.textContent = String((byMoscow[moscow] || []).length);
    headerTop.appendChild(count);
    header.appendChild(headerTop);
    const fullName = document.createElement("p");
    fullName.className = "moscow-quadrant-fullname";
    fullName.textContent = moscow;
    header.appendChild(fullName);
    cell.appendChild(header);

    const cardsContainer = document.createElement("div");
    cardsContainer.className = "moscow-board-column-cards";
    cardsContainer.addEventListener("scroll", () => hideCellTypeTooltips(), { passive: true });

    (byMoscow[moscow] || []).forEach((roadmap, index) => {
      const card = document.createElement("div");
      card.className = "moscow-board-card";
      card.setAttribute("draggable", demoReadOnly ? "false" : "true");
      card.setAttribute("data-roadmap-id", roadmap.id);
      card.setAttribute(
        "aria-label",
        demoReadOnly
          ? "Roadmap: " + (roadmap.title || "Untitled") + ". View only."
          : "Roadmap: " + (roadmap.title || "Untitled") + ". Drag to change MOSCOW category. View, Edit, Delete."
      );
      if (
        isSuperAdminModeActive() &&
        roadmap.ownerProfileId &&
        roadmap.ownerProfileId !== state.activeProfileId
      ) {
        card.classList.add("portfolio-board-card--external-profile");
      }
      prependPortfolioCardOwnerStrip(card, roadmap);

      const titleRow = document.createElement("div");
      titleRow.className = "moscow-board-card-title-row";
      const titleEl = buildCardTitleTooltipElement("moscow-board-card-title", roadmap);
      titleRow.appendChild(titleEl);

      const meta = document.createElement("div");
      meta.className = "moscow-board-card-meta";
      meta.appendChild(buildBoardCardMetricsRow(roadmap, "moscow-board-card"));
      appendPortfolioCardBody(card, titleRow, meta);

      const moveEl = isCompactPortfolioLayout()
        ? buildMoscowCardMoveSelect(roadmap, moscow, { disabled: demoReadOnly })
        : null;

      const actions = document.createElement("div");
      actions.className = "moscow-board-card-actions";
      const listForQuadrant = byMoscow[moscow] || [];
      const isFirst = index === 0;
      const isLast = index === listForQuadrant.length - 1;
      const orderDisabled = demoReadOnly || state.moscowSortByRice;
      const upBtn = document.createElement("button");
      upBtn.type = "button";
      upBtn.className = "moscow-board-card-btn moscow-board-card-btn--order";
      upBtn.setAttribute("data-action", "moscowMoveUp");
      upBtn.setAttribute("data-roadmap-id", roadmap.id);
      upBtn.setAttribute("data-moscow", moscow);
      upBtn.setAttribute("aria-label", "Move roadmap up in quadrant");
      upBtn.title = "Move up";
      upBtn.innerHTML = "↑";
      upBtn.disabled = orderDisabled || isFirst;
      const downBtn = document.createElement("button");
      downBtn.type = "button";
      downBtn.className = "moscow-board-card-btn moscow-board-card-btn--order";
      downBtn.setAttribute("data-action", "moscowMoveDown");
      downBtn.setAttribute("data-roadmap-id", roadmap.id);
      downBtn.setAttribute("data-moscow", moscow);
      downBtn.setAttribute("aria-label", "Move roadmap down in quadrant");
      downBtn.title = "Move down";
      downBtn.innerHTML = "↓";
      downBtn.disabled = orderDisabled || isLast;
      if (!demoReadOnly) {
        upBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          moveMoscowRoadmapUp(roadmap.id, moscow);
        });
        downBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          moveMoscowRoadmapDown(roadmap.id, moscow);
        });
      } else {
        upBtn.title = DEMO_READ_ONLY_ACTION_TITLE;
        downBtn.title = DEMO_READ_ONLY_ACTION_TITLE;
      }
      const orderGroup = document.createElement("div");
      orderGroup.className = "moscow-board-card-actions-order";
      orderGroup.appendChild(upBtn);
      orderGroup.appendChild(downBtn);
      const viewBtn = document.createElement("button");
      viewBtn.type = "button";
      viewBtn.className = "moscow-board-card-btn moscow-board-card-btn--view";
      viewBtn.setAttribute("data-roadmap-id", roadmap.id);
      setPortfolioCardActionButton(viewBtn, "view", "View");
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "moscow-board-card-btn moscow-board-card-btn--edit";
      editBtn.setAttribute("data-roadmap-id", roadmap.id);
      setPortfolioCardActionButton(editBtn, "edit", "Edit");
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "moscow-board-card-btn moscow-board-card-btn--delete";
      deleteBtn.setAttribute("data-roadmap-id", roadmap.id);
      setPortfolioCardActionButton(deleteBtn, "delete", "Delete");
      if (demoReadOnly) {
        editBtn.disabled = true;
        deleteBtn.disabled = true;
        editBtn.title = DEMO_READ_ONLY_ACTION_TITLE;
        deleteBtn.title = DEMO_READ_ONLY_ACTION_TITLE;
      }
      viewBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openRoadmapModal("view", roadmap.id);
      });
      actions.appendChild(viewBtn);
      if (!demoReadOnly) {
        editBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          openRoadmapModal("edit", roadmap.id);
        });
        deleteBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          handleSingleDelete(roadmap.id);
        });
      }
      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);
      actions.appendChild(orderGroup);
      appendPortfolioCardFooter(card, moveEl, actions);

      cardsContainer.appendChild(card);
    });

    cell.appendChild(cardsContainer);
    elements.moscowBoardContainer.appendChild(cell);
  });

  bindMoscowBoardDragAndDrop();
  if (typeof BoardCardInteraction !== "undefined") {
    BoardCardInteraction.bindContainer(elements.moscowBoardContainer);
  }
  syncMoscowCompactNav();
}

function bindMoscowBoardDragAndDrop() {
  if (!elements.moscowBoardContainer || typeof BoardDrag === "undefined") return;
  const cards = elements.moscowBoardContainer.querySelectorAll(".moscow-board-card");
  const columns = elements.moscowBoardContainer.querySelectorAll(".moscow-board-column");

  let draggedCard = null;
  let draggedRoadmapId = null;
  let dropColumn = null;

  elements.moscowBoardContainer.addEventListener("dragover", (e) => {
    if (!BoardDrag.getSession()) return;
    e.preventDefault();
    BoardDrag.movePointer(e.clientX, e.clientY);
  });

  cards.forEach((card) => {
    card.addEventListener("dragstart", (e) => {
      if (isActiveDemoProfile()) {
        e.preventDefault();
        return;
      }
      if (e.target.closest(".moscow-board-card-actions, .portfolio-card-move")) {
        e.preventDefault();
        return;
      }
      draggedCard = card;
      draggedRoadmapId = card.getAttribute("data-roadmap-id");
      if (typeof BoardCardInteraction !== "undefined") BoardCardInteraction.clearPressed();
      BoardDrag.begin(card, e, {
        draggingClass: "moscow-board-card--dragging",
        columnDragOverClass: "moscow-board-column--drag-over",
        createLegacyGhost: createDragGhost
      });
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", draggedRoadmapId);
      e.dataTransfer.setData("application/x-roadmap-id", draggedRoadmapId);
    });

    card.addEventListener("dragend", () => {
      BoardDrag.end();
      draggedCard = null;
      draggedRoadmapId = null;
      dropColumn = null;
    });
  });

  columns.forEach((column) => {
    column.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      BoardDrag.movePointer(e.clientX, e.clientY);
      if (!draggedRoadmapId) return;
      dropColumn = column;
      BoardDrag.setColumnHighlight(column, true);
      const cardsContainer = column.querySelector(".moscow-board-column-cards");
      const dropIndex = BoardDrag.computeDropIndex(cardsContainer, e.clientY, draggedCard);
      BoardDrag.showIndicator(cardsContainer, dropIndex, draggedCard);
    });

    column.addEventListener("dragleave", (e) => {
      if (!column.contains(e.relatedTarget)) {
        BoardDrag.setColumnHighlight(column, false);
      }
    });

    column.addEventListener("drop", (e) => {
      e.preventDefault();
      BoardDrag.setColumnHighlight(column, false);
      BoardDrag.clearIndicator();
      BoardDrag.clearColumnHighlights(elements.moscowBoardContainer);
      if (!draggedRoadmapId) return;
      const targetColumn = dropColumn || column.closest(".moscow-board-column");
      if (!targetColumn) return;
      const newMoscow = targetColumn.getAttribute("data-moscow");
      setRoadmapMoscowCategory(draggedRoadmapId, newMoscow);
    });
  });

  elements.moscowBoardContainer.addEventListener("drop", (e) => {
    if (!dropColumn || !draggedRoadmapId) return;
    if (e.target.closest(".moscow-board-column")) return;
    e.preventDefault();
    e.stopPropagation();
    BoardDrag.clearColumnHighlights(elements.moscowBoardContainer);
    BoardDrag.clearIndicator();
    const newMoscow = dropColumn.getAttribute("data-moscow");
    setRoadmapMoscowCategory(draggedRoadmapId, newMoscow);
  }, true);
}

function applyFilters(roadmaps) {
  const titleQuery = (elements.filterTitle.value || "").trim().toLowerCase();
  const selectedPeriodsFilter = getSelectedFilterRoadmapPeriods();
  const impactFilter = elements.filterImpact.value;
  const effortFilter = elements.filterEffort.value;
  const currencyFilter = elements.filterCurrency.value;
  const frameworkFilter = elements.filterFinancialFramework ? elements.filterFinancialFramework.value : "";
  const statusFilter = elements.filterStatus ? elements.filterStatus.value : "";
  const tshirtFilter = elements.filterTshirtSize ? elements.filterTshirtSize.value : "";
  const moscowFilter = elements.filterMoscow ? elements.filterMoscow.value : "";
  const roadmapTypeFilter = elements.filterRoadmapType.value;
  const selectedCountriesFilter = getSelectedFilterCountries();
  const labelQuery = elements.filterLabel ? (elements.filterLabel.value || "").trim().toLowerCase() : "";
  const labelsFilter = elements.filterLabels ? elements.filterLabels.value : "";
  const linksFilter = elements.filterLinks ? elements.filterLinks.value : "";
  const ownerProfileFilter =
    elements.filterOwnerProfile && isSuperAdminModeActive()
      ? (elements.filterOwnerProfile.value || "").trim()
      : "";

  return roadmaps.filter((p) => {
    if (titleQuery) {
      const title = (p.title || "").toLowerCase();
      if (!title.includes(titleQuery)) return false;
    }

    if (selectedPeriodsFilter.length) {
      const roadmapPeriod = (p.roadmapPeriod || "").toString().trim().toUpperCase();
      if (!roadmapPeriod || !selectedPeriodsFilter.includes(roadmapPeriod)) return false;
    }

    if (impactFilter) {
      if (String(p.impactValue || "") !== impactFilter) return false;
    }

    if (effortFilter) {
      if (String(p.effortValue || "") !== effortFilter) return false;
    }

    if (currencyFilter) {
      if ((p.financialImpactCurrency || "") !== currencyFilter) return false;
    }

    if (frameworkFilter) {
      const roadmapFramework = normalizeFinancialFramework(p.financialImpactFramework);
      if (roadmapFramework !== frameworkFilter) return false;
    }

    if (statusFilter) {
      if ((p.roadmapStatus || "") !== statusFilter) return false;
    }

    if (tshirtFilter) {
      const roadmapSize = (p.tshirtSize || "").toString().trim();
      if (tshirtFilter === "__none__") {
        if (roadmapSize !== "") return false;
      } else {
        if (roadmapSize !== tshirtFilter) return false;
      }
    }

    if (moscowFilter) {
      if ((p.moscowCategory || "") !== moscowFilter) return false;
    }

    if (roadmapTypeFilter) {
      const roadmapType = (p.roadmapType || "").toString().trim();
      if (roadmapTypeFilter === "__none__") {
        if (roadmapType !== "") return false;
      } else {
        if (roadmapType !== roadmapTypeFilter) return false;
      }
    }

    if (selectedCountriesFilter.length) {
      const projCountries = Array.isArray(p.countries) ? p.countries : [];
      const hasMatch = projCountries.some((c) => selectedCountriesFilter.includes(c));
      if (!hasMatch) return false;
    }

    if (labelQuery && !roadmapMatchesLabelFilter(p, labelQuery)) {
      return false;
    }

    if (labelsFilter === "with" && !roadmapHasLabels(p)) {
      return false;
    }
    if (labelsFilter === "without" && roadmapHasLabels(p)) {
      return false;
    }

    if (linksFilter === "with" && !roadmapHasLinks(p)) {
      return false;
    }
    if (linksFilter === "without" && roadmapHasLinks(p)) {
      return false;
    }

    if (ownerProfileFilter && (p.ownerProfileId || "") !== ownerProfileFilter) {
      return false;
    }

    return true;
  });
}

function sortRoadmaps(roadmaps) {
  if (state.tableSortByRice) {
    return roadmaps.slice().sort((a, b) => {
      const scoreA = a.riceScore != null ? a.riceScore : calculateRiceScore(a);
      const scoreB = b.riceScore != null ? b.riceScore : calculateRiceScore(b);
      if (scoreA === scoreB) {
        return compareDatesDesc(a.createdAt, b.createdAt);
      }
      return scoreB - scoreA;
    });
  }

  const field = state.sortField || "createdAt";
  const direction = state.sortDirection === "asc" ? 1 : -1;

  return roadmaps.slice().sort((a, b) => {
    if (
      field === "title" ||
      field === "ownerProfileName" ||
      field === "roadmapType" ||
      field === "roadmapStatus" ||
      field === "financialImpactFramework" ||
      field === "tshirtSize" ||
      field === "financialImpactCurrency" ||
      field === "moscowCategory"
    ) {
      const va = (
        field === "ownerProfileName" ? a.ownerProfileName || "" : a[field] || ""
      )
        .toString()
        .toLowerCase();
      const vb = (
        field === "ownerProfileName" ? b.ownerProfileName || "" : b[field] || ""
      )
        .toString()
        .toLowerCase();
      if (va === vb) {
        return compareDatesDesc(a.createdAt, b.createdAt);
      }
      return va < vb ? -1 * direction : 1 * direction;
    }

    if (field === "riceScore" || field === "financialImpactValue" || field === "impactValue" || field === "effortValue") {
      const va = Number(field === "riceScore" ? calculateRiceScore(a) : (a[field] ?? 0));
      const vb = Number(field === "riceScore" ? calculateRiceScore(b) : (b[field] ?? 0));
      if (va === vb) {
        return compareDatesDesc(a.createdAt, b.createdAt);
      }
      return va < vb ? -1 * direction : 1 * direction;
    }

    if (field === "createdAt" || field === "modifiedAt") {
      const da = new Date(a[field] || a.createdAt || 0).getTime();
      const db = new Date(b[field] || b.createdAt || 0).getTime();
      if (da === db) return 0;
      return da < db ? -1 * direction : 1 * direction;
    }

    return compareDatesDesc(a.createdAt, b.createdAt);
  });
}

function toggleSort(field) {
  if (state.tableSortByRice) {
    state.tableSortByRice = false;
    if (elements.tableSortByRiceToggle) elements.tableSortByRiceToggle.checked = false;
  }
  if (state.sortField === field) {
    state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
  } else {
    state.sortField = field;
    state.sortDirection = field === "title" ? "asc" : "desc";
  }
  saveState();
  updateSortIndicators();
  renderRoadmaps();
}

function updateSortIndicators() {
  const headerCells = document.querySelectorAll("th[data-sort-field]");
  headerCells.forEach((th) => {
    const field = th.getAttribute("data-sort-field");
    const active = state.tableSortByRice ? field === "riceScore" : field === state.sortField;
    th.dataset.sortActive = active ? "true" : "false";
    const indicator = th.querySelector(".sort-indicator");
    if (indicator) {
      if (!active) {
        indicator.textContent = "↕";
      } else {
        const direction =
          state.tableSortByRice && field === "riceScore" ? "desc" : state.sortDirection;
        indicator.textContent = direction === "asc" ? "↑" : "↓";
      }
    }
  });
}

function clearFilters() {
  closeAllFilterAutocompleteDropdowns();
  elements.filterTitle.value = "";
  elements.filterImpact.value = "";
  elements.filterEffort.value = "";
  elements.filterCurrency.value = "";
  if (elements.filterFinancialFramework) elements.filterFinancialFramework.value = "";
  elements.filterRoadmapType.value = "";
  if (elements.filterStatus) elements.filterStatus.value = "";
  if (elements.filterTshirtSize) elements.filterTshirtSize.value = "";
  if (elements.filterMoscow) elements.filterMoscow.value = "";
  if (elements.filterLabel) elements.filterLabel.value = "";
  if (elements.filterLabels) elements.filterLabels.value = "";
  if (elements.filterLinks) elements.filterLinks.value = "";
  if (elements.filterOwnerProfile) elements.filterOwnerProfile.value = "";
  if (elements.filterRoadmapPeriodSearch) {
    elements.filterRoadmapPeriodSearch.value = "";
  }
  if (elements.filterRoadmapPeriodList) {
    const checkboxes = elements.filterRoadmapPeriodList.querySelectorAll("input[type=\"checkbox\"]");
    checkboxes.forEach((cb) => {
      cb.checked = false;
    });
  }
  if (elements.filterCountriesSearch) {
    elements.filterCountriesSearch.value = "";
  }
  if (elements.filterCountriesList) {
    const checkboxes = elements.filterCountriesList.querySelectorAll("input[type=\"checkbox\"]");
    checkboxes.forEach((cb) => {
      cb.checked = false;
    });
    filterFilterCountriesBySearchTerm();
  }
  updateFiltersActivePill();
  updateFilterRoadmapPeriodsSummary();
  updateFilterCountriesSummary();
}

function isTableCompactLayout() {
  return (
    document.documentElement.classList.contains("is-compact-layout") ||
    isCompactLayoutViewport()
  );
}

function getTableSelectionCount() {
  return Array.from(getRoadmapSelectCheckboxes()).filter((cb) => cb.checked).length;
}

function syncRoadmapTableSelection() {
  syncHeaderCheckbox();
  updateBulkSelectionActions();
  syncRoadmapTableCardSelectionStyles();
}

function clearRoadmapSelection() {
  getRoadmapSelectCheckboxes().forEach((cb) => {
    cb.checked = false;
  });
  if (elements.selectAllRoadmaps) elements.selectAllRoadmaps.checked = false;
  syncRoadmapTableSelection();
}

function updateBulkSelectionActions() {
  const count = getTableSelectionCount();
  const anyChecked = count > 0;
  const inTableView = state.roadmapsView === "table";
  const isCompactTable = isTableCompactLayout();
  const superAdmin = isSuperAdminModeActive();
  const demoLocked = isActiveDemoProfile();
  const showToolbarBtns = inTableView && anyChecked && !isCompactTable;
  const showMobileBar = inTableView && anyChecked && isCompactTable;

  const syncToolbarBtn = (btn, { show = showToolbarBtns, superAdminOnly = false } = {}) => {
    if (!btn) return;
    const visible = show && (!superAdminOnly || superAdmin);
    btn.hidden = !visible;
    btn.disabled = !anyChecked || demoLocked;
    if (demoLocked) {
      btn.title = DEMO_READ_ONLY_ACTION_TITLE;
    } else {
      btn.removeAttribute("title");
    }
  };

  syncToolbarBtn(elements.bulkDeleteBtn);
  syncToolbarBtn(elements.bulkDuplicateBtn, { superAdminOnly: true });
  syncToolbarBtn(elements.bulkMoveBtn, { superAdminOnly: true });

  if (elements.portfolioSelectionBar) {
    elements.portfolioSelectionBar.hidden = !showMobileBar;
    elements.portfolioSelectionBar.classList.toggle("portfolio-selection-bar--visible", showMobileBar);
  }
  document.documentElement.classList.toggle("has-portfolio-selection-bar", showMobileBar);
  if (elements.portfolioSelectionCount) {
    elements.portfolioSelectionCount.textContent =
      count === 1 ? "1 selected" : `${count} selected`;
  }

  const syncMobileBtn = (btn, { superAdminOnly = false } = {}) => {
    if (!btn) return;
    const visible = showMobileBar && (!superAdminOnly || superAdmin);
    btn.hidden = !visible;
    btn.disabled = !anyChecked || demoLocked;
    if (demoLocked) {
      btn.title = DEMO_READ_ONLY_ACTION_TITLE;
    } else {
      btn.removeAttribute("title");
    }
  };

  syncMobileBtn(elements.portfolioSelectionDeleteBtn);
  syncMobileBtn(elements.portfolioSelectionDuplicateBtn, { superAdminOnly: true });
  syncMobileBtn(elements.portfolioSelectionMoveBtn, { superAdminOnly: true });
}

function syncHeaderCheckbox() {
  if (!elements.selectAllRoadmaps) return;
  const checkboxes = getRoadmapSelectCheckboxes();
  if (!checkboxes.length) {
    elements.selectAllRoadmaps.checked = false;
    return;
  }
  const allChecked = Array.from(checkboxes).every((cb) => cb.checked);
  elements.selectAllRoadmaps.checked = allChecked;
}

function handleBulkDelete() {
  if (state.roadmapsView !== "table") return;
  if (!requireWritableActiveProfile("Bulk delete")) return;
  if (!getUnlockedActiveProfile() || !elements.roadmapDeleteModal) return;
  const ids = getSelectedRoadmapIdsFromTable();
  if (!ids.length) return;

  activateBlockingModal(elements.roadmapDeleteModal, "roadmapDeleteModal");
  elements.roadmapDeleteModal.setAttribute("data-delete-mode", "bulk");
  elements.roadmapDeleteModal.setAttribute("data-roadmap-ids", ids.join(","));

  if (elements.roadmapDeleteNameLabel) {
    elements.roadmapDeleteNameLabel.textContent = `${ids.length} roadmap${ids.length === 1 ? "" : "s"} selected`;
  }
  if (elements.roadmapDeleteWarningText) {
    elements.roadmapDeleteWarningText.textContent = isSuperAdminModeActive()
      ? "This will permanently remove the selected roadmaps from their owner profiles. This action cannot be undone."
      : "This will permanently remove the selected roadmaps from this profile. This action cannot be undone.";
  }

  if (elements.roadmapDeleteConfirmBtn) {
    elements.roadmapDeleteConfirmBtn.onclick = () => {
      const mode = elements.roadmapDeleteModal.getAttribute("data-delete-mode") || "single";
      if (mode === "bulk") {
        const idsAttr = elements.roadmapDeleteModal.getAttribute("data-roadmap-ids") || "";
        const idList = idsAttr ? idsAttr.split(",").filter(Boolean) : [];
        if (!idList.length) {
          closeRoadmapDeleteModal();
          return;
        }
        const count = removeRoadmapsByIds(idList);
        saveState();
        renderRoadmaps();
        closeRoadmapDeleteModal();
        showToast(count === 1 ? "Roadmap deleted successfully." : count + " roadmaps deleted successfully.");
      }
    };
  }

  if (elements.roadmapDeleteCancelBtn) {
    elements.roadmapDeleteCancelBtn.onclick = () => {
      closeRoadmapDeleteModal();
    };
  }
}

function closeRoadmapBulkTransferModal({ immediate = false } = {}) {
  if (!elements.roadmapBulkTransferModal) return;
  deactivateBlockingModal(elements.roadmapBulkTransferModal, { immediate });
  elements.roadmapBulkTransferModal.removeAttribute("data-transfer-mode");
  elements.roadmapBulkTransferModal.removeAttribute("data-roadmap-ids");
}

function handleBulkRoadmapTransfer(mode) {
  if (state.roadmapsView !== "table") return;
  if (!isSuperAdminModeActive()) return;
  const actionLabel = mode === "move" ? "Move roadmaps" : "Duplicate roadmaps";
  if (!requireWritableActiveProfile(actionLabel)) return;
  if (!getUnlockedActiveProfile() || !elements.roadmapBulkTransferModal) return;

  const ids = getSelectedRoadmapIdsFromTable();
  if (!ids.length) return;

  activateBlockingModal(elements.roadmapBulkTransferModal, "roadmapBulkTransferModal");
  elements.roadmapBulkTransferModal.setAttribute("data-transfer-mode", mode);
  elements.roadmapBulkTransferModal.setAttribute("data-roadmap-ids", ids.join(","));

  const countLabel = `${ids.length} roadmap${ids.length === 1 ? "" : "s"} selected`;
  if (elements.roadmapBulkTransferModalTitle) {
    elements.roadmapBulkTransferModalTitle.textContent =
      mode === "move" ? "Move roadmaps to another profile" : "Duplicate roadmaps to another profile";
  }
  if (elements.roadmapBulkTransferCountLabel) {
    elements.roadmapBulkTransferCountLabel.textContent = countLabel;
  }
  if (elements.roadmapBulkTransferHelpText) {
    elements.roadmapBulkTransferHelpText.textContent =
      mode === "move"
        ? "Roadmaps will be removed from their current owner profiles and added to the profile you choose below."
        : "Copies of the selected roadmaps will be created in the profile you choose below. Original roadmaps stay unchanged.";
  }
  if (elements.roadmapBulkTransferConfirmBtn) {
    elements.roadmapBulkTransferConfirmBtn.textContent = mode === "move" ? "Move roadmaps" : "Duplicate roadmaps";
  }

  populateBulkTransferTargetProfileSelect(state.activeProfileId);

  if (elements.roadmapBulkTransferConfirmBtn) {
    elements.roadmapBulkTransferConfirmBtn.onclick = () => {
      const transferMode = elements.roadmapBulkTransferModal.getAttribute("data-transfer-mode") || "duplicate";
      const idsAttr = elements.roadmapBulkTransferModal.getAttribute("data-roadmap-ids") || "";
      const idList = idsAttr ? idsAttr.split(",").filter(Boolean) : [];
      const targetProfileId = elements.roadmapBulkTransferTargetProfile
        ? (elements.roadmapBulkTransferTargetProfile.value || "").trim()
        : "";
      const targetProfile = findProfileById(targetProfileId);
      if (!idList.length || !targetProfile) {
        showToast("Choose a valid target profile.");
        return;
      }

      let count = 0;
      if (transferMode === "move") {
        count = moveRoadmapsToProfile(idList, targetProfileId);
        if (!count) {
          showToast("No roadmaps moved. Choose a different profile than the current owner.");
          return;
        }
      } else {
        count = duplicateRoadmapsToProfile(idList, targetProfileId);
        if (!count) {
          showToast("Could not duplicate the selected roadmaps.");
          return;
        }
      }

      saveState({ flush: true });
      clearRoadmapSelection();
      renderRoadmaps();
      closeRoadmapBulkTransferModal();
      const profileName = targetProfile.name || "Unnamed profile";
      if (transferMode === "move") {
        showToast(
          count === 1
            ? `Roadmap moved to profile “${profileName}”.`
            : `${count} roadmaps moved to profile “${profileName}”.`
        );
      } else {
        showToast(
          count === 1
            ? `Roadmap duplicated into profile “${profileName}”.`
            : `${count} roadmaps duplicated into profile “${profileName}”.`
        );
      }
    };
  }

  if (elements.roadmapBulkTransferCancelBtn) {
    elements.roadmapBulkTransferCancelBtn.onclick = () => {
      closeRoadmapBulkTransferModal();
    };
  }
}

function closeRoadmapDeleteModal({ immediate = false } = {}) {
  if (!elements.roadmapDeleteModal) return;
  deactivateBlockingModal(elements.roadmapDeleteModal, { immediate });
  elements.roadmapDeleteModal.removeAttribute("data-roadmap-id");
  elements.roadmapDeleteModal.removeAttribute("data-roadmap-ids");
  elements.roadmapDeleteModal.removeAttribute("data-delete-mode");
}

function closeProfileDeleteModal({ immediate = false } = {}) {
  if (!elements.profileDeleteModal) return;
  deactivateBlockingModal(elements.profileDeleteModal, { immediate });
  elements.profileDeleteModal.removeAttribute("data-profile-id");
  if (elements.profileDeletePassword) elements.profileDeletePassword.value = "";
  if (elements.profileDeletePasswordWrap) elements.profileDeletePasswordWrap.style.display = "none";
  if (elements.profileDeletePasswordError) {
    elements.profileDeletePasswordError.style.display = "none";
    elements.profileDeletePasswordError.textContent = "";
  }
  if (elements.profileDeleteConfirmBtn) elements.profileDeleteConfirmBtn.disabled = true;
}

function showProfileUnlockError(message) {
  if (!elements.profileUnlockError) return;
  elements.profileUnlockError.textContent = message;
  elements.profileUnlockError.style.display = message ? "block" : "none";
}

function hideProfileUnlockError() {
  showProfileUnlockError("");
}

/**
 * Verifies password and unlocks profile for this tab session.
 * @returns {Promise<boolean>} true when unlocked
 */
async function attemptProfileUnlock(profileId, password, options) {
  if (typeof ProfileSecurity === "undefined") {
    const msg = "Profile security module failed to load. Refresh the page.";
    if (options && options.source === "inline") {
      showProfileLockedInlineError(msg);
    } else {
      showProfileUnlockError(msg);
    }
    return false;
  }
  const profile = state.profiles.find((p) => p.id === profileId);
  if (!profile) return false;
  if (!isProfilePasswordProtected(profile)) {
    markProfileUnlocked(profileId);
    return true;
  }
  if (typeof ProfileSecurity === "undefined") {
    const msg = "Password security is unavailable. Reload the page and try again.";
    if (options && options.source === "inline") {
      showProfileLockedInlineError(msg);
    } else {
      showProfileUnlockError(msg);
    }
    return false;
  }
  const ok = await ProfileSecurity.verifyProfilePassword(
    password,
    profile.passwordSalt,
    profile.passwordHash
  );
  if (!ok) {
    const failMsg = "Incorrect password. Try again.";
    if (options && options.source === "inline") {
      showProfileLockedInlineError(failMsg);
      if (elements.profileLockedInlinePassword) {
        elements.profileLockedInlinePassword.focus();
        elements.profileLockedInlinePassword.select();
      }
    } else {
      showProfileUnlockError(failMsg);
      if (elements.profileUnlockPassword) {
        elements.profileUnlockPassword.focus();
        elements.profileUnlockPassword.select();
      }
    }
    return false;
  }
  markProfileUnlocked(profileId);
  showProfileLockedInlineError("");
  hideProfileUnlockError();
  return true;
}

async function completeProfileUnlockSuccess(profileId) {
  const action = pendingUnlockAction;
  pendingUnlockAction = null;
  closeProfileUnlockModal();
  if (!state.activeProfileId) {
    state.activeProfileId = profileId;
    saveState();
  }
  renderProfiles();
  renderRoadmaps();
  if (action && action.type === "edit") {
    openProfileEditModal(profileId);
  } else if (action && action.type === "view") {
    openProfileViewModal(profileId);
  }
  showToast("Profile unlocked.");
}

function openProfileUnlockModal(profileId) {
  const profile = state.profiles.find((p) => p.id === profileId);
  if (!profile || !elements.profileUnlockModal) return;
  activateBlockingModal(elements.profileUnlockModal, "profileUnlockModal");
  elements.profileUnlockModal.setAttribute("data-profile-id", profileId);
  if (elements.profileUnlockModalSubtitle) {
    elements.profileUnlockModalSubtitle.textContent = `Enter the password for “${profile.name || "this profile"}” to continue.`;
  }
  if (elements.profileUnlockPassword) {
    elements.profileUnlockPassword.value = "";
  }
  hideProfileUnlockError();
  if (elements.profileUnlockPassword) {
    setTimeout(() => elements.profileUnlockPassword.focus(), 50);
  }
}

function closeProfileUnlockModal({ immediate = false } = {}) {
  if (!elements.profileUnlockModal) return;
  deactivateBlockingModal(elements.profileUnlockModal, { immediate });
  elements.profileUnlockModal.removeAttribute("data-profile-id");
  if (elements.profileUnlockPassword) elements.profileUnlockPassword.value = "";
  hideProfileUnlockError();
  pendingUnlockAction = null;
}

async function handleProfileUnlockConfirm() {
  const profileId = elements.profileUnlockModal && elements.profileUnlockModal.getAttribute("data-profile-id");
  if (!profileId) return;
  const profile = state.profiles.find((p) => p.id === profileId);
  if (!profile) {
    closeProfileUnlockModal();
    return;
  }
  const password = elements.profileUnlockPassword ? elements.profileUnlockPassword.value : "";
  const ok = await attemptProfileUnlock(profileId, password, { source: "modal" });
  if (!ok) return;
  await completeProfileUnlockSuccess(profileId);
}

function updateProfileDeleteConfirmState() {
  if (!elements.profileDeleteConfirmBtn || !elements.profileDeleteModal) return;
  const profileId = elements.profileDeleteModal.getAttribute("data-profile-id");
  const profile = state.profiles.find((p) => p.id === profileId);
  if (!profile) {
    elements.profileDeleteConfirmBtn.disabled = true;
    return;
  }
  if (!isProfilePasswordProtected(profile)) {
    elements.profileDeleteConfirmBtn.disabled = false;
    if (elements.profileDeletePasswordError) {
      elements.profileDeletePasswordError.style.display = "none";
    }
    return;
  }
  const password = elements.profileDeletePassword ? elements.profileDeletePassword.value : "";
  if (!password) {
    elements.profileDeleteConfirmBtn.disabled = true;
    return;
  }
  ProfileSecurity.verifyProfilePassword(password, profile.passwordSalt, profile.passwordHash)
    .then((ok) => {
      elements.profileDeleteConfirmBtn.disabled = !ok;
      if (elements.profileDeletePasswordError) {
        if (password && !ok) {
          elements.profileDeletePasswordError.textContent = "Incorrect password.";
          elements.profileDeletePasswordError.style.display = "block";
        } else {
          elements.profileDeletePasswordError.style.display = "none";
          elements.profileDeletePasswordError.textContent = "";
        }
      }
    })
    .catch((err) => {
      console.error("Delete password check failed:", err);
      elements.profileDeleteConfirmBtn.disabled = true;
    });
}

function showToast(message) {
  const container = elements.toastContainer || document.getElementById("toastContainer");
  if (!container || !message) return;
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.setAttribute("role", "alert");
  toast.innerHTML = `
    <span class="toast-icon" aria-hidden="true">✓</span>
    <span class="toast-message">${escapeHtml(message)}</span>
  `;
  container.appendChild(toast);
  const duration = 4200;
  const exitDuration = 250;
  const timer = setTimeout(() => {
    toast.classList.add("toast-exit");
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, exitDuration);
  }, duration);
  toast.addEventListener("click", () => {
    clearTimeout(timer);
    toast.classList.add("toast-exit");
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, exitDuration);
  });
}

function computeNumericStats(values) {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const mid = Math.floor(n / 2);
  const median = n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return {
    mean: sum / n,
    median,
    min: sorted[0],
    max: sorted[n - 1],
    total: sum
  };
}

function renderProfileViewStatsGrid(container, values, { formatValue, emptyMessage } = {}) {
  if (!container) return;
  container.innerHTML = "";
  const format = typeof formatValue === "function" ? formatValue : (v) => String(v);

  if (!values.length) {
    const empty = document.createElement("p");
    empty.className = "profile-view-rice-empty";
    empty.textContent = emptyMessage || "No data yet.";
    container.appendChild(empty);
    return;
  }

  const stats = computeNumericStats(values);
  if (!stats) return;

  const rows = [
    ["Mean", stats.mean, false],
    ["Median", stats.median, false],
    ["Min", stats.min, false],
    ["Max", stats.max, false],
    ["Total", stats.total, true]
  ];

  rows.forEach(([label, value, isTotal]) => {
    const card = document.createElement("div");
    card.className = "profile-view-rice-card" + (isTotal ? " profile-view-rice-card--total" : "");

    const labelEl = document.createElement("span");
    labelEl.className = "profile-view-rice-label";
    labelEl.textContent = label;

    const valueEl = document.createElement("span");
    valueEl.className = "profile-view-rice-value";
    valueEl.textContent = format(value);

    card.appendChild(labelEl);
    card.appendChild(valueEl);
    container.appendChild(card);
  });
}

function formatProfileViewFinancialEur(value) {
  if (!Number.isFinite(value)) return "€—";
  const short = typeof formatFinancialShort === "function"
    ? formatFinancialShort(value)
    : Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
  return `€${short}`;
}

function getRoadmapFinancialImpactEurAmount(roadmap) {
  if (!roadmap || roadmap.financialImpactValue == null || roadmap.financialImpactValue === "") return null;
  const raw = roadmap.financialImpactValue;
  const amount = Number.isFinite(raw) ? raw : Number(raw);
  if (!Number.isFinite(amount)) return null;
  const currency = (roadmap.financialImpactCurrency || "EUR").toString().trim().toUpperCase() || "EUR";
  if (typeof ExchangeRates !== "undefined" && typeof ExchangeRates.convertToEUR === "function") {
    const amountEur = ExchangeRates.convertToEUR(amount, currency);
    return Number.isFinite(amountEur) ? amountEur : null;
  }
  return currency === "EUR" ? amount : null;
}

function renderProfileViewFinancialStats(roadmaps) {
  const container = elements.profileViewFinancialStats;
  const note = elements.profileViewFinancialNote;
  if (!container) return;

  const showLoading = () => {
    container.innerHTML = "";
    const loading = document.createElement("p");
    loading.className = "profile-view-rice-empty";
    loading.textContent = "Loading exchange rates…";
    container.appendChild(loading);
    if (note) note.hidden = true;
  };

  const render = () => {
    const amounts = [];
    let skippedCount = 0;
    roadmaps.forEach((p) => {
      if (p.financialImpactValue == null || p.financialImpactValue === "") return;
      const eur = getRoadmapFinancialImpactEurAmount(p);
      if (Number.isFinite(eur)) {
        amounts.push(eur);
      } else {
        skippedCount += 1;
      }
    });

    if (note) {
      if (skippedCount > 0) {
        note.hidden = false;
        note.textContent =
          skippedCount === 1
            ? "1 roadmap with a non-EUR amount could not be converted. Exchange rates refresh daily."
            : `${skippedCount} roadmaps with non-EUR amounts could not be converted. Exchange rates refresh daily.`;
      } else {
        note.hidden = true;
        note.textContent = "";
      }
    }

    renderProfileViewStatsGrid(container, amounts, {
      formatValue: formatProfileViewFinancialEur,
      emptyMessage: "No financial impact yet. Add financial impact to roadmaps."
    });
  };

  showLoading();
  if (typeof ExchangeRates !== "undefined" && typeof ExchangeRates.ensure === "function") {
    ExchangeRates.ensure().then(render).catch(render);
  } else {
    render();
  }
}

function renderProfileViewBreakdownChips(container, counts, { sortOrder, labelFor, titleFor } = {}) {
  if (!container) return;
  container.innerHTML = "";
  const formatLabel = typeof labelFor === "function" ? labelFor : (key) => key;
  const formatTitle = typeof titleFor === "function" ? titleFor : null;
  let entries;
  if (Array.isArray(sortOrder) && sortOrder.length) {
    const used = new Set();
    entries = [];
    sortOrder.forEach((key) => {
      const count = counts[key] || 0;
      if (count > 0) {
        entries.push([key, count]);
        used.add(key);
      }
    });
    Object.entries(counts).forEach(([key, count]) => {
      if (!used.has(key) && count > 0) entries.push([key, count]);
    });
  } else {
    entries = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }
  if (!entries.length) {
    const empty = document.createElement("span");
    empty.className = "profile-view-empty";
    empty.textContent = "No data yet";
    container.appendChild(empty);
    return;
  }
  entries.forEach(([label, count]) => {
    const chip = document.createElement("span");
    chip.className = "profile-view-chip";
    const displayLabel = formatLabel(label);
    const tooltipText = formatTitle ? formatTitle(label) : displayLabel !== label ? label : "";
    if (tooltipText) chip.setAttribute("title", tooltipText);

    const labelEl = document.createElement("span");
    labelEl.className = "profile-view-chip-label";
    labelEl.textContent = displayLabel;

    const countEl = document.createElement("span");
    countEl.className = "profile-view-chip-count";
    countEl.textContent = String(count);

    chip.appendChild(labelEl);
    chip.appendChild(countEl);
    container.appendChild(chip);
  });
}

const PROFILE_VIEW_MOSCOW_SHORT_LABELS = {
  "Must have": "Must",
  "Should have": "Should",
  "Could have": "Could",
  "Won't have": "Won't",
};

function getProfileViewFrameworkChipLabel(frameworkKey) {
  const key = normalizeFinancialFramework(frameworkKey);
  const meta = FINANCIAL_FRAMEWORK_ICONS[key];
  return (meta && meta.label) || key;
}

function getProfileViewFrameworkChipTitle(frameworkKey) {
  const key = normalizeFinancialFramework(frameworkKey);
  const meta = FINANCIAL_FRAMEWORK_ICONS[key];
  if (meta && meta.tooltipTitle && meta.tooltipBody) {
    return `${meta.tooltipTitle} — ${meta.tooltipBody}`;
  }
  if (meta && meta.tooltipTitle) return meta.tooltipTitle;
  if (meta && meta.tooltipBody) return meta.tooltipBody;
  return getProfileViewFrameworkChipLabel(key);
}

const PROFILE_VIEW_NO_COUNTRIES_KEY = "No countries";

function buildProfileViewCountryCounts(roadmaps) {
  const counts = {};
  const list = Array.isArray(roadmaps) ? roadmaps : [];
  list.forEach((roadmap) => {
    const countries = normalizeCountryNames(
      Array.isArray(roadmap.countries) ? roadmap.countries : []
    );
    if (!countries.length) {
      counts[PROFILE_VIEW_NO_COUNTRIES_KEY] = (counts[PROFILE_VIEW_NO_COUNTRIES_KEY] || 0) + 1;
      return;
    }
    countries.forEach((countryName) => {
      counts[countryName] = (counts[countryName] || 0) + 1;
    });
  });
  return counts;
}

function getProfileViewCountryChipLabel(countryName) {
  if (countryName === PROFILE_VIEW_NO_COUNTRIES_KEY) return countryName;
  const code =
    typeof countryCodeByName !== "undefined" && countryCodeByName[countryName]
      ? countryCodeByName[countryName]
      : "";
  const flag = code && typeof countryCodeToFlag === "function" ? countryCodeToFlag(code) : "";
  if (flag && code) return `${flag} ${code}`;
  if (code) return code;
  return countryName;
}

function getProfileViewCountryChipTitle(countryName) {
  if (countryName === PROFILE_VIEW_NO_COUNTRIES_KEY) {
    return "Roadmaps without any target country set";
  }
  const code =
    typeof countryCodeByName !== "undefined" && countryCodeByName[countryName]
      ? countryCodeByName[countryName]
      : "";
  if (code) return `${countryName} (${code}) — roadmaps targeting this country`;
  return `${countryName} — roadmaps targeting this country`;
}

const PROFILE_VIEW_NO_CURRENCY_KEY = "Not set";

function getProfileViewRoadmapCurrencyKey(roadmap) {
  const currency = normalizeCurrency(roadmap && roadmap.financialImpactCurrency);
  return currency ? currency.toUpperCase() : PROFILE_VIEW_NO_CURRENCY_KEY;
}

function buildProfileViewCurrencyData(roadmaps) {
  const counts = {};
  const totals = {};
  const list = Array.isArray(roadmaps) ? roadmaps : [];
  list.forEach((roadmap) => {
    const key = getProfileViewRoadmapCurrencyKey(roadmap);
    counts[key] = (counts[key] || 0) + 1;
    if (roadmap.financialImpactValue == null || roadmap.financialImpactValue === "") return;
    const amount = Number(roadmap.financialImpactValue);
    if (!Number.isFinite(amount)) return;
    totals[key] = (totals[key] || 0) + amount;
  });
  return { counts, totals };
}

function buildProfileViewCurrencySortOrder(counts, totals) {
  const keys = Object.keys(counts).filter((key) => (counts[key] || 0) > 0);
  const priority =
    typeof currencyList !== "undefined" && Array.isArray(currencyList)
      ? currencyList.slice()
      : ["EUR", "USD", "GBP"];
  return keys.sort((a, b) => {
    if (a === PROFILE_VIEW_NO_CURRENCY_KEY) return 1;
    if (b === PROFILE_VIEW_NO_CURRENCY_KEY) return -1;
    const pa = priority.indexOf(a);
    const pb = priority.indexOf(b);
    if (pa !== -1 || pb !== -1) {
      if (pa === -1) return 1;
      if (pb === -1) return -1;
      return pa - pb;
    }
    const totalDiff = (totals[b] || 0) - (totals[a] || 0);
    if (totalDiff !== 0) return totalDiff;
    return a.localeCompare(b);
  });
}

function getProfileViewCurrencyChipLabel(currencyKey) {
  if (currencyKey === PROFILE_VIEW_NO_CURRENCY_KEY) return currencyKey;
  return typeof formatCurrencyChipLabel === "function"
    ? formatCurrencyChipLabel(currencyKey)
    : currencyKey;
}

function getProfileViewCurrencyChipTitle(currencyKey, count, total) {
  const roadmapsLabel = `${count} roadmap${count === 1 ? "" : "s"}`;
  if (currencyKey === PROFILE_VIEW_NO_CURRENCY_KEY) {
    let title = `Roadmaps without a currency set — ${roadmapsLabel}`;
    if (Number.isFinite(total) && total !== 0) {
      title += `, total impact ${typeof formatFinancialShort === "function" ? formatFinancialShort(total) : total} (no currency)`;
    }
    return title;
  }
  let title = `Roadmaps with original currency ${currencyKey} — ${roadmapsLabel}`;
  if (Number.isFinite(total) && total !== 0) {
    const formatted =
      typeof formatOriginalCurrencyAmount === "function"
        ? formatOriginalCurrencyAmount(total, currencyKey)
        : String(total);
    title += `, combined impact ${formatted}`;
    const eur = convertProfileViewCurrencyTotalToEur(total, currencyKey);
    if (Number.isFinite(eur) && currencyKey.toUpperCase() !== "EUR") {
      title += ` (${formatProfileViewFinancialEur(eur)} at latest rate)`;
    }
  }
  return title;
}

function convertProfileViewCurrencyTotalToEur(total, currencyKey) {
  if (!Number.isFinite(total)) return null;
  const code = (currencyKey || "").toString().trim().toUpperCase();
  if (!code || code === PROFILE_VIEW_NO_CURRENCY_KEY) return null;
  if (code === "EUR") return total;
  if (typeof ExchangeRates !== "undefined" && typeof ExchangeRates.convertToEUR === "function") {
    const eur = ExchangeRates.convertToEUR(total, code);
    return Number.isFinite(eur) ? eur : null;
  }
  return null;
}

function formatProfileViewCurrencyEurLine(total, currencyKey) {
  const code = (currencyKey || "").toString().trim().toUpperCase();
  if (code === "EUR") return null;
  const eur = convertProfileViewCurrencyTotalToEur(total, currencyKey);
  if (Number.isFinite(eur)) {
    return {
      amount: formatProfileViewFinancialEur(eur),
      caption: "Latest rate",
      variant: "converted",
    };
  }
  const hasRateApi =
    typeof ExchangeRates !== "undefined" && typeof ExchangeRates.hasRate === "function";
  if (hasRateApi && !ExchangeRates.hasRate(code)) {
    return {
      text: "EUR conversion unavailable for this currency",
      variant: "unavailable",
    };
  }
  return { text: "EUR conversion unavailable", variant: "unavailable" };
}

function renderProfileViewCurrencyTotals(container, note, roadmaps) {
  if (!container) return;

  const showLoading = () => {
    container.innerHTML = "";
    const loading = document.createElement("p");
    loading.className = "profile-view-rice-empty";
    loading.textContent = "Loading exchange rates…";
    container.appendChild(loading);
    if (note) note.hidden = false;
  };

  const render = () => {
    container.innerHTML = "";
    const { counts, totals } = buildProfileViewCurrencyData(roadmaps);
    const sortOrder = buildProfileViewCurrencySortOrder(counts, totals);
    const entries = sortOrder.filter(
      (key) => key !== PROFILE_VIEW_NO_CURRENCY_KEY && Number.isFinite(totals[key]) && totals[key] !== 0
    );

    let unavailableConversions = 0;

    if (!entries.length) {
      if (note) note.hidden = true;
      const empty = document.createElement("p");
      empty.className = "profile-view-rice-empty";
      empty.textContent = "No original-currency financial amounts yet.";
      container.appendChild(empty);
      return;
    }

    entries.forEach((currencyKey) => {
      const total = totals[currencyKey];
      const count = counts[currencyKey] || 0;
      const eurLine = formatProfileViewCurrencyEurLine(total, currencyKey);
      if (eurLine && eurLine.variant === "unavailable") unavailableConversions += 1;

      const card = document.createElement("div");
      card.className = "profile-view-currency-card";
      if (eurLine && eurLine.variant === "converted") {
        card.classList.add("profile-view-currency-card--dual");
      }
      const titleParts = [getProfileViewCurrencyChipTitle(currencyKey, count, total)];
      if (eurLine && eurLine.variant === "converted") {
        titleParts.push(`≈ ${eurLine.amount} at latest rate`);
      }
      card.setAttribute("title", titleParts.join(" · "));

      const head = document.createElement("div");
      head.className = "profile-view-currency-card-head";

      const labelEl = document.createElement("span");
      labelEl.className = "profile-view-currency-card-label";
      labelEl.textContent = getProfileViewCurrencyChipLabel(currencyKey);

      const countEl = document.createElement("span");
      countEl.className = "profile-view-currency-card-count";
      countEl.textContent = `${count} roadmap${count === 1 ? "" : "s"}`;

      head.appendChild(labelEl);
      head.appendChild(countEl);

      const valuesWrap = document.createElement("div");
      valuesWrap.className = "profile-view-currency-card-values";

      const originalBlock = document.createElement("div");
      originalBlock.className =
        "profile-view-currency-card-amount profile-view-currency-card-amount--original";
      const isNativeEur = (currencyKey || "").toString().trim().toUpperCase() === "EUR";

      if (!isNativeEur) {
        const originalCaption = document.createElement("span");
        originalCaption.className = "profile-view-currency-card-amount-caption";
        originalCaption.textContent = "Original";
        originalBlock.appendChild(originalCaption);
      }

      const valueEl = document.createElement("span");
      valueEl.className = "profile-view-currency-card-value";
      valueEl.textContent =
        typeof formatOriginalCurrencyAmount === "function"
          ? formatOriginalCurrencyAmount(total, currencyKey)
          : String(total);

      originalBlock.appendChild(valueEl);
      valuesWrap.appendChild(originalBlock);

      if (eurLine && eurLine.variant === "converted") {
        const eurBlock = document.createElement("div");
        eurBlock.className = "profile-view-currency-card-amount profile-view-currency-card-amount--eur";

        const eurCaption = document.createElement("span");
        eurCaption.className = "profile-view-currency-card-amount-caption";
        eurCaption.textContent = "≈ EUR";

        const eurValueEl = document.createElement("span");
        eurValueEl.className = "profile-view-currency-card-eur-value";
        eurValueEl.textContent = eurLine.amount;

        const eurMeta = document.createElement("span");
        eurMeta.className = "profile-view-currency-card-eur-meta";
        eurMeta.textContent = eurLine.caption || "Latest rate";

        eurBlock.appendChild(eurCaption);
        eurBlock.appendChild(eurValueEl);
        eurBlock.appendChild(eurMeta);
        valuesWrap.appendChild(eurBlock);
      } else if (eurLine && eurLine.variant === "unavailable") {
        const unavailableEl = document.createElement("p");
        unavailableEl.className = "profile-view-currency-card-eur profile-view-currency-card-eur--unavailable";
        unavailableEl.textContent = eurLine.text;
        valuesWrap.appendChild(unavailableEl);
      }

      card.appendChild(head);
      card.appendChild(valuesWrap);
      container.appendChild(card);
    });

    if (note) {
      note.hidden = false;
      if (unavailableConversions > 0) {
        note.textContent =
          unavailableConversions === 1
            ? "Totals use each roadmap's stored amount in its original currency. EUR equivalents use the app's latest exchange rates; 1 currency could not be converted."
            : `Totals use each roadmap's stored amount in its original currency. EUR equivalents use the app's latest exchange rates; ${unavailableConversions} currencies could not be converted.`;
      } else {
        note.textContent =
          "Totals use each roadmap's stored amount in its original currency. EUR equivalents below use the app's latest exchange rates (refreshed daily).";
      }
    }
  };

  showLoading();
  if (typeof ExchangeRates !== "undefined" && typeof ExchangeRates.ensure === "function") {
    ExchangeRates.ensure().then(render).catch(render);
  } else {
    render();
  }
}

function syncProfileViewCurrencyDetails({ resetCollapsed = false } = {}) {
  const details = elements.profileViewCurrencyDetails;
  if (!details) return;
  if (resetCollapsed) details.open = false;
  const summary = details.querySelector(".profile-view-currency-summary");
  if (summary) summary.setAttribute("aria-expanded", details.open ? "true" : "false");
}

function syncRoadmapModalFooterMetaDetails({ resetCollapsed = false } = {}) {
  const details = elements.roadmapModalFooterMetaDetails;
  if (!details) return;
  const isCompact = isCompactLayoutViewport();
  if (!isCompact) {
    details.open = true;
  } else if (resetCollapsed) {
    details.open = false;
  }
  const summary = details.querySelector(".roadmap-modal-footer-meta-summary");
  if (summary) summary.setAttribute("aria-expanded", details.open ? "true" : "false");
}

function openProfileViewModal(profileId) {
  const profile = state.profiles.find((p) => p.id === profileId);
  if (!profile || !elements.profileViewModal) return;
  if (!requireProfileUnlocked(profileId, "view")) return;
  activateBlockingModal(elements.profileViewModal, "profileViewModal");

  const profileName = profile.name || "Untitled profile";
  if (elements.profileViewAvatar) {
    elements.profileViewAvatar.textContent = getProfileInitials(profileName);
  }
  if (elements.profileViewName) {
    elements.profileViewName.textContent = profileName;
  }
  if (elements.profileViewTeam) {
    const teamText = (profile.team || "").trim();
    elements.profileViewTeam.textContent = teamText || "No team set";
    elements.profileViewTeam.classList.toggle("profile-view-team--empty", !teamText);
  }

  const roadmaps = Array.isArray(profile.roadmaps) ? profile.roadmaps.slice() : [];
  const totalRoadmaps = roadmaps.length;

  if (elements.profileViewTotalRoadmaps) {
    elements.profileViewTotalRoadmaps.textContent = String(totalRoadmaps);
  }

  const uniqueCountries = new Set();
  roadmaps.forEach((p) => {
    const list = Array.isArray(p.countries) ? p.countries : [];
    list.forEach((c) => {
      if (c != null && String(c).trim() !== "") uniqueCountries.add(String(c).trim());
    });
  });
  if (elements.profileViewUniqueCountries) {
    elements.profileViewUniqueCountries.textContent = String(uniqueCountries.size);
  }

  const statusCounts = {};
  const typeCounts = {};
  const tshirtCounts = {};
  const moscowCounts = {};
  const frameworkCounts = {};
  const riceScores = [];
  roadmaps.forEach((p) => {
    const statusKey = (p.roadmapStatus || "Not set").toString();
    statusCounts[statusKey] = (statusCounts[statusKey] || 0) + 1;
    const typeKey = (p.roadmapType || "Not set").toString();
    typeCounts[typeKey] = (typeCounts[typeKey] || 0) + 1;
    const tshirtKey = (p.tshirtSize || "Not set").toString();
    tshirtCounts[tshirtKey] = (tshirtCounts[tshirtKey] || 0) + 1;
    const moscowKey = (p.moscowCategory || "Not set").toString();
    moscowCounts[moscowKey] = (moscowCounts[moscowKey] || 0) + 1;
    const frameworkKey = normalizeFinancialFramework(p.financialImpactFramework);
    frameworkCounts[frameworkKey] = (frameworkCounts[frameworkKey] || 0) + 1;
    const score = calculateRiceScore(p);
    if (Number.isFinite(score)) riceScores.push(score);
  });

  renderProfileViewBreakdownChips(elements.profileViewByStatus, statusCounts);
  renderProfileViewBreakdownChips(elements.profileViewByType, typeCounts);
  renderProfileViewBreakdownChips(elements.profileViewByTshirt, tshirtCounts);
  renderProfileViewBreakdownChips(elements.profileViewByMoscow, moscowCounts, {
    sortOrder: typeof moscowList !== "undefined" ? moscowList.slice() : [],
    labelFor: (key) => PROFILE_VIEW_MOSCOW_SHORT_LABELS[key] || key,
  });
  renderProfileViewBreakdownChips(elements.profileViewByFramework, frameworkCounts, {
    sortOrder: FINANCIAL_FRAMEWORKS.slice(),
    labelFor: (key) => getProfileViewFrameworkChipLabel(key),
    titleFor: (key) => getProfileViewFrameworkChipTitle(key),
  });
  renderProfileViewBreakdownChips(
    elements.profileViewByCountry,
    buildProfileViewCountryCounts(roadmaps),
    {
      labelFor: (key) => getProfileViewCountryChipLabel(key),
      titleFor: (key) => getProfileViewCountryChipTitle(key),
    }
  );

  const currencyData = buildProfileViewCurrencyData(roadmaps);
  renderProfileViewBreakdownChips(elements.profileViewByCurrency, currencyData.counts, {
    sortOrder: buildProfileViewCurrencySortOrder(currencyData.counts, currencyData.totals),
    labelFor: (key) => getProfileViewCurrencyChipLabel(key),
    titleFor: (key) =>
      getProfileViewCurrencyChipTitle(
        key,
        currencyData.counts[key] || 0,
        currencyData.totals[key]
      ),
  });
  renderProfileViewCurrencyTotals(
    elements.profileViewCurrencyTotals,
    elements.profileViewCurrencyNote,
    roadmaps
  );

  syncProfileViewCurrencyDetails({ resetCollapsed: true });

  renderProfileViewStatsGrid(elements.profileViewRiceStats, riceScores, {
    formatValue: formatRice,
    emptyMessage: "No RICE scores yet. Add reach, impact, confidence, and effort to roadmaps."
  });

  renderProfileViewFinancialStats(roadmaps);
}

function closeProfileViewModal({ immediate = false } = {}) {
  if (!elements.profileViewModal) return;
  deactivateBlockingModal(elements.profileViewModal, { immediate });
}

function openProfileEditModal(profileId) {
  const profile = state.profiles.find((p) => p.id === profileId);
  if (!profile || !elements.profileEditModal) return;
  if (isDemoProfile(profile)) {
    showToast("Demo profile is read-only. Profile edits are disabled.");
    return;
  }
  if (!requireProfileUnlocked(profileId, "edit")) return;
  activateBlockingModal(elements.profileEditModal, "profileEditModal");
  elements.profileEditModal.setAttribute("data-profile-id", profileId);
  if (elements.profileEditName) {
    elements.profileEditName.value = profile.name || "";
  }
  if (elements.profileEditTeam) {
    elements.profileEditTeam.value = (profile.team || "").trim();
  }
  const protectedProfile = isProfilePasswordProtected(profile);
  if (elements.profileEditCurrentPasswordWrap) {
    elements.profileEditCurrentPasswordWrap.classList.toggle("profile-field--hidden", !protectedProfile);
    elements.profileEditCurrentPasswordWrap.style.display = "";
  }
  if (elements.profileEditCurrentPassword) elements.profileEditCurrentPassword.value = "";
  if (elements.profileEditNewPassword) elements.profileEditNewPassword.value = "";
  if (elements.profileEditConfirmPassword) elements.profileEditConfirmPassword.value = "";
  if (elements.profileEditRemovePassword) elements.profileEditRemovePassword.checked = false;
  if (elements.profileEditPasswordHint) {
    elements.profileEditPasswordHint.textContent = protectedProfile
      ? "Current password is required to save changes. Set a new password or remove protection."
      : "Optionally set a password to lock this profile.";
  }
  if (elements.profileEditPasswordError) {
    elements.profileEditPasswordError.style.display = "none";
    elements.profileEditPasswordError.textContent = "";
  }
  setTimeout(() => {
    if (elements.profileEditName) elements.profileEditName.focus();
  }, 80);
}

function closeProfileEditModal({ immediate = false } = {}) {
  if (!elements.profileEditModal) return;
  deactivateBlockingModal(elements.profileEditModal, { immediate });
  elements.profileEditModal.removeAttribute("data-profile-id");
  if (elements.profileEditCurrentPassword) elements.profileEditCurrentPassword.value = "";
  if (elements.profileEditNewPassword) elements.profileEditNewPassword.value = "";
  if (elements.profileEditConfirmPassword) elements.profileEditConfirmPassword.value = "";
  if (elements.profileEditRemovePassword) elements.profileEditRemovePassword.checked = false;
  resetProfileEditPasswordFieldTypes();
}

function showProfileEditPasswordError(message) {
  if (!elements.profileEditPasswordError) return;
  elements.profileEditPasswordError.textContent = message;
  elements.profileEditPasswordError.style.display = message ? "block" : "none";
}

async function handleProfileEditSave() {
  if (typeof ProfileSecurity === "undefined") {
    showToast("Profile security module failed to load. Refresh the page and try again.");
    return;
  }
  const profileId = elements.profileEditModal.getAttribute("data-profile-id");
  if (!profileId) return;
  const profile = state.profiles.find((p) => p.id === profileId);
  if (!profile) {
    closeProfileEditModal();
    return;
  }
  if (isDemoProfile(profile)) {
    showToast("Demo profile is read-only. Profile edits are disabled.");
    closeProfileEditModal();
    return;
  }
  const name = (elements.profileEditName && elements.profileEditName.value || "").trim();
  if (!name) {
    if (elements.profileEditName) elements.profileEditName.focus();
    return;
  }
  showProfileEditPasswordError("");

  const team = (elements.profileEditTeam && elements.profileEditTeam.value || "").trim();
  const currentPwd = elements.profileEditCurrentPassword ? elements.profileEditCurrentPassword.value : "";
  const newPwd = elements.profileEditNewPassword ? elements.profileEditNewPassword.value : "";
  const confirmPwd = elements.profileEditConfirmPassword ? elements.profileEditConfirmPassword.value : "";
  const removePassword = !!(elements.profileEditRemovePassword && elements.profileEditRemovePassword.checked);
  const protectedProfile = isProfilePasswordProtected(profile);

  if (protectedProfile) {
    const currentOk = await ProfileSecurity.verifyProfilePassword(
      currentPwd,
      profile.passwordSalt,
      profile.passwordHash
    );
    if (!currentOk) {
      showProfileEditPasswordError("Current password is incorrect.");
      if (elements.profileEditCurrentPassword) elements.profileEditCurrentPassword.focus();
      return;
    }
  }

  if (removePassword) {
    if (!protectedProfile) {
      showProfileEditPasswordError("This profile does not have a password.");
      return;
    }
    clearProfilePassword(profile);
    markProfileLocked(profileId);
  } else if (newPwd || confirmPwd) {
    const validation = ProfileSecurity.validatePasswordPair(newPwd, confirmPwd, { required: true });
    if (!validation.ok) {
      showProfileEditPasswordError(validation.message);
      return;
    }
    await applyProfilePassword(profile, validation.password);
    markProfileUnlocked(profileId);
  }

  profile.name = name;
  profile.team = team;
  saveState();
  renderProfiles();
  renderRoadmaps();
  closeProfileEditModal();
  showToast("Profile updated successfully.");
}

function deleteProfile(profileId) {
  const index = state.profiles.findIndex((p) => p.id === profileId);
  if (index === -1 || !elements.profileDeleteModal) return;
  const profile = state.profiles[index];
  if (isDemoProfile(profile)) {
    showToast("Demo profile is read-only. Profile deletion is disabled.");
    return;
  }
  activateBlockingModal(elements.profileDeleteModal, "profileDeleteModal");
  const roadmapCount = profile.roadmaps ? profile.roadmaps.length : 0;

  elements.profileDeleteModal.setAttribute("data-profile-id", profileId);
  if (elements.profileDeleteNameLabel) {
    elements.profileDeleteNameLabel.textContent = profile.name || "Untitled profile";
  }
  if (elements.profileDeleteSummaryLabel) {
    if (roadmapCount > 0) {
      elements.profileDeleteSummaryLabel.textContent = ` • ${roadmapCount} roadmap${roadmapCount === 1 ? "" : "s"} attached`;
    } else {
      elements.profileDeleteSummaryLabel.textContent = " • No roadmaps yet";
    }
  }
  if (elements.profileDeleteWarningText) {
    elements.profileDeleteWarningText.textContent =
      "This will permanently remove this profile and all of its roadmaps from this browser. This action cannot be undone.";
  }

  const needsPassword = isProfilePasswordProtected(profile);
  if (elements.profileDeletePasswordWrap) {
    elements.profileDeletePasswordWrap.style.display = needsPassword ? "block" : "none";
  }
  if (elements.profileDeletePassword) {
    elements.profileDeletePassword.value = "";
  }
  if (elements.profileDeletePasswordError) {
    elements.profileDeletePasswordError.style.display = "none";
    elements.profileDeletePasswordError.textContent = "";
  }

  updateProfileDeleteConfirmState();

  if (elements.profileDeleteConfirmBtn) {
    elements.profileDeleteConfirmBtn.onclick = () => {
      const id = elements.profileDeleteModal.getAttribute("data-profile-id");
      const target = state.profiles.find((p) => p.id === id);
      if (!target) {
        closeProfileDeleteModal();
        return;
      }
      const runDelete = () => {
        const idx = state.profiles.findIndex((p) => p.id === id);
        if (idx !== -1) {
          state.profiles.splice(idx, 1);
          markProfileLocked(id);
          if (state.profiles.length === 0) {
            state.activeProfileId = null;
            ensureDefaultProfile();
          } else if (state.activeProfileId === id) {
            state.activeProfileId = resolveFallbackActiveProfileId();
          }
          saveState();
          renderProfiles();
          renderRoadmaps();
          showToast("Profile deleted successfully.");
        }
        closeProfileDeleteModal();
      };

      if (!isProfilePasswordProtected(target)) {
        runDelete();
        return;
      }

      const password = elements.profileDeletePassword ? elements.profileDeletePassword.value : "";
      ProfileSecurity.verifyProfilePassword(password, target.passwordSalt, target.passwordHash)
        .then((ok) => {
          if (!ok) {
            if (elements.profileDeletePasswordError) {
              elements.profileDeletePasswordError.textContent = "Incorrect password. Profile was not deleted.";
              elements.profileDeletePasswordError.style.display = "block";
            }
            updateProfileDeleteConfirmState();
            return;
          }
          runDelete();
        })
        .catch((err) => {
          console.error("Delete verification failed:", err);
          showToast("Could not verify password. Profile was not deleted.");
        });
    };
  }

  if (elements.profileDeleteCancelTopBtn) {
    elements.profileDeleteCancelTopBtn.onclick = () => {
      closeProfileDeleteModal();
    };
  }
  if (elements.profileDeleteCancelBtn) {
    elements.profileDeleteCancelBtn.onclick = () => {
      closeProfileDeleteModal();
    };
  }
}

function handleSingleDelete(roadmapId) {
  if (!requireWritableActiveProfile("Delete")) return;
  if (!getActiveProfile() || !elements.roadmapDeleteModal) return;

  const located = findRoadmapWithOwner(roadmapId);
  const ownerProfile = located.profile;
  const roadmap = located.roadmap;
  if (!ownerProfile || !roadmap) return;

  activateBlockingModal(elements.roadmapDeleteModal, "roadmapDeleteModal");
  elements.roadmapDeleteModal.setAttribute("data-delete-mode", "single");
  elements.roadmapDeleteModal.setAttribute("data-roadmap-id", roadmapId);
  elements.roadmapDeleteModal.removeAttribute("data-roadmap-ids");
  if (elements.roadmapDeleteNameLabel) {
    elements.roadmapDeleteNameLabel.textContent = roadmap.title || "Untitled roadmap";
  }
  if (elements.roadmapDeleteWarningText) {
    const ownerNote = isSuperAdminModeActive()
      ? ` from profile “${ownerProfile.name || "Unnamed"}”`
      : " from this profile";
    elements.roadmapDeleteWarningText.textContent =
      `This will permanently remove this roadmap${ownerNote}. This action cannot be undone.`;
  }

  if (elements.roadmapDeleteConfirmBtn) {
    elements.roadmapDeleteConfirmBtn.onclick = () => {
      const mode = elements.roadmapDeleteModal.getAttribute("data-delete-mode") || "single";
      if (mode === "single") {
        const id = elements.roadmapDeleteModal.getAttribute("data-roadmap-id");
        if (!id || !removeRoadmapById(id)) {
          closeRoadmapDeleteModal();
          return;
        }
        saveState();
        renderRoadmaps();
        closeRoadmapDeleteModal();
        showToast("Roadmap deleted successfully.");
      }
    };
  }

  if (elements.roadmapDeleteCancelBtn) {
    elements.roadmapDeleteCancelBtn.onclick = () => {
      closeRoadmapDeleteModal();
    };
  }
}

function openRoadmapModal(mode, roadmapId, options = {}) {
  const isEdit = mode === "edit";
  const isView = mode === "view";
  if (!isView && !requireWritableActiveProfile(isEdit ? "Edit" : "Add roadmap")) return;
  roadmapModalMode = mode;
  editingRoadmapId = isEdit ? roadmapId : null;
  elements.roadmapFormError.style.display = "none";
  elements.roadmapFormError.textContent = "";

  const activeProfile = getActiveProfile();
  if (!activeProfile) return;
  if (!isProfileUnlocked(activeProfile.id)) {
    pendingUnlockAction = { type: "activate", profileId: activeProfile.id };
    openProfileUnlockModal(activeProfile.id);
    showToast("Unlock this profile to add or edit roadmaps.");
    return;
  }

  let roadmap = null;
  let ownerProfile = activeProfile;
  if (isEdit || isView) {
    const located = findRoadmapWithOwner(roadmapId);
    ownerProfile = located.profile || activeProfile;
    roadmap = located.roadmap;
  }

  const showOwnerPicker = !isView && isSuperAdminModeActive() && elements.roadmapOwnerProfileWrap;
  if (elements.roadmapOwnerProfileWrap) {
    elements.roadmapOwnerProfileWrap.hidden = !showOwnerPicker;
  }
  if (showOwnerPicker) {
    populateRoadmapOwnerProfileSelect(ownerProfile ? ownerProfile.id : state.activeProfileId);
  }

  if (roadmap) {
    const ownerSuffix =
      isSuperAdminModeActive() && ownerProfile && ownerProfile.id !== activeProfile.id
        ? ` · ${ownerProfile.name}`
        : "";
    elements.roadmapModalTitle.textContent = (isView ? "View roadmap" : "Edit roadmap") + ownerSuffix;
    elements.roadmapTitle.value = roadmap.title || "";
    setRichDescriptionValue("roadmapDescription", roadmap.description || "");
    setRichDescriptionValue("reachDescription", roadmap.reachDescription || "");
    elements.reachValue.value = roadmap.reachValue != null ? roadmap.reachValue : "";
    setRichDescriptionValue("impactDescription", roadmap.impactDescription || "");
    elements.impactValue.value = roadmap.impactValue != null ? String(roadmap.impactValue) : "";
    setRichDescriptionValue("confidenceDescription", roadmap.confidenceDescription || "");
    elements.confidenceValue.value = roadmap.confidenceValue != null ? roadmap.confidenceValue : "";
    setRichDescriptionValue("effortDescription", roadmap.effortDescription || "");
    elements.effortValue.value = roadmap.effortValue != null ? String(roadmap.effortValue) : "";
    elements.financialImpactValue.value = roadmap.financialImpactValue != null ? roadmap.financialImpactValue : "";
    const framework = normalizeFinancialFramework(roadmap.financialImpactFramework);
    if (elements.financialFramework) elements.financialFramework.value = framework;
    if (elements.financialFramework) elements.financialFramework.dataset.lastFramework = framework;
    setFinancialInputsToForm(roadmap.financialImpactInputs || {});
    toggleFinancialFrameworkFields(framework);
    ensureCurrencyOption(elements.roadmapCurrency, roadmap.financialImpactCurrency);
    const currencyVal = roadmap.financialImpactCurrency ? String(roadmap.financialImpactCurrency).trim() : "";
    if (currencyVal) {
      const opt = Array.from(elements.roadmapCurrency.options).find(
        (o) => (o.value || "").toUpperCase() === currencyVal.toUpperCase()
      );
      if (opt) elements.roadmapCurrency.value = opt.value;
    } else {
      elements.roadmapCurrency.value = "";
    }
    elements.roadmapType.value = roadmap.roadmapType || "";
    elements.roadmapStatus.value = roadmap.roadmapStatus || "";
    elements.roadmapTshirtSize.value = roadmap.tshirtSize || "";
    elements.roadmapPeriod.value = roadmap.roadmapPeriod || "";
    elements.roadmapMoscow.value = roadmap.moscowCategory || "";
    setRoadmapKanoSelection(roadmap.kanoFunctionality, roadmap.kanoSatisfaction, { readonly: isView });
    renderCountriesControls(Array.isArray(roadmap.countries) ? roadmap.countries : []);
    renderRoadmapLabelsControls(roadmap.labels, { readonly: isView });
    renderRoadmapLinksControls(roadmap.links, { readonly: isView });
    renderRoadmapTasksControls(roadmap.tasks, { readonly: isView });
    renderRoadmapRaciControls(roadmap.raci, { readonly: isView });

    if (elements.roadmapMetaId) {
      elements.roadmapMetaId.textContent = roadmap.id || "—";
    }
    elements.roadmapMetaCreated.textContent = formatDateTime(roadmap.createdAt);
    elements.roadmapMetaModified.textContent = formatDateTime(roadmap.modifiedAt || roadmap.createdAt);
    elements.roadmapMetaRice.textContent = formatRice(calculateRiceScore(roadmap));
    elements.roadmapFormSubmitBtn.textContent = isView ? "Close" : "Update roadmap";
  } else {
    elements.roadmapModalTitle.textContent = isSuperAdminModeActive()
      ? "New roadmap (choose owner profile)"
      : "New roadmap";
    if (showOwnerPicker) {
      populateRoadmapOwnerProfileSelect(state.activeProfileId);
    }
    elements.roadmapTitle.value = "";
    setRichDescriptionValue("roadmapDescription", "");
    setRichDescriptionValue("reachDescription", "");
    elements.reachValue.value = "";
    setRichDescriptionValue("impactDescription", "");
    elements.impactValue.value = "";
    setRichDescriptionValue("confidenceDescription", "");
    elements.confidenceValue.value = "";
    setRichDescriptionValue("effortDescription", "");
    elements.effortValue.value = "";
    elements.financialImpactValue.value = "";
    if (elements.financialFramework) elements.financialFramework.value = FINANCIAL_FRAMEWORK_DEFAULT;
    if (elements.financialFramework) elements.financialFramework.dataset.lastFramework = FINANCIAL_FRAMEWORK_DEFAULT;
    setFinancialInputsToForm({});
    toggleFinancialFrameworkFields(FINANCIAL_FRAMEWORK_DEFAULT);
    elements.roadmapCurrency.value = "";
    elements.roadmapType.value = "";
    elements.roadmapStatus.value = "";
    elements.roadmapTshirtSize.value = "";
    elements.roadmapPeriod.value = "";
    elements.roadmapMoscow.value = "";
    setRoadmapKanoSelection(null, null, { readonly: false });
    renderCountriesControls([]);
    renderRoadmapLabelsControls([]);
    renderRoadmapLinksControls([]);
    renderRoadmapTasksControls([]);
    renderRoadmapRaciControls(getEmptyRoadmapRaci());

    const now = new Date();
    const nowIso = now.toISOString();
    if (elements.roadmapMetaId) {
      elements.roadmapMetaId.textContent = "Will be generated on save";
    }
    elements.roadmapMetaCreated.textContent = formatDateTime(nowIso);
    elements.roadmapMetaModified.textContent = formatDateTime(nowIso);
    elements.roadmapMetaRice.textContent = "—";
    elements.roadmapFormSubmitBtn.textContent = "Save roadmap";
  }

  updateModalRicePreview();
  resetRoadmapModalSectionNav();
  syncRoadmapOptionalDisclosures({
    resetCollapsed: true,
    forceOpenSectionIds: options.scrollToSection ? [options.scrollToSection] : []
  });
  syncRoadmapTasksDisclosure({ resetCollapsed: true });
  syncRoadmapModalFooterMetaDetails({ resetCollapsed: true });
  activateBlockingModal(elements.roadmapModal, "roadmapModal");
  elements.roadmapModal.classList.toggle("roadmap-modal--view", isView);
  if (!isView && !options.scrollToSection) {
    elements.roadmapTitle.focus();
  }

  setRichDescriptionFieldsReadonly(isView);

  const inputs = elements.roadmapForm.querySelectorAll("input, textarea, select");
  inputs.forEach((el) => {
    if (isView) {
      el.setAttribute("disabled", "disabled");
    } else {
      el.removeAttribute("disabled");
    }
  });

  if (elements.addCountryBtn) {
    elements.addCountryBtn.style.display = isView ? "none" : "";
  }
  if (elements.addRoadmapLabelBtn) {
    elements.addRoadmapLabelBtn.style.display = isView ? "none" : "";
  }
  if (elements.addRoadmapLinkBtn) {
    elements.addRoadmapLinkBtn.style.display = isView ? "none" : "";
  }
  if (elements.addRoadmapTaskBtn) {
    elements.addRoadmapTaskBtn.style.display = isView ? "none" : "";
  }
  if (elements.roadmapRaciSection) {
    elements.roadmapRaciSection.querySelectorAll(".roadmap-raci-add-btn").forEach((btn) => {
      btn.style.display = isView ? "none" : "";
    });
    elements.roadmapRaciSection.querySelectorAll(".roadmap-raci-remove-btn").forEach((btn) => {
      btn.style.display = isView ? "none" : "";
    });
  }
  elements.roadmapForm.querySelectorAll(".roadmap-dynamic-field-hint").forEach((hint) => {
    hint.style.display = isView ? "none" : "";
  });
  if (elements.countriesContainer) {
    const removeButtons = elements.countriesContainer.querySelectorAll(".country-remove-btn");
    removeButtons.forEach((btn) => {
      btn.style.display = isView ? "none" : "";
    });
  }

  if (elements.roadmapFormCancelBtn) {
    elements.roadmapFormCancelBtn.style.display = isView ? "none" : "";
  }
  if (elements.roadmapOwnerProfile) {
    elements.roadmapOwnerProfile.disabled = isView;
  }

  if (options.scrollToSection) {
    forceRoadmapModalSectionOpen(options.scrollToSection);
    window.setTimeout(() => {
      navigateRoadmapModalToSection(options.scrollToSection, {
        focusSelector:
          options.focusSelector ||
          (options.scrollToSection === "roadmapModalSectionKano" && !isView
            ? "#roadmapKanoFunctionalitySelect"
            : null)
      });
    }, 80);
  }
}

function closeRoadmapModal({ immediate = false } = {}) {
  hideCellTypeTooltips();
  deactivateBlockingModal(elements.roadmapModal, { immediate });
  if (elements.roadmapModal) {
    elements.roadmapModal.classList.remove("roadmap-modal--view");
  }
  setRichDescriptionFieldsReadonly(false);
  editingRoadmapId = null;
}

function roadmapFormHasFinancialInput(raw) {
  if (raw.financialImpactValue != null && Number.isFinite(raw.financialImpactValue)) return true;
  if (raw.financialImpactCurrency) return true;
  const inputs = raw.financialImpactInputs && typeof raw.financialImpactInputs === "object" ? raw.financialImpactInputs : {};
  return Object.keys(inputs).some((key) => {
    const value = inputs[key];
    return value != null && String(value).trim() !== "";
  });
}

function handleRoadmapFormSubmit(e) {
  e.preventDefault();
  elements.roadmapFormError.style.display = "none";
  elements.roadmapFormError.textContent = "";

  if (elements.roadmapFormSubmitBtn.textContent === "Close") {
    closeRoadmapModal();
    return;
  }

  if (!requireWritableActiveProfile("Save roadmap")) return;

  if (!getUnlockedActiveProfile()) {
    showToast("Unlock this profile to save roadmaps.");
    return;
  }

  let period = (elements.roadmapPeriod.value || "").trim();
  if (period) {
    period = period.toUpperCase();
  }

  const raw = {
    title: (elements.roadmapTitle.value || "").trim(),
    description: getRichDescriptionValue("roadmapDescription"),
    reachDescription: getRichDescriptionValue("reachDescription"),
    reachValue: elements.reachValue.value !== "" ? Number(elements.reachValue.value) : null,
    impactDescription: getRichDescriptionValue("impactDescription"),
    impactValue: elements.impactValue.value !== "" ? Number(elements.impactValue.value) : null,
    confidenceDescription: getRichDescriptionValue("confidenceDescription"),
    confidenceValue: elements.confidenceValue.value !== "" ? Number(elements.confidenceValue.value) : null,
    effortDescription: getRichDescriptionValue("effortDescription"),
    effortValue: elements.effortValue.value !== "" ? Number(elements.effortValue.value) : null,
    financialImpactValue: elements.financialImpactValue.value !== "" ? Number(elements.financialImpactValue.value) : null,
    financialImpactCurrency: normalizeCurrency(elements.roadmapCurrency.value),
    financialImpactFramework: normalizeFinancialFramework(elements.financialFramework && elements.financialFramework.value),
    financialImpactInputs: sanitizeFinancialImpactInputs(
      normalizeFinancialFramework(elements.financialFramework && elements.financialFramework.value),
      mergeFinancialImpactInputsForCompute()
    ),
    roadmapType: (elements.roadmapType.value || "").trim() || null,
    roadmapStatus: (elements.roadmapStatus.value || "").trim() || null,
    tshirtSize: (elements.roadmapTshirtSize.value || "").trim() || null,
    roadmapPeriod: period,
    moscowCategory: (elements.roadmapMoscow && elements.roadmapMoscow.value)
      ? (elements.roadmapMoscow.value || "").trim() || null
      : null,
    kanoFunctionality: getRoadmapKanoFromControls().kanoFunctionality,
    kanoSatisfaction: getRoadmapKanoFromControls().kanoSatisfaction,
    countries: getCountriesFromControls(),
    labels: getRoadmapLabelsFromControls(),
    tasks: getRoadmapTasksFromControls(),
    raci: getRoadmapRaciFromControls()
  };

  const linkResult = getRoadmapLinksFromControls();
  if (linkResult.error) {
    elements.roadmapFormError.textContent = linkResult.error;
    elements.roadmapFormError.style.display = "block";
    return;
  }
  raw.links = linkResult.links;

  raw.financialImpactValue = computeFrameworkFinancialImpact(
    raw.financialImpactFramework,
    raw.financialImpactInputs,
    raw.financialImpactValue
  );

  if (
    raw.financialImpactFramework !== FINANCIAL_FRAMEWORK_DEFAULT &&
    !Number.isFinite(raw.financialImpactValue) &&
    roadmapFormHasFinancialInput(raw)
  ) {
    elements.roadmapFormError.textContent = getFinancialFrameworkValidationMessage(
      raw.financialImpactFramework,
      raw.financialImpactInputs
    );
    elements.roadmapFormError.style.display = "block";
    return;
  }

  if (!Number.isFinite(raw.financialImpactValue)) {
    raw.financialImpactValue = null;
  }

  const validationError = validateRoadmapInput(raw);
  if (validationError) {
    elements.roadmapFormError.textContent = validationError;
    elements.roadmapFormError.style.display = "block";
    if (validationError === "Roadmap title is required.") {
      elements.roadmapTitle?.focus();
    } else if (validationError === "Roadmap description is required.") {
      const surface = getRichDescriptionSurface("roadmapDescription");
      if (surface) surface.focus();
    }
    return;
  }

  if (editingRoadmapId) {
    const located = findRoadmapWithOwner(editingRoadmapId);
    const ownerProfile = located.profile;
    const roadmap = located.roadmap;
    if (!ownerProfile || !roadmap) return;
    roadmap.title = raw.title;
    roadmap.description = raw.description;
    roadmap.reachDescription = raw.reachDescription;
    roadmap.reachValue = raw.reachValue;
    roadmap.impactDescription = raw.impactDescription;
    roadmap.impactValue = raw.impactValue;
    roadmap.confidenceDescription = raw.confidenceDescription;
    roadmap.confidenceValue = raw.confidenceValue;
    roadmap.effortDescription = raw.effortDescription;
    roadmap.effortValue = raw.effortValue;
    roadmap.financialImpactValue = raw.financialImpactValue;
    roadmap.financialImpactCurrency = raw.financialImpactCurrency;
    roadmap.financialImpactFramework = raw.financialImpactFramework;
    roadmap.financialImpactInputs = raw.financialImpactInputs;
    roadmap.roadmapType = raw.roadmapType || null;
    roadmap.roadmapStatus = raw.roadmapStatus || null;
    roadmap.tshirtSize = raw.tshirtSize || null;
    roadmap.roadmapPeriod = raw.roadmapPeriod || null;
    roadmap.moscowCategory = raw.moscowCategory || null;
    roadmap.kanoFunctionality = raw.kanoFunctionality != null ? raw.kanoFunctionality : null;
    roadmap.kanoSatisfaction = raw.kanoSatisfaction != null ? raw.kanoSatisfaction : null;
    roadmap.countries = Array.isArray(raw.countries) ? raw.countries : [];
    roadmap.labels = normalizeRoadmapLabels(raw.labels);
    roadmap.links = normalizeRoadmapLinks(raw.links);
    roadmap.tasks = normalizeRoadmapTasks(raw.tasks);
    roadmap.raci = normalizeRoadmapRaci(raw.raci);
    roadmap.modifiedAt = new Date().toISOString();
    roadmap.riceScore = calculateRiceScore(roadmap);
    saveState({ flush: true });
    closeRoadmapModal();
    renderRoadmaps();
    showToast(
      isSuperAdminModeActive() && ownerProfile.id !== state.activeProfileId
        ? `Roadmap updated in profile “${ownerProfile.name || "Unnamed"}”.`
        : "Roadmap updated successfully."
    );
    return;
  } else {
    const targetProfile = getTargetProfileForRoadmapCreate();
    if (!targetProfile || !Array.isArray(targetProfile.roadmaps)) {
      showToast("Choose a valid owner profile for this roadmap.");
      return;
    }
    const now = new Date().toISOString();
    const roadmap = {
      id: generateId("roadmap"),
      createdAt: now,
      modifiedAt: now,
      title: raw.title,
      description: raw.description,
      reachDescription: raw.reachDescription,
      reachValue: raw.reachValue,
      impactDescription: raw.impactDescription,
      impactValue: raw.impactValue,
      confidenceDescription: raw.confidenceDescription,
      confidenceValue: raw.confidenceValue,
      effortDescription: raw.effortDescription,
      effortValue: raw.effortValue,
      financialImpactValue: raw.financialImpactValue,
      financialImpactCurrency: raw.financialImpactCurrency,
      financialImpactFramework: raw.financialImpactFramework,
      financialImpactInputs: raw.financialImpactInputs,
      roadmapType: raw.roadmapType || null,
      roadmapStatus: raw.roadmapStatus || null,
      tshirtSize: raw.tshirtSize || null,
      roadmapPeriod: raw.roadmapPeriod || null,
      moscowCategory: raw.moscowCategory || null,
      kanoFunctionality: raw.kanoFunctionality != null ? raw.kanoFunctionality : null,
      kanoSatisfaction: raw.kanoSatisfaction != null ? raw.kanoSatisfaction : null,
      countries: Array.isArray(raw.countries) ? raw.countries : [],
      labels: normalizeRoadmapLabels(raw.labels),
      links: normalizeRoadmapLinks(raw.links),
      tasks: normalizeRoadmapTasks(raw.tasks),
      raci: normalizeRoadmapRaci(raw.raci)
    };
    roadmap.riceScore = calculateRiceScore(roadmap);
    targetProfile.roadmaps.unshift(roadmap);
    saveState({ flush: true });
    closeRoadmapModal();
    renderRoadmaps();
    showToast(
      isSuperAdminModeActive() && targetProfile.id !== state.activeProfileId
        ? `Roadmap created in profile “${targetProfile.name || "Unnamed"}”.`
        : "Roadmap created successfully."
    );
  }
}

function updateModalRicePreview() {
  const temp = {
    reachValue: elements.reachValue.value !== "" ? Number(elements.reachValue.value) : null,
    impactValue: elements.impactValue.value !== "" ? Number(elements.impactValue.value) : null,
    confidenceValue: elements.confidenceValue.value !== "" ? Number(elements.confidenceValue.value) : null,
    effortValue: elements.effortValue.value !== "" ? Number(elements.effortValue.value) : null
  };
  const rice = calculateRiceScore(temp);
  elements.roadmapMetaRice.textContent = Number.isFinite(rice) && rice > 0 ? formatRice(rice) : "—";

  const rawAmount = elements.financialImpactValue && elements.financialImpactValue.value !== "" ? Number(elements.financialImpactValue.value) : null;
  const framework = normalizeFinancialFramework(elements.financialFramework && elements.financialFramework.value);
  const frameworkInputs = mergeFinancialImpactInputsForCompute();
  const clvBreakdown = framework === "clv" ? computeClvBreakdown(frameworkInputs) : null;
  const npsBreakdown = framework === "nps" ? computeNpsBreakdown(frameworkInputs) : null;
  const riskBreakdown = framework === "risk" ? computeRiskBreakdown(frameworkInputs) : null;
  const headcountBreakdown = framework === "headcount" ? computeHeadcountBreakdown(frameworkInputs) : null;
  const operationalBreakdown = framework === "operational" ? computeOperationalBreakdown(frameworkInputs) : null;
  updateClvBreakdown(clvBreakdown);
  updateNpsBreakdown(npsBreakdown);
  updateRiskBreakdown(riskBreakdown);
  updateHeadcountBreakdown(headcountBreakdown);
  updateOperationalBreakdown(operationalBreakdown);
  const computedAmount = computeFrameworkFinancialImpact(framework, frameworkInputs, rawAmount);
  if (elements.financialImpactValue && framework !== FINANCIAL_FRAMEWORK_DEFAULT) {
    elements.financialImpactValue.value = Number.isFinite(computedAmount)
      ? Number(computedAmount).toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 6 })
      : "";
  }
  const currency = (elements.roadmapCurrency && elements.roadmapCurrency.value || "").toString().trim().toUpperCase() || "";
  const hasAmount = Number.isFinite(computedAmount);
  const hasCurrency = currency.length === 3;

  if (elements.roadmapMetaFinancialEur) {
    if (hasAmount && hasCurrency) {
      const amountEur = typeof ExchangeRates !== "undefined" && typeof ExchangeRates.convertToEUR === "function"
        ? ExchangeRates.convertToEUR(computedAmount, currency)
        : NaN;
      if (Number.isFinite(amountEur)) {
        const short = typeof formatFinancialShort === "function"
          ? formatFinancialShort(amountEur)
          : String(Number(amountEur).toLocaleString(undefined, { maximumFractionDigits: 2 }));
        elements.roadmapMetaFinancialEur.textContent = "€" + short;
      } else {
        elements.roadmapMetaFinancialEur.textContent = "— (rate unavailable)";
      }
    } else {
      elements.roadmapMetaFinancialEur.textContent = "—";
    }
  }

  if (elements.roadmapMetaExchangeRate) {
    if (hasCurrency && currency !== "EUR") {
      const rates = state.exchangeRatesToEUR || {};
      const rate = rates[currency];
      if (rate != null && Number.isFinite(rate)) {
        // Stored rate is EUR per 1 local currency; convert for UI to "1 EUR = X local currency".
        const localPerEur = rate > 0 ? 1 / Number(rate) : NaN;
        if (Number.isFinite(localPerEur)) {
          elements.roadmapMetaExchangeRate.textContent = `1 EUR = ${Number(localPerEur).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
        } else {
          elements.roadmapMetaExchangeRate.textContent = "— (rate unavailable)";
        }
      } else {
        elements.roadmapMetaExchangeRate.textContent = "— (rate unavailable)";
      }
    } else if (hasCurrency && currency === "EUR") {
      elements.roadmapMetaExchangeRate.textContent = "1 EUR = 1.00 EUR";
    } else {
      elements.roadmapMetaExchangeRate.textContent = "—";
    }
  }
}

// Boot the app once the DOM is ready (classic script mode)
document.addEventListener("DOMContentLoaded", init);
