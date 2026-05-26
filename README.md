# Product Management Prioritization Tool

**Version 2.0.0** · Local-first portfolio prioritization with RICE, MoSCoW, financial frameworks, and multi-view planning.

[![Deploy on Vercel](https://img.shields.io/badge/deploy-Vercel-black)](docs/DEPLOYMENT.md)

---

## Product overview

The Product Management Prioritization Tool helps product teams **capture initiatives**, **score priority**, **estimate value**, and **communicate roadmaps** — entirely in the browser, without a backend.

| Capability | Description |
|------------|-------------|
| **Profiles** | Separate portfolios (teams, products, owners) with optional password protection |
| **RICE** | `(Reach × Impact × Confidence) ÷ Effort` with explainable tooltips |
| **MoSCoW** | Must / Should / Could / Won't delivery classification |
| **Financial frameworks** | Custom, CLV, NPS, Risk, Headcount, Operational |
| **Views** | Table, Board (Scrum), MoSCoW grid, World map |
| **Portability** | JSON full backup + CSV spreadsheet export; merge import |
| **Security** | PBKDF2 profile passwords; export omits locked profiles without correct password |

---

## Benefits

- **Explainable prioritization** — stakeholders see inputs, formula, and computed RICE in one tooltip  
- **No infrastructure** — open the app or deploy static files to Vercel  
- **Data ownership** — MongoDB on Vercel when configured, with browser cache + export anytime  
- **Planning flexibility** — filter by country, quarter, framework, status; map by count, RICE, or EUR  
- **Professional UX** — responsive layout for phone, tablet, and desktop (2026 UI refresh)

---

## Features (current)

### Profiles & security
- Create, edit, view, delete profiles  
- Search profiles by name/team  
- Optional password (hash only in storage)  
- Inline unlock banner + modal unlock  
- Session unlock resets on tab close/refresh  

### Projects
- Full CRUD with validation  
- RICE, MoSCoW, type, status, period, countries, t-shirt size  
- Six financial frameworks with computed impact  
- Bulk delete in table  

### Views
- **Table** — sortable, filterable, Framework/Type/Status icon columns  
- **Board** — status columns, drag order, RICE sort toggle, **clickable status toggle pills**  
- **MoSCoW** — 2×2 quadrant board  
- **Map** — Leaflet; metrics: Count / RICE / EUR (segmented pills)  
- Fullscreen on all views  

### Data transfer
- **Export** — JSON or CSV; per-profile unlock verification for protected profiles (wrong/missing passwords exclude that profile); consistent show/hide password controls  
- **Import** — merge JSON/CSV into existing workspace using the same modern modal design system as export  

### Exchange rates
- Refresh FX to EUR for cross-currency comparison in table and map  

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Frontend | HTML5, CSS3, vanilla JavaScript |
| Map | Leaflet 1.9.4 (CDN) |
| Crypto | Web Crypto PBKDF2 (`profile-security.js`) |
| Storage | MongoDB (Vercel `/api`) + `localStorage` cache + `sessionStorage` unlock |
| Hosting | Static (Vercel) |

**CSS layers:** `main.css` + `*-modern.css` (workspace, header, profiles, portfolio, modals, export, toolbars).

**Source layout:**

```
public/       → static UI (index.html, css/, src/)
api/          → Vercel serverless (MongoDB /api/state, /api/config)
docs/         → symlink to public/docs (product documentation)
```

---

## Getting started

### Local development

```bash
cd pm-prioritization-tool
npm run dev
# Open http://localhost:5173
```

Or: `cd public && python3 -m http.server 5173` (UI only; use `npx vercel dev` for `/api` + MongoDB).

### Production (Vercel)

Connect the GitHub repo → deploy `main` on Vercel with `MONGODB_URI`. Details: **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

**Production app:** [https://pm-prioritization-tool-six.vercel.app](https://pm-prioritization-tool-six.vercel.app) — MongoDB cloud sync + `/api` enabled.

```bash
npm run verify:production
```

Do not use `pm-prioritization-tool.vercel.app` (legacy React app on another Vercel project).

**MongoDB / deploy help:** [docs/VERCEL_MONGODB_FIX.md](docs/VERCEL_MONGODB_FIX.md) · [docs/SETUP_VERCEL_GITHUB.md](docs/SETUP_VERCEL_GITHUB.md)

### First-use checklist

1. Create a **profile** (optionally set a password).  
2. **Add projects** with RICE and optional financial framework.  
3. Use **Table / Board / MoSCoW / Map** to plan and present.  
4. **Export JSON** regularly as backup (primary store is MongoDB when cloud is connected).  

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
| [PRODUCT_DOCUMENTATION_STANDARD.md](PRODUCT_DOCUMENTATION_STANDARD.md) | Authoring standard |
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

---

## License

UNLICENSED (private). See `package.json`.

---

## Maintainer

**Product Team** — product documentation last comprehensively audited: **2026-05-26**.
