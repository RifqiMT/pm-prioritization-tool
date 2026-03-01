# Product Management Prioritization Tool

**Local-first, no-backend** web application for prioritizing projects using the [RICE framework](https://www.intercom.com/blog/rice-scoring-model/) (Reach × Impact × Confidence ÷ Effort) and the **MoSCoW method** (Must have, Should have, Could have, Won't have). All data is stored in the browser. No account, server, or build step required.

This README is the **product documentation** for the tool and follows the product documentation standard. It covers:

- **Product overview** – Purpose, target users, key concepts, high-level flow  
- **Product benefits** – Value proposition and user benefits  
- **Features** – Profiles, projects, RICE, optional fields, exchange rates, filters, sort, Table/Board/MOSCOW/Map views, export/import, tooltips, fullscreen  
- **Logics and data model** – RICE formula, validation, storage shape, exchange rates logic, profile and project schemas, board/MOSCOW order, import merge, country normalization  
- **Business guidelines** – Recommended usage and practices  
- **Tech guidelines** – Tech stack, script load order, contribution rules, global dependencies  
- **Folder directory and file roles** – Source layout and responsibility of each file  
- **Screens and key UI** – Header, profiles, filters, views, modals, toasts  
- **Limitations and considerations** – Single browser, no auth, storage, CORS, no versioning  
- **Other** – Script load order, global dependencies, export/import merge result, tooltip behavior, card layout (actions and reorder buttons)

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
9. [Folder directory and file roles](#9-folder-directory-and-file-roles)
10. [Screens and key UI](#10-screens-and-key-ui)
11. [Limitations and considerations](#11-limitations-and-considerations)
12. [License](#12-license)

---

## 1. Product overview

### 1.1 Purpose

The tool helps product managers and teams **capture**, **score**, **rank**, and **track** projects in one place. It provides:

- **RICE scoring** – Consistent prioritization using **Reach × Impact × Confidence ÷ Effort**.
- **MoSCoW categorisation** – Classify projects as Must have, Should have, Could have, or Won't have; default for new projects is **Could have**.
- **Portfolio separation** – Multiple profiles (e.g. per team or product) with separate project lists and optional board order.
- **Four views** – **Table** for sortable, filterable lists and bulk actions; **Board** for status-based columns and drag-and-drop; **MOSCOW** for a 2×2 quadrant grid by MoSCoW category; **Map** for a world choropleth of project count, RICE score, or total financial impact (EUR) by target country.
- **Financial impact in EUR** – Optional financial impact per project (amount + currency); rates from an external API are used to convert all amounts to EUR for table and map. Short format (K, Mn, Bn, Tn) is used for display.
- **Exchange rates** – ETL pipeline (Extract / Transform / Load) fetches daily rates; manual refresh and automatic refresh every day at 00:00 Germany time (Europe/Berlin). When the app is closed, the next open after midnight Germany triggers a refresh.
- **Data ownership** – Export/import JSON or CSV; no vendor lock-in.

### 1.2 Target users

- Product managers maintaining roadmaps and backlogs.
- Teams that need a shared view of project status, RICE scores, MoSCoW priorities, and financial impact by country.
- Anyone who wants a simple, local prioritization tool without sign-up or backend.

### 1.3 Key concepts

| Term | Meaning |
|------|--------|
| **Profile** | A container for projects (e.g. “Q1 roadmap”, “Team Alpha”). Each profile has its own projects, optional board order, and can be viewed/edited via modals. |
| **RICE** | Prioritization formula: **(Reach × Impact × Confidence) ÷ Effort**. Higher score = higher priority. |
| **MoSCoW** | Prioritisation method: **M**ust have, **S**hould have, **C**ould have, **W**on't have (this time). Each project has a **MOSCOW category** (`moscowCategory`); new projects default to “Could have”. |
| **Board order** | When “Sort by RICE” is off, the order of cards in each board column (and MOSCOW quadrant) is stored per profile and per status/category. |
| **MOSCOW view** | 2×2 grid of quadrants (Must / Should / Could / Won't) with short descriptions; drag cards between quadrants to change category; optional sort by RICE within quadrants. |
| **Map view** | Choropleth world map colored by project count, RICE score, or **total financial impact (EUR)** per target country; uses canonical country names and 2-letter codes (e.g. Taiwan). |
| **Exchange rates ETL** | Extract: fetch from API; Transform: normalize to EUR-based rates per currency; Load: merge into state and persist. Manual and automatic (00:00 Germany) refresh. |
| **Merge (import)** | Imported data is merged by profile (ID or name) and by project ID; duplicates are skipped. Country names are normalized to the canonical list on import. |
| **Tooltips** | Structured tooltips (title + body) for project type, status, T-shirt size, MOSCOW, period, financial impact (EUR), and description. Tooltips are moved to the document body or fullscreen root so they are not clipped by overflow; visibility is controlled by the app and hidden on scroll or when modals open. |

### 1.4 High-level flow

1. **Create a profile** – Enter profile name and optional team; click **Add**.
2. **Add projects** – With a profile selected, click **+ Project** and fill RICE inputs plus optional metadata (type, status, MOSCOW category, T-shirt size, countries, period, financial impact, etc.). New projects default to MOSCOW category **Could have**.
3. **View and prioritize** – Use **Table** for sorting and filtering (including Financial impact in EUR with tooltip); **Board** for status columns and drag-and-drop (with up/down reorder when sort by RICE is off); **MOSCOW** for the 2×2 grid and drag-between-categories; or **Map** for a geographic view (by project count, RICE, or financial impact in EUR).
4. **Exchange rates** – Use **Refresh exchange rates** for an immediate update, or rely on automatic refresh at 00:00 Germany time. The “Last updated” label shows date and source (manual/auto).
5. **Change status or MOSCOW** – In Board view, drag cards between columns to update status; use up/down buttons to reorder within a column when “Sort by RICE” is off. In MOSCOW view, drag cards between quadrants to change MOSCOW category.
6. **Fullscreen** – Any main view (Table, Board, MOSCOW, Map) can go fullscreen. While in fullscreen, the view toggle (Table | Board | MOSCOW | Map) stays enabled so you can switch to another board without exiting fullscreen.
7. **Export or import** – Use **Export data** (JSON/CSV) for backup; **Import data** to merge from another export (country names normalized to canonical list).

---

## 2. Prerequisites and requirements

| Requirement | Details |
|-------------|--------|
| **Browser** | Modern browser with JavaScript enabled and `localStorage` support (e.g. Chrome, Firefox, Safari, Edge). |
| **Network** | Optional: for Google Fonts (Inter), Leaflet tiles and Natural Earth GeoJSON in Map view, and **exchange rates APIs** (Frankfurter, MoneyConvert). App runs offline for table, board, and MOSCOW after first load if fonts and map data are cached; financial EUR conversion requires the rates APIs. |
| **Backend** | None. No server, database, or API of your own. |
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
4. **Exchange rates** – Click **Refresh exchange rates** in the header to load rates for financial impact in EUR (table and map).
5. **Export** – Use **Export data** → JSON or CSV to back up your data.

---

## 4. Product benefits

| Benefit | Description |
|--------|-------------|
| **Single source of truth** | One place for project metadata, RICE scores, MOSCOW category, and financial impact; all views stay in sync. |
| **Dual frameworks** | RICE for numeric prioritisation; MoSCoW for requirement categorisation (Must/Should/Could/Won't). |
| **Portfolio-ready** | Multiple profiles for different owners, teams, or products; switch context with one click. |
| **Transparent prioritization** | RICE formula is visible; the **?** next to the score shows the exact calculation. |
| **Financial impact in EUR** | Optional financial impact per project (any currency); conversion to EUR via daily exchange rates; short format (K, Mn, Bn, Tn) in table and map. |
| **Exchange rates ETL** | Clear pipeline: Extract from API → Transform to EUR-based rates → Load into state; manual refresh and automatic refresh at 00:00 Germany time. |
| **Flexible workflow** | Table for bulk review and sort; Board for status flow and manual ordering; MOSCOW for category-based prioritisation; Map for geographic or financial distribution. |
| **MOSCOW 2×2 grid** | Clear quadrant layout with one-sentence descriptions per category; drag cards to change category; optional sort by RICE; fullscreen for presentations. |
| **Fullscreen on all main views** | Table, Board, MOSCOW, and Map each have a **Full screen** button; you can **switch between views** (Table/Board/MOSCOW/Map) without exiting fullscreen. |
| **Geographic and financial map** | Map view shows project count, RICE score, or **total financial impact (EUR)** per country with choropleth coloring, country flags in tooltips, and fullscreen; supports all countries including Taiwan. |
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
| **Financial impact** | Optional number + currency; not used in RICE; converted to EUR for table column “Financial impact (EUR)” and map metric “Total financial impact (EUR)”. |
| **Project type** | New Product, Improvement, Tech Debt, Market Expansion (with icons in table/board). Filter supports **Not set** to show projects with no type. |
| **Project status** | Not Started, In Progress, On Hold, Done, Cancelled; drives board columns. |
| **T-shirt size** | XS, S, M, L, XL; tooltips describe sprint-level sizing. Filter supports **Not set** to show projects with no size. |
| **Project period** | Optional `YYYY-Qn` (e.g. 2026-Q1); filterable. |
| **Target countries** | Multi-select from a global list; shown as 2-letter ISO codes and flags in table; used for map aggregation. |

### 5.5 Exchange rates

| Aspect | Description |
|--------|-------------|
| **Rates section** | Header: **Rates** label, **Refresh exchange rates** button, and **Last updated** line (date + manual/auto) in smaller muted text. |
| **Manual refresh** | Click **Refresh exchange rates** to run the ETL (Extract → Transform → Load) and update table/map. |
| **Automatic refresh** | Every day at **00:00 Europe/Berlin** (Germany time) the app runs the same ETL when the app is open. When the app is closed, the next time you open the app after midnight Germany, rates are refreshed automatically (stale-date check uses Germany “today”). |
| **ETL** | Extract: fetch from Frankfurter API (EUR base) and MoneyConvert API (USD base, 180+ currencies); Transform: normalize each to currency → EUR; Merge: Frankfurter first, then fill missing from MoneyConvert; optional fallback static rates when APIs fail or are blocked (e.g. CORS). Load: merge into state, set date (Germany), and persist. |
| **Display** | “Last updated: &lt;date&gt; (manual refresh)” or “(auto)”; persisted so it survives reload. |

### 5.6 Filters

- **Basic:** Project title (search), Project type (including **Not set**), Countries (multi-select with search), Project period (multi-select).
- **Advanced (toggle):** Impact, Effort, Currency, Status, T-shirt size (including **Not set**), **MOSCOW** (Must have / Should have / Could have / Won't have).
- **Reset** clears all filters; active filter count is shown when any filter is applied.
- Filters apply to table, board, MOSCOW, and map views.

### 5.7 Sort (table view)

- **Sortable columns:** Project title, Project type, Status, T-shirt size, **MOSCOW**, RICE score, Financial impact (EUR), Created, Modified.
- **Default:** Created date descending.
- Click a column header to sort by that field; click again to toggle ascending/descending.

### 5.8 Table view

- Sortable columns, row checkboxes for bulk delete, tooltips for description and RICE breakdown.
- **Columns:** Checkbox, Project, Project type, Status, Project period, T-shirt size, **MOSCOW**, RICE score, RICE values, **Financial impact (EUR)** (converted amount in short format; tooltip shows original amount and currency), Created, Actions (View, Edit, Delete).

### 5.9 Board view (Scrum-style)

| Aspect | Description |
|--------|-------------|
| **Columns** | One per project status: Not Started, In Progress, On Hold, Done, Cancelled. Column headers use status-specific colors. |
| **Cards** | Title, RICE score, T-shirt size, project type icon; **View**, **Edit**, **Delete** on the left; **↑** / **↓** (reorder) in the right corner. |
| **Sort by RICE (desc)** | **On:** cards in each column sorted by RICE score (highest first). **Off:** manual order; drag to move between columns or reorder within column; **↑** / **↓** to move card up/down; order is saved per profile per status. |
| **Drag-and-drop** | Move a card to another column to change its status. When “Sort by RICE” is off, drop position and up/down set the card’s position (persisted). Drag uses a cloned ghost for precise cursor alignment. |
| **Full screen** | **Full screen** button in the toolbar; **Exit full screen** or Escape to exit. View toggle remains available in fullscreen to switch to Table/MOSCOW/Map. |

### 5.10 MOSCOW view (MoSCoW 2×2 grid)

| Aspect | Description |
|--------|-------------|
| **Layout** | 2×2 grid: Must have, Should have, Could have, Won't have. Each quadrant has a coloured label, one-sentence description, and project cards. |
| **Sort by RICE (desc)** | **On:** cards within each quadrant sorted by RICE. **Off:** manual order; **↑** / **↓** to reorder within quadrant; order persisted per profile per MOSCOW category. |
| **Cards** | Title, RICE score, T-shirt size; **View**, **Edit**, **Delete** on the left; **↑** / **↓** (reorder) in the right corner. |
| **Drag-and-drop** | Drag a card to another quadrant to change **MOSCOW category**; state is persisted. Drag uses a cloned ghost for alignment. |
| **Full screen** | **Full screen** button in the header; view toggle remains available to switch to Table/Board/Map without exiting fullscreen. |

### 5.11 Map view

| Aspect | Description |
|--------|-------------|
| **Show by** | Dropdown: **Number of projects**, **RICE score**, or **Total financial impact (EUR)** per country. Choice is persisted (`mapMetric`). |
| **Financial impact (EUR)** | Sums each project’s financial impact converted to EUR using stored exchange rates; choropleth and legend use short format (K, Mn, Bn, Tn). |
| **Choropleth** | Countries colored by selected metric; gray when no data. Tooltips: flag, name, code, and value. |
| **Full screen** | **Full screen** button; view toggle remains available to switch to Table/Board/MOSCOW without exiting fullscreen. |

### 5.12 Export and import

| Action | Behavior |
|--------|----------|
| **Export** | **Export data** → **JSON** or **CSV**. Downloads all profiles and projects (including board order, `moscowCategory`, and exchange rates state). Filename: `pm-prioritization-tool-export-{timestamp}.json|csv`. Toast confirms success. |
| **Import** | **Import data** → **JSON** or **CSV**. Data is **merged**: profiles matched by ID or name get projects merged by project ID (duplicates skipped). New profiles and new projects are added. **moscowCategory** and exchange rates are read when present. Toast confirms counts. |

### 5.13 Confirmations (toasts)

- **Location:** Bottom-right; green accent, checkmark icon, slide-in/out, auto-dismiss, click to dismiss.
- **Used for:** Profile/project create, update, delete; bulk delete; export; import.

### 5.14 Fullscreen and view switch

- **Enter fullscreen:** Use **Full screen** on Table, Board, MOSCOW, or Map. That view fills the viewport; header/filters are moved inside the fullscreen element so they remain visible.
- **Switch view in fullscreen:** The **Table | Board | MOSCOW | Map** buttons stay enabled. Clicking another view exits fullscreen, switches to that view, and re-enters fullscreen on the new view so you stay in fullscreen while changing boards.
- **Exit fullscreen:** **Exit full screen** or Escape. Modals and toast container are moved back to document body when exiting.

### 5.15 Tooltips

- **Cell-type tooltips** provide structured title + body for: project type, status, T-shirt size, MOSCOW category, project period, financial impact (original amount/currency), and description in table/board/modal.
- **Positioning:** Tooltips are moved to the document body (or the fullscreen element when a view is fullscreen) so they are not clipped by table or card overflow; positioning is set from the trigger element’s bounding rect.
- **Visibility:** Shown on hover/focus via class `cell-type-tooltip-visible`; hidden on scroll, when modals open, and when focus leaves the trigger. `body.cell-type-tooltip-hidden` can force-hide all such tooltips (e.g. during scroll).
- **Accessibility:** Title and body content; ARIA and keyboard-friendly where applicable.

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
  `{ profiles, activeProfileId, sortField, sortDirection, projectsView, scrumBoardSortByRice, moscowSortByRice, mapMetric, exchangeRatesToEUR, exchangeRatesDate, exchangeRatesLastSource }`
- **profiles:** Each profile may include `boardOrder` and `moscowOrder` (optional; used when “Sort by RICE” is off).
- **projectsView:** `"table"` | `"board"` | `"moscow"` | `"map"`.
- **mapMetric:** `"projects"` | `"rice"` | `"financial"` (used when projectsView is `"map"`).
- **exchangeRatesToEUR:** `{ [currencyCode]: rateToEur }` (e.g. `USD: 0.92`); **EUR** is 1.
- **exchangeRatesDate:** Date of last rates update as **YYYY-MM-DD in Europe/Berlin**.
- **exchangeRatesLastSource:** `"manual"` | `"auto"` | null (for “Last updated” label).

### 6.4 Exchange rates logic

- **Timezone:** All “today” and “midnight” for rates use **Europe/Berlin** (Germany).
- **Sources:**  
  - **Frankfurter:** `GET https://api.frankfurter.dev/v1/latest` (EUR base, ~31 currencies).  
  - **MoneyConvert:** `GET https://cdn.moneyconvert.net/api/latest.json` (USD base, 180+ currencies).  
  - **Fallback:** Static rates for currencies that may be missing when APIs fail or are blocked (e.g. CORS); approximate; refresh from APIs when possible.
- **ETL:**  
  - **Extract:** Fetch from Frankfurter and MoneyConvert in parallel.  
  - **Transform:** Normalize each response to a map `currencyCode → rateToEUR` (EUR = 1).  
  - **Merge:** Frankfurter first, then fill missing from MoneyConvert, then from fallback so every listed currency has a rate.  
  - **Load:** Replace `state.exchangeRatesToEUR`, set `state.exchangeRatesDate` to today (Germany), set `state.exchangeRatesLastSource`, save state, update “Last updated” label.
- **When to refresh:**  
  - **Manual:** User clicks **Refresh exchange rates**.  
  - **On app open:** On init, `ensure()` runs: if stored rates are missing or the stored date is not today (Germany), the full ETL runs and rates are refreshed automatically.  
  - **Auto (app open, same day):** A timeout is set for the next 00:00 Germany; when it fires, ETL runs and the next 00:00 is scheduled again.  
  - **Auto (app closed):** Next time you open the app after midnight Germany, `ensure()` sees the date is stale and fetches (so first open of the day gets fresh rates).
- **Conversion:** For a project with `financialImpactValue` and `financialImpactCurrency`, EUR = value × `exchangeRatesToEUR[currency]` (or value if currency is EUR or missing rate).

### 6.5 Financial display

- **Short format** (`formatFinancialShort`): K (thousands), Mn (millions), Bn (billions), Tn (trillions). Used in table “Financial impact (EUR)” and in map legend/tooltips for financial metric.
- **Table:** Column shows only converted EUR (short format); tooltip shows original amount and currency (same pattern as T-shirt size tooltip).
- **Map:** When “Show by” is “Total financial impact (EUR)”, per-country sum of converted EUR is used for choropleth and tooltips (short format).

### 6.6 Profile schema

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier. |
| `name` | string | Display name. |
| `team` | string | Optional team label. |
| `createdAt` | string | ISO 8601 date. |
| `projects` | array | Array of project objects. |
| `boardOrder` | object | Optional. `{ [status]: [projectId, ...] }` for board column order; used when “Sort by RICE” is off. |
| `moscowOrder` | object | Optional. `{ [moscowCategory]: [projectId, ...] }` for MOSCOW quadrant order; used when “Sort by RICE” is off. |

### 6.7 Project schema

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

### 6.8 Board order (manual sort)

- When **Sort by RICE (desc)** is **off**: column order comes from `profile.boardOrder[status]`; dragging or **↑** / **↓** updates project status and/or `boardOrder`.
- When **Sort by RICE** is **on**, columns are sorted by RICE score only; `boardOrder` is ignored for display.

### 6.9 MOSCOW category and order

- Stored as `project.moscowCategory`. Valid values: `"Must have"`, `"Should have"`, `"Could have"`, `"Won't have"`. New projects default to **Could have**.
- When “Sort by RICE” is off, quadrant order comes from `profile.moscowOrder[quadrant]` (array of project IDs); dragging or **↑** / **↓** updates `moscowOrder` and `project.moscowCategory` / `project.modifiedAt`.
- Drag-and-drop in MOSCOW view updates `project.moscowCategory` and `project.modifiedAt`.

### 6.10 Import merge rules

- **Profiles:** Matched by `id` or `name`. If matched, projects are merged by project `id` (duplicates skipped). If no match, profile is added.
- **Projects:** New projects on an existing profile are appended; existing project IDs are not duplicated. **moscowCategory** is imported from JSON/CSV when present.
- **Merge result:** The merge function returns `addedProfiles`, `mergedProfiles`, `addedProjects`, `mergedProjects` for the import toast.

### 6.11 Country normalization

- **Canonical list:** `countryList` and `countryCodeByName` in `constants.js` define the single set of country names and 2-letter ISO codes.
- **Aliases:** `countryNameAliases` maps alternate names (e.g. from GeoJSON or imports) to canonical names (e.g. "Chinese Taipei" → "Taiwan").
- **Normalization:** On load (`normalizeLoadedProject`), CSV import, and JSON import (`normalizeImportedProject`), `normalizeCountryNames(names)` runs each name through `getCanonicalCountryName` and keeps only names present in `countryList`.

---

## 7. Business guidelines

1. **Create a profile first** – At least one profile is required before adding projects.
2. **Use consistent RICE definitions** – Agree on Reach, Impact 1–5, Confidence %, and Effort 1–5 so scores are comparable.
3. **Use MOSCOW for requirement prioritisation** – Classify projects as Must/Should/Could/Won't; use the MOSCOW view to review and drag to reprioritise. New projects default to Could have.
4. **Use financial impact and exchange rates** – Enter financial impact (amount + currency) where relevant; refresh exchange rates manually or rely on automatic refresh at 00:00 Germany time for EUR conversion in table and map.
5. **Use View for read-only** – Share or review projects and profiles without risk of edits.
6. **Export regularly** – Data lives only in this browser; export JSON or CSV to back up or move to another device.
7. **Import merges** – Imported data is merged by profile and project ID; duplicates are avoided.
8. **Use filters and sort** – Narrow by type, status, MOSCOW, period, or country; use **Not set** for type/T-shirt size to find projects missing those fields; sort by RICE or date to focus on what to do next.
9. **Use the board for status** – Track Not Started → In Progress → Done; turn off “Sort by RICE” when you want to order items manually within a column (including **↑** / **↓**).
10. **Use fullscreen for focus** – Table, Board, MOSCOW, and Map support fullscreen; you can switch between them without exiting fullscreen.
11. **Use profile view for portfolio health** – Check profile statistics (by status, type, T-shirt size, RICE) to balance workload and priorities.
12. **Use the map for geographic or financial spread** – Map view shows project count, RICE, or total financial impact (EUR) by country; use “Show by” to switch metric; use fullscreen for presentations.

---

## 8. Tech stack and technical guidelines

### 8.1 Tech stack

| Layer | Technology |
|-------|------------|
| **Markup** | HTML5 (single page, semantic sections). |
| **Styles** | CSS3 (custom properties, flexbox/grid, responsive, fullscreen for all views). |
| **Scripting** | Vanilla JavaScript; classic scripts (no ES modules in default run), no framework or build. |
| **Map** | Leaflet 1.9.4 (CDN); world countries GeoJSON from Natural Earth (110m, jsDelivr CDN). Choropleth and tooltips in Map view. |
| **Exchange rates** | Frankfurter API (`api.frankfurter.dev`) and MoneyConvert API (`cdn.moneyconvert.net`); client-side fetch, no API keys; merged for maximum currency coverage; fallback static rates when APIs fail (e.g. CORS). |
| **Fonts** | Google Fonts (Inter). |
| **Persistence** | Browser `localStorage` (key: `rice_prioritizer_v1`). |
| **Backend** | None; local-first, no server or auth. |
| **Theme / UX** | Dark theme via CSS custom properties; `prefers-reduced-motion` respected for transitions. Single CSS file (`main.css`). |

### 8.2 Script load order and boot

Scripts are loaded in order: **Leaflet** (CDN) → `constants.js` → `utils.js` → `rice.js` → `src/modules/exchange-rates.js` → `src/modules/fullscreen.js` → `app.js`. The app boots when `app.js` registers `document.addEventListener("DOMContentLoaded", init)`. No ES modules in the default setup; all scripts run in the global scope. The file `main.js` is an optional ES-module entry and is **not** referenced in `index.html`. **ExchangeRates** and **Fullscreen** are initialized at startup with dependencies (getState, saveState, getElements, etc.) so exchange-rate and fullscreen logic stay modular and testable.

### 8.3 Technical guidelines for contributors

- **No DOM in constants/utils/rice** – Keep these files pure for testability and reuse.
- **Single storage key** – All app state under `rice_prioritizer_v1`; version key allows future migrations.
- **Ids** – Use `generateId(prefix)` for profile and project IDs.
- **Escaping** – Use `escapeHtml` for user content in HTML; use `escapeCsvCell` for CSV export.
- **Accessibility** – Use semantic HTML, ARIA where needed, and keyboard support for primary actions.
- **Country consistency** – Use `getCanonicalCountryName` and `normalizeCountryNames` when reading or storing country names.
- **MOSCOW** – Use `moscowList` and `moscowGridOrder` for order; use `moscowTooltips[].gridDescription` for quadrant text. Default new projects to **Could have** in form and create logic.
- **Exchange rates** – Use Germany timezone (`Europe/Berlin`) for “today” and for scheduling 00:00 refresh; store date as Germany YYYY-MM-DD; ETL: fetch from Frankfurter + MoneyConvert, transform to EUR-based rates, merge (Frankfurter first, then fill missing from MoneyConvert), load into state; persist `exchangeRatesToEUR`, `exchangeRatesDate`, `exchangeRatesLastSource`.

### 8.4 Global dependencies (for development)

`app.js` relies on globals from the other scripts (no module imports in the default run):

- **From constants.js:** `STORAGE_KEY`, `projectStatusList`, `projectStatusIcons`, `tshirtSizeList`, `tshirtSizeTooltips`, `projectTypeIcons`, `moscowList`, `moscowTooltips`, `moscowGridOrder`, `currencyList`, `countryList`, `countryCodeByName`, `countryNameAliases`
- **From rice.js:** `calculateRiceScore`, `formatRice`, `validateProjectInput`
- **From utils.js:** `formatDateTime`, `formatDate`, `formatDateForFilename`, `compareDatesDesc`, `generateId`, `escapeHtml`, `countryCodeToFlag`, `countryCodeToTwoLetter`, `toNumberOrNull`, `parseCsv`, `escapeCsvCell`, `formatFinancialShort`, `debounce`

---

## 9. Folder directory and file roles

### 9.1 Directory tree

```
pm-prioritization-tool/
├── index.html          # Single page: layout, header (Export, Import, Rates), view toggle,
│                        # filters, Table/Board/MOSCOW/Map containers, fullscreen buttons, modals
├── css/
│   └── main.css        # All styles: variables, layout, table, board, MOSCOW grid, map,
│                        # fullscreen, exchange-rates label, modals, responsive, prefers-reduced-motion
├── src/
│   ├── constants.js    # STORAGE_KEY, projectStatusList, projectStatusIcons, tshirtSizeList,
│   │                   # tshirtSizeTooltips, projectTypeIcons, projectPeriodTooltip, moscowList, moscowTooltips,
│   │                   # moscowGridOrder, currencyList, countryList, countryCodeByName, countryNameAliases
│   ├── utils.js        # formatDateTime, formatDate, formatDateForFilename, compareDatesDesc,
│   │                   # generateId, escapeHtml, countryCodeToFlag, countryCodeToTwoLetter,
│   │                   # ISO3_TO_ISO2, toNumberOrNull, parseCsv, escapeCsvCell, formatFinancialShort, debounce
│   ├── rice.js         # calculateRiceScore, formatRice, validateProjectInput
│   ├── modules/
│   │   ├── exchange-rates.js  # ETL, Germany timezone, daily 00:00 refresh; init(getState, saveState, getElements, onRatesUpdated)
│   │   └── fullscreen.js      # Toggle fullscreen, view switch while fullscreen; init(getState, getElements, switchView, getViewElement)
│   ├── app.js          # State, DOM cache, init (wires ExchangeRates + Fullscreen), filters, render (profiles, table, board, MOSCOW, map),
│   │                   # tooltip handling (getTooltipRoot, returnTooltipsToOwner, hideCellTypeTooltips, positionProfileTooltip),
│   │                   # getCountryFinancialImpactByCode, renderProjectsMap, createDragGhost, board/MOSCOW drag-and-drop,
│   │                   # modals, export/import, showToast. Boot: DOMContentLoaded → init
│   └── main.js         # Optional ES module entry; not loaded by index.html
└── README.md           # This documentation
```

### 9.2 File roles (summary)

| File | Role |
|------|------|
| **index.html** | App shell, header (title, Export, Import, **Rates**: refresh button + `#exchangeRatesDateLabel`), profiles panel, filters, view toggle (Table \| Board \| MOSCOW \| Map), table/board/map/MOSCOW containers, fullscreen buttons, all modals, `#toastContainer`. Loads Leaflet CSS, `css/main.css`, and scripts: Leaflet → constants → utils → rice → modules/exchange-rates.js → modules/fullscreen.js → app. |
| **css/main.css** | CSS custom properties (dark theme), layout, table, board, MOSCOW 2×2 grid, map, fullscreen for all views, `.data-pill-group--rates`, `.exchange-rates-date-label`, `.drag-ghost`, cell-type tooltips (`.cell-type-tooltip`, `.cell-type-tooltip-visible`, `.cell-type-tooltip-hidden`), modals, toast, responsive, `prefers-reduced-motion`. |
| **constants.js** | Config and lookup data only (STORAGE_KEY, project status/type/MOSCOW/period/tshirt tooltips, currency and country lists, country aliases); no DOM. |
| **utils.js** | Pure helpers; includes `formatFinancialShort`, `debounce` (for filter title); no DOM. |
| **rice.js** | RICE calculation and validation only; no DOM. |
| **modules/exchange-rates.js** | Exchange rates ETL from multiple APIs (Frankfurter + MoneyConvert), merge for max currency coverage; Germany timezone, daily 00:00 refresh; exposes `ExchangeRates` (init, ensure, refreshManual, scheduleDailyRefresh, updateLabel, convertToEUR, hasRate). No direct state/DOM; uses init() deps. |
| **modules/fullscreen.js** | Fullscreen toggle and view switch while fullscreen; exposes `Fullscreen` (init, toggle, onChange, isViewFullscreen, requestViewSwitchWhileFullscreen). No direct state/DOM; uses init() deps. |
| **app.js** | State, elements, init (wires ExchangeRates + Fullscreen), filters (debounced title), render (profiles, table, board, MOSCOW, map), tooltip handling (`getTooltipRoot`, `returnTooltipsToOwner`, `hideCellTypeTooltips`, `positionProfileTooltip`), getCountryFinancialImpactByCode, renderProjectsMap, drag-and-drop, modals, export/import, showToast. Boot: `DOMContentLoaded` → `init`. |
| **main.js** | Optional ES module entry that imports `init` from `app.js`; use only with a bundler or module-aware dev server; **not** loaded by `index.html`. |

---

## 10. Screens and key UI

### 10.1 App header

- **Title** with **?** (Product Description tooltip).
- **Export data**, **Import data**.
- **Rates:** **Refresh exchange rates** button; below it, **Last updated: &lt;date&gt; (manual refresh)** or **(auto)** in smaller muted text.

### 10.2 Profiles panel

- Form (Profile name, Team optional), **Add**; list of profile pills (select, View, Edit, Delete). Active profile highlighted.

### 10.3 Projects header and view toggle

- Active profile name and subtitle; optional badges.
- **Table** | **Board** | **MOSCOW** | **Map** toggle; **+ Project**; **Delete Selected** (table, when at least one project selected).

### 10.4 Filters

- Basic: title, type (incl. Not set), countries, project period. Advanced: impact, effort, currency, status, T-shirt size (incl. Not set), MOSCOW. **Reset**; active filter count.

### 10.5 Table view

- Columns: Checkbox, Project, Type, Status, Period, T-shirt, MOSCOW, RICE score, RICE values, **Financial impact (EUR)** (short format + tooltip with original amount/currency), Created, Actions. Sort by header click; **?** for RICE formula.

### 10.6 Board view

- Toolbar: status legend, **Sort by RICE (desc)** checkbox, **Full screen**. Column headers colored by status. Cards: title, RICE, T-shirt, type icon, View/Edit/Delete, **↑**/ **↓**. Drag to move between columns or reorder (when sort by RICE is off); ghost aligns with cursor.

### 10.7 MOSCOW view

- Header: title, hint, **Sort by RICE** toggle, **Full screen**. 2×2 grid: quadrants with label, description, count, cards (View/Edit/Delete, **↑**/ **↓**). Drag between quadrants to change category; ghost aligns with cursor.

### 10.8 Map view

- Toolbar: **Show by** (Number of projects | RICE score | **Total financial impact (EUR)**), **Full screen**. Legend; choropleth with tooltips (flag, name, code, value in short format). Fullscreen and view toggle available.

### 10.9 Modals and toast

- Project (add/edit/view), profile view/edit/delete, project delete, export format, import format. Backdrop click or **Close** dismisses. Toast container bottom-right for create/update/delete/export/import confirmations.

---

## 11. Limitations and considerations

| Topic | Detail |
|-------|--------|
| **Single browser** | Data is in one browser’s `localStorage`; not synced across devices or browsers. Use export/import to move data. |
| **No auth** | Anyone with access to the browser can see and change data. Do not use for sensitive or regulated data. |
| **Storage quota** | Subject to browser `localStorage` limits (~5–10 MB typical). Large exports may hit limits. |
| **Exchange rates** | Require network (Frankfurter + MoneyConvert APIs). When the app is closed, no code runs; automatic refresh at 00:00 Germany happens the next time you open the app (if the stored date is before today Germany). |
| **CORS / file://** | Opening `index.html` via `file://` may behave differently than via `http://`. Use a static server for consistent behavior. Map and exchange rates need network or cache. |
| **No versioning** | No built-in history or undo; export regularly to keep backups. |

---

## 12. License

Use and modify as needed for your context.
