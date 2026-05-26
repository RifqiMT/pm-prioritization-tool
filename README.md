# Product Management Prioritization Tool

**Version 2.0.0** · Portfolio prioritization with RICE, MoSCoW, financial frameworks, multi-view planning, and optional MongoDB cloud sync.

[![Deploy on Vercel](https://img.shields.io/badge/deploy-Vercel-black)](docs/DEPLOYMENT.md)

**Production:** [https://pm-prioritization-tool-six.vercel.app](https://pm-prioritization-tool-six.vercel.app)  
**Asset baseline:** `APP_ASSET_VERSION` = `20260526-ui54`

---

## Product overview

The Product Management Prioritization Tool helps product teams **capture initiatives**, **score priority**, **estimate value**, and **communicate roadmaps** in the browser. Data can stay **local** (cache + export) or sync to **MongoDB** on Vercel when configured.

| Capability | Description |
|------------|-------------|
| **Profiles** | Separate portfolios (teams, products, owners) with optional password protection |
| **RICE** | `(Reach × Impact × Confidence) ÷ Effort` with explainable tooltips |
| **MoSCoW** | Must / Should / Could / Won't delivery classification |
| **Financial frameworks** | Custom, CLV, NPS, Risk, Headcount, Operational |
| **Views** | Table, Board (Scrum), MoSCoW, World map |
| **Portability** | JSON full backup + CSV export; merge import |
| **Security** | PBKDF2 profile passwords; export omits locked profiles without correct password |
| **Responsive UI** | Desktop (>1024px); **unified phone UI** on tablets and phones (≤1024px) |

---

## Benefits

- **Explainable prioritization** — stakeholders see inputs, formula, and computed RICE in one tooltip  
- **Flexible hosting** — static files locally; Vercel + MongoDB for cloud workspaces  
- **Data ownership** — export anytime; merge import; per-browser cache with optional cloud sync  
- **Planning flexibility** — filter by country, quarter, framework, status; map by count, RICE, or EUR  
- **Meeting-ready on any device** — compact layout uses vertical stacks (no sideways board/MoSCoW scroll), FAB, and touch-friendly controls  

---

## Features (current)

### Profiles & security
- Create, edit, view, delete profiles  
- Search profiles by name/team; **profile picker** on compact header  
- Optional password (hash only in storage)  
- Inline unlock banner + modal unlock  
- Session unlock resets on tab close/refresh  

### Projects
- Full CRUD with validation  
- RICE, MoSCoW, type, status, period, countries, t-shirt size  
- Six financial frameworks with computed impact  
- Bulk delete in table (toolbar on desktop; **floating selection bar** on compact)  

### Views

| View | Desktop (>1024px) | Compact (≤1024px) |
|------|-------------------|-------------------|
| **Table** | Sortable grid, bulk delete in toolbar | FAB for new project; selection bar for bulk delete |
| **Board** | Horizontal status columns, drag-and-drop | Single-column stack; **Move to** status dropdown |
| **MoSCoW** | 2×2 quadrant grid | 2×2 **nav pills** + single-column quadrants; scroll-synced nav |
| **Map** | Leaflet choropleth | Count / RICE / EUR metric pills |
| **Fullscreen** | Per-view expand | Body host; same compact layouts inside fullscreen |

### Data transfer
- **Export** — JSON or CSV; per-profile unlock for protected profiles  
- **Import** — merge JSON/CSV; shared modal design with export  

### Exchange rates & cloud
- Refresh FX to EUR for table and map  
- Optional **MongoDB** sync via `/api/state` (header status, Cloud modal, pull/save)  

### Site chrome
- App header with storage status, export/import, FX, cloud  
- **Footer** with maintainer attribution and links  

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Frontend | HTML5, CSS3, vanilla JavaScript (classic scripts) |
| Map | Leaflet 1.9.4 (CDN) |
| Crypto | Web Crypto PBKDF2 (`profile-security.js`) |
| Storage | MongoDB (Vercel `/api`) + `localStorage` cache + `sessionStorage` unlock |
| Hosting | Static assets on Vercel; serverless API routes |

**CSS layers (load order matters):**

| File | Role |
|------|------|
| `main.css` | Base design system |
| `workspace-modern.css` | Table, board, filters |
| `header-modern.css` | App header |
| `profiles-modern.css` | Profile panel |
| `portfolio-modern.css` | Portfolio workspace, FAB |
| `profile-modals-modern.css` | Profile modals |
| `export-modals-modern.css` | Export/import modals |
| `view-toolbars-modern.css` | View toolbars |
| `compact-modern.css` | Compact chrome (≤1024px) |
| `moscow-compact.css` | MoSCoW compact layout |
| `board-compact.css` | Board compact layout |
| `table-compact.css` | Table compact layout |
| `fullscreen-compact.css` | Fullscreen compact host |
| `app-footer.css` | Site footer |

**Source layout:**

```
index.html, css/, src/     → static UI at repo root
api/                       → Vercel serverless (health, state, config)
docs/                      → product documentation suite
```

---

## Getting started

### Local development

```bash
cd pm-prioritization-tool
npm run dev
# Open http://localhost:5173
```

Or: `cd public && python3 -m http.server 5173` (UI only). Use `npx vercel dev` for `/api` + MongoDB.

### Production (Vercel)

Connect the GitHub repo → deploy `main` with `MONGODB_URI`. See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

```bash
npm run verify:production
```

Do not use `pm-prioritization-tool.vercel.app` (legacy React app on another Vercel project).

### First-use checklist

1. Create a **profile** (optionally set a password).  
2. **Add projects** with RICE and optional financial framework.  
3. Use **Table / Board / MoSCoW / Map** to plan and present.  
4. **Export JSON** regularly as backup (especially when using cloud sync).  

---

## Business & technical guidelines

- Use a **consistent RICE rubric** across the team ([docs/BUSINESS_GUIDELINES.md](docs/BUSINESS_GUIDELINES.md)).  
- Treat financial outputs as **planning estimates**, not accounting.  
- **Export before** major imports or browser data clears.  
- Protected profiles: unlock before export or enter passwords in the export dialog.  

Technical conventions: [docs/TECH_GUIDELINES.md](docs/TECH_GUIDELINES.md).

---

## Documentation

| Document | Description |
|----------|-------------|
| [docs/README.md](docs/README.md) | Documentation hub |
| [docs/PRODUCT_DOCUMENTATION.md](docs/PRODUCT_DOCUMENTATION.md) | Comprehensive product reference |
| [docs/PRODUCT_DOCUMENTATION_STANDARD.md](docs/PRODUCT_DOCUMENTATION_STANDARD.md) | How to maintain documentation |
| [docs/PRD.md](docs/PRD.md) | Product requirements |
| [docs/USER_PERSONAS.md](docs/USER_PERSONAS.md) | Personas |
| [docs/USER_STORIES.md](docs/USER_STORIES.md) | Epics & stories |
| [docs/VARIABLES.md](docs/VARIABLES.md) | Variables, formulas, diagrams |
| [docs/METRICS_AND_OKRS.md](docs/METRICS_AND_OKRS.md) | Product metrics & OKRs |
| [docs/DESIGN_GUIDELINES.md](docs/DESIGN_GUIDELINES.md) | Design system |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Architecture |
| [docs/TRACEABILITY_MATRIX.md](docs/TRACEABILITY_MATRIX.md) | Req → code traceability |
| [docs/GUARDRAILS.md](docs/GUARDRAILS.md) | Limitations |
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

Product documentation last comprehensively audited: **2026-05-26**.
