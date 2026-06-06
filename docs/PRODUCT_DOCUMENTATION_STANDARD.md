# Product Documentation Standard

**Purpose:** Define how product, design, and engineering maintain documentation for the Product Management Prioritization Tool.  
**Audience:** Contributors, reviewers, release owners.  
**Last updated:** 2026-06-06  
**Last audited:** 2026-06-06

| Baseline | Value |
|----------|-------|
| **APP_ASSET_VERSION** | `20260528-ui194` |
| **Compact breakpoint** | **1400px** (`COMPACT_LAYOUT_MAX_WIDTH_PX`) |

---

## 1. Documentation principles

1. **Single source of truth** — Behavior is defined by the **current** code in `index.html`, `css/`, `src/`, and `api/`. Docs that disagree with code are bugs.
2. **Audience-aware** — Each document has a primary reader (PM, engineer, designer, leadership).
3. **Traceable** — Requirements link to code via [TRACEABILITY_MATRIX.md](TRACEABILITY_MATRIX.md).
4. **Readable** — Professional wording, tables, and diagrams; avoid identifier soup without definitions.
5. **Maintained in the same change** — User-visible behavior changes include doc updates in the same delivery.
6. **Policy by reference** — Cross-profile workspace rules live in [GUARDRAILS.md §7](GUARDRAILS.md); other docs reference §7 without restating eligibility or toggle mechanics.

---

## 2. Required document set

| Document | Location | Owner | Update when |
|----------|----------|-------|-------------|
| README | `/README.md` | Product Team | User-facing capabilities, stack, quick start |
| Documentation hub | `/docs/README.md` | Product Team | New files, index changes |
| Product documentation | `/docs/PRODUCT_DOCUMENTATION.md` | Product Team | Major feature or positioning changes |
| PRD | `/docs/PRD.md` | Product Team | New requirements or scope changes |
| User personas | `/docs/USER_PERSONAS.md` | Product Team | New user segments or workflows |
| User stories | `/docs/USER_STORIES.md` | Product Team | New epics or acceptance criteria |
| Variables | `/docs/VARIABLES.md` | Product + Engineering | New state fields, formulas, enums |
| Metrics & OKRs | `/docs/METRICS_AND_OKRS.md` | Product Team | New success metrics |
| Design guidelines | `/docs/DESIGN_GUIDELINES.md` | Design + Engineering | Tokens, components, breakpoints |
| Architecture | `/docs/ARCHITECTURE.md` | Engineering | Modules, data flow, deployment |
| Tech guidelines | `/docs/TECH_GUIDELINES.md` | Engineering | Conventions, modules, persistence |
| Business guidelines | `/docs/BUSINESS_GUIDELINES.md` | Product Team | Rubrics and planning norms |
| Feature logic & constraints | `/docs/FEATURE_LOGIC_AND_CONSTRAINTS.md` | Product + Engineering | Cross-feature behavior, rules, limits |
| Traceability matrix | `/docs/TRACEABILITY_MATRIX.md` | Product + QA | New FR/US IDs |
| Guardrails | `/docs/GUARDRAILS.md` | Product + Engineering | New limitations; §7 cross-profile policy |
| Changelog | `/docs/CHANGELOG.md` | Engineering | Every shipped change |
| Deployment | `/docs/DEPLOYMENT.md` | Engineering | Infra or env changes |
| This standard | `/docs/PRODUCT_DOCUMENTATION_STANDARD.md` | Product Team | Process changes |

---

## 3. Writing standards

### 3.1 Structure

- Start with metadata table (product, version, last audited, implementation baseline when UI-related).
- Use `##` sections with logical order: overview → detail → reference.
- Prefer **tables** for enumerations and **Mermaid** for flows (supported in GitHub and many viewers).

### 3.2 Variable documentation format

Every documented variable must include:

| Column | Content |
|--------|---------|
| Technical name | Code identifier |
| Friendly name | Workshop/PRD label |
| Definition | What it means to the business |
| Formula / logic | How computed, or “user input” |
| App location | Screen, module, or storage |
| Example | Realistic sample value |

Relationship charts live in [VARIABLES.md](VARIABLES.md) §8.

### 3.3 User stories format

Use the template in [USER_STORIES.md](USER_STORIES.md):

- Persona, Goal, Preconditions
- **Given / When / Then** acceptance criteria
- Error and edge handling

### 3.4 Changelog entries

Under `[Unreleased]` during development; on release, move to a dated version.

Each entry should note: **area** (UI, Data, Security, Docs), **date**, **author/team**, **impact** (user-visible / internal), and **summary**.

### 3.5 Responsive documentation

When documenting layout:

- State breakpoint as **`COMPACT_LAYOUT_MAX_WIDTH_PX` = 1400** (not 1024).
- Describe compact as **unified phone/tablet UI** for all widths ≤1400px.
- List both desktop table grid and compact **card list** behaviors where they differ.

### 3.6 Forbidden terminology in product docs

Except inside [GUARDRAILS.md](GUARDRAILS.md), do **not** use the phrases **Super Admin**, **super admin**, or **superAdmin**. Refer to cross-profile behavior as **privileged workspace mode** or **GUARDRAILS.md §7**.

---

## 4. Audit checklist (full repo review)

When performing a comprehensive audit:

1. List `index.html`, all `css/*.css`, `src/**/*.js`, `api/**/*.js`.
2. Compare against [PRD.md](PRD.md) functional requirements and [TRACEABILITY_MATRIX.md](TRACEABILITY_MATRIX.md).
3. Verify `constants.js` enums match UI labels, filters (`filterLabels`, `filterLinks`), and `moscowDisplayNames`.
4. Confirm README deploy URL and storage story match `storage.js` + [DEPLOYMENT.md](DEPLOYMENT.md).
5. Update `APP_ASSET_VERSION` reference in docs when bumping cache version.
6. Confirm all `@media (max-width: …)` compact rules use **1400px** unless documented otherwise.
7. Refresh Mermaid diagrams if data model or flows changed.
8. Set **Last audited** / **Last updated** dates to audit date (YYYY-MM-DD).
9. Verify **Roadmap** terminology (not Project) in user-facing docs; document legacy `projects` migration in VARIABLES §8.16 only.
10. Confirm all **six views** (Table, Board, MoSCoW, Map, RACI, KANO) are documented in PRD FR-5, personas, and user stories.
11. Confirm **33 CSS layers** in README, DESIGN_GUIDELINES, TECH_GUIDELINES, and ARCHITECTURE match `index.html` load order.
12. Document **BYOK**, **LLM analysis**, and **5 Why Framework** in PRD FR-11/FR-2.12/FR-2.13, GUARDRAILS §8, VARIABLES §8.14–8.16, and traceability matrix.
13. Verify CSS load order in TECH_GUIDELINES §3.1 and ARCHITECTURE §10 against `index.html` lines 15–47 exactly.
14. Ensure `TECH_GUIDELINES.md` script load order matches `index.html` exactly (17 scripts before `app.js`).
15. Update [FEATURE_LOGIC_AND_CONSTRAINTS.md](FEATURE_LOGIC_AND_CONSTRAINTS.md) when any feature’s logic, validation rules, or cross-feature constraints change.

### 3.7 Feature logic documentation format

Each feature entry in [FEATURE_LOGIC_AND_CONSTRAINTS.md](FEATURE_LOGIC_AND_CONSTRAINTS.md) should include:

| Column | Content |
|--------|---------|
| Purpose | Why the feature exists for users |
| Logic | How the app implements it (flow, data) |
| Rules | Allowed inputs, workflows, validation |
| Constraints | What must not happen; technical/UX limits |
| Code | Primary files/modules |
| See also | Links to PRD, guardrails, variables, stories |

---

## 5. Review gates

| Gate | Checklist |
|------|-----------|
| **Feature PR** | PRD or user story updated; variables if new fields; design if UI; changelog unreleased |
| **Release** | README; PRODUCT_DOCUMENTATION; traceability; version section in CHANGELOG |
| **Design change** | DESIGN_GUIDELINES tokens/components; compact (≤1400px) vs desktop (>1400px) |
| **Filter / table change** | FR-6 / FR-5 sections; VARIABLES filter keys; compact card QA widths (375, 768, 1400) |

---

## 6. Versioning

- **package.json** `version` — marketing/release semver.
- **APP_ASSET_VERSION** — browser cache bust for static assets (document in [VARIABLES.md](VARIABLES.md)).
- Documentation **Last audited** — date of last full consistency review.

---

## 7. Out of scope for product docs

- Auto-generated API OpenAPI (no REST API beyond state blob).
- Internal script-only utilities unless they affect operators (`scripts/`).
- `node_modules/`.

---

## 8. Contact

Product documentation questions: **Product Team** (repository maintainer).
