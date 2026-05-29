# User Personas

Target users for the Product Management Prioritization Tool.

| Field | Value |
|-------|-------|
| **Last updated** | 2026-05-28 |
| **Layout baseline** | Compact UI at viewport ≤ **1400px** |

## How to use personas

- Validate features against real workflows before shipping.
- Design defaults (tooltips, confirmations, responsive layouts) for these users.
- If a change breaks a persona’s critical path, add mitigation or reconsider scope.
- Cross-profile workspace behavior is governed by [GUARDRAILS.md §7](GUARDRAILS.md) — reference that section in reviews without duplicating policy here.

---

## 1) Product Manager (Primary)

| Dimension | Detail |
|-----------|--------|
| **Role** | Roadmap owner across teams or products |
| **Goals** | Explainable prioritization; consistent RICE; MoSCoW alignment; portable backups; fast filtering by period, country, labels, and links |
| **Pain points** | Scores scattered in spreadsheets; inconsistent rubrics; low trust in “gut feel” confidence; hard to find projects missing labels or documentation links |
| **Key workflows** | Create profiles → add projects with RICE/MoSCoW/labels → use title/label autocomplete in filters → group compact table cards by MoSCoW or status → export JSON before planning milestones → present MoSCoW with **Must Have** / **Should Have** naming in workshops |
| **Device usage** | **Desktop** (>1400px) for deep table editing and multi-column sorts; **iPad / phone** (≤1400px) for between-meeting reviews via compact card table and MoSCoW nav pills |
| **Success** | Stakeholders accept rankings because inputs, formulas, and filters are visible and reproducible |

---

## 2) Delivery / Team Lead

| Dimension | Detail |
|-----------|--------|
| **Role** | Weekly execution and status tracking |
| **Goals** | Fast board/table views; clear status transitions; bulk cleanup of cancelled work |
| **Pain points** | Too many clicks to update status; hidden work in wrong columns; bulk delete buried on small screens |
| **Key workflows** | **Board** with status columns (desktop) or vertical stack + **Move to** (compact); RICE sort within columns; **Table** bulk select (toolbar desktop, selection bar compact); filter by status and t-shirt in advanced drawer |
| **Device usage** | Laptop in stand-ups (>1400px); tablet on the floor (≤1400px) with touch-friendly board cards and one-row action buttons |
| **Success** | Stand-ups run from the board without exporting to another tool |

---

## 3) Portfolio / Strategy Stakeholder

| Dimension | Detail |
|-----------|--------|
| **Role** | Reviews and challenges prioritization (often read-only) |
| **Goals** | Transparency; guardrails against misleading financial certainty; credible MoSCoW narrative |
| **Pain points** | “Black box” scores; no audit trail for value assumptions; jargon-heavy quadrant labels |
| **Key workflows** | Read-only project view; MoSCoW quadrants with full category names; map and table summaries; export snapshots; footer article link for product context |
| **Device usage** | Large monitor in review meetings; occasional phone check of ranked list via compact cards |
| **Success** | Can question a ranking using visible inputs and **Must Have** vs **Could Have** intent, not ad-hoc spreadsheets |

---

## 4) Geo / Finance Focus PM

| Dimension | Detail |
|-----------|--------|
| **Role** | Country and EUR-normalized planning |
| **Goals** | Credible cross-currency comparison; geographic slicing; framework-appropriate value models |
| **Pain points** | Manual FX conversion; country data buried in rows; mixed currencies in one sort order |
| **Key workflows** | Map view (count / RICE / EUR); country quick filters; financial framework advanced filter; table group-by **Currency** on compact; exchange-rate refresh before exec readout |
| **Device usage** | Desktop for map + wide table; compact when presenting map fullscreen on tablet |
| **Success** | Map and table show EUR-comparable impact with daily-refreshed rates and explicit unavailable-FX messaging |

---

## 5) Mobile / field PM (secondary)

| Dimension | Detail |
|-----------|--------|
| **Role** | Reviews backlog between meetings on phone or tablet |
| **Goals** | Read rankings and move cards without horizontal scrolling; discover maintainer resources from footer |
| **Pain points** | Cramped grids; unreadable modal footers; desktop-only bulk actions |
| **Key workflows** | MoSCoW compact **Jump to quadrant** pills; board **Move to**; table card list with FAB + selection bar; collapsible **Project details** in modal footer |
| **Device usage** | Primarily ≤1400px (phone and tablet, including iPad landscape) |
| **Success** | Full planning views usable at 375px width without sideways scroll on board or MoSCoW |

---

## Persona-to-feature mapping

| Feature | Primary personas |
|---------|------------------|
| Profiles + password protection | PM Primary, Delivery Lead |
| RICE tooltips | PM Primary, Stakeholder |
| MoSCoW view + display names (Must Have, etc.) | PM Primary, Stakeholder |
| Title/label autocomplete + labels/links filters | PM Primary |
| Board + unified card UI | Delivery Lead, Mobile PM |
| Table semantic columns + compact cards + group-by | PM Primary, Delivery Lead, Geo/Finance PM |
| Map + FX normalization | Geo/Finance PM |
| Export / import | All |
| Compact layout (≤1400px) | PM Primary, Delivery Lead, Mobile PM |
| Site footer (GitHub, article) | Stakeholder, Mobile PM |
| Cloud sync (MongoDB) | PM Primary |
| Privileged workspace mode ([GUARDRAILS.md §7](GUARDRAILS.md)) | PM Primary (trust profile only) |

---

## Anti-personas (out of scope)

- **Engineering manager** needing sprint capacity, assignments, or dependency graphs → use Jira/Linear.
- **Finance controller** needing audited GL postings → use ERP; this tool is planning-grade only.
- **Casual visitor** expecting sign-up and multi-tenant SaaS → local-first profiles only.
