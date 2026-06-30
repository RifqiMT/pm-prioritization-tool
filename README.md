# Product Management Prioritization Tool

**Version 2.0.0** · Browser-based portfolio prioritization with **RICE**, **MoSCoW**, financial frameworks, multi-view planning, and optional **MongoDB** cloud sync.

[![Deploy on Vercel](https://img.shields.io/badge/deploy-Vercel-black)](docs/DEPLOYMENT.md)

| | |
|---|---|
| **Production** | [pm-prioritization-tool-six.vercel.app](https://pm-prioritization-tool-six.vercel.app) |
| **Repository** | [github.com/RifqiMT/pm-prioritization-tool](https://github.com/RifqiMT/pm-prioritization-tool) |
| **Asset baseline** | `APP_ASSET_VERSION` = `20260528-ui196` (per-asset `?v=` tags in `index.html`) |
| **Docs hub** | [docs/README.md](docs/README.md) |

> Do not use `pm-prioritization-tool.vercel.app` — that hostname serves a legacy React app. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

---

## Product overview

The Product Management Prioritization Tool helps product teams **capture initiatives**, **score priority**, **estimate value**, and **communicate roadmaps** in the browser. Each **profile** is an isolated portfolio (team, product, or owner). Roadmaps are scored with **RICE**, classified with **MoSCoW**, and optionally valued with **six financial frameworks**. Data can remain **local** (browser cache + export) or sync to **MongoDB** on Vercel when configured.

### Core capabilities

| Capability | Description |
|------------|-------------|
| **Profiles** | Multiple portfolios with optional PBKDF2 password protection |
| **RICE** | `(Reach × Impact × Confidence) ÷ Effort` with explainable tooltips |
| **MoSCoW** | Must Have / Should Have / Could Have / Won't Have quadrants |
| **Financial frameworks** | Custom, CLV, NPS, Risk, Headcount, Operational |
| **Views** | Table, Scrum board, MoSCoW, world map (Leaflet), RACI matrix, KANO portfolio matrix, **Gantt timeline** |
| **Filters** | Search, quick filters, advanced filters (including labels and links) |
| **Portability** | JSON full backup + CSV export; merge import |
| **Responsive UI** | Desktop (>1400px); unified phone/tablet UI (≤1400px) |
| **Cloud (optional)** | MongoDB workspace via `/api/state` |
| **BYOK AI (optional)** | Encrypted local Groq + Tavily API keys; **LLM analysis** + **5 Why Framework** (session-only; not synced to cloud) |

### Product benefits

- **Explainable prioritization** — stakeholders see RICE inputs, formula, and computed score together  
- **Flexible hosting** — static files locally; Vercel + MongoDB for shared workspaces  
- **Data ownership** — export anytime; merge import; per-browser cache with optional cloud sync  
- **Planning flexibility** — filter by country, quarter, framework, status, labels, links; map by count, RICE, or EUR  
- **Meeting-ready on any device** — compact layout uses vertical stacks, FAB, touch-friendly controls, and quadrant nav pills  
- **Optional AI assistance** — three-paragraph LLM briefings and iterative 5 Why question chains via Tavily + Groq using your own API keys (BYOK)  

---

## Features (current implementation)

### Profiles and security

- Create, edit, view, and delete profiles (name, optional team)  
- Search profiles in the panel; **profile picker** on compact layouts  
- Optional profile password (hash only in storage; never plaintext)  
- Inline unlock banner and modal unlock flows  
- Session unlock in `sessionStorage` (cleared on tab close / refresh)  
- **Demo profile** (`Test`) is read-only when active  

### Roadmaps

- Full CRUD via modal (create, edit, read-only view) with section navigation  
- **Rich-text descriptions** on roadmap, **Note**, and four RICE fields — six surfaces total (sanitized HTML; plain text in CSV export)  
- RICE validation and live score calculation  
- Metadata: type, status, MoSCoW, multi-quarter **periods** (`roadmapPeriods[]`), optional **deadline** (`YYYY-MM-DD`), countries, t-shirt size, **labels**, **links**, **tasks**, **RACI** assignments, **KANO** scores (functionality × satisfaction)  
- Six financial frameworks with computed impact  
- Bulk delete in table (toolbar on desktop; **floating selection bar** on compact)  
- **Bulk duplicate / move** across profiles when privileged workspace mode is active (see [docs/GUARDRAILS.md](docs/GUARDRAILS.md) §7)  
- Stable **roadmap ID** in modal footer metadata  
- **LLM analysis** (optional) — Tavily enriches context from roadmap links; Groq (`llama-3.1-8b-instant`) produces professional or simplified three-paragraph summaries; session-only (not stored in MongoDB)  
- **5 Why Framework** (optional) — view-only section generates iterative WHY 1→5 plain-English questions (DMAIC-aligned lenses) via Tavily + Groq; session-only; independent from LLM summary

### BYOK API keys (optional)

- Header **API keys** modal stores **Groq** and **Tavily** keys encrypted in `localStorage` (`pm_byok_v1`) on this device only  
- Keys validated via `/api/byok/validate-groq` and `/api/byok/validate-tavily` (key sent only during explicit validation)  
- Never included in workspace export or MongoDB sync  
- Required for **Generate LLM analysis** (Summary section) and **5 Why Framework** (view-only section) in the roadmap modal  

### Filters

| Tier | Controls |
|------|----------|
| **Search** | Title (with autocomplete), label (with autocomplete) |
| **Quick** | Roadmap type, countries (multi + EU shortcut), roadmap period |
| **Advanced** | Impact, effort, currency, framework, status, t-shirt, MoSCoW, links (any / with / without), labels (any / with / without) |

Active filter count appears in the portfolio filters badge. Reset restores defaults.

### Planning views

| View | Desktop (>1400px) | Compact (≤1400px) |
|------|-------------------|---------------------|
| **Table** | Sortable grid; semantic column layout; bulk delete in toolbar | Card list with grouping; FAB for new roadmap; selection bar for bulk delete |
| **Board** | Horizontal status columns; drag-and-drop | Single-column stack per status; **Move to** dropdown; owner stripe when workspace-wide mode active (see [GUARDRAILS.md](docs/GUARDRAILS.md) §7) |
| **MoSCoW** | 2×2 quadrant grid; full category names in headers | 2×2 **Jump to quadrant** nav + single-column quadrants |
| **Map** | Leaflet choropleth | Metric pills: count, RICE sum/avg, financial EUR sum/avg |
| **RACI** | 5-column matrix (Responsible, Accountable, Consulted, Informed) | Business/Tech perspective toggle; compact card-per-roadmap layout |
| **KANO** | Portfolio matrix (functionality × satisfaction) | Positioned / Not positioned panels; drag tiles on desktop; score in roadmap modal |
| **Gantt** | ISO-week timeline; bars from `roadmapPeriods[]`; deadline marker | Zoom: Monthly / Standard / Wide; Jump to today; sticky header |
| **Fullscreen** | Per-view expand | Same compact layouts inside fullscreen host |

### Data transfer

- **Export** — JSON or CSV; per-profile password verification for protected profiles  
- **Import** — merge JSON/CSV; shared modal design with export  

### Exchange rates and cloud

- Refresh FX to EUR for table, map, and profile currency breakdowns  
- Optional **MongoDB** sync: header status, Cloud modal, pull/save (`src/modules/storage.js`)  

### Site chrome

- App header: storage status, export/import, FX refresh, cloud, actions menu (compact)  
- **Footer**: year, maintainer, LinkedIn, website, GitHub, article links  

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | HTML5, CSS3, vanilla JavaScript (classic scripts, no bundler) |
| Scoring | `src/rice.js` |
| Crypto | Web Crypto PBKDF2 (`src/modules/profile-security.js`) |
| Storage | `localStorage` cache + optional MongoDB via Vercel `/api` |
| Map | Leaflet 1.9.4 (CDN) |
| Hosting | Static assets on Vercel; serverless API routes |

### Source layout

```
pm-prioritization-tool/
├── index.html              # App shell, modals, views, footer
├── css/                    # Layered stylesheets (load order matters)
├── src/
│   ├── app.js              # State, render, CRUD, filters, boards
│   ├── constants.js        # Enums, tooltips, APP_ASSET_VERSION
│   ├── rice.js             # RICE formula + validation
│   ├── utils.js            # Formatting, CSV, IDs, flags
│   ├── dev-seed-workspace.js  # Localhost sample workspace (gated)
│   └── modules/            # storage, profile-security, exchange-rates, fullscreen, overlay-manager,
│                           # description-format, rich-text-editor, board-drag, board-card-interaction,
│                           # byok-api-keys, roadmap-llm-summary, roadmap-5why-framework,
│                           # roadmap-periods, gantt-view, export-payload
├── api/                    # health, config, state, byok/validate-* + _lib (Vercel)
├── scripts/                # verify-deployment; 11 test suites (storage … gantt)
├── docs/                   # Product documentation suite
├── vercel.json
└── package.json
```

### CSS layers (load order in `index.html` — 40 files)

| # | File | Role |
|---|------|------|
| 1–7 | `main` … `export-modals` | Base tokens, workspace, header, profiles, portfolio, modals |
| 8 | `byok-api-keys.css` | BYOK API keys modal |
| 9–17 | `view-toolbars` … `app-footer` | Toolbars, compact views, fullscreen, footer |
| 18–23 | `views-density` … `table-compact-cards` | Density, layout, table structure |
| 24–28 | `super-admin` … `view-toolbars-compact-row` | Workspace mode, map tooltips, board DnD |
| 29–33 | `filters-compact-bar` … `view-tabs-compact-menu` | Filters sheet, mobile command deck, profile picker, view overflow menu |
| 34–40 | `rich-description-content` … `filter-combobox-fix` | Rich text, KANO matrix, Gantt timeline, confirm dialogs, combobox fixes |

Full numbered list: [docs/TECH_GUIDELINES.md](docs/TECH_GUIDELINES.md) §3.1 (must match `index.html` lines 15–54).

### Layout breakpoint

- **`COMPACT_LAYOUT_MAX_WIDTH_PX`** = **1400** (`src/constants.js`)  
- ≤1400px: `html.is-compact-layout` + `html.is-phone-layout` (unified phone/tablet UI)  
- >1400px: `html.is-desktop-layout` (sidebar profiles + data table)  

---

## Getting started

### Local development

```bash
cd pm-prioritization-tool
npm install
npm run dev
# Open http://localhost:5173
```

For `/api` + MongoDB locally: `npx vercel dev` with env vars (see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)).

### Production verification

```bash
npm run verify:production
```

### First-use checklist

1. Create a **profile** (optionally set a password).  
2. **Add roadmaps** with RICE and optional financial framework.  
3. Use **Table / Board / MoSCoW / Map / RACI / KANO** to plan and present.  
4. **Export JSON** regularly as backup (especially when using cloud sync).  

---

## Testing

```bash
npm test                    # 11 automated suites (storage, metadata, persistence, export, byok, kano, llm, 5why, periods, gantt)
npm run verify:production   # Smoke test production deploy
```

CI (`.github/workflows/ci.yml`) runs `npm run build` and `npm test` on every push/PR to `main`.

---

## Business and technical guidelines

- Use a **consistent RICE rubric** — [docs/BUSINESS_GUIDELINES.md](docs/BUSINESS_GUIDELINES.md)  
- Treat financial outputs as **planning estimates**, not accounting truth  
- **Export before** major imports or clearing browser data  
- Protected profiles: unlock before export or verify passwords in the export dialog  
- Technical conventions: [docs/TECH_GUIDELINES.md](docs/TECH_GUIDELINES.md)  
- Limitations and privileged workspace mode: [docs/GUARDRAILS.md](docs/GUARDRAILS.md)  

---

## Documentation

| Document | Description |
|----------|-------------|
| [docs/README.md](docs/README.md) | Documentation hub and source map |
| [docs/PRODUCT_DOCUMENTATION.md](docs/PRODUCT_DOCUMENTATION.md) | Comprehensive product reference |
| [docs/FEATURE_LOGIC_AND_CONSTRAINTS.md](docs/FEATURE_LOGIC_AND_CONSTRAINTS.md) | Cross-feature logic, rules, and constraints |
| [docs/PRODUCT_DOCUMENTATION_STANDARD.md](docs/PRODUCT_DOCUMENTATION_STANDARD.md) | How to maintain documentation |
| [docs/PRD.md](docs/PRD.md) | Product requirements |
| [docs/USER_PERSONAS.md](docs/USER_PERSONAS.md) | Personas |
| [docs/USER_STORIES.md](docs/USER_STORIES.md) | Epics and acceptance criteria |
| [docs/VARIABLES.md](docs/VARIABLES.md) | Variables, formulas, relationship charts |
| [docs/METRICS_AND_OKRS.md](docs/METRICS_AND_OKRS.md) | Product metrics and OKRs |
| [docs/DESIGN_GUIDELINES.md](docs/DESIGN_GUIDELINES.md) | Design system and tokens |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Architecture and data flow |
| [docs/TECH_GUIDELINES.md](docs/TECH_GUIDELINES.md) | Engineering conventions |
| [docs/BUSINESS_GUIDELINES.md](docs/BUSINESS_GUIDELINES.md) | Prioritization rubrics |
| [docs/TRACEABILITY_MATRIX.md](docs/TRACEABILITY_MATRIX.md) | Requirements → code |
| [docs/GUARDRAILS.md](docs/GUARDRAILS.md) | Business and technical limitations |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | Change history |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Vercel + MongoDB |

---

## License

UNLICENSED (private). See `package.json`.

---

## Maintainer

**Developed, managed, and maintained by Rifqi Tjahyono**

- LinkedIn: [rifqi-tjahjono](https://www.linkedin.com/in/rifqi-tjahjono/)  
- Website: [rifqi-tjahyono.com](https://rifqi-tjahyono.com/)  
- GitHub: [RifqiMT/pm-prioritization-tool](https://github.com/RifqiMT/pm-prioritization-tool)  
- Article: [Effort–impact confusion to clear-cut priorities](https://rifqi-tjahyono.com/%f0%9f%93%8a-effort-impact-confusion-to-clear-cut-priorities-replace-tab-hopping-with-visual-roadmap-sanity-%f0%9f%a7%ad%e2%9c%a8/)

**Documentation last comprehensively audited:** 2026-06-29 (baseline `20260629-ui195`).
