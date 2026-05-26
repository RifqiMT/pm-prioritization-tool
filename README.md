# Product Management Prioritization Tool

Local-first web app for portfolio prioritization with RICE, MoSCoW, and multi-framework financial impact.

## Product Overview

This product helps teams capture initiatives, score priority, classify delivery intent, and compare value across multiple views without a backend.

- Prioritization formula: `RICE = (Reach × Impact × Confidence) ÷ Effort`
- Classification model: MoSCoW (`Must`, `Should`, `Could`, `Won't`)
- Financial models: `custom`, `clv`, `nps`, `risk`, `headcount`, `operational`
- Storage model: browser `localStorage` (local-first ownership)

## Core Benefits

- Standardized prioritization across teams and profiles
- Fast planning workflows with sortable/filterable table, board, MOSCOW grid, and geo map
- Financial impact normalization to EUR for cross-currency comparability
- Simple portability via JSON/CSV export and import merge logic

## Key Features

- **Profiles and projects**
  - Create/edit/delete profiles
  - Create/edit/view/delete projects with RICE + optional metadata
- **Views**
  - Table, Board, MOSCOW, Map
  - Fullscreen support for all views
- **Table enhancements**
  - New `Framework` icon column (similar behavior to Type/State icon cells)
  - RICE score tooltip now includes abbreviation meanings + formula + computed line
  - RICE Values standalone column replaced by tooltip on RICE Score
  - Advanced filter includes `Framework` for model-specific slicing
- **Financial impact frameworks**
  - `Custom`: direct value
  - `CLV`: margin/retention/discount based impact
  - `NPS`: retained + expansion + referral profit with basis toggle
  - `Risk`: expected loss reduction net of mitigation cost
  - `Headcount`: avoided FTE equivalent and annual loaded cost
  - `Operational`: cost-per-unit delta + cycle-time labor savings
- **Exchange rates and EUR conversion**
  - Manual refresh and stale-session auto refresh
  - EUR conversion used in table and map financial metric
- **Governance UX**
  - Confirmation toasts, delete confirmations, consistent tooltip system
  - Project modal fields now enforce standardized tooltip coverage for every variable
  - Global single-tooltip behavior enforced across table, cards, and modal fields
  - Card project title tooltip now includes project status and description
  - Modal footer metadata now includes `Project ID`, and `RICE score` is grouped with financial metadata

## Recent UX/Logic Updates (Current Snapshot)

- Added advanced filter `Framework` in the filter panel for financial model segmentation.
- Standardized card icon styling to match table icon-pill semantics and removed redundant border variance.
- Improved task/project card visual hierarchy (spacing, readability, responsive behavior).
- Fixed tooltip lifecycle defects:
  - cursor-aligned project-title tooltip on MOSCOW cards,
  - strict one-tooltip-at-a-time enforcement globally,
  - robust modal tooltip transitions across densely packed fields.
- Added comprehensive tooltip fallback injection for any modal form variable lacking explicit tooltip markup.

## Current Runtime File Inventory

- `index.html` — application shell
- `css/main.css` — styles and design system
- `src/app.js` — state, rendering, CRUD, import/export
- `src/rice.js` — RICE scoring
- `src/constants.js`, `src/utils.js` — shared constants and helpers
- `src/modules/exchange-rates.js`, `src/modules/fullscreen.js` — FX and fullscreen

## Business and Technical Guidelines

- Use a consistent RICE calibration rubric across teams
- Keep MoSCoW category explicit for every project
- Treat exchange-rate-derived EUR values as decision support, not accounting books
- Export regularly for backup and auditability
- Keep tooltip content explanatory and non-ambiguous
- Maintain a single active tooltip at any moment to prevent cognitive and visual conflicts
- Keep framework naming standardized as `Framework` in table/filter/UI labels

## Tech Stack

- HTML5, CSS3, Vanilla JavaScript
- Leaflet map integration (via CDN in `index.html`)
- Local persistence via `localStorage`
- Optional exchange-rate and fullscreen modules via global script contracts

## Getting Started

### Local development

```bash
npm run dev
# Open http://localhost:5173
```

Or open `index.html` via any static server (e.g. `python3 -m http.server 5173`).

### Production (Vercel)

This repo is configured for **Vercel** static hosting (`vercel.json`, `package.json`). See **`docs/DEPLOYMENT.md`** for:

- Importing the GitHub repo into Vercel
- Build/output settings (no compile step)
- Security headers and caching
- Custom domain, preview vs production, smoke tests

**Quick deploy:** connect `https://github.com/RifqiMT/pm-prioritization-tool` in Vercel → deploy `main` with default static settings.

### First use

1. Create a profile.
2. Add projects with RICE and optional financial framework inputs.
3. Use Table/Board/MOSCOW/Map to prioritize and communicate decisions.
4. Export data periodically (data lives in browser `localStorage`).

## Documentation Suite

- Product standard: `PRODUCT_DOCUMENTATION_STANDARD.md`
- Docs hub: `docs/README.md`
- PRD: `docs/PRD.md`
- Personas: `docs/USER_PERSONAS.md`
- User stories: `docs/USER_STORIES.md`
- Variables and formulas: `docs/VARIABLES.md`
- Metrics and OKRs: `docs/METRICS_AND_OKRS.md`
- Design guidelines: `docs/DESIGN_GUIDELINES.md`
- Architecture: `docs/ARCHITECTURE.md`
- Traceability matrix: `docs/TRACEABILITY_MATRIX.md`
- Guardrails: `docs/GUARDRAILS.md`
- Changelog: `docs/CHANGELOG.md`
- Deployment (Vercel): `docs/DEPLOYMENT.md`
