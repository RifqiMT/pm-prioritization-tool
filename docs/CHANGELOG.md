# Changelog

All notable changes to the Product Management Prioritization Tool are recorded here.

**Product:** Product Management Prioritization Tool  
**Documentation owner:** Product Team  
**Format:** [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) (adapted)

---

## How to read this file

| Field | Meaning |
|-------|---------|
| **Date** | When the change landed in the repository (YYYY-MM-DD). |
| **Author** | **Product Team** unless a specific contributor is named. |
| **Area** | Product, UI, Security, Data, Docs, Infra. |
| **Impact** | User-visible, developer, or documentation-only. |

When updating this file after a change:

1. Add entries under `[Unreleased]` during development.
2. On release, move `[Unreleased]` into a dated version section (e.g. `[2.0.0] - 2026-05-26`).
3. Cross-link PRD, user stories, and traceability matrix when behavior changes.

---

## [Unreleased]

### Docs — Full documentation audit (product standard) — 2026-05-28 — Product Team — Impact: documentation

- Comprehensive refresh of README, product documentation, PRD, personas, user stories, variables (with Mermaid relationship charts), metrics/OKRs, design guidelines, traceability matrix, guardrails, changelog, and docs hub.
- Aligned layout breakpoint documentation to **1400px** (`COMPACT_LAYOUT_MAX_WIDTH_PX`) across PRD, architecture, tech guidelines, variables, and design guidelines.
- Traceability matrix expanded for FR-5.2 group-by, FR-5.4 MoSCoW display names, FR-6 labels/links filters, FR-9.6–9.7, and FR-10 (cross-references GUARDRAILS §7).
- Variables dictionary: `tableGroupBy`, filter extensions, layout constants, filter pipeline and privileged-mode charts (neutral naming; policy in GUARDRAILS §7 only).
- Asset baseline documented: `APP_ASSET_VERSION` = `20260528-ui152`.

### UI — Site footer GitHub & article links — 2026-05-28 — Product Team — Impact: user-visible

- Footer icon row: GitHub repo and prioritization article links alongside LinkedIn and website.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui152`.

### UI — Compact profile bar controls on one row — 2026-05-28 — Product Team — Impact: user-visible

- Phones & tablets: profile picker and privileged workspace toggle share one horizontal row in the profile bar.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui151`.

### UI — MoSCoW quadrant full category names — 2026-05-28 — Product Team — Impact: user-visible

- Quadrant headers and compact “Jump to quadrant” pills use **Must Have**, **Should Have**, **Could Have**, and **Won't Have** via shared `moscowDisplayNames` / `getMoscowDisplayName()`.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui150`.

### UI — MoSCoW quadrant title and description on one row — 2026-05-28 — Product Team — Impact: user-visible

- MoSCoW column headers: category badge (MUST / SHOULD / etc.) and description text share one horizontal row on desktop and compact layouts.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui148`.

### UI — Desktop board cards match compact curvature — 2026-05-28 — Product Team — Impact: user-visible

- Scrum & MoSCoW desktop project cards use the same 12px radius, border, surface gradient, and shadow as tablet/phone cards.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui147`.

### UI — Desktop board card actions single row — 2026-05-28 — Product Team — Impact: user-visible

- Scrum & MoSCoW desktop cards: View, Edit, Delete, and up/down reorder controls stay on one horizontal row.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui146`.

### UI — Board cards owner stripe (all layouts) — 2026-05-28 — Product Team — Impact: user-visible

- Scrum & MoSCoW cards: owner attribution stripe on top of title on desktop, tablet, and phone when workspace-wide mode is active (matches projects table card).
- Removed desktop-only owner pill below title on board cards.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui145`.

### UI — Cross-profile portfolio visuals (table & cards) — 2026-05-28 — Product Team — Impact: user-visible

- Workspace-wide mode: banner, avatar-based owner chips, card owner strips, refined table Profile column, and clearer cross-profile row highlights.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui142`.

### Fix — Desktop table layout stable across filters — 2026-05-28 — Product Team — Impact: user-visible

- Projects table column widths use semantic column classes (fixes misalignment when Profile column is in the DOM but hidden).
- Empty filter results keep the same header grid and empty-state styling on desktop.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui141`.

### Feature — Advanced filter: Labels (with / without) — 2026-05-28 — Product Team — Impact: user-visible

- **Labels** select in advanced filters: Any, With label(s), Without labels (same pattern as **Links**).
- Complements the **Label** search field for substring matching on label text.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui140`.

### UI — Owner identifiers and filters layout — 2026-05-28 — Product Team — Impact: user-visible

- Privileged workspace toggle on trust-holder profile only; on tablet/phone it moves into the profile picker bar so it stays visible.
- With workspace-wide mode on: owner pills on table, compact cards, board, MoSCoW, map tooltips; **Profile** table column/sort; owner advanced filter; group-by owner profile.
- Filters reorganized: **Search** row (title + label), **Quick filters** (type, countries, period), **Advanced** (impact, effort, currency, framework, status, T-shirt, MOSCOW, links).
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui137`.

### Feature — Workspace-wide project management (trust-holder profile) — 2026-05-28 — Product Team — Impact: user-visible

- Trust-holder profile can enable workspace-wide mode: view/add/edit/delete projects across all profiles (see [GUARDRAILS.md](GUARDRAILS.md) §7).
- Projects remain owned by their home profile; table shows a **Profile** column; create flow includes owner profile selector.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui136`.

### UI — Filter autocomplete (title & label) — 2026-05-28 — Product Team — Impact: user-visible

- Project **title** and **label** filters use responsive combobox suggestions from the active profile (keyboard navigation, match highlighting).
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui135`.

### Feature — Advanced filters: label & links — 2026-05-28 — Product Team — Impact: user-visible

- **Label:** text filter in advanced filters; matches any project label (substring, case-insensitive).
- **Links:** filter projects with link(s), without links, or any.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui134`.

### UI — Project labels & links readability — 2026-05-28 — Product Team — Impact: user-visible

- Restyle labels/links for the project modal light theme: high-contrast chips, link cards with title + URL preview, field hints, and bordered input panel.
- Edit mode: column headers for link rows; warm-themed remove/add controls matching other modal fields.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui133`.

### Feature — Project labels and links — 2026-05-28 — Product Team — Impact: user-visible

- **Labels:** optional multi-value tags in create/edit/view (each label may contain multiple words).
- **Links:** optional named hyperlinks (display text + URL); view mode shows clickable anchors; CSV/JSON import-export supported.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui132`.

### Fix — Desktop countries tooltip: hover bridge + scroll — 2026-05-28 — Product Team — Impact: user-visible

- Desktop EU/countries tooltip stays open while moving the pointer onto the panel (delayed hide + hover zone includes floating tooltip).
- Wheel events scroll inside the tooltip instead of closing it or scrolling the table underneath.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui131`.

### UI — EU region badge in project table/countries row — 2026-05-28 — Product Team — Impact: user-visible

- When a project targets all EU member states, the summary shows **🇪🇺 EU** (desktop badge + compact card chip) instead of `AT, BE, BG +24 more`.
- Full member list remains in the tooltip only.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui130`.

### Fix — Countries tooltip scroll on desktop + compact — 2026-05-28 — Product Team — Impact: user-visible

- Desktop table target-countries tooltip uses the same scrollable panel as compact cards (max height ~55vh, wheel/touch scroll).
- Shared `buildCountriesListTooltip()` for desktop and card views; viewport clamping applies on all layouts.
- Press **Escape** to close a pinned tooltip.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui129`.

### Fix — Compact countries tooltip: scroll + dismiss — 2026-05-28 — Product Team — Impact: user-visible

- Floating country tooltips (moved to `body`) now receive touch events (`pointer-events`) so the list scrolls on phones/tablets.
- Tap outside or on the dimmed backdrop to close; removed `preventDefault` on tap that blocked scrolling.
- Removed duplicate `focusin` open that fought tap-to-toggle; document-level dismiss for taps outside the card list.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui128`.

### Fix — Compact cards: scrollable countries tooltip — 2026-05-28 — Product Team — Impact: user-visible

- Long target-country lists (e.g. EU) no longer overflow off-screen on phones/tablets; tooltip is viewport-clamped with a scrollable body (max ~50vh).
- Title shows country count (e.g. “Target countries (27)”).
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui127`.

### UI — Compact cards: drop duplicate T-shirt badge — 2026-05-28 — Product Team — Impact: user-visible

- Phones/tablets: removed T-shirt size from the top badge row on project cards (still shown in the **Size** metric with tooltip).
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui126`.

### Fix — Compact table cards: T-shirt size tooltip — 2026-05-28 — Product Team — Impact: user-visible

- T-shirt size badge and **Size** metric on project cards now include `cell-tshirt-with-tooltip` (tap for sprint guidance from `tshirtSizeTooltips`).
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui125`.

### Fix — Compact table view tooltips (phones/tablets) — 2026-05-28 — Product Team — Impact: user-visible

- Tooltips on project cards now work on touch: **tap to show/hide**, tap outside to dismiss, keyboard focus support.
- Added structured tooltips to card title, status, MoSCoW, type/framework icons, RICE, financial impact, countries row, and +N overflow badge.
- Improved tooltip positioning (viewport clamping, wide layout for long content).
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui124`.

### UI — Compact project cards: badge row capped at three — 2026-05-28 — Product Team — Impact: user-visible

- Phones/tablets: project card badge strip stays on **one row** with at most **3** pills (Status → MoSCoW → Size priority); extra attributes collapse to a **+N** chip with tooltip.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui123`.

### UI — Compact project cards: three metrics only — 2026-05-28 — Product Team — Impact: user-visible

- Phones/tablets: project card metrics show **RICE**, **Impact**, and **Size** only (max 3); **Created** date removed.
- Metrics grid fixed to three equal columns on compact layout.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui122`.

### Feature — EU target countries shortcut — 2026-05-28 — Product Team — Impact: user-visible

- Added **EU** option to target countries in project create, view, and edit; selecting it auto-fills all **27 EU member states**.
- CSV import and saved projects with `EU` expand to member countries on load.
- Country filter includes the same EU shortcut (checks all member countries).
- Constants: `COUNTRY_OPTION_EU`, `EU_MEMBER_COUNTRIES` in `src/constants.js`.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui121`.

### UI — Compact table cards: type/framework icons & country flags — 2026-05-28 — Product Team — Impact: user-visible

- On phones/tablets (compact layout), **financial framework** icon sits beside **project type** in the title row (not in the meta row below metrics).
- Target countries row shows **flag + ISO code** per country (e.g. 🇹🇼 TW) instead of code-only text.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui120`.

### UI — Unified compact breakpoint (tablets & narrow desktop) — 2026-05-28 — Product Team — Impact: user-visible

- Raised compact layout breakpoint from 1024px to **1400px** (`COMPACT_LAYOUT_MAX_WIDTH_PX`) so iPad landscape, split-screen, and narrow laptop windows use the same phone/tablet UI (profile picker, profiles bottom sheet, card table, FAB) instead of the desktop sidebar.
- Profiles panel no longer stacks above the workspace in the compact range.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui119`.

### UI — Projects table cards: polish + group by (phones/tablets) — 2026-05-28 — Product Team — Impact: user-visible

- Refined compact table cards: clearer metrics, labeled action buttons, selected-state ring, sticky section headers when grouped.
- Added **Group by** control (Status, MoSCoW, T-shirt size, Financial framework, Project type, Currency) with persisted preference and per-group project counts.
- Cards hide the attribute shown in the active group header to reduce repetition.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui118`.

### UI — Projects table card list (phones/tablets) — 2026-05-28 — Product Team — Impact: user-visible

- Table view on viewports ≤1024px now uses a **touch-friendly project card list** instead of a horizontally scrolled 12-column grid.
- Each card shows status, MOSCOW, period, title, description excerpt, RICE, financial impact, size, created date, framework, countries, and labeled View / Edit / Delete actions.
- Selection, bulk delete bar, tooltips, and fullscreen mode work with the new card list; desktop keeps the full data table.
- Removed map-only `aspect-ratio` constraint from the table wrapper on compact layouts.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui117`.

### UI — Project modal footer meta on desktop — 2026-05-28 — Product Team — Impact: user-visible

- Fixed empty desktop footer: project metadata cards were hidden because `<details>` stayed closed; desktop now forces `details.open = true` and re-syncs when resizing across the 1024px breakpoint.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui116`.

### UI — Project modal footer actions row (phones/tablets) — 2026-05-28 — Product Team — Impact: user-visible

- Cancel and Save (or a single Close in view mode) stay **side by side in one row** on all phone and tablet widths; removed the ≤520px rule that stacked them vertically.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui115`.

### UI — Project modal footer meta collapsible (phones/tablets) — 2026-05-28 — Product Team — Impact: user-visible

- Project modal footer metadata (Project ID, dates, financial EUR, exchange rate, RICE) is wrapped in a `<details>` disclosure on viewports ≤1024px, **collapsed by default** to save vertical space; tap **Project details** to expand.
- Desktop (>1024px) continues to show both meta cards without a toggle.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui115`.

### UI — Project modal touch scroll (phones/tablets) — 2026-05-28 — Product Team — Impact: user-visible

- Fixed project create/view/edit modal scrolling on touch devices by completing the flex height chain through `#projectForm` so `#projectModalScrollRegion` has a bounded height and `overflow-y: auto` can scroll.
- Footer bar is pinned with flex layout instead of `position: sticky`, which prevented overlap when content could not scroll.
- Removed conflicting `height: 100%` override at ≤920px that broke the full-viewport panel sizing from the ≤1024px rules.
- Footer polish (phones/tablets): meta cards are easier to scan (right-aligned values, monospaced + ellipsis for Project ID), and actions sit on a clean second row on compact layouts.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui113`.

### Code — Legacy workspace field migration — 2026-05-27 — Product Team — Impact: internal

- Added `LEGACY_WORKSPACE_FIELDS` and `stripLegacyWorkspaceFields()` to remove deprecated `boardHiddenStatuses` from local cache, cloud payloads, and JSON imports on load.
- Legacy keys are stripped before the next persist so MongoDB/local exports converge to the current schema.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui113`.

### Code — Dead code cleanup — 2026-05-27 — Product Team — Impact: internal

- Removed unused `formatDate()` utility (`src/utils.js`).
- Removed duplicate `#importFileInput` and legacy `#importCsvFileInput` from `index.html` (unified import uses a single hidden input).
- Removed dead board column filter code: `boardHiddenStatuses` state, toggle helpers, and ~90 lines of unused `.board-status-filter-*` CSS.
- Dropped unused DOM element caches in `cacheElements()` (`scrumBoardLegend`, `importCsvFileInput`, popup wrappers never read in JS).
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui113`.

### UI — Project modal footer meta (tablet/phone) — 2026-05-28 — Product Team — Impact: user-visible

- Project modal footer metadata cards use a **2-column grid** on tablets/phones for faster scanning.
- Cards only stack to a single column on very narrow screens.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui113`.

### UI — Project modal max height (phones/tablets) — 2026-05-28 — Product Team — Impact: user-visible

- Project modal now uses **near full-screen height** on phones and tablets (iOS + Android) to show more project context.
- Content scrolls within the modal; footer remains accessible.
- Safe-area padding is respected on iOS notch devices.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui113`.

### UI — Table revamp + actions overlap fixes — 2026-05-27 — Product Team — Impact: user-visible

- Modernized table layout to prevent header/row overlaps and cramped columns, especially the Actions cell.
- Actions render as an icon-only horizontal toolbar inside the Actions cell (stable alignment across breakpoints).
- Additional layout layers loaded: `table-revamp-modern.css`, `table-rows-modern.css`, `project-actions-modern.css`, `layout-flow.css`, `views-density.css`, `portfolio-cards-compact.css`.

### UI — Profile original-currency breakdown with EUR equivalents — 2026-05-27 — Product Team — Impact: user-visible

- Profile view currency totals now show original totals **and** EUR equivalents side-by-side for non-EUR currencies (using latest in-app exchange rates).
- Graceful fallback messaging when a currency cannot be converted to EUR.

### Docs — Comprehensive audit — Product Team — Impact: internal

- Re-audited codebase against documentation suite (2026-05-27).
- Added [PRODUCT_DOCUMENTATION.md](PRODUCT_DOCUMENTATION.md) and restored [PRODUCT_DOCUMENTATION_STANDARD.md](PRODUCT_DOCUMENTATION_STANDARD.md).
- Updated README, PRD, personas, user stories, variables, design guidelines, traceability, metrics, guardrails, architecture, and hub index for `20260528-ui113` baseline.

### UI — Unified compact / phone layout (≤1024px) — Product Team — Impact: user-visible

- **Breakpoint model:** `html.is-compact-layout` and `html.is-phone-layout` for viewport ≤1024px; desktop remains >1024px (`initCompactLayoutClass()` in `src/app.js`).
- **MoSCoW:** `moscow-compact.css` — 2×2 navigator pills, single-column quadrant stack, no horizontal board scroll; compact nav sync via `syncMoscowCompactNav()` and `IntersectionObserver`.
- **Board:** `board-compact.css` — single-column status stacks; card **Move to** dropdown for status changes.
- **Table:** `table-compact.css` — phone-style toolbar, floating **selection bar** for bulk delete, FAB for new project.
- **Fullscreen:** `fullscreen-compact.css` — body-level host; board/MoSCoW/table match workspace compact layouts inside fullscreen.
- **Chrome:** `compact-modern.css` — icon-only portfolio tabs, short header title, hidden toolbar labels on compact.
- **Footer:** `app-footer.css` — centered one-row attribution (credit, LinkedIn, website).
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui113`.

### Docs — Cleanup — Product Team — Impact: internal

- Removed redundant docs: `VERCEL_MONGODB_FIX.md`, `SETUP_VERCEL_GITHUB.md`, `docs/personas/*` (merged into `USER_PERSONAS.md` and `DEPLOYMENT.md`).
- Fixed stale references to non-existent `src/main.js`; updated source map for `storage.js` and `overlay-manager.js`.
- Deleted unused `site-config.json`.

### Code — Cleanup — Product Team — Impact: developer

- Removed legacy CSS for old map metric `<select>` and profile-view fallbacks in `main.css`.
- Removed unused `OverlayManager.unregister` API and unused `profileViewTeamWrap` element cache.

### Data — Cross-device cloud sync — Product Team — Impact: user-visible

- Smarter load merge using `_storageMeta.updatedAt` (newer local vs remote wins).
- Auto-pull from MongoDB on tab focus, visibility, and every 45s while the tab is open.
- Faster debounced saves, reliable flush on tab close/hide.
- Cloud modal: **Pull from cloud** / **Save to cloud**; header status click syncs.
- Toast when workspace loads from cloud; warns when password-protected profiles need unlock on a new device.
- Prevents seeding an empty “Default Profile” over a populated cloud workspace when load fails.

### Deploy — Vercel protection + diagnostics — Product Team — Impact: user-visible

- Detect Vercel Deployment Protection (401 on `/api`) and show setup banner.
- Add `scripts/disable-vercel-deployment-protection.sh`; troubleshooting consolidated in `DEPLOYMENT.md`.

### Data — MongoDB persistence on Vercel — Product Team — Impact: user-visible

- Added `/api/health` and `/api/state` serverless routes with MongoDB Atlas storage.
- Frontend `AppStorage` module: loads/saves workspace to cloud when `MONGODB_URI` is configured; migrates existing `localStorage` data on first connect.
- Header storage status, **Cloud** action, and connect modal for `PM_API_SECRET`.
- See [DEPLOYMENT.md](DEPLOYMENT.md) for required Vercel environment variables.

---

## [2.0.0] - 2026-05-26

Major release: local-first portfolio workspace with profile security, modern responsive UI, export password gate, and full product documentation suite.

### Documentation — 2026-05-26 — Product Team — Docs — Impact: internal + delivery

- Re-audited codebase and published enterprise documentation suite:
  - `README.md`, `PRODUCT_DOCUMENTATION_STANDARD.md`, `docs/README.md`
  - `docs/PRD.md`, `docs/USER_PERSONAS.md`, `docs/personas/*`
  - `docs/USER_STORIES.md` (Given/When/Then acceptance criteria)
  - `docs/VARIABLES.md` (formulas + Mermaid relationship charts)
  - `docs/METRICS_AND_OKRS.md`, `docs/DESIGN_GUIDELINES.md`
  - `docs/ARCHITECTURE.md`, `docs/TECH_GUIDELINES.md`, `docs/BUSINESS_GUIDELINES.md`
  - `docs/TRACEABILITY_MATRIX.md`, `docs/GUARDRAILS.md`, `docs/DEPLOYMENT.md`
  - `docs/CHANGELOG.md` (this file; author label **Product Team**)

### UI — Export & import modals — 2026-05-26 — Product Team — Impact: user-visible

- **Import data** dialog aligned with **Export data**: shared header, card-style JSON/CSV picker, cream palette, mobile-friendly layout.
- Shared `data-transfer-*` styles; import includes **merge, not replace** callout.
- Dynamic subtitles show workspace counts; export flow notes when protected profiles need passwords.
- Removed legacy dark modal background override for export/import panels.

### UI — Export modals — 2026-05-26 — Product Team — Impact: user-visible

- **Unlock for export** and **Export data** redesigned: profile-style header, scrollable body, per-profile unlock cards (avatar, password, eye toggle).
- Format chooser uses descriptive JSON/CSV option cards instead of legacy outline buttons.
- Footer actions stack on phone; primary/ghost buttons match profile modal patterns.

### Security — Export password gate — 2026-05-26 — Product Team — Impact: user-visible + security

- JSON and CSV exports include only profiles **without a password** or **unlocked with the correct password** (session unlock or export dialog verification).
- Profiles with **missing or incorrect** passwords are **omitted** from the export file; toast summarizes skipped profiles.
- Export unlock dialog uses the same **show/hide password** eye toggle as profile modals.

### UI — Locked profile banner — 2026-05-26 — Product Team — Impact: user-visible

- Removed redundant **Use unlock dialog** from the locked banner; single inline password + **Unlock** flow.
- Modal unlock remains for view/edit actions from profile list.

### UI — Profile & toolbar controls — 2026-05-26 — Product Team — Impact: user-visible

- Password **show/hide** buttons: neutral icon style, no layout jump on hover/click.
- **Remove password** switch: static checkbox (no sliding thumb).
- Map metric pills and RICE sort toggle: calmer active state without sliding animations.

### UI — Map “Show by” metric — 2026-05-26 — Product Team — Impact: user-visible

- Replaced dropdown with **segmented pill control** (Count / RICE / EUR).
- Touch-friendly; keyboard navigable (`radiogroup` + arrow keys); compact on phone.

### UI — Board status column filters — 2026-05-26 — Product Team — Impact: user-visible

- Board toolbar status pills are **toggle buttons** to show/hide columns.
- Active pills use status colors; hidden pills appear muted with strikethrough.
- **Show all** when any column is hidden; at least one column must remain visible.
- Preference persists in `localStorage` as `boardHiddenStatuses`.

### UI — View toolbars — 2026-05-26 — Product Team — Impact: user-visible

- Unified `view-toolbar` for Table, Board, MoSCoW, and Map.
- Fixed legacy `main.css` flex-end collapse on table/map toolbars (title left, controls right via CSS grid).

### UI — Profile modals — 2026-05-26 — Product Team — Impact: user-visible

- Revamped **Edit profile** and **Unlock profile** modals: light sheet, sticky footer, security section, mobile bottom-sheet behavior.

### UI — Profiles, portfolio, header, workspace — 2026-05-26 — Product Team — Impact: user-visible

- Profiles v2 cards, portfolio command bar, collapsible filters, FAB on mobile.
- Header actions menu on phones; modern ghost toolbar on tablet/desktop.
- `workspace-modern.css`, `header-modern.css`, `profiles-modern.css`, `portfolio-modern.css`, `profile-modals-modern.css`, `export-modals-modern.css`, `view-toolbars-modern.css`.

### Security — Profile passwords — 2026-05-26 — Product Team — Impact: user-visible + security

- `profile-security.js`: PBKDF2-SHA256 password hashing; never store plaintext passwords.
- `loadState()` persists `passwordSalt` / `passwordHash` after refresh.
- Board, MoSCoW, and Map no longer leak project data when profile is locked.
- Session unlock resets on tab close/refresh; inline unlock on locked banner.
- Delete protected profile requires correct password.

### Data — Import / export — 2026-05-26 — Product Team — Impact: user-visible

- JSON export includes workspace preferences; CSV is flat project rows.
- Import merges profiles/projects by ID without duplicate corruption for same IDs.

### Product — Explainability & filters — 2026-05-26 — Product Team — Impact: user-visible

- Single visible tooltip app-wide; standardized modal field tooltips.
- RICE tooltip: abbreviations, formula, calculation line.
- Table **Framework** column + advanced **Framework** filter naming.
- Project modal footer: Project ID, timestamps, RICE, financial/EUR context.
- Board/MoSCoW card tooltips: status + description.

### Infra — Vercel deployment — 2026-05-26 — Product Team — Impact: developer + ops

- `vercel.json`: static deploy, security headers (CSP), asset caching.
- `package.json`, `.gitignore`, `.vercelignore`; `docs/DEPLOYMENT.md` smoke tests.

---

## [1.x] — Prior baseline (pre-2.0.0 UI refresh)

Earlier iterations introduced core RICE scoring, multi-view planning (table/board/MoSCoW/map), financial frameworks, and JSON/CSV portability. Detailed history before 2026-05-26 was consolidated into **2.0.0** during the documentation audit.

For archaeology, refer to git history on `main` and agent transcripts cited in project README.

---

## Versioning policy

- **MAJOR** (e.g. 3.0.0): breaking changes to stored data format or incompatible import/export.
- **MINOR** (e.g. 2.1.0): new features, backward-compatible persistence.
- **PATCH** (e.g. 2.0.1): bug fixes and UI polish without new capabilities.

---

## Related documents

- [PRD.md](PRD.md) — requirements baseline for 2.0.0  
- [TRACEABILITY_MATRIX.md](TRACEABILITY_MATRIX.md) — requirement → code mapping  
- [README.md](../README.md) — product overview and quick start
