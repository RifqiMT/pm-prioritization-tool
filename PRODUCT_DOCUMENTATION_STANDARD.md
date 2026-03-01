# Product Documentation Standard

This document defines the **product documentation standard** for the Product Management Prioritization Tool. The full content for each section lives in [README.md](README.md) or in the linked docs. Use this as a checklist and index.

---

## Documentation index

| Document | Purpose |
|----------|---------|
| [README.md](README.md) | Main product documentation: overview, benefits, features, logics, business/tech guidelines, tech stack, folder directory, screens, limitations. |
| [docs/PRD.md](docs/PRD.md) | Product Requirements Document: goals, user needs, functional/non-functional requirements, data model summary, success criteria, out of scope. |
| [docs/USER_PERSONAS.md](docs/USER_PERSONAS.md) | User personas: Product Manager, Team Lead, Solo PM, PM (Geo/Finance), Stakeholder; goals, pain points, needs. |
| [docs/USER_STORIES.md](docs/USER_STORIES.md) | User stories by epic (profiles, projects, RICE, table, board, MOSCOW, map, financial/rates, export/import, fullscreen, confirmations). |

---

## 1. Overview

**Location:** [README §1 – Product overview](README.md#1-product-overview)

| Element | Description |
|--------|--------------|
| **Purpose** | What the product does: capture, score, rank, track projects with RICE and MoSCoW; four views (Table, Board, MOSCOW, Map); financial impact in EUR; exchange rates ETL; local-first, no backend. |
| **Target users** | Product managers, teams, anyone wanting a simple local prioritization tool. |
| **Key concepts** | Profile, RICE, MoSCoW, Board order, MOSCOW view, Map view, Exchange rates ETL, Merge (import), Tooltips. |
| **High-level flow** | Create profile → Add projects → View/prioritize (Table/Board/MOSCOW/Map) → Exchange rates → Change status/MOSCOW → Fullscreen → Export/import. |

---

## 2. Product benefits

**Location:** [README §4 – Product benefits](README.md#4-product-benefits)

Value proposition and user benefits: single source of truth, dual frameworks (RICE + MoSCoW), portfolio-ready, transparent prioritization, financial impact in EUR, exchange rates ETL, flexible workflow, MOSCOW 2×2 grid, fullscreen on all views, geographic/financial map, consistent country data, “Not set” filters, data ownership, low friction, accessibility, profile insights, clear confirmations (toasts).

---

## 3. Features

**Location:** [README §5 – Features](README.md#5-features)

| Area | Contents |
|------|----------|
| **Profiles / owners** | Create, switch, view, edit, delete profile. |
| **Projects** | Add, edit, view, delete (single and bulk). |
| **RICE inputs** | Reach, Impact, Confidence, Effort; score formula and **?** breakdown. |
| **Optional project fields** | MOSCOW category, financial impact, project type, status, T-shirt size, period, target countries. |
| **Exchange rates** | Rates section, manual refresh, automatic refresh (00:00 Germany + on app open when stale), ETL (Frankfurter + MoneyConvert + fallback), display. |
| **Filters** | Basic and advanced; reset; active count; apply to all views. |
| **Sort (table)** | Sortable columns; default Created desc. |
| **Table view** | Columns, checkboxes, tooltips, Financial impact (EUR). |
| **Board view** | Status columns, cards (View/Edit/Delete, ↑/↓), Sort by RICE, drag-and-drop, full screen. |
| **MOSCOW view** | 2×2 grid, Sort by RICE, cards, drag between quadrants, full screen. |
| **Map view** | Show by (projects / RICE / financial EUR), choropleth, full screen. |
| **Export and import** | JSON/CSV; merge rules; toasts. |
| **Confirmations (toasts)** | Location, usage. |
| **Fullscreen and view switch** | Enter, switch view while fullscreen, exit. |
| **Tooltips** | Cell-type tooltips, positioning (body/fullscreen root), visibility, accessibility. |

---

## 4. Logics (and data model)

**Location:** [README §6 – Logics and data model](README.md#6-logics-and-data-model)

| Element | Description |
|--------|--------------|
| **RICE formula** | Score = (R × I × C) ÷ E; confidence 0–100; effort > 0; computed on demand. |
| **Validation** | Required/optional fields; MOSCOW default Could have; period YYYY-Qn. |
| **Storage** | Key `rice_prioritizer_v1`; root payload (profiles, activeProfileId, sort, view, board/MOSCOW toggles, mapMetric, exchange rates state). |
| **Exchange rates logic** | Timezone Europe/Berlin; sources (Frankfurter, MoneyConvert, fallback); ETL (extract, transform, merge, load); when to refresh (manual, on app open, 00:00); conversion to EUR. |
| **Financial display** | Short format (K, Mn, Bn, Tn); table column and tooltip; map metric. |
| **Profile schema** | id, name, team, createdAt, projects, boardOrder, moscowOrder. |
| **Project schema** | All fields (RICE, financial, moscowCategory, type, status, tshirtSize, period, countries, dates). |
| **Board order** | boardOrder[status]; when Sort by RICE is off. |
| **MOSCOW category and order** | moscowCategory; moscowOrder[quadrant] when Sort by RICE is off. |
| **Import merge rules** | Profiles by id/name; projects by id; merge result counts. |
| **Country normalization** | Canonical list, aliases, normalize on load and import. |

---

## 5. Business guidelines

**Location:** [README §7 – Business guidelines](README.md#7-business-guidelines)

Recommended usage: create profile first; consistent RICE definitions; use MOSCOW for prioritisation; financial impact and exchange rates; View for read-only; export regularly; import merges; filters and sort; board for status; fullscreen for focus; profile view for portfolio health; map for geographic/financial spread.

---

## 6. Tech guidelines

**Location:** [README §8 – Tech stack and technical guidelines](README.md#8-tech-stack-and-technical-guidelines)

| Element | Description |
|--------|--------------|
| **Tech stack** | HTML5, CSS3, Vanilla JS (classic scripts), Leaflet, Frankfurter + MoneyConvert + fallback, Google Fonts (Inter), localStorage, dark theme, prefers-reduced-motion. |
| **Script load order and boot** | Leaflet → constants → utils → rice → exchange-rates → fullscreen → app; DOMContentLoaded → init; main.js optional. |
| **Technical guidelines** | No DOM in constants/utils/rice; single storage key; generateId; escapeHtml/escapeCsvCell; accessibility; country consistency; MOSCOW defaults; exchange rates (Germany timezone, ETL). |
| **Global dependencies** | Listed from constants.js, rice.js, utils.js. |

---

## 7. Tech stacks (summary)

**Location:** [README §8.1 – Tech stack](README.md#81-tech-stack)

Markup, styles, scripting, map (Leaflet + GeoJSON), exchange rates (APIs + fallback), fonts, persistence, backend (none), theme/UX.

---

## 8. Other important elements

| Element | Location |
|--------|----------|
| **Prerequisites and requirements** | README §2 – Browser, network, backend, build. |
| **Getting started** | README §3 – Run app (file or server), first-time use. |
| **Folder directory and file roles** | README §9 – Directory tree, file roles (index.html, main.css, constants, utils, rice, modules, app, main.js), **docs/** (PRD, USER_PERSONAS, USER_STORIES). |
| **Screens and key UI** | README §10 – Header, profiles, projects header, filters, Table/Board/MOSCOW/Map, modals, toast. |
| **Limitations and considerations** | README §11 – Single browser, no auth, storage quota, exchange rates, CORS/file://, no versioning. |
| **Tooltip behavior** | README §1.3 Key concepts (Tooltips), §5.15 Tooltips. |
| **Card layout** | README §5.9 Board, §5.10 MOSCOW – View/Edit/Delete left, ↑/↓ right corner. |
| **Exchange rates on app open** | README §5.5, §6.4 – ensure() on init when rates missing or date not today (Germany). |
| **PRD (requirements)** | [docs/PRD.md](docs/PRD.md) – Functional/non-functional requirements, success criteria, out of scope. |
| **User personas** | [docs/USER_PERSONAS.md](docs/USER_PERSONAS.md) – Personas with goals, pain points, needs. |
| **User stories** | [docs/USER_STORIES.md](docs/USER_STORIES.md) – Stories by epic with persona and benefit. |

---

## Quick reference: README table of contents

1. Product overview  
2. Prerequisites and requirements  
3. Getting started  
4. Product benefits  
5. Features  
6. Logics and data model  
7. Business guidelines  
8. Tech stack and technical guidelines  
9. Folder directory and file roles (includes **docs/**: PRD, USER_PERSONAS, USER_STORIES)  
10. Screens and key UI  
11. Limitations and considerations  
12. License  

**Related docs:** [README.md](README.md) · [PRD.md](docs/PRD.md) · [USER_PERSONAS.md](docs/USER_PERSONAS.md) · [USER_STORIES.md](docs/USER_STORIES.md)
