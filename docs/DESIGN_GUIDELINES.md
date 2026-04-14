# Design Guidelines

## Design Principles

1. **Clarity first** — Prioritization decisions must be easy to read and compare.
2. **Action hierarchy** — Primary actions (create/switch/save) should be visually obvious.
3. **Low cognitive load** — Keep card/table density balanced for planning sessions.
4. **Consistent semantics** — Red/gold/white palette should map consistently across controls and data states.
5. **Accessible defaults** — Ensure contrast, focus visibility, and keyboard navigation remain strong.

---

## 1) Theme and Color System

### 1.1 Indonesian-Inspired Core Palette

| Token | Usage | Hex |
|---|---|---|
| Primary Red Dark | Primary CTA gradient start, active emphasis | `#b91c1c` |
| Primary Red | CTA gradient end, active controls | `#dc2626` |
| Primary Red Soft | Error/destructive light surfaces | `#fef2f2` |
| Gold Dark | Labels, secondary emphasis text | `#a16207` |
| Gold Mid | Accent lines, metric emphasis | `#b45309` |
| Gold Surface | Subtle accent backgrounds | `#fef3c7` |
| Surface White | Main background and cards | `#ffffff` |
| Surface Warm White | Secondary panel background | `#fffdf8` |
| Border Gold | Dividers and panel edges | `#e7c978` |
| Text Primary | Main text on light surfaces | `#3f0f19` |
| Text Secondary | Supporting metadata text | `#7a4b12` |

### 1.2 Semantic State Colors

| Semantic | Color Guidance |
|---|---|
| Primary action | Red gradient (`#b91c1c -> #dc2626`) |
| Secondary neutral action | Warm white + gold border |
| Destructive action | Light red surface + red text |
| Informational chip | Warm white + gold text |
| Focus ring | Red tint with white halo |

---

## 2) Typography

- Font family: `Inter, system-ui, sans-serif`.
- Heading style:
  - Use stronger weight and tighter spacing for panel titles.
  - Avoid overuse of all-caps for long labels.
- Body style:
  - Maintain readable line-height (1.4–1.55).
  - Use primary vs secondary text contrast for hierarchy.
- Data columns:
  - Use tabular-style numeric consistency where possible for RICE and financial values.

---

## 3) Layout Guidelines

### 3.1 Global Layout

- Keep shell and cards on white-first surfaces.
- Maintain stable spacing rhythm:
  - section gaps: 12–24px
  - control gaps: 6–12px
- Avoid large dead margins in desktop; content should use viewport effectively.

### 3.2 Responsive Behavior

- Desktop:
  - left profile panel + right project workspace split.
- Tablet:
  - stack panels where width constraints degrade readability.
- Mobile:
  - single-column interactions, full-width controls, wrapped action groups.

---

## 4) Component Guidelines

### 4.1 Buttons

- Primary:
  - red gradient, white text.
- Secondary:
  - warm white background with gold border.
- Destructive secondary:
  - soft red background with clear red text.
- Minimum touch target: 38–44px height.

### 4.2 View Toggles

- Use segmented control behavior:
  - clear active state
  - muted inactive states
  - no mixed visual language in same toggle row.

### 4.3 Table Header and Rows

- Keep header and body synchronized with fixed column model.
- Avoid truncation for critical labels where possible.
- Keep sort indicators subtle but discoverable.
- Differentiate row actions (`View`, `Edit`, `Delete`) by intent.

### 4.4 Profile List Cards

- Card top: profile identity (name/team).
- Action area: compact and consistent.
- Active card should be clear but not heavy.

### 4.5 Tooltips and Modals

- Tooltip:
  - title + body structure
  - avoid clipping through portal positioning
- Modal:
  - white surface
  - clear title/subtitle
  - structured action row

---

## 5) Accessibility and Usability Rules

- Visible focus state on all interactive controls.
- Keep color contrast suitable for light backgrounds.
- Provide hover + focus parity where possible.
- Keep icon-only buttons with meaningful `aria-label`.
- Prefer clear wording over abbreviations where ambiguity exists.

---

## 6) Content and Labeling Rules

- Use concise labels in dense tables (`Type`, `State`, `Period`, `Impact (EUR)`).
- Keep action labels explicit (`View`, `Edit`, `Delete`).
- Use consistent capitalization and terminology across all views.

---

## 7) Do/Don’t Summary

### Do
- Keep the UI white-first with red/gold accents.
- Maintain one visual language for buttons and toggles.
- Use consistent spacing and component radius.

### Don’t
- Mix legacy dark-theme fragments with light theme.
- Apply multiple competing overrides for the same selector without consolidation.
- Use decorative effects that interfere with table alignment or readability.

