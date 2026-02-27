# Product Management Prioritization Tool

A **local-first**, **no-backend** web app to prioritize projects using the [RICE framework](https://www.intercom.com/blog/rice-scoring-model/) (Reach × Impact × Confidence ÷ Effort). All data is stored in your browser. No installation or server required to run—just open with a local static server (see [How to run](#how-to-run)).

---

## Features

### Profiles / owners
- **Create profiles** – Separate portfolios for different owners, teams, or products.
- **Switch profile** – Click a profile to make it active; the project list and filters apply to that profile.
- **Delete profile** – Use the × button (shown on hover or when the profile is active) to remove a profile and all its projects (with confirmation).

### Projects
- **Add project** – With a profile selected, click **+ Project** to open the project form.
- **Edit project** – In the project list, click **Edit** to change title, description, RICE inputs, financial impact, type, and countries.
- **View project** – Click **View** to open a read-only popup (no edit controls, no add/remove country).
- **Delete project** – Click **Delete** to open a confirmation modal; **Keep project** cancels, **Delete project** removes it.
- **Bulk delete** – Select projects with the checkboxes and click **Delete Selected** (browser confirm).

### RICE inputs (per project)
- **Reach** – Description + integer value (e.g. number of users affected).
- **Impact** – Description + scale 1–5 (Minimal → Massive).
- **Confidence** – Description + percentage 0–100%.
- **Effort** – Description + scale 1–5 (Tiny → Huge).

**RICE score** is computed as: **[R × I × C] ÷ E** (Confidence is normalized from % to 0–1 when &gt; 1). The list shows the numeric score; the **?** next to it opens a popup with the formula and the exact calculation.

### Optional fields
- **Financial impact** – Optional number + currency (not used in RICE formula).
- **Project type** – New Product, Improvement, Tech Debt, Market Expansion.
- **Target countries** – Multi-select from a global list; displayed as 2-letter ISO codes in the project list.

### Filters
- **Basic:** Project title (search), Type, Countries (multi-select with search).
- **Advanced (toggle):** Created date range, Modified date range, Impact, Effort, Currency.
- **Reset** – Clears all filters. Active filter count is shown when any filter is applied.

### Sort
- Sort by: Project title, Type, RICE score, Financial impact, Currency, Created, Modified.
- Default: Created date descending. Click a column header to toggle sort.

### Export & import
- **Export** – Click **Export data**; choose **JSON** or **CSV** in the popup. Downloads a file with all profiles and projects.
- **Import** – Click **Import data**; choose **JSON** or **CSV**. File is merged into the current data:
  - **Profiles** are matched by ID or name; if a match exists, its **projects** are merged (by project ID, no duplicates).
  - New profiles are added; new projects on existing profiles are appended.

### UI behavior
- **Project description** – Not shown in the list; hover over a project row to see it in a tooltip.
- **Modals** – Project (add/edit/view), profile delete, project delete, export format, import format. Backdrop click or explicit buttons close them. Export/Import/Project delete modals use a solid, non-transparent panel style.

---

## How to run

You can run the app in **either** of these ways:

- **Simplest (no tooling):**  
  - Open the `rice-prioritizer` folder.  
  - Double-click `index.html` to open it in your browser.  
  - All logic is loaded via classic `<script>` tags; no bundler or dev server required.

- **Optional: local static server (recommended for development):**

  ```bash
  # From the project root (rice-prioritizer/)
  npx serve .
  # or
  python3 -m http.server 8000
  ```

  Then open `http://localhost:3000` (or `http://localhost:8000` for Python) in your browser.

---

## Data & logic

- **Storage** – `localStorage` key: `rice_prioritizer_v1`. One JSON object: `{ profiles, activeProfileId, sortField, sortDirection }`.
- **Profiles** – Array of `{ id, name, createdAt, projects }`.
- **Projects** – Each has: title, description, RICE fields, optional financial impact/currency, project type, countries array, `createdAt`, `modifiedAt`. RICE score is computed on demand (not stored).
- **Merge on import** – Same profile (by id or name): merge projects by id (skip duplicates). New profiles are appended.

---

## Code structure (for developers)

```
rice-prioritizer/
├── index.html          # Single page: layout, forms, modals; loads CSS and app scripts
├── css/
│   └── main.css        # All styles (variables, layout, components, modals)
├── src/
│   ├── constants.js    # STORAGE_KEY, currencyList, countryList, countryCodeByName
│   ├── utils.js        # formatDateTime, formatDate, generateId, escapeHtml, parseCsv, etc.
│   ├── rice.js         # calculateRiceScore, formatRice, validateProjectInput
│   └── app.js          # Main app: state, DOM cache, init, render, modals, import/export, events
└── README.md           # This file
```

- **constants.js** – Shared config and lookup data.
- **utils.js** – Pure helpers for dates, IDs, CSV, HTML escaping.
- **rice.js** – RICE formula and validation (no DOM).
- **app.js** – State, elements, `init`, `cacheElements`, all UI and event logic, render, modals, import/export. Section comments inside mark: State & DOM cache, Initialization, Filters, Render, Export/Import, etc.

Comments in the code are aimed at helping a human programmer follow flow and intent.

---

## User-friendly guidelines

1. **Create a profile first** – You need at least one profile before adding projects.
2. **Fill required RICE fields** – Title, Reach value, Impact (1–5), Confidence (0–100), Effort (1–5) are required for a valid RICE score.
3. **Use View for read-only** – View project shows all data without edit or add/remove country controls.
4. **Export regularly** – Data is only in this browser; export JSON or CSV to back up or move data.
5. **Import merges** – Imported data is merged by profile and project ID; duplicates are avoided.
6. **Filters and sort** – Use filters to focus on a subset; sort by RICE score or other columns to prioritize.

---

## License

Use and modify as needed for your context.
