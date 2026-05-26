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
| **Product / PM** | [PRD.md](PRD.md) | [USER_STORIES.md](USER_STORIES.md), [BUSINESS_GUIDELINES.md](BUSINESS_GUIDELINES.md) |
| **Design** | [DESIGN_GUIDELINES.md](DESIGN_GUIDELINES.md) | [VARIABLES.md](VARIABLES.md) (labels & tooltips) |
| **Leadership / OKRs** | [METRICS_AND_OKRS.md](METRICS_AND_OKRS.md) | [TRACEABILITY_MATRIX.md](TRACEABILITY_MATRIX.md) |
| **Release / QA** | [CHANGELOG.md](CHANGELOG.md) | [GUARDRAILS.md](GUARDRAILS.md), [DEPLOYMENT.md](DEPLOYMENT.md) |

---

## Document index

### Standards and governance

| Document | Purpose |
|----------|---------|
| [../PRODUCT_DOCUMENTATION_STANDARD.md](../PRODUCT_DOCUMENTATION_STANDARD.md) | Authoring rules, required files, review checklist |
| [GUARDRAILS.md](GUARDRAILS.md) | Business and technical limitations |
| [TRACEABILITY_MATRIX.md](TRACEABILITY_MATRIX.md) | Requirements → code → verification |
| [CHANGELOG.md](CHANGELOG.md) | Historical development log |

### Product definition

| Document | Purpose |
|----------|---------|
| [PRD.md](PRD.md) | Requirements, scope, functional/non-functional specs |
| [USER_PERSONAS.md](USER_PERSONAS.md) | Persona index |
| [personas/PM_PRIMARY.md](personas/PM_PRIMARY.md) | Primary product manager |
| [personas/DELIVERY_LEAD.md](personas/DELIVERY_LEAD.md) | Delivery / engineering lead |
| [personas/GEO_FINANCE_PM.md](personas/GEO_FINANCE_PM.md) | Geo + financial planning |
| [personas/PORTFOLIO_STAKEHOLDER.md](personas/PORTFOLIO_STAKEHOLDER.md) | Executive / stakeholder reader |
| [USER_STORIES.md](USER_STORIES.md) | Epics, stories, acceptance criteria |
| [BUSINESS_GUIDELINES.md](BUSINESS_GUIDELINES.md) | Prioritization rubrics and planning norms |

### Technical reference

| Document | Purpose |
|----------|---------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Runtime model, modules, data flow |
| [TECH_GUIDELINES.md](TECH_GUIDELINES.md) | Coding conventions, persistence, modules |
| [VARIABLES.md](VARIABLES.md) | Variable dictionary, formulas, relationship charts |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Vercel static hosting and smoke tests |

### Design and metrics

| Document | Purpose |
|----------|---------|
| [DESIGN_GUIDELINES.md](DESIGN_GUIDELINES.md) | Themes, tokens, components, CSS layers |
| [METRICS_AND_OKRS.md](METRICS_AND_OKRS.md) | Product metrics and team OKRs |

---

## Source code map (audited 2026-05-26)

```
pm-prioritization-tool/
├── index.html                 # App shell, modals, views
├── css/
│   ├── main.css               # Base design system + legacy
│   ├── workspace-modern.css   # Table, board, filters
│   ├── header-modern.css      # App header
│   ├── profiles-modern.css    # Profile panel
│   ├── portfolio-modern.css   # Portfolio workspace
│   ├── profile-modals-modern.css
│   ├── export-modals-modern.css  # Export/import + unlock
│   └── view-toolbars-modern.css
├── src/
│   ├── app.js                 # State, render, CRUD, I/O
│   ├── rice.js                # RICE formula + validation
│   ├── constants.js           # Enums, lists, tooltips
│   ├── utils.js               # Formatting, CSV, IDs
│   ├── main.js                # Bootstrap entry
│   └── modules/
│       ├── exchange-rates.js
│       ├── fullscreen.js
│       └── profile-security.js
├── vercel.json
└── package.json
```

---

## Maintenance policy

When changing behavior, update in the **same PR** (minimum):

1. `docs/CHANGELOG.md`
2. Affected spec (`PRD.md`, `VARIABLES.md`, or `DESIGN_GUIDELINES.md`)
3. `TRACEABILITY_MATRIX.md` if requirements change
4. Root `README.md` if user-facing capabilities change

See [PRODUCT_DOCUMENTATION_STANDARD.md](../PRODUCT_DOCUMENTATION_STANDARD.md) for the full checklist.
