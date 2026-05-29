# Technical Guidelines

Engineering standards for the Product Management Prioritization Tool codebase.

| Field | Value |
|-------|-------|
| **Last updated** | 2026-05-28 |
| **APP_ASSET_VERSION** | `20260528-ui152` |
| **COMPACT_LAYOUT_MAX_WIDTH_PX** | `1400` |

---

## 1. Stack summary

| Layer | Technology |
|-------|------------|
| UI | HTML5, CSS3, vanilla JavaScript (no framework) |
| Map | Leaflet 1.9.4 (CDN) |
| Crypto | Web Crypto API (PBKDF2-SHA256) |
| Persistence | `localStorage` (workspace), `sessionStorage` (unlock session) |
| Cloud | Vercel serverless `api/state.js` + MongoDB (optional) |
| Hosting | Static (Vercel); `vercel.json` CSP and caching |
| Build | None — files served as-is |

---

## 2. Script load order

Defined in `index.html` (order matters — globals, not ES modules):

1. `src/constants.js` — includes `APP_ASSET_VERSION`, `COMPACT_LAYOUT_MAX_WIDTH_PX`, enums, `TABLE_GROUP_BY_OPTIONS`, `moscowDisplayNames`
2. `src/utils.js`
3. `src/modules/profile-security.js`
4. `src/rice.js`
5. `src/modules/exchange-rates.js`
6. `src/modules/fullscreen.js`
7. `src/modules/overlay-manager.js`
8. `src/modules/storage.js`
9. `src/app.js` — defines `init()` and runs on `DOMContentLoaded`

All shared symbols are **global functions and constants**. Do not introduce ES module imports without a planned migration.

---

## 3. CSS architecture

### 3.1 Load order

Later files win for equal specificity (all query `?v=APP_ASSET_VERSION`):

| # | File | Purpose |
|---|------|---------|
| 1 | `main.css` | Base tokens, global buttons, legacy modals |
| 2 | `workspace-modern.css` | Workspace shell |
| 3 | `header-modern.css` | App header |
| 4 | `profiles-modern.css` | Profiles + compact bottom sheet |
| 5 | `portfolio-modern.css` | Portfolio, filters, autocomplete |
| 6 | `profile-modals-modern.css` | Profile modals |
| 7 | `export-modals-modern.css` | Import/export modals |
| 8 | `view-toolbars-modern.css` | View toolbars |
| 9 | `compact-modern.css` | Compact chrome (≤1400px) |
| 10 | `moscow-compact.css` | MoSCoW compact |
| 11 | `board-compact.css` | Board compact |
| 12 | `table-compact.css` | Table compact toolbar |
| 13 | `project-actions-modern.css` | Actions |
| 14 | `fullscreen-modern.css` | Fullscreen |
| 15 | `fullscreen-compact.css` | Fullscreen compact |
| 16 | `app-footer.css` | Site footer |
| 17 | `views-density.css` | Density |
| 18 | `layout-flow.css` | Flat flow ≤1400px |
| 19 | `portfolio-cards-compact.css` | Board/MoSCoW cards |
| 20 | `table-rows-modern.css` | Table rows |
| 21 | `table-revamp-modern.css` | Semantic `projects-table-col--*` widths |
| 22 | `table-compact-cards.css` | Table card list ≤1400px |
| 23 | `super-admin-modern.css` | Workspace-wide mode UI ([GUARDRAILS.md §7](GUARDRAILS.md)) |

### 3.2 Compact layout

`initCompactLayoutClass()` in `src/app.js`:

- Reads `COMPACT_LAYOUT_MAX_WIDTH_PX` (default **1400**).
- At `window.matchMedia('(max-width: Npx)')`: sets `html.is-compact-layout` + `html.is-phone-layout`.
- Above breakpoint: `html.is-desktop-layout`.
- Calls `syncProjectModalFooterMetaDetails()` on transition so `<details>` open state matches layout.

`src/modules/fullscreen.js` builds the same max-width media query from the constant.

**Rule:** Do not add tablet-only hybrid breakpoints between phone and 1400px. Compact selectors use `html.is-compact-layout` or `@media (max-width: 1400px)` consistently.

### 3.3 Authoring rules

- Prefer new UI in `*-modern.css` or `*-compact.css` with scoped selectors.
- Override `main.css` `!important` globals explicitly when needed.
- Bump `APP_ASSET_VERSION` in `constants.js` and every `index.html` stylesheet/script query when shipping CSS/JS.

---

## 4. Key constants (`src/constants.js`)

| Constant | Role |
|----------|------|
| `STORAGE_KEY` | `localStorage` key (`rice_prioritizer_v1`) |
| `APP_ASSET_VERSION` | Cache buster (`20260528-ui152`) |
| `COMPACT_LAYOUT_MAX_WIDTH_PX` | `1400` — single compact breakpoint |
| `moscowList` | Stored MoSCoW values |
| `moscowDisplayNames` | UI labels (Must Have, …) |
| `TABLE_GROUP_BY_OPTIONS` | Compact table group-by ids + labels |
| `WORKSPACE_TRUST_PROFILE_LABEL` | Internal trust profile token — do not log or document in VARIABLES |
| `PRODUCTION_APP_ORIGIN` | Canonical deploy URL |

Privileged workspace mode flags and helpers: see [GUARDRAILS.md §7](GUARDRAILS.md); use `isWorkspaceWideModeActive()` / `html.is-workspace-wide-mode` in code — do not duplicate policy in product docs.

---

## 5. State management

Central object: `state` in `src/app.js`.

Persisted via `saveState()` → `AppStorage` → `localStorage` + optional cloud PUT.

| Field | Persisted | Notes |
|-------|-----------|-------|
| `profiles` | Yes | Includes `passwordSalt` / `passwordHash` when protected |
| `activeProfileId` | Yes | |
| `sortField`, `sortDirection` | Yes | |
| `projectsView` | Yes | `table\|board\|moscow\|map` |
| `tableGroupBy` | Yes | Compact card grouping |
| `scrumBoardSortByRice`, `moscowSortByRice` | Yes | |
| `mapMetric` | Yes | |
| `exchangeRatesToEUR`, `exchangeRatesDate`, `exchangeRatesLastSource` | Yes | |
| `workspaceWideMode` (or equivalent) | Yes | See GUARDRAILS §7 |

**Not persisted:** `unlockedProfileIds` (session only, `sessionStorage`).

**Legacy field migration:** `stripLegacyWorkspaceFields()` in `utils.js` on load, cloud merge, import, and before persist.

---

## 6. Modules (`src/modules/`)

| Module | Global | Responsibility |
|--------|--------|----------------|
| `profile-security.js` | `ProfileSecurity` | PBKDF2 hash/verify, password pair validation |
| `exchange-rates.js` | FX helpers | Fetch/cache rates to EUR |
| `fullscreen.js` | `Fullscreen` | Fullscreen toggle, view switch while fullscreen |
| `overlay-manager.js` | Overlay coordination | One modal/sheet at a time |
| `storage.js` | `AppStorage` | Load/save, cloud sync debounce, backend detection |

---

## 7. Filter implementation notes

| Control | IDs | Logic surface |
|---------|-----|---------------|
| Title + autocomplete | `filterTitle`, `filterTitleListbox` | `initFilterAutocompletes`, `applyFilters` |
| Label + autocomplete | `filterLabel`, `filterLabelListbox` | same |
| Labels any/with/without | `filterLabels` | `filterLabels.value` in `applyFilters` |
| Links any/with/without | `filterLinks` | `filterLinks.value` in `applyFilters` |

Active filter pill text includes human labels for labels/links constraints.

---

## 8. Table rendering

- **Desktop:** `renderProjectsTable` — semantic classes `projects-table-col--*`; optional owner column when workspace-wide mode active.
- **Compact:** card list in `table-compact-cards.css`; `initTableGroupByControls()` populates `#tableGroupBySelect` from `TABLE_GROUP_BY_OPTIONS`.
- **Group summary:** `#tableGroupBySummary` (`aria-live="polite"`).

---

## 9. MoSCoW display

- Use `getMoscowDisplayName(category)` for headers and compact nav — not raw `moscowList` strings in customer-facing chrome.
- Compact nav: `renderMoscowCompactNav`, `syncMoscowCompactNav`, `IntersectionObserver` on `#moscowBoardContainer`.

---

## 10. Security module

`ProfileSecurity`:

- `hashProfilePassword`, `verifyProfilePassword`
- `validatePasswordPair`, `generateSalt`
- Never store plaintext passwords

Export gate: `getExportableProfiles()` — only unprotected or session-unlocked profiles.

---

## 11. Financial framework pipeline

1. `normalizeFinancialFramework(val)`
2. `sanitizeFinancialImpactInputs(framework, inputs)`
3. `computeFrameworkFinancialImpact(framework, inputs, customAmount)`
4. On framework switch in modal, inputs reset to prevent cross-framework leakage

---

## 12. Rendering conventions

- **Single render entry:** `renderProjects()` refreshes table + active view.
- **Locked profiles:** `getUnlockedActiveProfile()` for project surfaces unless workspace-wide mode applies (§7).
- **Tooltips:** `hideAllTooltipsExcept`, `activeTooltipWrap` — one visible tooltip.
- **IDs:** `generateId(prefix)` from `utils.js`.

---

## 13. Import / export

| Format | Handler | Merge |
|--------|---------|-------|
| JSON | `handleImportJsonFile` | `mergeImportedProfiles` by profile/project id |
| CSV | `handleImportCsvFile` | Row-based project merge |

Export: `getExportableProfiles()` → `sanitizeProfilesForExport()` → download.

---

## 14. Error handling

- User-facing: `showToast`, `window.alert` for import failures, inline/modal errors for unlock
- Console: `console.error` with context; never log passwords or `WORKSPACE_TRUST_PROFILE_LABEL`
- Validation: `validateProjectInput` in `rice.js` before save

---

## 15. Testing expectations (manual)

Minimum smoke path before release:

1. Create profile (with and without password)
2. CRUD project with each financial framework
3. All four views + fullscreen at **375px, 768px, 1400px, 1600px**
4. Title/label autocomplete; labels/links filters
5. Table group-by on compact card list
6. MoSCoW display names and compact nav pills
7. Footer links (LinkedIn, website, GitHub, article)
8. Board card actions on one row
9. Export JSON/CSV with locked profile (verify omission)
10. Import merge JSON
11. Vercel smoke: map tiles, exchange rate refresh, cloud save/load

---

## 16. Performance

- Full re-render on state change is acceptable at typical portfolio sizes.
- Map: avoid redundant `renderProjectsMap` calls.
- Target: no perceptible lag &lt; 500 projects per profile on modern laptop; p95 filter/sort ≤ 300ms (see [METRICS_AND_OKRS.md](METRICS_AND_OKRS.md)).

---

## 17. Dependencies

- **No npm runtime dependencies** for the app (`package.json` dev script only).
- CDN: Leaflet, Google Fonts (Inter).

When adding CDN resources, update `vercel.json` CSP `connect-src` / `img-src`.
