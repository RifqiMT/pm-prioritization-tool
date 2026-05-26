# Enterprise Traceability Matrix

**Purpose:** Map PRD requirements to concrete implementation evidence and verification steps.  
**Standard:** Requirement IDs must remain synchronized with `docs/PRD.md`.

---

## Legend
- **Code Evidence:** Primary file(s) and the key function(s)/handlers that implement the requirement.
- **Verification:** Manual QA checks and/or deterministic UI checks.

---

| Requirement ID | Requirement Summary | Code Evidence | Verification |
|---|---|---|---|
| FR-1.1 | Create profile (name, optional team) | `index.html` profile create form; `src/app.js` profile creation handlers; `persist` via `saveState()` | Create profile with/without team; profile appears in list and is usable for project creation |
| FR-1.2 | Edit profile (name/team/password) | `index.html` edit modal markup; `src/app.js` profile edit modal open/save; `resetProfileEditPasswordFieldTypes()` | Edit name/team; set/change password; verify persisted after refresh |
| FR-1.3 | Delete profile (password if protected) | Delete modal in `index.html`; `src/app.js` protected delete guard + password verification; `markProfileLocked()` | Attempt delete protected profile without password (fails); with correct password (succeeds) |
| FR-1.4 | Activate profile | Profile selection in `index.html`; `src/app.js` active profile updates + render refresh | Selecting profile changes projects shown in all views |
| FR-1.5 | Search profiles | Profiles panel search UI; `src/app.js` profile filter/search logic | Search narrows profiles by name/team; UI remains stable on narrow screens |
| FR-1.6 | Optional password on create | `src/app.js` create + password hashing via `src/modules/profile-security.js` | Create with password; profile is locked until unlocked; hash stored, plaintext not persisted |
| FR-2.1 | CRUD projects (modal create/edit) | `index.html` project modal; `src/app.js` create/edit handlers; `renderProjects()` | Create/edit/view; project fields persist; modal renders correct defaults |
| FR-2.2 | RICE input validation | `src/rice.js` (`validateProjectInput`, `calculateRiceScore`); `src/app.js` save/validation paths | Invalid boundaries (negative reach, invalid effort) block save; valid inputs compute score |
| FR-2.3 | Metadata saved (type/status/MoSCoW/period/countries/t-shirt) | `index.html` project fields; `src/app.js` project normalization | Saved fields appear across table/cards/board/MoSCoW/map and filter correctly |
| FR-2.4 | Bulk delete (table) | `index.html` table actions; `src/app.js` bulk delete + selection guard | Select rows; delete prompts confirmation; cancels safely; state updates without partial deletes |
| FR-2.5 | Project ID in modal footer | `index.html` project modal footer metadata blocks; `src/app.js` metadata setters | Project ID is visible and stable across edits and exports |
| FR-3.1 | RICE formula `(R × I × C) ÷ E` | `src/rice.js` (`calculateRiceScore`) | Known inputs produce expected score; no NaN/Infinity |
| FR-3.2 | Reach boundary | `src/rice.js` validation | Reach < 0 is rejected with validation message |
| FR-3.3 | Impact/Effort boundaries (1–5) | `src/rice.js` validation | Impact/Effort out of range are rejected |
| FR-3.4 | Confidence 0–100 normalization | `src/rice.js` normalization | Confidence > 1 treated as percent; 0–1 treated as decimal where applicable |
| FR-3.5 | RICE tooltip explainability | `src/app.js` tooltip render lines for RICE | Tooltip contains abbreviation expansions, formula, and calculation line |
| FR-4.1 | Financial framework: custom | `src/app.js` sanitize/compute for framework switching; project inputs | Selecting `custom` shows correct inputs; computed impact updates |
| FR-4.2 | Financial framework: clv | `src/app.js` `computeFrameworkFinancialImpact` + sanitizers | CLV-specific math yields non-null computed values for valid inputs |
| FR-4.3 | Financial framework: nps | `src/app.js` compute/sanitize for `nps` | NPS-specific fields update consistent impact and currency behavior |
| FR-4.4 | Financial framework: risk | `src/app.js` compute/sanitize for `risk` | Risk inputs yield expected computed impact logic |
| FR-4.5 | Financial framework: headcount | `src/app.js` compute/sanitize for `headcount` | Headcount inputs compute expected impact |
| FR-4.6 | Financial framework: operational | `src/app.js` compute/sanitize for `operational` | Operational inputs compute impact correctly |
| FR-4.7 | Switching framework clears non-relevant inputs | `src/app.js` framework switch reset/sanitization | Switching framework clears prior framework-specific fields |
| FR-4.8 | Table Framework column + filter consistency | `index.html` table headers/filters; `src/app.js` framework icon + filter mapping | Framework icon/tooltip exists; filtering by Framework matches project records |
| FR-5.1 | Table view sorting/filtering | `index.html` table view; `src/app.js` `sortProjects`, `applyFilters` | Sorting and filtering match expected results across multiple fields |
| FR-5.2 | Board view status columns + DnD + status filter pills | `index.html` board containers; `src/app.js` `renderScrumBoard`, `toggleBoardStatusColumn`, `renderBoardStatusLegend` | DnD updates status; status pills hide/show columns; active state via `aria-pressed` |
| FR-5.3 | MoSCoW view quadrant grid | `index.html` MOSCOW containers; `src/app.js` MoSCoW rendering | Projects appear in correct quadrant; optional MoSCoW RICE sort works |
| FR-5.4 | Map view aggregation + metric switching | `index.html` map container; `src/app.js` `renderProjectsMap` and map metric pills wiring | Metric switch updates map values and legend; error states are graceful |
| FR-5.5 | Fullscreen mode across views | `src/modules/fullscreen.js`; `src/app.js` fullscreen toggle handlers | Fullscreen toggles correctly for table/board/MoSCoW/map |
| FR-5.6 | Locked profile blocks project data in all views | `src/app.js` `getUnlockedActiveProfile()`, `updateProfileLockedBanner()`, view render guards | Locked profile hides project lists/board/MoSCoW/map; banner shown; no leakage |
| FR-6 | Filters (quick + advanced) | Filters UI in `index.html`; `src/app.js` `applyFilters` | Quick and advanced filters restrict results; active filter pill matches state |
| FR-7 | Exchange rates refresh and EUR normalization | `src/modules/exchange-rates.js`; `src/app.js` integration for cached rates and EUR display | Refresh updates rates; EUR totals reflect updated rates where possible |
| FR-8.1 | Export JSON | `src/app.js` export handlers + `sanitizeProfilesForExport()` + `getExportableProfiles()` | JSON export downloads; includes only allowed profiles after password gate |
| FR-8.2 | Export CSV | `src/app.js` CSV export logic; project row generation | CSV has correct header and one-row-per-project; protected omission rules applied |
| FR-8.3 | Export password gate | `src/app.js` export unlock modal + verification (`getLockedProfilesForExport`, `verifyLockedProfilesForExport`) and `executeExport` | Wrong/missing passwords omit protected profiles from export file |
| FR-8.4 | Import JSON merge | `src/app.js` `handleImportJsonFile()` + `mergeImportedProfiles()` | Import JSON updates by ID; no duplicate corruption |
| FR-8.5 | Import CSV merge | `src/app.js` `handleImportCsvFile()` + `mergeImportedProfiles()` | CSV import merges project rows correctly and safely |
| FR-8.6 | UI parity: import/export modals | `index.html` modal markup; shared `css/export-modals-modern.css` | Import/export dialogs share design system; consistent responsive behavior |
| FR-9.1 | Single visible tooltip app-wide | `src/app.js` tooltip subsystem (`activeTooltipWrap`, `hideAllTooltipsExcept`) | Open one tooltip hides others |
| FR-9.2 | Standardized tooltip for modal variable fields | `src/app.js` `ensureProjectFormFieldTooltips` and fallback injection | Every input/select/textarea in project modal has tooltip guidance |
| FR-9.3 | Responsive header/profiles/portfolio | `css/*-modern.css` + layout breakpoints | Validate mobile/tablet layouts at representative widths |
| FR-9.4 | Password show/hide consistent everywhere | `src/app.js` `bindProfilePasswordToggles()` + shared CSS rules | Eye toggle works on profile modals and export unlock modal; no UI jitter |
| FR-9.5 | Delete confirmations guarded | Delete flows in `src/app.js` with modal prompts | Destructive actions require explicit confirmation |

---

## Traceability Governance

- Update/add matrix rows when behavior changes (code is source of truth).
- Keep requirement IDs synchronized with `docs/PRD.md`.
- Do not declare release readiness without a verification pass against this matrix.

