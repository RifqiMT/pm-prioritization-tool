# User Personas  
## Product Management Prioritization Tool

Personas represent primary users of the tool. They inform features, user stories, and documentation.

---

## Persona 1: Product Manager (Primary)

| Attribute | Description |
|-----------|-------------|
| **Name** | Alex (Product Manager) |
| **Role** | Product manager for a digital product; owns roadmap and backlog. |
| **Goals** | Prioritize initiatives consistently, communicate priorities to stakeholders, balance RICE scores with MoSCoW categories, track status and financial impact. |
| **Pain points** | Spreadsheets are messy; no single place for RICE + MoSCoW; hard to show “what’s must vs could” and “what’s in progress.” |
| **Needs** | One place to capture projects, score with RICE, categorize with MoSCoW, view by status (board) and by category (MOSCOW), optional financial impact in EUR, export for backup or sharing. |
| **Tech context** | Uses browser daily; prefers no sign-up or backend; may run app from folder or local server. |
| **Relevant features** | Profiles, RICE inputs and **?** breakdown, MOSCOW category and view, Board view, Table sort/filter, financial impact (EUR), export/import. |

---

## Persona 2: Team Lead / Squad Lead

| Attribute | Description |
|-----------|-------------|
| **Name** | Sam (Team Lead) |
| **Role** | Leads a squad or team; aligns work with product priorities. |
| **Goals** | See team backlog in one view, reorder by priority or status, share view with product manager, track which projects are Must vs Could have. |
| **Pain points** | Priorities live in slides or docs; status is in another tool; no quick way to see RICE and MoSCoW together. |
| **Needs** | Switch between Table (sort/filter) and Board (status columns); drag cards to update status or MOSCOW; optional reorder within column/quadrant when “Sort by RICE” is off; view-only mode to share with PM. |
| **Tech context** | Comfortable with web apps; may use same browser as PM or import/export to align data. |
| **Relevant features** | Board view (drag between columns, ↑/↓), MOSCOW view (drag between quadrants), View project/profile (read-only), filters, fullscreen for meetings. |

---

## Persona 3: Solo PM / Indie Maker

| Attribute | Description |
|-----------|-------------|
| **Name** | Jordan (Solo PM) |
| **Role** | Solo founder or indie product person; manages own roadmap. |
| **Goals** | Prioritize without heavy process; keep RICE and MoSCoW in one place; no accounts or servers. |
| **Pain points** | Overkill tools require sign-up or subscription; spreadsheets don’t show RICE formula or MoSCoW grid. |
| **Needs** | Simple flow: create profile → add projects → score with RICE → set MOSCOW → view in Table/Board/MOSCOW; export for backup; optional financial impact. |
| **Tech context** | May open index.html directly or use a static server; wants data to stay local. |
| **Relevant features** | Single profile, RICE + MOSCOW, all four views, export/import, no backend, tooltips for clarity. |

---

## Persona 4: PM with Geographic / Financial Focus

| Attribute | Description |
|-----------|-------------|
| **Name** | Casey (PM – Geo/Finance) |
| **Role** | Product or portfolio manager with projects in multiple countries and financial impact in multiple currencies. |
| **Goals** | See project count, RICE, or total financial impact (EUR) by country; convert all financials to EUR; present map in meetings. |
| **Pain points** | Currencies are mixed; manual conversion is error-prone; no map view. |
| **Needs** | Financial impact per project (amount + currency); automatic conversion to EUR via exchange rates; map view by projects / RICE / total financial (EUR); refresh rates on app open and at midnight Germany; fullscreen map. |
| **Tech context** | Uses browser; needs network for exchange rate APIs (or fallback when offline). |
| **Relevant features** | Financial impact fields, exchange rates (manual + on app open + 00:00), Map view (Show by: projects / RICE / financial EUR), country list and normalization, fullscreen. |

---

## Persona 5: Stakeholder / Reviewer (View-only)

| Attribute | Description |
|-----------|-------------|
| **Name** | Morgan (Stakeholder) |
| **Role** | Stakeholder or reviewer who needs to see priorities and status without editing. |
| **Goals** | Review roadmap, see RICE scores and MOSCOW categories, check profile statistics, no risk of accidental edits. |
| **Pain points** | Edit-heavy tools make it easy to change something by mistake. |
| **Needs** | View project and View profile (read-only modals); see Table/Board/MOSCOW/Map without edit/delete; optional fullscreen for presentations. |
| **Tech context** | Uses same app in browser; may receive exported file to import for read-only review. |
| **Relevant features** | View project, View profile (with statistics), all four views in read-only usage, fullscreen. |

---

## Summary matrix

| Persona        | Primary use                    | Key features                                      |
|----------------|--------------------------------|---------------------------------------------------|
| Product Manager| Prioritize, communicate        | RICE, MOSCOW, Board, Table, export/import         |
| Team Lead      | Status flow, reorder, share    | Board, MOSCOW, drag, View, fullscreen             |
| Solo PM        | Simple prioritization          | Profiles, RICE, MOSCOW, all views, export         |
| PM (Geo/Finance)| Country + EUR view            | Financial impact, exchange rates, Map, fullscreen |
| Stakeholder    | Review only                    | View project/profile, all views, fullscreen       |

For user stories derived from these personas, see [USER_STORIES.md](USER_STORIES.md). For full product documentation, see [README.md](../README.md).
