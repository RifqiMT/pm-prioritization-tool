/**
 * Product Management Prioritization Tool - Application constants
 * Central place for storage key, currency list, country list, and ISO country codes.
 * Used by the app for dropdowns, display (e.g. country codes in project list), and persistence.
 *
 * NOTE: This file is loaded as a classic <script>, not as an ES module.
 * All top-level consts become globals that the rest of the app can read.
 */
const STORAGE_KEY = "rice_prioritizer_v1";

const projectStatusList = [
  "Not Started",
  "In Progress",
  "On Hold",
  "Done",
  "Cancelled"
];

/**
 * Project status display: icon and tooltip for the table column (same style as project type).
 * Keys must match projectStatusList values.
 */
const projectStatusIcons = {
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
 * Used in the MOSCOW view and project metadata.
 */
const moscowList = [
  "Must have",
  "Should have",
  "Could have",
  "Won't have"
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

/**
 * T-shirt size tooltips for the table column (same style as project type/status).
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
 * Project type display: icon (SVG string) and tooltip for the table column.
 * Keys must match the project type values used in the app.
 * tooltipTitle: short label; tooltipBody: brief, human-friendly description (use \n for line breaks).
 */
const projectTypeIcons = {
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
  "NZD", "SEK", "NOK", "DKK", "PLN", "CZK", "HUF", "RUB", "TRY", "BRL",
  "MXN", "ARS", "CLP", "COP", "PEN", "ZAR", "INR", "IDR", "MYR", "THB",
  "PHP", "VND", "KRW", "TWD", "SAR", "AED", "QAR", "KWD", "BHD", "ILS",
  "EGP", "NGN", "KES", "GHS", "BDT", "PKR", "LKR", "RON", "HRK", "BGN"
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
