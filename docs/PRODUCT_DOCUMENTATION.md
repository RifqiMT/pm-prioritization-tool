# Product Documentation

| Field | Value |
|-------|-------|
| **Product** | Product Management Prioritization Tool |
| **Version** | 2.0.0 |
| **Document owner** | Product Team |
| **Last audited** | 2026-05-27 |
| **Implementation baseline** | `APP_ASSET_VERSION` = `20260528-ui115` |

---

## 1. Product overview

The **Product Management Prioritization Tool** is a browser-based workspace for product teams to capture initiatives, score priority with **RICE**, classify delivery intent with **MoSCoW**, estimate value through **financial frameworks**, and communicate plans through **Table**, **Board**, **MoSCoW**, and **Map** views.

The application runs as a **static single-page app** (HTML, CSS, vanilla JavaScript) deployable to **Vercel**. When configured, workspace data syncs to **MongoDB Atlas** via serverless `/api` routes; the browser keeps a **local cache** and supports **JSON/CSV export** for backup and portability.

**Canonical production URL:** [https://pm-prioritization-tool-six.vercel.app](https://pm-prioritization-tool-six.vercel.app)

---

## 2. Product benefits

| Benefit | How the product delivers it |
|---------|------------------------------|
| **Explainable prioritization** | RICE inputs, formula, and computed score appear together in tooltips and sortable columns. |
| **Portfolio separation** | Multiple **profiles** (teams, products, owners) with optional password protection. |
| **Financial planning lenses** | Six frameworks (Custom, CLV, NPS, Risk, Headcount, Operational) without accounting complexity. |
| **Meeting-ready views** | Table for analysis, Board for workflow, MoSCoW for scope negotiation, Map for geography. |
| **Data ownership** | Cloud sync when enabled; export anytime; merge import for spreadsheets. |
| **Works everywhere** | Responsive layout: **desktop** (>1024px) and **unified compact phone UI** (≤1024px) on tablets and phones. |
| **Low operational cost** | No mandatory backend for local use; optional MongoDB on Vercel. |

---

## 3. Feature catalog

### 3.1 Profiles and security

- Create, edit, view, delete profiles (name, optional team).
- Search profiles in the panel and via the **profile picker** on compact layouts.
- Optional **PBKDF2 password** per profile (`src/modules/profile-security.js`).
- **Session unlock** (`sessionStorage`); re-lock on tab close/refresh.
- Locked profiles show a banner; project views stay empty until unlock.

### 3.2 Projects

- Full CRUD via modal (create, edit, read-only view).
- **RICE** with validation (`src/rice.js`).
- Metadata: type, status, MoSCoW, quarter, countries, t-shirt size.
- **Bulk delete** in table view (toolbar on desktop; **floating selection bar** on compact).
- Stable **project ID** visible in the modal footer.

### 3.3 Financial frameworks

| Framework | Purpose |
|-----------|---------|
| **custom** | Direct monetary amount |
| **clv** | Customer lifetime value delta vs baseline |
| **nps** | Retention, expansion, referral, program cost |
| **risk** | Expected loss reduction net of mitigation |
| **headcount** | FTE time saved × loaded cost |
| **operational** | Unit cost and cycle-time savings |

Computed in `computeFrameworkFinancialImpact()` (`src/app.js`). Table shows a **Framework** icon column; advanced filters support framework.

### 3.4 Planning views

| View | Desktop (>1024px) | Compact (≤1024px, phone UI) |
|------|-------------------|-----------------------------|
| **Table** | Sortable grid, bulk delete in toolbar | Horizontal scroll hint; FAB for new project; selection bar for bulk delete |
| **Board** | Horizontal status columns | **Single-column stack**; move via dropdown; RICE sort toggle |
| **MoSCoW** | 2×2 quadrant grid | **2×2 nav pills** + **single-column** quadrants; jump nav |
| **Map** | Leaflet choropleth | Same metrics; compact metric picker |
| **Fullscreen** | Per-view expand | Body-level host + tab bar; same compact layouts |

### 3.5 Data transfer

- **Export** JSON or CSV; password verification for protected profiles.
- **Import** merge JSON/CSV into existing workspace.
- Shared modal design (`export-modals-modern.css`).

### 3.6 Exchange rates

- Refresh FX rates to EUR (`src/modules/exchange-rates.js`).
- EUR column in table; **Financial (EUR)** map metric.
- Profile view: original-currency breakdown shows **EUR equivalents** per currency card using the latest in-app exchange rates (graceful fallback when unavailable).

### 3.7 Cloud storage (optional)

- `AppStorage` (`src/modules/storage.js`): load/save workspace to MongoDB.
- Header status, Cloud modal, pull/save actions.
- Debounced sync, focus/visibility refresh, merge by `updatedAt`.

### 3.8 Site chrome

- App header: title, storage status, export/import, FX refresh, cloud.
- **Footer**: attribution and author links (`app-footer.css`).

---

## 4. Core business logic

### 4.1 RICE prioritization

```
confidenceDecimal = confidenceValue > 1 ? confidenceValue / 100 : confidenceValue
riceScore = (reachValue × impactValue × confidenceDecimal) ÷ effortValue
```

- Reach: non-negative **integer**.
- Impact, Effort: **1–5**.
- Confidence: **0–100** (percent) or 0–1 decimal.
- Effort ≤ 0 → score **0**.

### 4.2 Filtering

`applyFilters()` in `src/app.js` intersects quick filters (title, type, countries, period) with advanced filters (framework, status, MoSCoW).

### 4.3 Board ordering

- **RICE sort on**: cards sorted by score within each status column.
- **RICE sort off**: manual order persisted in `profile.boardOrder[status]`.
- Compact: change status via **Move to** dropdown on cards.

### 4.4 MoSCoW

- Categories: Must / Should / Could / Won't (`moscowList`).
- Compact: quadrant **navigator** syncs with scroll (`syncMoscowCompactNav`, `IntersectionObserver`).
- Drag-and-drop between quadrants when unlocked.

### 4.5 Map aggregation

`mapMetric`: `projects` (count) | `rice` (sum) | `financial` (EUR total per country).

---

## 5. Technical architecture (summary)

See [ARCHITECTURE.md](ARCHITECTURE.md) for diagrams.

| Layer | Technology |
|-------|------------|
| UI | `index.html`, layered `css/*` |
| Logic | `src/app.js`, `src/rice.js`, `src/constants.js`, `src/utils.js` |
| Modules | `profile-security`, `storage`, `exchange-rates`, `fullscreen`, `overlay-manager` |
| API | `api/health.js`, `api/state.js` (Vercel serverless) |
| Database | MongoDB Atlas (optional) |
| Map | Leaflet 1.9.4 (CDN) |

**Layout classes** (set in `initCompactLayoutClass()`):

| Class | When |
|-------|------|
| `html.is-compact-layout` | Viewport width ≤ 1024px |
| `html.is-phone-layout` | Same as compact (unified phone UI on all non-desktop widths) |
| `html.is-desktop-layout` | Width > 1024px |

---

## 6. Business guidelines (summary)

See [BUSINESS_GUIDELINES.md](BUSINESS_GUIDELINES.md).

- Use a **consistent RICE rubric** across the team before comparing scores.
- Treat financial outputs as **planning estimates**, not audited financial statements.
- MoSCoW is for **scope negotiation**, not a substitute for RICE.
- **Export JSON** before major imports or browser data clears.
- Unlock protected profiles before export or supply passwords in the export dialog.

---

## 7. Technical guidelines (summary)

See [TECH_GUIDELINES.md](TECH_GUIDELINES.md).

- Classic scripts (no bundler); globals from `constants.js`, `rice.js`, `utils.js`.
- State persisted under `STORAGE_KEY` (`rice_prioritizer_v1`) plus optional cloud document.
- Bump `APP_ASSET_VERSION` when shipping UI changes (cache bust).
- Modals coordinated via `OverlayManager`.
- Do not log passwords or export file contents.

---

## 8. Design system (summary)

See [DESIGN_GUIDELINES.md](DESIGN_GUIDELINES.md).

- **Warm professional** palette: cream surfaces (`#fffdf8`), maroon text (`#3f0f19`), red accent (`#b91c1c`).
- **Icon-first** navigation on compact widths.
- **Touch targets** ≥ 44px on primary actions.
- Status and framework colors consistent across table, board, and pills.

---

## 9. Limitations and guardrails

See [GUARDRAILS.md](GUARDRAILS.md).

- No multi-user real-time collaboration.
- No role-based access control beyond profile passwords.
- FX rates may be stale if not refreshed.
- Very large portfolios may slow table render (client-side only).

---

## 10. Related documents

| Document | Purpose |
|----------|---------|
| [PRD.md](PRD.md) | Formal requirements |
| [USER_PERSONAS.md](USER_PERSONAS.md) | Personas |
| [USER_STORIES.md](USER_STORIES.md) | Stories and acceptance criteria |
| [VARIABLES.md](VARIABLES.md) | Variable dictionary and relationship charts |
| [METRICS_AND_OKRS.md](METRICS_AND_OKRS.md) | Metrics and OKRs |
| [TRACEABILITY_MATRIX.md](TRACEABILITY_MATRIX.md) | Requirements → code |
| [CHANGELOG.md](CHANGELOG.md) | Release history |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Vercel + MongoDB setup |
| [PRODUCT_DOCUMENTATION_STANDARD.md](PRODUCT_DOCUMENTATION_STANDARD.md) | How to maintain this suite |

---

## 11. Maintainer

**Developed, managed, and maintained by Rifqi Tjahyono**  
- LinkedIn: [rifqi-tjahjono](https://www.linkedin.com/in/rifqi-tjahjono/)  
- Website: [rifqi-tjahyono.com](https://rifqi-tjahyono.com/)
