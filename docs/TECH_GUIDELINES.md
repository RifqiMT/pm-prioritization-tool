# Technical Guidelines

Engineering standards for the Product Management Prioritization Tool codebase.

| Field | Value |
|-------|-------|
| **Last updated** | 2026-07-10 |
| **APP_ASSET_VERSION** | `20260710-ui201` |
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
| Build | `npm run sync:assets` prefixes `index.html` `?v=` tags from `APP_ASSET_VERSION`; runs before `npm run build` |

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
8. `src/modules/workspace-merge.js` — `WorkspaceMerge` global (concurrent cloud merge + tombstones); **must load before** `storage.js`
9. `src/modules/storage.js` — `AppStorage` global
10. `src/dev-seed-workspace.js` — localhost sample data (gated in `app.js`)
11. `src/modules/description-format.js`
12. `src/modules/rich-text-editor.js`
13. `src/modules/board-drag.js`
14. `src/modules/board-card-interaction.js`
15. `src/modules/byok-api-keys.js` — `ByokApiKeys` global
16. `src/modules/roadmap-llm-summary.js` — `RoadmapLlmSummary` global
17. `src/modules/roadmap-5why-framework.js` — `RoadmapFiveWhyFramework` global
18. `src/modules/roadmap-periods.js` — `RoadmapPeriods` global (multi-quarter periods)
19. `src/modules/incomplete-optional-fields.js` — `IncompleteOptionalFields` global (optional-field completeness filter)
20. `src/modules/gantt-view.js` — `GanttView` global (Gantt timeline)
21. `src/modules/export-payload.js` — `ExportPayload` global (JSON/CSV export builders)
22. `src/modules/share-link.js` — `ShareLink` global (URL hash deep links)
23. `src/app.js` — defines `init()` and runs on `DOMContentLoaded`

All shared symbols are **global functions and constants**. Do not introduce ES module imports without a planned migration.

---

## 3. CSS architecture

### 3.1 Load order

Later files win for equal specificity. Each stylesheet in `index.html` uses a **per-asset** `?v=` query string (often `APP_ASSET_VERSION` plus a feature tag, e.g. `20260629-table-actions-unified-v1`). Bump `APP_ASSET_VERSION` in `constants.js` on major releases; bump individual asset tags when shipping that file only.

| # | File | Purpose |
|---|------|---------|
| 1 | `main.css` | Base tokens, global buttons, legacy modals |
| 2 | `date-inputs-modern.css` | Date input styling (deadline, Gantt-adjacent fields) |
| 3 | `workspace-modern.css` | Workspace shell |
| 3 | `header-modern.css` | App header |
| 4 | `profiles-modern.css` | Profiles + compact bottom sheet |
| 5 | `portfolio-modern.css` | Portfolio command bar, filters trigger |
| 6 | `profile-modals-modern.css` | Profile modals |
| 7 | `export-modals-modern.css` | Import/export modals |
| 8 | `byok-api-keys.css` | BYOK API keys modal |
| 9 | `view-toolbars-modern.css` | View toolbars (seven views) |
| 10 | `compact-modern.css` | Compact chrome (≤1400px) |
| 11 | `moscow-compact.css` | MoSCoW compact |
| 12 | `board-compact.css` | Board compact |
| 13 | `table-compact.css` | Table compact toolbar |
| 14 | `roadmap-actions-modern.css` | Card/table action buttons |
| 15 | `fullscreen-modern.css` | Fullscreen host |
| 16 | `fullscreen-compact.css` | Fullscreen + compact |
| 17 | `app-footer.css` | Site footer |
| 18 | `views-density.css` | Density helpers |
| 19 | `layout-flow.css` | Flat dividers (compact) |
| 20 | `portfolio-cards-compact.css` | Board/MoSCoW card shells |
| 21 | `table-rows-modern.css` | Desktop table rows |
| 22 | `table-revamp-modern.css` | Semantic column layout |
| 23 | `table-compact-cards.css` | Compact table card list |
| 24 | `super-admin-modern.css` | Workspace-wide mode UI ([GUARDRAILS.md §7](GUARDRAILS.md)) |
| 25 | `map-tooltip-modern.css` | Map country tooltips |
| 26 | `board-drag.css` | Board drag-and-drop |
| 27 | `board-card-interaction.css` | Card press feedback |
| 28 | `view-toolbars-compact-row.css` | Single-row compact toolbars |
| 29 | `filters-compact-bar.css` | Filters trigger bar (compact) |
| 30 | `filters-sheet-modern.css` | Bottom-sheet filters panel |
| 31 | `mobile-command-deck.css` | Compact portfolio command deck |
| 32 | `compact-view-gutter.css` | Compact view horizontal gutters |
| 33 | `profile-picker-compact.css` | Compact profile picker combobox |
| 34 | `view-tabs-compact-menu.css` | View tab overflow “more” menu |
| 35 | `rich-description-content.css` | Rendered rich-text typography |
| 36 | `rich-text-editor.css` | Rich-text toolbar and fields |
| 37 | `portfolio-kano-modern.css` | KANO portfolio matrix and cards |
| 38 | `gantt-view.css` | Gantt timeline grid, bars, deadline markers, tooltips |
| 39 | `share-link.css` | Deep-link focus ring on portfolio cards (`.portfolio-roadmap--deep-link-focus`) |
| 40 | `confirm-modals-modern.css` | Delete/confirm dialogs |
| 41 | `filter-combobox-fix.css` | Profile picker and filter combobox alignment fixes |
| 42 | `filter-incomplete-modern.css` | Incomplete optional fields filter popup and match toggle |

### 3.2 Compact layout

`initCompactLayoutClass()` in `src/app.js`:

- Reads `COMPACT_LAYOUT_MAX_WIDTH_PX` (default **1400**).
- At `window.matchMedia('(max-width: Npx)')`: sets `html.is-compact-layout` + `html.is-phone-layout`.
- Above breakpoint: `html.is-desktop-layout`.
- Calls `syncRoadmapModalFooterMetaDetails()` on transition so `<details>` open state matches layout.

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
| `APP_ASSET_VERSION` | Cache buster (`20260710-ui201`) |
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

**Adding a new workspace-level variable:** extend `state` in `app.js`, append the key to `WORKSPACE_PERSISTED_STATE_KEYS` in `constants.js`, add validation in `applyPersistedWorkspaceUiState()`, and document in `docs/VARIABLES.md`. Roadmap/profile fields should merge via `Object.assign` in `normalizeLoadedRoadmap` / `normalizeLoadedProfile` (unknown keys round-trip). Cloud writes run `normalizeWorkspacePayload()` in `api/_lib/roadmap-metadata.js`.

**Export:** JSON uses `buildExportJsonPayload()` (all `WORKSPACE_PERSISTED_STATE_KEYS` + serialized profiles). CSV uses `ExportPayload.CSV_COLUMN_IDS`; unknown profile/roadmap keys go to `profileExtraData` / `roadmapExtraData`; workspace prefs go to `workspaceState`. Add explicit CSV columns in `src/modules/export-payload.js` and `EXPORT_CSV_KNOWN_*_KEYS` when a field should be spreadsheet-native.

| Field | Persisted | Notes |
|-------|-----------|-------|
| `profiles` | Yes | Includes `passwordSalt` / `passwordHash` when protected |
| `activeProfileId` | Yes | |
| `sortField`, `sortDirection` | Yes | |
| `roadmapsView` | Yes | `table\|board\|moscow\|map\|raci\|kano` |
| `raciMatrixDomain` | Yes | `Business` or `Tech` |
| `kanoPortfolioPanel` | Yes | `positioned` or `unpositioned` |
| `tableGroupBy` | Yes | Compact card grouping |
| `scrumBoardSortByRice`, `moscowSortByRice` | Yes | |
| `mapMetric` | Yes | |
| `exchangeRatesToEUR`, `exchangeRatesDate`, `exchangeRatesLastSource` | Yes | |
| `superAdminMode` | Yes | See GUARDRAILS §7 |

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
| `storage.js` | `AppStorage` | Load/save, cloud sync debounce, flush on roadmap save, pull guard |
| `description-format.js` | HTML sanitize/render for descriptions |
| `rich-text-editor.js` | `RichTextEditor` |
| `board-drag.js` | `BoardDrag` |
| `board-card-interaction.js` | Card interaction feedback |

**Roadmap metadata on save:** `serializeRoadmapForStorage()` normalizes `labels`, `links`, and `tasks` before persist. `saveState({ flush: true })` after roadmap modal save. Server: `api/_lib/roadmap-metadata.js` on PUT.

---

## 7. Filter implementation notes

| Control | IDs | Logic surface |
|---------|-----|---------------|
| Title + autocomplete | `filterTitle`, `filterTitleListbox` | `initFilterAutocompletes`, `applyFilters` |
| Label + autocomplete | `filterLabel`, `filterLabelListbox` | same |
| Labels any/with/without | `filterLabels` | `filterLabels.value` in `applyFilters` |
| Links any/with/without | `filterLinks` | `filterLinks.value` in `applyFilters` |
| Incomplete optional fields | `#filterIncompleteFieldsList`, `#filterIncompleteModeGroup` | `IncompleteOptionalFields.roadmapMatchesIncompleteOptionalFieldsFilter` |

Active filter pill text includes human labels for labels/links constraints.

---

## 8. Table rendering

- **Desktop:** `renderRoadmapsTable` — semantic classes `roadmaps-table-col--*`; optional owner column when workspace-wide mode active.
- **Compact:** card list in `table-compact-cards.css`; `initTableGroupByControls()` populates `#tableGroupBySelect` from `TABLE_GROUP_BY_OPTIONS`.
- **Group summary:** `#tableGroupBySummary` (`aria-live="polite"`).

---

## 9. MoSCoW display

- Use `getMoscowDisplayName(category)` for quadrant headers — not raw `moscowList` strings in customer-facing chrome.
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

- **Single render entry:** `renderRoadmaps()` refreshes table + active view.
- **Locked profiles:** `getUnlockedActiveProfile()` for roadmap surfaces unless workspace-wide mode applies (§7).
- **Tooltips:** `hideAllTooltipsExcept`, `activeTooltipWrap` — one visible tooltip.
- **IDs:** `generateId(prefix)` from `utils.js`.

---

## 13. Import / export

| Format | Handler | Merge |
|--------|---------|-------|
| JSON | `handleImportJsonFile` | `mergeImportedProfiles` by profile/roadmap id |
| CSV | `handleImportCsvFile` | Row-based roadmap merge |

Export: `getExportableProfiles()` → `sanitizeProfilesForExport()` → download.

---

## 14. Error handling

- User-facing: `showToast`, `window.alert` for import failures, inline/modal errors for unlock
- Console: `console.error` with context; never log passwords or `WORKSPACE_TRUST_PROFILE_LABEL`
- Validation: `validateRoadmapInput` in `rice.js` before save

---

## 15. Automated tests and QA

### 15.1 `npm test` (CI on every push/PR via `.github/workflows/ci.yml`)

| Script | Validates |
|--------|-----------|
| `test:storage` | Cloud sync race, pull/flush logic |
| `test:metadata` | Labels, links, tasks, RACI, KANO, note normalization |
| `test:persistence` | `WORKSPACE_PERSISTED_STATE_KEYS` round-trip |
| `test:byok` | BYOK encryption round-trip |
| `test:byok-validate` | Server validation helpers |
| `test:kano` | KANO zone matrix (25 cells) |
| `test:llm` | LLM summary module helpers |
| `test:5why` | Five Why framework helpers |
| `test:export` | Full JSON/CSV export payload round-trip |
| `test:periods` | Multi-quarter `roadmapPeriods` normalization |
| `test:gantt` | Gantt ISO weeks, quarter ranges, month zoom, deadline state |
| `test:incomplete-filter` | Incomplete optional fields any/all match logic |
| `test:import-file-kind` | Unified import JSON vs CSV detection |
| `test:workspace-merge` | WorkspaceMerge union merge, conflict resolution, tombstones, fingerprint dedupe |
| `test:api-dedupe` | Server-side `api/_lib/workspace-dedupe.js` (MoSCoW alias + tombstone prune) |
| `test:import-tombstones` | Import clears tombstones; `pruneObsoleteTombstones` on live entities |

Also: `npm run verify:production` — smoke test deployed URL (`scripts/verify-deployment.js`).

### 15.2 Manual smoke path (before release)

1. Create profile (with and without password)
2. CRUD roadmap with each financial framework; save **Note** rich-text field
3. All **seven views** + fullscreen at **375px, 768px, 1400px, 1600px**
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
- Map: avoid redundant `renderRoadmapsMap` calls.
- Target: no perceptible lag &lt; 500 roadmaps per profile on modern laptop; p95 filter/sort ≤ 300ms (see [METRICS_AND_OKRS.md](METRICS_AND_OKRS.md)).

---

## 17. Dependencies

| Layer | Dependency | Notes |
|-------|------------|-------|
| **Browser UI** | None (classic scripts) | No bundler; globals from `index.html` script order |
| **Vercel API** | `mongodb@^6.16.0` | Serverless routes in `api/` only |
| **CDN** | Leaflet 1.9.4, Google Fonts (Inter) | Map tiles and typography |

When adding CDN resources, update `vercel.json` CSP `connect-src` / `img-src`.

**Cross-feature behavior:** [FEATURE_LOGIC_AND_CONSTRAINTS.md](FEATURE_LOGIC_AND_CONSTRAINTS.md)
