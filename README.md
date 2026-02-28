# Product Management Prioritization Tool

**Local-first, no-backend** web application for prioritizing projects using the [RICE framework](https://www.intercom.com/blog/rice-scoring-model/) (Reach × Impact × Confidence ÷ Effort). All data is stored in the browser. No account, server, or build step required.

This README describes the product overview, benefits, features, logics, data model, business and technical guidelines, tech stack, and repository structure of the **Product Management Prioritization Tool** as implemented in this repository.

---

## Table of contents

1. [Product overview](#1-product-overview)
2. [Prerequisites and requirements](#2-prerequisites-and-requirements)
3. [Getting started](#3-getting-started)
4. [Product benefits](#4-product-benefits)
5. [Features](#5-features)
6. [Logics and data model](#6-logics-and-data-model)
7. [Business guidelines](#7-business-guidelines)
8. [Tech stack and technical guidelines](#8-tech-stack-and-technical-guidelines)
9. [Screens and key UI](#9-screens-and-key-ui)
10. [Limitations and considerations](#10-limitations-and-considerations)
11. [License](#11-license)

---

## 1. Product overview

### 1.1 Purpose

The tool helps product managers and teams **capture**, **score**, **rank**, and **track** projects in one place. It provides:

- **RICE scoring** – Consistent prioritization using **Reach × Impact × Confidence ÷ Effort**.
- **Portfolio separation** – Multiple profiles (e.g. per team or product) with separate project lists and optional board order.
- **Dual views** – **Table** for sortable, filterable lists and bulk actions; **Board** for status-based columns and drag-and-drop.
- **Data ownership** – Export/import JSON or CSV; no vendor lock-in.

### 1.2 Target users

- Product managers maintaining roadmaps and backlogs.
- Teams that need a shared view of project status and RICE scores.
- Anyone who wants a simple, local prioritization tool without sign-up or backend.

### 1.3 Key concepts

| Term | Meaning |
|------|--------|
| **Profile** | A container for projects (e.g. “Q1 roadmap”, “Team Alpha”). Each profile has its own projects, optional board order, and can be viewed/edited via modals. |
| **RICE** | Prioritization formula: **(Reach × Impact × Confidence) ÷ Effort**. Higher score = higher priority. |
| **Board order** | When “Sort by RICE” is off, the order of cards in each board column is stored per profile and per status. |
| **Merge (import)** | Imported data is merged by profile (ID or name) and by project ID; duplicates are skipped. |

### 1.4 High-level flow

1. **Create a profile** – Enter profile name and optional team; click **Add**.
2. **Add projects** – With a profile selected, click **+ Project** and fill RICE inputs plus optional metadata (type, status, countries, period, etc.).
3. **View and prioritize** – Use **Table** for sorting and filtering, or **Board** for status columns and drag-and-drop.
4. **Change status** – In Board view, drag cards between columns to update status; optionally turn off “Sort by RICE” to use manual card order.
5. **Export or import** – Use **Export data** (JSON/CSV) for backup; **Import data** to merge from another export.

---

## 2. Prerequisites and requirements

| Requirement | Details |
|-------------|--------|
| **Browser** | Modern browser with JavaScript enabled and `localStorage` support (e.g. Chrome, Firefox, Safari, Edge). |
| **Network** | Optional: only for loading Google Fonts (Inter). App runs fully offline after first load if fonts are cached. |
| **Backend** | None. No server, database, or API. |
| **Build** | None. Plain HTML, CSS, and JavaScript; no bundler or Node required to run. |

---

## 3. Getting started

### 3.1 Run the app

**Option A – No tooling**

1. Open the `rice-prioritizer` folder.
2. Double-click `index.html` or open it from your browser (File → Open).
3. The app loads; data is stored in this browser’s `localStorage`.

**Option B – Local static server (recommended for development)**

```bash
cd rice-prioritizer
npx serve .
# or: python3 -m http.server 8000
```

Then open `http://localhost:3000` (or `http://localhost:8000` for Python).

### 3.2 First-time use

1. **Create a profile** – Enter a profile name (and optional team), click **Add**.
2. **Add a project** – Click **+ Project**, fill required RICE fields (title, reach value, impact 1–5, confidence 0–100, effort 1–5), then **Save**.
3. **Switch views** – Use **Table** for a sortable list; **Board** for status columns and drag-and-drop.
4. **Export** – Use **Export data** → JSON or CSV to back up your data.

---

## 4. Product benefits

| Benefit | Description |
|--------|-------------|
| **Single source of truth** | One place for project metadata and RICE scores; table and board stay in sync. |
| **Portfolio-ready** | Multiple profiles for different owners, teams, or products; switch context with one click. |
| **Transparent prioritization** | RICE formula is visible; the **?** next to the score shows the exact calculation. |
| **Flexible workflow** | Table for bulk review and sort; board for status flow and manual ordering when “Sort by RICE” is off. |
| **Data ownership** | Export JSON/CSV anytime; no lock-in; data stays in your control. |
| **Low friction** | No sign-up, no backend; runs from a folder or static server. |
| **Accessibility** | Semantic HTML, ARIA where needed, keyboard-friendly controls, and screen-reader support for key UI. |
| **Profile insights** | View profile modal shows statistics (projects by status, type, T-shirt size, RICE summary, unique countries). |
| **Clear confirmations** | Bottom-right toasts confirm every successful create, update, delete, export, and import—with details (e.g. export/import counts and format). |

---

## 5. Features

### 5.1 Profiles / owners

| Action | Description |
|--------|-------------|
| **Create profile** | Name (required) and optional team; each profile has its own project list and optional board order. |
| **Switch profile** | Click a profile pill to make it active; table, board, and filters apply to that profile. |
| **View profile** | View icon on the profile pill opens a read-only modal with profile name, team, and statistics (total projects, unique countries, counts by status/type/T-shirt size, RICE score summary). |
| **Edit profile** | Edit icon on the profile pill opens a modal to update profile name and team. |
| **Delete profile** | Delete icon (with confirmation modal); all projects in that profile are removed permanently. |

### 5.2 Projects

| Action | Description |
|--------|-------------|
| **Add project** | With a profile selected, **+ Project** opens the project form (add mode). |
| **Edit project** | **Edit** in table or board opens the form with all fields editable. |
| **View project** | **View** opens a read-only modal (no edit or add/remove country). |
| **Delete project** | **Delete** opens confirmation; **Delete Selected** (table) bulk-deletes checked projects after browser confirm. |

### 5.3 RICE inputs (per project)

| Field | Type | Role in formula |
|-------|------|-----------------|
| **Reach** | Description + integer (≥ 0) | R in (R × I × C) ÷ E |
| **Impact** | Description + 1–5 (Minimal → Massive) | I |
| **Confidence** | Description + 0–100% | C (stored as %; if > 1, divided by 100 in formula) |
| **Effort** | Description + 1–5 (Tiny → Huge) | E (must be > 0) |

**RICE score** = **(Reach × Impact × Confidence) ÷ Effort**. Shown in table and board; **?** next to the score opens a popup with the formula and exact calculation.

### 5.4 Optional project fields

| Field | Description |
|-------|-------------|
| **Financial impact** | Optional number + currency; not used in RICE; for reporting. |
| **Project type** | New Product, Improvement, Tech Debt, Market Expansion (with icons in table/board). |
| **Project status** | Not Started, In Progress, On Hold, Done, Cancelled; drives board columns. |
| **T-shirt size** | XS, S, M, L, XL; tooltips describe sprint-level sizing (see [practical guide](https://rifqi-tjahyono.com/story-points-demystified-a-practical-guide-for-modern-product-teams/)). |
| **Project period** | Optional `YYYY-Qn` (e.g. 2026-Q1); filterable. |
| **Target countries** | Multi-select from a global list; shown as 2-letter ISO codes and flags in table. |

### 5.5 Filters

- **Basic:** Project title (search), Project type, Countries (multi-select with search), Project period (multi-select).
- **Advanced (toggle):** Impact, Effort, Currency, Status, T-shirt size.
- **Reset** clears all filters; active filter count is shown when any filter is applied.
- Filters apply to both table and board views.

### 5.6 Sort (table view)

- **Sortable columns:** Project title, Project type, Status, T-shirt size, RICE score, Financial impact, Created, Modified.
- **Default:** Created date descending.
- Click a column header to sort by that field; click again to toggle ascending/descending.

### 5.7 Table view

- Sortable columns, row checkboxes for bulk delete, tooltips for description and RICE breakdown.
- **Columns:** Checkbox, Project, Project type, Status, Project period, T-shirt size, RICE score, RICE values, Financial impact, Created, Actions (View, Edit, Delete).

### 5.8 Board view (Scrum-style)

| Aspect | Description |
|--------|-------------|
| **Columns** | One per project status: Not Started, In Progress, On Hold, Done, Cancelled. Column headers use status-specific colors (slate, blue, amber, green, red). |
| **Cards** | Title, RICE score, T-shirt size, project type icon; **View**, **Edit**, **Delete** buttons on each card. Card body is for drag only (no click-to-view). |
| **Sort by RICE (desc)** | **On:** cards in each column sorted by RICE score (highest first). **Off:** manual order; drag to reorder within a column or move between columns; order is saved per profile per status. |
| **Drag-and-drop** | Move a card to another column to change its status. When “Sort by RICE” is off, drop position sets the card’s position in that column (persisted). Dragging from the action buttons does not start a drag. |
| **Profile alignment** | Board always shows projects for the **currently selected profile**; switching profile or changing filters re-renders the board. |

### 5.9 Export and import

| Action | Behavior |
|--------|----------|
| **Export** | **Export data** → **JSON** or **CSV**. Downloads all profiles and projects (including board order). Filename includes timestamp. A **toast** (bottom-right) confirms success and shows how many profiles and projects were exported and the format (JSON or CSV). |
| **Import** | **Import data** → **JSON** or **CSV**. Data is **merged**: profiles matched by ID or name get projects merged by project ID (duplicates skipped). New profiles and new projects are added. A **toast** confirms success with: profiles added, profiles merged, projects added, projects merged, and source format (JSON or CSV). |

### 5.10 Confirmations (toasts)

- **Location:** Bottom-right of the viewport; same style for all confirmations (green accent, checkmark icon, slide-in/out, auto-dismiss, click to dismiss).
- **Deletion:** Profile deleted; project deleted; N projects deleted.
- **Creation:** Profile created; project created.
- **Modification:** Profile updated; project updated.
- **Export:** “Exported X profile(s) and Y project(s) as JSON/CSV.”
- **Import:** “Imported from JSON/CSV. X profiles added, Y merged, Z projects added, W merged.”

### 5.11 Product description tooltip

- A **?** icon next to the app title opens a **Product Description** tooltip with the product summary. No subtitle is shown under the title; the same text is available in this tooltip.

### 5.12 UI behavior

- **Product description:** ? icon next to title opens tooltip; no subtitle under title.
- Project description in a tooltip on table row hover.
- Modals: project (add/edit/view), profile view, profile edit, profile delete, project delete, export format, import format; backdrop click or **Close** dismisses.
- Accessible labels, ARIA attributes, and keyboard support for main controls (e.g. view toggle, board columns).
- **Toasts:** Fixed container `#toastContainer` (sibling of app-shell); `showToast(message)` appends a toast; used for create/update/delete/export/import confirmations.

---

## 6. Logics and data model

### 6.1 RICE formula

- **Score** = (Reach × Impact × Confidence) ÷ Effort.
- **Confidence:** stored as 0–100; if value > 1, it is divided by 100 before use (e.g. 50% → 0.5).
- **Effort:** must be > 0; otherwise score is 0.
- Score is computed on demand (not stored). Display: up to 2 decimal places, or 0 decimals for values ≥ 1000.

### 6.2 Validation (project form)

- **Required:** Title, Reach (non-negative integer), Impact (1–5), Confidence (0–100), Effort (1–5).
- **Optional:** Financial impact (non-negative); if non-zero, currency required. Project period, if set, must match `YYYY-Qn`.

### 6.3 Storage

- **Key:** `rice_prioritizer_v1` in `localStorage`.
- **Root payload:**  
  `{ profiles, activeProfileId, sortField, sortDirection, projectsView, scrumBoardSortByRice }`

### 6.4 Profile schema

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier. |
| `name` | string | Display name. |
| `team` | string | Optional team label. |
| `createdAt` | string | ISO 8601 date. |
| `projects` | array | Array of project objects. |
| `boardOrder` | object | Optional. `{ [status]: [projectId, ...] }`; used when “Sort by RICE” is off. |

### 6.5 Project schema

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier. |
| `title` | string | Project name. |
| `description` | string | Long-form context. |
| `reachValue`, `reachDescription` | number, string | RICE Reach. |
| `impactValue`, `impactDescription` | number, string | RICE Impact (1–5). |
| `confidenceValue`, `confidenceDescription` | number, string | RICE Confidence (0–100). |
| `effortValue`, `effortDescription` | number, string | RICE Effort (1–5). |
| `financialImpactValue` | number \| null | Optional. |
| `financialImpactCurrency` | string \| null | Optional; required if financial impact non-zero. |
| `projectType` | string \| null | New Product, Improvement, Tech Debt, Market Expansion. |
| `projectStatus` | string \| null | Not Started, In Progress, On Hold, Done, Cancelled. |
| `tshirtSize` | string \| null | XS, S, M, L, XL. |
| `projectPeriod` | string \| null | YYYY-Qn. |
| `countries` | string[] | Target country names. |
| `createdAt`, `modifiedAt` | string | ISO 8601 dates. |

RICE score is not stored; it is computed from the RICE fields when needed.

### 6.6 Board order (manual sort)

- When **Sort by RICE (desc)** is **off**:
  - Column order comes from `profile.boardOrder[status]` (array of project IDs).
  - Projects not in `boardOrder` appear after ordered ones (filter order).
  - Dragging within a column updates `boardOrder[status]`. Dragging to another column updates the project’s status and inserts its ID at the drop index in `boardOrder[newStatus]`.
- When **Sort by RICE** is **on**, columns are sorted by RICE score only; `boardOrder` is ignored for display.

### 6.7 Import merge rules

- **Profiles:** Matched by `id` or `name`. If matched, projects are merged by project `id` (duplicates skipped). If no match, profile is added.
- **Projects:** New projects on an existing profile are appended; existing project IDs are not duplicated. Projects added to existing profiles count as **merged projects**; projects that come with newly added profiles count as **added projects**.
- **Merge result:** The merge function returns `addedProfiles`, `mergedProfiles`, `addedProjects`, `mergedProjects`, and `skippedProjects` for use in the import confirmation toast.

---

## 7. Business guidelines

1. **Create a profile first** – At least one profile is required before adding projects.
2. **Use consistent RICE definitions** – Agree on Reach (e.g. users/quarter), Impact 1–5, Confidence %, and Effort 1–5 so scores are comparable across projects.
3. **Use View for read-only** – Share or review projects and profiles without risk of edits.
4. **Export regularly** – Data lives only in this browser; export JSON or CSV to back up or move to another device.
5. **Import merges** – Imported data is merged by profile and project ID; duplicates are avoided.
6. **Use filters and sort** – Narrow by type, status, period, or country; sort by RICE or date to focus on what to do next.
7. **Use the board for status** – Track Not Started → In Progress → Done; turn off “Sort by RICE” when you want to order items manually within a column.
8. **Use profile view for portfolio health** – Check profile statistics (by status, type, T-shirt size, RICE) to balance workload and priorities.
9. **Use the Product Description ?** – Click the **?** next to the app title to read the product summary in a tooltip.

---

## 8. Tech stack and technical guidelines

### 8.1 Tech stack

| Layer | Technology |
|-------|------------|
| **Markup** | HTML5 (single page, semantic sections). |
| **Styles** | CSS3 (custom properties, flexbox/grid, responsive). |
| **Scripting** | Vanilla JavaScript; classic scripts (no ES modules in default run), no framework or build. |
| **Fonts** | Google Fonts (Inter). |
| **Persistence** | Browser `localStorage` (key: `rice_prioritizer_v1`). |
| **Backend** | None; local-first, no server or auth. |
| **Theme / UX** | Dark theme via CSS custom properties; `prefers-reduced-motion` respected for transitions. Single CSS file (`main.css`). |

### 8.2 Folder directory (source code and files)

The repository contains the following source files (excluding version control and system files):

| Path | Purpose |
|------|--------|
| `index.html` | Single HTML page: app shell, header (title + Product Description ? tooltip), profiles panel, filters, table/board containers, all modals (project, profile view/edit/delete, export/import format, project delete). Loads `css/main.css` and scripts in order: `constants.js` → `utils.js` → `rice.js` → `app.js`. Contains `#toastContainer` (fixed bottom-right) for confirmation toasts. |
| `css/main.css` | All styles: CSS custom properties (dark theme, colors, radii, shadows, transitions), layout (app-shell, header, profiles, projects, filters), table, board, cards, board column header colors by status, card action buttons, modals, form controls, toast (bottom-right confirmations), responsive and `prefers-reduced-motion` support. |
| `src/constants.js` | Application constants and lookup data: `STORAGE_KEY`, `projectStatusList`, `projectStatusIcons`, `tshirtSizeList`, `tshirtSizeTooltips`, `projectTypeIcons`, `currencyList`, `countryList`, `countryCodeByName`. No DOM. |
| `src/utils.js` | Pure helpers: `formatDateTime`, `formatDate`, `formatDateForFilename`, `compareDatesDesc`, `generateId`, `escapeHtml`, `countryCodeToFlag`, `toNumberOrNull`, `parseCsv`, `escapeCsvCell`. No DOM. |
| `src/rice.js` | RICE logic: `calculateRiceScore`, `formatRice`, `validateProjectInput`. No DOM. |
| `src/app.js` | Main application: state, DOM element cache, `init`, `cacheElements`, currency/filter init, event listeners, load/save state, profile/project CRUD, render (profiles, table, board), drag-and-drop, all modals, getExportCounts, showToast, export/import with detailed toasts. Ends with `document.addEventListener("DOMContentLoaded", init)` to boot the app. |
| `src/main.js` | Optional ES-module entry point (`import { init } from "./app.js"`; then `DOMContentLoaded` → `init`). **Not loaded by `index.html`**; the app runs by loading `app.js` as a classic script, which registers its own `DOMContentLoaded` listener. Use `main.js` only if you serve the app through a bundler or module-aware dev server. |
| `README.md` | This documentation. |

### 8.3 Code structure (tree)

```
rice-prioritizer/
├── index.html          # Single page: layout, forms, modals; loads CSS and scripts (see table above)
├── css/
│   └── main.css        # All styles (variables, layout, table, board, modals, responsive)
├── src/
│   ├── constants.js    # STORAGE_KEY, projectStatusList, projectStatusIcons, tshirtSizeList,
│   │                   # tshirtSizeTooltips, projectTypeIcons, currencyList, countryList,
│   │                   # countryCodeByName
│   ├── utils.js        # formatDateTime, formatDate, formatDateForFilename, compareDatesDesc,
│   │                   # generateId, escapeHtml, countryCodeToFlag, toNumberOrNull,
│   │                   # parseCsv, escapeCsvCell
│   ├── rice.js         # calculateRiceScore, formatRice, validateProjectInput
│   ├── app.js          # State, DOM cache, init, filters, render (table + board), drag-and-drop,
│   │                   # modals (project, profile view/edit/delete), getExportCounts, showToast,
│   │                   # export/import with toasts. Boots via document.addEventListener("DOMContentLoaded", init) at end of file.
│   └── main.js         # Optional ES module entry; not loaded by index.html
└── README.md
```

### 8.4 File roles

| File | Role |
|------|------|
| **constants.js** | Config and lookup data: `STORAGE_KEY`, `projectStatusList`, `projectStatusIcons`, `tshirtSizeList`, `tshirtSizeTooltips`, `projectTypeIcons`, `currencyList`, `countryList`, `countryCodeByName`. No DOM. |
| **utils.js** | Pure helpers: dates, IDs, CSV parse/escape, HTML escaping, country code to flag. No DOM. |
| **rice.js** | RICE calculation and validation. No DOM. |
| **app.js** | State, element cache, init, all UI and event logic, render (profiles, table, board), modals, getExportCounts, showToast, import/export. Section comments: State & DOM cache, Initialization, Filters, Render, Export/Import, etc. Boot: `DOMContentLoaded` → `init` at end of file. |

### 8.5 Script load order and boot

Scripts are loaded in order: `constants.js` → `utils.js` → `rice.js` → `app.js`. The app boots when `app.js` runs and registers `document.addEventListener("DOMContentLoaded", init)` at the end of the file; `init()` runs after the DOM is ready. No ES modules are used in the default setup (opening `index.html` or serving via static server); all scripts run in the global scope. The file `main.js` is **not** referenced in `index.html` and is only useful if you use an ES-module–aware bundler or dev server.

### 8.6 Technical guidelines for contributors

- **No DOM in constants/utils/rice** – Keep these files pure for testability and reuse.
- **Single storage key** – All app state under `rice_prioritizer_v1`; version key allows future migrations.
- **Ids** – Use `generateId(prefix)` for profile and project IDs to avoid collisions.
- **Escaping** – Use `escapeHtml` for user content in HTML; use `escapeCsvCell` for CSV export.
- **Accessibility** – Use semantic HTML, ARIA where needed, and keyboard support for primary actions.

### 8.7 Global dependencies (for development)

`app.js` relies on globals provided by the other scripts (no module imports in the default run):

- **From constants.js:** `STORAGE_KEY`, `projectStatusList`, `projectStatusIcons`, `tshirtSizeList`, `tshirtSizeTooltips`, `projectTypeIcons`, `currencyList`, `countryList`, `countryCodeByName`
- **From rice.js:** `calculateRiceScore`, `formatRice`, `validateProjectInput`
- **From utils.js:** `formatDateTime`, `formatDate`, `formatDateForFilename`, `compareDatesDesc`, `generateId`, `escapeHtml`, `countryCodeToFlag`, `toNumberOrNull`, `parseCsv`, `escapeCsvCell`

When changing or renaming any of these, ensure all consumers in `app.js` (and in `index.html` if any IDs or structure change) are updated.

---

## 9. Screens and key UI

Brief reference for where data appears. Add screenshots to the repo and link them here if desired.

### 9.1 App header and profiles

- **Header:** App title with **?** icon (Product Description tooltip); no subtitle under title. **Export data**, **Import data**.
- **Profiles panel:** Form (Profile name, Team optional), **Add**; list of profile pills. Each pill: click to select; View / Edit / Delete icon buttons. Active profile highlighted.

### 9.2 Projects header and view toggle

- Active profile name and subtitle; optional badges.
- **Table** | **Board** toggle; **+ Project**; **Delete Selected** (enabled when at least one project is selected in table view).

### 9.3 Filters

- Basic: title search, type, countries, project period. Advanced: impact, effort, currency, status, T-shirt size. **Reset**; active filter count.

### 9.4 Table view

- Columns: Checkbox, Project, Type, Status, Period, T-shirt, RICE score, RICE values, Financial impact, Created, Actions. Sort by header click; description tooltip on hover; **?** for RICE formula.

### 9.5 Board view

- Toolbar: status legend, **Sort by RICE (desc)** checkbox. Column headers colored by status. Columns per status with counts; cards show title, RICE, T-shirt, type icon, and **View / Edit / Delete** buttons; drag card body to move or reorder (when manual sort is on).

### 9.6 Project modal (add/edit/view)

- Sections: overview (title, description), RICE inputs, optional (financial, type, status, T-shirt, period, countries). Edit/Add: **Save** / **Cancel**. View: read-only. Meta: Created, Modified, RICE score.

### 9.7 Profile view modal

- Read-only: profile name, team; statistics (total projects, unique countries, counts by status/type/T-shirt size, RICE score summary).

### 9.8 Profile edit modal

- Editable: profile name, team; **Save** / **Cancel**.

### 9.9 Export / Import modals

- Export: **Export as JSON** or **Export as CSV**. Import: **Import JSON** or **Import CSV**; file is merged into current data.

### 9.10 Toast confirmations (bottom-right)

- After create, update, delete (profile or project), export, or import, a toast appears bottom-right with a short message (e.g. “Profile created successfully.” or “Exported 2 profiles and 5 projects as JSON.”). Toasts auto-dismiss after a few seconds; click to dismiss early.

---

## 10. Limitations and considerations

| Topic | Detail |
|-------|--------|
| **Single browser** | Data is in one browser’s `localStorage`; not synced across devices or browsers. Use export/import to move data. |
| **No auth** | Anyone with access to the browser can see and change data. Do not use for sensitive or regulated data. |
| **Storage quota** | Subject to browser `localStorage` limits (~5–10 MB typical). Large exports may hit limits. |
| **CORS / file://** | Opening `index.html` via `file://` may behave differently than via `http://`. Use a static server for consistent behavior. |
| **No versioning** | No built-in history or undo; export regularly to keep backups. |

---

## 11. License

Use and modify as needed for your context.
