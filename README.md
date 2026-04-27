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

## Current Runtime File Inventory

Audited source files in this repository snapshot:

- `index.html`
- `css/main.css`
- `src/app.js`
- `src/rice.js`

`index.html` references additional scripts (`src/constants.js`, `src/utils.js`, `src/modules/exchange-rates.js`, `src/modules/fullscreen.js`) that are expected contracts for runtime but are not present in this folder snapshot.

## Business and Technical Guidelines

- Use a consistent RICE calibration rubric across teams
- Keep MoSCoW category explicit for every project
- Treat exchange-rate-derived EUR values as decision support, not accounting books
- Export regularly for backup and auditability
- Keep tooltip content explanatory and non-ambiguous

## Tech Stack

- HTML5, CSS3, Vanilla JavaScript
- Leaflet map integration (via CDN in `index.html`)
- Local persistence via `localStorage`
- Optional exchange-rate and fullscreen modules via global script contracts

## Getting Started

1. Open `index.html` directly in a modern browser, or run a static server.
2. Create a profile.
3. Add projects with RICE and optional financial framework inputs.
4. Use Table/Board/MOSCOW/Map to prioritize and communicate decisions.
5. Export data periodically.

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
