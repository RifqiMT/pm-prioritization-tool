# Product Requirements Document (PRD)

| Field | Value |
|-------|-------|
| **Product** | Product Management Prioritization Tool |
| **Version** | 2.0.0 |
| **Status** | Implemented (local-first static app) |
| **Last updated** | 2026-05-26 |

---

## 1. Executive summary

A browser-based portfolio workspace for product teams to capture initiatives, score priority with **RICE**, classify delivery intent with **MoSCoW**, estimate value through **financial frameworks**, and communicate via **Table**, **Board**, **MoSCoW**, and **Map** views. Data persists in the browser (`localStorage` cache) with optional **MongoDB cloud sync** on Vercel, plus JSON/CSV export/import. Optional **profile passwords** protect sensitive portfolios. **Responsive UI:** desktop layout above 1024px; tablets and phones share a unified compact phone layout at ≤1024px.

---

## 2. Goals

| ID | Goal |
|----|------|
| G-1 | Standardize prioritization with explainable RICE |
| G-2 | Support multi-portfolio planning via profiles |
| G-3 | Enable financial planning lenses without accounting complexity |
| G-4 | Provide meeting-ready views (table, board, quadrant, geo map) |
| G-5 | Allow backup and merge via export/import |
| G-6 | Protect sensitive portfolios with optional passwords |

## 3. Non-goals

- Multi-user collaboration, roles, or audit server
- Server-side persistence or authentication service
- Sprint/dependency/workflow management (Jira replacement)
- Accounting-grade financial reporting

---

## 4. Target users

See [USER_PERSONAS.md](USER_PERSONAS.md).

---

## 5. Functional requirements

### FR-1 Profiles

| ID | Requirement | Acceptance |
|----|-------------|------------|
| FR-1.1 | Create profile (name, optional team) | Profile appears in list |
| FR-1.2 | Edit profile (name, team, password) | Changes persist after refresh |
| FR-1.3 | Delete profile (password if protected) | Profile and projects removed |
| FR-1.4 | Activate profile | Portfolio workspace shows selection |
| FR-1.5 | Search profiles | Filters by name/team |
| FR-1.6 | Optional password on create | Hash stored; profile locked until unlock |

### FR-2 Projects

| ID | Requirement | Acceptance |
|----|-------------|------------|
| FR-2.1 | CRUD projects | Modal create/edit; view read-only |
| FR-2.2 | RICE inputs with validation | See FR-3 |
| FR-2.3 | Metadata: type, status, MoSCoW, period, countries, t-shirt | Saved on project |
| FR-2.4 | Bulk delete (table) | Confirmation; selection respected |
| FR-2.5 | Project ID in modal footer | Stable id visible |

### FR-3 RICE

| ID | Requirement | Acceptance |
|----|-------------|------------|
| FR-3.1 | Formula `(R × I × C) ÷ E` | Matches `calculateRiceScore` |
| FR-3.2 | Reach ≥ 0 integer | Validation error otherwise |
| FR-3.3 | Impact 1–5, Effort 1–5 | Validation error otherwise |
| FR-3.4 | Confidence 0–100% | Normalized when > 1 |
| FR-3.5 | RICE tooltip | Abbreviations + formula + computed line |

### FR-4 Financial frameworks

| ID | Framework | Requirement |
|----|-----------|-------------|
| FR-4.1 | custom | Direct amount entry |
| FR-4.2 | clv | CLV delta vs baseline retention logic |
| FR-4.3 | nps | NPS-driven retention/expansion/referral |
| FR-4.4 | risk | Expected loss reduction net of mitigation |
| FR-4.5 | headcount | FTE avoidance from time saved |
| FR-4.6 | operational | Unit cost + cycle-time labor savings |
| FR-4.7 | — | Switching framework sanitizes inputs |
| FR-4.8 | — | Table **Framework** column + filter |

### FR-5 Views

| ID | View | Requirement |
|----|------|-------------|
| FR-5.1 | Table | Sort, filter, icon columns, actions |
| FR-5.2 | Board | Columns by status; DnD order; status filter pills |
| FR-5.3 | MoSCoW | Desktop: 2×2 grid; compact: nav pills + single-column quadrants; optional RICE sort |
| FR-5.4 | Map | Leaflet choropleth; metric: count / RICE / EUR |
| FR-5.5 | All | Fullscreen mode (compact layouts preserved in fullscreen host) |
| FR-5.6 | Locked profile | No project data in any view |
| FR-5.7 | Compact layout | ≤1024px: unified phone UI; no horizontal scroll on board/MoSCoW; table bulk delete via selection bar |

#### FR-5.2 Board status filter pills (expanded acceptance)
- **Toggle semantics:** clicking a status pill hides or shows the matching board column without reloading the page.
- **A11y contract:** each pill exposes `aria-pressed="true|false"` and supports keyboard navigation (focus + activation).
- **Safety constraint:** users cannot hide all status columns; at least one column must remain visible.
- **Persistence:** the hidden/shown preference persists to `localStorage` as `boardHiddenStatuses`.

### FR-6 Filters

Quick: title, type, countries, period.  
Advanced: impact, effort, currency, framework, status, t-shirt, MoSCoW, financial range.  
Active filter pill summarizes state.

### FR-7 Exchange rates

Manual refresh; rates cached in state; EUR conversion for table/map financial displays.

### FR-8 Export / import

| ID | Requirement | Acceptance |
|----|-------------|------------|
| FR-8.1 | Export JSON | Download file with exportable profiles only |
| FR-8.2 | Export CSV | One row per project |
| FR-8.3 | Export password gate | Locked profiles omitted unless verified |
| FR-8.4 | Import JSON | Merge profiles/projects by id |
| FR-8.5 | Import CSV | Merge project rows |
| FR-8.6 | UI parity | Import/export modals share design system |

#### FR-8.3 Export password gate (expanded acceptance)
- **Verification is per-profile:** the export unlock dialog verifies each locked profile independently.
- **Incorrect/missing passwords exclude:** profiles with incorrect or empty passwords are omitted from the export payload.
- **User feedback:** export completion messaging reflects skipped protected profiles (count and, when possible, names).

#### FR-8.6 UI parity (expanded acceptance)
- Import/export modals use the same component language: consistent header, scrollable body, and footer action layout.
- Format selection uses consistent card-style controls (JSON/CSV).
- Password reveal controls use the same show/hide eye toggle pattern across flows.

### FR-9 UX / accessibility

| ID | Requirement |
|----|-------------|
| FR-9.1 | Single visible tooltip app-wide |
| FR-9.2 | Modal field tooltips for all variables |
| FR-9.3 | Responsive header, profiles, portfolio (compact ≤1024px = phone UI; desktop >1024px) |
| FR-9.6 | Site footer | Attribution and external links visible on all breakpoints |
| FR-9.4 | Password show/hide on all password fields |
| FR-9.5 | Delete confirmations |

---

## 6. Non-functional requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-1 | Performance | Usable with hundreds of projects per profile on modern browsers |
| NFR-2 | Security | Passwords hashed (PBKDF2); never plaintext in storage |
| NFR-3 | Privacy | No telemetry requirement; data in browser cache by default; optional cloud document on Vercel |
| NFR-4 | Deploy | Static hosting; CSP in `vercel.json` |
| NFR-5 | Offline | Core features work without network except map tiles and FX |
| NFR-6 | Portability | Chrome, Firefox, Safari, Edge (current versions) |

---

## 7. Data retention

- **localStorage:** browser cache of workspace JSON, UI preferences, FX cache
- **MongoDB (optional):** canonical workspace document when `MONGODB_URI` configured
- **sessionStorage:** unlocked profile IDs for current tab session
- **User responsibility:** export backups; clearing site data deletes local cache (cloud may retain copy)

---

## 8. Out of scope / future considerations

- Team sync and shared workspaces
- Role-based access control
- Automated OKR dashboards (metrics defined in [METRICS_AND_OKRS.md](METRICS_AND_OKRS.md) for manual tracking)
- Native mobile apps

---

## 9. References

- [PRODUCT_DOCUMENTATION.md](PRODUCT_DOCUMENTATION.md) — comprehensive product reference  
- [VARIABLES.md](VARIABLES.md) — formulas and field dictionary  
- [TRACEABILITY_MATRIX.md](TRACEABILITY_MATRIX.md) — requirement mapping  
- [CHANGELOG.md](CHANGELOG.md) — release history  
