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

### Docs — Full product documentation standard audit — 2026-06-06 — Product Team — Impact: documentation

- Re-audited codebase vs 18-doc suite (`APP_ASSET_VERSION` = `20260528-ui194`).
- Documented **`roadmap.note`** (six rich-text surfaces); fixed VARIABLES §8 numbering (§8.1–8.16).
- Corrected **CSS load order** in TECH_GUIDELINES §3.1, ARCHITECTURE §10, README (matches `index.html`).
- Restructured TRACEABILITY_MATRIX (FR-9.6/9.7, FR-11.1–5, FR-2.6/2.12/2.13 sections).
- Expanded FEATURE_LOGIC (note, collapsibles, in-modal KANO, dev seed); US-D1 six views; `npm test`/CI in README and TECH.
- Fixed TECH §17: `mongodb` dependency for Vercel API; `app.js` ~19.5k lines in ARCHITECTURE.

### Docs — Feature logic and constraints reference — 2026-05-28 — Product Team — Impact: documentation

- Added [FEATURE_LOGIC_AND_CONSTRAINTS.md](FEATURE_LOGIC_AND_CONSTRAINTS.md): collaborative cross-feature guide (logic, rules, constraints) for PM, engineering, design, and QA.
- Indexed in docs hub, README, PRODUCT_DOCUMENTATION_STANDARD required set, and PRODUCT_DOCUMENTATION §5.

### Docs — Full product documentation standard audit — 2026-05-28 — Product Team — Impact: documentation

- Re-audited entire repository against `APP_ASSET_VERSION` = `20260528-ui194`.
- Documented **5 Why Framework** (`roadmap-5why-framework.js`, FR-2.13, Epic V, GUARDRAILS §8.3, VARIABLES §8.14, PM-15).
- **Roadmap** terminology, six views, legacy `projects` migration, RACI/KANO (Epics R–S), **BYOK** + **LLM** (Epics T–U).
- **33 CSS layers**; unified all `index.html` cache-bust query strings; `npm test` now includes `test:llm` and `test:5why`.
- Corrected `TECH_GUIDELINES.md` script load order to match `index.html`.

### Terminology — Project → Roadmap across app and docs — 2026-05-31 — Product Team — Impact: user-visible

- Renamed all product-facing **Project / Projects** terminology to **Roadmap / Roadmaps** (UI labels, modals, filters, views, CSS classes, JS identifiers, API module names, and documentation).
- Persistence key `profile.projects` migrated to `profile.roadmaps` on load and save; legacy `projects` and `projectsView` keys still accepted on import.
- Renamed files: `roadmap-metadata.js`, `roadmap-actions-modern.css`, `roadmap-details-tooltip.css`, `test-roadmap-metadata.js`.
- Vercel infrastructure names (`VERCEL_PROJECT_ID`, `/v9/projects`) preserved in deployment scripts and workflows.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui194`.

### Data — Workspace persistence registry and round-trip fixes — 2026-06-06 — Product Team — Impact: user-visible

- Added `WORKSPACE_PERSISTED_STATE_KEYS` in `constants.js` so new UI state fields are saved to `localStorage` and Vercel MongoDB via one registry.
- Fixed `moscowOrder` dropped on reload; profile/roadmap loaders now merge unknown fields forward-compatibly.
- Cloud API normalizes `tasks[]` on write (aligned with labels/links/raci).
- Added `npm run test:persistence` for key-registry and round-trip checks.

### Docs — Full documentation audit (product standard) — 2026-05-31 — Product Team — Impact: documentation

- Re-audited repository against `APP_ASSET_VERSION` = `20260528-ui194`.
- Updated README, documentation hub, PRD, product documentation, personas, user stories, variables (with relationship charts), metrics/OKRs, design guidelines, traceability matrix, guardrails, architecture, and tech guidelines.
- Documented rich-text descriptions, roadmap tasks, labels/links cloud persistence, bulk duplicate/move, and complete source/CSS/module map.

### Fix — Roadmap labels and links persist to MongoDB (prod) — 2026-05-31 — Product Team — Impact: user-visible

- Canonicalize labels/links on every workspace save and MongoDB write; accept legacy link field names (`name`, `href`, `text`) and string URL arrays.
- Flush cloud sync immediately after roadmap create/edit so background pulls do not overwrite unsaved label/link changes.
- Skip automatic cloud pull while local edits are pending or newer than the last applied remote snapshot.
- Server-side normalization in `api/state` before MongoDB upsert.
- GitHub `fix-vercel-protection` workflow no longer fails when Vercel secrets are missing (skips with notice).
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui194`.

### Feature — Bulk duplicate and move across profiles — 2026-06-06 — Product Team — Impact: user-visible

- When workspace-wide mode is active, table multi-select shows **Duplicate selected** and **Move selected** (desktop toolbar and compact selection bar).
- Duplicate creates copies in a chosen target profile; move re-homes selected roadmaps to another profile and cleans board/MoSCoW order references.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui189`.

### Feature — Roadmap tasks with status — 2026-06-06 — Product Team — Impact: user-visible

- Add optional Tasks list in roadmap create, edit, and view modals (task name + status dropdown using roadmap status values).
- Persist tasks in roadmap data, CSV export/import (JSON column), and storage normalization.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui188`.

### UX — Rich-text editor redesign + all description fields — 2026-06-06 — Product Team — Impact: user-visible

- Modern toolbar with SVG icons, grouped controls, and global button-style reset (fixes heavy red primary-button styling on format buttons).
- Rich text expanded to Reach, Impact, Confidence, and Effort description fields; compact sizing for RICE inputs.
- Shared mount pattern for all description editors; CSV export strips HTML from every description field.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui187`.

### UX — Rich-text roadmap description editor — 2026-06-06 — Product Team — Impact: user-visible

- Roadmap create/edit description field supports Word-like formatting: bold, italic, underline, alignment, bullet and numbered lists.
- Stored as sanitized HTML; legacy plain-text descriptions still render; CSV export uses plain-text fallback.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui186`.

### UX — Roadmap details tooltip rich formatting — 2026-06-06 — Product Team — Impact: user-visible

- Description tooltips parse paragraphs, bullets, numbering, and section headers; scrollable wide layout for long content.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui185`.

### Fix — Filters drawer collapsed by default — 2026-06-06 — Product Team — Impact: user-visible

- Filters drawer always starts collapsed on load; removed localStorage restore of open state; advanced panel closes when drawer collapses.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui184`.

### Fix — Compact filter buttons hidden until drawer open — 2026-06-06 — Product Team — Impact: user-visible

- Phones/tablets: Reset + Advanced no longer appear on the collapsed summary; shown only after expanding Filters.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui183`.

### Fix — Compact filter actions when drawer expanded — 2026-06-06 — Product Team — Impact: user-visible

- Phones/tablets: Reset + Advanced move into the expanded filter body (sticky top bar); summary row keeps them when collapsed.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui182`.

### Fix — Filter buttons stuck in summary on desktop — 2026-06-06 — Product Team — Impact: user-visible

- `syncCompactFiltersChrome` now finds `.filters-meta` after DOM move and restores buttons to the toolbar on desktop; summary action slot hidden on `is-desktop-layout`.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui181`.

### UX — Compact filters bar redesign — 2026-06-06 — Product Team — Impact: user-visible

- Phones/tablets: two-row filters header (title row + Reset/Advanced buttons), icons, compact active-count badge, chevron expand control.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui180`.

### Fix — Advanced filters on phones/tablets — 2026-06-06 — Product Team — Impact: user-visible

- Restored **Reset** and **Show advanced** on compact: actions sit on the filters summary row; opening advanced also expands the drawer when collapsed.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui179`.

### UX — MoSCoW compact toolbar single-row — 2026-06-06 — Product Team — Impact: user-visible

- Phones/tablets: MoSCoW toolbar matches board/table (RICE sort left, fullscreen trailing); removed grid/`display:contents` conflicts.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui178`.

### UX — Table group-by selector compact-only — 2026-06-06 — Product Team — Impact: user-visible

- Group-by toolbar control is shown only on phones/tablets (`is-compact-layout`); hidden on desktop with JS `hidden`/`aria-hidden` sync on resize.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui177`.

### UX — Compact toolbar control order standardized — 2026-06-06 — Product Team — Impact: user-visible

- Phones/tablets: all views use selector → RICE sort → fullscreen; table group-by moved before RICE sort in DOM.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui176` (compact-row overrides `display:contents` on control clusters).

### Fix — Compact view toolbars truly single-row — 2026-06-06 — Product Team — Impact: user-visible

- Override `display: block` toolbar rules; table group-by moved into primary cluster; `view-toolbars-compact-row.css` forces flex row layout on phones/tablets.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui174`.

### UX — Compact view toolbars on one row — 2026-06-06 — Product Team — Impact: user-visible

- Phones/tablets: board (status columns + RICE + expand), table (RICE + group by + count + expand), map, and MoSCoW controls align on a single toolbar row.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui173`.

### Fix — Compact table card actions on one row — 2026-06-06 — Product Team — Impact: user-visible

- View, Edit, and Delete stay on a single row on phones/tablets (table card footer no longer inherits the board two-row grid).
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui172`.

### UX — Compact table roadmap cards aligned with board cards — 2026-06-06 — Product Team — Impact: user-visible

- Phones/tablets (≤1400px) table view cards use the same metrics row (type, framework, RICE, size, financial), structured sections, and hover/press feedback as Scrum/MoSCoW cards (no card resize).
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui171`.

### UX — Standardized board card hover & click — 2026-06-06 — Product Team — Impact: user-visible

- Shared `board-card-interaction` styles and pointer feedback for Scrum / MoSCoW cards: inset outline + shadow on hover, stronger ring + tint on press (no padding, margin, or lift).
- Removed conflicting hover overrides that flattened or shifted cards on desktop.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui170`.

### UX — Desktop board drag-and-drop animation — 2026-06-06 — Product Team — Impact: user-visible

- Shared `BoardDrag` module and `board-drag.css`: floating card preview, pulsing drop slot, dashed source placeholder, and column/quadrant highlight for Scrum and MoSCoW on desktop.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui169`.

### Feature — Board view status column filter — 2026-06-06 — Product Team — Impact: user-visible

- Board toolbar multi-select **Status columns** toggles which roadmap statuses appear as Scrum columns (persisted in workspace state; at least one column required).
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui168`.

### Fix — Desktop Scrum board column width — 2026-06-06 — Product Team — Impact: user-visible

- Columns use a fixed **368px** width (no flex shrink); board scrolls horizontally when all five statuses do not fit.
- Cards and metrics row have room for type/framework icons, RICE, size, and financial badges without clipping.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui167`.

### Fix — MoSCoW quadrant equal height and scroll — 2026-06-06 — Product Team — Impact: user-visible

- Desktop 2×2 grid: equal row heights (`1fr 1fr`), fixed grid height, scrollable card lists in each quadrant (Could have / Won't have no longer clip).
- Compact/fullscreen: quadrant max-height with internal scroll so the last card is reachable.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui166`.

### UI — Desktop board card section spacing — 2026-06-06 — Product Team — Impact: user-visible

- Scrum/MoSCoW cards on desktop use structured body + footer with dividers between title, metrics, and actions rows.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui165`.

### UI — Scrum/MoSCoW card metrics in one row — 2026-06-06 — Product Team — Impact: user-visible

- Roadmap type icon, financial framework icon, RICE, t-shirt size, and financial impact share one horizontal metrics row on all breakpoints (desktop, tablet, phone).
- Shared `buildBoardCardMetricsRow` helper; horizontal scroll on very narrow cards instead of stacking.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui164`.

### UI — Map profile breakdown redesign — 2026-06-06 — Product Team — Impact: user-visible

- Profile section: header with metric badge, avatar initials, proportional bars, and scroll when needed; list height auto-fits map viewport to avoid bottom chop.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui163`.

### Fix — Map tooltip no longer clipped at map edges — 2026-06-06 — Product Team — Impact: user-visible

- Tooltips pick top vs bottom from available space and clamp inside the map container after layout.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui162`.

### UI — Simplified map country tooltips — 2026-06-06 — Product Team — Impact: user-visible

- Cleaner layout: country header, inline stat (`13 roadmaps`), short footnote only when no profile list.
- Profile breakdown is a simple name/value list (no nested cards); values use neutral workspace colors.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui161`.

### UI — Map tooltip per-profile breakdown (workspace-wide mode) — 2026-06-06 — Product Team — Impact: user-visible

- When workspace-wide mode is on (GUARDRAILS §7), country tooltips show total for the selected metric plus a **By profile** list (up to 10 profiles) with each profile’s value for that country.
- Supports Count, RICE, Avg RICE, EUR, and Avg EUR metrics.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui160`.

### Fix — Map tooltip shows selected metric; legend counts clarified — 2026-06-06 — Product Team — Impact: user-visible

- Map hover tooltip always shows the aggregated value for the toolbar metric (Count, RICE, EUR, etc.), not only in workspace-wide mode.
- Tooltip values are rebuilt on each hover from live filtered data; improved ISO code matching for country stats.
- Legend distinguishes **roadmaps in scope** vs **country assignments** (multi-country roadmaps count once per country on the map).
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui159`.

### Fix — Map hover tooltip position and stuck country outlines — 2026-06-06 — Product Team — Impact: user-visible

- Tooltip anchors to cursor position, then Natural Earth `LABEL_X`/`LABEL_Y`, then valid bounds center (fixes cards appearing over the ocean).
- Only one country highlight at a time: `resetStyle` on the geo layer before each hover; clears on mouse leave / pan / zoom.
- Removed per-hover `bringToFront` on the whole layer that caused overlapping outlines.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui158`.

### UI — Map tooltip simplified (aggregated only in workspace-wide mode) — 2026-06-06 — Product Team — Impact: user-visible

- Map hover tooltip: country name + flag only by default; no roadmap lists, progress bars, footers, or click-to-pin panel.
- When workspace-wide mode is on (GUARDRAILS §7), tooltip adds aggregated value for the selected map metric (Count, RICE, EUR, etc.).
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui157`.

### UI — Map hover tooltips pass-through + click-to-pin details — 2026-06-06 — Product Team — Impact: user-visible

- Hover preview tooltip uses `pointer-events: none` so countries under the card remain hoverable; compact summary only (metric + roadmap count).
- Click a country to pin the full roadmap list in a corner panel (`#roadmapsMapDetailPanel`); click again or click the map to close.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui156`.

### Fix — Map tooltips single-open policy — 2026-06-06 — Product Team — Impact: user-visible

- Replaced per-country `bindTooltip` with one shared Leaflet tooltip so only one country card is visible at a time.
- Closing on map pan/zoom/click and deferred close when leaving a country (still allows scrolling the interactive card).
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui155`.

### UI — Map country tooltips revamp — 2026-06-06 — Product Team — Impact: user-visible

- Replaced plain-text Leaflet tooltips with structured cards: country header (flag, name, ISO code, metric badge), hero metric value, relative intensity bar, scrollable roadmap list (RICE, EUR, status, MoSCoW chips; owner when workspace-wide mode is on).
- Sticky, interactive, auto-positioned tooltips; gold border highlight on country hover.
- New `css/map-tooltip-modern.css`; cache bust `APP_ASSET_VERSION` = `20260528-ui154`.

### Fix — Map view stuck on “Unlock this profile” — 2026-06-06 — Product Team — Impact: user-visible

- Map view no longer leaves a stale unlock message after the profile is unlocked: Leaflet instances are torn down when showing empty states, and the map is recreated when the host DOM was replaced.
- Locked-profile portfolio rendering delegates to `renderRoadmapsMap()` / board / MoSCoW renderers instead of swapping map HTML without clearing `_leafletMap`.
- If Leaflet is still loading, the map retries instead of failing silently.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui153`.

### Docs — Full documentation audit (product standard) — 2026-06-06 — Product Team — Impact: documentation

- Comprehensive refresh of README, product documentation, PRD, personas, user stories, variables (with Mermaid relationship charts), metrics/OKRs, design guidelines, traceability matrix, guardrails, changelog, and docs hub.
- Aligned layout breakpoint documentation to **1400px** (`COMPACT_LAYOUT_MAX_WIDTH_PX`) across PRD, architecture, tech guidelines, variables, and design guidelines.
- Traceability matrix expanded for FR-5.2 group-by, FR-5.4 MoSCoW display names, FR-6 labels/links filters, FR-9.6–9.7, and FR-10 (cross-references GUARDRAILS §7).
- Variables dictionary: `tableGroupBy`, filter extensions, layout constants, filter pipeline and privileged-mode charts (neutral naming; policy in GUARDRAILS §7 only).
- Asset baseline documented: `APP_ASSET_VERSION` = `20260528-ui194`.

### UI — Site footer GitHub & article links — 2026-06-06 — Product Team — Impact: user-visible

- Footer icon row: GitHub repo and prioritization article links alongside LinkedIn and website.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui194`.

### UI — Compact profile bar controls on one row — 2026-06-06 — Product Team — Impact: user-visible

- Phones & tablets: profile picker and privileged workspace toggle share one horizontal row in the profile bar.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui151`.

### UI — MoSCoW quadrant full category names — 2026-06-06 — Product Team — Impact: user-visible

- Quadrant headers and compact “Jump to quadrant” pills use **Must Have**, **Should Have**, **Could Have**, and **Won't Have** via shared `moscowDisplayNames` / `getMoscowDisplayName()`.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui150`.

### UI — MoSCoW quadrant title and description on one row — 2026-06-06 — Product Team — Impact: user-visible

- MoSCoW column headers: category badge (MUST / SHOULD / etc.) and description text share one horizontal row on desktop and compact layouts.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui148`.

### UI — Desktop board cards match compact curvature — 2026-06-06 — Product Team — Impact: user-visible

- Scrum & MoSCoW desktop roadmap cards use the same 12px radius, border, surface gradient, and shadow as tablet/phone cards.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui147`.

### UI — Desktop board card actions single row — 2026-06-06 — Product Team — Impact: user-visible

- Scrum & MoSCoW desktop cards: View, Edit, Delete, and up/down reorder controls stay on one horizontal row.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui146`.

### UI — Board cards owner stripe (all layouts) — 2026-06-06 — Product Team — Impact: user-visible

- Scrum & MoSCoW cards: owner attribution stripe on top of title on desktop, tablet, and phone when workspace-wide mode is active (matches roadmaps table card).
- Removed desktop-only owner pill below title on board cards.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui145`.

### UI — Cross-profile portfolio visuals (table & cards) — 2026-06-06 — Product Team — Impact: user-visible

- Workspace-wide mode: banner, avatar-based owner chips, card owner strips, refined table Profile column, and clearer cross-profile row highlights.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui142`.

### Fix — Desktop table layout stable across filters — 2026-06-06 — Product Team — Impact: user-visible

- Roadmaps table column widths use semantic column classes (fixes misalignment when Profile column is in the DOM but hidden).
- Empty filter results keep the same header grid and empty-state styling on desktop.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui141`.

### Feature — Advanced filter: Labels (with / without) — 2026-06-06 — Product Team — Impact: user-visible

- **Labels** select in advanced filters: Any, With label(s), Without labels (same pattern as **Links**).
- Complements the **Label** search field for substring matching on label text.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui140`.

### UI — Owner identifiers and filters layout — 2026-06-06 — Product Team — Impact: user-visible

- Privileged workspace toggle on trust-holder profile only; on tablet/phone it moves into the profile picker bar so it stays visible.
- With workspace-wide mode on: owner pills on table, compact cards, board, MoSCoW, map tooltips; **Profile** table column/sort; owner advanced filter; group-by owner profile.
- Filters reorganized: **Search** row (title + label), **Quick filters** (type, countries, period), **Advanced** (impact, effort, currency, framework, status, T-shirt, MOSCOW, links).
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui137`.

### Feature — Workspace-wide roadmap management (trust-holder profile) — 2026-06-06 — Product Team — Impact: user-visible

- Trust-holder profile can enable workspace-wide mode: view/add/edit/delete roadmaps across all profiles (see [GUARDRAILS.md](GUARDRAILS.md) §7).
- Roadmaps remain owned by their home profile; table shows a **Profile** column; create flow includes owner profile selector.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui136`.

### UI — Filter autocomplete (title & label) — 2026-06-06 — Product Team — Impact: user-visible

- Roadmap **title** and **label** filters use responsive combobox suggestions from the active profile (keyboard navigation, match highlighting).
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui135`.

### Feature — Advanced filters: label & links — 2026-06-06 — Product Team — Impact: user-visible

- **Label:** text filter in advanced filters; matches any roadmap label (substring, case-insensitive).
- **Links:** filter roadmaps with link(s), without links, or any.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui134`.

### UI — Roadmap labels & links readability — 2026-06-06 — Product Team — Impact: user-visible

- Restyle labels/links for the roadmap modal light theme: high-contrast chips, link cards with title + URL preview, field hints, and bordered input panel.
- Edit mode: column headers for link rows; warm-themed remove/add controls matching other modal fields.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui133`.

### Feature — Roadmap labels and links — 2026-06-06 — Product Team — Impact: user-visible

- **Labels:** optional multi-value tags in create/edit/view (each label may contain multiple words).
- **Links:** optional named hyperlinks (display text + URL); view mode shows clickable anchors; CSV/JSON import-export supported.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui132`.

### Fix — Desktop countries tooltip: hover bridge + scroll — 2026-06-06 — Product Team — Impact: user-visible

- Desktop EU/countries tooltip stays open while moving the pointer onto the panel (delayed hide + hover zone includes floating tooltip).
- Wheel events scroll inside the tooltip instead of closing it or scrolling the table underneath.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui131`.

### UI — EU region badge in roadmap table/countries row — 2026-06-06 — Product Team — Impact: user-visible

- When a roadmap targets all EU member states, the summary shows **🇪🇺 EU** (desktop badge + compact card chip) instead of `AT, BE, BG +24 more`.
- Full member list remains in the tooltip only.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui130`.

### Fix — Countries tooltip scroll on desktop + compact — 2026-06-06 — Product Team — Impact: user-visible

- Desktop table target-countries tooltip uses the same scrollable panel as compact cards (max height ~55vh, wheel/touch scroll).
- Shared `buildCountriesListTooltip()` for desktop and card views; viewport clamping applies on all layouts.
- Press **Escape** to close a pinned tooltip.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui129`.

### Fix — Compact countries tooltip: scroll + dismiss — 2026-06-06 — Product Team — Impact: user-visible

- Floating country tooltips (moved to `body`) now receive touch events (`pointer-events`) so the list scrolls on phones/tablets.
- Tap outside or on the dimmed backdrop to close; removed `preventDefault` on tap that blocked scrolling.
- Removed duplicate `focusin` open that fought tap-to-toggle; document-level dismiss for taps outside the card list.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui128`.

### Fix — Compact cards: scrollable countries tooltip — 2026-06-06 — Product Team — Impact: user-visible

- Long target-country lists (e.g. EU) no longer overflow off-screen on phones/tablets; tooltip is viewport-clamped with a scrollable body (max ~50vh).
- Title shows country count (e.g. “Target countries (27)”).
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui127`.

### UI — Compact cards: drop duplicate T-shirt badge — 2026-06-06 — Product Team — Impact: user-visible

- Phones/tablets: removed T-shirt size from the top badge row on roadmap cards (still shown in the **Size** metric with tooltip).
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui126`.

### Fix — Compact table cards: T-shirt size tooltip — 2026-06-06 — Product Team — Impact: user-visible

- T-shirt size badge and **Size** metric on roadmap cards now include `cell-tshirt-with-tooltip` (tap for sprint guidance from `tshirtSizeTooltips`).
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui125`.

### Fix — Compact table view tooltips (phones/tablets) — 2026-06-06 — Product Team — Impact: user-visible

- Tooltips on roadmap cards now work on touch: **tap to show/hide**, tap outside to dismiss, keyboard focus support.
- Added structured tooltips to card title, status, MoSCoW, type/framework icons, RICE, financial impact, countries row, and +N overflow badge.
- Improved tooltip positioning (viewport clamping, wide layout for long content).
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui124`.

### UI — Compact roadmap cards: badge row capped at three — 2026-06-06 — Product Team — Impact: user-visible

- Phones/tablets: roadmap card badge strip stays on **one row** with at most **3** pills (Status → MoSCoW → Size priority); extra attributes collapse to a **+N** chip with tooltip.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui123`.

### UI — Compact roadmap cards: three metrics only — 2026-06-06 — Product Team — Impact: user-visible

- Phones/tablets: roadmap card metrics show **RICE**, **Impact**, and **Size** only (max 3); **Created** date removed.
- Metrics grid fixed to three equal columns on compact layout.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui122`.

### Feature — EU target countries shortcut — 2026-06-06 — Product Team — Impact: user-visible

- Added **EU** option to target countries in roadmap create, view, and edit; selecting it auto-fills all **27 EU member states**.
- CSV import and saved roadmaps with `EU` expand to member countries on load.
- Country filter includes the same EU shortcut (checks all member countries).
- Constants: `COUNTRY_OPTION_EU`, `EU_MEMBER_COUNTRIES` in `src/constants.js`.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui121`.

### UI — Compact table cards: type/framework icons & country flags — 2026-06-06 — Product Team — Impact: user-visible

- On phones/tablets (compact layout), **financial framework** icon sits beside **roadmap type** in the title row (not in the meta row below metrics).
- Target countries row shows **flag + ISO code** per country (e.g. 🇹🇼 TW) instead of code-only text.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui120`.

### UI — Unified compact breakpoint (tablets & narrow desktop) — 2026-06-06 — Product Team — Impact: user-visible

- Raised compact layout breakpoint from 1024px to **1400px** (`COMPACT_LAYOUT_MAX_WIDTH_PX`) so iPad landscape, split-screen, and narrow laptop windows use the same phone/tablet UI (profile picker, profiles bottom sheet, card table, FAB) instead of the desktop sidebar.
- Profiles panel no longer stacks above the workspace in the compact range.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui119`.

### UI — Roadmaps table cards: polish + group by (phones/tablets) — 2026-06-06 — Product Team — Impact: user-visible

- Refined compact table cards: clearer metrics, labeled action buttons, selected-state ring, sticky section headers when grouped.
- Added **Group by** control (Status, MoSCoW, T-shirt size, Financial framework, Roadmap type, Currency) with persisted preference and per-group roadmap counts.
- Cards hide the attribute shown in the active group header to reduce repetition.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui118`.

### UI — Roadmaps table card list (phones/tablets) — 2026-06-06 — Product Team — Impact: user-visible

- Table view on viewports ≤1024px now uses a **touch-friendly roadmap card list** instead of a horizontally scrolled 12-column grid.
- Each card shows status, MOSCOW, period, title, description excerpt, RICE, financial impact, size, created date, framework, countries, and labeled View / Edit / Delete actions.
- Selection, bulk delete bar, tooltips, and fullscreen mode work with the new card list; desktop keeps the full data table.
- Removed map-only `aspect-ratio` constraint from the table wrapper on compact layouts.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui117`.

### UI — Roadmap modal footer meta on desktop — 2026-06-06 — Product Team — Impact: user-visible

- Fixed empty desktop footer: roadmap metadata cards were hidden because `<details>` stayed closed; desktop now forces `details.open = true` and re-syncs when resizing across the 1024px breakpoint.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui116`.

### UI — Roadmap modal footer actions row (phones/tablets) — 2026-06-06 — Product Team — Impact: user-visible

- Cancel and Save (or a single Close in view mode) stay **side by side in one row** on all phone and tablet widths; removed the ≤520px rule that stacked them vertically.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui115`.

### UI — Roadmap modal footer meta collapsible (phones/tablets) — 2026-06-06 — Product Team — Impact: user-visible

- Roadmap modal footer metadata (Roadmap ID, dates, financial EUR, exchange rate, RICE) is wrapped in a `<details>` disclosure on viewports ≤1024px, **collapsed by default** to save vertical space; tap **Roadmap details** to expand.
- Desktop (>1024px) continues to show both meta cards without a toggle.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui115`.

### UI — Roadmap modal touch scroll (phones/tablets) — 2026-06-06 — Product Team — Impact: user-visible

- Fixed roadmap create/view/edit modal scrolling on touch devices by completing the flex height chain through `#roadmapForm` so `#roadmapModalScrollRegion` has a bounded height and `overflow-y: auto` can scroll.
- Footer bar is pinned with flex layout instead of `position: sticky`, which prevented overlap when content could not scroll.
- Removed conflicting `height: 100%` override at ≤920px that broke the full-viewport panel sizing from the ≤1024px rules.
- Footer polish (phones/tablets): meta cards are easier to scan (right-aligned values, monospaced + ellipsis for Roadmap ID), and actions sit on a clean second row on compact layouts.
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

### UI — Roadmap modal footer meta (tablet/phone) — 2026-06-06 — Product Team — Impact: user-visible

- Roadmap modal footer metadata cards use a **2-column grid** on tablets/phones for faster scanning.
- Cards only stack to a single column on very narrow screens.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui113`.

### UI — Roadmap modal max height (phones/tablets) — 2026-06-06 — Product Team — Impact: user-visible

- Roadmap modal now uses **near full-screen height** on phones and tablets (iOS + Android) to show more roadmap context.
- Content scrolls within the modal; footer remains accessible.
- Safe-area padding is respected on iOS notch devices.
- Cache bust: `APP_ASSET_VERSION` = `20260528-ui113`.

### UI — Table revamp + actions overlap fixes — 2026-05-27 — Product Team — Impact: user-visible

- Modernized table layout to prevent header/row overlaps and cramped columns, especially the Actions cell.
- Actions render as an icon-only horizontal toolbar inside the Actions cell (stable alignment across breakpoints).
- Additional layout layers loaded: `table-revamp-modern.css`, `table-rows-modern.css`, `roadmap-actions-modern.css`, `layout-flow.css`, `views-density.css`, `portfolio-cards-compact.css`.

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
- **Table:** `table-compact.css` — phone-style toolbar, floating **selection bar** for bulk delete, FAB for new roadmap.
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
- Board, MoSCoW, and Map no longer leak roadmap data when profile is locked.
- Session unlock resets on tab close/refresh; inline unlock on locked banner.
- Delete protected profile requires correct password.

### Data — Import / export — 2026-05-26 — Product Team — Impact: user-visible

- JSON export includes workspace preferences; CSV is flat roadmap rows.
- Import merges profiles/roadmaps by ID without duplicate corruption for same IDs.

### Product — Explainability & filters — 2026-05-26 — Product Team — Impact: user-visible

- Single visible tooltip app-wide; standardized modal field tooltips.
- RICE tooltip: abbreviations, formula, calculation line.
- Table **Framework** column + advanced **Framework** filter naming.
- Roadmap modal footer: Roadmap ID, timestamps, RICE, financial/EUR context.
- Board/MoSCoW card tooltips: status + description.

### Infra — Vercel deployment — 2026-05-26 — Product Team — Impact: developer + ops

- `vercel.json`: static deploy, security headers (CSP), asset caching.
- `package.json`, `.gitignore`, `.vercelignore`; `docs/DEPLOYMENT.md` smoke tests.

---

## [1.x] — Prior baseline (pre-2.0.0 UI refresh)

Earlier iterations introduced core RICE scoring, multi-view planning (table/board/MoSCoW/map), financial frameworks, and JSON/CSV portability. Detailed history before 2026-05-26 was consolidated into **2.0.0** during the documentation audit.

For archaeology, refer to git history on `main` and agent transcripts cited in roadmap README.

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
