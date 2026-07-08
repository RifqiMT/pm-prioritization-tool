# Documentation Hub

| Field | Value |
|-------|-------|
| **Product** | Product Management Prioritization Tool |
| **Version** | 2.0.0 |
| **Maintainer** | Product Team |
| **Last audited** | 2026-07-08 |
| **Implementation baseline** | `APP_ASSET_VERSION` = `20260708-ui198` |
| **Repository** | [github.com/RifqiMT/pm-prioritization-tool](https://github.com/RifqiMT/pm-prioritization-tool) |

This folder is the **single source of product truth** for engineering, design, product management, and stakeholders (**17 documents** + root [README.md](../README.md) = **18-file suite**). Documents are maintained against the **current** implementation in `index.html`, `css/`, `src/`, and `api/`.

---

## How to use this documentation

| Audience | Start here | Then read |
|----------|------------|-----------|
| **New contributor** | [../README.md](../README.md) | [ARCHITECTURE.md](ARCHITECTURE.md), [TECH_GUIDELINES.md](TECH_GUIDELINES.md) |
| **Product / PM** | [PRODUCT_DOCUMENTATION.md](PRODUCT_DOCUMENTATION.md) | [FEATURE_LOGIC_AND_CONSTRAINTS.md](FEATURE_LOGIC_AND_CONSTRAINTS.md), [PRD.md](PRD.md), [USER_STORIES.md](USER_STORIES.md) |
| **Cross-functional alignment** | [FEATURE_LOGIC_AND_CONSTRAINTS.md](FEATURE_LOGIC_AND_CONSTRAINTS.md) | [GUARDRAILS.md](GUARDRAILS.md), [VARIABLES.md](VARIABLES.md), [BUSINESS_GUIDELINES.md](BUSINESS_GUIDELINES.md) |
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
| [FEATURE_LOGIC_AND_CONSTRAINTS.md](FEATURE_LOGIC_AND_CONSTRAINTS.md) | Cross-feature logic, rules, and constraints (collaborative reference) |

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

## Source code map (audited 2026-07-08)

```
pm-prioritization-tool/
├── index.html                      # Shell, modals, filters, seven views, BYOK, footer
├── css/                            # 41 layered stylesheets (see TECH_GUIDELINES.md §3.1)
│   ├── main.css … export-modals-modern.css
│   ├── byok-api-keys.css
│   ├── view-toolbars-modern.css … app-footer.css
│   ├── filters-compact-bar.css
│   ├── filters-sheet-modern.css    # Bottom-sheet filters (compact)
│   ├── mobile-command-deck.css     # Compact portfolio command deck
│   ├── compact-view-gutter.css
│   ├── profile-picker-compact.css  # Profile combobox (compact)
│   ├── view-tabs-compact-menu.css  # View tab overflow menu
│   ├── rich-description-content.css
│   ├── rich-text-editor.css
│   ├── portfolio-kano-modern.css
│   ├── gantt-view.css              # Gantt timeline grid and bars
│   ├── share-link.css              # Deep-link focus ring on portfolio cards
│   ├── confirm-modals-modern.css   # Delete/confirm dialogs
│   └── filter-combobox-fix.css     # Profile/filter combobox alignment
├── src/
│   ├── app.js                      # State, render, CRUD, filters, import/export
│   ├── constants.js                # Enums, tooltips, APP_ASSET_VERSION
│   ├── rice.js                     # RICE formula + validation
│   ├── utils.js                    # Format, CSV, IDs, legacy field strip
│   ├── dev-seed-workspace.js       # Localhost sample data (gated in app.js)
│   └── modules/
│       ├── workspace-merge.js      # Concurrent cloud merge + tombstones
│       ├── storage.js              # localStorage + MongoDB sync
│       ├── profile-security.js     # PBKDF2 profile passwords
│       ├── exchange-rates.js       # FX to EUR
│       ├── fullscreen.js           # Per-view fullscreen
│       ├── overlay-manager.js      # Single-overlay policy
│       ├── description-format.js   # Sanitize/render description HTML
│       ├── rich-text-editor.js     # RichTextEditor for description fields
│       ├── board-drag.js           # Board drag-and-drop
│       ├── board-card-interaction.js
│       ├── byok-api-keys.js        # Encrypted local Groq/Tavily keys
│       ├── roadmap-llm-summary.js  # Tavily research + Groq summary
│       ├── roadmap-5why-framework.js # Iterative WHY 1→5 questions
│       ├── roadmap-periods.js      # Multi-quarter roadmapPeriods
│       ├── gantt-view.js           # Gantt timeline view
│       ├── export-payload.js       # JSON/CSV export builders
│       └── share-link.js           # URL hash deep links
├── api/
│   ├── health.js                   # GET storage probe
│   ├── config.js                   # GET client config (same probe as health)
│   ├── state.js                    # GET/PUT/POST workspace document
│   ├── byok/
│   │   ├── validate-groq.js        # POST validate Groq key (BYOK)
│   │   └── validate-tavily.js      # POST validate Tavily key (BYOK)
│   └── _lib/
│       ├── auth.js                 # Bearer PM_API_SECRET
│       ├── mongo.js                # Mongo client
│       ├── http.js                 # JSON helpers
│       ├── roadmap-metadata.js     # Server-side labels/links normalize
│       ├── export-payload.js       # Server-side export helpers (shared with client)
│       └── byok-validate.js        # Shared BYOK validation helpers
├── scripts/
│   ├── verify-deployment.js        # Production smoke test
│   ├── test-storage-sync-logic.js  # npm run test:storage
│   ├── test-roadmap-metadata.js    # npm run test:metadata
│   ├── test-persistence-keys.js    # npm run test:persistence
│   ├── test-byok-encryption.js     # npm run test:byok
│   ├── test-byok-validate.js       # npm run test:byok-validate
│   ├── test-kano-zones.js          # npm run test:kano
│   ├── test-roadmap-llm-summary.js # npm run test:llm
│   ├── test-roadmap-5why-framework.js # npm run test:5why
│   ├── test-export-payload.js      # npm run test:export
│   ├── test-roadmap-periods.js     # npm run test:periods
│   ├── test-gantt-view.js          # npm run test:gantt
│   ├── test-share-link.js          # npm run test:share
│   ├── test-workspace-merge.js     # npm run test:workspace-merge
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
2. [FEATURE_LOGIC_AND_CONSTRAINTS.md](FEATURE_LOGIC_AND_CONSTRAINTS.md) when feature logic, rules, or constraints change  
3. Affected spec ([PRD.md](PRD.md), [VARIABLES.md](VARIABLES.md), or [DESIGN_GUIDELINES.md](DESIGN_GUIDELINES.md))  
4. [TRACEABILITY_MATRIX.md](TRACEABILITY_MATRIX.md) if requirement IDs change  
5. Root [README.md](../README.md) if capabilities or stack change  

Privileged workspace mode changes: update **[GUARDRAILS.md](GUARDRAILS.md) §7** only; do not duplicate in other documents.

Documentation must reflect **current runtime behavior**, use readable structure, and cite implementation paths where helpful.
