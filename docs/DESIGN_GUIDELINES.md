# Design Guidelines

**Product:** Product Management Prioritization Tool  
**Last updated:** 2026-05-26

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

### 2.4 View toolbars (`view-toolbars-modern.css`)

| Token | Usage |
|-------|-------|
| `--vt-gold` | Section labels (e.g. “Show by”) |
| `--vt-text` | Toolbar titles |
| `--vt-accent` | Toggle track active |

---

## 3. Color semantics

### Project status (board pills / table)

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
| `moscow-compact.css` | MoSCoW nav pills, single-column quadrants (≤1024px) |
| `board-compact.css` | Board single-column stack, card move dropdown |
| `table-compact.css` | Table compact toolbar, selection bar, stacked actions |
| `fullscreen-compact.css` | Fullscreen body host + compact view parity |
| `app-footer.css` | Centered one-row site footer |

**Load order:** see [TECH_GUIDELINES.md](TECH_GUIDELINES.md).

### 4.1 Compact layout tokens (`compact-modern.css`)

| Token / pattern | Usage |
|-----------------|--------|
| Icon-only portfolio tabs | Labels hidden; icons remain tappable |
| `.portfolio-fab` | Floating action for new project on compact |
| `.portfolio-selection-bar` | Fixed bulk-delete bar when rows selected |
| Hidden `.view-toolbar__label` | Toolbar actions icon-only on compact |

---

## 5. Components

### 5.1 View toolbar

- Identity block: icon + title + description (description hidden on small screens).  
- Actions: right-aligned cluster; grid layout on mobile.  
- Board: scrollable status filter pills + RICE sort toggle.  
- Map: segmented metric pills (Count / RICE / EUR).

### 5.2 Profile card (v2)

- Avatar initials, name, team, project count.  
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

### 5.7 Tables

- Sticky gradient header, zebra rows, horizontal scroll hint on mobile.  
- Icon columns: Type, Status, Framework.

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
| **>1024px** | `is-desktop-layout` | Full desktop: horizontal board, 2×2 MoSCoW, table toolbar bulk delete |
| **≤1024px** | `is-compact-layout`, `is-phone-layout` | **Unified phone UI** on tablets and phones: vertical board/MoSCoW, MoSCoW nav pills, FAB, selection bar, icon-only tabs |
| ≤639px | (same compact classes) | Narrowest phones; footer link labels may hide (icons only) |

**Implementation:** `initCompactLayoutClass()` in `src/app.js` listens to `resize` and sets classes on `document.documentElement`.

**Do not** ship tablet-only hybrid layouts between 641px and 1024px — compact rules apply to the full ≤1024px range.

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
| Keep financial EUR labeled as estimate | Present map totals as audited finance |
| Test at 375px width | Rely on hover-only affordances on touch |

---

## 10. Related docs

- [VARIABLES.md](VARIABLES.md) — field labels and tooltips  
- [ARCHITECTURE.md](ARCHITECTURE.md) — module map  
