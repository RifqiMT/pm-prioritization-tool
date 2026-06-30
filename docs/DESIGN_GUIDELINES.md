# Design Guidelines

**Product:** Product Management Prioritization Tool  
**Last updated:** 2026-06-29  
**Implementation baseline:** `APP_ASSET_VERSION` = `20260629-ui195`  
**Layout breakpoint:** `COMPACT_LAYOUT_MAX_WIDTH_PX` = **1400** (`html.is-compact-layout` + `html.is-phone-layout`)

Visual and interaction standards for the local-first prioritization workspace.

---

## 1. Design principles

1. **Explainability first** — scores and values must be understandable in context (tooltips, labels, callouts).  
2. **Dense but readable** — table-first workflows; compact type without broken headers.  
3. **Consistent interaction** — icon pills, toggles, and modals behave the same across views.  
4. **Responsive by default** — phone, tablet, and desktop layouts are first-class.  
5. **Warm professional tone** — cream surfaces, maroon text, red accent for primary actions.

---

## 2. Theme tokens

### 2.1 App shell (`main.css` :root — dark chrome)

| Token | Value | Usage |
|-------|-------|-------|
| `--accent` | `#e11d48` / `#b91c1c` | Legacy accents |
| `--gold` | `#d4af37` | Borders, highlights |
| `--text` | `#f8f8f8` | Shell text on dark bg |

### 2.2 Modern workspace (`workspace-modern.css`, portfolio, profiles)

| Token | Value | Usage |
|-------|-------|-------|
| `--ws-surface` / `--pf-bg` | `#fffdf8`, `#ffffff` | Cards, panels |
| `--ws-gold` / `--pf-gold` | `#a16207` | Eyebrows, labels |
| `--ws-text` / `--pf-text` | `#3f0f19` | Headings |
| `--ws-text-soft` | `#7a4b12` | Secondary copy |
| `--ws-border` | `rgba(231, 201, 120, 0.65)` | Panel borders |

### 2.3 Data transfer modals (`export-modals-modern.css`)

| Token | Value | Usage |
|-------|-------|-------|
| `--dt-accent` | `#b91c1c` | Primary buttons, export mark |
| `--dt-gold` | `#a16207` | CSV icon accent |
| `--dt-bg-soft` | `#fffdf8` | Callouts, cards |
| `--dt-radius` | `18px` | Modal corners (desktop) |

### 2.4 Five Why section (roadmap modal, `main.css`)

| Element | Class / token | Notes |
|---------|---------------|-------|
| Section host | `.roadmap-fivewhy-section` | View-only optional section; hidden in create/edit |
| Panel | `.roadmap-fivewhy-panel` | Intro copy + action row |
| Generate | `.roadmap-fivewhy-generate-btn` | Label cycles Ask WHY 1 → 5; `.is-loading` during pipeline |
| Reset | `.roadmap-fivewhy-reset-btn` | Visible when chain has ≥1 entry |
| Status | `.roadmap-fivewhy-status` | Progress/errors; `.roadmap-fivewhy-status--error` for failures |
| Output list | `.roadmap-fivewhy-output` | Ordered list; `.roadmap-fivewhy-output--loading` while generating |
| Item | `.roadmap-fivewhy-item` | Level label + lens chip + question text |

Typography and spacing follow roadmap modal optional-section patterns (`--roadmap-optional-*` tokens in `main.css`).

### 2.5 BYOK modal (`byok-api-keys.css`)

| Token | Value | Usage |
|-------|-------|-------|
| `--byok-text` | `#3f0f19` | Headings |
| `--byok-text-soft` | `#7a4b12` | Secondary copy |
| `--byok-accent` | `#b91c1c` | Primary actions |
| `--byok-green` | `#047857` | Valid/saved status |
| `--byok-blue` | `#1d4ed8` | Provider accents |
| `--byok-border` | `rgba(202, 138, 4, 0.35)` | Panel border |

Panel uses cream gradient (`#fffdf8` → `#fffaf0`), 20px radius, max **1120×92vh** — aligned with profile view and roadmap modals.

### 2.6 Rich description content (`rich-description-content.css`)

Typography for sanitized HTML in roadmap descriptions, tooltips, and LLM summary paragraphs: heading scale, list spacing, link color, and empty-state muted text.

### 2.7 View toolbars (`view-toolbars-modern.css`)

| Token | Usage |
|-------|-------|
| `--vt-gold` | Section labels (e.g. “Show by”) |
| `--vt-text` | Toolbar titles |
| `--vt-accent` | Toggle track active |

### 2.8 Compact layout and mobile command deck (≤1400px)

| Stylesheet | Role |
|------------|------|
| `filters-sheet-modern.css` | Bottom sheet for portfolio filters; backdrop, drag handle, badge count |
| `mobile-command-deck.css` | Sticky compact toolbar: filters trigger, view switcher, profile affordances |
| `profile-picker-compact.css` | Condensed profile dropdown in command deck |
| `view-tabs-compact-menu.css` | Overflow view tabs into “More” menu |
| `compact-view-gutter.css` | Reduced horizontal padding on table/board in compact mode |
| `confirm-modals-modern.css` | Destructive-action confirms aligned with export/import modal chrome |

Breakpoints align with `COMPACT_LAYOUT_MAX_WIDTH` (1400px) in `constants.js`.

---

## 3. Color semantics

### Roadmap status (board pills / table)

| Status | Color family |
|--------|----------------|
| Not Started | Slate gray |
| In Progress | Blue |
| On Hold | Amber |
| Done | Green |
| Cancelled | Red |

Defined in `main.css` `.cell-type-pill[data-status=...]` and `view-toolbars-modern.css` for filter buttons.

### Financial framework icons (table)

| Framework | Hue |
|-----------|-----|
| custom | Slate |
| clv | Cyan |
| nps | Amber |
| risk | Rose |
| headcount | Violet |
| operational | Green |

### KANO category colors (`portfolio-kano-modern.css`)

| Category | Visual role |
|----------|-------------|
| Attractive (Delighter) | Warm accent — unexpected value |
| One-dimensional (Performance) | Blue family — scales with delivery |
| Must-be (Basic) | Neutral slate — table stakes |
| Indifferent | Muted gray — low sensitivity |
| Reverse | Rose warning — over-delivery risk |

Category badges use `categoryCode` (A/O/M/I/R) on compact cards; desktop matrix cells use matching border and fill tokens.

### RACI matrix (`super-admin-modern.css`, `view-toolbars-modern.css`)

| Element | Pattern |
|---------|---------|
| Domain toggle | Pill track with sliding indicator (`Business` / `Tech`) |
| Matrix columns | Fixed five-column grid on desktop; horizontal scroll wrapper |
| Compact cards | One roadmap card with four role sections stacked |
| Name tooltips | Hover on truncated names in matrix cells |

---

## 4. CSS file responsibilities

| File | Scope |
|------|-------|
| `main.css` | Base reset, global buttons, legacy modals, status/framework pills |
| `workspace-modern.css` | Workspace panel, table, board columns |
| `header-modern.css` | App header, actions menu |
| `profiles-modern.css` | Profile list v2 |
| `portfolio-modern.css` | Command bar, filters, FAB, locked banner |
| `profile-modals-modern.css` | Edit/unlock/delete profile modals |
| `export-modals-modern.css` | Export, import, export-unlock |
| `view-toolbars-modern.css` | Table/board/MoSCoW/map toolbars |
| `compact-modern.css` | Compact chrome: icon tabs, short title, FAB, hidden toolbar labels |
| `moscow-compact.css` | MoSCoW nav pills, single-column quadrants (≤1400px); header title line |
| `board-compact.css` | Board single-column stack, card move dropdown |
| `table-compact.css` | Table compact toolbar, selection bar, stacked actions |
| `table-rows-modern.css` | Modern row alignment, spacing, and typography for table rows |
| `table-revamp-modern.css` | Modern table shell/layout rules (overlap prevention, action cell constraints) |
| `fullscreen-modern.css` | Fullscreen host layout (desktop + compact parity) |
| `fullscreen-compact.css` | Fullscreen body host + compact view parity |
| `views-density.css` | Density scaling helpers (compact/desktop readability tuning) |
| `layout-flow.css` | Shared flow/layout helpers across surfaces |
| `portfolio-cards-compact.css` | Compact + desktop card stacks (12px radius, shared shadow) |
| `table-compact-cards.css` | Compact table **card list** (replaces wide grid ≤1400px) |
| `roadmap-actions-modern.css` | Row/card action rails; desktop board actions `nowrap` |
| `super-admin-modern.css` | Owner stripe, profile column, workspace-wide chrome — see GUARDRAILS §7 |
| `app-footer.css` | Centered one-row site footer (LinkedIn, website, GitHub, article) |
| `map-tooltip-modern.css` | Map view country hover cards (Leaflet HTML tooltips) |
| `rich-text-editor.css` | Rich-text toolbar, format buttons, compact RICE fields |
| `rich-description-content.css` | Sanitized HTML in RTE surfaces |
| `board-drag.css` | Board drag ghost and drop targets |
| `board-card-interaction.css` | Card press/hover feedback |
| `filters-compact-bar.css` | Compact filters drawer summary bar |
| `view-toolbars-compact-row.css` | Single-row compact toolbar layout |
| `portfolio-kano-modern.css` | KANO portfolio matrix, category legend, positioned/unpositioned cards |
| `byok-api-keys.css` | BYOK API keys modal (Groq/Tavily) |
| `rich-description-content.css` | Rendered rich-text / summary paragraph typography |

**Load order:** see [TECH_GUIDELINES.md](TECH_GUIDELINES.md) — **33** stylesheets total.

### 4.1 Compact layout tokens (`compact-modern.css`)

| Token / pattern | Usage |
|-----------------|--------|
| Icon-only portfolio tabs | Labels hidden; icons remain tappable |
| `.portfolio-fab` | Floating action for new roadmap on compact |
| `.portfolio-selection-bar` | Fixed bulk-delete bar when rows selected |
| Hidden `.view-toolbar__label` | Toolbar actions icon-only on compact |

---

## 5. Components

### 5.1 View toolbar

- Identity block: icon + title + description (description hidden on small screens).  
- Actions: right-aligned cluster; grid layout on mobile.  
- Board: scrollable status columns + RICE sort toggle (all columns always visible).  
- Map: segmented metric pills (Count / RICE / EUR).

### 5.2 Profile card (v2)

- Avatar initials, name, team, roadmap count.  
- Active indicator + Locked/Active chip.  
- Icon rail: view / edit / delete.

### 5.3 Data transfer format cards

- JSON and CSV as equal-width cards (stack on narrow screens).  
- Icon badge + label + one-line description.  
- Import adds **merge callout** above cards.

### 5.4 Export unlock cards

- Per-profile card: avatar, name, password field, eye toggle.  
- Footer: ghost “Skip protected” + primary “Verify & export”.

### 5.4.1 Import/export modal parity
- **Shared structure:** profile-style header + scrollable body + bottom action footer.
- **Shared format cards:** JSON/CSV are rendered as consistent data-transfer option cards across both import and export.
- **Directional affordances:** export uses red accent (download tone), import uses teal/green accent (upload tone).
- **Mobile behavior:** format cards stack into a single column and footer actions become tap-friendly stacked buttons.

### 5.5 Password toggle

- Neutral 34px icon button inside field (not global red button).  
- `aria-label` toggles Show/Hide password.

### 5.6 Tooltips

- One visible tooltip globally.  
- Structure: title + body (`cell-type-tooltip-*`).  
- RICE tooltip: R/I/C/E meanings + formula + calculation.

### 5.7 Rich-text editor

- Toolbar: grouped bold / italic / underline / alignment / lists; SVG icons; **not** global red `button` styles (`rich-text-editor.css` resets).
- **Compact** variant for RICE description fields (shorter toolbar).
- **View mode:** `#roadmapModal.roadmap-modal--view` hides toolbar; content read-only.
- Stored HTML sanitized on save (`description-format.js`).

### 5.8 Labels, links, and tasks (roadmap modal)

- **Labels:** chip display in view mode; multi-row inputs in edit.
- **Links:** column headers “Display text” / “URL”; card layout in view with title + URL preview.
- **Tasks:** name input + status dropdown per row; read-only badges in view.

### 5.9 Tables

- **Desktop (>1400px):** sticky gradient header, semantic `<col>` classes, zebra rows.  
- **Compact (≤1400px):** card list (`table-compact-cards.css`); FAB; floating selection bar; optional **Group by** bar.  
- Icon columns: Type, Status, Framework.  
- Actions: compact **icon-only** action rail; desktop actions stay inside the Actions cell without overlap.

### 5.10 Portfolio cards (board, MoSCoW, compact table)

- **Radius:** `--pcard-radius: 12px` on desktop and compact.  
- **Surface:** warm white gradient, subtle border, soft shadow (`portfolio-cards-compact.css`).  
- **Actions:** View / Edit / Delete + reorder on **one horizontal row** on desktop.  
- **Owner attribution:** top **card-strip** when privileged workspace mode is active (GUARDRAILS §7).

### 5.11 MoSCoW quadrants

- **Display names:** **Must Have**, **Should Have**, **Could Have**, **Won't Have**.  
- **Header row:** category badge + quadrant description on one line.  
- **Compact nav:** 2×2 pill bar uses `getMoscowDisplayName()` for full names.

### 5.10 Profile command bar (compact)

- Profile picker and privileged workspace toggle share **one row** (`compact-modern.css`, `portfolio-modern.css`).

### 5.11 Site footer

- Single centered row: copyright, maintainer, icon links (LinkedIn, website, GitHub, article).

### 5.12 Modal dismiss (no × buttons)

**Do not** place header **×** (close icon) buttons in any modal dialog.

| Use instead | Examples |
|-------------|----------|
| **Footer primary/secondary actions** | Done, Save, Cancel, Verify & export |
| **Esc key** | Registered via `OverlayManager` / blocking modal stack |
| **Backdrop click** | Where safe (non-destructive flows); roadmap modal uses guarded dismiss |
| **Footer hint copy** | e.g. “Press Esc to close” on BYOK and data-transfer modals |

**Rationale:** × controls are easy to miss on touch, duplicate footer actions, and clash with the warm modal header pattern (mark + title + subtitle only).

**Enforcement:** `profile-modals-modern.css` hides `.profile-modal-close`, `.modal-close-btn`, `.data-transfer-modal__close`, and `.byok-modal__close` inside `.modal-backdrop`. New modals must follow footer + Esc — never reintroduce header dismiss icons.

---

## 6. Typography

- **Font:** Inter (Google Fonts), system-ui fallback.  
- **Eyebrows:** 0.68rem, uppercase, gold, letter-spaced.  
- **Modal titles:** ~1.05rem, sentence case, bold (not all-caps).  
- **Avoid** legacy all-caps button labels in modern surfaces.

---

## 7. Responsive breakpoints (reference)

| Breakpoint | HTML classes | Behavior |
|------------|--------------|----------|
| **>1400px** | `is-desktop-layout` | Full desktop: data table grid, horizontal board, 2×2 MoSCoW, toolbar bulk delete |
| **≤1400px** | `is-compact-layout`, `is-phone-layout` | **Unified phone UI** on tablets and phones: table **card list**, vertical board/MoSCoW, MoSCoW nav pills, FAB, selection bar, icon-only portfolio tabs |
| ≤639px | (same compact classes) | Narrowest phones; footer link labels may hide (icons only) |

**Implementation:** `initCompactLayoutClass()` in `src/app.js` compares `window.innerWidth` to `COMPACT_LAYOUT_MAX_WIDTH_PX` (1400) on load and `resize`.

**Do not** ship a separate “tablet-only” layout between 641px and 1400px — compact CSS applies to the entire ≤1400px range.

---

## 8. Accessibility

- Focus rings on toggles and format cards (`:focus-visible`).  
- `aria-pressed` on board status filters and map metric pills.  
- `role="radiogroup"` / `aria-checked` where applicable.  
- Screen-reader labels on icon-only controls.

---

## 9. Do / don’t

| Do | Don’t |
|----|-------|
| Use modern CSS layers for new UI | Add unscoped rules to `main.css` without override plan |
| Match export/import modal patterns | Mix legacy `btn-secondary` bars with new cards |
| Close modals via footer actions + Esc | Add header × / close-icon buttons in modals |
| Keep financial EUR labeled as estimate | Present map totals as audited finance |
| Test at 375px width | Rely on hover-only affordances on touch |

---

## 10. Related docs

- [VARIABLES.md](VARIABLES.md) — field labels and tooltips  
- [ARCHITECTURE.md](ARCHITECTURE.md) — module map  
