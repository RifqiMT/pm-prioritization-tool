# Documentation Hub

This folder is the **source of truth** for the product documentation suite for `pm-prioritization-tool`.

It is written to be usable by:
- **Product** (PRD, personas, stories, OKRs)
- **Design** (design system, UX patterns, accessibility)
- **Engineering** (architecture, data dictionary, guardrails, traceability)
- **Stakeholders** (decision logic, explainability, value model transparency)

## Information Architecture (IA)

The documentation is organized into two layers:

- **Hub documents** (high-level, stable entry points): the files in this folder root (e.g., `PRD.md`).
- **Deep-dive artifacts** (detailed, enterprise-friendly): subfolders under `docs/` (e.g., `docs/personas/`).

This split keeps the top-level docs readable while still providing thorough depth when needed.

## Start Here (recommended reading order)

1. `../README.md` (product + tech overview)
2. `PRD.md` (requirements + scope + NFRs)
3. `ARCHITECTURE.md` (runtime topology + data flow)
4. `VARIABLES.md` (data dictionary hub → deep-dive variable catalog)
5. `USER_PERSONAS.md` (personas hub → individual persona files)
6. `USER_STORIES.md` (backlog hub → epics/stories breakdown)
7. `DESIGN_GUIDELINES.md` (design system + interaction standards)
8. `METRICS_AND_OKRS.md` (metrics + OKRs hub → metric catalog)
9. `TRACEABILITY_MATRIX.md` (requirements ↔ code mapping)
10. `GUARDRAILS.md` (business + technical constraints)
11. `CHANGELOG.md` (historical change log)
12. `DEPLOYMENT.md` (Vercel production deployment)

## Hub Documents (this folder root)

- `PRD.md` — Product requirements, scope, NFRs, and release criteria.
- `USER_PERSONAS.md` — Persona overview and links to persona deep dives.
- `USER_STORIES.md` — Epics/stories overview and links to detailed story specs.
- `VARIABLES.md` — Variable dictionary hub, formulas, and relationships.
- `METRICS_AND_OKRS.md` — Metrics + OKRs hub and measurement approach.
- `DESIGN_GUIDELINES.md` — Design principles, theme/tokens, components, accessibility.
- `ARCHITECTURE.md` — Runtime model, modules, and major responsibilities.
- `TRACEABILITY_MATRIX.md` — Enterprise traceability (requirements → evidence → verification).
- `GUARDRAILS.md` — Guardrails for business/tech/UX/data/delivery.
- `CHANGELOG.md` — Change history and release notes structure.
- `DEPLOYMENT.md` — Vercel production deployment, headers, caching, smoke tests.

## Deep-dive Artifacts (subfolders)

- `personas/` — One file per persona (goals, jobs-to-be-done, scenarios, success signals).
- `user-stories/` — One file per epic + detailed story specifications.
- `variables/` — Full variable catalog (inputs, derived values, storage schema, UI locations).
- `metrics/` — Metric dictionary + OKR measurement plan.
- `design/` — Theme tokens, component guidelines, interaction patterns.
- `traceability/` — Extended traceability matrices (optional) and audit checklists.

## Maintenance and Governance

All updates must follow `../PRODUCT_DOCUMENTATION_STANDARD.md`.

### Source of truth rule

When docs conflict with runtime behavior, **the code is the source of truth**. Docs must be corrected in the same change cycle.

### Document hygiene expectations

- Use stable IDs for requirements (`FR-*`) and stories (`US-*`) so traceability remains durable.
- Prefer links to deep dives rather than inflating hub docs with too much detail.
- Every major requirement should be traceable to:
  - UI evidence (`index.html`, `css/main.css`)
  - Logic evidence (`src/app.js`, `src/rice.js`, modules)
  - A verification method (manual test plan or automated test where applicable)
