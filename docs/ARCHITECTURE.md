# Architecture Overview

## 1) Runtime Model

- **Application type:** Local-first static web application.
- **Execution model:** Browser runtime with classic script loading (no bundler required to run).
- **Persistence model:** `localStorage` state snapshot under `rice_prioritizer_v1`.

---

## 2) Module Boundaries

| Module | Responsibility |
|---|---|
| `index.html` | App shell, views, forms, modals, table, and control wiring points (IDs/classes). |
| `css/main.css` | Design system, responsive layout, component styling, interaction visuals. |
| `src/constants.js` | Domain constants: statuses, MOSCOW categories, tooltips, currencies, countries, aliases, storage key. |
| `src/utils.js` | Shared utilities: formatting, ID generation, CSV parsing/escaping, helper converters. |
| `src/rice.js` | RICE calculation and project input validation logic. |
| `src/modules/exchange-rates.js` | ETL and scheduling for multi-source exchange rates, conversion helpers. |
| `src/modules/fullscreen.js` | Fullscreen orchestration and cross-view transition handling in fullscreen mode. |
| `src/app.js` | Main controller: state lifecycle, event bindings, rendering, CRUD flows, import/export, modal orchestration. |
| `src/main.js` | Entry support script (project boot integration). |

---

## 3) State and Data Flow

### 3.1 State lifecycle

1. Boot app (`DOMContentLoaded` -> `init()`).
2. Cache DOM references.
3. Load persisted state from localStorage.
4. Ensure baseline profile exists.
5. Render active profile views.
6. Ensure exchange rates and schedule daily refresh.

### 3.2 Render flow

- Any data mutation triggers `saveState()` and relevant `render*()` functions.
- Table, board, MOSCOW, and map derive from active profile + filter state + sorting state.
- Financial EUR computations rely on current exchange-rate snapshot.

---

## 4) Exchange Rates ETL Architecture

### Sources

- Frankfurter API (EUR base)
- MoneyConvert API (USD base)
- Static fallback map (for resilience)

### ETL sequence

1. **Extract** from both APIs.
2. **Transform** to normalized `currency -> EUR per 1 unit`.
3. **Load/Merge** (primary first, fill gaps from secondary, then fallback).
4. Persist snapshot date in Berlin timezone.
5. Update label and dependent views.

---

## 5) Fullscreen Architecture

- Fullscreen module supports table, board, MOSCOW, and map containers.
- Moves modals/toasts/tooltips to current fullscreen root to avoid clipping.
- Supports pending view switch while fullscreen by exiting and re-entering target view.

---

## 6) Import/Export Architecture

- Export supports JSON and CSV.
- Import supports JSON and CSV parser paths.
- Merge logic:
  - match profiles by ID/name
  - match projects by project ID
  - skip duplicates
  - normalize country names

---

## 7) Key Technical Decisions

1. **No backend dependency**
   - minimizes setup and operational complexity.
2. **Classic script architecture**
   - supports direct browser-open execution.
3. **Deterministic scoring**
   - RICE logic is fully transparent and reproducible.
4. **Resilient rates pipeline**
   - multi-source + fallback protects financial functionality.

---

## 8) Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Storage quota overflow | Encourage periodic export backups; keep payload lean. |
| API outage/CORS issue | Fallback rates and non-blocking app behavior. |
| Visual drift from layered CSS overrides | Consolidated theme sections and guardrail checks. |
| Import data inconsistencies | Canonicalization and merge de-dup logic. |

