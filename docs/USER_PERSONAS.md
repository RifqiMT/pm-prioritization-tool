# User Personas

Target users for the Product Management Prioritization Tool.

## How to use personas

- Validate features against real workflows before shipping.
- Design defaults (tooltips, confirmations, responsive layouts) for these users.
- If a change breaks a persona’s critical path, add mitigation or reconsider scope.

---

## 1) Product Manager (Primary)

- **Role:** Roadmap owner across teams/products  
- **Goals:** Explainable prioritization; consistent RICE; MoSCoW alignment; portable data  
- **Pain points:** Scores scattered in spreadsheets; inconsistent rubrics; low trust in “gut feel” confidence  
- **Key workflows:** Create profiles → add projects with RICE/MoSCoW → filter by period/country → export for planning sessions; review MoSCoW on phone via compact nav pills  
- **Success:** Stakeholders accept rankings because inputs and formulas are visible (RICE tooltips, financial framework breakdowns)

## 2) Delivery / Team Lead

- **Role:** Weekly execution and status tracking  
- **Goals:** Fast board/table views; clear status transitions  
- **Pain points:** Too many clicks to update status; hidden work in wrong columns  
- **Key workflows:** Board view with status columns (desktop) or single-column stack with **Move to** dropdown (compact); sort by RICE  
- **Success:** Stand-ups run from the board on laptop or tablet without exporting to another tool

## 3) Portfolio / Strategy Stakeholder

- **Role:** Reviews and challenges prioritization  
- **Goals:** Transparency; guardrails against misleading financial certainty  
- **Pain points:** “Black box” scores; no audit trail for value assumptions  
- **Key workflows:** Read-only project view; MoSCoW and map summaries; export snapshots  
- **Success:** Can question a ranking using visible inputs, not ad-hoc spreadsheets

## 4) Geo / Finance Focus PM

- **Role:** Country and EUR-normalized planning  
- **Goals:** Credible cross-currency comparison; geographic slicing  
- **Pain points:** Manual FX conversion; country data buried in rows  
- **Key workflows:** Map view (count / RICE / EUR); country filters; financial frameworks  
- **Success:** Map and table show EUR-comparable impact with daily-refreshed rates

---

## Persona-to-feature mapping

| Feature | Primary personas |
|---------|------------------|
| Profiles + password protection | PM Primary, Delivery Lead |
| RICE tooltips | PM Primary, Stakeholder |
| MoSCoW view | PM Primary, Stakeholder |
| Board + RICE sort | Delivery Lead |
| Map + FX normalization | Geo/Finance PM |
| Export / import | All |
| Compact layout (≤1024px) | PM Primary, Delivery Lead |
| Cloud sync (MongoDB) | PM Primary |

---

## 5) Mobile / field PM (secondary)

- **Role:** Reviews backlog between meetings on phone or tablet  
- **Goals:** Read rankings and move cards without horizontal scrolling  
- **Pain points:** Cramped grids; unreadable footers; bulk actions buried in menus  
- **Key workflows:** MoSCoW compact nav; board **Move to**; table selection bar + FAB  
- **Success:** Full planning views usable at 375px width without sideways scroll
