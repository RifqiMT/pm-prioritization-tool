# Documentation Hub

**Product:** Product Management Prioritization Tool  
**Version:** 2.0.0  
**Maintainer:** Product Team  
**Last audited:** 2026-05-26  
**Repository:** [pm-prioritization-tool](https://github.com/RifqiMT/pm-prioritization-tool)

This folder is the single source of product truth for engineering, design, product management, and stakeholders. All documents are maintained against the **current** implementation in `index.html`, `css/`, and `src/`.

---

## How to use this documentation

| Audience | Start here | Then read |
|----------|------------|-----------|
| **New contributor** | [../README.md](../README.md) | [ARCHITECTURE.md](ARCHITECTURE.md), [TECH_GUIDELINES.md](TECH_GUIDELINES.md) |
| **Product / PM** | [PRODUCT_DOCUMENTATION.md](PRODUCT_DOCUMENTATION.md) | [PRD.md](PRD.md), [USER_STORIES.md](USER_STORIES.md), [BUSINESS_GUIDELINES.md](BUSINESS_GUIDELINES.md) |
| **Design** | [DESIGN_GUIDELINES.md](DESIGN_GUIDELINES.md) | [VARIABLES.md](VARIABLES.md) (labels & tooltips) |
| **Leadership / OKRs** | [METRICS_AND_OKRS.md](METRICS_AND_OKRS.md) | [TRACEABILITY_MATRIX.md](TRACEABILITY_MATRIX.md) |
| **Release / QA** | [CHANGELOG.md](CHANGELOG.md) | [GUARDRAILS.md](GUARDRAILS.md), [DEPLOYMENT.md](DEPLOYMENT.md) |

---

## Document index

### Standards and governance

| Document | Purpose |
|----------|---------|
| [GUARDRAILS.md](GUARDRAILS.md) | Business and technical limitations |
| [TRACEABILITY_MATRIX.md](TRACEABILITY_MATRIX.md) | Requirements → code → verification |
| [CHANGELOG.md](CHANGELOG.md) | Historical development log |

### Product definition

| Document | Purpose |
|----------|---------|
| [PRODUCT_DOCUMENTATION.md](PRODUCT_DOCUMENTATION.md) | Product overview, benefits, features, logic, guidelines |
| [PRODUCT_DOCUMENTATION_STANDARD.md](PRODUCT_DOCUMENTATION_STANDARD.md) | Documentation maintenance standard |
| [PRD.md](PRD.md) | Requirements, scope, functional/non-functional specs |
| [USER_PERSONAS.md](USER_PERSONAS.md) | Target users and workflow context |
| [USER_STORIES.md](USER_STORIES.md) | Epics, stories, acceptance criteria |
| [BUSINESS_GUIDELINES.md](BUSINESS_GUIDELINES.md) | Prioritization rubrics and planning norms |

### Technical reference

| Document | Purpose |
|----------|---------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Runtime model, modules, data flow |
| [TECH_GUIDELINES.md](TECH_GUIDELINES.md) | Coding conventions, persistence, modules |
| [VARIABLES.md](VARIABLES.md) | Variable dictionary, formulas, relationship charts |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Vercel, MongoDB, and troubleshooting |

### Design and metrics

| Document | Purpose |
|----------|---------|
| [DESIGN_GUIDELINES.md](DESIGN_GUIDELINES.md) | Themes, tokens, components, CSS layers |
| [METRICS_AND_OKRS.md](METRICS_AND_OKRS.md) | Product metrics and team OKRs |

---

## Source code map (audited 2026-05-26)

```
pm-prioritization-tool/
├── index.html                 # App shell, modals, views, footer
├── css/
│   ├── main.css               # Base design system
│   ├── workspace-modern.css   # Table, board, filters
│   ├── header-modern.css      # App header
│   ├── profiles-modern.css    # Profile panel
│   ├── portfolio-modern.css   # Portfolio workspace, FAB
│   ├── profile-modals-modern.css
│   ├── export-modals-modern.css
│   ├── view-toolbars-modern.css
│   ├── compact-modern.css     # Compact chrome (≤1024px)
│   ├── moscow-compact.css     # MoSCoW compact layout
│   ├── board-compact.css      # Board compact layout
│   ├── table-compact.css      # Table compact layout
│   ├── fullscreen-compact.css # Fullscreen compact host
│   └── app-footer.css         # Site footer
├── src/
│   ├── app.js                 # init(), state, render, CRUD, compact layout
│   ├── rice.js                # RICE formula + validation
│   ├── constants.js           # Enums, APP_ASSET_VERSION, tooltips
│   ├── utils.js               # Formatting, CSV, IDs
│   └── modules/
│       ├── exchange-rates.js
│       ├── fullscreen.js
│       ├── overlay-manager.js
│       ├── profile-security.js
│       └── storage.js
├── api/                       # Vercel serverless (health, state, config)
├── vercel.json
└── package.json
```

**Layout baseline:** `APP_ASSET_VERSION` = `20260526-ui54` — desktop >1024px; compact ≤1024px uses unified phone UI (`is-compact-layout`, `is-phone-layout`).

---

## Maintenance policy

When changing behavior, update in the **same PR** (minimum):

1. `docs/CHANGELOG.md`
2. Affected spec (`PRD.md`, `VARIABLES.md`, or `DESIGN_GUIDELINES.md`)
3. `TRACEABILITY_MATRIX.md` if requirements change
4. Root `README.md` if user-facing capabilities change

Documentation updates must reflect current runtime behavior, use readable structure, and reference implementation locations where relevant.
