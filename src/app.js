/**
 * Product Management Prioritization Tool - Main application module
 * Handles state, DOM cache, initialization, rendering, modals, import/export, and event handlers.
 *
 * IMPORTANT: This file now runs as a classic <script> (no ES modules).
 * It relies on globals defined in:
 *  - src/constants.js  (STORAGE_KEY, currencyList, countryList, countryCodeByName, countryNameAliases, ...)
 *  - src/rice.js       (calculateRiceScore, formatRice, validateProjectInput)
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
  projectsView: "table",
  tableSortByRice: true,
  /** Compact table cards: group by attribute (see TABLE_GROUP_BY_OPTIONS). */
  tableGroupBy: "none",
  scrumBoardSortByRice: true,
  /** Status column names hidden on the board view (null = show all). */
  moscowSortByRice: true,
  mapMetric: "projects",
  exchangeRatesToEUR: {},
  exchangeRatesDate: null,
  exchangeRatesLastSource: null
};

let editingProjectId = null;
let projectModalMode = "create";

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
    id: "projects",
    label: "Project count",
    short: "Count",
    description: "Number of projects per country",
    keywords: ["count", "projects", "number", "volume", "quantity"]
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
    description: "Mean RICE score per project in each country",
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
    description: "Mean financial impact in EUR per project in each country",
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

const PROJECT_FORM_FIELD_TOOLTIPS = {
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
    safeProfile.projects = (Array.isArray(profile.projects) ? profile.projects : []).map((project) => {
      const framework = normalizeFinancialFramework(project.financialImpactFramework);
      return {
        ...project,
        financialImpactFramework: framework,
        financialImpactInputs: sanitizeFinancialImpactInputs(framework, project.financialImpactInputs || {})
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
let projectModalSectionNavObserver = null;

function initProjectModalSectionNav() {
  const modal = document.getElementById("projectModal");
  if (!modal || modal.dataset.sectionNavReady === "1") return;
  modal.dataset.sectionNavReady = "1";
  const scrollRoot =
    modal.querySelector("#projectModalScrollRegion") || modal.querySelector(".project-modal-scroll") || modal.querySelector(".modal-body");
  modal.querySelectorAll(".project-modal-section-btn[data-scroll-target]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-scroll-target");
      const el = id ? document.getElementById(id) : null;
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      modal.querySelectorAll(".project-modal-section-btn").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
    });
  });

  if (!scrollRoot) return;
  const sectionEls = ["projectModalSectionProject", "projectModalSectionRice", "projectModalSectionMeta", "projectModalSectionFinancial"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  if (sectionEls.length === 0) return;

  if (projectModalSectionNavObserver) {
    projectModalSectionNavObserver.disconnect();
    projectModalSectionNavObserver = null;
  }
  projectModalSectionNavObserver = new IntersectionObserver(
    (entries) => {
      let best = null;
      let bestRatio = 0;
      entries.forEach((e) => {
        if (e.isIntersecting && e.intersectionRatio > bestRatio) {
          bestRatio = e.intersectionRatio;
          best = e.target;
        }
      });
      if (!best || bestRatio < 0.08) return;
      const id = best.id;
      modal.querySelectorAll(".project-modal-section-btn").forEach((b) => {
        b.classList.toggle("is-active", b.getAttribute("data-scroll-target") === id);
      });
    },
    { root: scrollRoot, threshold: [0, 0.05, 0.1, 0.2, 0.35, 0.55, 0.75, 1] }
  );
  sectionEls.forEach((sec) => projectModalSectionNavObserver.observe(sec));
}

function resetProjectModalSectionNav() {
  const modal = document.getElementById("projectModal");
  if (!modal) return;
  const scrollRegion =
    modal.querySelector("#projectModalScrollRegion") || modal.querySelector(".project-modal-scroll") || modal.querySelector(".modal-body");
  if (scrollRegion) scrollRegion.scrollTop = 0;
  const btns = modal.querySelectorAll(".project-modal-section-btn");
  btns.forEach((b, i) => b.classList.toggle("is-active", i === 0));
}

function ensureProjectFormFieldTooltips() {
  const projectForm = elements.projectForm || $("projectForm");
  if (!projectForm) return;
  const wraps = projectForm.querySelectorAll(".project-field-tooltip-wrap");
  wraps.forEach((wrap) => {
    if (wrap.querySelector(".cell-type-tooltip")) return;
    const control = wrap.querySelector("input, select, textarea");
    const labelEl = wrap.querySelector("label");
    if (!control || !labelEl) return;

    const labelText = (labelEl.textContent || "").replace(/\s+/g, " ").trim();
    const cleanTitle = labelText.replace(/\s*\(optional\)\s*/ig, "").trim() || "Field details";
    const tooltipCopy = PROJECT_FORM_FIELD_TOOLTIPS[control.id] || null;
    const bodyText = tooltipCopy && tooltipCopy.body
      ? tooltipCopy.body
      : (
        control.tagName === "SELECT"
          ? `Select the value for ${cleanTitle.toLowerCase()} for this project.`
          : `Provide a value for ${cleanTitle.toLowerCase()} for this project.`
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
        "In Vercel → your project → Deployment Protection → disable Vercel Authentication for Production (or set Standard Protection off).";
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
  renderProjects();
  updateProfileLockedBanner();
  focusLockedProfileUnlockIfNeeded();
  if (state.projectsView === "map" && elements.projectsMapContainer) {
    renderProjectsMap();
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
      " locked — unlock to view projects on this device.";
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

function initCloudStorageModal() {
  const modal = $("cloudStorageModal");
  const cancelBtn = $("cloudStorageCancelBtn");
  const submitBtn = $("cloudStorageSubmitBtn");
  const input = $("cloudStorageApiKeyInput");
  const errorEl = $("cloudStorageError");
  if (!modal || !submitBtn || !input) return;

  function setError(msg) {
    if (!errorEl) return;
    if (msg) {
      errorEl.textContent = msg;
      errorEl.hidden = false;
    } else {
      errorEl.textContent = "";
      errorEl.hidden = true;
    }
  }

  async function refreshCloudDiagnostics() {
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

  function openModal() {
    prepareAppOverlay("cloudStorage");
    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
    input.value =
      typeof AppStorage !== "undefined" && AppStorage.getApiSecret
        ? AppStorage.getApiSecret()
        : "";
    setError("");
    refreshCloudDiagnostics();
    input.focus();
  }

  function closeModal({ immediate = false } = {}) {
    closeModalBackdrop(modal, { immediate });
    setError("");
  }

  if (typeof OverlayManager !== "undefined") {
    OverlayManager.register("cloudStorage", () => closeModal({ immediate: true }));
  }

  if (cancelBtn) cancelBtn.addEventListener("click", closeModal);

  const pullBtn = $("cloudStoragePullBtn");
  const pushBtn = $("cloudStoragePushBtn");
  if (pullBtn) {
    pullBtn.addEventListener("click", async () => {
      if (typeof AppStorage === "undefined" || !AppStorage.pullFromCloud) return;
      pullBtn.disabled = true;
      setError("");
      try {
        const result = await AppStorage.pullFromCloud({ force: true });
        refreshUiAfterCloudDataChange();
        if (result && result.updated) {
          showCloudWorkspaceToast({ source: "pull" });
        } else {
          showToast("Cloud workspace is already up to date on this device.");
        }
        refreshCloudDiagnostics();
      } catch (err) {
        setError(err && err.message ? err.message : "Could not pull from cloud.");
      } finally {
        pullBtn.disabled = false;
      }
    });
  }
  if (pushBtn) {
    pushBtn.addEventListener("click", async () => {
      if (typeof AppStorage === "undefined" || !AppStorage.forceSyncNow) return;
      pushBtn.disabled = true;
      setError("");
      try {
        await AppStorage.forceSyncNow();
        showToast("Saved this device to cloud.");
      } catch (err) {
        setError(err && err.message ? err.message : "Could not save to cloud.");
      } finally {
        pushBtn.disabled = false;
      }
    });
  }
  if (cancelBtn) cancelBtn.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  submitBtn.addEventListener("click", async () => {
    const secret = input.value.trim();
    const status =
      typeof AppStorage !== "undefined" && AppStorage.getStatus
        ? AppStorage.getStatus()
        : null;
    const authRequired =
      status && status.cloudConfig && status.cloudConfig.authRequired === true;
    if (!secret && authRequired) {
      setError("Enter the API key from your Vercel environment (PM_API_SECRET).");
      return;
    }
    submitBtn.disabled = true;
    setError("");
    try {
      if (typeof AppStorage === "undefined") {
        throw new Error("Storage module is not loaded.");
      }
      await AppStorage.connectWithApiSecret(secret);
      closeModal();
      resetProfileUnlockSession();
      ensureDefaultProfile();
      applyDefaultActiveProfileSelection();
      renderProfiles();
      renderProjects();
      focusLockedProfileUnlockIfNeeded();
      showToast("Connected to cloud storage. Your workspace is now saved in MongoDB.");
    } catch (err) {
      setError(err && err.message ? err.message : "Could not connect to cloud storage.");
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
  cacheElements();
  syncSiteFooterYear();
  ensureProjectFormFieldTooltips();
  initProjectModalSectionNav();
  initCurrencyOptions();
  initFilterCountriesOptions();
  ExchangeRates.init({
    getState: () => state,
    saveState,
    getElements: () => elements,
    onRatesUpdated: () => {
      renderProjects();
      if (state.projectsView === "map" && elements.projectsMapContainer) renderProjectsMap();
    }
  });
  Fullscreen.init({
    getState: () => state,
    getElements: () => elements,
    switchView: switchProjectsView,
    syncViewTabs: syncPortfolioViewTabState,
    getViewElement(view) {
      if (view === "table") return elements.projectsTableView;
      if (view === "board") return elements.projectsBoardView;
      if (view === "moscow") return elements.projectsMoscowView;
      if (view === "map") return elements.projectsMapView;
      return null;
    },
    onExitFullscreen: refreshWorkspaceAfterFullscreenExit,
    onEnterFullscreen: refreshCompactFullscreenEnter,
  });
  attachEventListeners();
  initCompactLayoutClass();
  initAppHeaderMenu();
  initProfilesPanel();
  initProfilePicker();
  initProfileModals();
  initPortfolioWorkspace();
  initCloudStorageModal();
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
    if (boot && boot.needsAuth && $("cloudStorageModal")) {
      prepareAppOverlay("cloudStorage");
      $("cloudStorageModal").classList.add("active");
      $("cloudStorageModal").setAttribute("aria-hidden", "false");
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
  ensureDefaultProfile();
  applyDefaultActiveProfileSelection();
  toggleFinancialFrameworkFields(FINANCIAL_FRAMEWORK_DEFAULT);
  renderProfiles();
  renderProjects();
  focusLockedProfileUnlockIfNeeded();
  if (elements.projectsTableView && elements.projectsBoardView) {
    switchProjectsView(state.projectsView);
  }
  ExchangeRates.ensure()
    .then(() => {
      renderProjects();
      if (state.projectsView === "map" && elements.projectsMapContainer) renderProjectsMap();
    })
    .catch(() => {})
    .finally(() => {
      ExchangeRates.updateLabel();
      ExchangeRates.scheduleDailyRefresh();
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
  elements.portfolioFabAddProject = $("portfolioFabAddProject");
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
  elements.projectsHeaderBadges = $("projectsHeaderBadges");
  elements.addProjectBtn = $("addProjectBtn");
  elements.bulkDeleteBtn = $("bulkDeleteBtn");

  elements.filterTitle = $("filterTitle");
  elements.filterProjectPeriodToggle = $("filterProjectPeriodToggle");
  elements.filterProjectPeriodSearch = $("filterProjectPeriodSearch");
  elements.filterProjectPeriodList = $("filterProjectPeriodList");
  elements.filterProjectPeriodSummary = $("filterProjectPeriodSummary");
  elements.filterImpact = $("filterImpact");
  elements.filterEffort = $("filterEffort");
  elements.filterCurrency = $("filterCurrency");
  elements.filterFinancialFramework = $("filterFinancialFramework");
  elements.filterStatus = $("filterStatus");
  elements.filterTshirtSize = $("filterTshirtSize");
  elements.filterMoscow = $("filterMoscow");
  elements.filterProjectType = $("filterProjectType");

  elements.projectsTableBody = $("projectsTableBody");
  elements.projectsTableCardsList = $("projectsTableCardsList");
  elements.projectsTableCardsShell = $("projectsTableCardsShell");
  elements.selectAllProjects = $("selectAllProjects");
  elements.projectsViewTableBtn = $("projectsViewTableBtn");
  elements.projectsViewBoardBtn = $("projectsViewBoardBtn");
  elements.projectsViewMoscowBtn = $("projectsViewMoscowBtn");
  elements.projectsViewMapBtn = $("projectsViewMapBtn");
  elements.projectsTableView = $("projectsTableView");
  elements.projectsBoardView = $("projectsBoardView");
  elements.projectsMoscowView = $("projectsMoscowView");
  elements.projectsMapView = $("projectsMapView");
  elements.tableFullscreenBtn = $("tableFullscreenBtn");
  elements.projectsMapContainer = $("projectsMapContainer");
  elements.projectsMapLegend = $("projectsMapLegend");
  elements.mapMetricPicker = $("mapMetricPicker");
  elements.mapMetricPickerTrigger = $("mapMetricPickerTrigger");
  elements.mapMetricPickerBadge = $("mapMetricPickerBadge");
  elements.mapMetricPickerLabel = $("mapMetricPickerLabel");
  elements.mapMetricPickerSearch = $("mapMetricPickerSearch");
  elements.mapMetricPickerDropdown = $("mapMetricPickerDropdown");
  elements.mapMetricPickerListbox = $("mapMetricPickerListbox");
  elements.mapMetricPickerEmpty = $("mapMetricPickerEmpty");
  elements.projectsMapFullscreenBtn = $("projectsMapFullscreenBtn");
  elements.refreshExchangeRatesBtn = $("refreshExchangeRatesBtn");
  elements.exchangeRatesDateLabel = $("exchangeRatesDateLabel");
  elements.tableSortByRiceToggle = $("tableSortByRiceToggle");
  elements.tableSortByRiceLabel = $("tableSortByRiceLabel");
  elements.tableGroupBySelect = $("tableGroupBySelect");
  elements.tableGroupBySummary = $("tableGroupBySummary");
  elements.projectsTableGroupBar = $("projectsTableGroupBar");
  elements.scrumBoardContainer = $("scrumBoardContainer");
  elements.scrumBoardSortByRiceToggle = $("scrumBoardSortByRiceToggle");
  elements.scrumBoardFullscreenBtn = $("scrumBoardFullscreenBtn");
  elements.moscowBoardContainer = $("moscowBoardContainer");
  elements.moscowCompactNav = $("moscowCompactNav");
  elements.moscowFullscreenBtn = $("moscowFullscreenBtn");
  elements.moscowSortByRiceToggle = $("moscowSortByRiceToggle");
  elements.moscowSortByRiceLabel = $("moscowSortByRiceLabel");

  elements.projectModal = $("projectModal");
  elements.projectModalTitle = $("projectModalTitle");
  elements.projectModalSubtitle = $("projectModalSubtitle");
  elements.projectModalCloseBtn = $("projectModalCloseBtn");
  elements.projectForm = $("projectForm");
  elements.projectFormCancelBtn = $("projectFormCancelBtn");
  elements.projectFormSubmitBtn = $("projectFormSubmitBtn");
  elements.projectFormError = $("projectFormError");

  elements.projectTitle = $("projectTitle");
  elements.projectDescription = $("projectDescription");
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
  elements.projectCurrency = $("projectCurrency");
  elements.projectType = $("projectType");
  elements.projectStatus = $("projectStatus");
  elements.projectTshirtSize = $("projectTshirtSize");
  elements.projectPeriod = $("projectPeriod");
  elements.projectMoscow = $("projectMoscow");

  elements.projectMetaId = $("projectMetaId");
  elements.projectMetaCreated = $("projectMetaCreated");
  elements.projectMetaModified = $("projectMetaModified");
  elements.projectMetaRice = $("projectMetaRice");
  elements.projectMetaFinancialEur = $("projectMetaFinancialEur");
  elements.projectMetaExchangeRate = $("projectMetaExchangeRate");
  elements.projectModalFooterMetaDetails = $("projectModalFooterMetaDetails");

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
  elements.profileViewTotalProjects = $("profileViewTotalProjects");
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

  elements.projectDeleteModal = $("projectDeleteModal");
  elements.projectDeleteNameLabel = $("projectDeleteNameLabel");
  elements.projectDeleteWarningText = $("projectDeleteWarningText");
  elements.projectDeleteCancelBtn = $("projectDeleteCancelBtn");
  elements.projectDeleteConfirmBtn = $("projectDeleteConfirmBtn");

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
}

function initCurrencyOptions() {
  const currencySelects = [elements.filterCurrency, elements.projectCurrency];
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
 * Ensures the project currency select has an option for the given code.
 * Used when opening the project modal so imported/JSON data with a currency
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

function initFilterCountriesOptions() {
  if (!elements.filterCountriesList) return;
  elements.filterCountriesList.innerHTML = "";
  const sorted = countryList.slice().sort();
  const selected = new Set(getSelectedFilterCountriesRaw());

  if (typeof COUNTRY_OPTION_EU !== "undefined") {
    const euRow = document.createElement("div");
    euRow.className = "filter-country-option filter-country-option--eu";
    euRow.dataset.name = COUNTRY_OPTION_EU;
    const euCb = document.createElement("input");
    euCb.type = "checkbox";
    euCb.value = COUNTRY_OPTION_EU;
    const allEuSelected =
      typeof EU_MEMBER_COUNTRIES !== "undefined" &&
      EU_MEMBER_COUNTRIES.length > 0 &&
      EU_MEMBER_COUNTRIES.every((c) => selected.has(c));
    euCb.checked = selected.has(COUNTRY_OPTION_EU) || allEuSelected;
    const euLabel = document.createElement("span");
    euLabel.textContent = "EU (European Union)";
    euRow.appendChild(euCb);
    euRow.appendChild(euLabel);
    elements.filterCountriesList.appendChild(euRow);
  }

  sorted.forEach((name) => {
    const row = document.createElement("div");
    row.className = "filter-country-option";
    row.dataset.name = name;

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = name;
    if (selected.has(name)) cb.checked = true;

    const label = document.createElement("span");
    label.textContent = name;

    row.appendChild(cb);
    row.appendChild(label);
    elements.filterCountriesList.appendChild(row);
  });
  filterFilterCountriesBySearchTerm();
  updateFilterCountriesSummary();
}

function initFilterProjectPeriodOptions(projects) {
  if (!elements.filterProjectPeriodList) return;
  const listEl = elements.filterProjectPeriodList;
  const previouslySelected = new Set(getSelectedFilterProjectPeriods());

  const periodsSet = new Set();
  (projects || []).forEach((p) => {
    const raw = p.projectPeriod != null ? String(p.projectPeriod).trim().toUpperCase() : "";
    if (raw) periodsSet.add(raw);
  });

  const periods = Array.from(periodsSet).sort();
  listEl.innerHTML = "";

  periods.forEach((period) => {
    const row = document.createElement("div");
    row.className = "filter-country-option";
    row.dataset.period = period;

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = period;
    if (previouslySelected.has(period)) cb.checked = true;

    const label = document.createElement("span");
    label.textContent = period;

    row.appendChild(cb);
    row.appendChild(label);
    listEl.appendChild(row);
  });

  filterFilterProjectPeriodsBySearchTerm();
  updateFilterProjectPeriodsSummary();
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
    if (state.projectsView === "moscow") {
      renderMoscowBoard();
      syncMoscowCompactNav();
    } else if (state.projectsView === "board") {
      renderScrumBoard();
    } else if (state.projectsView === "table") {
      renderProjects();
    }
    if (elements.projectModal?.classList.contains("active")) {
      syncProjectModalFooterMetaDetails({ resetCollapsed: compact });
    }
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
  // --- Profiles & projects: core interactions ---
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

  elements.addProjectBtn.addEventListener("click", () => {
    openProjectModal("create");
  });

  if (elements.bulkDeleteBtn) {
    elements.bulkDeleteBtn.addEventListener("click", handleBulkDelete);
  }
  if (elements.portfolioSelectionDeleteBtn) {
    elements.portfolioSelectionDeleteBtn.addEventListener("click", handleBulkDelete);
  }
  if (elements.portfolioSelectionClearBtn) {
    elements.portfolioSelectionClearBtn.addEventListener("click", clearProjectSelection);
  }

  if (elements.projectsViewTableBtn) {
    elements.projectsViewTableBtn.addEventListener("click", () => {
      if (Fullscreen.isViewFullscreen() && state.projectsView !== "table") {
        Fullscreen.switchViewWhileFullscreen("table");
      } else {
        switchProjectsView("table");
      }
    });
  }
  if (elements.projectsViewBoardBtn) {
    elements.projectsViewBoardBtn.addEventListener("click", () => {
      if (Fullscreen.isViewFullscreen() && state.projectsView !== "board") {
        Fullscreen.switchViewWhileFullscreen("board");
      } else {
        switchProjectsView("board");
      }
    });
  }
  if (elements.projectsViewMoscowBtn) {
    elements.projectsViewMoscowBtn.addEventListener("click", () => {
      if (Fullscreen.isViewFullscreen() && state.projectsView !== "moscow") {
        Fullscreen.switchViewWhileFullscreen("moscow");
      } else {
        switchProjectsView("moscow");
      }
    });
  }
  if (elements.projectsViewMapBtn) {
    elements.projectsViewMapBtn.addEventListener("click", () => {
      if (Fullscreen.isViewFullscreen() && state.projectsView !== "map") {
        Fullscreen.switchViewWhileFullscreen("map");
      } else {
        switchProjectsView("map");
      }
    });
  }

  [elements.projectsViewTableBtn, elements.projectsViewBoardBtn, elements.projectsViewMoscowBtn, elements.projectsViewMapBtn]
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
      if (state.projectsView === "table") renderProjects();
    });
  }

  initTableGroupByControls();
  if (elements.scrumBoardSortByRiceToggle) {
    elements.scrumBoardSortByRiceToggle.addEventListener("change", () => {
      state.scrumBoardSortByRice = elements.scrumBoardSortByRiceToggle.checked;
      saveState();
      if (state.projectsView === "board") renderScrumBoard();
    });
  }
  if (elements.moscowSortByRiceToggle) {
    elements.moscowSortByRiceToggle.addEventListener("change", () => {
      state.moscowSortByRice = elements.moscowSortByRiceToggle.checked;
      saveState();
      if (state.projectsView === "moscow") renderMoscowBoard();
    });
  }

  initMapMetricPicker();

  if (elements.projectsMapFullscreenBtn && elements.projectsMapView) {
    elements.projectsMapFullscreenBtn.addEventListener("click", () => Fullscreen.toggle(elements.projectsMapView));
  }
  if (elements.refreshExchangeRatesBtn) {
    elements.refreshExchangeRatesBtn.addEventListener("click", () => {
      ExchangeRates.refreshManual()
        .then(() => showToast("Exchange rates updated."))
        .catch(() => showToast("Could not refresh exchange rates. Try again later."));
    });
  }
  if (elements.scrumBoardFullscreenBtn && elements.projectsBoardView) {
    elements.scrumBoardFullscreenBtn.addEventListener("click", () => Fullscreen.toggle(elements.projectsBoardView));
  }
  if (elements.tableFullscreenBtn && elements.projectsTableView) {
    elements.tableFullscreenBtn.addEventListener("click", () => Fullscreen.toggle(elements.projectsTableView));
  }
  if (elements.moscowFullscreenBtn && elements.projectsMoscowView) {
    elements.moscowFullscreenBtn.addEventListener("click", () => Fullscreen.toggle(elements.projectsMoscowView));
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
    prepareAppOverlay("exportFormatModal");
    elements.exportFormatModal.setAttribute("aria-hidden", "false");
    elements.exportFormatModal.classList.add("active");
  });

  elements.importDataBtn.addEventListener("click", () => {
    if (!elements.importFormatModal) return;
    updateImportFormatModalNotice();
    prepareAppOverlay("importFormatModal");
    elements.importFormatModal.setAttribute("aria-hidden", "false");
    elements.importFormatModal.classList.add("active");
  });

  if (elements.exportFormatModal) {
    elements.exportFormatModal.addEventListener("click", (e) => {
      if (e.target === elements.exportFormatModal) {
        closeExportFormatModal();
      }
    });
  }
  if (elements.importFormatModal) {
    elements.importFormatModal.addEventListener("click", (e) => {
      if (e.target === elements.importFormatModal) {
        closeImportFormatModal();
      }
    });
  }

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

  if (elements.profileViewModal) {
    elements.profileViewModal.addEventListener("click", (e) => {
      if (e.target === elements.profileViewModal) closeProfileViewModal();
    });
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
  if (elements.projectModalFooterMetaDetails) {
    elements.projectModalFooterMetaDetails.addEventListener("toggle", () => {
      syncProjectModalFooterMetaDetails();
    });
  }

  if (elements.profileEditModal) {
    elements.profileEditModal.addEventListener("click", (e) => {
      if (e.target === elements.profileEditModal) closeProfileEditModal();
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
  if (elements.profileUnlockModal) {
    elements.profileUnlockModal.addEventListener("click", (e) => {
      if (e.target === elements.profileUnlockModal) closeProfileUnlockModal();
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
    elements.filtersToggleBtn.addEventListener("click", () => {
      const visible = elements.filtersAdvanced.classList.toggle("visible");
      elements.filtersToggleBtn.textContent = visible ? "Hide advanced" : "Show advanced";
    });
  }

  if (elements.filtersResetBtn) {
    elements.filtersResetBtn.addEventListener("click", () => {
      clearFilters();
      renderProjects();
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

  if (elements.filterProjectPeriodToggle) {
    elements.filterProjectPeriodToggle.addEventListener("click", (event) => {
      event.stopPropagation();
      const container = elements.filterProjectPeriodToggle.closest(".filter-countries");
      if (!container) return;
      const willOpen = !container.classList.contains("open");
      if (willOpen) prepareAppOverlay("filterProjectPeriod");
      container.classList.toggle("open");
      if (willOpen && elements.filterProjectPeriodSearch) {
        elements.filterProjectPeriodSearch.focus();
        elements.filterProjectPeriodSearch.select();
      }
    });
  }

  document.addEventListener("click", (event) => {
    if (elements.filterCountriesToggle) {
      const countriesContainer = elements.filterCountriesToggle.closest(".filter-countries");
      if (countriesContainer && !countriesContainer.contains(event.target)) {
        countriesContainer.classList.remove("open");
      }
    }
    if (elements.filterProjectPeriodToggle) {
      const periodContainer = elements.filterProjectPeriodToggle.closest(".filter-countries");
      if (periodContainer && !periodContainer.contains(event.target)) {
        periodContainer.classList.remove("open");
      }
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (elements.filterCountriesToggle) {
      const countriesContainer = elements.filterCountriesToggle.closest(".filter-countries");
      if (countriesContainer) {
        countriesContainer.classList.remove("open");
      }
    }
    if (elements.filterProjectPeriodToggle) {
      const periodContainer = elements.filterProjectPeriodToggle.closest(".filter-countries");
      if (periodContainer) {
        periodContainer.classList.remove("open");
      }
    }
  });

  if (elements.filterCountriesSearch) {
    elements.filterCountriesSearch.addEventListener("input", () => {
      filterFilterCountriesBySearchTerm();
      renderProjects();
      updateFiltersActivePill();
      updateFilterCountriesSummary();
    });
  }

  if (elements.filterCountriesList) {
    elements.filterCountriesList.addEventListener("change", (event) => {
      const target = event.target;
      if (target && target.type === "checkbox") {
        syncFilterEuRegionCheckbox(target);
        renderProjects();
        updateFiltersActivePill();
        updateFilterCountriesSummary();
      }
    });
  }

  if (elements.filterProjectPeriodSearch) {
    elements.filterProjectPeriodSearch.addEventListener("input", () => {
      filterFilterProjectPeriodsBySearchTerm();
      renderProjects();
      updateFiltersActivePill();
      updateFilterProjectPeriodsSummary();
    });
  }

  if (elements.filterProjectPeriodList) {
    elements.filterProjectPeriodList.addEventListener("change", (event) => {
      const target = event.target;
      if (target && target.type === "checkbox") {
        renderProjects();
        updateFiltersActivePill();
        updateFilterProjectPeriodsSummary();
      }
    });
  }

  if (elements.addCountryBtn && elements.countriesContainer) {
    elements.addCountryBtn.addEventListener("click", () => {
      if (projectModalMode === "view") return;
      addCountryRow();
    });
    elements.countriesContainer.addEventListener("click", (event) => {
      if (projectModalMode === "view") return;
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
      if (projectModalMode === "view") return;
      const select = event.target.closest(".country-row select");
      if (!select || !isEuRegionOption(select.value)) return;
      applyEuRegionToProjectCountries();
    });
  }

  const filterInputs = [
    elements.filterTitle,
    elements.filterImpact,
    elements.filterEffort,
    elements.filterCurrency,
    elements.filterFinancialFramework,
    elements.filterStatus,
    elements.filterTshirtSize,
    elements.filterProjectType
  ].filter(Boolean); // guard against missing DOM nodes so we never throw while wiring listeners

  const applyFiltersAndUpdateUI = () => {
    renderProjects();
    updateFiltersActivePill();
  };
  const debouncedApplyFilters = typeof debounce === "function" ? debounce(applyFiltersAndUpdateUI, 200) : applyFiltersAndUpdateUI;

  filterInputs.forEach((input) => {
    if (!input) return;
    const isTitle = input === elements.filterTitle;
    const handler = isTitle ? debouncedApplyFilters : applyFiltersAndUpdateUI;
    input.addEventListener("input", handler);
    input.addEventListener("change", handler);
  });

  if (elements.selectAllProjects) {
    elements.selectAllProjects.addEventListener("change", (e) => {
      if (isActiveDemoProfile()) {
        e.target.checked = false;
        return;
      }
      const checked = e.target.checked;
      getProjectSelectCheckboxes().forEach((cb) => {
        cb.checked = checked;
      });
      syncProjectTableSelection();
    });
  }

  function handleProjectTableRowActionClick(e) {
    const viewBtn = e.target.closest("[data-action='viewProject']");
    const editBtn = e.target.closest("[data-action='editProject']");
    const deleteBtn = e.target.closest("[data-action='deleteProject']");

    if (viewBtn) {
      openProjectModal("view", viewBtn.getAttribute("data-id"));
    } else if (editBtn) {
      openProjectModal("edit", editBtn.getAttribute("data-id"));
    } else if (deleteBtn) {
      handleSingleDelete(deleteBtn.getAttribute("data-id"));
    }
  }

  function handleProjectTableSelectionChange(e) {
    if (e.target.classList.contains("project-select-checkbox")) {
      syncProjectTableSelection();
    }
  }

  function handleProjectTableSelectionClick(e) {
    if (e.target.classList.contains("project-select-checkbox")) {
      requestAnimationFrame(() => syncProjectTableSelection());
    }
  }

  function handleProjectTableTooltipMouseEnter(e) {
    if (isCompactLayoutViewport()) return;
    const wrap = findTableViewTooltipTrigger(e.target);
    if (!wrap) return;
    cancelTooltipHoverHide();
    positionProfileTooltip(wrap);
  }

  if (elements.projectsTableBody) {
    elements.projectsTableBody.addEventListener("change", handleProjectTableSelectionChange);
    elements.projectsTableBody.addEventListener("input", handleProjectTableSelectionChange);
    elements.projectsTableBody.addEventListener("click", handleProjectTableSelectionClick);
    elements.projectsTableBody.addEventListener("click", handleProjectTableRowActionClick);
    elements.projectsTableBody.addEventListener("mouseenter", handleProjectTableTooltipMouseEnter, true);
  }

  if (elements.projectsTableCardsList) {
    elements.projectsTableCardsList.addEventListener("change", handleProjectTableSelectionChange);
    elements.projectsTableCardsList.addEventListener("input", handleProjectTableSelectionChange);
    elements.projectsTableCardsList.addEventListener("click", (e) => {
      handleCompactTableTooltipClick(e);
      handleProjectTableSelectionClick(e);
      handleProjectTableRowActionClick(e);
    }, true);
    elements.projectsTableCardsList.addEventListener("mouseenter", handleProjectTableTooltipMouseEnter, true);
  }

  document.addEventListener("pointerdown", handleCompactTooltipDismissPointerDown, true);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && activeTooltipWrap) {
      hideCellTypeTooltips();
    }
  });

  const tableWrapper = elements.projectsTableBody && elements.projectsTableBody.closest(".table-wrapper");
  if (tableWrapper) {
    tableWrapper.addEventListener("scroll", () => {
      hideCellTypeTooltips();
    }, { passive: true });
  }
  if (elements.projectsTableCardsList) {
    elements.projectsTableCardsList.addEventListener("scroll", () => {
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
    if (isCompactLayoutViewport() && e.target.closest(".projects-table-card")) return;
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
    const wrap = e.target.closest(".profile-icon-wrap");
    if (!wrap) return;
    positionProfileTooltip(wrap);
  }, true);

  document.body.addEventListener("mouseenter", (e) => {
    if (isCompactLayoutViewport()) return;
    const tooltip = e.target.closest(".cell-type-tooltip.cell-type-tooltip-visible");
    if (tooltip && tooltip._ownerWrap) {
      cancelTooltipHoverHide();
      return;
    }
    const wrap = e.target.closest(
      ".profile-icon-wrap, .cell-type-icon-wrap, .scrum-board-card-type-wrap, .project-field-tooltip-wrap, .cell-date-with-tooltip, .cell-countries-with-tooltip, .cell-tshirt-with-tooltip, .cell-financial-with-tooltip, .cell-desc-with-tooltip, .cell-moscow-with-tooltip, .cell-period-with-tooltip, .cell-rice-with-tooltip, .card-meta-with-tooltip, .card-title-with-tooltip"
    );
    if (wrap) cancelTooltipHoverHide();
  }, true);

  document.body.addEventListener("mouseout", (e) => {
    if (isCompactLayoutViewport() && e.target.closest(".projects-table-card")) return;

    const tooltipEl = e.target.closest(".cell-type-tooltip.cell-type-tooltip-visible");
    if (tooltipEl && tooltipEl._ownerWrap) {
      const ownerWrap = tooltipEl._ownerWrap;
      if (e.relatedTarget && isWithinTooltipHoverZone(e.relatedTarget, ownerWrap)) return;
      scheduleTooltipHoverHide(ownerWrap, 100);
      return;
    }

    const wrap = e.target.closest(
      ".profile-icon-wrap, .cell-type-icon-wrap, .scrum-board-card-type-wrap, .project-field-tooltip-wrap, .cell-date-with-tooltip, .cell-countries-with-tooltip, .cell-tshirt-with-tooltip, .cell-financial-with-tooltip, .cell-desc-with-tooltip, .cell-moscow-with-tooltip, .cell-period-with-tooltip, .cell-rice-with-tooltip, .card-meta-with-tooltip, .card-title-with-tooltip"
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

  if (elements.projectModal) {
    elements.projectModal.addEventListener("mouseover", (e) => {
      const wrap = e.target.closest(".project-field-tooltip-wrap");
      if (!wrap) return;
      if (activeTooltipWrap === wrap) return;
      positionProfileTooltip(wrap);
    }, true);
    elements.projectModal.addEventListener("mouseleave", () => {
      hideCellTypeTooltips();
    });
    elements.projectModal.addEventListener("focusin", (e) => {
      const wrap = e.target.closest(".project-field-tooltip-wrap");
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

  elements.projectModalCloseBtn.addEventListener("click", closeProjectModal);
  elements.projectFormCancelBtn.addEventListener("click", (e) => {
    e.preventDefault();
    closeProjectModal();
  });

  elements.projectModal.addEventListener("click", (e) => {
    if (e.target === elements.projectModal) {
      closeProjectModal();
    }
  });

  if (elements.projectDeleteModal) {
    elements.projectDeleteModal.addEventListener("click", (e) => {
      if (e.target === elements.projectDeleteModal) {
        closeProjectDeleteModal();
      }
    });
  }

  elements.projectForm.addEventListener("submit", handleProjectFormSubmit);

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
    elements.projectCurrency,
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
  if (elements.filterProjectType.value) activeFilters.push("Type");
  if (getSelectedFilterCountries().length) activeFilters.push("Countries");
  if (getSelectedFilterProjectPeriods().length) activeFilters.push("Project period");
  if (elements.filterImpact.value) activeFilters.push("Impact");
  if (elements.filterEffort.value) activeFilters.push("Effort");
  if (elements.filterCurrency.value) activeFilters.push("Currency");
  if (elements.filterFinancialFramework && elements.filterFinancialFramework.value) activeFilters.push("Framework");
  if (elements.filterStatus.value) activeFilters.push("Status");
  if (elements.filterTshirtSize.value) activeFilters.push("T-shirt size");
  if (elements.filterMoscow && elements.filterMoscow.value) activeFilters.push("MOSCOW");

  if (!activeFilters.length) {
    elements.filtersActivePill.style.display = "none";
    elements.filtersActivePill.textContent = "";
    elements.filtersActivePill.setAttribute("aria-hidden", "true");
    return;
  }
  elements.filtersActivePill.style.display = "inline-flex";
  elements.filtersActivePill.setAttribute("aria-hidden", "false");
  const label = activeFilters.length === 1
    ? `1 active filter (${activeFilters[0]})`
    : `${activeFilters.length} active filters`;
  elements.filtersActivePill.textContent = label;
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
  if (elements.selectAllProjects) {
    elements.selectAllProjects.disabled = demoActive;
    elements.selectAllProjects.title = demoActive ? DEMO_READ_ONLY_ACTION_TITLE : "";
    if (demoActive) {
      elements.selectAllProjects.checked = false;
      clearProjectSelection();
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
  const projectCount = list.reduce(
    (n, p) => n + (Array.isArray(p.projects) ? p.projects.length : 0),
    0
  );
  return { profileCount, projectCount };
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
  const projectCount = state.profiles.reduce(
    (n, p) => n + (Array.isArray(p.projects) ? p.projects.length : 0),
    0
  );
  elements.importFormatModalSubtitle.textContent =
    `Choose a format, then pick a file. Merges into your workspace (${profileCount} profile${profileCount !== 1 ? "s" : ""}, ${projectCount} project${projectCount !== 1 ? "s" : ""}).`;
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
  closeModalBackdrop(elements.exportUnlockModal, { immediate });
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
  prepareAppOverlay("exportUnlockModal");
  elements.exportUnlockModal.classList.add("active");
  elements.exportUnlockModal.setAttribute("aria-hidden", "false");
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

function buildExportResultMessage(profileCount, projectCount, excludedCount, failedNames) {
  let msg = `Exported ${profileCount} profile${profileCount !== 1 ? "s" : ""} and ${projectCount} project${projectCount !== 1 ? "s" : ""}.`;
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
  if (elements.exportUnlockModal) {
    elements.exportUnlockModal.addEventListener("click", (e) => {
      if (e.target === elements.exportUnlockModal) closeExportUnlockModal();
    });
  }
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
    const { profileCount, projectCount } = getExportCounts(profiles);
    const msg = buildExportResultMessage(profileCount, projectCount, excludedCount, failedNames);
    setTimeout(() => showToast(msg), 0);
  } catch (err) {
    console.error("Export failed", err);
    window.alert("Export failed. See console for details.");
  }
}

function closeExportFormatModal({ immediate = false } = {}) {
  if (!elements.exportFormatModal) return;
  closeModalBackdrop(elements.exportFormatModal, { immediate });
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
      "projectId",
      "projectTitle",
      "projectDescription",
      "projectCreatedAt",
      "projectModifiedAt",
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
      "projectType",
      "projectStatus",
      "tshirtSize",
      "projectPeriod",
      "moscowCategory",
      "countries",
      "riceScore"
    ];

    const rows = [header.join(",")];

    profiles.forEach((profile) => {
      const profileId = profile.id || "";
      const profileName = profile.name || "";
      const profileTeam = profile.team || "";
      const profileCreatedAt = profile.createdAt || "";
      const projectsArray = Array.isArray(profile.projects) ? profile.projects : [];
      if (!projectsArray.length) {
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
          ""
        ];
        rows.push(emptyRow.join(","));
        return;
      }
      projectsArray.forEach((project) => {
        const rice = calculateRiceScore(project);
        const countries = Array.isArray(project.countries) ? project.countries.join("|") : "";
        const row = [
          escapeCsvCell(profileId),
          escapeCsvCell(profileName),
          escapeCsvCell(profileTeam),
          escapeCsvCell(profileCreatedAt),
          escapeCsvCell(project.id || ""),
          escapeCsvCell(project.title || ""),
          escapeCsvCell(project.description || ""),
          escapeCsvCell(project.createdAt || ""),
          escapeCsvCell(project.modifiedAt || ""),
          escapeCsvCell(project.reachValue != null ? String(project.reachValue) : ""),
          escapeCsvCell(project.reachDescription || ""),
          escapeCsvCell(project.impactValue != null ? String(project.impactValue) : ""),
          escapeCsvCell(project.impactDescription || ""),
          escapeCsvCell(project.confidenceValue != null ? String(project.confidenceValue) : ""),
          escapeCsvCell(project.confidenceDescription || ""),
          escapeCsvCell(project.effortValue != null ? String(project.effortValue) : ""),
          escapeCsvCell(project.effortDescription || ""),
          escapeCsvCell(project.financialImpactValue != null ? String(project.financialImpactValue) : ""),
          escapeCsvCell(project.financialImpactCurrency || ""),
          escapeCsvCell(normalizeFinancialFramework(project.financialImpactFramework)),
          escapeCsvCell(JSON.stringify(
            sanitizeFinancialImpactInputs(
              project.financialImpactFramework,
              project.financialImpactInputs || {}
            )
          )),
          escapeCsvCell(project.projectType || ""),
          escapeCsvCell(project.projectStatus || ""),
          escapeCsvCell(project.tshirtSize || ""),
          escapeCsvCell(project.projectPeriod || ""),
          escapeCsvCell(project.moscowCategory || ""),
          escapeCsvCell(countries),
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
    const { profileCount, projectCount } = getExportCounts(profiles);
    const msg = buildExportResultMessage(profileCount, projectCount, excludedCount, failedNames);
    setTimeout(() => showToast(msg), 0);
  } catch (err) {
    console.error("CSV export failed", err);
    window.alert("CSV export failed. See console for details.");
  }
}

function closeImportFormatModal({ immediate = false } = {}) {
  if (!elements.importFormatModal) return;
  closeModalBackdrop(elements.importFormatModal, { immediate });
}

function mergeImportedProfiles(importedProfiles) {
  if (!Array.isArray(importedProfiles) || !importedProfiles.length) return { addedProfiles: 0, mergedProfiles: 0, addedProjects: 0, mergedProjects: 0, skippedProjects: 0 };

  let addedProfiles = 0;
  let mergedProfiles = 0;
  let addedProjects = 0;
  let mergedProjects = 0;
  let skippedProjects = 0;

  importedProfiles.forEach((rawProfile) => {
    const profile = normalizeImportedProfile(rawProfile);
    if (!profile) return;

    const existing = state.profiles.find((p) => p.id === profile.id || p.name === profile.name);
    if (!existing) {
      state.profiles.push(profile);
      addedProfiles += 1;
      addedProjects += profile.projects.length;
      return;
    }

    mergedProfiles += 1;
    if (!Array.isArray(existing.projects)) existing.projects = [];
    const existingById = new Map(existing.projects.map((p) => [p.id, p]));
    profile.projects.forEach((proj) => {
      const normProj = normalizeImportedProject(proj);
      if (!normProj) return;
      if (existingById.has(normProj.id)) {
        skippedProjects += 1;
        return;
      }
      existing.projects.push(normProj);
      existingById.set(normProj.id, normProj);
      addedProjects += 1;
      mergedProjects += 1;
    });
  });

  return { addedProfiles, mergedProfiles, addedProjects, mergedProjects, skippedProjects };
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
      const { addedProfiles, mergedProfiles, addedProjects, mergedProjects } = mergeImportedProfiles(importedProfiles);
      if (!state.activeProfileId && state.profiles.length) {
        state.activeProfileId = resolveFallbackActiveProfileId();
      }
      saveState();
      renderProfiles();
      renderProjects();
      const addedOnly = addedProjects - mergedProjects;
      const parts = [];
      if (addedProfiles) parts.push(`${addedProfiles} profile${addedProfiles !== 1 ? "s" : ""} added`);
      if (mergedProfiles) parts.push(`${mergedProfiles} profile${mergedProfiles !== 1 ? "s" : ""} merged`);
      if (addedOnly) parts.push(`${addedOnly} project${addedOnly !== 1 ? "s" : ""} added`);
      if (mergedProjects) parts.push(`${mergedProjects} project${mergedProjects !== 1 ? "s" : ""} merged`);
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
      const { addedProfiles, mergedProfiles, addedProjects, mergedProjects } = mergeImportedProfiles(importedProfiles);
      if (!state.activeProfileId && state.profiles.length) {
        state.activeProfileId = resolveFallbackActiveProfileId();
      }
      saveState();
      renderProfiles();
      renderProjects();
      const addedOnly = addedProjects - mergedProjects;
      const parts = [];
      if (addedProfiles) parts.push(`${addedProfiles} profile${addedProfiles !== 1 ? "s" : ""} added`);
      if (mergedProfiles) parts.push(`${mergedProfiles} profile${mergedProfiles !== 1 ? "s" : ""} merged`);
      if (addedOnly) parts.push(`${addedOnly} project${addedOnly !== 1 ? "s" : ""} added`);
      if (mergedProjects) parts.push(`${mergedProjects} project${mergedProjects !== 1 ? "s" : ""} merged`);
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
        projects: []
      });
    }

    const profile = byProfileKey.get(key);

    const projectTitle = (cells[colIndex.projectTitle] ?? "").toString().trim();
    const projectIdCell = (cells[colIndex.projectId] ?? "").toString().trim();
    const anyProjectField = projectTitle || projectIdCell;
    if (!anyProjectField) return;

    const project = {
      id: projectIdCell || generateId("project"),
      createdAt: (cells[colIndex.projectCreatedAt] ?? "").toString().trim() || new Date().toISOString(),
      modifiedAt: (cells[colIndex.projectModifiedAt] ?? "").toString().trim() || undefined,
      title: projectTitle || "Imported project",
      description: (cells[colIndex.projectDescription] ?? "").toString(),
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
      projectType: (cells[colIndex.projectType] ?? "").toString().trim() || null,
      projectStatus: (cells[colIndex.projectStatus] ?? "").toString().trim() || null,
      tshirtSize: (cells[colIndex.tshirtSize] ?? "").toString().trim() || null,
      projectPeriod: (cells[colIndex.projectPeriod] ?? "").toString().trim().toUpperCase() || null,
      moscowCategory: (cells[colIndex.moscowCategory] ?? "").toString().trim() || null,
      countries: normalizeCountryNames((cells[colIndex.countries] ?? "").toString().split("|").map((c) => c.trim()).filter((c) => c !== ""))
    };
    project.riceScore = calculateRiceScore(project);
    profile.projects.push(project);
  });

  return Array.from(byProfileKey.values());
}

function normalizeImportedProfile(profile) {
  if (!profile || typeof profile !== "object") return null;
  const base = normalizeLoadedProfile({
    ...profile,
    projects: Array.isArray(profile.projects) ? profile.projects : []
  });
  if (!base) return null;
  if (!base.name || base.name === "Unnamed profile") {
    base.name = String(profile.name || "Imported profile");
  }
  const normalizedProjects = (Array.isArray(profile.projects) ? profile.projects : [])
    .map(normalizeImportedProject)
    .filter(Boolean);
  base.projects = normalizedProjects;
  return base;
}

function normalizeImportedProject(project) {
  if (!project || typeof project !== "object") return null;
  const now = new Date().toISOString();
  const id = typeof project.id === "string" && project.id.trim() ? project.id.trim() : generateId("project");
  const createdAt = project.createdAt || now;
  const modifiedAt = project.modifiedAt || createdAt;
  const reachValue = toNumberOrNull(project.reachValue);
  const impactValue = toNumberOrNull(project.impactValue);
  const confidenceValue = toNumberOrNull(project.confidenceValue);
  const effortValue = toNumberOrNull(project.effortValue);
  const financialImpactValue = toNumberOrNull(project.financialImpactValue);
  const financialImpactFramework = normalizeFinancialFramework(project.financialImpactFramework);
  const financialImpactInputs = sanitizeFinancialImpactInputs(
    financialImpactFramework,
    project.financialImpactInputs && typeof project.financialImpactInputs === "object"
      ? project.financialImpactInputs
      : {}
  );
  const periodRaw = project.projectPeriod != null ? String(project.projectPeriod).trim() : "";
  const projectPeriod = periodRaw ? periodRaw.toUpperCase() : null;
  const normalizedFinancialValue = computeFrameworkFinancialImpact(financialImpactFramework, financialImpactInputs, financialImpactValue);
  const normalized = {
    id,
    createdAt,
    modifiedAt,
    title: String(project.title || "Imported project"),
    description: String(project.description || ""),
    reachDescription: String(project.reachDescription || ""),
    reachValue: Number.isFinite(reachValue) ? reachValue : 0,
    impactDescription: String(project.impactDescription || ""),
    impactValue: Number.isFinite(impactValue) ? impactValue : 1,
    confidenceDescription: String(project.confidenceDescription || ""),
    confidenceValue: Number.isFinite(confidenceValue) ? confidenceValue : 50,
    effortDescription: String(project.effortDescription || ""),
    effortValue: Number.isFinite(effortValue) && effortValue > 0 ? effortValue : 1,
    financialImpactValue: Number.isFinite(normalizedFinancialValue) ? normalizedFinancialValue : null,
    financialImpactCurrency: normalizeCurrency(project.financialImpactCurrency),
    financialImpactFramework,
    financialImpactInputs,
    projectType: (project.projectType != null && String(project.projectType).trim() !== "") ? String(project.projectType).trim() : null,
    projectStatus: (project.projectStatus != null && String(project.projectStatus).trim() !== "") ? String(project.projectStatus).trim() : null,
    tshirtSize: (project.tshirtSize != null && String(project.tshirtSize).trim() !== "") ? String(project.tshirtSize).trim() : null,
    projectPeriod,
    moscowCategory: (project.moscowCategory != null && String(project.moscowCategory).trim() !== "" && typeof moscowList !== "undefined" && moscowList.includes(project.moscowCategory)) ? String(project.moscowCategory).trim() : null,
    countries: normalizeCountryNames(Array.isArray(project.countries) ? project.countries : [])
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

function getSelectedFilterProjectPeriods() {
  if (!elements.filterProjectPeriodList) return [];
  const checkboxes = elements.filterProjectPeriodList.querySelectorAll("input[type=\"checkbox\"]");
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

function filterFilterProjectPeriodsBySearchTerm() {
  if (!elements.filterProjectPeriodList || !elements.filterProjectPeriodSearch) return;
  const term = (elements.filterProjectPeriodSearch.value || "").trim().toLowerCase();
  const options = elements.filterProjectPeriodList.querySelectorAll(".filter-country-option");
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

function updateFilterProjectPeriodsSummary() {
  if (!elements.filterProjectPeriodSummary) return;
  const container = elements.filterProjectPeriodSummary;
  const selected = getSelectedFilterProjectPeriods();
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

function populateProjectCountrySelect(select, selectedCountry) {
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
  populateProjectCountrySelect(select, selectedCountry);

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "country-remove-btn";
  removeBtn.textContent = "×";

  row.appendChild(select);
  row.appendChild(removeBtn);
  elements.countriesContainer.appendChild(row);
}

function applyEuRegionToProjectCountries() {
  if (!elements.countriesContainer || projectModalMode === "view") return;
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

/** Preserves password hashes and board order when loading from storage or import. */
function normalizeLoadedProfile(raw) {
  if (!raw || typeof raw !== "object") return null;
  const projects = Array.isArray(raw.projects)
    ? raw.projects.map(normalizeLoadedProject).filter(Boolean)
    : [];
  const boardOrder = raw.boardOrder && typeof raw.boardOrder === "object" ? raw.boardOrder : {};
  const profile = {
    id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : generateId("profile"),
    name: String(raw.name || "Unnamed profile"),
    team: String(raw.team || ""),
    createdAt: raw.createdAt || new Date().toISOString(),
    projects,
    boardOrder
  };
  const salt = raw.passwordSalt != null ? String(raw.passwordSalt).trim() : "";
  const hash = raw.passwordHash != null ? String(raw.passwordHash).trim() : "";
  if (salt && hash) {
    profile.passwordSalt = salt;
    profile.passwordHash = hash;
  }
  return profile;
}

function serializeStatePayload() {
  return {
    profiles: state.profiles,
    activeProfileId: state.activeProfileId,
    sortField: state.sortField,
    sortDirection: state.sortDirection,
    projectsView: state.projectsView,
    tableSortByRice: state.tableSortByRice,
    tableGroupBy: state.tableGroupBy,
    scrumBoardSortByRice: state.scrumBoardSortByRice,
    moscowSortByRice: state.moscowSortByRice,
    mapMetric: state.mapMetric,
    exchangeRatesToEUR: state.exchangeRatesToEUR,
    exchangeRatesDate: state.exchangeRatesDate,
    exchangeRatesLastSource: state.exchangeRatesLastSource
  };
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

    state.sortField = !Array.isArray(parsed) && parsed.sortField ? parsed.sortField : "createdAt";
    state.sortDirection = !Array.isArray(parsed) && parsed.sortDirection ? parsed.sortDirection : "desc";
    if (!Array.isArray(parsed) && (parsed.projectsView === "table" || parsed.projectsView === "board" || parsed.projectsView === "moscow" || parsed.projectsView === "map")) {
      state.projectsView = parsed.projectsView;
    }
    if (!Array.isArray(parsed) && typeof parsed.tableSortByRice === "boolean") {
      state.tableSortByRice = parsed.tableSortByRice;
    }
    if (
      !Array.isArray(parsed) &&
      typeof TABLE_GROUP_BY_OPTIONS !== "undefined" &&
      TABLE_GROUP_BY_OPTIONS.some((opt) => opt.id === parsed.tableGroupBy)
    ) {
      state.tableGroupBy = parsed.tableGroupBy;
    }
    if (!Array.isArray(parsed) && typeof parsed.scrumBoardSortByRice === "boolean") {
      state.scrumBoardSortByRice = parsed.scrumBoardSortByRice;
    }
    if (!Array.isArray(parsed) && typeof parsed.moscowSortByRice === "boolean") {
      state.moscowSortByRice = parsed.moscowSortByRice;
    }
    if (!Array.isArray(parsed) && MAP_METRIC_OPTIONS.some((opt) => opt.id === parsed.mapMetric)) {
      state.mapMetric = parsed.mapMetric;
    }
    if (!Array.isArray(parsed) && parsed.exchangeRatesToEUR && typeof parsed.exchangeRatesToEUR === "object") {
      state.exchangeRatesToEUR = parsed.exchangeRatesToEUR;
    }
    if (!Array.isArray(parsed) && parsed.exchangeRatesDate) {
      state.exchangeRatesDate = parsed.exchangeRatesDate;
    }
    if (!Array.isArray(parsed) && (parsed.exchangeRatesLastSource === "manual" || parsed.exchangeRatesLastSource === "auto")) {
      state.exchangeRatesLastSource = parsed.exchangeRatesLastSource;
    }
  } catch (err) {
    console.error("Failed to apply stored state", err);
  }
}

/** Ensures a project loaded from localStorage has required fields so RICE and render don't break. */
function normalizeLoadedProject(project) {
  if (!project || typeof project !== "object") return null;
  const now = new Date().toISOString();
  const id = typeof project.id === "string" && project.id.trim() ? project.id.trim() : generateId("project");
  const createdAt = project.createdAt || now;
  const modifiedAt = project.modifiedAt || createdAt;
  const reachValue = toNumberOrNull(project.reachValue);
  const impactValue = toNumberOrNull(project.impactValue);
  const confidenceValue = toNumberOrNull(project.confidenceValue);
  const effortValue = toNumberOrNull(project.effortValue);
  const periodRaw = project.projectPeriod != null ? String(project.projectPeriod).trim() : "";
  const projectPeriod = periodRaw ? periodRaw.toUpperCase() : null;
  const financialImpactFramework = normalizeFinancialFramework(project.financialImpactFramework);
  const financialImpactInputs = sanitizeFinancialImpactInputs(
    financialImpactFramework,
    project.financialImpactInputs && typeof project.financialImpactInputs === "object"
      ? project.financialImpactInputs
      : {}
  );
  const normalizedFinancialValue = computeFrameworkFinancialImpact(
    financialImpactFramework,
    financialImpactInputs,
    Number.isFinite(toNumberOrNull(project.financialImpactValue)) ? Number(project.financialImpactValue) : null
  );
  return {
    id,
    createdAt,
    modifiedAt,
    title: String(project.title || "Untitled project"),
    description: String(project.description || ""),
    reachDescription: String(project.reachDescription || ""),
    reachValue: Number.isFinite(reachValue) ? reachValue : 0,
    impactDescription: String(project.impactDescription || ""),
    impactValue: Number.isFinite(impactValue) ? impactValue : 1,
    confidenceDescription: String(project.confidenceDescription || ""),
    confidenceValue: Number.isFinite(confidenceValue) ? confidenceValue : 50,
    effortDescription: String(project.effortDescription || ""),
    effortValue: Number.isFinite(effortValue) && effortValue > 0 ? effortValue : 1,
    financialImpactValue: Number.isFinite(normalizedFinancialValue) ? normalizedFinancialValue : null,
    financialImpactCurrency: normalizeCurrency(project.financialImpactCurrency),
    financialImpactFramework,
    financialImpactInputs,
    projectType: (project.projectType != null && String(project.projectType).trim() !== "") ? String(project.projectType).trim() : null,
    projectStatus: (project.projectStatus != null && String(project.projectStatus).trim() !== "") ? String(project.projectStatus).trim() : null,
    tshirtSize: (project.tshirtSize != null && String(project.tshirtSize).trim() !== "") ? String(project.tshirtSize).trim() : null,
    projectPeriod,
    moscowCategory: (project.moscowCategory != null && String(project.moscowCategory).trim() !== "" && typeof moscowList !== "undefined" && moscowList.includes(project.moscowCategory)) ? String(project.moscowCategory).trim() : null,
    countries: normalizeCountryNames(Array.isArray(project.countries) ? project.countries : [])
  };
}

function saveState() {
  const payload = serializeStatePayload();
  try {
    if (typeof AppStorage !== "undefined") {
      AppStorage.persistState(payload);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }
  } catch (err) {
    console.error("Failed to persist state", err);
  }
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
      projects: []
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

/** Active profile only when unlocked — use for any project/portfolio data access. */
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
      "Enter your password below to access projects, filters, and all portfolio views.";
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
    projects: []
  };
  const pwd = (password || "").trim();
  if (pwd) {
    await applyProfilePassword(profile, pwd);
  }
  state.profiles.push(profile);
  state.activeProfileId = profile.id;
  saveState();
  renderProfiles();
  renderProjects();
  if (pwd && !isProfileUnlocked(profile.id)) {
    pendingUnlockAction = { type: "activate", profileId: profile.id };
    openProfileUnlockModal(profile.id);
    showToast("Profile created. Enter the password to access projects.");
  }
}

function setActiveProfile(profileId) {
  const profile = state.profiles.find((p) => p.id === profileId);
  if (!profile) return;
  state.activeProfileId = profileId;
  saveState();
  renderProfiles();
  clearFilters();
  renderProjects();
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

// --- Render (profiles list, projects table) ---
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
    : document.querySelector(".projects-view.view-pseudo-fullscreen");
  return document.fullscreenElement || document.webkitFullscreenElement || pseudo || document.body;
}

function invalidateMapSizeAfterFullscreenExit() {
  const map = elements.projectsMapContainer && elements.projectsMapContainer._leafletMap;
  if (!map) return;
  map.invalidateSize();
  requestAnimationFrame(() => map.invalidateSize());
  setTimeout(() => map.invalidateSize(), 120);
  setTimeout(() => map.invalidateSize(), 320);
}

function syncProjectsViewVisibility() {
  if (!elements.projectsTableView || !elements.projectsBoardView) return;
  const view = state.projectsView;
  const showTable = view === "table";
  const showBoard = view === "board";
  const showMoscow = view === "moscow";
  const showMap = view === "map";

  elements.projectsTableView.style.display = showTable ? "flex" : "none";
  elements.projectsBoardView.style.display = showBoard ? "flex" : "none";
  elements.projectsBoardView.setAttribute("aria-hidden", String(!showBoard));
  if (elements.projectsMoscowView) {
    elements.projectsMoscowView.style.display = showMoscow ? "flex" : "none";
    elements.projectsMoscowView.setAttribute("aria-hidden", String(!showMoscow));
  }
  if (elements.projectsMapView) {
    elements.projectsMapView.style.display = showMap ? "flex" : "none";
    elements.projectsMapView.setAttribute("aria-hidden", String(!showMap));
  }
}

function getActiveProjectsViewRoot() {
  if (state.projectsView === "table") return elements.projectsTableView;
  if (state.projectsView === "board") return elements.projectsBoardView;
  if (state.projectsView === "moscow") return elements.projectsMoscowView;
  if (state.projectsView === "map") return elements.projectsMapView;
  return null;
}

function resetActiveViewShellLayout() {
  const viewRoot = getActiveProjectsViewRoot();
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
    ".view-toolbar, .view-toolbar__row, .projects-map-container, .projects-map-legend, .scrum-board, .moscow-grid, .table-wrapper"
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
  const root = getActiveProjectsViewRoot();
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

  if (state.projectsView === "moscow") {
    syncMoscowCompactNav();
  }

  if (state.projectsView === "map") {
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
  syncProjectsViewVisibility();
  syncPortfolioViewTabState();
  updateBulkDeleteButton();

  const view = state.projectsView;
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
  const root = getTooltipRoot();
  if (backdrop.parentNode !== root) root.appendChild(backdrop);
  backdrop.classList.add("compact-tooltip-backdrop--visible");
}

const TABLE_VIEW_TOOLTIP_TRIGGER_SELECTOR =
  ".cell-type-icon-wrap, .cell-date-with-tooltip, .cell-countries-with-tooltip, .cell-tshirt-with-tooltip, .cell-financial-with-tooltip, .cell-desc-with-tooltip, .cell-moscow-with-tooltip, .cell-period-with-tooltip, .cell-rice-with-tooltip, .card-meta-with-tooltip, .card-title-with-tooltip, .projects-table-card__status-pill, .projects-table-card__chip--more";

function findTableViewTooltipTrigger(target) {
  if (!target || !(target instanceof Element)) return null;
  return target.closest(TABLE_VIEW_TOOLTIP_TRIGGER_SELECTOR);
}

function isTableCardActionControl(target) {
  return !!(
    target &&
    target.closest(
      ".project-action-btn, .project-select-checkbox, .country-remove-btn, .country-row select, .country-row button"
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
    const maxHeightCap = Math.min(Math.floor(vh * 0.55), 320);
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
  if (wrap.classList.contains("project-field-tooltip-wrap")) {
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

  if (wrap.classList.contains("project-field-tooltip-wrap")) {
    tooltip.classList.add("cell-type-tooltip--field");
  } else {
    tooltip.classList.remove("cell-type-tooltip--field");
  }

  const useWideTooltip =
    wrap.classList.contains("card-title-with-tooltip") ||
    wrap.classList.contains("cell-countries-with-tooltip") ||
    wrap.classList.contains("cell-rice-with-tooltip");
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
  if (!wrap || !wrap.closest(".projects-table-card")) {
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

/** Sync primary project actions (toolbar + mobile FAB). */
function syncPortfolioActionButtons() {
  const profile = getActiveProfile();
  const locked = profile ? !isProfileUnlocked(profile.id) : true;
  const demoReadOnly = isActiveDemoProfile();
  const disabled = !profile || locked || demoReadOnly;
  if (elements.addProjectBtn) {
    elements.addProjectBtn.disabled = disabled;
    elements.addProjectBtn.title = demoReadOnly ? DEMO_READ_ONLY_ACTION_TITLE : "";
  }
  if (elements.portfolioFabAddProject) {
    elements.portfolioFabAddProject.disabled = disabled;
    elements.portfolioFabAddProject.title = demoReadOnly ? DEMO_READ_ONLY_ACTION_TITLE : "";
  }
}

/** Portfolio workspace: filters drawer (collapsed by default), mobile FAB. */
const FILTERS_DRAWER_STORAGE_KEY = "pmpt-filters-drawer-open";

function initPortfolioFiltersDrawer() {
  const drawer = elements.portfolioFiltersDrawer || $("portfolioFiltersDrawer");
  if (!drawer) return;

  try {
    drawer.open = localStorage.getItem(FILTERS_DRAWER_STORAGE_KEY) === "1";
  } catch (err) {
    drawer.open = false;
  }

  drawer.addEventListener("toggle", () => {
    try {
      localStorage.setItem(FILTERS_DRAWER_STORAGE_KEY, drawer.open ? "1" : "0");
    } catch (err) {
      console.warn("Could not persist filters drawer state", err);
    }
    if (!drawer.open) {
      closeFilterCountriesPopup();
      closeFilterProjectPeriodPopup();
    }
    syncPortfolioFiltersDrawerState();
  });

  syncPortfolioFiltersDrawerState();
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

  if (elements.portfolioFabAddProject && elements.addProjectBtn) {
    elements.portfolioFabAddProject.addEventListener("click", () => {
      if (!elements.addProjectBtn.disabled) elements.addProjectBtn.click();
    });
  }

  window.addEventListener("resize", () => updateBulkDeleteButton());
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

function closeModalBackdrop(el, { immediate = false } = {}) {
  if (!el) return;
  if (immediate) markOverlayCloseImmediate(el);
  el.classList.remove("active");
  el.setAttribute("aria-hidden", "true");
}

function prepareAppOverlay(id) {
  if (typeof OverlayManager !== "undefined") OverlayManager.prepareOpen(id);
  hideCellTypeTooltips();
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

function closeFilterProjectPeriodPopup() {
  const container = elements.filterProjectPeriodToggle?.closest(".filter-countries");
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
  OverlayManager.register("filterProjectPeriod", closeFilterProjectPeriodPopup);
  OverlayManager.register("projectModal", closeNow(closeProjectModal));
  OverlayManager.register("profileViewModal", closeNow(closeProfileViewModal));
  OverlayManager.register("profileEditModal", closeNow(closeProfileEditModal));
  OverlayManager.register("profileDeleteModal", closeNow(closeProfileDeleteModal));
  OverlayManager.register("profileUnlockModal", closeNow(closeProfileUnlockModal));
  OverlayManager.register("projectDeleteModal", closeNow(closeProjectDeleteModal));
  OverlayManager.register("exportFormatModal", closeNow(closeExportFormatModal));
  OverlayManager.register("importFormatModal", closeNow(closeImportFormatModal));
  OverlayManager.register("exportUnlockModal", closeNow(closeExportUnlockModal));
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

function updatePortfolioHeaderSubtitle(text, { hideWhenEmpty = true, hideWhenSameAsTitle = false, title = "" } = {}) {
  const el = elements.activeProfileSubtitleText || $("activeProfileSubtitleText");
  if (!el) return;

  const normalized = (text || "").trim();
  const titleNorm = (title || "").trim().toLowerCase();
  const shouldHide =
    (hideWhenEmpty && !normalized) ||
    (hideWhenSameAsTitle && normalized.toLowerCase() === titleNorm) ||
    (isCompactProfilesLayout() && normalized === "Profile ready for prioritization.");

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

function scrollActivePortfolioViewTabIntoView() {
  const tabs = document.querySelector(".portfolio-view-tabs");
  if (!tabs) return;
  if (tabs.scrollWidth <= tabs.clientWidth + 2) return;
  const active = tabs.querySelector(".view-toggle-btn--active, .view-toggle-btn[aria-selected='true']");
  if (active && typeof active.scrollIntoView === "function") {
    requestAnimationFrame(() => {
      active.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    });
  }
}

function blurPortfolioViewTabs() {
  const tabs = [
    elements.projectsViewTableBtn,
    elements.projectsViewBoardBtn,
    elements.projectsViewMoscowBtn,
    elements.projectsViewMapBtn
  ].filter(Boolean);
  tabs.forEach((btn) => {
    btn.classList.remove("view-toggle-btn--pressed");
    btn.removeAttribute("title");
    if (document.activeElement === btn) btn.blur();
  });
}

function syncPortfolioViewTabState(view) {
  const activeView = view || state.projectsView;
  const tabMap = [
    [elements.projectsViewTableBtn, "table"],
    [elements.projectsViewBoardBtn, "board"],
    [elements.projectsViewMoscowBtn, "moscow"],
    [elements.projectsViewMapBtn, "map"]
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

    const projectCount = Array.isArray(profile.projects) ? profile.projects.length : 0;
    const countSpan = document.createElement("span");
    countSpan.className = "profile-item-count";
    countSpan.textContent = projectCount === 1 ? "1 project" : `${projectCount} projects`;
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
      demoProfileCard ? DEMO_READ_ONLY_ACTION_TITLE : "Remove this profile and all its projects permanently",
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
    elements.activeProfileTitleText.textContent = "No profile selected";
    if (typeof Fullscreen !== "undefined" && typeof Fullscreen.syncChromeContext === "function") {
      Fullscreen.syncChromeContext();
    }
    updatePortfolioHeaderSubtitle(
      isCompactProfilesLayout()
        ? "Use the profile picker above or Manage to add workspaces."
        : "Create or select a profile to start adding projects."
    );
    elements.projectsHeaderBadges.innerHTML = "";
    updateBulkDeleteButton();
    syncPortfolioActionButtons();
    return;
  }

  elements.activeProfileTitleText.textContent = activeProfile.name;
  if (typeof Fullscreen !== "undefined" && typeof Fullscreen.syncChromeContext === "function") {
    Fullscreen.syncChromeContext();
  }
  const teamLabel = (activeProfile.team || "").trim();
  const locked = !isProfileUnlocked(activeProfile.id);
  const demoReadOnly = isActiveDemoProfile();
  updatePortfolioHeaderSubtitle(
    locked
      ? "Enter the profile password to view and manage projects."
      : teamLabel || "Profile ready for prioritization.",
    { hideWhenSameAsTitle: true, title: activeProfile.name }
  );

  if (elements.projectsHeaderBadges) {
    elements.projectsHeaderBadges.innerHTML = demoReadOnly && !locked
      ? '<span class="portfolio-demo-badge" title="Browse only — add, edit, and delete are disabled">Read-only demo</span>'
      : "";
  }
  syncPortfolioActionButtons();
  syncDemoReadOnlyChrome();
  updateProfileLockedBanner();
}

function renderProjects() {
  const activeProfile = getActiveProfile();
  const demoReadOnly = isActiveDemoProfile();
  syncDemoReadOnlyChrome();
  elements.projectsTableBody.innerHTML = "";
  if (elements.projectsTableCardsList) {
    elements.projectsTableCardsList.innerHTML = "";
  }
  updateProfileLockedBanner();

  if (elements.tableSortByRiceToggle) {
    elements.tableSortByRiceToggle.checked = state.tableSortByRice;
  }

  if (!activeProfile) {
    renderProjectsTableEmptyMessage("Create or select a profile to start adding projects.");
    updateBulkDeleteButton();
    if (state.projectsView === "board" && elements.scrumBoardContainer) {
      renderScrumBoard();
    }
    if (state.projectsView === "moscow" && elements.moscowBoardContainer) {
      renderMoscowBoard();
    }
    if (state.projectsView === "map" && elements.projectsMapContainer) {
      renderProjectsMap();
    }
    return;
  }

  if (!isProfileUnlocked(activeProfile.id)) {
    renderProjectsTableEmptyMessage(
      "This profile is locked. Enter your password in the banner above to unlock."
    );
    updateBulkDeleteButton();
    syncPortfolioActionButtons();
    if (elements.selectAllProjects) elements.selectAllProjects.checked = false;
    if (state.projectsView === "board" && elements.scrumBoardContainer) {
      elements.scrumBoardContainer.innerHTML =
        '<p class="empty-state">Unlock this profile to use the board view.</p>';
    }
    if (state.projectsView === "moscow" && elements.moscowBoardContainer) {
      elements.moscowBoardContainer.innerHTML =
        '<p class="empty-state">Unlock this profile to use the MOSCOW view.</p>';
    }
    if (state.projectsView === "map" && elements.projectsMapContainer) {
      elements.projectsMapContainer.innerHTML =
        '<p class="empty-state">Unlock this profile to use the map view.</p>';
    }
    return;
  }

  const baseProjects = activeProfile.projects.slice();

  baseProjects.forEach((p) => {
    p.riceScore = calculateRiceScore(p);
  });

  initFilterProjectPeriodOptions(baseProjects);

  let projects = applyFilters(baseProjects);
  projects = sortProjects(projects);

  if (!projects.length) {
    renderProjectsTableEmptyMessage(
      "No projects match the current filters. Adjust filters or add a new project."
    );
    updateBulkDeleteButton();
    elements.selectAllProjects.checked = false;
    if (state.projectsView === "board" && elements.scrumBoardContainer) {
      renderScrumBoard();
    }
    if (state.projectsView === "moscow" && elements.moscowBoardContainer) {
      renderMoscowBoard();
    }
    if (state.projectsView === "map" && elements.projectsMapContainer) {
      renderProjectsMap();
    }
    return;
  }

  const useCompactTableCards = isTableCompactLayout();

  if (useCompactTableCards) {
    renderProjectsTableCards(projects, demoReadOnly);
    syncHeaderCheckbox();
    updateBulkDeleteButton();
    updateSortIndicators();
    if (state.projectsView === "table" && projects.some((p) => p.financialImpactValue != null && p.financialImpactValue !== "")) {
      if (Object.keys(state.exchangeRatesToEUR || {}).length === 0) {
        ExchangeRates.ensure().then(() => renderProjects()).catch(() => {});
      }
    }
    if (state.projectsView === "board" && elements.scrumBoardContainer) {
      renderScrumBoard();
    }
    if (state.projectsView === "moscow" && elements.moscowBoardContainer) {
      renderMoscowBoard();
    }
    if (state.projectsView === "map" && elements.projectsMapContainer) {
      renderProjectsMap();
    }
    return;
  }

  const rows = document.createDocumentFragment();
  projects.forEach((project) => {
    const tr = document.createElement("tr");

    const tdSelect = document.createElement("td");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "checkbox-input project-select-checkbox";
    cb.setAttribute("data-id", project.id);
    if (demoReadOnly) {
      cb.disabled = true;
      cb.title = DEMO_READ_ONLY_ACTION_TITLE;
    }
    tdSelect.appendChild(cb);
    tr.appendChild(tdSelect);

    const tdTitle = document.createElement("td");
    const countries = Array.isArray(project.countries) ? project.countries : [];
    const titleBlock = document.createElement("div");
    titleBlock.className = "cell-title-block";
    const projectDesc = project.description || "";
    const titleDiv = document.createElement("div");
    titleDiv.className = "cell-title";
    titleDiv.textContent = project.title || "";
    if (projectDesc) {
      const descWrap = document.createElement("span");
      descWrap.className = "cell-desc-with-tooltip";
      descWrap.setAttribute("aria-label", "Project name; hover for description");
      descWrap.appendChild(titleDiv);
      const tooltipEl = document.createElement("div");
      tooltipEl.className = "cell-type-tooltip cell-type-tooltip--wide";
      tooltipEl.setAttribute("role", "tooltip");
      const tooltipTitleEl = document.createElement("div");
      tooltipTitleEl.className = "cell-type-tooltip-title";
      tooltipTitleEl.textContent = "Description";
      tooltipEl.appendChild(tooltipTitleEl);
      const tooltipBodyEl = document.createElement("div");
      tooltipBodyEl.className = "cell-type-tooltip-body";
      const paragraphs = String(projectDesc).split(/\n\n+/);
      paragraphs.forEach((p) => {
        const block = document.createElement("p");
        block.textContent = p.trim();
        if (block.textContent) tooltipBodyEl.appendChild(block);
      });
      tooltipEl.appendChild(tooltipBodyEl);
      descWrap.appendChild(tooltipEl);
      titleBlock.appendChild(descWrap);
    } else {
      titleBlock.appendChild(titleDiv);
    }
    if (countries.length) {
      const normalizedCountries = normalizeProjectCountriesList(countries);
      const isEuRegion = projectCountriesRepresentEuRegion(normalizedCountries);
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

    const tdType = document.createElement("td");
    if (project.projectType) {
      const meta = projectTypeIcons && projectTypeIcons[project.projectType];
      const wrapper = document.createElement("span");
      wrapper.className = "cell-type-icon-wrap cell-type-pill";
      wrapper.dataset.type = project.projectType;
      wrapper.dataset.iconKind = "type";
      wrapper.setAttribute("role", "img");
      wrapper.setAttribute("aria-label", project.projectType);
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
        wrapper.textContent = project.projectType;
      }
      tdType.appendChild(wrapper);
    } else {
      tdType.innerHTML = `<span class="cell-meta">—</span>`;
    }
    tr.appendChild(tdType);

    const tdStatus = document.createElement("td");
    if (project.projectStatus) {
      const meta = projectStatusIcons && projectStatusIcons[project.projectStatus];
      const wrapper = document.createElement("span");
      wrapper.className = "cell-type-icon-wrap cell-type-pill cell-status-icon-wrap";
      wrapper.dataset.status = project.projectStatus;
      wrapper.dataset.iconKind = "status";
      wrapper.setAttribute("role", "img");
      wrapper.setAttribute("aria-label", project.projectStatus);
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
        wrapper.textContent = project.projectStatus;
      }
      tdStatus.appendChild(wrapper);
    } else {
      tdStatus.innerHTML = `<span class="cell-meta">—</span>`;
    }
    tr.appendChild(tdStatus);

    const tdFramework = document.createElement("td");
    const frameworkKey = normalizeFinancialFramework(project.financialImpactFramework);
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
    const periodValue = project.projectPeriod || "";
    if (periodValue && typeof projectPeriodTooltip !== "undefined") {
      const meta = projectPeriodTooltip;
      const wrap = document.createElement("span");
      wrap.className = "cell-period-with-tooltip";
      wrap.setAttribute("aria-label", `Project period: ${periodValue}`);
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
    if (project.tshirtSize) {
      const meta = tshirtSizeTooltips && tshirtSizeTooltips[project.tshirtSize];
      const wrap = document.createElement("span");
      wrap.className = "cell-tshirt-with-tooltip";
      wrap.setAttribute("aria-label", `T-shirt size: ${project.tshirtSize}`);
      const textSpan = document.createElement("span");
      textSpan.className = "cell-meta cell-tshirt-size-text";
      textSpan.textContent = project.tshirtSize;
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
    const moscowSlug = moscowTablePillSlug(project.moscowCategory);
    if (project.moscowCategory && typeof moscowTooltips !== "undefined" && moscowTooltips[project.moscowCategory]) {
      const meta = moscowTooltips[project.moscowCategory];
      const wrap = document.createElement("span");
      wrap.className = "cell-moscow-with-tooltip";
      wrap.setAttribute("aria-label", `MOSCOW: ${project.moscowCategory}`);
      const textSpan = document.createElement("span");
      textSpan.className = `cell-meta cell-moscow-text moscow-pill moscow-pill--${moscowSlug}`;
      textSpan.textContent = moscowTableShortLabel(project.moscowCategory);
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
    } else if (project.moscowCategory) {
      const pill = document.createElement("span");
      pill.className = `cell-meta moscow-pill moscow-pill--${moscowSlug}`;
      pill.textContent = moscowTableShortLabel(project.moscowCategory);
      tdMoscow.appendChild(pill);
    } else {
      const empty = document.createElement("span");
      empty.className = "cell-meta moscow-pill moscow-pill--unset";
      empty.textContent = "—";
      tdMoscow.appendChild(empty);
    }
    tr.appendChild(tdMoscow);

    const tdRice = document.createElement("td");
    const riceScore = calculateRiceScore(project);
    tdRice.className = "cell-rice";

    const reachVal = project.reachValue != null ? String(project.reachValue) : "—";
    const impactVal = project.impactValue != null ? String(project.impactValue) : "—";
    const confidenceVal = project.confidenceValue != null ? String(project.confidenceValue) : "—";
    const effortVal = project.effortValue != null ? String(project.effortValue) : "—";
    const reachNum = Number(project.reachValue);
    const impactNum = Number(project.impactValue);
    const confidenceNum = Number(project.confidenceValue);
    const effortNum = Number(project.effortValue);
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
    if (project.financialImpactValue != null && project.financialImpactValue !== "") {
      const raw = project.financialImpactValue;
      const amount = Number.isFinite(raw) ? raw : (typeof raw === "string" ? parseFloat(raw) : 0);
      const currency = (project.financialImpactCurrency || "EUR").toString().trim().toUpperCase() || "EUR";
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
    const createdWrap = document.createElement("span");
    createdWrap.className = "cell-date-with-tooltip";
    createdWrap.setAttribute("aria-label", "Created date; hover for last modified");
    const createdText = document.createElement("span");
    createdText.className = "cell-meta cell-created-date-text";
    createdText.textContent = formatDateTime(project.createdAt);
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
    modifiedP.textContent = formatDateTime(project.modifiedAt || project.createdAt);
    modifiedBody.appendChild(modifiedP);
    modifiedTooltip.appendChild(modifiedBody);
    createdWrap.appendChild(modifiedTooltip);
    tdCreated.appendChild(createdWrap);
    tr.appendChild(tdCreated);

    const tdActions = document.createElement("td");
    tdActions.className = "cell-actions-cell";

    const actionsWrap = document.createElement("div");
    actionsWrap.className = "cell-actions cell-actions--project project-row-actions";

    const viewBtn = document.createElement("button");
    viewBtn.type = "button";
    viewBtn.setAttribute("data-id", project.id);
    setProjectTableActionButton(viewBtn, "view", "View");

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.setAttribute("data-id", project.id);
    setProjectTableActionButton(editBtn, "edit", "Edit", { disabled: demoReadOnly });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.setAttribute("data-id", project.id);
    setProjectTableActionButton(deleteBtn, "delete", "Delete", { disabled: demoReadOnly });

    actionsWrap.appendChild(viewBtn);
    actionsWrap.appendChild(editBtn);
    actionsWrap.appendChild(deleteBtn);
    tdActions.appendChild(actionsWrap);
    tr.appendChild(tdActions);

    rows.appendChild(tr);
  });

  elements.projectsTableBody.appendChild(rows);
  syncHeaderCheckbox();
  updateBulkDeleteButton();
  updateSortIndicators();
  if (state.projectsView === "table" && projects.some((p) => p.financialImpactValue != null && p.financialImpactValue !== "")) {
    if (Object.keys(state.exchangeRatesToEUR || {}).length === 0) {
      ExchangeRates.ensure().then(() => renderProjects()).catch(() => {});
    }
  }
  if (state.projectsView === "board" && elements.scrumBoardContainer) {
    renderScrumBoard();
  }
  if (state.projectsView === "moscow" && elements.moscowBoardContainer) {
    renderMoscowBoard();
  }
  if (state.projectsView === "map" && elements.projectsMapContainer) {
    renderProjectsMap();
  }
}

function switchProjectsView(view) {
  state.projectsView = view;
  saveState();
  if (!elements.projectsTableView || !elements.projectsBoardView) return;

  const showTable = view === "table";
  const showBoard = view === "board";
  const showMoscow = view === "moscow";
  const showMap = view === "map";

  elements.projectsTableView.style.display = showTable ? "" : "none";
  elements.projectsBoardView.style.display = showBoard ? "flex" : "none";
  elements.projectsBoardView.setAttribute("aria-hidden", String(!showBoard));
  if (elements.projectsMoscowView) {
    elements.projectsMoscowView.style.display = showMoscow ? "flex" : "none";
    elements.projectsMoscowView.setAttribute("aria-hidden", String(!showMoscow));
  }
  if (elements.projectsMapView) {
    elements.projectsMapView.style.display = showMap ? "flex" : "none";
    elements.projectsMapView.setAttribute("aria-hidden", String(!showMap));
  }

  if (!showTable) {
    clearProjectSelection();
  }

  if (typeof Fullscreen !== "undefined" && !Fullscreen.isViewFullscreen()) {
    if (typeof Fullscreen.restoreWorkspaceChrome === "function") {
      Fullscreen.restoreWorkspaceChrome();
    }
  }

  syncPortfolioViewTabState(view);
  scrollActivePortfolioViewTabIntoView();
  blurPortfolioViewTabs();
  renderProjects();
  updateBulkDeleteButton();
  if (showMap) {
    requestAnimationFrame(() => {
      if (state.projectsView !== "map" || !elements.projectsMapContainer) return;
      invalidateMapSizeAfterFullscreenExit();
    });
  }
  syncMoscowCompactNav();
}

/** Returns a map of ISO 2-letter country code -> number of projects that target that country (active profile, filtered). */
function getProjectCountByCountryCode() {
  const activeProfile = getUnlockedActiveProfile();
  if (!activeProfile || !Array.isArray(activeProfile.projects)) return {};
  const baseProjects = activeProfile.projects.slice();
  initFilterProjectPeriodOptions(baseProjects);
  const projects = applyFilters(baseProjects);
  const countByCode = {};
  projects.forEach((p) => {
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

/** Returns a map of ISO 2-letter country code -> sum of RICE scores for projects that target that country (active profile, filtered). */
function getCountryRiceByCode() {
  const activeProfile = getUnlockedActiveProfile();
  if (!activeProfile || !Array.isArray(activeProfile.projects)) return {};
  const baseProjects = activeProfile.projects.slice();
  baseProjects.forEach((p) => {
    p.riceScore = typeof calculateRiceScore === "function" ? calculateRiceScore(p) : 0;
  });
  initFilterProjectPeriodOptions(baseProjects);
  const projects = applyFilters(baseProjects);
  const riceByCode = {};
  projects.forEach((p) => {
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
  const activeProfile = getUnlockedActiveProfile();
  if (!activeProfile || !Array.isArray(activeProfile.projects)) return {};
  const baseProjects = activeProfile.projects.slice();
  initFilterProjectPeriodOptions(baseProjects);
  const projects = applyFilters(baseProjects);
  const impactByCode = {};
  projects.forEach((p) => {
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

/** ISO code -> mean RICE score among projects targeting that country (filtered, active profile). */
function getCountryAverageRiceByCode() {
  const riceByCode = getCountryRiceByCode();
  const countByCode = getProjectCountByCountryCode();
  const avgByCode = {};
  Object.keys(countByCode).forEach((code) => {
    const count = countByCode[code] || 0;
    if (count > 0) avgByCode[code] = (riceByCode[code] || 0) / count;
  });
  return avgByCode;
}

/** ISO code -> mean financial impact in EUR among projects targeting that country (filtered, active profile). */
function getCountryAverageFinancialImpactByCode() {
  const totalByCode = getCountryFinancialImpactByCode();
  const countByCode = getProjectCountByCountryCode();
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
  const current = isValidMapMetric(metric) ? metric : "projects";
  if (current === "rice") return getCountryRiceByCode();
  if (current === "riceAvg") return getCountryAverageRiceByCode();
  if (current === "financial") return getCountryFinancialImpactByCode();
  if (current === "financialAvg") return getCountryAverageFinancialImpactByCode();
  return getProjectCountByCountryCode();
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

const PROJECTS_MAP_GEOJSON_URL = "https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_110m_admin_0_countries.geojson";

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
  return isValidMapMetric(state.mapMetric) ? state.mapMetric : "projects";
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
  if (state.projectsView === "map" && elements.projectsMapContainer) renderProjectsMap();
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

function renderProjectsMap() {
  if (!elements.projectsMapContainer || typeof L === "undefined") return;
  const activeProfile = getActiveProfile();
  const unlockedProfile = getUnlockedActiveProfile();

  if (elements.projectsMapLegend) {
    elements.projectsMapLegend.innerHTML = "";
    elements.projectsMapLegend.textContent = "Loading map…";
  }

  if (!activeProfile) {
    if (elements.projectsMapContainer._leafletMap) {
      elements.projectsMapContainer._leafletMap.remove();
      elements.projectsMapContainer._leafletMap = null;
    }
    elements.projectsMapContainer._geoLayer = null;
    elements.projectsMapContainer.innerHTML = '<div class="projects-map-empty">Select a profile to see the map.</div>';
    return;
  }

  if (!unlockedProfile) {
    if (elements.projectsMapContainer._leafletMap) {
      elements.projectsMapContainer._leafletMap.remove();
      elements.projectsMapContainer._leafletMap = null;
    }
    elements.projectsMapContainer._geoLayer = null;
    elements.projectsMapContainer.innerHTML =
      '<div class="projects-map-empty">Unlock this profile to use the map view.</div>';
    if (elements.projectsMapLegend) {
      elements.projectsMapLegend.textContent = "";
    }
    return;
  }

  syncMapMetricPickerUI();

  const countByCode = getProjectCountByCountryCode();

  function formatEur(num) {
    const short = typeof formatFinancialShort === "function" ? formatFinancialShort(Number(num)) : String(Number(num).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }));
    return "€" + short;
  }

  function renderMapWithValueByCode(valueByCode) {
    const values = Object.values(valueByCode);
    const maxValue = values.length ? Math.max(...values) : 0;
    const totalProjectHits = Object.values(countByCode).reduce((a, b) => a + b, 0);
    const numCountries = Object.keys(valueByCode).length;

    if (elements.projectsMapLegend) {
      const metric = getCurrentMapMetric();
      if (metric === "rice") {
        const totalRice = Object.values(valueByCode).reduce((a, b) => a + b, 0);
        elements.projectsMapLegend.textContent = totalRice > 0
          ? `RICE score per country (sum) — total RICE ${typeof formatRice === "function" ? formatRice(totalRice) : totalRice} across ${numCountries} countr${numCountries !== 1 ? "ies" : "y"}`
          : "RICE score per country. Add countries to projects to see RICE on the map.";
      } else if (metric === "riceAvg") {
        const meanRice = getWeightedMapMetricAverage(valueByCode, countByCode);
        elements.projectsMapLegend.textContent = meanRice > 0
          ? `Average RICE score per country — mean ${typeof formatRice === "function" ? formatRice(meanRice) : meanRice} across ${numCountries} countr${numCountries !== 1 ? "ies" : "y"}`
          : "Average RICE score per country. Add countries and RICE inputs to projects to see values on the map.";
      } else if (metric === "financial") {
        const totalEur = Object.values(valueByCode).reduce((a, b) => a + b, 0);
        elements.projectsMapLegend.textContent = totalEur > 0
          ? `Total financial impact (EUR) per country — ${formatEur(totalEur)} across ${numCountries} countr${numCountries !== 1 ? "ies" : "y"} (rates refreshed daily)`
          : "Total financial impact (EUR) per country. Add countries and financial impact to projects to see values on the map.";
      } else if (metric === "financialAvg") {
        const meanEur = getWeightedMapMetricAverage(valueByCode, countByCode);
        elements.projectsMapLegend.textContent = meanEur > 0
          ? `Average financial impact (EUR) per country — ${formatEur(meanEur)} mean across ${numCountries} countr${numCountries !== 1 ? "ies" : "y"} (rates refreshed daily)`
          : "Average financial impact (EUR) per country. Add countries and financial impact to projects to see values on the map.";
      } else {
        elements.projectsMapLegend.textContent = totalProjectHits > 0
          ? `Projects per country — ${totalProjectHits} project–country link${totalProjectHits !== 1 ? "s" : ""} across ${numCountries} countr${numCountries !== 1 ? "ies" : "y"}`
          : "Projects per country. Add countries to projects to see them on the map.";
      }
    }

    if (!elements.projectsMapContainer._leafletMap) {
      const map = L.map(elements.projectsMapContainer, { center: [20, 0], zoom: 2, zoomControl: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a>"
      }).addTo(map);
      elements.projectsMapContainer._leafletMap = map;
    }
    const map = elements.projectsMapContainer._leafletMap;
    if (elements.projectsMapContainer._geoLayer) {
      map.removeLayer(elements.projectsMapContainer._geoLayer);
      elements.projectsMapContainer._geoLayer = null;
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

    function onEachFeature(feature, layer) {
      const code = getCountryCodeFromFeature(feature);
      const rawName = feature.properties && (feature.properties.NAME || feature.properties.ADMIN || feature.properties.NAME_LONG || code);
      const name = (rawName && typeof getCanonicalCountryName === "function") ? getCanonicalCountryName(rawName) : rawName;
      const displayName = name || code;
      const count = code ? (countByCode[code] || 0) : 0;
      const value = code ? (valueByCode[code] || 0) : 0;
      const flag = (code && typeof countryCodeToFlag === "function") ? countryCodeToFlag(code) : "";
      const flagPrefix = flag ? `${flag} ` : "";
      const codeLabel = code ? ` (${typeof countryCodeToTwoLetter === "function" ? (countryCodeToTwoLetter(code) || code) : code})` : "";
      const label = `${flagPrefix}${displayName}${codeLabel}`;
      let text;
      const metric = getCurrentMapMetric();
      if (metric === "rice") {
        text = count > 0
          ? `${label}: RICE ${typeof formatRice === "function" ? formatRice(value) : value} (${count} project${count !== 1 ? "s" : ""})`
          : `${label}: 0 projects`;
      } else if (metric === "riceAvg") {
        text = count > 0
          ? `${label}: avg RICE ${typeof formatRice === "function" ? formatRice(value) : value} (${count} project${count !== 1 ? "s" : ""})`
          : `${label}: 0 projects`;
      } else if (metric === "financial") {
        text = value > 0
          ? `${label}: ${formatEur(value)} (${count} project${count !== 1 ? "s" : ""})`
          : `${label}: —`;
      } else if (metric === "financialAvg") {
        text = value > 0
          ? `${label}: avg ${formatEur(value)} (${count} project${count !== 1 ? "s" : ""})`
          : `${label}: —`;
      } else {
        text = `${label}: ${count} project${count !== 1 ? "s" : ""}`;
      }
      layer.bindTooltip(text, { permanent: false, direction: "top" });
    }

    fetch(PROJECTS_MAP_GEOJSON_URL)
      .then((res) => {
        if (!res.ok) throw new Error("Map data unavailable");
        return res.json();
      })
      .then((geojson) => {
        if (!geojson || !geojson.features || !Array.isArray(geojson.features)) throw new Error("Invalid map data");
        const layer = L.geoJSON(geojson, { style, onEachFeature });
        layer.addTo(map);
        elements.projectsMapContainer._geoLayer = layer;
        map.invalidateSize();
        invalidateMapSizeAfterFullscreenExit();
      })
      .catch(() => {
        if (elements.projectsMapContainer._leafletMap) {
          elements.projectsMapContainer._leafletMap.remove();
          elements.projectsMapContainer._leafletMap = null;
        }
        elements.projectsMapContainer._geoLayer = null;
        elements.projectsMapContainer.innerHTML = '<div class="projects-map-empty">Could not load map data. Check your connection.</div>';
      });
  }

  const metric = getCurrentMapMetric();
  if (mapMetricUsesExchangeRates(metric)) {
    if (elements.projectsMapLegend) elements.projectsMapLegend.textContent = "Loading exchange rates…";
    ExchangeRates.ensure()
      .then(() => {
        renderMapWithValueByCode(getMapMetricValuesByCode(metric));
      })
      .catch(() => {
        if (elements.projectsMapLegend) {
          elements.projectsMapLegend.textContent = "Exchange rates unavailable; showing amounts in EUR only where applicable.";
        }
        renderMapWithValueByCode(getMapMetricValuesByCode(metric));
      });
    return;
  }

  renderMapWithValueByCode(getMapMetricValuesByCode(metric));
  if (state.projectsView === "map") {
    requestAnimationFrame(() => invalidateMapSizeAfterFullscreenExit());
  }
}

function getProjectFinancialImpactEurShort(project) {
  if (!project || project.financialImpactValue == null || project.financialImpactValue === "") return null;
  const raw = project.financialImpactValue;
  const amount = Number.isFinite(raw) ? raw : Number(raw);
  if (!Number.isFinite(amount)) return null;
  const currency = (project.financialImpactCurrency || "EUR").toString().trim().toUpperCase() || "EUR";
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

function buildProjectTableCardTshirtMetric(project) {
  const metric = document.createElement("div");
  metric.className = "projects-table-card__metric projects-table-card__metric--size";
  const sizeLabel = document.createElement("span");
  sizeLabel.className = "projects-table-card__metric-label";
  sizeLabel.textContent = "Size";
  metric.appendChild(sizeLabel);
  if (project.tshirtSize) {
    metric.appendChild(
      buildTshirtSizeTooltipWrap(project.tshirtSize, "projects-table-card__metric-value")
    );
  } else {
    const sizeVal = document.createElement("span");
    sizeVal.className = "projects-table-card__metric-value";
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

function buildProjectTableCardRiceMetric(project) {
  const riceScore = project.riceScore != null ? project.riceScore : calculateRiceScore(project);
  const reachVal = project.reachValue != null && project.reachValue !== "" ? project.reachValue : "—";
  const impactVal = project.impactValue != null && project.impactValue !== "" ? project.impactValue : "—";
  const confidenceVal =
    project.confidenceValue != null && project.confidenceValue !== "" ? project.confidenceValue : "—";
  const effortVal = project.effortValue != null && project.effortValue !== "" ? project.effortValue : "—";
  const reachNum = Number(project.reachValue);
  const impactNum = Number(project.impactValue);
  const confidenceNum = Number(project.confidenceValue);
  const effortNum = Number(project.effortValue);
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
  metric.className = "projects-table-card__metric projects-table-card__metric--rice";

  const riceLabel = document.createElement("span");
  riceLabel.className = "projects-table-card__metric-label";
  riceLabel.textContent = "RICE";
  metric.appendChild(riceLabel);

  const riceWrap = document.createElement("span");
  riceWrap.className = "cell-rice-with-tooltip projects-table-card__metric-value";
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

function buildProjectTableCardFinancialMetric(project) {
  const financialShort = getProjectFinancialImpactEurShort(project) || "—";
  const metric = document.createElement("div");
  metric.className = "projects-table-card__metric projects-table-card__metric--financial";

  const finLabel = document.createElement("span");
  finLabel.className = "projects-table-card__metric-label";
  finLabel.textContent = "Impact";
  metric.appendChild(finLabel);

  if (project.financialImpactValue == null || project.financialImpactValue === "") {
    const finVal = document.createElement("span");
    finVal.className = "projects-table-card__metric-value";
    finVal.textContent = financialShort;
    metric.appendChild(finVal);
    return metric;
  }

  const raw = project.financialImpactValue;
  const amount = Number.isFinite(raw) ? raw : Number(raw);
  const currency = (project.financialImpactCurrency || "EUR").toString().trim().toUpperCase() || "EUR";
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
  finWrap.className = "cell-financial-with-tooltip projects-table-card__metric-value";
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

function buildCardTitleTooltipElement(titleClassName, project) {
  const titleText = (project && project.title ? String(project.title) : "Untitled");
  const statusText = (project && project.projectStatus ? String(project.projectStatus) : "Not set");
  const rawDescription =
    project && (project.description != null || project.projectDescription != null)
      ? String(project.description != null ? project.description : project.projectDescription)
      : "";
  const descriptionText = rawDescription.replace(/\s+/g, " ").trim() || "No description provided.";

  const wrap = document.createElement("div");
  wrap.className = `${titleClassName} card-title-with-tooltip`;
  wrap.setAttribute("aria-label", `${titleText}. Status: ${statusText}.`);
  wrap.setAttribute("tabindex", "0");

  const textSpan = document.createElement("span");
  textSpan.textContent = titleText;
  wrap.appendChild(textSpan);

  const tooltipEl = document.createElement("div");
  tooltipEl.className = "cell-type-tooltip";
  tooltipEl.setAttribute("role", "tooltip");

  const titleEl = document.createElement("div");
  titleEl.className = "cell-type-tooltip-title";
  titleEl.textContent = "Project details";
  tooltipEl.appendChild(titleEl);

  const bodyEl = document.createElement("div");
  bodyEl.className = "cell-type-tooltip-body";
  const statusLine = document.createElement("p");
  statusLine.textContent = `Status: ${statusText}`;
  const descriptionLine = document.createElement("p");
  descriptionLine.textContent = `Description: ${descriptionText}`;
  bodyEl.appendChild(statusLine);
  bodyEl.appendChild(descriptionLine);
  tooltipEl.appendChild(bodyEl);

  wrap.appendChild(tooltipEl);
  return wrap;
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
      const next = elements.tableGroupBySelect.value;
      state.tableGroupBy = validIds.includes(next) ? next : "none";
      saveState();
      if (state.projectsView === "table") renderProjects();
    });
  }
  elements.tableGroupBySelect.value = state.tableGroupBy;
}

function getTableGroupByUnsetKey() {
  return "__unset__";
}

function getTableGroupByValue(project, groupBy) {
  if (!project || !groupBy || groupBy === "none") return getTableGroupByUnsetKey();
  switch (groupBy) {
    case "projectStatus":
      return (project.projectStatus || "").toString().trim() || getTableGroupByUnsetKey();
    case "moscowCategory":
      return (project.moscowCategory || "").toString().trim() || getTableGroupByUnsetKey();
    case "tshirtSize":
      return (project.tshirtSize || "").toString().trim() || getTableGroupByUnsetKey();
    case "projectType":
      return (project.projectType || "").toString().trim() || getTableGroupByUnsetKey();
    case "financialImpactFramework":
      return normalizeFinancialFramework(project.financialImpactFramework) || getTableGroupByUnsetKey();
    case "financialImpactCurrency": {
      const cur = (project.financialImpactCurrency || "").toString().trim().toUpperCase();
      return cur || getTableGroupByUnsetKey();
    }
    default:
      return getTableGroupByUnsetKey();
  }
}

function getTableGroupDisplayLabel(rawKey, groupBy) {
  if (rawKey === getTableGroupByUnsetKey()) return "Not set";
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

  if (groupBy === "projectStatus" && typeof projectStatusList !== "undefined") {
    const order = projectStatusList.slice();
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

  return moveUnsetLast(
    list.sort((a, b) =>
      getTableGroupDisplayLabel(a, groupBy).localeCompare(getTableGroupDisplayLabel(b, groupBy), undefined, {
        sensitivity: "base"
      })
    )
  );
}

function updateTableGroupBySummary(projectCount, groupBy) {
  if (!elements.tableGroupBySummary) return;
  const count = Number(projectCount) || 0;
  if (!groupBy || groupBy === "none") {
    elements.tableGroupBySummary.textContent =
      count === 1 ? "1 project" : `${count} projects`;
    return;
  }
  const groupEls = elements.projectsTableCardsList
    ? elements.projectsTableCardsList.querySelectorAll(".projects-table-card-group")
    : [];
  const groupCount = groupEls.length;
  const opt = typeof TABLE_GROUP_BY_OPTIONS !== "undefined"
    ? TABLE_GROUP_BY_OPTIONS.find((o) => o.id === groupBy)
    : null;
  const label = opt ? opt.label.toLowerCase() : "category";
  elements.tableGroupBySummary.textContent =
    count === 1
      ? `1 project · ${groupCount} ${label} group`
      : `${count} projects · ${groupCount} ${label} groups`;
}

function syncProjectTableCardSelectionStyles() {
  if (!elements.projectsTableCardsList) return;
  elements.projectsTableCardsList.querySelectorAll(".projects-table-card").forEach((card) => {
    const cb = card.querySelector(".project-select-checkbox");
    card.classList.toggle("projects-table-card--selected", !!(cb && cb.checked));
  });
}

function renderProjectsTableEmptyMessage(message) {
  const text = message || "";
  if (elements.projectsTableBody) {
    elements.projectsTableBody.innerHTML = `
      <tr>
        <td colspan="12" class="empty-state">${text}</td>
      </tr>
    `;
  }
  if (elements.projectsTableCardsList) {
    elements.projectsTableCardsList.innerHTML = `<p class="projects-table-cards-empty empty-state" role="status">${text}</p>`;
  }
}

function getProjectSelectCheckboxes() {
  if (isTableCompactLayout() && elements.projectsTableCardsList) {
    return elements.projectsTableCardsList.querySelectorAll(".project-select-checkbox");
  }
  if (elements.projectsTableBody) {
    return elements.projectsTableBody.querySelectorAll(".project-select-checkbox");
  }
  return [];
}

function truncateTableCardText(text, maxLen) {
  const raw = text == null ? "" : String(text).replace(/\s+/g, " ").trim();
  if (!raw) return "";
  if (raw.length <= maxLen) return raw;
  return raw.slice(0, Math.max(0, maxLen - 1)).trimEnd() + "…";
}

function appendProjectTableCardTitleIcon(iconsWrap, options) {
  const { svg, ariaLabel, extraClass, iconKind, fallbackText, meta } = options;
  if (!ariaLabel) return;
  const wrap = document.createElement("span");
  wrap.className = `projects-table-card__title-icon cell-type-icon-wrap cell-type-pill${extraClass ? " " + extraClass : ""}`;
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

function buildProjectTableCardBadges(project, groupBy) {
  const badges = document.createElement("div");
  badges.className = "projects-table-card__badges";
  const candidates = [];

  if (project.projectStatus && groupBy !== "projectStatus") {
    const statusMeta = projectStatusIcons && projectStatusIcons[project.projectStatus];
    const statusPill = document.createElement("span");
    statusPill.className = "projects-table-card__status-pill";
    statusPill.setAttribute("aria-label", project.projectStatus);
    if (statusMeta && statusMeta.svg) {
      statusPill.innerHTML =
        statusMeta.svg +
        '<span class="projects-table-card__status-label">' +
        escapeHtml(project.projectStatus) +
        "</span>";
    } else {
      statusPill.textContent = project.projectStatus;
    }
    statusPill.setAttribute("tabindex", "0");
    appendIconMetaTooltip(statusPill, statusMeta);
    candidates.push({ priority: 1, label: project.projectStatus, el: statusPill });
  }

  if (project.moscowCategory && groupBy !== "moscowCategory") {
    const moscowSlug = moscowTablePillSlug(project.moscowCategory);
    const moscowChip = document.createElement("span");
    moscowChip.className = `projects-table-card__chip projects-table-card__chip--moscow moscow-pill moscow-pill--${moscowSlug} cell-moscow-with-tooltip`;
    moscowChip.textContent = moscowTableShortLabel(project.moscowCategory);
    moscowChip.setAttribute("tabindex", "0");
    if (typeof moscowTooltips !== "undefined" && moscowTooltips[project.moscowCategory]) {
      appendIconMetaTooltip(moscowChip, moscowTooltips[project.moscowCategory]);
    }
    candidates.push({ priority: 2, label: project.moscowCategory, el: moscowChip });
  }

  if (project.projectType && groupBy !== "projectType") {
    const typeChip = document.createElement("span");
    typeChip.className = "projects-table-card__chip projects-table-card__chip--type";
    typeChip.textContent = project.projectType;
    candidates.push({ priority: 3, label: project.projectType, el: typeChip });
  }

  if (project.financialImpactCurrency && groupBy !== "financialImpactCurrency") {
    const curChip = document.createElement("span");
    curChip.className = "projects-table-card__chip projects-table-card__chip--currency";
    curChip.textContent = String(project.financialImpactCurrency).trim().toUpperCase();
    candidates.push({ priority: 4, label: curChip.textContent, el: curChip });
  }

  if (project.projectPeriod) {
    const periodChip = document.createElement("span");
    periodChip.className = "projects-table-card__chip projects-table-card__chip--period";
    periodChip.textContent = project.projectPeriod;
    candidates.push({ priority: 5, label: project.projectPeriod, el: periodChip });
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
      "projects-table-card__chip projects-table-card__chip--more card-meta-with-tooltip"
    );
    badges.appendChild(moreChip);
  }

  return badges;
}

const COUNTRIES_TOOLTIP_SCROLL_THRESHOLD = 4;

function normalizeProjectCountriesList(countries) {
  return normalizeCountryNames(Array.isArray(countries) ? countries : []);
}

/** True when the project targets every EU member state (e.g. after choosing EU in the form). */
function projectCountriesRepresentEuRegion(countries) {
  const list = normalizeProjectCountriesList(countries);
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
  const list = normalizeProjectCountriesList(countries);
  if (projectCountriesRepresentEuRegion(list)) {
    return `European Union (${list.length} countries)`;
  }
  return list.length > 1 ? `Target countries (${list.length})` : "Target country";
}

function buildCountriesListTooltip(countries) {
  const list = normalizeProjectCountriesList(countries);
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

function buildProjectTableCardCountriesRow(countries) {
  const normalizedCountries = normalizeProjectCountriesList(countries);
  const isEuRegion = projectCountriesRepresentEuRegion(normalizedCountries);
  const row = document.createElement("div");
  row.className = "projects-table-card__countries-row cell-countries-with-tooltip";
  row.setAttribute(
    "aria-label",
    isEuRegion ? "European Union; tap for member countries" : "Target countries; tap for full list"
  );
  row.setAttribute("tabindex", "0");
  row.dataset.countryCount = String(normalizedCountries.length);

  if (isEuRegion) {
    const chip = document.createElement("span");
    chip.className = "projects-table-card__country-chip projects-table-card__country-chip--eu";
    const flagEl = document.createElement("span");
    flagEl.className = "projects-table-card__country-flag";
    flagEl.setAttribute("aria-hidden", "true");
    flagEl.textContent = getEuRegionFlagEmoji();
    chip.appendChild(flagEl);
    const labelEl = document.createElement("span");
    labelEl.className = "projects-table-card__country-code";
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
      chip.className = "projects-table-card__country-chip";
      chip.title = code ? `${name} (${code})` : String(name);
      if (flag) {
        const flagEl = document.createElement("span");
        flagEl.className = "projects-table-card__country-flag";
        flagEl.setAttribute("aria-hidden", "true");
        flagEl.textContent = flag;
        chip.appendChild(flagEl);
      }
      const labelEl = document.createElement("span");
      labelEl.className = "projects-table-card__country-code";
      labelEl.textContent = code || String(name);
      chip.appendChild(labelEl);
      row.appendChild(chip);
    });
    if (moreCount > 0) {
      const moreChip = document.createElement("span");
      moreChip.className = "projects-table-card__country-chip projects-table-card__country-chip--more";
      moreChip.textContent = "+" + moreCount;
      moreChip.title = normalizedCountries.slice(maxToShow).join(", ");
      row.appendChild(moreChip);
    }
  }

  row.appendChild(buildCountriesListTooltip(normalizedCountries));

  return row;
}

function buildProjectTableCard(project, demoReadOnly, options = {}) {
  const groupBy = options.groupBy || "none";
  const card = document.createElement("article");
  card.className = "projects-table-card";
  card.setAttribute("role", "listitem");
  card.dataset.projectId = project.id;
  const statusLabel = (project.projectStatus || "Not Started").toString().trim();
  card.setAttribute("data-status", statusLabel);

  const head = document.createElement("div");
  head.className = "projects-table-card__head";

  const selectWrap = document.createElement("div");
  selectWrap.className = "projects-table-card__select";
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.className = "checkbox-input project-select-checkbox";
  cb.setAttribute("data-id", project.id);
  if (demoReadOnly) {
    cb.disabled = true;
    cb.title = DEMO_READ_ONLY_ACTION_TITLE;
  }
  selectWrap.appendChild(cb);
  head.appendChild(selectWrap);

  head.appendChild(buildProjectTableCardBadges(project, groupBy));
  card.appendChild(head);

  const body = document.createElement("div");
  body.className = "projects-table-card__body";

  const titleRow = document.createElement("div");
  titleRow.className = "projects-table-card__title-row";
  titleRow.appendChild(buildCardTitleTooltipElement("projects-table-card__title", project));

  const frameworkKey = normalizeFinancialFramework(project.financialImpactFramework);
  const frameworkMeta = FINANCIAL_FRAMEWORK_ICONS[frameworkKey];
  const showTypeIcon = project.projectType && groupBy !== "projectType";
  const showFrameworkIcon = groupBy !== "financialImpactFramework" && frameworkMeta && frameworkMeta.svg;
  if (showTypeIcon || showFrameworkIcon) {
    const iconsWrap = document.createElement("div");
    iconsWrap.className = "projects-table-card__icons";
    if (showTypeIcon) {
      const typeMeta = projectTypeIcons && projectTypeIcons[project.projectType];
      appendProjectTableCardTitleIcon(iconsWrap, {
        svg: typeMeta && typeMeta.svg ? typeMeta.svg : null,
        fallbackText: project.projectType,
        ariaLabel: project.projectType,
        extraClass: "projects-table-card__type-icon",
        iconKind: "type",
        meta: typeMeta
      });
    }
    if (showFrameworkIcon) {
      appendProjectTableCardTitleIcon(iconsWrap, {
        svg: frameworkMeta.svg,
        ariaLabel: frameworkMeta.label || frameworkKey,
        extraClass: "projects-table-card__framework-icon cell-framework-icon-wrap",
        iconKind: "framework",
        meta: frameworkMeta
      });
    }
    titleRow.appendChild(iconsWrap);
  }
  body.appendChild(titleRow);

  const description = project.description ? String(project.description).trim() : "";
  if (description) {
    const descEl = document.createElement("p");
    descEl.className = "projects-table-card__desc";
    descEl.textContent = truncateTableCardText(description, 140);
    body.appendChild(descEl);
  }

  const metrics = document.createElement("div");
  metrics.className = "projects-table-card__metrics";

  metrics.appendChild(buildProjectTableCardRiceMetric(project));
  metrics.appendChild(buildProjectTableCardFinancialMetric(project));
  metrics.appendChild(buildProjectTableCardTshirtMetric(project));

  body.appendChild(metrics);

  const countries = Array.isArray(project.countries) ? project.countries : [];
  if (countries.length) {
    const metaRow = document.createElement("div");
    metaRow.className = "projects-table-card__meta-row";
    metaRow.appendChild(buildProjectTableCardCountriesRow(countries));
    body.appendChild(metaRow);
  }

  card.appendChild(body);

  const actions = document.createElement("div");
  actions.className = "projects-table-card__actions";

  const viewBtn = document.createElement("button");
  viewBtn.type = "button";
  viewBtn.setAttribute("data-id", project.id);
  setProjectTableActionButton(viewBtn, "view", "View");

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.setAttribute("data-id", project.id);
  setProjectTableActionButton(editBtn, "edit", "Edit", { disabled: demoReadOnly });

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.setAttribute("data-id", project.id);
  setProjectTableActionButton(deleteBtn, "delete", "Delete", { disabled: demoReadOnly });

  actions.appendChild(viewBtn);
  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);
  card.appendChild(actions);

  return card;
}

function renderProjectsTableCards(projects, demoReadOnly) {
  if (!elements.projectsTableCardsList) return;
  elements.projectsTableCardsList.innerHTML = "";
  const groupBy = state.tableGroupBy || "none";
  const fragment = document.createDocumentFragment();

  if (groupBy === "none") {
    projects.forEach((project) => {
      fragment.appendChild(buildProjectTableCard(project, demoReadOnly, { groupBy: "none" }));
    });
  } else {
    const buckets = new Map();
    projects.forEach((project) => {
      const key = getTableGroupByValue(project, groupBy);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(project);
    });
    const keys = sortTableGroupKeys(Array.from(buckets.keys()), groupBy);
    keys.forEach((key) => {
      const section = document.createElement("section");
      section.className = "projects-table-card-group";
      section.dataset.groupBy = groupBy;
      section.dataset.groupKey = key;

      const header = document.createElement("header");
      header.className = "projects-table-card-group__header";

      const title = document.createElement("h4");
      title.className = "projects-table-card-group__title";
      title.textContent = getTableGroupDisplayLabel(key, groupBy);

      const count = document.createElement("span");
      count.className = "projects-table-card-group__count";
      const groupProjects = buckets.get(key) || [];
      count.textContent = String(groupProjects.length);
      count.setAttribute(
        "aria-label",
        groupProjects.length === 1 ? "1 project" : `${groupProjects.length} projects`
      );

      header.appendChild(title);
      header.appendChild(count);
      section.appendChild(header);

      const list = document.createElement("div");
      list.className = "projects-table-card-group__list";
      list.setAttribute("role", "group");
      list.setAttribute("aria-label", getTableGroupDisplayLabel(key, groupBy));
      groupProjects.forEach((project) => {
        list.appendChild(buildProjectTableCard(project, demoReadOnly, { groupBy }));
      });
      section.appendChild(list);
      fragment.appendChild(section);
    });
  }

  elements.projectsTableCardsList.appendChild(fragment);
  if (elements.tableGroupBySelect && elements.tableGroupBySelect.value !== groupBy) {
    elements.tableGroupBySelect.value = groupBy;
  }
  updateTableGroupBySummary(projects.length, groupBy);
  syncProjectTableCardSelectionStyles();
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

  if (!activeProfile) {
    elements.scrumBoardContainer.innerHTML = '<div class="scrum-board-empty">Select a profile to see the Scrum board.</div>';
    return;
  }

  if (!unlockedProfile) {
    elements.scrumBoardContainer.innerHTML =
      '<div class="scrum-board-empty">Unlock this profile to use the board view.</div>';
    return;
  }

  const baseProjects = unlockedProfile.projects.slice();
  baseProjects.forEach((p) => {
    p.riceScore = calculateRiceScore(p);
  });
  initFilterProjectPeriodOptions(baseProjects);
  const projects = applyFilters(baseProjects);

  const byStatus = {};
  projectStatusList.forEach((status) => {
    byStatus[status] = [];
  });
  projects.forEach((p) => {
    const status = (p.projectStatus || "Not Started").toString().trim();
    if (!byStatus[status]) byStatus[status] = [];
    byStatus[status].push(p);
  });

  if (!state.scrumBoardSortByRice && activeProfile) {
    activeProfile.boardOrder = activeProfile.boardOrder || {};
    projectStatusList.forEach((status) => {
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

  projectStatusList.forEach((status) => {
    const list = byStatus[status] || [];
    if (state.scrumBoardSortByRice) {
      list.sort((a, b) => {
        const scoreA = a.riceScore != null ? a.riceScore : calculateRiceScore(a);
        const scoreB = b.riceScore != null ? b.riceScore : calculateRiceScore(b);
        return scoreB - scoreA;
      });
    }
  });

  projectStatusList.forEach((status) => {
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
    (listForStatus).forEach((project, index) => {
      const card = document.createElement("div");
      card.className = "scrum-board-card";
      card.setAttribute("draggable", demoReadOnly ? "false" : "true");
      card.setAttribute("data-project-id", project.id);
      card.setAttribute(
        "aria-label",
        demoReadOnly
          ? "Project: " + (project.title || "Untitled") + ". View only."
          : "Project: " + (project.title || "Untitled") + ". Drag to change status. View, Edit, Delete."
      );

      const titleRow = document.createElement("div");
      titleRow.className = "scrum-board-card-title-row";
      const titleEl = buildCardTitleTooltipElement("scrum-board-card-title", project);
      titleRow.appendChild(titleEl);
      if (project.projectType) {
        const typeMeta = projectTypeIcons && projectTypeIcons[project.projectType];
        const typeWrap = document.createElement("span");
        typeWrap.className = "scrum-board-card-type-wrap cell-type-icon-wrap cell-type-pill";
        typeWrap.dataset.iconKind = "type";
        typeWrap.setAttribute("role", "img");
        typeWrap.setAttribute("aria-label", project.projectType);
        if (typeMeta && typeMeta.svg) {
          typeWrap.innerHTML = typeMeta.svg;
          if (typeMeta.tooltipTitle != null || typeMeta.tooltipBody != null) {
            const tooltipEl = document.createElement("div");
            tooltipEl.className = "cell-type-tooltip";
            tooltipEl.setAttribute("role", "tooltip");
            if (typeMeta.tooltipTitle != null) {
              const titleEl = document.createElement("div");
              titleEl.className = "cell-type-tooltip-title";
              titleEl.textContent = typeMeta.tooltipTitle;
              tooltipEl.appendChild(titleEl);
            }
            if (typeMeta.tooltipBody != null) {
              const bodyEl = document.createElement("div");
              bodyEl.className = "cell-type-tooltip-body";
              const paragraphs = String(typeMeta.tooltipBody).split(/\n\n+/);
              paragraphs.forEach((text) => {
                const p = document.createElement("p");
                p.textContent = text.replace(/\n/g, " ").trim();
                bodyEl.appendChild(p);
              });
              tooltipEl.appendChild(bodyEl);
            }
            typeWrap.appendChild(tooltipEl);
          }
        } else {
          typeWrap.textContent = project.projectType;
        }
        titleRow.appendChild(typeWrap);
      }

      const meta = document.createElement("div");
      meta.className = "scrum-board-card-meta";
      const metaLeft = document.createElement("span");
      metaLeft.className = "scrum-board-card-meta-left";
      const riceValue = project.riceScore != null ? project.riceScore : calculateRiceScore(project);
      const riceLabel = "RICE " + formatRice(riceValue);
      const reachVal = project.reachValue != null ? String(project.reachValue) : "—";
      const impactVal = project.impactValue != null ? String(project.impactValue) : "—";
      const confidenceVal = project.confidenceValue != null ? String(project.confidenceValue) : "—";
      const effortVal = project.effortValue != null ? String(project.effortValue) : "—";
      const confidenceNum = Number(project.confidenceValue);
      const confidenceDecimal = Number.isFinite(confidenceNum) ? confidenceNum / 100 : null;
      const formulaLine = Number.isFinite(Number(project.reachValue)) && Number.isFinite(Number(project.impactValue)) && Number.isFinite(confidenceDecimal) && Number.isFinite(Number(project.effortValue)) && Number(project.effortValue) > 0
        ? `[${Number(project.reachValue)} × ${Number(project.impactValue)} × ${confidenceDecimal.toFixed(2)}] ÷ ${Number(project.effortValue)} = ${formatRice(riceValue)}`
        : "Not enough inputs to compute full formula.";
      const rice = buildCardMetaTooltipWrap(
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
        "scrum-board-card-rice card-meta-with-tooltip"
      );
      metaLeft.appendChild(rice);
      if (project.tshirtSize) {
        const sizeTooltip = typeof tshirtSizeTooltips !== "undefined" ? tshirtSizeTooltips[project.tshirtSize] : null;
        const sizeSpan = buildCardMetaTooltipWrap(
          project.tshirtSize,
          `Project size ${project.tshirtSize}`,
          (sizeTooltip && sizeTooltip.tooltipTitle) || "Project size",
          [((sizeTooltip && sizeTooltip.tooltipBody) || project.tshirtSize)],
          "scrum-board-card-size card-meta-with-tooltip"
        );
        metaLeft.appendChild(sizeSpan);
      }
      const financialShort = getProjectFinancialImpactEurShort(project);
      if (financialShort) {
        const raw = project.financialImpactValue;
        const amount = Number.isFinite(raw) ? raw : Number(raw);
        const currency = (project.financialImpactCurrency || "EUR").toString().trim().toUpperCase() || "EUR";
        const shortOriginal = Number.isFinite(amount) && typeof formatFinancialShort === "function"
          ? formatFinancialShort(amount)
          : (Number.isFinite(amount) ? String(Number(amount).toLocaleString(undefined, { maximumFractionDigits: 2 })) : "—");
        const financialSpan = buildCardMetaTooltipWrap(
          financialShort,
          `Financial impact EUR ${financialShort}`,
          "Financial impact",
          [
            `EUR converted: ${financialShort}`,
            `Original: ${shortOriginal} ${currency}`
          ],
          "scrum-board-card-financial card-meta-with-tooltip"
        );
        metaLeft.appendChild(financialSpan);
      }
      meta.appendChild(metaLeft);
      const iconGroup = document.createElement("span");
      iconGroup.className = "scrum-board-card-icons";
      const frameworkKey = normalizeFinancialFramework(project.financialImpactFramework);
      const frameworkMeta = FINANCIAL_FRAMEWORK_ICONS[frameworkKey];
      if (frameworkMeta && frameworkMeta.svg) {
        const frameworkWrap = document.createElement("span");
        frameworkWrap.className = "scrum-board-card-type-wrap cell-type-icon-wrap cell-type-pill";
        frameworkWrap.dataset.iconKind = "framework";
        frameworkWrap.setAttribute("role", "img");
        frameworkWrap.setAttribute("aria-label", frameworkMeta.label || frameworkKey);
        frameworkWrap.innerHTML = frameworkMeta.svg;
        if (frameworkMeta.tooltipTitle != null || frameworkMeta.tooltipBody != null) {
          const tooltipEl = document.createElement("div");
          tooltipEl.className = "cell-type-tooltip";
          tooltipEl.setAttribute("role", "tooltip");
          if (frameworkMeta.tooltipTitle != null) {
            const titleEl = document.createElement("div");
            titleEl.className = "cell-type-tooltip-title";
            titleEl.textContent = frameworkMeta.tooltipTitle;
            tooltipEl.appendChild(titleEl);
          }
          if (frameworkMeta.tooltipBody != null) {
            const bodyEl = document.createElement("div");
            bodyEl.className = "cell-type-tooltip-body";
            const p = document.createElement("p");
            p.textContent = frameworkMeta.tooltipBody;
            bodyEl.appendChild(p);
            tooltipEl.appendChild(bodyEl);
          }
          frameworkWrap.appendChild(tooltipEl);
        }
        iconGroup.appendChild(frameworkWrap);
      }
      if (iconGroup.childElementCount > 0) {
        meta.appendChild(iconGroup);
      }
      appendPortfolioCardBody(card, titleRow, meta);

      const cardStatus = (project.projectStatus || "Not Started").toString().trim();
      const moveEl = isCompactPortfolioLayout()
        ? buildBoardCardMoveSelect(project, cardStatus, { disabled: demoReadOnly })
        : null;

      const actions = document.createElement("div");
      actions.className = "scrum-board-card-actions";
      const isFirst = index === 0;
      const isLast = index === listForStatus.length - 1;
      const orderDisabled = demoReadOnly || state.scrumBoardSortByRice;
      const upBtn = document.createElement("button");
      upBtn.type = "button";
      upBtn.className = "scrum-board-card-btn scrum-board-card-btn--order";
      upBtn.setAttribute("data-project-id", project.id);
      upBtn.setAttribute("data-status", status);
      upBtn.setAttribute("aria-label", "Move project up in column");
      upBtn.title = "Move up";
      upBtn.innerHTML = "↑";
      upBtn.disabled = orderDisabled || isFirst;
      const downBtn = document.createElement("button");
      downBtn.type = "button";
      downBtn.className = "scrum-board-card-btn scrum-board-card-btn--order";
      downBtn.setAttribute("data-project-id", project.id);
      downBtn.setAttribute("data-status", status);
      downBtn.setAttribute("aria-label", "Move project down in column");
      downBtn.title = "Move down";
      downBtn.innerHTML = "↓";
      downBtn.disabled = orderDisabled || isLast;
      if (!demoReadOnly) {
        upBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          moveBoardProjectUp(project.id, status);
        });
        downBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          moveBoardProjectDown(project.id, status);
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
      viewBtn.setAttribute("data-project-id", project.id);
      setPortfolioCardActionButton(viewBtn, "view", "View");
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "scrum-board-card-btn scrum-board-card-btn--edit";
      editBtn.setAttribute("data-project-id", project.id);
      setPortfolioCardActionButton(editBtn, "edit", "Edit");
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "scrum-board-card-btn scrum-board-card-btn--delete";
      deleteBtn.setAttribute("data-project-id", project.id);
      setPortfolioCardActionButton(deleteBtn, "delete", "Delete");
      if (demoReadOnly) {
        editBtn.disabled = true;
        deleteBtn.disabled = true;
        editBtn.title = DEMO_READ_ONLY_ACTION_TITLE;
        deleteBtn.title = DEMO_READ_ONLY_ACTION_TITLE;
      }
      viewBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openProjectModal("view", project.id);
      });
      if (!demoReadOnly) {
        editBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          openProjectModal("edit", project.id);
        });
        deleteBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          handleSingleDelete(project.id);
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
  if (!elements.scrumBoardContainer) return;
  const cards = elements.scrumBoardContainer.querySelectorAll(".scrum-board-card");
  const columns = elements.scrumBoardContainer.querySelectorAll(".scrum-board-column");

  let draggedCard = null;
  let draggedProjectId = null;
  let dropColumn = null;
  let dropIndex = 0;
  let dragGhost = null;

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
      draggedProjectId = card.getAttribute("data-project-id");
      const { ghost, offsetX, offsetY } = createDragGhost(card, e.clientX, e.clientY);
      dragGhost = ghost;
      card.classList.add("scrum-board-card--dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", draggedProjectId);
      e.dataTransfer.setData("application/x-project-id", draggedProjectId);
      e.dataTransfer.setDragImage(ghost, offsetX, offsetY);
    });

    card.addEventListener("dragend", () => {
      if (dragGhost && dragGhost.parentNode) dragGhost.remove();
      dragGhost = null;
      if (draggedCard) draggedCard.classList.remove("scrum-board-card--dragging");
      draggedCard = null;
      draggedProjectId = null;
      dropColumn = null;
      columns.forEach((col) => col.classList.remove("scrum-board-column--drag-over"));
    });
  });

  columns.forEach((column) => {
    column.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (!draggedProjectId) return;
      const status = column.getAttribute("data-status");
      const cardInColumn = column.querySelector(`[data-project-id="${draggedProjectId}"]`);
      if (!cardInColumn) column.classList.add("scrum-board-column--drag-over");
      dropColumn = column;
      const cardsContainer = column.querySelector(".scrum-board-column-cards");
      const columnCards = cardsContainer ? Array.from(cardsContainer.querySelectorAll(".scrum-board-card")) : [];
      if (columnCards.length === 0) {
        dropIndex = 0;
      } else {
        const rect = cardsContainer.getBoundingClientRect();
        const y = e.clientY - rect.top;
        dropIndex = columnCards.length;
        for (let i = 0; i < columnCards.length; i++) {
          const cardRect = columnCards[i].getBoundingClientRect();
          const cardMid = (cardRect.top + cardRect.bottom) / 2 - rect.top;
          if (y < cardMid) {
            dropIndex = i;
            break;
          }
        }
      }
    });

    column.addEventListener("dragleave", (e) => {
      if (!column.contains(e.relatedTarget)) column.classList.remove("scrum-board-column--drag-over");
    });

    column.addEventListener("drop", (e) => {
      e.preventDefault();
      column.classList.remove("scrum-board-column--drag-over");
      if (!draggedProjectId) return;
      if (!requireWritableActiveProfile("Move project")) return;
      const newStatus = column.getAttribute("data-status");
      const activeProfile = getUnlockedActiveProfile();
      if (!activeProfile) return;
      const project = activeProfile.projects.find((p) => p.id === draggedProjectId);
      if (!project) return;
      const currentStatus = (project.projectStatus || "Not Started").toString().trim();

      if (currentStatus === newStatus) {
        if (!state.scrumBoardSortByRice && dropColumn) {
          const cardsContainer = dropColumn.querySelector(".scrum-board-column-cards");
          const columnCards = cardsContainer ? Array.from(cardsContainer.querySelectorAll(".scrum-board-card")) : [];
          const orderWithoutDragged = columnCards
            .map((c) => c.getAttribute("data-project-id"))
            .filter((id) => id !== draggedProjectId);
          const idx = Math.min(dropIndex, orderWithoutDragged.length);
          const newOrder = orderWithoutDragged.slice();
          newOrder.splice(idx, 0, draggedProjectId);
          activeProfile.boardOrder = activeProfile.boardOrder || {};
          activeProfile.boardOrder[newStatus] = newOrder;
          saveState();
          renderScrumBoard();
          renderProjects();
        }
        return;
      }

      project.projectStatus = newStatus;
      project.modifiedAt = new Date().toISOString();

      if (!state.scrumBoardSortByRice && dropColumn) {
        const cardsContainer = dropColumn.querySelector(".scrum-board-column-cards");
        const columnCards = cardsContainer ? Array.from(cardsContainer.querySelectorAll(".scrum-board-card")) : [];
        const currentIds = columnCards.map((c) => c.getAttribute("data-project-id"));
        const idx = Math.min(dropIndex, currentIds.length);
        const newOrder = currentIds.slice();
        newOrder.splice(idx, 0, draggedProjectId);
        activeProfile.boardOrder = activeProfile.boardOrder || {};
        activeProfile.boardOrder[newStatus] = newOrder;
      }

      saveState();
      renderScrumBoard();
      renderProjects();
    });
  });
}

function getBoardOrderedList(profile, status) {
  const base = profile.projects.slice();
  base.forEach((p) => { p.riceScore = p.riceScore != null ? p.riceScore : calculateRiceScore(p); });
  initFilterProjectPeriodOptions(base);
  const filtered = applyFilters(base);
  const list = filtered.filter((p) => (p.projectStatus || "Not Started").toString().trim() === status);
  if (state.scrumBoardSortByRice) {
    list.sort((a, b) => {
      const scoreA = a.riceScore != null ? a.riceScore : calculateRiceScore(a);
      const scoreB = b.riceScore != null ? b.riceScore : calculateRiceScore(b);
      return scoreB - scoreA;
    });
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

function moveBoardProjectUp(projectId, status) {
  if (!requireWritableActiveProfile("Reorder project")) return;
  const activeProfile = getUnlockedActiveProfile();
  if (!activeProfile) return;
  const list = getBoardOrderedList(activeProfile, status);
  const idx = list.findIndex((p) => p.id === projectId);
  if (idx <= 0) return;
  activeProfile.boardOrder = activeProfile.boardOrder || {};
  if (!Array.isArray(activeProfile.boardOrder[status]) || activeProfile.boardOrder[status].length !== list.length) {
    activeProfile.boardOrder[status] = list.map((p) => p.id);
  }
  const orderIds = activeProfile.boardOrder[status];
  const i = orderIds.indexOf(projectId);
  if (i <= 0) return;
  [orderIds[i - 1], orderIds[i]] = [orderIds[i], orderIds[i - 1]];
  state.scrumBoardSortByRice = false;
  if (elements.scrumBoardSortByRiceToggle) elements.scrumBoardSortByRiceToggle.checked = false;
  saveState();
  renderScrumBoard();
  renderProjects();
}

function moveBoardProjectDown(projectId, status) {
  if (!requireWritableActiveProfile("Reorder project")) return;
  const activeProfile = getUnlockedActiveProfile();
  if (!activeProfile) return;
  const list = getBoardOrderedList(activeProfile, status);
  const idx = list.findIndex((p) => p.id === projectId);
  if (idx < 0 || idx >= list.length - 1) return;
  activeProfile.boardOrder = activeProfile.boardOrder || {};
  if (!Array.isArray(activeProfile.boardOrder[status]) || activeProfile.boardOrder[status].length !== list.length) {
    activeProfile.boardOrder[status] = list.map((p) => p.id);
  }
  const orderIds = activeProfile.boardOrder[status];
  const i = orderIds.indexOf(projectId);
  if (i < 0 || i >= orderIds.length - 1) return;
  [orderIds[i], orderIds[i + 1]] = [orderIds[i + 1], orderIds[i]];
  state.scrumBoardSortByRice = false;
  if (elements.scrumBoardSortByRiceToggle) elements.scrumBoardSortByRiceToggle.checked = false;
  saveState();
  renderScrumBoard();
  renderProjects();
}

function getMoscowOrderedList(profile, quadrant) {
  const base = profile.projects.slice();
  base.forEach((p) => { p.riceScore = p.riceScore != null ? p.riceScore : calculateRiceScore(p); });
  initFilterProjectPeriodOptions(base);
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

function setProjectMoscowCategory(projectId, newMoscow) {
  if (!requireWritableActiveProfile("Move project")) return false;
  const activeProfile = getUnlockedActiveProfile();
  if (!activeProfile || !newMoscow) return false;
  const project = activeProfile.projects.find((p) => p.id === projectId);
  if (!project || project.moscowCategory === newMoscow) return false;
  project.moscowCategory = newMoscow;
  project.modifiedAt = new Date().toISOString();
  saveState();
  renderMoscowBoard();
  renderProjects();
  return true;
}

function setProjectBoardStatus(projectId, newStatus) {
  if (!requireWritableActiveProfile("Move project")) return false;
  const activeProfile = getUnlockedActiveProfile();
  if (!activeProfile || !newStatus) return false;
  if (typeof projectStatusList === "undefined" || !projectStatusList.includes(newStatus)) return false;
  const project = activeProfile.projects.find((p) => p.id === projectId);
  if (!project) return false;
  const currentStatus = (project.projectStatus || "Not Started").toString().trim();
  if (currentStatus === newStatus) return false;

  project.projectStatus = newStatus;
  project.modifiedAt = new Date().toISOString();

  if (!state.scrumBoardSortByRice) {
    activeProfile.boardOrder = activeProfile.boardOrder || {};
    if (Array.isArray(activeProfile.boardOrder[currentStatus])) {
      activeProfile.boardOrder[currentStatus] = activeProfile.boardOrder[currentStatus].filter((id) => id !== projectId);
    }
    const nextOrder = Array.isArray(activeProfile.boardOrder[newStatus])
      ? activeProfile.boardOrder[newStatus].filter((id) => id !== projectId)
      : [];
    nextOrder.push(projectId);
    activeProfile.boardOrder[newStatus] = nextOrder;
  }

  saveState();
  renderScrumBoard();
  renderProjects();
  return true;
}

function isCompactPortfolioLayout() {
  return document.documentElement.classList.contains("is-compact-layout");
}

function appendPortfolioCardBody(card, titleRow, metaEl) {
  if (!isCompactPortfolioLayout()) {
    card.appendChild(titleRow);
    card.appendChild(metaEl);
    return;
  }
  const body = document.createElement("div");
  body.className = "portfolio-card-body";
  body.appendChild(titleRow);
  body.appendChild(metaEl);
  card.appendChild(body);
}

function appendPortfolioCardFooter(card, moveEl, actionsEl) {
  if (!isCompactPortfolioLayout()) {
    if (moveEl) card.appendChild(moveEl);
    card.appendChild(actionsEl);
    return;
  }
  const footer = document.createElement("div");
  footer.className = "portfolio-card-footer";
  if (moveEl) footer.appendChild(moveEl);
  footer.appendChild(actionsEl);
  card.appendChild(footer);
}

function buildPortfolioCardMoveSelect(project, currentValue, config) {
  const wrap = document.createElement("div");
  wrap.className = "portfolio-card-move";
  const label = document.createElement("label");
  label.className = "portfolio-card-move-label";
  label.textContent = config.label || "Move to";
  label.setAttribute("for", config.idPrefix + "-" + project.id);
  const select = document.createElement("select");
  select.id = config.idPrefix + "-" + project.id;
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
        config.onSelect(project.id, next);
      }
    });
  }
  wrap.appendChild(label);
  wrap.appendChild(select);
  return wrap;
}

function buildMoscowCardMoveSelect(project, currentMoscow, { disabled = false } = {}) {
  return buildPortfolioCardMoveSelect(project, currentMoscow, {
    idPrefix: "moscowMove",
    label: "MoSCoW category",
    ariaLabel: "Move project to another MoSCoW category",
    values: moscowList,
    onSelect: (projectId, value) => setProjectMoscowCategory(projectId, value),
    disabled,
  });
}

function buildBoardCardMoveSelect(project, currentStatus, { disabled = false } = {}) {
  const statuses = typeof projectStatusList !== "undefined" ? projectStatusList.slice() : [];
  return buildPortfolioCardMoveSelect(project, currentStatus, {
    idPrefix: "boardMove",
    label: "Status",
    ariaLabel: "Move project to another board column",
    values: statuses,
    onSelect: (projectId, value) => setProjectBoardStatus(projectId, value),
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

const PROJECT_TABLE_ACTION_MAP = {
  view: "viewProject",
  edit: "editProject",
  delete: "deleteProject",
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

function setProjectTableActionButton(btn, kind, label, { disabled = false, title = "" } = {}) {
  const action = PROJECT_TABLE_ACTION_MAP[kind] || kind;
  btn.className = `project-action-btn project-action-btn--${kind} project-action-btn--icon-only`;
  btn.dataset.action = action;
  btn.setAttribute("aria-label", label);
  btn.title = disabled ? title || DEMO_READ_ONLY_ACTION_TITLE : title || label;
  btn.disabled = disabled;
  const icon = PORTFOLIO_CARD_ACTION_ICONS[kind] || "";
  btn.innerHTML =
    '<span class="project-action-btn__icon">' +
    icon +
    '</span><span class="project-action-btn__label">' +
    label +
    "</span>";
}

function setPortfolioCardActionButton(btn, kind, label) {
  btn.classList.add("project-action-btn", `project-action-btn--${kind}`, "portfolio-card-action-btn");
  btn.setAttribute("aria-label", label);
  btn.title = label;
  const icon = PORTFOLIO_CARD_ACTION_ICONS[kind] || "";
  btn.innerHTML =
    '<span class="portfolio-card-action-icon project-action-btn__icon">' +
    icon +
    '</span><span class="portfolio-card-action-text project-action-btn__label">' +
    label +
    "</span>";
}

function syncMoscowCompactNav() {
  const nav = elements.moscowCompactNav;
  if (!nav || !elements.moscowBoardContainer) return;

  const isCompact = document.documentElement.classList.contains("is-compact-layout");
  const showNav = isCompact && state.projectsView === "moscow";
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

  const shortLabels = {
    "Must have": "Must",
    "Should have": "Should",
    "Could have": "Could",
    "Won't have": "Won't"
  };
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

    const main = document.createElement("span");
    main.className = "moscow-compact-nav__pill-main";

    const abbr = document.createElement("span");
    abbr.className = "moscow-compact-nav__abbr";
    abbr.textContent = abbrLabels[moscow] || moscow.charAt(0).toUpperCase();

    const label = document.createElement("span");
    label.className = "moscow-compact-nav__label";
    label.textContent = shortLabels[moscow] || moscow;

    const countBadge = document.createElement("span");
    countBadge.className = "moscow-compact-nav__count";
    countBadge.textContent = count;
    countBadge.setAttribute("aria-label", count + " projects");

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
    ? "Tap a quadrant, then swipe the board below for projects"
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

function moveMoscowProjectUp(projectId, quadrant) {
  if (!requireWritableActiveProfile("Reorder project")) return;
  const activeProfile = getUnlockedActiveProfile();
  if (!activeProfile) return;
  const list = getMoscowOrderedList(activeProfile, quadrant);
  const idx = list.findIndex((p) => p.id === projectId);
  if (idx <= 0) return;
  activeProfile.moscowOrder = activeProfile.moscowOrder || {};
  if (!Array.isArray(activeProfile.moscowOrder[quadrant]) || activeProfile.moscowOrder[quadrant].length !== list.length) {
    activeProfile.moscowOrder[quadrant] = list.map((p) => p.id);
  }
  const orderIds = activeProfile.moscowOrder[quadrant];
  const i = orderIds.indexOf(projectId);
  if (i <= 0) return;
  [orderIds[i - 1], orderIds[i]] = [orderIds[i], orderIds[i - 1]];
  state.moscowSortByRice = false;
  if (elements.moscowSortByRiceToggle) elements.moscowSortByRiceToggle.checked = false;
  saveState();
  renderMoscowBoard();
  renderProjects();
}

function moveMoscowProjectDown(projectId, quadrant) {
  if (!requireWritableActiveProfile("Reorder project")) return;
  const activeProfile = getUnlockedActiveProfile();
  if (!activeProfile) return;
  const list = getMoscowOrderedList(activeProfile, quadrant);
  const idx = list.findIndex((p) => p.id === projectId);
  if (idx < 0 || idx >= list.length - 1) return;
  activeProfile.moscowOrder = activeProfile.moscowOrder || {};
  if (!Array.isArray(activeProfile.moscowOrder[quadrant]) || activeProfile.moscowOrder[quadrant].length !== list.length) {
    activeProfile.moscowOrder[quadrant] = list.map((p) => p.id);
  }
  const orderIds = activeProfile.moscowOrder[quadrant];
  const i = orderIds.indexOf(projectId);
  if (i < 0 || i >= orderIds.length - 1) return;
  [orderIds[i], orderIds[i + 1]] = [orderIds[i + 1], orderIds[i]];
  state.moscowSortByRice = false;
  if (elements.moscowSortByRiceToggle) elements.moscowSortByRiceToggle.checked = false;
  saveState();
  renderMoscowBoard();
  renderProjects();
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

  const baseProjects = unlockedProfile.projects.slice();
  baseProjects.forEach((p) => {
    p.riceScore = calculateRiceScore(p);
  });
  initFilterProjectPeriodOptions(baseProjects);
  const projects = applyFilters(baseProjects);

  const byMoscow = {};
  moscowList.forEach((m) => {
    byMoscow[m] = [];
  });
  projects.forEach((p) => {
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
    const labelBox = document.createElement("div");
    labelBox.className = "moscow-quadrant-label";
    const shortLabels = { "Must have": "MUST", "Should have": "SHOULD", "Could have": "COULD", "Won't have": "WON'T" };
    const shortSpan = document.createElement("span");
    shortSpan.className = "moscow-quadrant-short";
    shortSpan.textContent = shortLabels[moscow] || moscow.toUpperCase().replace("'", "'");
    labelBox.appendChild(shortSpan);
    headerTop.appendChild(labelBox);
    const count = document.createElement("span");
    count.className = "moscow-board-column-count";
    count.textContent = String((byMoscow[moscow] || []).length);
    headerTop.appendChild(count);
    header.appendChild(headerTop);
    const fullName = document.createElement("p");
    fullName.className = "moscow-quadrant-fullname";
    fullName.textContent = moscow;
    header.appendChild(fullName);
    if (gridDesc) {
      const descEl = document.createElement("p");
      descEl.className = "moscow-quadrant-description";
      descEl.textContent = gridDesc;
      header.appendChild(descEl);
    }
    cell.appendChild(header);

    const cardsContainer = document.createElement("div");
    cardsContainer.className = "moscow-board-column-cards";
    cardsContainer.addEventListener("scroll", () => hideCellTypeTooltips(), { passive: true });

    (byMoscow[moscow] || []).forEach((project, index) => {
      const card = document.createElement("div");
      card.className = "moscow-board-card";
      card.setAttribute("draggable", demoReadOnly ? "false" : "true");
      card.setAttribute("data-project-id", project.id);
      card.setAttribute(
        "aria-label",
        demoReadOnly
          ? "Project: " + (project.title || "Untitled") + ". View only."
          : "Project: " + (project.title || "Untitled") + ". Drag to change MOSCOW category. View, Edit, Delete."
      );

      const titleRow = document.createElement("div");
      titleRow.className = "moscow-board-card-title-row";
      const titleEl = buildCardTitleTooltipElement("moscow-board-card-title", project);
      titleRow.appendChild(titleEl);
      if (project.projectType) {
        const typeMeta = projectTypeIcons && projectTypeIcons[project.projectType];
        const typeWrap = document.createElement("span");
        typeWrap.className = "scrum-board-card-type-wrap cell-type-icon-wrap cell-type-pill";
        typeWrap.dataset.iconKind = "type";
        typeWrap.setAttribute("role", "img");
        typeWrap.setAttribute("aria-label", project.projectType);
        if (typeMeta && typeMeta.svg) {
          typeWrap.innerHTML = typeMeta.svg;
          if (typeMeta.tooltipTitle != null || typeMeta.tooltipBody != null) {
            const tooltipEl = document.createElement("div");
            tooltipEl.className = "cell-type-tooltip";
            tooltipEl.setAttribute("role", "tooltip");
            if (typeMeta.tooltipTitle != null) {
              const titleEl = document.createElement("div");
              titleEl.className = "cell-type-tooltip-title";
              titleEl.textContent = typeMeta.tooltipTitle;
              tooltipEl.appendChild(titleEl);
            }
            if (typeMeta.tooltipBody != null) {
              const bodyEl = document.createElement("div");
              bodyEl.className = "cell-type-tooltip-body";
              const paragraphs = String(typeMeta.tooltipBody).split(/\n\n+/);
              paragraphs.forEach((text) => {
                const p = document.createElement("p");
                p.textContent = text.replace(/\n/g, " ").trim();
                bodyEl.appendChild(p);
              });
              tooltipEl.appendChild(bodyEl);
            }
            typeWrap.appendChild(tooltipEl);
          }
        } else {
          typeWrap.textContent = project.projectType;
        }
        titleRow.appendChild(typeWrap);
      }

      const meta = document.createElement("div");
      meta.className = "moscow-board-card-meta";
      const metaLeft = document.createElement("span");
      metaLeft.className = "moscow-board-card-meta-left";
      const riceValue = project.riceScore != null ? project.riceScore : calculateRiceScore(project);
      const riceLabel = "RICE " + formatRice(riceValue);
      const reachVal = project.reachValue != null ? String(project.reachValue) : "—";
      const impactVal = project.impactValue != null ? String(project.impactValue) : "—";
      const confidenceVal = project.confidenceValue != null ? String(project.confidenceValue) : "—";
      const effortVal = project.effortValue != null ? String(project.effortValue) : "—";
      const confidenceNum = Number(project.confidenceValue);
      const confidenceDecimal = Number.isFinite(confidenceNum) ? confidenceNum / 100 : null;
      const formulaLine = Number.isFinite(Number(project.reachValue)) && Number.isFinite(Number(project.impactValue)) && Number.isFinite(confidenceDecimal) && Number.isFinite(Number(project.effortValue)) && Number(project.effortValue) > 0
        ? `[${Number(project.reachValue)} × ${Number(project.impactValue)} × ${confidenceDecimal.toFixed(2)}] ÷ ${Number(project.effortValue)} = ${formatRice(riceValue)}`
        : "Not enough inputs to compute full formula.";
      const rice = buildCardMetaTooltipWrap(
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
        "moscow-board-card-rice card-meta-with-tooltip"
      );
      metaLeft.appendChild(rice);
      if (project.tshirtSize) {
        const sizeTooltip = typeof tshirtSizeTooltips !== "undefined" ? tshirtSizeTooltips[project.tshirtSize] : null;
        const sizeSpan = buildCardMetaTooltipWrap(
          project.tshirtSize,
          `Project size ${project.tshirtSize}`,
          (sizeTooltip && sizeTooltip.tooltipTitle) || "Project size",
          [((sizeTooltip && sizeTooltip.tooltipBody) || project.tshirtSize)],
          "moscow-board-card-size card-meta-with-tooltip"
        );
        metaLeft.appendChild(sizeSpan);
      }
      const financialShort = getProjectFinancialImpactEurShort(project);
      if (financialShort) {
        const raw = project.financialImpactValue;
        const amount = Number.isFinite(raw) ? raw : Number(raw);
        const currency = (project.financialImpactCurrency || "EUR").toString().trim().toUpperCase() || "EUR";
        const shortOriginal = Number.isFinite(amount) && typeof formatFinancialShort === "function"
          ? formatFinancialShort(amount)
          : (Number.isFinite(amount) ? String(Number(amount).toLocaleString(undefined, { maximumFractionDigits: 2 })) : "—");
        const financialSpan = buildCardMetaTooltipWrap(
          financialShort,
          `Financial impact EUR ${financialShort}`,
          "Financial impact",
          [
            `EUR converted: ${financialShort}`,
            `Original: ${shortOriginal} ${currency}`
          ],
          "moscow-board-card-financial card-meta-with-tooltip"
        );
        metaLeft.appendChild(financialSpan);
      }
      meta.appendChild(metaLeft);
      const iconGroup = document.createElement("span");
      iconGroup.className = "scrum-board-card-icons";
      const frameworkKey = normalizeFinancialFramework(project.financialImpactFramework);
      const frameworkMeta = FINANCIAL_FRAMEWORK_ICONS[frameworkKey];
      if (frameworkMeta && frameworkMeta.svg) {
        const frameworkWrap = document.createElement("span");
        frameworkWrap.className = "scrum-board-card-type-wrap cell-type-icon-wrap cell-type-pill";
        frameworkWrap.dataset.iconKind = "framework";
        frameworkWrap.setAttribute("role", "img");
        frameworkWrap.setAttribute("aria-label", frameworkMeta.label || frameworkKey);
        frameworkWrap.innerHTML = frameworkMeta.svg;
        if (frameworkMeta.tooltipTitle != null || frameworkMeta.tooltipBody != null) {
          const tooltipEl = document.createElement("div");
          tooltipEl.className = "cell-type-tooltip";
          tooltipEl.setAttribute("role", "tooltip");
          if (frameworkMeta.tooltipTitle != null) {
            const titleEl = document.createElement("div");
            titleEl.className = "cell-type-tooltip-title";
            titleEl.textContent = frameworkMeta.tooltipTitle;
            tooltipEl.appendChild(titleEl);
          }
          if (frameworkMeta.tooltipBody != null) {
            const bodyEl = document.createElement("div");
            bodyEl.className = "cell-type-tooltip-body";
            const p = document.createElement("p");
            p.textContent = frameworkMeta.tooltipBody;
            bodyEl.appendChild(p);
            tooltipEl.appendChild(bodyEl);
          }
          frameworkWrap.appendChild(tooltipEl);
        }
        iconGroup.appendChild(frameworkWrap);
      }
      if (iconGroup.childElementCount > 0) {
        meta.appendChild(iconGroup);
      }
      appendPortfolioCardBody(card, titleRow, meta);

      const moveEl = isCompactPortfolioLayout()
        ? buildMoscowCardMoveSelect(project, moscow, { disabled: demoReadOnly })
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
      upBtn.setAttribute("data-project-id", project.id);
      upBtn.setAttribute("data-moscow", moscow);
      upBtn.setAttribute("aria-label", "Move project up in quadrant");
      upBtn.title = "Move up";
      upBtn.innerHTML = "↑";
      upBtn.disabled = orderDisabled || isFirst;
      const downBtn = document.createElement("button");
      downBtn.type = "button";
      downBtn.className = "moscow-board-card-btn moscow-board-card-btn--order";
      downBtn.setAttribute("data-action", "moscowMoveDown");
      downBtn.setAttribute("data-project-id", project.id);
      downBtn.setAttribute("data-moscow", moscow);
      downBtn.setAttribute("aria-label", "Move project down in quadrant");
      downBtn.title = "Move down";
      downBtn.innerHTML = "↓";
      downBtn.disabled = orderDisabled || isLast;
      if (!demoReadOnly) {
        upBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          moveMoscowProjectUp(project.id, moscow);
        });
        downBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          moveMoscowProjectDown(project.id, moscow);
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
      viewBtn.setAttribute("data-project-id", project.id);
      setPortfolioCardActionButton(viewBtn, "view", "View");
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "moscow-board-card-btn moscow-board-card-btn--edit";
      editBtn.setAttribute("data-project-id", project.id);
      setPortfolioCardActionButton(editBtn, "edit", "Edit");
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "moscow-board-card-btn moscow-board-card-btn--delete";
      deleteBtn.setAttribute("data-project-id", project.id);
      setPortfolioCardActionButton(deleteBtn, "delete", "Delete");
      if (demoReadOnly) {
        editBtn.disabled = true;
        deleteBtn.disabled = true;
        editBtn.title = DEMO_READ_ONLY_ACTION_TITLE;
        deleteBtn.title = DEMO_READ_ONLY_ACTION_TITLE;
      }
      viewBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        openProjectModal("view", project.id);
      });
      actions.appendChild(viewBtn);
      if (!demoReadOnly) {
        editBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          openProjectModal("edit", project.id);
        });
        deleteBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          handleSingleDelete(project.id);
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
  syncMoscowCompactNav();
}

function bindMoscowBoardDragAndDrop() {
  if (!elements.moscowBoardContainer) return;
  const cards = elements.moscowBoardContainer.querySelectorAll(".moscow-board-card");
  const columns = elements.moscowBoardContainer.querySelectorAll(".moscow-board-column");

  let draggedCard = null;
  let draggedProjectId = null;
  let dropColumn = null;
  let dragGhost = null;

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
      draggedProjectId = card.getAttribute("data-project-id");
      const { ghost, offsetX, offsetY } = createDragGhost(card, e.clientX, e.clientY);
      dragGhost = ghost;
      card.classList.add("moscow-board-card--dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", draggedProjectId);
      e.dataTransfer.setData("application/x-project-id", draggedProjectId);
      e.dataTransfer.setDragImage(ghost, offsetX, offsetY);
    });

    card.addEventListener("dragend", () => {
      if (dragGhost && dragGhost.parentNode) dragGhost.remove();
      dragGhost = null;
      if (draggedCard) draggedCard.classList.remove("moscow-board-card--dragging");
      draggedCard = null;
      draggedProjectId = null;
      dropColumn = null;
      columns.forEach((col) => col.classList.remove("moscow-board-column--drag-over"));
    });
  });

  columns.forEach((column) => {
    column.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (!draggedProjectId) return;
      const cardInColumn = column.querySelector(`[data-project-id="${draggedProjectId}"]`);
      if (!cardInColumn) column.classList.add("moscow-board-column--drag-over");
      dropColumn = column;
    });

    column.addEventListener("dragleave", (e) => {
      if (!column.contains(e.relatedTarget)) column.classList.remove("moscow-board-column--drag-over");
    });

    column.addEventListener("drop", (e) => {
      e.preventDefault();
      column.classList.remove("moscow-board-column--drag-over");
      columns.forEach((col) => col.classList.remove("moscow-board-column--drag-over"));
      if (!draggedProjectId) return;
      const targetColumn = dropColumn || column.closest(".moscow-board-column");
      if (!targetColumn) return;
      const newMoscow = targetColumn.getAttribute("data-moscow");
      setProjectMoscowCategory(draggedProjectId, newMoscow);
    });
  });

  elements.moscowBoardContainer.addEventListener("drop", (e) => {
    if (!dropColumn || !draggedProjectId) return;
    if (e.target.closest(".moscow-board-column")) return;
    e.preventDefault();
    e.stopPropagation();
    columns.forEach((col) => col.classList.remove("moscow-board-column--drag-over"));
    const newMoscow = dropColumn.getAttribute("data-moscow");
    setProjectMoscowCategory(draggedProjectId, newMoscow);
  }, true);
}

function applyFilters(projects) {
  const titleQuery = (elements.filterTitle.value || "").trim().toLowerCase();
  const selectedPeriodsFilter = getSelectedFilterProjectPeriods();
  const impactFilter = elements.filterImpact.value;
  const effortFilter = elements.filterEffort.value;
  const currencyFilter = elements.filterCurrency.value;
  const frameworkFilter = elements.filterFinancialFramework ? elements.filterFinancialFramework.value : "";
  const statusFilter = elements.filterStatus ? elements.filterStatus.value : "";
  const tshirtFilter = elements.filterTshirtSize ? elements.filterTshirtSize.value : "";
  const moscowFilter = elements.filterMoscow ? elements.filterMoscow.value : "";
  const projectTypeFilter = elements.filterProjectType.value;
  const selectedCountriesFilter = getSelectedFilterCountries();

  return projects.filter((p) => {
    if (titleQuery) {
      const title = (p.title || "").toLowerCase();
      if (!title.includes(titleQuery)) return false;
    }

    if (selectedPeriodsFilter.length) {
      const projectPeriod = (p.projectPeriod || "").toString().trim().toUpperCase();
      if (!projectPeriod || !selectedPeriodsFilter.includes(projectPeriod)) return false;
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
      const projectFramework = normalizeFinancialFramework(p.financialImpactFramework);
      if (projectFramework !== frameworkFilter) return false;
    }

    if (statusFilter) {
      if ((p.projectStatus || "") !== statusFilter) return false;
    }

    if (tshirtFilter) {
      const projectSize = (p.tshirtSize || "").toString().trim();
      if (tshirtFilter === "__none__") {
        if (projectSize !== "") return false;
      } else {
        if (projectSize !== tshirtFilter) return false;
      }
    }

    if (moscowFilter) {
      if ((p.moscowCategory || "") !== moscowFilter) return false;
    }

    if (projectTypeFilter) {
      const projectType = (p.projectType || "").toString().trim();
      if (projectTypeFilter === "__none__") {
        if (projectType !== "") return false;
      } else {
        if (projectType !== projectTypeFilter) return false;
      }
    }

    if (selectedCountriesFilter.length) {
      const projCountries = Array.isArray(p.countries) ? p.countries : [];
      const hasMatch = projCountries.some((c) => selectedCountriesFilter.includes(c));
      if (!hasMatch) return false;
    }

    return true;
  });
}

function sortProjects(projects) {
  if (state.tableSortByRice) {
    return projects.slice().sort((a, b) => {
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

  return projects.slice().sort((a, b) => {
    if (field === "title" || field === "projectType" || field === "projectStatus" || field === "financialImpactFramework" || field === "tshirtSize" || field === "financialImpactCurrency" || field === "moscowCategory") {
      const va = (a[field] || "").toString().toLowerCase();
      const vb = (b[field] || "").toString().toLowerCase();
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
  renderProjects();
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
  elements.filterTitle.value = "";
  elements.filterImpact.value = "";
  elements.filterEffort.value = "";
  elements.filterCurrency.value = "";
  if (elements.filterFinancialFramework) elements.filterFinancialFramework.value = "";
  elements.filterProjectType.value = "";
  if (elements.filterStatus) elements.filterStatus.value = "";
  if (elements.filterTshirtSize) elements.filterTshirtSize.value = "";
  if (elements.filterMoscow) elements.filterMoscow.value = "";
  if (elements.filterProjectPeriodSearch) {
    elements.filterProjectPeriodSearch.value = "";
  }
  if (elements.filterProjectPeriodList) {
    const checkboxes = elements.filterProjectPeriodList.querySelectorAll("input[type=\"checkbox\"]");
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
  updateFilterProjectPeriodsSummary();
  updateFilterCountriesSummary();
}

function isTableCompactLayout() {
  return (
    document.documentElement.classList.contains("is-compact-layout") ||
    isCompactLayoutViewport()
  );
}

function getTableSelectionCount() {
  return Array.from(getProjectSelectCheckboxes()).filter((cb) => cb.checked).length;
}

function syncProjectTableSelection() {
  syncHeaderCheckbox();
  updateBulkDeleteButton();
  syncProjectTableCardSelectionStyles();
}

function clearProjectSelection() {
  getProjectSelectCheckboxes().forEach((cb) => {
    cb.checked = false;
  });
  if (elements.selectAllProjects) elements.selectAllProjects.checked = false;
  syncProjectTableSelection();
}

function updateBulkDeleteButton() {
  const count = getTableSelectionCount();
  const anyChecked = count > 0;
  const inTableView = state.projectsView === "table";
  const isCompactTable = isTableCompactLayout();

  if (elements.bulkDeleteBtn) {
    const showToolbarBtn = inTableView && anyChecked && !isCompactTable;
    elements.bulkDeleteBtn.hidden = !showToolbarBtn;
    elements.bulkDeleteBtn.disabled = !anyChecked || isActiveDemoProfile();
    if (isActiveDemoProfile()) {
      elements.bulkDeleteBtn.title = DEMO_READ_ONLY_ACTION_TITLE;
    } else {
      elements.bulkDeleteBtn.removeAttribute("title");
    }
  }

  const showMobileBar = inTableView && anyChecked && isCompactTable;
  if (elements.portfolioSelectionBar) {
    elements.portfolioSelectionBar.hidden = !showMobileBar;
    elements.portfolioSelectionBar.classList.toggle("portfolio-selection-bar--visible", showMobileBar);
  }
  document.documentElement.classList.toggle("has-portfolio-selection-bar", showMobileBar);
  if (elements.portfolioSelectionCount) {
    elements.portfolioSelectionCount.textContent =
      count === 1 ? "1 selected" : `${count} selected`;
  }
  if (elements.portfolioSelectionDeleteBtn) {
    elements.portfolioSelectionDeleteBtn.disabled = !anyChecked || isActiveDemoProfile();
    if (isActiveDemoProfile()) {
      elements.portfolioSelectionDeleteBtn.title = DEMO_READ_ONLY_ACTION_TITLE;
    } else {
      elements.portfolioSelectionDeleteBtn.removeAttribute("title");
    }
  }
}

function syncHeaderCheckbox() {
  if (!elements.selectAllProjects) return;
  const checkboxes = getProjectSelectCheckboxes();
  if (!checkboxes.length) {
    elements.selectAllProjects.checked = false;
    return;
  }
  const allChecked = Array.from(checkboxes).every((cb) => cb.checked);
  elements.selectAllProjects.checked = allChecked;
}

function handleBulkDelete() {
  if (state.projectsView !== "table") return;
  if (!requireWritableActiveProfile("Bulk delete")) return;
  const activeProfile = getUnlockedActiveProfile();
  if (!activeProfile || !elements.projectDeleteModal) return;
  const checked = Array.from(getProjectSelectCheckboxes()).filter((cb) => cb.checked);
  if (!checked.length) return;

  prepareAppOverlay("projectDeleteModal");
  const ids = checked.map((cb) => cb.getAttribute("data-id"));

  elements.projectDeleteModal.setAttribute("data-delete-mode", "bulk");
  elements.projectDeleteModal.setAttribute("data-project-ids", ids.join(","));

  if (elements.projectDeleteNameLabel) {
    elements.projectDeleteNameLabel.textContent = `${ids.length} project${ids.length === 1 ? "" : "s"} selected`;
  }
  if (elements.projectDeleteWarningText) {
    elements.projectDeleteWarningText.textContent =
      "This will permanently remove the selected projects from this profile. This action cannot be undone.";
  }

  elements.projectDeleteModal.setAttribute("aria-hidden", "false");
  elements.projectDeleteModal.classList.add("active");

  if (elements.projectDeleteConfirmBtn) {
    elements.projectDeleteConfirmBtn.onclick = () => {
      const mode = elements.projectDeleteModal.getAttribute("data-delete-mode") || "single";
      if (mode === "bulk") {
        const idsAttr = elements.projectDeleteModal.getAttribute("data-project-ids") || "";
        const idList = idsAttr ? idsAttr.split(",").filter(Boolean) : [];
        if (!idList.length) {
          closeProjectDeleteModal();
          return;
        }
        const count = idList.length;
        activeProfile.projects = activeProfile.projects.filter((p) => !idList.includes(p.id));
        saveState();
        renderProjects();
        closeProjectDeleteModal();
        showToast(count === 1 ? "Project deleted successfully." : count + " projects deleted successfully.");
      }
    };
  }

  if (elements.projectDeleteCancelBtn) {
    elements.projectDeleteCancelBtn.onclick = () => {
      closeProjectDeleteModal();
    };
  }
}

function closeProjectDeleteModal({ immediate = false } = {}) {
  if (!elements.projectDeleteModal) return;
  closeModalBackdrop(elements.projectDeleteModal, { immediate });
  elements.projectDeleteModal.removeAttribute("data-project-id");
  elements.projectDeleteModal.removeAttribute("data-project-ids");
  elements.projectDeleteModal.removeAttribute("data-delete-mode");
}

function closeProfileDeleteModal({ immediate = false } = {}) {
  if (!elements.profileDeleteModal) return;
  closeModalBackdrop(elements.profileDeleteModal, { immediate });
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
  renderProjects();
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
  prepareAppOverlay("profileUnlockModal");
  elements.profileUnlockModal.setAttribute("data-profile-id", profileId);
  if (elements.profileUnlockModalSubtitle) {
    elements.profileUnlockModalSubtitle.textContent = `Enter the password for “${profile.name || "this profile"}” to continue.`;
  }
  if (elements.profileUnlockPassword) {
    elements.profileUnlockPassword.value = "";
  }
  hideProfileUnlockError();
  elements.profileUnlockModal.setAttribute("aria-hidden", "false");
  elements.profileUnlockModal.classList.add("active");
  if (elements.profileUnlockPassword) {
    setTimeout(() => elements.profileUnlockPassword.focus(), 50);
  }
}

function closeProfileUnlockModal({ immediate = false } = {}) {
  if (!elements.profileUnlockModal) return;
  closeModalBackdrop(elements.profileUnlockModal, { immediate });
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

function getProjectFinancialImpactEurAmount(project) {
  if (!project || project.financialImpactValue == null || project.financialImpactValue === "") return null;
  const raw = project.financialImpactValue;
  const amount = Number.isFinite(raw) ? raw : Number(raw);
  if (!Number.isFinite(amount)) return null;
  const currency = (project.financialImpactCurrency || "EUR").toString().trim().toUpperCase() || "EUR";
  if (typeof ExchangeRates !== "undefined" && typeof ExchangeRates.convertToEUR === "function") {
    const amountEur = ExchangeRates.convertToEUR(amount, currency);
    return Number.isFinite(amountEur) ? amountEur : null;
  }
  return currency === "EUR" ? amount : null;
}

function renderProfileViewFinancialStats(projects) {
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
    projects.forEach((p) => {
      if (p.financialImpactValue == null || p.financialImpactValue === "") return;
      const eur = getProjectFinancialImpactEurAmount(p);
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
            ? "1 project with a non-EUR amount could not be converted. Exchange rates refresh daily."
            : `${skippedCount} projects with non-EUR amounts could not be converted. Exchange rates refresh daily.`;
      } else {
        note.hidden = true;
        note.textContent = "";
      }
    }

    renderProfileViewStatsGrid(container, amounts, {
      formatValue: formatProfileViewFinancialEur,
      emptyMessage: "No financial impact yet. Add financial impact to projects."
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

function buildProfileViewCountryCounts(projects) {
  const counts = {};
  const list = Array.isArray(projects) ? projects : [];
  list.forEach((project) => {
    const countries = normalizeCountryNames(
      Array.isArray(project.countries) ? project.countries : []
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
    return "Projects without any target country set";
  }
  const code =
    typeof countryCodeByName !== "undefined" && countryCodeByName[countryName]
      ? countryCodeByName[countryName]
      : "";
  if (code) return `${countryName} (${code}) — projects targeting this country`;
  return `${countryName} — projects targeting this country`;
}

const PROFILE_VIEW_NO_CURRENCY_KEY = "Not set";

function getProfileViewProjectCurrencyKey(project) {
  const currency = normalizeCurrency(project && project.financialImpactCurrency);
  return currency ? currency.toUpperCase() : PROFILE_VIEW_NO_CURRENCY_KEY;
}

function buildProfileViewCurrencyData(projects) {
  const counts = {};
  const totals = {};
  const list = Array.isArray(projects) ? projects : [];
  list.forEach((project) => {
    const key = getProfileViewProjectCurrencyKey(project);
    counts[key] = (counts[key] || 0) + 1;
    if (project.financialImpactValue == null || project.financialImpactValue === "") return;
    const amount = Number(project.financialImpactValue);
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
  const projectsLabel = `${count} project${count === 1 ? "" : "s"}`;
  if (currencyKey === PROFILE_VIEW_NO_CURRENCY_KEY) {
    let title = `Projects without a currency set — ${projectsLabel}`;
    if (Number.isFinite(total) && total !== 0) {
      title += `, total impact ${typeof formatFinancialShort === "function" ? formatFinancialShort(total) : total} (no currency)`;
    }
    return title;
  }
  let title = `Projects with original currency ${currencyKey} — ${projectsLabel}`;
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

function renderProfileViewCurrencyTotals(container, note, projects) {
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
    const { counts, totals } = buildProfileViewCurrencyData(projects);
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
      countEl.textContent = `${count} project${count === 1 ? "" : "s"}`;

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
            ? "Totals use each project's stored amount in its original currency. EUR equivalents use the app's latest exchange rates; 1 currency could not be converted."
            : `Totals use each project's stored amount in its original currency. EUR equivalents use the app's latest exchange rates; ${unavailableConversions} currencies could not be converted.`;
      } else {
        note.textContent =
          "Totals use each project's stored amount in its original currency. EUR equivalents below use the app's latest exchange rates (refreshed daily).";
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

function syncProjectModalFooterMetaDetails({ resetCollapsed = false } = {}) {
  const details = elements.projectModalFooterMetaDetails;
  if (!details) return;
  const isCompact = isCompactLayoutViewport();
  if (!isCompact) {
    details.open = true;
  } else if (resetCollapsed) {
    details.open = false;
  }
  const summary = details.querySelector(".project-modal-footer-meta-summary");
  if (summary) summary.setAttribute("aria-expanded", details.open ? "true" : "false");
}

function openProfileViewModal(profileId) {
  const profile = state.profiles.find((p) => p.id === profileId);
  if (!profile || !elements.profileViewModal) return;
  if (!requireProfileUnlocked(profileId, "view")) return;
  prepareAppOverlay("profileViewModal");

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

  const projects = Array.isArray(profile.projects) ? profile.projects.slice() : [];
  const totalProjects = projects.length;

  if (elements.profileViewTotalProjects) {
    elements.profileViewTotalProjects.textContent = String(totalProjects);
  }

  const uniqueCountries = new Set();
  projects.forEach((p) => {
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
  projects.forEach((p) => {
    const statusKey = (p.projectStatus || "Not set").toString();
    statusCounts[statusKey] = (statusCounts[statusKey] || 0) + 1;
    const typeKey = (p.projectType || "Not set").toString();
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
    buildProfileViewCountryCounts(projects),
    {
      labelFor: (key) => getProfileViewCountryChipLabel(key),
      titleFor: (key) => getProfileViewCountryChipTitle(key),
    }
  );

  const currencyData = buildProfileViewCurrencyData(projects);
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
    projects
  );

  syncProfileViewCurrencyDetails({ resetCollapsed: true });

  renderProfileViewStatsGrid(elements.profileViewRiceStats, riceScores, {
    formatValue: formatRice,
    emptyMessage: "No RICE scores yet. Add reach, impact, confidence, and effort to projects."
  });

  renderProfileViewFinancialStats(projects);

  elements.profileViewModal.setAttribute("aria-hidden", "false");
  elements.profileViewModal.classList.add("active");
}

function closeProfileViewModal({ immediate = false } = {}) {
  if (!elements.profileViewModal) return;
  closeModalBackdrop(elements.profileViewModal, { immediate });
}

function openProfileEditModal(profileId) {
  const profile = state.profiles.find((p) => p.id === profileId);
  if (!profile || !elements.profileEditModal) return;
  if (isDemoProfile(profile)) {
    showToast("Demo profile is read-only. Profile edits are disabled.");
    return;
  }
  if (!requireProfileUnlocked(profileId, "edit")) return;
  prepareAppOverlay("profileEditModal");
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
  elements.profileEditModal.setAttribute("aria-hidden", "false");
  elements.profileEditModal.classList.add("active");
  setTimeout(() => {
    if (elements.profileEditName) elements.profileEditName.focus();
  }, 80);
}

function closeProfileEditModal({ immediate = false } = {}) {
  if (!elements.profileEditModal) return;
  closeModalBackdrop(elements.profileEditModal, { immediate });
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
  renderProjects();
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
  prepareAppOverlay("profileDeleteModal");
  const projectCount = profile.projects ? profile.projects.length : 0;

  elements.profileDeleteModal.setAttribute("data-profile-id", profileId);
  if (elements.profileDeleteNameLabel) {
    elements.profileDeleteNameLabel.textContent = profile.name || "Untitled profile";
  }
  if (elements.profileDeleteSummaryLabel) {
    if (projectCount > 0) {
      elements.profileDeleteSummaryLabel.textContent = ` • ${projectCount} project${projectCount === 1 ? "" : "s"} attached`;
    } else {
      elements.profileDeleteSummaryLabel.textContent = " • No projects yet";
    }
  }
  if (elements.profileDeleteWarningText) {
    elements.profileDeleteWarningText.textContent =
      "This will permanently remove this profile and all of its projects from this browser. This action cannot be undone.";
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

  elements.profileDeleteModal.setAttribute("aria-hidden", "false");
  elements.profileDeleteModal.classList.add("active");
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
          renderProjects();
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

function handleSingleDelete(projectId) {
  if (!requireWritableActiveProfile("Delete")) return;
  const activeProfile = getActiveProfile();
  if (!activeProfile || !elements.projectDeleteModal) return;

  const project = activeProfile.projects.find((p) => p.id === projectId);
  if (!project) return;

  prepareAppOverlay("projectDeleteModal");
  elements.projectDeleteModal.setAttribute("data-delete-mode", "single");
  elements.projectDeleteModal.setAttribute("data-project-id", projectId);
  elements.projectDeleteModal.removeAttribute("data-project-ids");
  if (elements.projectDeleteNameLabel) {
    elements.projectDeleteNameLabel.textContent = project.title || "Untitled project";
  }
  if (elements.projectDeleteWarningText) {
    elements.projectDeleteWarningText.textContent =
      "This will permanently remove this project from this profile. This action cannot be undone.";
  }

  elements.projectDeleteModal.setAttribute("aria-hidden", "false");
  elements.projectDeleteModal.classList.add("active");

  if (elements.projectDeleteConfirmBtn) {
    elements.projectDeleteConfirmBtn.onclick = () => {
      const mode = elements.projectDeleteModal.getAttribute("data-delete-mode") || "single";
      if (mode === "single") {
        const id = elements.projectDeleteModal.getAttribute("data-project-id");
        const target = activeProfile.projects.find((p) => p.id === id);
        if (!target) {
          closeProjectDeleteModal();
          return;
        }
        activeProfile.projects = activeProfile.projects.filter((p) => p.id !== id);
        saveState();
        renderProjects();
        closeProjectDeleteModal();
        showToast("Project deleted successfully.");
      }
    };
  }

  if (elements.projectDeleteCancelBtn) {
    elements.projectDeleteCancelBtn.onclick = () => {
      closeProjectDeleteModal();
    };
  }
}

function openProjectModal(mode, projectId) {
  const isEdit = mode === "edit";
  const isView = mode === "view";
  if (!isView && !requireWritableActiveProfile(isEdit ? "Edit" : "Add project")) return;
  projectModalMode = mode;
  editingProjectId = isEdit ? projectId : null;
  elements.projectFormError.style.display = "none";
  elements.projectFormError.textContent = "";

  const activeProfile = getActiveProfile();
  if (!activeProfile) return;
  if (!isProfileUnlocked(activeProfile.id)) {
    pendingUnlockAction = { type: "activate", profileId: activeProfile.id };
    openProfileUnlockModal(activeProfile.id);
    showToast("Unlock this profile to add or edit projects.");
    return;
  }

  let project = null;
  if (isEdit || isView) {
    project = activeProfile.projects.find((p) => p.id === projectId);
  }

  if (project) {
    elements.projectModalTitle.textContent = isView ? "View project" : "Edit project";
    elements.projectTitle.value = project.title || "";
    elements.projectDescription.value = project.description || "";
    elements.reachDescription.value = project.reachDescription || "";
    elements.reachValue.value = project.reachValue != null ? project.reachValue : "";
    elements.impactDescription.value = project.impactDescription || "";
    elements.impactValue.value = project.impactValue != null ? String(project.impactValue) : "";
    elements.confidenceDescription.value = project.confidenceDescription || "";
    elements.confidenceValue.value = project.confidenceValue != null ? project.confidenceValue : "";
    elements.effortDescription.value = project.effortDescription || "";
    elements.effortValue.value = project.effortValue != null ? String(project.effortValue) : "";
    elements.financialImpactValue.value = project.financialImpactValue != null ? project.financialImpactValue : "";
    const framework = normalizeFinancialFramework(project.financialImpactFramework);
    if (elements.financialFramework) elements.financialFramework.value = framework;
    if (elements.financialFramework) elements.financialFramework.dataset.lastFramework = framework;
    setFinancialInputsToForm(project.financialImpactInputs || {});
    toggleFinancialFrameworkFields(framework);
    ensureCurrencyOption(elements.projectCurrency, project.financialImpactCurrency);
    const currencyVal = project.financialImpactCurrency ? String(project.financialImpactCurrency).trim() : "";
    if (currencyVal) {
      const opt = Array.from(elements.projectCurrency.options).find(
        (o) => (o.value || "").toUpperCase() === currencyVal.toUpperCase()
      );
      if (opt) elements.projectCurrency.value = opt.value;
    } else {
      elements.projectCurrency.value = "";
    }
    elements.projectType.value = project.projectType || "";
    elements.projectStatus.value = project.projectStatus || "";
    elements.projectTshirtSize.value = project.tshirtSize || "";
    elements.projectPeriod.value = project.projectPeriod || "";
    elements.projectMoscow.value = project.moscowCategory || "";
    renderCountriesControls(Array.isArray(project.countries) ? project.countries : []);

    if (elements.projectMetaId) {
      elements.projectMetaId.textContent = project.id || "—";
    }
    elements.projectMetaCreated.textContent = formatDateTime(project.createdAt);
    elements.projectMetaModified.textContent = formatDateTime(project.modifiedAt || project.createdAt);
    elements.projectMetaRice.textContent = formatRice(calculateRiceScore(project));
    elements.projectFormSubmitBtn.textContent = isView ? "Close" : "Update project";
  } else {
    elements.projectModalTitle.textContent = "New project";
    elements.projectTitle.value = "";
    elements.projectDescription.value = "";
    elements.reachDescription.value = "";
    elements.reachValue.value = "";
    elements.impactDescription.value = "";
    elements.impactValue.value = "";
    elements.confidenceDescription.value = "";
    elements.confidenceValue.value = "";
    elements.effortDescription.value = "";
    elements.effortValue.value = "";
    elements.financialImpactValue.value = "";
    if (elements.financialFramework) elements.financialFramework.value = FINANCIAL_FRAMEWORK_DEFAULT;
    if (elements.financialFramework) elements.financialFramework.dataset.lastFramework = FINANCIAL_FRAMEWORK_DEFAULT;
    setFinancialInputsToForm({});
    toggleFinancialFrameworkFields(FINANCIAL_FRAMEWORK_DEFAULT);
    elements.projectCurrency.value = "";
    elements.projectType.value = "";
    elements.projectStatus.value = "Not Started";
    elements.projectTshirtSize.value = "";
    elements.projectPeriod.value = "";
    elements.projectMoscow.value = "Could have";
    renderCountriesControls([]);

    const now = new Date();
    const nowIso = now.toISOString();
    const currentYear = now.getFullYear();
    const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
    elements.projectPeriod.value = `${currentYear}-Q${currentQuarter}`;
    if (elements.projectMetaId) {
      elements.projectMetaId.textContent = "Will be generated on save";
    }
    elements.projectMetaCreated.textContent = formatDateTime(nowIso);
    elements.projectMetaModified.textContent = formatDateTime(nowIso);
    elements.projectMetaRice.textContent = "—";
    elements.projectFormSubmitBtn.textContent = "Save project";
  }

  updateModalRicePreview();
  resetProjectModalSectionNav();
  syncProjectModalFooterMetaDetails({ resetCollapsed: true });
  prepareAppOverlay("projectModal");
  elements.projectModal.setAttribute("aria-hidden", "false");
  elements.projectModal.classList.add("active");
  elements.projectTitle.focus();

  const inputs = elements.projectForm.querySelectorAll("input, textarea, select");
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
  if (elements.countriesContainer) {
    const removeButtons = elements.countriesContainer.querySelectorAll(".country-remove-btn");
    removeButtons.forEach((btn) => {
      btn.style.display = isView ? "none" : "";
    });
  }

  if (elements.projectFormCancelBtn) {
    elements.projectFormCancelBtn.style.display = isView ? "none" : "";
  }
}

function closeProjectModal({ immediate = false } = {}) {
  hideCellTypeTooltips();
  closeModalBackdrop(elements.projectModal, { immediate });
  editingProjectId = null;
}

function handleProjectFormSubmit(e) {
  e.preventDefault();
  elements.projectFormError.style.display = "none";
  elements.projectFormError.textContent = "";

  if (elements.projectFormSubmitBtn.textContent === "Close") {
    closeProjectModal();
    return;
  }

  if (!requireWritableActiveProfile("Save project")) return;

  const activeProfile = getUnlockedActiveProfile();
  if (!activeProfile) {
    showToast("Unlock this profile to save projects.");
    return;
  }

  let period = (elements.projectPeriod.value || "").trim();
  if (period) {
    period = period.toUpperCase();
  }

  const raw = {
    title: (elements.projectTitle.value || "").trim(),
    description: (elements.projectDescription.value || "").trim(),
    reachDescription: (elements.reachDescription.value || "").trim(),
    reachValue: elements.reachValue.value !== "" ? Number(elements.reachValue.value) : null,
    impactDescription: (elements.impactDescription.value || "").trim(),
    impactValue: elements.impactValue.value !== "" ? Number(elements.impactValue.value) : null,
    confidenceDescription: (elements.confidenceDescription.value || "").trim(),
    confidenceValue: elements.confidenceValue.value !== "" ? Number(elements.confidenceValue.value) : null,
    effortDescription: (elements.effortDescription.value || "").trim(),
    effortValue: elements.effortValue.value !== "" ? Number(elements.effortValue.value) : null,
    financialImpactValue: elements.financialImpactValue.value !== "" ? Number(elements.financialImpactValue.value) : null,
    financialImpactCurrency: normalizeCurrency(elements.projectCurrency.value),
    financialImpactFramework: normalizeFinancialFramework(elements.financialFramework && elements.financialFramework.value),
    financialImpactInputs: sanitizeFinancialImpactInputs(
      normalizeFinancialFramework(elements.financialFramework && elements.financialFramework.value),
      mergeFinancialImpactInputsForCompute()
    ),
    projectType: (elements.projectType.value || "").trim() || null,
    projectStatus: (elements.projectStatus.value || "").trim() || null,
    tshirtSize: (elements.projectTshirtSize.value || "").trim() || null,
    projectPeriod: period,
    moscowCategory: (elements.projectMoscow && elements.projectMoscow.value) ? (elements.projectMoscow.value || "").trim() || "Could have" : "Could have",
    countries: getCountriesFromControls()
  };

  raw.financialImpactValue = computeFrameworkFinancialImpact(
    raw.financialImpactFramework,
    raw.financialImpactInputs,
    raw.financialImpactValue
  );

  if (raw.financialImpactFramework !== FINANCIAL_FRAMEWORK_DEFAULT && !Number.isFinite(raw.financialImpactValue)) {
    elements.projectFormError.textContent = getFinancialFrameworkValidationMessage(
      raw.financialImpactFramework,
      raw.financialImpactInputs
    );
    elements.projectFormError.style.display = "block";
    return;
  }

  const validationError = validateProjectInput(raw);
  if (validationError) {
    elements.projectFormError.textContent = validationError;
    elements.projectFormError.style.display = "block";
    return;
  }

  if (editingProjectId) {
    const project = activeProfile.projects.find((p) => p.id === editingProjectId);
    if (!project) return;
    project.title = raw.title;
    project.description = raw.description;
    project.reachDescription = raw.reachDescription;
    project.reachValue = raw.reachValue;
    project.impactDescription = raw.impactDescription;
    project.impactValue = raw.impactValue;
    project.confidenceDescription = raw.confidenceDescription;
    project.confidenceValue = raw.confidenceValue;
    project.effortDescription = raw.effortDescription;
    project.effortValue = raw.effortValue;
    project.financialImpactValue = raw.financialImpactValue;
    project.financialImpactCurrency = raw.financialImpactCurrency;
    project.financialImpactFramework = raw.financialImpactFramework;
    project.financialImpactInputs = raw.financialImpactInputs;
    project.projectType = raw.projectType || null;
    project.projectStatus = raw.projectStatus || null;
    project.tshirtSize = raw.tshirtSize || null;
    project.projectPeriod = raw.projectPeriod || null;
    project.moscowCategory = raw.moscowCategory || null;
    project.countries = Array.isArray(raw.countries) ? raw.countries : [];
    project.modifiedAt = new Date().toISOString();
    project.riceScore = calculateRiceScore(project);
  } else {
    const now = new Date().toISOString();
    const project = {
      id: generateId("project"),
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
      projectType: raw.projectType || null,
      projectStatus: raw.projectStatus || null,
      tshirtSize: raw.tshirtSize || null,
      projectPeriod: raw.projectPeriod || null,
      moscowCategory: raw.moscowCategory || "Could have",
      countries: Array.isArray(raw.countries) ? raw.countries : []
    };
    project.riceScore = calculateRiceScore(project);
    activeProfile.projects.unshift(project);
  }

  const wasCreate = !editingProjectId;
  saveState();
  closeProjectModal();
  renderProjects();
  if (wasCreate) showToast("Project created successfully.");
  else showToast("Project updated successfully.");
}

function updateModalRicePreview() {
  const temp = {
    reachValue: elements.reachValue.value !== "" ? Number(elements.reachValue.value) : null,
    impactValue: elements.impactValue.value !== "" ? Number(elements.impactValue.value) : null,
    confidenceValue: elements.confidenceValue.value !== "" ? Number(elements.confidenceValue.value) : null,
    effortValue: elements.effortValue.value !== "" ? Number(elements.effortValue.value) : null
  };
  const rice = calculateRiceScore(temp);
  elements.projectMetaRice.textContent = Number.isFinite(rice) && rice > 0 ? formatRice(rice) : "—";

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
  const currency = (elements.projectCurrency && elements.projectCurrency.value || "").toString().trim().toUpperCase() || "";
  const hasAmount = Number.isFinite(computedAmount);
  const hasCurrency = currency.length === 3;

  if (elements.projectMetaFinancialEur) {
    if (hasAmount && hasCurrency) {
      const amountEur = typeof ExchangeRates !== "undefined" && typeof ExchangeRates.convertToEUR === "function"
        ? ExchangeRates.convertToEUR(computedAmount, currency)
        : NaN;
      if (Number.isFinite(amountEur)) {
        const short = typeof formatFinancialShort === "function"
          ? formatFinancialShort(amountEur)
          : String(Number(amountEur).toLocaleString(undefined, { maximumFractionDigits: 2 }));
        elements.projectMetaFinancialEur.textContent = "€" + short;
      } else {
        elements.projectMetaFinancialEur.textContent = "— (rate unavailable)";
      }
    } else {
      elements.projectMetaFinancialEur.textContent = "—";
    }
  }

  if (elements.projectMetaExchangeRate) {
    if (hasCurrency && currency !== "EUR") {
      const rates = state.exchangeRatesToEUR || {};
      const rate = rates[currency];
      if (rate != null && Number.isFinite(rate)) {
        // Stored rate is EUR per 1 local currency; convert for UI to "1 EUR = X local currency".
        const localPerEur = rate > 0 ? 1 / Number(rate) : NaN;
        if (Number.isFinite(localPerEur)) {
          elements.projectMetaExchangeRate.textContent = `1 EUR = ${Number(localPerEur).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
        } else {
          elements.projectMetaExchangeRate.textContent = "— (rate unavailable)";
        }
      } else {
        elements.projectMetaExchangeRate.textContent = "— (rate unavailable)";
      }
    } else if (hasCurrency && currency === "EUR") {
      elements.projectMetaExchangeRate.textContent = "1 EUR = 1.00 EUR";
    } else {
      elements.projectMetaExchangeRate.textContent = "—";
    }
  }
}

// Boot the app once the DOM is ready (classic script mode)
document.addEventListener("DOMContentLoaded", init);
