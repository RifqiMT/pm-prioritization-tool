# Changelog

All notable changes are recorded here.

## [Unreleased]

### UX / Interaction
- Added advanced filter `Framework` and standardized filter naming to match table terminology.
- Added project-name tooltip on Board/MOSCOW cards with standardized content:
  - project status
  - project description
- Improved card title tooltip alignment (cursor-anchored behavior where appropriate).
- Standardized card icon visual semantics to match table icon-pill conventions.
- Enforced single-tooltip lifecycle across app surfaces (table, cards, modal fields).
- Added modal-wide tooltip stability improvements for rapid hover transitions.

### Project Modal Metadata
- Footer metadata layout updated:
  - Left block now includes `Project ID`, `Created`, `Last modified`
  - Right block now includes `Financial (EUR)`, `Exchange rate`, `RICE score`

### Form Explainability
- Added comprehensive standardized tooltip coverage for every variable field in create/edit modal.
- Implemented auto-injection of fallback standardized tooltips for fields missing explicit tooltip markup.

### Documentation
- Re-audited codebase and refreshed the full product documentation suite:
  - `README.md`
  - `PRODUCT_DOCUMENTATION_STANDARD.md`
  - `docs/README.md`
  - `docs/PRD.md`
  - `docs/USER_PERSONAS.md`
  - `docs/USER_STORIES.md`
  - `docs/VARIABLES.md`
  - `docs/METRICS_AND_OKRS.md`
  - `docs/DESIGN_GUIDELINES.md`
  - `docs/ARCHITECTURE.md`
  - `docs/TRACEABILITY_MATRIX.md`
  - `docs/GUARDRAILS.md`
  - `docs/CHANGELOG.md`

### Product / UX Alignment Captured
- RICE values represented as tooltip on RICE score (standalone column removed)
- RICE tooltip expanded with abbreviation meanings + formula + calculation line
- New table `Framework` column with icon + tooltip semantics
- Financial frameworks documented as currently implemented:
  - `custom`, `clv`, `nps`, `risk`, `headcount`, `operational`
- Number-input spinner removal and wheel-increment prevention documented

### Architecture Notes
- Current folder snapshot audited as:
  - `index.html`, `css/main.css`, `src/app.js`, `src/rice.js`
- Runtime-referenced but currently missing module contracts documented for clarity
