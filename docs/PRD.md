# Product Requirements Document (PRD)  
## Product Management Prioritization Tool

**Version:** 1.0  
**Last updated:** Aligned with README and product documentation standard.

---

## 1. Product overview

### 1.1 Purpose

A **local-first, no-backend** web application for prioritizing projects using:

- **RICE** (Reach × Impact × Confidence ÷ Effort) for numeric prioritization.
- **MoSCoW** (Must have, Should have, Could have, Won't have) for requirement categorization.

All data is stored in the browser. No account, server, or build step required. Target: product managers and teams who need a single place to capture, score, rank, and track projects with optional financial impact in EUR and multiple views (Table, Board, MOSCOW, Map).

### 1.2 Goals

- Provide a single source of truth for project metadata, RICE scores, and MOSCOW category.
- Support multiple portfolios (profiles) and four views: Table (sort/filter), Board (status + drag-and-drop), MOSCOW (2×2 grid), Map (choropleth by country).
- Optional financial impact per project with conversion to EUR via exchange rates ETL (manual + automatic refresh on app open and at 00:00 Germany time).
- Data ownership: export/import JSON or CSV; no vendor lock-in.
- Low friction: no sign-up, no backend; runs from a folder or static server.

### 1.3 Target users

- Product managers maintaining roadmaps and backlogs.
- Teams needing a shared view of project status, RICE scores, MoSCoW priorities, and financial impact by country.
- Anyone wanting a simple, local prioritization tool without sign-up or backend.

---

## 2. User needs and problems

| Need | Problem addressed |
|------|-------------------|
| Prioritize many projects consistently | RICE formula and visible calculation (**?** breakdown). |
| Categorize by MoSCoW | MOSCOW category per project; 2×2 view; drag to change category. |
| Separate contexts (teams/products) | Multiple profiles; switch with one click. |
| See status flow | Board view with columns per status; drag cards between columns. |
| See geographic/financial spread | Map view by project count, RICE, or total financial impact (EUR). |
| Use financial impact in one currency | Optional amount + currency; convert to EUR via rates; show in table and map. |
| Own data, no lock-in | Export/import JSON/CSV; data in browser only. |
| Use without setup | No backend; open index.html or run static server. |

---

## 3. Functional requirements

### 3.1 Profiles

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-P1 | User can create a profile with name (required) and optional team. | Must |
| FR-P2 | User can switch active profile; table, board, MOSCOW, map, and filters apply to that profile. | Must |
| FR-P3 | User can view profile (read-only modal with name, team, statistics). | Must |
| FR-P4 | User can edit profile (name, team). | Must |
| FR-P5 | User can delete profile with confirmation; all projects in that profile are removed. | Must |

### 3.2 Projects

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-J1 | User can add a project when a profile is selected; MOSCOW category defaults to Could have. | Must |
| FR-J2 | User can edit a project (all fields). | Must |
| FR-J3 | User can view a project (read-only modal). | Must |
| FR-J4 | User can delete a single project with confirmation. | Must |
| FR-J5 | User can bulk-delete selected projects (table) with confirmation. | Should |

### 3.3 RICE and optional fields

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-R1 | Project must have: title, reach (≥0 integer), impact (1–5), confidence (0–100), effort (1–5). | Must |
| FR-R2 | RICE score = (Reach × Impact × Confidence) ÷ Effort; displayed; **?** shows exact calculation. | Must |
| FR-R3 | Optional: MOSCOW category, financial impact (amount + currency), project type, status, T-shirt size, period (YYYY-Qn), target countries. | Must |
| FR-R4 | Financial impact converted to EUR using stored exchange rates; short format (K, Mn, Bn, Tn) in table and map. | Must |

### 3.4 Exchange rates

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-E1 | User can manually refresh exchange rates (button); ETL runs (Frankfurter + MoneyConvert + fallback). | Must |
| FR-E2 | On app open, if stored rates missing or date not today (Europe/Berlin), ETL runs automatically. | Must |
| FR-E3 | When app is open, ETL runs at 00:00 Europe/Berlin and next 00:00 is scheduled. | Must |
| FR-E4 | “Last updated” shows date and source (manual/auto). | Must |

### 3.5 Filters and sort

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-F1 | Filters: title search, project type (incl. Not set), countries, period; advanced: impact, effort, currency, status, T-shirt size (incl. Not set), MOSCOW. | Must |
| FR-F2 | Filters apply to table, board, MOSCOW, and map. Reset clears all; active filter count shown. | Must |
| FR-F3 | Table: sortable columns (title, type, status, T-shirt, MOSCOW, RICE, financial EUR, created, modified); default created desc. | Must |

### 3.6 Views

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-V1 | Table view: columns (checkbox, project, type, status, period, T-shirt, MOSCOW, RICE, financial EUR, created, actions); tooltips; bulk delete. | Must |
| FR-V2 | Board view: one column per status; cards with View/Edit/Delete and ↑/↓ (reorder); drag between columns to change status; “Sort by RICE” toggle; manual order persisted when off. | Must |
| FR-V3 | MOSCOW view: 2×2 grid (Must/Should/Could/Won't); drag cards between quadrants to change category; “Sort by RICE” toggle; reorder within quadrant when off. | Must |
| FR-V4 | Map view: choropleth by “Number of projects”, “RICE score”, or “Total financial impact (EUR)” per country; tooltips with flag, name, code, value. | Must |
| FR-V5 | Fullscreen on Table, Board, MOSCOW, Map; view toggle remains enabled to switch view without exiting fullscreen. | Must |

### 3.7 Export and import

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-X1 | User can export all data as JSON or CSV; filename includes timestamp; toast on success. | Must |
| FR-X2 | User can import JSON or CSV; data merged by profile (id/name) and project id; duplicates skipped; country names normalized; toast with counts. | Must |

### 3.8 Tooltips and UX

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-T1 | Cell-type tooltips for type, status, T-shirt, MOSCOW, period, financial (original amount/currency), description; positioned so not clipped (body/fullscreen root); hidden on scroll and when modals open. | Should |
| FR-T2 | Toasts for create/update/delete/export/import (bottom-right, auto-dismiss). | Must |

---

## 4. Non-functional requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| NFR-1 | Runs in modern browsers with JavaScript and localStorage; no backend or build. | Must |
| NFR-2 | Data persisted in localStorage (key `rice_prioritizer_v1`). | Must |
| NFR-3 | Exchange rates: network required for APIs (Frankfurter, MoneyConvert); fallback static rates when APIs fail. | Must |
| NFR-4 | Accessibility: semantic HTML, ARIA where needed, keyboard support. | Should |
| NFR-5 | Respect `prefers-reduced-motion` for transitions. | Should |

---

## 5. Data model (summary)

- **Profile:** id, name, team, createdAt, projects[], boardOrder{}, moscowOrder{}.
- **Project:** id, title, description, RICE fields (reach, impact, confidence, effort + descriptions), financialImpactValue, financialImpactCurrency, moscowCategory, projectType, projectStatus, tshirtSize, projectPeriod, countries[], createdAt, modifiedAt.
- **App state:** activeProfileId, sortField, sortDirection, projectsView, scrumBoardSortByRice, moscowSortByRice, mapMetric, exchangeRatesToEUR, exchangeRatesDate, exchangeRatesLastSource.

Full schemas and storage format: [README §6 – Logics and data model](../README.md#6-logics-and-data-model).

---

## 6. Success criteria

- Users can create profiles and add/edit/view/delete projects with RICE and optional fields.
- Users can view and prioritize in Table, Board, MOSCOW, and Map; filters and sort work across views.
- Exchange rates refresh on app open when stale and at 00:00 Germany; financial impact in EUR visible in table and map.
- Users can export/import data; merge and country normalization behave as specified.
- No backend or sign-up required; runs from file or static server.

---

## 7. Out of scope

- User accounts, authentication, or cloud sync.
- Real-time collaboration or multi-device sync (beyond export/import).
- Native mobile app; web only.
- Built-in version history or undo (export for backups).

---

## 8. References

- Full product documentation: [README.md](../README.md)
- Product documentation standard: [PRODUCT_DOCUMENTATION_STANDARD.md](../PRODUCT_DOCUMENTATION_STANDARD.md)
- User personas: [USER_PERSONAS.md](USER_PERSONAS.md)
- User stories: [USER_STORIES.md](USER_STORIES.md)
