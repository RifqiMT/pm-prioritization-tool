# Product Management Prioritization Tool

**Local-first, no-backend** web application for prioritizing projects using the [RICE framework](https://www.intercom.com/blog/rice-scoring-model/) (Reach × Impact × Confidence ÷ Effort) and the **MoSCoW method** (Must have, Should have, Could have, Won't have). All data is stored in the browser. No account, server, or build step required.

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
- **MoSCoW categorisation** – Classify projects as Must have, Should have, Could have, or Won't have; default for new projects is **Could have**.
- **Portfolio separation** – Multiple profiles (e.g. per team or product) with separate project lists and optional board order.
- **Four views** – **Table** for sortable, filterable lists and bulk actions; **Board** for status-based columns and drag-and-drop; **MOSCOW** for a 2×2 quadrant grid by MoSCoW category; **Map** for a world choropleth of project count or RICE score by target country.
- **Data ownership** – Export/import JSON or CSV; no vendor lock-in.

### 1.2 Target users

- Product managers maintaining roadmaps and backlogs.
- Teams that need a shared view of project status, RICE scores, and MoSCoW priorities.
- Anyone who wants a simple, local prioritization tool without sign-up or backend.

### 1.3 Key concepts

| Term | Meaning |
|------|--------|
| **Profile** | A container for projects (e.g. “Q1 roadmap”, “Team Alpha”). Each profile has its own projects, optional board order, and can be viewed/edited via modals. |
| **RICE** | Prioritization formula: **(Reach × Impact × Confidence) ÷ Effort**. Higher score = higher priority. |
| **MoSCoW** | Prioritisation method: **M**ust have, **S**hould have, **C**ould have, **W**on't have (this time). Each project has a **MOSCOW category** (`moscowCategory`); new projects default to “Could have”. |
| **Board order** | When “Sort by RICE” is off, the order of cards in each board column is stored per profile and per status. |
| **MOSCOW view** | 2×2 grid of quadrants (Must / Should / Could / Won't) with short descriptions; drag cards between quadrants to change category. |
| **Map view** | Choropleth world map colored by project count or RICE score per target country; uses canonical country names and 2-letter codes (e.g. Taiwan). |
| **Merge (import)** | Imported data is merged by profile (ID or name) and by project ID; duplicates are skipped. Country names are normalized to the canonical list on import. |

### 1.4 High-level flow

1. **Create a profile** – Enter profile name and optional team; click **Add**.
2. **Add projects** – With a profile selected, click **+ Project** and fill RICE inputs plus optional metadata (type, status, MOSCOW category, T-shirt size, countries, period, etc.). New projects default to MOSCOW category **Could have**.
3. **View and prioritize** – Use **Table** for sorting and filtering; **Board** for status columns and drag-and-drop; **MOSCOW** for the 2×2 quadrant grid and drag-between-categories; or **Map** for a geographic view by target country.
4. **Change status or MOSCOW** – In Board view, drag cards between columns to update status; optionally turn off “Sort by RICE” to use manual card order. In MOSCOW view, drag cards between quadrants to change MOSCOW category.
5. **Export or import** – Use **Export data** (JSON/CSV) for backup; **Import data** to merge from another export (country names normalized to canonical list).

---

## 2. Prerequisites and requirements

| Requirement | Details |
|-------------|--------|
| **Browser** | Modern browser with JavaScript enabled and `localStorage` support (e.g. Chrome, Firefox, Safari, Edge). |
| **Network** | Optional: for Google Fonts (Inter) and, in Map view, for loading Leaflet tiles and Natural Earth GeoJSON. App runs offline for table, board, and MOSCOW after first load if fonts and map data are cached. |
| **Backend** | None. No server, database, or API. |
| **Build** | None. Plain HTML, CSS, and JavaScript; no bundler or Node required to run. |

---

## 3. Getting started

### 3.1 Run the app

**Option A – No tooling**

1. Open the `pm-prioritization-tool` folder.
2. Double-click `index.html` or open it from your browser (File → Open).
3. The app loads; data is stored in this browser’s `localStorage`.

**Option B – Local static server (recommended for development)**

```bash
cd pm-prioritization-tool
npx serve .
# or: python3 -m http.server 8000
```

Then open `http://localhost:3000` (or `http://localhost:8000` for Python).

### 3.2 First-time use

1. **Create a profile** – Enter a profile name (and optional team), click **Add**.
2. **Add a project** – Click **+ Project**, fill required RICE fields (title, reach value, impact 1–5, confidence 0–100, effort 1–5), then **Save**. The MOSCOW category defaults to “Could have”.
3. **Switch views** – Use **Table**, **Board**, **MOSCOW**, or **Map**.
4. **Export** – Use **Export data** → JSON or CSV to back up your data.

---

## 4. Product benefits

| Benefit | Description |
|--------|-------------|
| **Single source of truth** | One place for project metadata, RICE scores, and MOSCOW category; all views stay in sync. |
| **Dual frameworks** | RICE for numeric prioritisation; MoSCoW for requirement categorisation (Must/Should/Could/Won't). |
| **Portfolio-ready** | Multiple profiles for different owners, teams, or products; switch context with one click. |
| **Transparent prioritization** | RICE formula is visible; the **?** next to the score shows the exact calculation. |
| **Flexible workflow** | Table for bulk review and sort; Board for status flow and manual ordering; MOSCOW for category-based prioritisation; Map for geographic distribution. |
| **MOSCOW 2×2 grid** | Clear quadrant layout with one-sentence descriptions per category; drag cards to change category; fullscreen for presentations. |
| **Fullscreen on all main views** | Board, MOSCOW, and Map each have a **Full screen** button; exit via button or Escape. |
| **Geographic view** | Map view shows project count or RICE score per country with choropleth coloring, country flags in tooltips, and fullscreen; supports all countries including Taiwan. |
| **Consistent country data** | Single canonical country list and name aliases (e.g. Chinese Taipei → Taiwan); normalization on load and import. |
| **Filter by “Not set”** | Project type and T-shirt size filters include **Not set** to show only projects with no type or no size. |
| **Data ownership** | Export JSON/CSV anytime; no lock-in; data stays in your control. |
| **Low friction** | No sign-up, no backend; runs from a folder or static server. |
| **Accessibility** | Semantic HTML, ARIA where needed, keyboard-friendly controls, and screen-reader support for key UI. |
| **Profile insights** | View profile modal shows statistics (projects by status, type, T-shirt size, RICE summary, unique countries). |
| **Clear confirmations** | Bottom-right toasts confirm every successful create, update, delete, export, and import. |

---

## 5. Features

### 5.1 Profiles / owners

| Action | Description |
|--------|-------------|
| **Create profile** | Name (required) and optional team; each profile has its own project list and optional board order. |
| **Switch profile** | Click a profile pill to make it active; table, board, MOSCOW, map, and filters apply to that profile. |
| **View profile** | View icon on the profile pill opens a read-only modal with profile name, team, and statistics. |
| **Edit profile** | Edit icon on the profile pill opens a modal to update profile name and team. |
| **Delete profile** | Delete icon (with confirmation modal); all projects in that profile are removed permanently. |

### 5.2 Projects

| Action | Description |
|--------|-------------|
| **Add project** | With a profile selected, **+ Project** opens the project form (add mode). MOSCOW category defaults to **Could have**. |
| **Edit project** | **Edit** in table, board, or MOSCOW opens the form with all fields editable. |
| **View project** | **View** opens a read-only modal. |
| **Delete project** | **Delete** opens confirmation; **Delete Selected** (table) bulk-deletes checked projects after confirm. |

### 5.3 RICE inputs (per project)

| Field | Type | Role in formula |
|-------|------|-----------------|
| **Reach** | Description + integer (≥ 0) | R in (R × I × C) ÷ E |
| **Impact** | Description + 1–5 (Minimal → Massive) | I |
| **Confidence** | Description + 0–100% | C (stored as %; if > 1, divided by 100 in formula) |
| **Effort** | Description + 1–5 (Tiny → Huge) | E (must be > 0) |

**RICE score** = **(Reach × Impact × Confidence) ÷ Effort**. Shown in table, board, and MOSCOW cards; **?** next to the score opens a popup with the formula and exact calculation.

### 5.4 Optional project fields

| Field | Description |
|-------|-------------|
| **MOSCOW category** | Must have, Should have, Could have, Won't have. Default for **new projects** is **Could have**. Used in MOSCOW view and filters. |
| **Financial impact** | Optional number + currency; not used in RICE; for reporting. |
| **Project type** | New Product, Improvement, Tech Debt, Market Expansion (with icons in table/board). Filter supports **Not set** to show projects with no type. |
| **Project status** | Not Started, In Progress, On Hold, Done, Cancelled; drives board columns. |
| **T-shirt size** | XS, S, M, L, XL; tooltips describe sprint-level sizing. Filter supports **Not set** to show projects with no size. |
| **Project period** | Optional `YYYY-Qn` (e.g. 2026-Q1); filterable. |
| **Target countries** | Multi-select from a global list; shown as 2-letter ISO codes and flags in table. |

### 5.5 Filters

- **Basic:** Project title (search), Project type (including **Not set**), Countries (multi-select with search), Project period (multi-select).
- **Advanced (toggle):** Impact, Effort, Currency, Status, T-shirt size (including **Not set**), **MOSCOW** (Must have / Should have / Could have / Won't have).
- **Reset** clears all filters; active filter count is shown when any filter is applied.
- Filters apply to table, board, MOSCOW, and map views.

### 5.6 Sort (table view)

- **Sortable columns:** Project title, Project type, Status, T-shirt size, **MOSCOW**, RICE score, Financial impact, Created, Modified.
- **Default:** Created date descending.
- Click a column header to sort by that field; click again to toggle ascending/descending.

### 5.7 Table view

- Sortable columns, row checkboxes for bulk delete, tooltips for description and RICE breakdown.
- **Columns:** Checkbox, Project, Project type, Status, Project period, T-shirt size, **MOSCOW**, RICE score, RICE values, Financial impact, Created, Actions (View, Edit, Delete).

### 5.8 Board view (Scrum-style)

| Aspect | Description |
|--------|-------------|
| **Columns** | One per project status: Not Started, In Progress, On Hold, Done, Cancelled. Column headers use status-specific colors. |
| **Cards** | Title, RICE score, T-shirt size, project type icon; **View**, **Edit**, **Delete** buttons on each card. |
| **Sort by RICE (desc)** | **On:** cards in each column sorted by RICE score (highest first). **Off:** manual order; drag to reorder within a column or move between columns; order is saved per profile per status. |
| **Drag-and-drop** | Move a card to another column to change its status. When “Sort by RICE” is off, drop position sets the card’s position in that column (persisted). |
| **Full screen** | **Full screen** button in the toolbar toggles the board view to fullscreen; **Exit full screen** or Escape to exit. |
| **Profile alignment** | Board always shows projects for the **currently selected profile**; switching profile or changing filters re-renders the board. |

### 5.9 MOSCOW view (MoSCoW 2×2 grid)

| Aspect | Description |
|--------|-------------|
| **Layout** | 2×2 grid: top-left **Must have**, top-right **Should have**, bottom-left **Could have**, bottom-right **Won't have**. Each quadrant shows a coloured label (MUST / SHOULD / COULD / WON'T), a single-sentence description, and project cards. |
| **Descriptions** | Must: “Essential for the product to work or meet its core goal.” Should: “Adds real value but is not required for launch.” Could: “Nice-to-have when time and resources allow.” Won't: “Out of scope for this release; can be added later.” |
| **Cards** | Same as board: title, RICE score, T-shirt size; **View**, **Edit**, **Delete**. Cards are sorted by RICE (desc) within each quadrant. |
| **Drag-and-drop** | Drag a card to another quadrant to change its **MOSCOW category**; state is persisted. |
| **Default category** | Projects without a MOSCOW category (or with an invalid value) appear in **Could have**. |
| **Full screen** | **Full screen** button in the MOSCOW header toggles the MOSCOW view to fullscreen; **Exit full screen** or Escape to exit. |
| **Responsive** | On narrow screens the grid stacks into a single column (four quadrants one above the other). |

### 5.10 Map view

| Aspect | Description |
|--------|-------------|
| **Access** | **Table** \| **Board** \| **MOSCOW** \| **Map** view toggle. Map view shows a world choropleth. |
| **Data source** | Active profile's filtered projects; each project's **Target countries** list; counts or RICE sums aggregated per country (2-letter ISO code). |
| **Show by** | Dropdown: **Number of projects** or **RICE score** per country. Choice is persisted (`mapMetric`). |
| **Choropleth** | Countries colored by value; gray when no projects target that country. Legend shows total project–country links or total RICE and country count. |
| **Tooltips** | Hover: country flag, canonical name, 2-letter code, and project count or RICE. |
| **Full screen** | **Full screen** button toggles map view to fullscreen; **Exit full screen** or Escape to exit. Leaflet map resizes correctly on enter/exit. |
| **Filters** | Same filters as other views apply. |

### 5.11 Export and import

| Action | Behavior |
|--------|----------|
| **Export** | **Export data** → **JSON** or **CSV**. Downloads all profiles and projects (including board order and **moscowCategory**). Filename: `pm-prioritization-tool-export-{timestamp}.json|csv`. A **toast** confirms success and shows how many profiles and projects were exported and the format. |
| **Import** | **Import data** → **JSON** or **CSV**. Data is **merged**: profiles matched by ID or name get projects merged by project ID (duplicates skipped). New profiles and new projects are added. **moscowCategory** is read from CSV/JSON when present. A **toast** confirms success with profiles added/merged, projects added/merged, and source format. |

### 5.12 Confirmations (toasts)

- **Location:** Bottom-right of the viewport; green accent, checkmark icon, slide-in/out, auto-dismiss, click to dismiss.
- **Deletion:** Profile deleted; project deleted; N projects deleted.
- **Creation:** Profile created; project created.
- **Modification:** Profile updated; project updated.
- **Export:** “Exported X profile(s) and Y project(s) as JSON/CSV.”
- **Import:** “Imported from JSON/CSV. X profiles added, Y merged, Z projects added, W merged.”

### 5.13 Product description tooltip

- A **?** icon next to the app title opens a **Product Description** tooltip with the product summary.

### 5.14 UI behaviour

- Modals: project (add/edit/view), profile view, profile edit, profile delete, project delete, export format, import format; backdrop click or **Close** dismisses.
- Accessible labels, ARIA attributes, and keyboard support for main controls.
- **Toasts:** Fixed container `#toastContainer`; `showToast(message)` used for create/update/delete/export/import confirmations.
- **Reduced motion:** `prefers-reduced-motion: reduce` disables hover/drag transforms in MOSCOW and other views.

---

## 6. Logics and data model

### 6.1 RICE formula

- **Score** = (Reach × Impact × Confidence) ÷ Effort.
- **Confidence:** stored as 0–100; if value > 1, it is divided by 100 before use (e.g. 50% → 0.5).
- **Effort:** must be > 0; otherwise score is 0.
- Score is computed on demand (not stored). Display: up to 2 decimal places, or 0 decimals for values ≥ 1000.

### 6.2 Validation (project form)

- **Required:** Title, Reach (non-negative integer), Impact (1–5), Confidence (0–100), Effort (1–5).
- **Optional:** MOSCOW category (default **Could have** for new projects). Financial impact (non-negative); if non-zero, currency required. Project period, if set, must match `YYYY-Qn`.

### 6.3 Storage

- **Key:** `rice_prioritizer_v1` in `localStorage`.
- **Root payload:**  
  `{ profiles, activeProfileId, sortField, sortDirection, projectsView, scrumBoardSortByRice, mapMetric }`
- **projectsView:** `"table"` | `"board"` | `"moscow"` | `"map"`.
- **mapMetric:** `"projects"` | `"rice"` (used when projectsView is `"map"`).

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
| `moscowCategory` | string \| null | Must have, Should have, Could have, Won't have. Default **Could have** for new projects. |
| `projectType` | string \| null | New Product, Improvement, Tech Debt, Market Expansion. |
| `projectStatus` | string \| null | Not Started, In Progress, On Hold, Done, Cancelled. |
| `tshirtSize` | string \| null | XS, S, M, L, XL. |
| `projectPeriod` | string \| null | YYYY-Qn. |
| `countries` | string[] | Target country names (canonical only; normalized on load and import). |
| `createdAt`, `modifiedAt` | string | ISO 8601 dates. |

RICE score is not stored; it is computed from the RICE fields when needed.

### 6.6 Board order (manual sort)

- When **Sort by RICE (desc)** is **off**: column order comes from `profile.boardOrder[status]`; dragging within or between columns updates project status and/or `boardOrder`.
- When **Sort by RICE** is **on**, columns are sorted by RICE score only; `boardOrder` is ignored for display.

### 6.7 MOSCOW category

- Stored as `project.moscowCategory`. Valid values: `"Must have"`, `"Should have"`, `"Could have"`, `"Won't have"`.
- New projects default to **Could have** (form default and create logic).
- Projects with null/empty or invalid `moscowCategory` are shown in the **Could have** quadrant in MOSCOW view.
- Drag-and-drop in MOSCOW view updates `project.moscowCategory` and `project.modifiedAt`.

### 6.8 Import merge rules

- **Profiles:** Matched by `id` or `name`. If matched, projects are merged by project `id` (duplicates skipped). If no match, profile is added.
- **Projects:** New projects on an existing profile are appended; existing project IDs are not duplicated. **moscowCategory** is imported from JSON/CSV when present.
- **Merge result:** The merge function returns `addedProfiles`, `mergedProfiles`, `addedProjects`, `mergedProjects` for use in the import confirmation toast.

### 6.9 Country normalization

- **Canonical list:** `countryList` and `countryCodeByName` in `constants.js` define the single set of country names and 2-letter ISO codes.
- **Aliases:** `countryNameAliases` maps alternate names (e.g. from GeoJSON or imports) to canonical names (e.g. "Chinese Taipei" → "Taiwan").
- **Normalization:** On load (`normalizeLoadedProject`), CSV import, and JSON import (`normalizeImportedProject`), `normalizeCountryNames(names)` runs each name through `getCanonicalCountryName` and keeps only names present in `countryList`.

---

## 7. Business guidelines

1. **Create a profile first** – At least one profile is required before adding projects.
2. **Use consistent RICE definitions** – Agree on Reach, Impact 1–5, Confidence %, and Effort 1–5 so scores are comparable.
3. **Use MOSCOW for requirement prioritisation** – Classify projects as Must/Should/Could/Won't; use the MOSCOW view to review and drag to reprioritise. New projects default to Could have.
4. **Use View for read-only** – Share or review projects and profiles without risk of edits.
5. **Export regularly** – Data lives only in this browser; export JSON or CSV to back up or move to another device.
6. **Import merges** – Imported data is merged by profile and project ID; duplicates are avoided.
7. **Use filters and sort** – Narrow by type, status, MOSCOW, period, or country; use **Not set** for type/T-shirt size to find projects missing those fields; sort by RICE or date to focus on what to do next.
8. **Use the board for status** – Track Not Started → In Progress → Done; turn off “Sort by RICE” when you want to order items manually within a column.
9. **Use fullscreen for focus** – Board, MOSCOW, and Map each support fullscreen for presentations or focused work; exit with the button or Escape.
10. **Use profile view for portfolio health** – Check profile statistics (by status, type, T-shirt size, RICE) to balance workload and priorities.
11. **Use the map for geographic spread** – Map view shows project count or RICE by target country; use "Show by" to switch metric; use fullscreen for presentations.

---

## 8. Tech stack and technical guidelines

### 8.1 Tech stack

| Layer | Technology |
|-------|------------|
| **Markup** | HTML5 (single page, semantic sections). |
| **Styles** | CSS3 (custom properties, flexbox/grid, responsive, fullscreen for board/MOSCOW/map). |
| **Scripting** | Vanilla JavaScript; classic scripts (no ES modules in default run), no framework or build. |
| **Map** | Leaflet 1.9.4 (CDN); world countries GeoJSON from Natural Earth (110m, jsDelivr CDN). Choropleth and tooltips in Map view. |
| **Fonts** | Google Fonts (Inter). |
| **Persistence** | Browser `localStorage` (key: `rice_prioritizer_v1`). |
| **Backend** | None; local-first, no server or auth. |
| **Theme / UX** | Dark theme via CSS custom properties; `prefers-reduced-motion` respected for transitions. Single CSS file (`main.css`). |

### 8.2 Folder directory (source code and files)

| Path | Purpose |
|------|--------|
| `index.html` | Single HTML page: app shell, header (title + Product Description ? tooltip), profiles panel, filters, view toggle (Table \| Board \| MOSCOW \| Map), table/board/MOSCOW/map containers, fullscreen buttons for Board and MOSCOW, all modals. Loads Leaflet CSS, `css/main.css`, and scripts: `constants.js` → `utils.js` → `rice.js` → `app.js` (Leaflet JS before constants). Contains `#toastContainer` for confirmation toasts. |
| `css/main.css` | All styles: CSS custom properties (dark theme), layout, table, board, MOSCOW 2×2 grid (quadrants, labels, cards, fullscreen), map toolbar and container, fullscreen map/board/MOSCOW, modals, form controls, toast, responsive, `prefers-reduced-motion`. |
| `src/constants.js` | Application constants and lookup data: `STORAGE_KEY`, `projectStatusList`, `projectStatusIcons`, `tshirtSizeList`, `tshirtSizeTooltips`, `projectTypeIcons`, `moscowList`, `moscowTooltips`, `moscowGridOrder`, `currencyList`, `countryList`, `countryCodeByName`, `countryNameAliases`. No DOM. |
| `src/utils.js` | Pure helpers: `formatDateTime`, `formatDate`, `formatDateForFilename`, `compareDatesDesc`, `generateId`, `escapeHtml`, `countryCodeToFlag`, `countryCodeToTwoLetter`, `toNumberOrNull`, `parseCsv`, `escapeCsvCell`. Data: `ISO3_TO_ISO2`. No DOM. |
| `src/rice.js` | RICE logic: `calculateRiceScore`, `formatRice`, `validateProjectInput`. No DOM. |
| `src/app.js` | Main application: state (including `projectsView`, `mapMetric`, `scrumBoardSortByRice`), DOM cache, `getCanonicalCountryName`, `normalizeCountryNames`, init, filters (including MOSCOW and “Not set” for type/T-shirt size), render (profiles, table, board, MOSCOW grid, map), fullscreen (map, board, MOSCOW via `toggleViewFullscreen`, `onViewFullscreenChange`), `renderMoscowBoard`, `bindMoscowBoardDragAndDrop`, `getCountryCodeFromFeature`, `getProjectCountByCountryCode`, `getCountryRiceByCode`, `renderProjectsMap`, drag-and-drop (board and MOSCOW), modals, export/import (including `moscowCategory`), showToast. Boot: `DOMContentLoaded` → `init`. |
| `src/main.js` | Optional ES-module entry; **not loaded by index.html**. Use only with a bundler or module-aware dev server. |
| `README.md` | This documentation. |

### 8.3 Code structure (tree)

```
pm-prioritization-tool/
├── index.html          # Single page: layout, view toggle (Table | Board | MOSCOW | Map), fullscreen buttons, forms, modals
├── css/
│   └── main.css        # All styles (variables, layout, table, board, MOSCOW grid, map, fullscreen, modals, responsive)
├── src/
│   ├── constants.js    # STORAGE_KEY, projectStatusList, projectStatusIcons, tshirtSizeList, tshirtSizeTooltips,
│   │                   # projectTypeIcons, moscowList, moscowTooltips, moscowGridOrder, currencyList, countryList,
│   │                   # countryCodeByName, countryNameAliases
│   ├── utils.js        # formatDateTime, formatDate, formatDateForFilename, compareDatesDesc, generateId,
│   │                   # escapeHtml, countryCodeToFlag, countryCodeToTwoLetter, ISO3_TO_ISO2, toNumberOrNull,
│   │                   # parseCsv, escapeCsvCell
│   ├── rice.js         # calculateRiceScore, formatRice, validateProjectInput
│   ├── app.js          # State (projectsView, mapMetric, scrumBoardSortByRice), getCanonicalCountryName,
│   │                   # normalizeCountryNames, init, filters, render (table, board, MOSCOW, map),
│   │                   # toggleViewFullscreen, onViewFullscreenChange, renderMoscowBoard, bindMoscowBoardDragAndDrop,
│   │                   # getCountryCodeFromFeature, renderProjectsMap, fullscreen, modals, export/import, showToast.
│   │                   # Boot: DOMContentLoaded → init
│   └── main.js         # Optional ES module entry; not loaded by index.html
└── README.md
```

### 8.4 File roles

| File | Role |
|------|------|
| **constants.js** | Config and lookup: `STORAGE_KEY`, `projectStatusList`, `projectStatusIcons`, `tshirtSizeList`, `tshirtSizeTooltips`, `projectTypeIcons`, `moscowList`, `moscowTooltips`, `moscowGridOrder`, `currencyList`, `countryList`, `countryCodeByName`, `countryNameAliases`. No DOM. |
| **utils.js** | Pure helpers: dates, IDs, CSV parse/escape, HTML escaping, `countryCodeToFlag`, `countryCodeToTwoLetter`, `ISO3_TO_ISO2`. No DOM. |
| **rice.js** | RICE calculation and validation. No DOM. |
| **app.js** | State, element cache, `getCanonicalCountryName`, `normalizeCountryNames`, init, filters, render (profiles, table, board, MOSCOW, map), fullscreen (map/board/MOSCOW), `renderMoscowBoard`, `bindMoscowBoardDragAndDrop`, `getCountryCodeFromFeature`, `renderProjectsMap`, modals, export/import, showToast. Boot: `DOMContentLoaded` → `init`. |

### 8.5 Script load order and boot

Scripts are loaded in order: **Leaflet** (CDN) → `constants.js` → `utils.js` → `rice.js` → `app.js`. The app boots when `app.js` registers `document.addEventListener("DOMContentLoaded", init)`. No ES modules in the default setup; all scripts run in the global scope. The file `main.js` is **not** referenced in `index.html`.

### 8.6 Technical guidelines for contributors

- **No DOM in constants/utils/rice** – Keep these files pure for testability and reuse.
- **Single storage key** – All app state under `rice_prioritizer_v1`; version key allows future migrations.
- **Ids** – Use `generateId(prefix)` for profile and project IDs.
- **Escaping** – Use `escapeHtml` for user content in HTML; use `escapeCsvCell` for CSV export.
- **Accessibility** – Use semantic HTML, ARIA where needed, and keyboard support for primary actions.
- **Country consistency** – Use `getCanonicalCountryName` and `normalizeCountryNames` when reading or storing country names.
- **MOSCOW** – Use `moscowList` and `moscowGridOrder` for order; use `moscowTooltips[].gridDescription` for quadrant text. Default new projects to **Could have** in form and create logic.

### 8.7 Global dependencies (for development)

`app.js` relies on globals from the other scripts (no module imports in the default run):

- **From constants.js:** `STORAGE_KEY`, `projectStatusList`, `projectStatusIcons`, `tshirtSizeList`, `tshirtSizeTooltips`, `projectTypeIcons`, `moscowList`, `moscowTooltips`, `moscowGridOrder`, `currencyList`, `countryList`, `countryCodeByName`, `countryNameAliases`
- **From rice.js:** `calculateRiceScore`, `formatRice`, `validateProjectInput`
- **From utils.js:** `formatDateTime`, `formatDate`, `formatDateForFilename`, `compareDatesDesc`, `generateId`, `escapeHtml`, `countryCodeToFlag`, `countryCodeToTwoLetter`, `toNumberOrNull`, `parseCsv`, `escapeCsvCell`

---

## 9. Screens and key UI

### 9.1 App header and profiles

- **Header:** App title with **?** icon (Product Description tooltip). **Export data**, **Import data**.
- **Profiles panel:** Form (Profile name, Team optional), **Add**; list of profile pills. Each pill: click to select; View / Edit / Delete icon buttons. Active profile highlighted.

### 9.2 Projects header and view toggle

- Active profile name and subtitle; optional badges.
- **Table** | **Board** | **MOSCOW** | **Map** toggle; **+ Project**; **Delete Selected** (enabled when at least one project is selected in table view).

### 9.3 Filters

- Basic: title search, type (including **Not set**), countries, project period. Advanced: impact, effort, currency, status, T-shirt size (including **Not set**), **MOSCOW**. **Reset**; active filter count.

### 9.4 Table view

- Columns: Checkbox, Project, Type, Status, Period, T-shirt, **MOSCOW**, RICE score, RICE values, Financial impact, Created, Actions. Sort by header click; description tooltip on hover; **?** for RICE formula.

### 9.5 Board view

- Toolbar: status legend, **Sort by RICE (desc)** checkbox, **Full screen** button. Column headers colored by status. Columns per status with counts; cards show title, RICE, T-shirt, type icon, View/Edit/Delete; drag card body to move or reorder (when manual sort is on).

### 9.6 MOSCOW view

- Header: title “MoSCoW prioritisation”, hint text, **Full screen** button. 2×2 grid: each quadrant has coloured label (MUST / SHOULD / COULD / WON'T), one-sentence description, count badge, and project cards. Drag cards between quadrants to change MOSCOW category.

### 9.7 Map view

- Toolbar: **Show by** dropdown (Number of projects | RICE score), **Full screen** button. Legend; choropleth map (Leaflet) with country tooltips (flag, name, code, count or RICE). Fullscreen toggles map view to full viewport; Escape or **Exit full screen** to exit.

### 9.8 Project modal (add/edit/view)

- Sections: overview (title, description), RICE inputs, optional (financial, type, status, T-shirt, **MOSCOW category**, period, countries). Edit/Add: **Save** / **Cancel**. View: read-only. Meta: Created, Modified, RICE score. New project defaults MOSCOW category to **Could have**.

### 9.9 Profile view / edit / delete modals

- View: read-only name, team, statistics. Edit: name, team; **Save** / **Cancel**. Delete: confirmation with project count.

### 9.10 Export / Import modals

- Export: **Export as JSON** or **Export as CSV**. Import: **Import JSON** or **Import CSV**; file is merged into current data.

### 9.11 Toast confirmations (bottom-right)

- After create, update, delete (profile or project), export, or import; message includes counts and format where relevant. Auto-dismiss; click to dismiss early.

---

## 10. Limitations and considerations

| Topic | Detail |
|-------|--------|
| **Single browser** | Data is in one browser’s `localStorage`; not synced across devices or browsers. Use export/import to move data. |
| **No auth** | Anyone with access to the browser can see and change data. Do not use for sensitive or regulated data. |
| **Storage quota** | Subject to browser `localStorage` limits (~5–10 MB typical). Large exports may hit limits. |
| **CORS / file://** | Opening `index.html` via `file://` may behave differently than via `http://`. Use a static server for consistent behavior. Map view fetches GeoJSON from CDN; ensure network or cache allows it. |
| **No versioning** | No built-in history or undo; export regularly to keep backups. |

---

## 11. License

Use and modify as needed for your context.
