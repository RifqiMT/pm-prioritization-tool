# User Stories  
## Product Management Prioritization Tool

Stories are grouped by epic. Format: **As a** [persona], **I want** [action] **so that** [benefit].  
Personas: Product Manager, Team Lead, Solo PM, PM (Geo/Finance), Stakeholder. See [USER_PERSONAS.md](USER_PERSONAS.md).

---

## Epic 1: Profiles

| ID | Story | Persona |
|----|--------|---------|
| US-P1 | As a **Product Manager**, I want to create multiple profiles (e.g. per team or product) so that I can separate portfolios. | Product Manager |
| US-P2 | As a **Product Manager**, I want to switch the active profile with one click so that table, board, MOSCOW, and map show that profile’s projects. | Product Manager |
| US-P3 | As a **Product Manager**, I want to view a profile (name, team, statistics) in read-only mode so that I can share or review without editing. | Product Manager / Stakeholder |
| US-P4 | As a **Product Manager**, I want to edit a profile’s name and team so that I can keep context up to date. | Product Manager |
| US-P5 | As a **Product Manager**, I want to delete a profile with confirmation so that I can remove a portfolio and its projects when no longer needed. | Product Manager |

---

## Epic 2: Projects (CRUD)

| ID | Story | Persona |
|----|--------|---------|
| US-J1 | As a **Product Manager**, I want to add a project with required RICE fields and optional metadata so that I can capture and score initiatives in one place. | Product Manager |
| US-J2 | As a **Product Manager**, I want the MOSCOW category to default to “Could have” for new projects so that I can adjust later without a wrong default. | Product Manager |
| US-J3 | As a **Product Manager**, I want to edit any project field so that I can update scores, status, or metadata. | Product Manager |
| US-J4 | As a **Product Manager**, I want to view a project in read-only mode so that I can share or review without risk of edits. | Product Manager / Stakeholder |
| US-J5 | As a **Product Manager**, I want to delete a project with confirmation so that I can remove obsolete items. | Product Manager |
| US-J6 | As a **Product Manager**, I want to bulk-delete selected projects from the table so that I can clean up many items at once. | Product Manager |

---

## Epic 3: RICE and prioritization

| ID | Story | Persona |
|----|--------|---------|
| US-R1 | As a **Product Manager**, I want to enter Reach, Impact (1–5), Confidence (0–100), and Effort (1–5) so that the app computes a RICE score. | Product Manager |
| US-R2 | As a **Product Manager**, I want to see the exact RICE calculation (e.g. via **?**) so that prioritization is transparent. | Product Manager |
| US-R3 | As a **Team Lead**, I want to sort the table by RICE score so that I can focus on highest-priority items. | Team Lead |
| US-R4 | As a **Product Manager**, I want to set MOSCOW category (Must/Should/Could/Won't) per project so that I can communicate requirement priority. | Product Manager |

---

## Epic 4: Table view

| ID | Story | Persona |
|----|--------|---------|
| US-T1 | As a **Product Manager**, I want to see all projects in a sortable table with columns for RICE, MOSCOW, status, financial impact (EUR), etc. so that I can review and sort. | Product Manager |
| US-T2 | As a **Product Manager**, I want to sort by any column (ascending/descending) so that I can order by RICE, date, or other fields. | Product Manager |
| US-T3 | As a **Product Manager**, I want to filter by title, type, countries, period, status, T-shirt size, MOSCOW so that I can narrow the list. | Product Manager |
| US-T4 | As a **Product Manager**, I want to filter by “Not set” for type or T-shirt size so that I can find projects missing those fields. | Product Manager |
| US-T5 | As a **Product Manager**, I want tooltips for RICE breakdown, financial (original amount/currency), and other fields so that I get context without leaving the table. | Product Manager |

---

## Epic 5: Board view

| ID | Story | Persona |
|----|--------|---------|
| US-B1 | As a **Team Lead**, I want to see projects in columns by status (Not Started, In Progress, On Hold, Done, Cancelled) so that I can track flow. | Team Lead |
| US-B2 | As a **Team Lead**, I want to drag a card to another column so that I can update status without opening the project. | Team Lead |
| US-B3 | As a **Team Lead**, I want to toggle “Sort by RICE” off and use ↑/↓ to reorder within a column so that I can set manual order. | Team Lead |
| US-B4 | As a **Team Lead**, I want the manual order to be saved per profile and status so that it persists. | Team Lead |
| US-B5 | As a **Product Manager**, I want to use fullscreen on the board so that I can present in meetings. | Product Manager / Team Lead |

---

## Epic 6: MOSCOW view

| ID | Story | Persona |
|----|--------|---------|
| US-M1 | As a **Product Manager**, I want to see a 2×2 grid (Must / Should / Could / Won't) so that I can review MoSCoW at a glance. | Product Manager |
| US-M2 | As a **Product Manager**, I want to drag a card to another quadrant so that I can change MOSCOW category. | Product Manager |
| US-M3 | As a **Product Manager**, I want to reorder cards within a quadrant when “Sort by RICE” is off so that I can set manual order. | Product Manager |
| US-M4 | As a **Team Lead**, I want to use fullscreen on the MOSCOW view so that I can present the grid. | Team Lead |

---

## Epic 7: Map view

| ID | Story | Persona |
|----|--------|---------|
| US-Map1 | As a **PM (Geo/Finance)**, I want to see a world map colored by project count, RICE score, or total financial impact (EUR) per country so that I can see geographic or financial spread. | PM (Geo/Finance) |
| US-Map2 | As a **PM (Geo/Finance)**, I want to switch “Show by” (projects / RICE / financial EUR) so that I can change the metric. | PM (Geo/Finance) |
| US-Map3 | As a **PM (Geo/Finance)**, I want tooltips on the map with flag, name, code, and value so that I can read exact numbers. | PM (Geo/Finance) |
| US-Map4 | As a **Product Manager**, I want fullscreen on the map so that I can present in meetings. | Product Manager |

---

## Epic 8: Financial impact and exchange rates

| ID | Story | Persona |
|----|--------|---------|
| US-F1 | As a **PM (Geo/Finance)**, I want to enter financial impact (amount + currency) per project so that I can track value in one currency (EUR) in table and map. | PM (Geo/Finance) |
| US-F2 | As a **PM (Geo/Finance)**, I want exchange rates to refresh when I open the app (if stale) and at 00:00 Germany time so that EUR conversion is up to date. | PM (Geo/Finance) |
| US-F3 | As a **PM (Geo/Finance)**, I want to manually refresh exchange rates so that I can update immediately when needed. | PM (Geo/Finance) |
| US-F4 | As a **Product Manager**, I want to see “Last updated” (date + manual/auto) for rates so that I know how fresh the data is. | Product Manager |

---

## Epic 9: Export and import

| ID | Story | Persona |
|----|--------|---------|
| US-X1 | As a **Product Manager**, I want to export all data as JSON or CSV so that I can back up or move data. | Product Manager |
| US-X2 | As a **Product Manager**, I want to import JSON or CSV and merge by profile and project ID so that I can combine data without duplicates. | Product Manager |
| US-X3 | As a **Solo PM**, I want country names to be normalized on import so that I get consistent labels (e.g. Taiwan). | Solo PM |

---

## Epic 10: Fullscreen and view switch

| ID | Story | Persona |
|----|--------|---------|
| US-FS1 | As a **Product Manager**, I want to put Table, Board, MOSCOW, or Map in fullscreen so that I can focus or present. | Product Manager |
| US-FS2 | As a **Team Lead**, I want to switch to another view (Table/Board/MOSCOW/Map) while in fullscreen so that I don’t have to exit and re-enter. | Team Lead |

---

## Epic 11: Confirmations and accessibility

| ID | Story | Persona |
|----|--------|---------|
| US-C1 | As a **Product Manager**, I want a toast after create/update/delete/export/import so that I get clear confirmation. | Product Manager |
| US-C2 | As a **Stakeholder**, I want to use View project and View profile so that I can review without editing. | Stakeholder |
| US-C3 | As any user, I want semantic HTML and keyboard support so that I can use the app accessibly. | All |

---

## Reference

- **Personas:** [USER_PERSONAS.md](USER_PERSONAS.md)  
- **PRD:** [PRD.md](PRD.md)  
- **Full documentation:** [README.md](../README.md)  
- **Product documentation standard:** [PRODUCT_DOCUMENTATION_STANDARD.md](../PRODUCT_DOCUMENTATION_STANDARD.md)
