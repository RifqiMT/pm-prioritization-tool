# Design Guidelines

## 1. Design Principles

1. **Explainability first** — scoring and value signals must be understandable.
2. **Dense but readable** — table-first workflows require compact clarity.
3. **Consistent interaction semantics** — icon+tooltip behavior should be predictable.
4. **Accessible defaults** — focus visibility, contrast, keyboard behavior.

## 2. Color and Theme System

### Core palette (from current UI language)
- Primary red actions: `#b91c1c` → `#dc2626`
- Warm light surfaces: `#fffdf8`, `#fef2f2`, `#fffbeb`
- Emphasis gold: `#a16207`, `#d4af37`
- Neutral text: deep maroon/brown family currently used in app shell/table

### Framework icon colors (table Framework column)
- custom: slate-neutral
- clv: cyan
- nps: amber
- risk: rose
- headcount: violet
- operational: green

## 3. Component Rules

### Table Header
- Keep labels compact to avoid hard line wraps
- Prefer concise labels (`Framework` vs long-form)
- Sort indicators remain visible and aligned

### Icon Pill Cells (Type/State/Framework)
- Use shared structure: icon pill + tooltip
- Tooltip content includes title and short explanatory body
- Hover/focus behavior must match other tooltip-enabled cells

### RICE Score Cell
- Must support tooltip with:
  - abbreviation expansions (R/I/C/E)
  - formula line
  - computed calculation line

## 4. Tooltip Design Standard

- Structure:
  - `cell-type-tooltip-title`
  - `cell-type-tooltip-body` with concise paragraphs
- Positioning:
  - portal-aware behavior to prevent clipping
- Content:
  - no ambiguous abbreviations without expansion
  - formula or interpretation where relevant

## 5. Accessibility Guidelines

- Icon-only controls require `aria-label`
- Tooltip content must be understandable without color dependence
- Ensure keyboard focus and hover parity for tooltip triggers

## 6. Responsive Guidelines

- Preserve table usability at medium widths via concise column labels
- Avoid introducing columns that force unreadable header wrapping
- Prefer icon + tooltip over long textual categorical columns where possible
