# Documentation Hub

| Field | Value |
|-------|-------|
| **Product** | Product Management Prioritization Tool |
| **Version** | 2.0.0 |
| **Maintainer** | Product Team |
| **Last audited** | 2026-05-28 |
| **Implementation baseline** | `APP_ASSET_VERSION` = `20260528-ui192` |
| **Repository** | [github.com/RifqiMT/pm-prioritization-tool](https://github.com/RifqiMT/pm-prioritization-tool) |

This folder is the **single source of product truth** for engineering, design, product management, and stakeholders. Documents are maintained against the **current** implementation in `index.html`, `css/`, `src/`, and `api/`.

---

## How to use this documentation

| Audience | Start here | Then read |
|----------|------------|-----------|
| **New contributor** | [../README.md](../README.md) | [ARCHITECTURE.md](ARCHITECTURE.md), [TECH_GUIDELINES.md](TECH_GUIDELINES.md) |
| **Product / PM** | [PRODUCT_DOCUMENTATION.md](PRODUCT_DOCUMENTATION.md) | [PRD.md](PRD.md), [USER_STORIES.md](USER_STORIES.md), [BUSINESS_GUIDELINES.md](BUSINESS_GUIDELINES.md) |
| **Design** | [DESIGN_GUIDELINES.md](DESIGN_GUIDELINES.md) | [VARIABLES.md](VARIABLES.md) (labels and tooltips) |
| **Leadership / OKRs** | [METRICS_AND_OKRS.md](METRICS_AND_OKRS.md) | [TRACEABILITY_MATRIX.md](TRACEABILITY_MATRIX.md) |
| **Release / QA** | [CHANGELOG.md](CHANGELOG.md) | [GUARDRAILS.md](GUARDRAILS.md), [DEPLOYMENT.md](DEPLOYMENT.md) |
| **Privileged workspace mode** | [GUARDRAILS.md](GUARDRAILS.md) §7 only | — |

---

## Document index

### Standards and governance

| Document | Purpose |
|----------|---------|
| [GUARDRAILS.md](GUARDRAILS.md) | Business and technical limitations; privileged workspace mode (§7) |
| [TRACEABILITY_MATRIX.md](TRACEABILITY_MATRIX.md) | Requirements → code → verification |
| [CHANGELOG.md](CHANGELOG.md) | Historical development log |
| [PRODUCT_DOCUMENTATION_STANDARD.md](PRODUCT_DOCUMENTATION_STANDARD.md) | How to maintain this suite |

### Product definition

| Document | Purpose |
|----------|---------|
| [PRODUCT_DOCUMENTATION.md](PRODUCT_DOCUMENTATION.md) | Overview, benefits, features, logic, guidelines |
| [PRD.md](PRD.md) | Requirements, scope, functional / non-functional specs |
| [USER_PERSONAS.md](USER_PERSONAS.md) | Target users and workflow context |
| [USER_STORIES.md](USER_STORIES.md) | Epics, stories, acceptance criteria |
| [BUSINESS_GUIDELINES.md](BUSINESS_GUIDELINES.md) | Prioritization rubrics and planning norms |

### Technical reference

| Document | Purpose |
|----------|---------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Runtime model, modules, data flow |
| [TECH_GUIDELINES.md](TECH_GUIDELINES.md) | Coding conventions, persistence, modules |
| [VARIABLES.md](VARIABLES.md) | Variable dictionary, formulas, relationship charts |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Vercel, MongoDB, troubleshooting |

### Design and metrics

| Document | Purpose |
|----------|---------|
| [DESIGN_GUIDELINES.md](DESIGN_GUIDELINES.md) | Themes, tokens, components, CSS layers |
| [METRICS_AND_OKRS.md](METRICS_AND_OKRS.md) | Product metrics and team OKRs |

---

## Source code map (audited 2026-05-28)

```
pm-prioritization-tool/
├── index.html                      # Shell, modals, filters, six views, footer
├── css/                            # 31 layered stylesheets (see DESIGN_GUIDELINES.md §4)
│   ├── main.css                    # Base tokens, global buttons, status/framework pills
│   ├── workspace-modern.css        # Workspace panel, table, board columns
│   ├── header-modern.css           # App header, compact actions menu
│   ├── profiles-modern.css         # Profile panel v2, bottom sheet
│   ├── portfolio-modern.css        # Command bar, FAB, filters, selection bar
│   ├── profile-modals-modern.css   # Profile CRUD modals
│   ├── export-modals-modern.css    # Export / import / unlock modals
│   ├── view-toolbars-modern.css    # Table, board, MoSCoW, map toolbars
│   ├── view-toolbars-compact-row.css
│   ├── compact-modern.css          # Compact chrome (≤1400px)
│   ├── moscow-compact.css          # MoSCoW compact nav + quadrants
│   ├── board-compact.css           # Board compact stack
│   ├── table-compact.css           # Table compact toolbar
│   ├── table-compact-cards.css     # Compact table card list + grouping
│   ├── table-rows-modern.css       # Desktop table rows
│   ├── table-revamp-modern.css     # Semantic column layout
│   ├── roadmap-actions-modern.css  # View / Edit / Delete actions
│   ├── roadmap-details-tooltip.css # Card/table description tooltips
│   ├── rich-text-editor.css        # Rich-text toolbar + fields
│   ├── super-admin-modern.css      # Workspace-wide mode (GUARDRAILS §7)
│   ├── map-tooltip-modern.css      # Map hover / pinned tooltips
│   ├── board-drag.css              # Board DnD visuals
│   ├── board-card-interaction.css  # Card press feedback
│   ├── filters-compact-bar.css     # Filters drawer compact bar
│   ├── portfolio-kano-modern.css   # KANO portfolio matrix + cards
│   ├── portfolio-cards-compact.css # Board/MoSCoW card shells
│   ├── fullscreen-modern.css       # Fullscreen host
│   ├── fullscreen-compact.css      # Fullscreen + compact
│   ├── views-density.css           # Density scaling
│   ├── layout-flow.css             # Flat dividers (compact)
│   └── app-footer.css              # Site footer
├── src/
│   ├── app.js                      # State, render, CRUD, filters, import/export
│   ├── constants.js                # Enums, tooltips, APP_ASSET_VERSION
│   ├── rice.js                     # RICE formula + validation
│   ├── utils.js                    # Format, CSV, IDs, legacy field strip
│   ├── dev-seed-workspace.js       # Localhost sample data (gated in app.js)
│   └── modules/
│       ├── storage.js              # localStorage + MongoDB sync
│       ├── profile-security.js     # PBKDF2 profile passwords
│       ├── exchange-rates.js       # FX to EUR
│       ├── fullscreen.js           # Per-view fullscreen
│       ├── overlay-manager.js      # Single-overlay policy
│       ├── description-format.js   # Sanitize/render description HTML
│       ├── rich-text-editor.js     # RichTextEditor for description fields
│       ├── board-drag.js           # Board drag-and-drop
│       └── board-card-interaction.js
├── api/
│   ├── health.js                   # GET storage probe
│   ├── config.js                   # GET client config (same probe as health)
│   ├── state.js                    # GET/PUT/POST workspace document
│   └── _lib/
│       ├── auth.js                 # Bearer PM_API_SECRET
│       ├── mongo.js                # Mongo client
│       ├── http.js                 # JSON helpers
│       └── roadmap-metadata.js     # Server-side labels/links normalize
├── scripts/
│   ├── verify-deployment.js        # Production smoke test
│   ├── test-storage-sync-logic.js  # npm run test:storage
│   ├── test-roadmap-metadata.js    # npm run test:metadata
│   ├── test-persistence-keys.js    # npm run test:persistence
│   └── disable-vercel-deployment-protection.sh
├── .github/workflows/              # ci.yml, vercel-production.yml, fix-vercel-protection.yml
├── docs/                           # This documentation suite
├── vercel.json                     # Static deploy, CSP, API functions
└── package.json
```

**Layout:** `COMPACT_LAYOUT_MAX_WIDTH_PX` = **1400** → `html.is-compact-layout` + `html.is-phone-layout` on tablets and phones; `html.is-desktop-layout` above 1400px.

---

## Maintenance policy

When changing user-visible behavior, update in the **same delivery** (minimum):

1. [CHANGELOG.md](CHANGELOG.md)  
2. Affected spec ([PRD.md](PRD.md), [VARIABLES.md](VARIABLES.md), or [DESIGN_GUIDELINES.md](DESIGN_GUIDELINES.md))  
3. [TRACEABILITY_MATRIX.md](TRACEABILITY_MATRIX.md) if requirement IDs change  
4. Root [README.md](../README.md) if capabilities or stack change  

Privileged workspace mode changes: update **[GUARDRAILS.md](GUARDRAILS.md) §7** only; do not duplicate in other documents.

Documentation must reflect **current runtime behavior**, use readable structure, and cite implementation paths where helpful.
