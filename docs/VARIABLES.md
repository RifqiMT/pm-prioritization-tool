# Variables Documentation

**Purpose:** Authoritative dictionary of application variables — technical name, friendly name, definition, formula, UI location, and examples.  
**Audience:** Product, engineering, QA, analytics.  
**Last audited:** 2026-06-06  
**Implementation baseline:** `APP_ASSET_VERSION` = `20260606-ui193`

> Privileged cross-profile workspace variables (workspace-wide mode, owner filter, owner metadata) are specified in [GUARDRAILS.md](GUARDRAILS.md) §7 only. This dictionary uses neutral names below.

---

## How to read this document

Each variable includes:

- **Technical name** — key in code or storage  
- **Friendly name** — label for workshops and PRDs  
- **Definition** — what it represents  
- **Formula / logic** — how it is derived, if applicable  
- **App location** — where it appears or is edited  
- **Example** — realistic sample value  

---

## 1. Application state (`state` in `src/app.js`)

Persisted to `localStorage` under `rice_prioritizer_v1` unless noted.

| Technical Name | Friendly Name | Definition | Formula / Logic | App Location | Example |
|----------------|---------------|------------|-----------------|--------------|---------|
| `profiles` | Profile Collection | All portfolio containers and their roadmaps. | Array of profile objects. | Global state | `[{ id: "profile_abc", name: "Growth", roadmaps: [...] }]` |
| `activeProfileId` | Active Profile | ID of portfolio currently selected for workspace views. | String; must match a profile `id`. | Profiles panel + portfolio header | `"profile_abc"` |
| `sortField` | Table Sort Column | Active sort key for table view. | Enum used by `sortRoadmaps`. | Table view | `"riceScore"` |
| `sortDirection` | Sort Direction | Ascending or descending table sort. | `"asc"` \| `"desc"`. | Table view | `"desc"` |
| `roadmapsView` | Active Planning View | Which workspace tab is visible. | `table` \| `board` \| `moscow` \| `map` \| `raci` \| `kano`. | View tabs (six planning views) | `"board"` |
| `raciMatrixDomain` | RACI Perspective | Filters RACI matrix entries by stakeholder domain. | `Business` \| `Tech`; persisted in workspace. | RACI view toolbar | `"Business"` |
| `kanoPortfolioPanel` | KANO Portfolio Panel | Which KANO sub-panel is active. | `positioned` \| `unpositioned`; persisted. | KANO view toolbar | `"positioned"` |
| `tableSortByRice` | Table RICE Sort | When true, table rows sorted by RICE score. | Boolean; persisted. | Table toolbar | `true` |
| `tableGroupBy` | Table Group By | Compact table card grouping key. | See `TABLE_GROUP_BY_OPTIONS` in `constants.js`. | Table compact group bar | `"roadmapStatus"` |
| `scrumBoardSortByRice` | Board RICE Sort | When true, board cards sorted by RICE per column. | Boolean; persisted. | Board toolbar toggle | `true` |
| `scrumBoardVisibleStatuses` | Board Status Columns | Which roadmap statuses appear as Scrum columns. | Subset of `roadmapStatusList`; at least one required. | Board toolbar multi-select | `["Not Started","In Progress","Done"]` |
| `superAdminMode` | Workspace-wide mode flag | When true (and eligibility rules in GUARDRAILS §7), all workspace roadmaps are visible across profiles. | Boolean; persisted in workspace payload | See GUARDRAILS §7; `isSuperAdminModeActive()` | `false` |
| `moscowSortByRice` | MoSCoW RICE Sort | When true, cards in each MoSCoW quadrant sorted by RICE. | Boolean; persisted. | MoSCoW toolbar toggle | `true` |
| `mapMetric` | Map Aggregation Metric | What the choropleth represents. | `roadmaps` \| `rice` \| `riceAvg` \| `financial` \| `financialAvg` | Map metric picker | `"financial"` |
| `exchangeRatesToEUR` | FX Rates to EUR | Map of currency code → EUR multiplier. | `amountEUR = amount × rate`. | FX refresh; table/map EUR | `{ "USD": 0.92, "IDR": 0.000058 }` |
| `exchangeRatesDate` | FX Rates Date | ISO timestamp of last rate fetch. | Set on refresh. | Header FX footnote | `"2026-05-26T10:00:00.000Z"` |
| `exchangeRatesLastSource` | FX Source | Whether rates were manual or auto. | `manual` \| `auto`. | Internal | `"auto"` |

### Session-only (not in `saveState`)

| Technical Name | Friendly Name | Definition | Formula / Logic | App Location | Example |
|----------------|---------------|------------|-----------------|--------------|---------|
| `unlockedProfileIds` | Unlocked Profiles (session) | Set of profile IDs unlocked with password this tab. | Cleared on refresh; stored in `sessionStorage`. | Lock banner, export gate | `Set(["profile_abc"])` |
| `editingRoadmapId` | Editing Roadmap | Roadmap id open in modal for edit. | `null` when creating. | Roadmap modal | `"roadmap_xyz"` |
| `activeTooltipWrap` | Active Tooltip Host | DOM wrapper owning the visible tooltip. | Enforces one tooltip policy. | Table/cards/modal | `HTMLElement` |
| `pendingUnlockAction` | Pending Unlock Action | Unlock intent queued when user triggers view/edit on a locked profile. | Cleared after successful unlock. | Profile unlock gating | `{ type: "edit" \| "view" \| "activate", profileId?: string }` |
| `pendingExportFormat` | Pending Export Format | Export format chosen before verifying protected profiles. | Cleared after export completes. | Export unlock modal | `"json" \| "csv"` |
| `profilesFilterQuery` | Profiles Panel Search Query | Search query for profiles panel (name/team). | Not persisted; resets on refresh. | Profiles panel | `"Growth"` |
| `roadmapSummaryTone` | Summary Tone | Active LLM summary style in roadmap modal. | `professional` \| `simplified`; session-only. | Roadmap modal Summary section | `"professional"` |
| `roadmapSummaryGenerated` | Generated Summary | Last LLM output object (paragraphs + links). | Session-only; cleared on modal close. | `#roadmapSummaryOutput` | `{ paragraph1, paragraph2, paragraph3, links }` |
| `roadmapSummaryGenerating` | Summary In Flight | Whether Groq/Tavily pipeline is running. | Boolean; disables generate button. | Summary status line | `false` |

### BYOK storage (`ByokApiKeys` — not in workspace payload)

| Technical Name | Friendly Name | Definition | Formula / Logic | App Location | Example |
|----------------|---------------|------------|-----------------|--------------|---------|
| `pm_byok_v1` | BYOK Storage Key | Encrypted envelope for provider API keys. | AES-GCM + PBKDF2; never synced to cloud. | `localStorage` | `{ version, groq: {…}, tavily: {…} }` |
| `pm_byok_device_salt_v1` | BYOK Device Salt | Per-browser salt for key derivation. | Random bytes on first use. | `localStorage` | hex string |
| `groq` (provider) | Groq API Key | LLM inference for roadmap summaries. | Validated via `/api/byok/validate-groq`; used client-side against `api.groq.com`. | BYOK modal; header dot | `gsk_…` |
| `tavily` (provider) | Tavily API Key | Web search/extract for summary enrichment. | Validated via `/api/byok/validate-tavily`; used against `api.tavily.com`. | BYOK modal | `tvly-…` |

---

## 2. Profile entity

| Technical Name | Friendly Name | Definition | Formula / Logic | App Location | Example |
|----------------|---------------|------------|-----------------|--------------|---------|
| `id` | Profile ID | Stable unique identifier. | `generateId("profile")`. | Storage, import merge | `"profile_1745..."` |
| `name` | Profile Name | Display name of portfolio. | Required on create. | Profiles panel, header | `"Rifqi Tjahyono"` |
| `team` | Team | Optional organizational label. | Free text. | Profile card, export | `"Growth"` |
| `createdAt` | Created At | Profile creation timestamp. | ISO 8601. | Storage | `"2026-01-15T08:00:00.000Z"` |
| `roadmaps` | Roadmaps | Array of roadmap objects. | Owned by profile. | All views | `[...]` |
| `boardOrder` | Board Order | Per-status ordered roadmap id lists. | Used when RICE sort off. | Board drag-drop | `{ "In Progress": ["p1","p2"] }` |
| `moscowOrder` | MoSCoW Order | Per-quadrant ordered roadmap id lists. | Used when MoSCoW RICE sort off. | MoSCoW drag-drop | `{ "Must Have": ["p1","p2"] }` |
| `passwordSalt` | Password Salt | Salt for PBKDF2 hash. | From `ProfileSecurity.generateSalt()`. | Never shown in UI | `"a1b2c3..."` |
| `passwordHash` | Password Hash | PBKDF2 hash with prefix `v1:`. | Verified on unlock/export. | Never shown | `"v1:9f3a..."` |

---

## 3. Roadmap entity — RICE inputs

| Technical Name | Friendly Name | Definition | Formula / Logic | App Location | Example |
|----------------|---------------|------------|-----------------|--------------|---------|
| `reachValue` | Reach | People/events affected in the planning window. | **R** in RICE; integer ≥ 0. | Roadmap modal, table | `5000` |
| `reachDescription` | Reach Notes | Qualitative reach context (rich text). | Sanitized HTML. | Roadmap modal RICE section | `"<p>Monthly active users</p>"` |
| `impactValue` | Impact | Impact per reach unit. | **I** in RICE; 1–5. | Roadmap modal | `3` |
| `impactDescription` | Impact Notes | Qualitative impact context. | Optional text. | Roadmap modal | `"Revenue per user"` |
| `confidenceValue` | Confidence | Confidence in estimates (%). | **C** in RICE; 0–100. | Roadmap modal | `80` |
| `confidenceDescription` | Confidence Notes | Evidence for confidence. | Optional text. | Roadmap modal | `"Beta survey n=200"` |
| `effortValue` | Effort | Relative implementation cost. | **E** in RICE; 1–5 divisor. | Roadmap modal | `2` |
| `effortDescription` | Effort Notes | Qualitative effort context. | Optional text. | Roadmap modal | `"Two squads, 1 quarter"` |
| `riceScore` | RICE Score | Computed priority score. | See §4.1 | Table, tooltips, board sort | `6000` |

---

## 4. Formulas

### 4.1 RICE score

```
confidenceDecimal = confidenceValue > 1 ? confidenceValue / 100 : confidenceValue
riceScore = (reachValue × impactValue × confidenceDecimal) ÷ effortValue
```

If `effortValue ≤ 0` → score `0`.  
**Implementation:** `src/rice.js` → `calculateRiceScore`.

### 4.2 EUR display (reporting)

```
financialImpactEUR = financialImpactValue × exchangeRatesToEUR[currency]
```

If rate missing, EUR display may be omitted or stale per [GUARDRAILS.md](GUARDRAILS.md).

**Profile currency totals (original-currency breakdown):**
- For each currency total card (non-EUR), the app computes:

```
currencyTotalEUR = currencyTotalOriginal × exchangeRatesToEUR[currency]
```

- If `exchangeRatesToEUR[currency]` is missing or non-finite, the UI shows “EUR conversion unavailable” (no implied precision).

### 4.3 Financial frameworks (summary)

| Framework | Friendly Name | Output |
|-----------|---------------|--------|
| `custom` | Custom amount | User-entered `financialImpactValue` |
| `clv` | Customer lifetime value | Δ net CLV × customers (see `computeFrameworkFinancialImpact`) |
| `nps` | NPS impact | Retention + expansion + referral − cost (basis toggle) |
| `risk` | Risk reduction | Expected loss before − after − mitigation |
| `headcount` | Headcount avoidance | Avoided FTE × annual loaded cost |
| `operational` | Operational savings | Unit cost delta + cycle-time labor savings |

Full input field whitelists: `sanitizeFinancialImpactInputs` in `src/app.js`.

---

## 5. Roadmap entity — metadata & financial

| Technical Name | Friendly Name | Definition | Formula / Logic | App Location | Example |
|----------------|---------------|------------|-----------------|--------------|---------|
| `id` | Roadmap ID | Stable roadmap identifier. | `generateId("roadmap")`. | Modal footer, merge | `"roadmap_1745..."` |
| `title` | Roadmap Title | Short initiative name. | Required. | Table, cards, modal | `"EU GDPR compliance"` |
| `description` | Description | Scope/outcome narrative (rich text). | Sanitized HTML via `RichTextEditor`; plain text in CSV export. | Roadmap modal; card tooltip | `"<p>Enable consent flows…</p>"` |
| `financialImpactFramework` | Financial Framework | Active value model. | Normalized enum. | Modal, table Framework column | `"operational"` |
| `financialImpactInputs` | Framework Inputs | Key-value inputs per framework. | Sanitized on save/switch. | Roadmap modal sections | `{ opAnnualVolume: 10000 }` |
| `financialImpactValue` | Financial Impact | Computed or manual amount. | From framework or custom. | Table, map | `166500` |
| `financialImpactCurrency` | Currency | ISO-like currency code. | Required if value non-zero. | Roadmap modal | `"EUR"` |
| `roadmapStatus` | Roadmap Status | Workflow state. | One of `roadmapStatusList`. | Table, board column | `"In Progress"` |
| `roadmapType` | Roadmap Type | Initiative category. | Team-defined list. | Table Type column | `"Regulatory"` |
| `moscowCategory` | MoSCoW Category | Delivery priority class. | One of `moscowList`. | MoSCoW view | `"Must have"` |
| `tshirtSize` | T-Shirt Size | Rough sizing. | XS–XL. | Table | `"M"` |
| `roadmapPeriod` | Roadmap Period | Planning quarter. | `YYYY-Q[1-4]`. | Filters, table | `"2026-Q2"` |
| `countries` | Countries | Geo tags (normalized names). | Array; drives map. | Roadmap modal, map | `["Germany","France"]` |
| `labels` | Labels | Free-form tags (multi-word allowed). | `normalizeRoadmapLabels`; pipe-separated in CSV; comma/pipe string on import. | Roadmap modal (create/edit/view) | `["Growth bet","Platform"]` |
| `links` | Links | Named hyperlinks. | `{ label, url }[]`; accepts legacy `name`/`href`/`text`; JSON in CSV. | Roadmap modal (create/edit/view) | `[{"label":"PRD","url":"https://example.com/prd"}]` |
| `tasks` | Tasks | Optional checklist items. | `{ name, status }[]`; `normalizeRoadmapTasks`; JSON in CSV `roadmapTasks`. | Roadmap modal Details section | `[{"name":"API spec","status":"In Progress"}]` |
| `raci` | RACI Assignments | Stakeholder roles per roadmap. | `{ responsible, accountable, consulted, informed }[]` each with `{ name, domain }`; `normalizeRoadmapRaci`. | Roadmap modal RACI section; RACI matrix view | `{ "responsible": [{"name":"Alex","domain":"Business"}] }` |
| `kanoFunctionality` | KANO Functionality | How well the feature is delivered (1–5). | Integer 1–5 or null; `normalizeKanoAxisLevel`. | Roadmap modal KANO section; KANO portfolio matrix | `4` |
| `kanoSatisfaction` | KANO Satisfaction | Customer delight impact (1–5). | Integer 1–5 or null; `normalizeKanoAxisLevel`. | Roadmap modal KANO section; KANO portfolio matrix | `5` |
| `createdAt` | Created At | Creation timestamp. | ISO 8601. | Modal footer | `"2026-03-01T..."` |
| `modifiedAt` | Last Modified | Last edit timestamp. | ISO 8601. | Modal footer | `"2026-05-20T..."` |

---

## 6. Filter variables (UI → `applyFilters`)

| Technical Name | Friendly Name | Definition | App Location | Example |
|----------------|---------------|------------|--------------|---------|
| `filterTitle` | Title Filter | Substring match on roadmap title; autocomplete from profile titles. | Filters drawer | `"payment"` |
| `filterType` | Type Filter | Match `roadmapType`. | Filters drawer | `"Platform"` |
| `filterCountries` | Countries Filter | Roadmap must include selected countries. | Filters drawer | `["Indonesia"]` |
| `filterRoadmapPeriod` | Period Filter | Match `roadmapPeriod`. | Filters drawer | `"2026-Q1"` |
| `filterFinancialFramework` | Framework Filter | Match normalized framework. | Advanced filters | `"headcount"` |
| `filterStatus` | Status Filter | Match `roadmapStatus`. | Advanced filters | `"In Progress"` |
| `filterMoscow` | MoSCoW Filter | Match `moscowCategory`. | Advanced filters | `"Should have"` |
| `filterLabel` | Label Search | Substring match on any roadmap `labels` entry; autocomplete from profile labels. | Search filters | `"growth"` |
| `filterLabels` | Labels Filter | `with` = has at least one label; `without` = none; empty = any. Works with **Label** search. | Advanced filters | `"with"` |
| `filterLinks` | Links Filter | `with` = has links; `without` = none; empty = any. | Advanced filters | `"with"` |
| `filterImpact` | Impact Filter | Match `impactValue` (1–5). | Advanced filters | `"3"` |
| `filterEffort` | Effort Filter | Match `effortValue` (1–5). | Advanced filters | `"2"` |
| `filterCurrency` | Currency Filter | Match `financialImpactCurrency`. | Advanced filters | `"EUR"` |
| `filterTshirtSize` | T-Shirt Filter | Match `tshirtSize`. | Advanced filters | `"M"` |
| `filterOwnerProfile` | Owner Profile Filter | Limits results to roadmaps owned by selected profile id. | Advanced filters; GUARDRAILS §7 | Profile uuid |

---

## 7. Constants (`src/constants.js`)

| Technical Name | Friendly Name | Definition | Example |
|----------------|---------------|------------|---------|
| `STORAGE_KEY` | Storage Key | localStorage key for app state. | `"rice_prioritizer_v1"` |
| `roadmapStatusList` | Status Enum | Allowed status values. | 5 statuses |
| `moscowList` | MoSCoW Enum | Stored MoSCoW values (lowercase “have”). | `Must have`, … |
| `moscowDisplayNames` | MoSCoW Display Labels | UI quadrant headers. | `Must Have`, … |
| `TABLE_GROUP_BY_OPTIONS` | Table Group-by Options | Compact card list grouping. | status, MoSCoW, owner, … |
| `COMPACT_LAYOUT_MAX_WIDTH_PX` | Compact Breakpoint | Max width for phone/tablet UI. | `1400` |
| `tshirtSizeList` | T-Shirt Enum | Allowed sizes. | XS–XL |
| `currencyList` | Currency List | Selectable currencies. | EUR, USD, IDR, … |
| `LEGACY_WORKSPACE_FIELDS` | Legacy Workspace Keys | Deprecated workspace JSON keys stripped on load/import/persist. | `["boardHiddenStatuses"]` |
| `WORKSPACE_PERSISTED_STATE_KEYS` | Persisted UI State Keys | Registry of top-level workspace fields saved to `localStorage` and MongoDB. | Listed in `src/constants.js`; used by `serializeStatePayload()` | Storage layer | Includes `roadmapsView`, `raciMatrixDomain`, `kanoPortfolioPanel` |
| `raciMatrixDomain` | RACI Perspective | Active domain filter in RACI view. | `Business` or `Tech`. | RACI matrix toolbar | `"Business"` |
| `kanoPortfolioPanel` | KANO Panel | Active KANO portfolio tab. | `positioned` or `unpositioned`. | KANO view toolbar | `"positioned"` |
| `kanoFunctionalityLevels` | KANO Functionality Scale | Five functionality depth labels (Absent → Full). | Levels 1–5 | Roadmap modal KANO section | Level 4 = Enhanced |
| `kanoSatisfactionLevels` | KANO Satisfaction Scale | Five satisfaction response labels. | Levels 1–5 | Roadmap modal KANO section | Level 5 = Delighted |
| `kanoCategoryLegend` | KANO Category Legend | Attractive / One-dimensional / Must-be / Indifferent / Reverse definitions. | Derived from axis pair | KANO modal + portfolio view | Attractive (A) |
| `countryList` | Country List | Normalized country names for geo. | `"Germany"` |
| `COUNTRY_OPTION_EU` | EU Region Option | Pseudo-value `EU` in target-country selects; expands to all EU members on selection. | `"EU"` |
| `EU_MEMBER_COUNTRIES` | EU Member States | 27 canonical `countryList` names filled when `EU` is chosen. | `["Germany", "France", …]` |
| `CURRENCY_SYMBOLS` | Currency Symbol Map | Display symbol for each supported currency code. | `{ EUR: "€", GBP: "£", IDR: "Rp", ... }` |

---

## 8. Variable relationship charts

### 8.1 RICE and display

```mermaid
flowchart TD
  subgraph inputs [Roadmap RICE Inputs]
    R[reachValue]
    I[impactValue]
    C[confidenceValue]
    E[effortValue]
  end
  Cdec[confidenceDecimal]
  C --> Cdec
  R --> SCORE[riceScore]
  I --> SCORE
  Cdec --> SCORE
  E --> SCORE
  SCORE --> TBL[Table RICE Column]
  SCORE --> TIP[RICE Tooltip]
  SCORE --> BRD[Board / MoSCoW Sort]
```

### 8.2 Financial framework pipeline

```mermaid
flowchart LR
  SEL[financialImpactFramework] --> SAN[sanitizeFinancialImpactInputs]
  IN[financialImpactInputs] --> SAN
  SAN --> COMP[computeFrameworkFinancialImpact]
  CUSTOM[custom amount] --> COMP
  COMP --> FIV[financialImpactValue]
  FIV --> FX[× exchangeRatesToEUR]
  FX --> EUR[EUR display / Map metric]
  SEL --> COL[Table Framework Icon]
  SEL --> FLT[Advanced Framework Filter]
```

### 8.8 Profile currency totals (original currency → EUR)

```mermaid
flowchart TD
  P[profile.roadmaps] --> SUM[buildProfileViewCurrencyData totals per currency]
  SUM --> CARD[Currency total cards (original currency)]
  SUM -->|non-EUR| ENSURE[ExchangeRates.ensure]
  ENSURE --> CONV[convertToEUR(total, currency)]
  CONV --> EUR2[EUR equivalent display]
  CONV -->|missing rate| FALLBACK["EUR conversion unavailable"]
```

### 8.3 Profile lock and export

```mermaid
flowchart TD
  PH[passwordHash present] --> LOCKED[Profile Locked]
  LOCKED --> BANNER[Locked Banner]
  LOCKED --> NOVIEW[Views Hidden]
  PWD[Correct Password] --> SESSION[unlockedProfileIds]
  SESSION --> VIEWS[Views Enabled]
  SESSION --> EXPORT[getExportableProfiles]
  WRONG[Wrong / Missing Password] --> OMIT[Excluded from Export File]
```

### 8.4 Import merge

```mermaid
flowchart LR
  FILE[JSON / CSV File] --> PARSE[Parse Rows]
  PARSE --> MERGE[mergeImportedProfiles]
  MERGE --> ID{Matching id?}
  ID -->|Yes| UPDATE[Update Entity]
  ID -->|No| INSERT[Add Entity]
  UPDATE --> LS[(localStorage)]
  INSERT --> LS
```

### 8.5 Map aggregation metric selection

```mermaid
flowchart TD
  MM[mapMetric (persisted)] --> RENDER[renderRoadmapsMap]
  RENDER -->|roadmaps| COUNT[countByCode]
  RENDER -->|rice| RICE[riceByCode]
  RENDER -->|financial| FIN[financial EUR totals per code]
  RENDER --> LEGEND[map legend text/scale]
```

### 8.6 Compact layout classes

```mermaid
flowchart TD
  VW[viewport width] --> INIT[initCompactLayoutClass]
  INIT -->|≤1400px| COMPACT[html.is-compact-layout + is-phone-layout]
  INIT -->|>1400px| DESK[html.is-desktop-layout]
  COMPACT --> MCSS[moscow-compact.css]
  COMPACT --> BCSS[board-compact.css]
  COMPACT --> TCSS[table-compact.css]
  COMPACT --> FCCSS[fullscreen-compact.css]
  COMPACT --> CM[compact-modern.css]
  COMPACT --> NAV[syncMoscowCompactNav + IntersectionObserver]
```

### 8.7 Filter pipeline

```mermaid
flowchart TD
  BASE[getPortfolioRoadmapsBaseList] --> TITLE[filterTitle substring]
  TITLE --> LABEL[filterLabel substring]
  LABEL --> QUICK[type + countries + period]
  QUICK --> ADV[impact effort currency framework status tshirt moscow]
  ADV --> LINKS[filterLinks with/without]
  LINKS --> LBL[filterLabels with/without]
  LBL --> OWNER[filterOwnerProfile if workspace-wide mode]
  OWNER --> VIEW[render active view]
```

### 8.8 Privileged workspace mode (see GUARDRAILS §7)

```mermaid
flowchart TD
  TRUST[Trust profile active + unlocked] --> TOG[Workspace-wide toggle on]
  TOG --> FLAG[state.superAdminMode true]
  FLAG --> META[attach ownerProfileId + ownerProfileName on roadmaps]
  META --> UI[Profile column owner strips owner filter group-by]
  FLAG --> BULK[Bulk duplicate / move table selection]
  FLAG --> OFF[Toggle off restores single-profile scope]
```

### 8.9 Labels and links persistence (cloud)

```mermaid
flowchart TD
  EDIT[User saves roadmap modal] --> NORM[normalizeRoadmapLabels + normalizeRoadmapLinks]
  NORM --> MEM[state.profiles in memory]
  MEM --> SER[serializeRoadmapForStorage on saveState]
  SER --> CACHE[localStorage cache]
  SER --> FLUSH[saveState flush true → immediate PUT /api/state]
  FLUSH --> API[api/_lib/roadmap-metadata normalize]
  API --> MONGO[(MongoDB workspaces)]
  PULL[Background pullFromCloudIfNewer] -->|local_pending| SKIP[Skip overwrite]
```

### 8.10 Rich-text description fields

```mermaid
flowchart LR
  RTE[RichTextEditor.mountAllFromDom] --> FIELDS[roadmapDescription reach impact confidence effort]
  FIELDS --> HTML[sanitized HTML in roadmap object]
  HTML --> VIEW[View modal: toolbar hidden]
  HTML --> CSV[CSV export: strip HTML to plain text]
```

### 8.11 RACI matrix data flow

```mermaid
flowchart TD
  MODAL[Roadmap modal RACI section] --> RACI[roadmap.raci object]
  RACI --> NORM[normalizeRoadmapRaci on save]
  NORM --> STORE[profile.roadmaps in workspace payload]
  STORE --> FILTER[applyFilters → filtered roadmaps]
  FILTER --> DOMAIN[raciMatrixDomain Business or Tech]
  DOMAIN --> RENDER[renderRaciMatrix]
  RENDER --> DESK[Desktop: 5-column matrix]
  RENDER --> COMP[Compact: card per roadmap]
```

### 8.12 KANO portfolio positioning

```mermaid
flowchart TD
  MODAL[Roadmap modal KANO section] --> AXES[kanoFunctionality + kanoSatisfaction 1-5]
  AXES --> CAT[kanoCategoryLegend → Attractive / One-dimensional / Must-be / Indifferent / Reverse]
  CAT --> PANEL{kanoPortfolioPanel}
  PANEL -->|positioned| MATRIX[portfolioKanoMatrix + category list]
  PANEL -->|unpositioned| PENDING[portfolioKanoUnpositionedList]
  MATRIX --> DND[Drag tile between cells on desktop]
  DND --> SAVE[saveState → update axis scores]
```

### 8.13 BYOK and LLM summary flow

```mermaid
flowchart TD
  HDR[Header API keys button] --> MODAL[byokApiKeysModal]
  MODAL --> ENC[Encrypt + localStorage pm_byok_v1]
  MODAL --> VAL[POST /api/byok/validate-groq or tavily]
  GEN[Generate LLM analysis] --> KEYS[ByokApiKeys.getStoredKey groq + tavily]
  KEYS --> TAV[Tavily extract links + search]
  TAV --> GROQ[Groq chat completions llama-3.1-8b-instant]
  GROQ --> OUT[roadmapSummaryGenerated session-only]
  OUT --> UI[#roadmapSummaryOutput 3 paragraphs]
```

### 8.14 Legacy Project → Roadmap migration (load only)

```mermaid
flowchart LR
  RAW[MongoDB or import JSON] --> LEG{Legacy keys?}
  LEG -->|profile.projects| M1[→ profile.roadmaps]
  LEG -->|projectsView| M2[→ roadmapsView]
  LEG -->|projectType Status Period| M3[→ roadmapType Status Period]
  M1 --> NORM[normalizeLoadedProfile + normalizeLoadedRoadmap]
  M2 --> NORM
  M3 --> NORM
  NORM --> SAVE[serialize writes only roadmaps canonical keys]
```

---

## 9. Layout, DOM, and build constants

| Technical Name | Friendly Name | Definition | Formula / Logic | App Location | Example |
|----------------|---------------|------------|-----------------|--------------|---------|
| `APP_ASSET_VERSION` | Asset Cache Version | Query-string cache buster for CSS/JS in `index.html`. | Bump on UI releases. | `src/constants.js`, `index.html` | `"20260606-ui193"` |
| `COMPACT_LAYOUT_MAX_WIDTH_PX` | Compact Breakpoint (px) | Max viewport width for phone/tablet UI. | Constant in `constants.js`. | `src/constants.js` | `1400` |
| `is-compact-layout` | Compact Layout Class | Viewport ≤1400px; enables compact CSS. | Set on `<html>` by `initCompactLayoutClass()`. | Global layout | class present |
| `is-phone-layout` | Phone Layout Class | Same threshold as compact (unified phone UI). | Set together with compact class. | Global layout | class present |
| `is-desktop-layout` | Desktop Layout Class | Viewport >1400px. | Mutually exclusive with compact. | Global layout | class present |
| `moscowCompactNav` | MoSCoW Compact Navigator | 2×2 pill bar to jump between quadrants on compact. | `syncMoscowCompactNav()` updates active pill. | MoSCoW view (compact) | DOM `#moscowCompactNav` |
| `portfolioSelectionBar` | Portfolio Selection Bar | Floating bar for bulk delete when rows selected on compact table. | Shown when `selectedRoadmapIds` non-empty. | Table view (compact) | DOM element |
| `view-in-fullscreen-host` | Fullscreen Host Class | Body class when a view is fullscreen. | `fullscreen.js` + `fullscreen-compact.css`. | Fullscreen | class on `body` |
| `PRODUCTION_APP_ORIGIN` | Production URL | Canonical deployed origin for links/docs. | Constant string. | `src/constants.js` | `https://pm-prioritization-tool-six.vercel.app` |

### Cloud storage metadata (`_storageMeta` on workspace)

| Technical Name | Friendly Name | Definition | Formula / Logic | App Location | Example |
|----------------|---------------|------------|-----------------|--------------|---------|
| `_storageMeta.updatedAt` | Workspace Updated At | ISO timestamp for merge conflict resolution. | Newer local vs remote wins on load. | `storage.js` | `"2026-05-26T12:00:00.000Z"` |
| `_storageMeta.source` | Last Save Source | Whether last write was local or cloud. | Set on save paths. | Cloud modal / debug | `"cloud"` |

---

## 10. Related documents

- [PRD.md](PRD.md) — requirements  
- [BUSINESS_GUIDELINES.md](BUSINESS_GUIDELINES.md) — rubrics  
- [ARCHITECTURE.md](ARCHITECTURE.md) — data flow  
