# Product Requirements Document (PRD)

| Field | Value |
|-------|-------|
| **Product** | Product Management Prioritization Tool |
| **Version** | 2.0.0 |
| **Status** | Implemented (local-first static app) |
| **Last updated** | 2026-07-08 |
| **Implementation baseline** | `APP_ASSET_VERSION` = `20260708-ui198` |
| **Compact breakpoint** | `COMPACT_LAYOUT_MAX_WIDTH_PX` = **1400** |

---

> Cross-feature logic and constraints: [FEATURE_LOGIC_AND_CONSTRAINTS.md](FEATURE_LOGIC_AND_CONSTRAINTS.md)

## 1. Executive summary

A browser-based portfolio workspace for product teams to capture initiatives, score priority with **RICE**, classify delivery intent with **MoSCoW**, estimate value through **financial frameworks**, and communicate via **Table**, **Board**, **MoSCoW**, **Map**, **RACI**, and **KANO** views. Data persists in the browser (`localStorage` cache) with optional **MongoDB cloud sync** on Vercel, plus JSON/CSV export/import. Optional **profile passwords** protect sensitive portfolios. Optional **BYOK AI** features (LLM summary and 5 Why Framework) use user-supplied Groq/Tavily keys client-side only.

**Responsive UI:** Desktop layout when viewport width is **> 1400px**; tablets, phones, iPad landscape, split-screen, and narrow laptop windows use a **unified compact phone UI** at **≤ 1400px** (`html.is-compact-layout` + `html.is-phone-layout`).

---

## 2. Goals

| ID | Goal |
|----|------|
| G-1 | Standardize prioritization with explainable RICE |
| G-2 | Support multi-portfolio planning via profiles |
| G-3 | Enable financial planning lenses without accounting complexity |
| G-4 | Provide meeting-ready views (table, board, MoSCoW, map, RACI, KANO) |
| G-5 | Allow backup and merge via export/import |
| G-6 | Protect sensitive portfolios with optional passwords |
| G-7 | Support touch-first planning on tablets and phones without horizontal scroll |

## 3. Non-goals

- Multi-user collaboration, roles, or audit server
- Server-side persistence or authentication service (beyond optional workspace blob API)
- Sprint/dependency/workflow management (Jira replacement)
- Accounting-grade financial reporting

---

## 4. Target users

See [USER_PERSONAS.md](USER_PERSONAS.md).

---

## 5. Functional requirements

### FR-1 Profiles

| ID | Requirement | Acceptance |
|----|-------------|------------|
| FR-1.1 | Create profile (name, optional team) | Profile appears in list |
| FR-1.2 | Edit profile (name, team, password) | Changes persist after refresh |
| FR-1.3 | Delete profile (password if protected) | Profile and roadmaps removed |
| FR-1.4 | Activate profile | Portfolio workspace shows selection |
| FR-1.5 | Search profiles | Filters by name/team |
| FR-1.6 | Optional password on create | Hash stored; profile locked until unlock |
| FR-1.7 | Compact profile picker | At ≤1400px: picker + bottom-sheet profile list |

### FR-2 Roadmaps

| ID | Requirement | Acceptance |
|----|-------------|------------|
| FR-2.1 | CRUD roadmaps | Modal create/edit; view read-only |
| FR-2.2 | RICE inputs with validation | See FR-3 |
| FR-2.3 | Metadata: type, status, MoSCoW, periods, countries, t-shirt, labels, links, tasks, note | Saved on roadmap; `roadmapPeriods[]` with per-quarter status; legacy `roadmapPeriod` migrated |
| FR-2.14 | Multi-quarter periods | `roadmapPeriods`: `{ period: YYYY-Qn, status }[]`; latest period drives derived `roadmapStatus`; bulk quarter editor in modal |
| FR-2.15 | Roadmap deadline | Optional `roadmapDeadline` as `YYYY-MM-DD`; relative hints (due today, overdue); Gantt deadline marker; CSV round-trip |
| FR-2.4 | Bulk delete (table) | Confirmation; selection respected (toolbar desktop; selection bar compact) |
| FR-2.5 | Roadmap ID in modal footer | Stable id visible in footer metadata |
| FR-2.6 | Modal footer disclosure (compact) | At ≤1400px: metadata in `<details>` collapsed by default; desktop forces open |
| FR-2.7 | Rich-text descriptions | Roadmap description, **Note**, and four RICE description fields (six surfaces); sanitized HTML; view mode read-only without toolbar |
| FR-2.8 | Roadmap tasks | Optional task list with name + status per task; CSV import/export |
| FR-2.9 | Labels/links cloud persistence | Canonical format on serialize; immediate cloud flush on roadmap save; server normalize on API write |
| FR-2.10 | RACI assignments | Optional `raci` object with `responsible`, `accountable`, `consulted`, `informed` arrays; each entry has `name` + `domain` (`Business` or `Tech`); normalized on load/save |
| FR-2.11 | KANO scores | Optional `kanoFunctionality` and `kanoSatisfaction` (integers 1–5); drive portfolio KANO matrix placement |
| FR-2.12 | LLM roadmap analysis (optional) | Summary section: Tavily link/search enrichment + Groq three-paragraph briefing; professional/simplified tone toggle; session-only output (not persisted to roadmap or cloud) |
| FR-2.13 | 5 Why Framework (optional) | View-only roadmap modal section: iterative WHY 1→5 questions via Tavily research + Groq; DMAIC-aligned lenses (Define → Control); plain-English questions only (no answers); session-only output; independent from FR-2.12 summary |

### FR-3 RICE

| ID | Requirement | Acceptance |
|----|-------------|------------|
| FR-3.1 | Formula `(R × I × C) ÷ E` | Matches `calculateRiceScore` |
| FR-3.2 | Reach ≥ 0 integer | Validation error otherwise |
| FR-3.3 | Impact 1–5, Effort 1–5 | Validation error otherwise |
| FR-3.4 | Confidence 0–100% | Normalized when > 1 |
| FR-3.5 | RICE tooltip | Abbreviations + formula + computed line |

### FR-4 Financial frameworks

| ID | Framework | Requirement |
|----|-----------|-------------|
| FR-4.1 | custom | Direct amount entry |
| FR-4.2 | clv | CLV delta vs baseline retention logic |
| FR-4.3 | nps | NPS-driven retention/expansion/referral |
| FR-4.4 | risk | Expected loss reduction net of mitigation |
| FR-4.5 | headcount | FTE avoidance from time saved |
| FR-4.6 | operational | Unit cost + cycle-time labor savings |
| FR-4.7 | — | Switching framework sanitizes inputs |
| FR-4.8 | — | Table **Framework** column + filter |

### FR-5 Views

| ID | View | Requirement |
|----|------|-------------|
| FR-5.1 | Table (desktop) | Sortable grid; semantic column classes; bulk select in toolbar |
| FR-5.2 | Table (compact) | Card list (`table-compact-cards.css`); FAB for new roadmap; selection bar for bulk delete; optional **Group by** |
| FR-5.3 | Board | Columns by status; DnD order (desktop); **Move to** on compact; RICE sort toggle; unified card chrome across breakpoints |
| FR-5.4 | MoSCoW | Desktop: 2×2 grid with display names **Must Have**, **Should Have**, **Could Have**, **Won't Have**; compact: 2×2 nav pills + single-column quadrants; optional RICE sort |
| FR-5.5 | Map | Leaflet choropleth; metric: count / RICE / EUR |
| FR-5.6 | RACI | Desktop: 5-column matrix per filtered roadmaps; **Business** / **Tech** perspective toggle; compact: one card per roadmap |
| FR-5.7 | KANO | Portfolio matrix (functionality × satisfaction); **Positioned** / **Not positioned** panels; drag tiles on desktop; open roadmap KANO section from cards |
| FR-5.8 | Gantt | ISO-week timeline; bars from `roadmapPeriods[]` with per-segment status color; optional `roadmapDeadline` diamond; zoom Monthly/Standard/Wide; Jump to today; fullscreen |
| FR-5.9 | All | Fullscreen mode (compact layouts preserved in fullscreen host) |
| FR-5.10 | Locked profile | No roadmap data in any view |
| FR-5.11 | Compact layout | ≤1400px: unified phone UI; no horizontal scroll on board/MoSCoW; table uses card list |

#### FR-5.1 Semantic table columns (desktop)

Desktop table uses `<col>` and cell classes `roadmaps-table-col--*` so column widths stay aligned when optional columns enter the DOM:

| Class suffix | Column |
|--------------|--------|
| `select` | Bulk checkbox |
| `title` | Roadmap title |
| `owner` | Owner profile (privileged workspace mode only; see FR-10) |
| `type` | Roadmap type icon |
| `status` | Status icon |
| `framework` | Financial framework |
| `period` | Planning period |
| `size` | T-shirt size |
| `moscow` | MoSCoW category |
| `rice` | RICE score |
| `financial` | Financial impact |
| `created` | Created timestamp |
| `actions` | Row actions |

Widths are enforced in `table-revamp-modern.css` via matching `colgroup` / header / cell classes.

#### FR-5.2 Table group-by (compact card list)

| ID | Requirement | Acceptance |
|----|-------------|------------|
| FR-5.2.1 | Group-by control | `#tableGroupBySelect` lists options from `TABLE_GROUP_BY_OPTIONS` |
| FR-5.2.2 | Persist preference | `state.tableGroupBy` saved in workspace payload |
| FR-5.2.3 | Summary | `#tableGroupBySummary` announces group name and roadmap count (live region) |
| FR-5.2.4 | Options | No grouping; Owner profile; Status; MoSCoW; T-shirt size; Financial framework; Roadmap type; Currency |

Owner profile grouping is available when privileged workspace mode is active (see FR-10).

#### FR-5.4 MoSCoW display names

- Stored values remain `moscowList` entries (e.g. `"Must have"`).
- UI headers, compact nav pills, and quadrant labels use `moscowDisplayNames` / `getMoscowDisplayName()`: **Must Have**, **Should Have**, **Could Have**, **Won't Have**.
- Quadrant header row: category badge + description on one horizontal line (desktop and compact).

### FR-6 Filters

Filters apply to **table, board, MoSCoW, map, RACI, and KANO** (portfolio-wide slice).

#### FR-6.1 Search row

| ID | Requirement | Acceptance |
|----|-------------|------------|
| FR-6.1.1 | Title search | Substring match on roadmap title |
| FR-6.1.2 | Title autocomplete | Suggestions from active scope titles; keyboard navigable listbox; max 12 matches |
| FR-6.1.3 | Label search | Substring match on any roadmap label |
| FR-6.1.4 | Label autocomplete | Suggestions from distinct labels in scope; same UX as title |

#### FR-6.2 Quick filters

Type, countries, roadmap period (`YYYY-Qn`).

#### FR-6.3 Advanced filters

Impact, effort, currency, framework, status, t-shirt, MoSCoW, financial range, **labels presence**, **links presence**, and (when FR-10 active) owner profile.

#### FR-6.4 Labels filter

| Value | Behavior |
|-------|----------|
| *(empty)* | **Any** — no label-count constraint |
| `with` | At least one label on the roadmap |
| `without` | Zero labels |

Works together with label search (both must pass).

#### FR-6.5 Links filter

| Value | Behavior |
|-------|----------|
| *(empty)* | **Any** |
| `with` | Roadmap has one or more links |
| `without` | No links |

#### FR-6.6 Active filter summary

Pill summarizes active filters including “With labels”, “Without labels”, “With links”, “Without links”.

### FR-7 Exchange rates

Manual refresh; rates cached in state; EUR conversion for table/map financial displays.

**Acceptance notes:**
- Profile view shows original-currency breakdown with EUR equivalents when rates exist.
- Missing rate: explicit “EUR conversion unavailable” — no fabricated numbers.

### FR-8 Export / import

| ID | Requirement | Acceptance |
|----|-------------|------------|
| FR-8.1 | Export JSON | Download file with exportable profiles only |
| FR-8.2 | Export CSV | One row per roadmap |
| FR-8.3 | Export password gate | Locked profiles omitted unless verified per profile |
| FR-8.4 | Import JSON | Merge profiles/roadmaps by id |
| FR-8.5 | Import CSV | Merge roadmap rows |
| FR-8.6 | UI parity | Import/export modals share design system |
| FR-8.7 | Concurrent cloud merge | `WorkspaceMerge.mergeWorkspacePayloads`; `workspaceTombstones`; pre-save merge in `storage.js` | Two editors: union profiles/roadmaps; deletes propagate; newer entity wins |

### FR-9 UX / accessibility

| ID | Requirement |
|----|-------------|
| FR-9.1 | Single visible tooltip app-wide |
| FR-9.2 | Modal field tooltips for all variables |
| FR-9.3 | Responsive layout: compact ≤1400px = phone UI; desktop >1400px |
| FR-9.4 | Password show/hide on all password fields |
| FR-9.5 | Delete confirmations |
| FR-9.6 | Site footer | Year, maintainer, LinkedIn, website, **GitHub repository**, **article** link; readable on all breakpoints |
| FR-9.7 | Board/MoSCoW cards | Consistent radius, border, shadow; action row on one line; structured tooltips on meta fields |
| FR-9.8 | Shareable deep links | URL hash `#pm/?roadmap=&view=&profile=` syncs with portfolio state via `ShareLink`; opens roadmap view modal when unlocked; legacy `?query` params supported on load |

### FR-10 Privileged workspace mode (cross-profile)

Cross-profile read/write behavior, eligibility, UI placement, and safety rules are defined in **[GUARDRAILS.md §7](GUARDRAILS.md)**. Product requirements at a glance:

| ID | Requirement | Acceptance |
|----|-------------|------------|
| FR-10.1 | Activation | Only when trust profile is active, unlocked, and mode toggle is on |
| FR-10.2 | Read scope | All roadmaps in workspace with owner metadata |
| FR-10.3 | Write scope | Changes persist to each roadmap’s owner profile |
| FR-10.4 | Table | Profile column + sort; owner advanced filter; group-by owner profile |
| FR-10.5 | Cards | Owner attribution on table compact cards, board cards, MoSCoW cards, map tooltips |
| FR-10.6 | Deactivation | Turning mode off restores single-profile scope immediately |
| FR-10.7 | Bulk duplicate / move | Table multi-select can duplicate or move roadmaps to a chosen target profile via modal |

Do not duplicate §7 policy detail here; update GUARDRAILS when behavior changes.

### FR-11 BYOK API keys (optional AI providers)

| ID | Requirement | Acceptance |
|----|-------------|------------|
| FR-11.1 | Store Groq + Tavily keys locally | Encrypted envelope in `localStorage` (`pm_byok_v1`); device-bound salt |
| FR-11.2 | Validate on save | User-initiated POST to `/api/byok/validate-groq` or `validate-tavily`; key normalized server-side |
| FR-11.3 | Never sync to cloud | BYOK payload excluded from workspace JSON and MongoDB |
| FR-11.4 | Header affordance | API keys button shows configured count; modal with 3-step workflow per provider |
| FR-11.5 | CSP | `connect-src` allows `https://api.groq.com` and `https://api.tavily.com` per `vercel.json` |

Policy detail: [GUARDRAILS.md §8](GUARDRAILS.md).

---

## 6. Non-functional requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-1 | Performance | Usable with hundreds of roadmaps per profile on modern browsers |
| NFR-2 | Security | Passwords hashed (PBKDF2); never plaintext in storage |
| NFR-3 | Privacy | No telemetry requirement; data in browser cache by default; optional cloud document on Vercel |
| NFR-4 | Deploy | Static hosting; CSP in `vercel.json` (includes Groq/Tavily for BYOK LLM features) |
| NFR-5 | Offline | Core features work without network except map tiles and FX |
| NFR-6 | Portability | Chrome, Firefox, Safari, Edge (current versions) |
| NFR-7 | Cache bust | Ship UI changes with bumped `APP_ASSET_VERSION` on all static assets |

---

## 7. Data retention

- **localStorage:** browser cache of workspace JSON, UI preferences, FX cache
- **MongoDB (optional):** canonical workspace document when `MONGODB_URI` configured
- **sessionStorage:** unlocked profile IDs for current tab session
- **BYOK storage:** encrypted API keys in `localStorage` only on this device; never in export/cloud
- **LLM summaries:** session-only in roadmap modal Summary section; not written to roadmap entity or MongoDB
- **5 Why output:** session-only in roadmap modal Five Why section (`roadmapFiveWhyGenerated`); not written to roadmap entity or MongoDB
- **User responsibility:** export backups; clearing site data deletes local cache and BYOK keys (cloud may retain workspace copy)

---

## 8. Out of scope / future considerations

- Team sync and shared workspaces (beyond GUARDRAILS §7 trust profile)
- Role-based access control
- Automated OKR dashboards (metrics in [METRICS_AND_OKRS.md](METRICS_AND_OKRS.md))
- Native mobile apps

---

## 9. References

- [PRODUCT_DOCUMENTATION.md](PRODUCT_DOCUMENTATION.md) — comprehensive product reference  
- [VARIABLES.md](VARIABLES.md) — formulas and field dictionary  
- [TRACEABILITY_MATRIX.md](TRACEABILITY_MATRIX.md) — requirement mapping  
- [GUARDRAILS.md](GUARDRAILS.md) — limitations and §7 cross-profile mode  
- [CHANGELOG.md](CHANGELOG.md) — release history  
