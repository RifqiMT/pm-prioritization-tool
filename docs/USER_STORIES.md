# User Stories

| Field | Value |
|-------|-------|
| **Product** | Product Management Prioritization Tool |
| **Version** | 2.0.0 |
| **Last updated** | 2026-05-31 |
| **Compact breakpoint** | ≤ **1400px** (`COMPACT_LAYOUT_MAX_WIDTH_PX`) |

**Purpose:** Epics and user-story contracts with **Given / When / Then** acceptance criteria, including edge cases and error handling.

---

## Story template

Each story includes:

- **Persona**, **Goal**, **Preconditions**
- **Acceptance criteria** (Given / When / Then)
- **Error / edge handling**

---

## Epic A — Portfolio setup

### US-A1 — Create profile-based portfolios

- **Persona:** Product Manager  
- **Goal:** Separate portfolio contexts by team/product.  
- **Preconditions:** User can access profile creation.

**Acceptance criteria**

1. **Create profile successfully**  
   - **Given** the user enters a valid profile name  
   - **When** the user creates the profile  
   - **Then** the profile appears in the list  
   - **And** the user can add projects to it.

2. **Optional team**  
   - **Given** team is left empty  
   - **When** the profile is created  
   - **Then** the profile saves without a team value  
   - **And** layout remains stable.

**Error / edge handling**

- **Given** an empty profile name  
- **When** the user submits  
- **Then** creation is blocked with validation feedback.

---

### US-A2 — Switch active profile quickly

- **Persona:** Product Manager  
- **Goal:** All views reflect the selected portfolio.  
- **Preconditions:** ≥1 profile exists.

**Acceptance criteria**

1. **Activate profile**  
   - **Given** the user selects a profile  
   - **When** it becomes active  
   - **Then** `activeProfileId` updates  
   - **And** table, board, MoSCoW, and map refresh.

2. **Locked profile**  
   - **Given** the profile is password-protected and locked  
   - **When** it is active  
   - **Then** the locked banner shows  
   - **And** project data does not render in any view.

**Error / edge handling**

- **Given** the active profile is deleted  
- **When** the UI re-renders  
- **Then** selection falls back to another profile or empty state.

---

## Epic B — Project prioritization

### US-B1 — Enter RICE fields and see computed score

- **Persona:** Product Manager  
- **Goal:** Rank work with RICE.  
- **Preconditions:** Active profile unlocked.

**Acceptance criteria**

1. **Compute score**  
   - **Given** valid Reach, Impact, Confidence, Effort  
   - **When** the user saves the project  
   - **Then** RICE = `(R × I × C) ÷ E`  
   - **And** the score appears in table and sortable views.

2. **Normalize confidence**  
   - **Given** Confidence &gt; 1 (percent style)  
   - **When** the score is computed  
   - **Then** confidence is normalized before calculation.

**Error / edge handling**

- **Given** invalid Reach or Effort  
- **When** the user saves  
- **Then** validation blocks save (no NaN/Infinity).

---

### US-B2 — Explain RICE using tooltips

- **Persona:** Product Manager  
- **Goal:** Make scoring transparent.

**Acceptance criteria**

1. **Tooltip content**  
   - **Given** the user opens the RICE tooltip  
   - **When** it displays  
   - **Then** it shows R/I/C/E expansions, formula, and calculation line when valid.

2. **Single tooltip**  
   - **Given** a tooltip is already open  
   - **When** another opens  
   - **Then** only one tooltip is visible.

---

## Epic C — Financial frameworks

### US-C1 — Select framework and see planning value

- **Persona:** Geo / Finance PM  
- **Goal:** Use the right value model per initiative.

**Acceptance criteria**

1. **Framework compute**  
   - **Given** the user selects a non-custom framework and valid inputs  
   - **When** the project saves  
   - **Then** `financialImpactValue` is computed per framework rules.

2. **Framework switch**  
   - **Given** the user changes framework in the modal  
   - **When** the change applies  
   - **Then** prior framework inputs do not leak into the new framework.

---

## Epic D — Multi-view planning

### US-D1 — Switch among table, board, MoSCoW, and map

- **Persona:** Delivery Lead  
- **Goal:** Use the right visualization for the meeting.

**Acceptance criteria**

1. **View toggle**  
   - **Given** an unlocked profile with projects  
   - **When** the user selects a view tab  
   - **Then** only that view is visible  
   - **And** filters continue to apply.

2. **Fullscreen**  
   - **Given** the user enables fullscreen on a view  
   - **When** fullscreen is active  
   - **Then** compact layout rules still apply at ≤1400px.

---

## Epic E — Data portability

### US-E1 — Export and import workspace data

- **Persona:** Product Manager  
- **Goal:** Backup and merge portfolios.

**Acceptance criteria**

1. **Export JSON**  
   - **Given** exportable profiles (unlocked or unprotected)  
   - **When** the user exports JSON  
   - **Then** a file downloads with profiles, projects, and preferences.

2. **Import merge**  
   - **Given** a valid JSON export  
   - **When** the user imports  
   - **Then** profiles/projects merge by id without wiping unrelated data.

**Error / edge handling**

- **Given** a locked protected profile not verified  
- **When** export runs  
- **Then** that profile is omitted and the user is informed.

---

## Epic F — UX standardization

### US-F1 — Exactly one tooltip visible at a time

(See US-B2 — same acceptance.)

### US-F2 — Standardized modal field tooltips

- **Persona:** Product Manager  
- **Goal:** Self-explanatory project form.

**Acceptance criteria**

- **Given** the project modal is open  
- **When** the user focuses supported fields  
- **Then** standardized tooltip guidance is available (native or injected fallback).

### US-F3 — Project footer metadata

- **Persona:** Product Manager  
- **Goal:** Audit ID, dates, RICE, and financial context.

**Acceptance criteria**

1. **Desktop footer**  
   - **Given** viewport &gt; 1400px  
   - **When** the project modal is open  
   - **Then** footer metadata (`Project details`) is expanded and shows ID, timestamps, RICE, financial/EUR context.

2. **Compact footer**  
   - **Given** viewport ≤ 1400px  
   - **When** the modal opens  
   - **Then** metadata is in a `<details>` block collapsed by default  
   - **And** the user can expand **Project details**.

---

## Epic G — Compact layout (≤1400px)

### US-G1 — Unified phone/tablet UI

- **Persona:** Mobile / field PM  
- **Goal:** Same touch-first layout on all non-desktop widths.  
- **Preconditions:** Viewport ≤ 1400px.

**Acceptance criteria**

1. **Layout classes**  
   - **Given** viewport is 768px, 1024px, or 1400px  
   - **When** the page loads or resizes  
   - **Then** `html` has `is-compact-layout` and `is-phone-layout`  
   - **And** desktop sidebar table layout is not used.

2. **No horizontal board/MoSCoW scroll**  
   - **Given** Board or MoSCoW on compact  
   - **When** the view renders  
   - **Then** content stacks vertically with vertical scroll only.

**Error / edge handling**

- **Given** resize across 1400px  
- **When** layout refreshes  
- **Then** classes and modal footer disclosure update without full reload.

---

### US-G2 — MoSCoW compact navigator

- **Persona:** Product Manager  
- **Goal:** Jump between quadrants on compact.  
- **Preconditions:** MoSCoW view; compact layout.

**Acceptance criteria**

1. **Nav pills with display names**  
   - **Given** four MoSCoW categories  
   - **When** compact nav renders  
   - **Then** pills show **Must Have**, **Should Have**, **Could Have**, **Won't Have** (via `getMoscowDisplayName`) with counts.

2. **Scroll sync**  
   - **Given** the user scrolls the quadrant list  
   - **When** a quadrant crosses the observer threshold  
   - **Then** the matching pill is active (`syncMoscowCompactNav`).

3. **Jump on tap**  
   - **Given** a nav pill  
   - **When** the user activates it  
   - **Then** the view scrolls to that quadrant.

---

### US-G3 — Table bulk actions on compact

- **Persona:** Delivery Lead  
- **Goal:** Bulk delete without desktop toolbar.

**Acceptance criteria**

1. **Selection bar**  
   - **Given** ≥1 project selected on compact table cards  
   - **When** selection changes  
   - **Then** the floating selection bar shows bulk delete.

2. **FAB**  
   - **Given** compact layout  
   - **When** the portfolio workspace is visible  
   - **Then** FAB creates a new project.

---

### US-G4 — Fullscreen preserves compact layouts

- **Persona:** Stakeholder  
- **Goal:** Present on projector or tablet.

**Acceptance criteria**

- **Given** fullscreen on board, MoSCoW, table, or map at ≤1400px  
- **When** fullscreen opens  
- **Then** compact CSS applies  
- **And** `refreshCompactFullscreenEnter()` runs for correct measurements.

---

## Epic H — Search and advanced filters

### US-H1 — Title autocomplete

- **Persona:** Product Manager  
- **Goal:** Find projects quickly by title.  
- **Preconditions:** Active scope has projects with titles.

**Acceptance criteria**

1. **Suggestions**  
   - **Given** the user types in **Title** search  
   - **When** matching titles exist  
   - **Then** up to 12 suggestions appear in a listbox  
   - **And** keyboard navigation highlights options.

2. **Apply filter**  
   - **Given** a title query (typed or selected)  
   - **When** filters run  
   - **Then** only projects whose title contains the query (case-insensitive) remain in table, board, MoSCoW, and map.

**Error / edge handling**

- **Given** no matches  
- **When** the dropdown opens  
- **Then** empty state “No matching titles” shows.

---

### US-H2 — Label autocomplete

- **Persona:** Product Manager  
- **Goal:** Slice portfolio by theme labels.

**Acceptance criteria**

1. **Suggestions**  
   - **Given** the user types in **Label** search  
   - **When** matching labels exist in scope  
   - **Then** suggestions list distinct labels (max 12).

2. **Apply filter**  
   - **Given** a label query  
   - **When** filters run  
   - **Then** projects with at least one label containing the query remain.

---

### US-H3 — Labels presence filter (any / with / without)

- **Persona:** Product Manager  
- **Goal:** Audit tagging hygiene.

**Acceptance criteria**

| Selection | **Given** projects A (no labels), B (has labels) | **When** filter applies | **Then** |
|-----------|--------------------------------------------------|-------------------------|----------|
| Any (empty) | — | filters run | A and B both eligible (subject to other filters) |
| With labels | — | `filterLabels` = with | Only B |
| Without labels | — | `filterLabels` = without | Only A |

- **Given** both label search text and labels presence filter  
- **When** filters run  
- **Then** both constraints apply (AND).

**Error / edge handling**

- **Given** labels filter active  
- **When** active filter pill renders  
- **Then** pill text reads “With labels” or “Without labels”.

---

### US-H4 — Links presence filter (any / with / without)

- **Persona:** Product Manager  
- **Goal:** Ensure initiatives have supporting links before review.

**Acceptance criteria**

| Selection | **When** filter applies | **Then** |
|-----------|-------------------------|----------|
| Any | — | No link-count constraint |
| With links | `filterLinks` = with | Projects with ≥1 link |
| Without links | `filterLinks` = without | Projects with zero links |

- **Given** links filter active  
- **When** filters apply to all views  
- **Then** board, MoSCoW, and map respect the same filtered set as table.

---

## Epic I — Table view (desktop grid + compact cards)

### US-I1 — Semantic desktop columns

- **Persona:** Product Manager  
- **Goal:** Scannable table without column misalignment.

**Acceptance criteria**

1. **Column classes**  
   - **Given** desktop table view  
   - **When** the table renders  
   - **Then** each column uses `projects-table-col--*` on `<col>`, `<th>`, and `<td>`  
   - **And** widths match `table-revamp-modern.css`.

2. **Optional owner column**  
   - **Given** privileged workspace mode per [GUARDRAILS.md §7](GUARDRAILS.md)  
   - **When** mode is active  
   - **Then** Profile/owner column is visible and sortable  
   - **Given** mode is inactive  
   - **Then** owner column is hidden without breaking other column widths.

---

### US-I2 — Compact table card list

- **Persona:** Mobile / field PM  
- **Goal:** Read and act on projects without horizontal scroll.  
- **Preconditions:** ≤1400px; table view.

**Acceptance criteria**

1. **Card layout**  
   - **Given** compact layout and table view  
   - **When** projects render  
   - **Then** each project is a card (not a 12-column grid row)  
   - **And** card shows status, MoSCoW, period, title, description excerpt, RICE, financial impact, size, framework, countries, and actions.

2. **Badge strip**  
   - **Given** a compact card  
   - **When** metadata badges render  
   - **Then** at most three pills show on one row with +N overflow tooltip when needed.

3. **Owner stripe**  
   - **Given** privileged workspace mode ([GUARDRAILS.md §7](GUARDRAILS.md))  
   - **When** a card belongs to another profile  
   - **Then** an owner attribution stripe appears on the card.

---

### US-I3 — Table group-by on compact cards

- **Persona:** Product Manager  
- **Goal:** Review projects in logical sections on tablet.

**Acceptance criteria**

1. **Control**  
   - **Given** compact table view  
   - **When** the user opens **Group by**  
   - **Then** options include: No grouping; Owner profile (§7 only); Status; MoSCoW; T-shirt size; Financial framework; Project type; Currency.

2. **Persist**  
   - **Given** the user selects a group-by option  
   - **When** the workspace saves  
   - **Then** `state.tableGroupBy` restores on reload.

3. **Summary**  
   - **Given** a group is rendered  
   - **When** the section header displays  
   - **Then** `#tableGroupBySummary` announces group label and project count.

**Error / edge handling**

- **Given** group-by value with zero projects  
- **When** rendering  
- **Then** empty group is omitted or shows zero-count without errors.

---

## Epic J — MoSCoW presentation

### US-J1 — Display names in quadrant headers

- **Persona:** Stakeholder  
- **Goal:** Read categories in workshop language.

**Acceptance criteria**

- **Given** MoSCoW view on desktop or compact  
- **When** quadrant headers render  
- **Then** labels read **Must Have**, **Should Have**, **Could Have**, **Won't Have**  
- **And** stored values remain `moscowList` entries for filters/export.

- **Given** a quadrant header  
- **When** it displays  
- **Then** category badge and description share one horizontal row.

---

### US-J2 — RICE sort within quadrants

- **Persona:** Product Manager  
- **Goal:** Order work inside a MoSCoW bucket.

**Acceptance criteria**

- **Given** RICE sort toggle enabled  
- **When** MoSCoW board renders  
- **Then** cards within each quadrant sort by RICE descending.

---

## Epic K — Site footer

### US-K1 — Maintainer attribution and external links

- **Persona:** All users  
- **Goal:** Credit maintainer and open resources.  
- **Preconditions:** Page loaded.

**Acceptance criteria**

1. **Content**  
   - **Given** any viewport  
   - **When** the user views the site footer  
   - **Then** it shows copyright year, maintainer name, LinkedIn, website, **GitHub repository**, and **article** links.

2. **Accessibility**  
   - **Given** footer icon buttons  
   - **When** inspected  
   - **Then** each has `aria-label` and opens in a new tab with `rel="noopener noreferrer"`.

3. **Compact layout**  
   - **Given** viewport ≤ 1400px  
   - **When** the footer renders  
   - **Then** links remain readable (contrast and touch targets per `app-footer.css`).

**Error / edge handling**

- **Given** external link unreachable  
- **When** the user follows the link  
- **Then** the browser handles the error (no app crash).

---

## Epic L — Board card UI

### US-L1 — Consistent card chrome across breakpoints

- **Persona:** Delivery Lead  
- **Goal:** Recognizable cards on desktop and compact.

**Acceptance criteria**

- **Given** board view  
- **When** cards render on desktop or ≤1400px  
- **Then** cards share radius, border, surface gradient, and shadow with MoSCoW/table compact cards.

---

### US-L2 — Single-row card actions

- **Persona:** Delivery Lead  
- **Goal:** Tap targets without wrapped action rows.

**Acceptance criteria**

- **Given** a board card  
- **When** actions render  
- **Then** View, Edit, Delete, and reorder controls stay on one horizontal row on desktop, tablet, and phone.

---

### US-L3 — Card field tooltips

- **Persona:** Product Manager  
- **Goal:** Understand status, MoSCoW, type, RICE, and financial fields on cards.

**Acceptance criteria**

- **Given** a board card with tooltip-enabled meta  
- **When** the user opens a tooltip  
- **Then** copy matches standardized field definitions  
- **And** only one tooltip is visible app-wide.

---

### US-L4 — Move status on compact board

- **Persona:** Mobile / field PM  
- **Goal:** Change status without drag-and-drop.

**Acceptance criteria**

- **Given** compact layout and board view  
- **When** the user uses **Move to** on a card  
- **Then** project status updates and the card moves to the correct column/stack.

---

## Epic M — Privileged workspace mode

Policy and eligibility: **[GUARDRAILS.md §7](GUARDRAILS.md)** only.

### US-M1 — Cross-profile read with owner context

- **Persona:** Trust profile operator  
- **Goal:** See all workspace projects with clear ownership.

**Acceptance criteria**

- **Given** mode active per §7  
- **When** portfolio views render  
- **Then** projects from all profiles appear with owner metadata  
- **And** owner chips/stripes show on table cards, board cards, MoSCoW cards, and map tooltips.

---

### US-M2 — Writes persist to owner profile

- **Persona:** Trust profile operator  
- **Goal:** Edit without re-homing projects.

**Acceptance criteria**

- **Given** mode active and user edits another profile’s project  
- **When** save completes  
- **Then** changes persist on that project’s owner profile  
- **And** user messaging states owner profile context.

---

### US-M3 — Deactivate restores single-profile scope

- **Persona:** Trust profile operator  
- **Goal:** Return to normal portfolio isolation.

**Acceptance criteria**

- **Given** mode was active  
- **When** the user turns mode off  
- **Then** views immediately show only the active profile’s projects  
- **And** owner-only filters and columns hide.

---

## Epic N — Rich-text descriptions

### US-N1 — Format project and RICE narratives

- **Persona:** Product Manager  
- **Goal:** Write readable descriptions without leaving the app.

**Acceptance criteria**

- **Given** the user creates or edits a project  
- **When** they use bold, lists, or alignment on description fields  
- **Then** formatting is saved as sanitized HTML  
- **And** view mode shows formatted text without the editing toolbar.

**Error / edge handling**

- **Given** view mode  
- **When** the modal opens  
- **Then** description fields are read-only and toolbar is hidden.

---

## Epic O — Project tasks

### US-O1 — Track tasks with status on a project

- **Persona:** Delivery Lead  
- **Goal:** Break work into trackable items under an initiative.

**Acceptance criteria**

- **Given** the user adds task rows in the project modal  
- **When** they save  
- **Then** `tasks[]` persists with name and status  
- **And** view mode shows read-only task rows with status badges.

---

## Epic P — Labels and links reliability (cloud)

### US-P1 — Labels and links survive production reload

- **Persona:** Product Manager using MongoDB sync  
- **Goal:** Trust that metadata is not lost after refresh.

**Acceptance criteria**

- **Given** cloud sync is active  
- **When** the user saves labels and links on a project  
- **Then** an immediate cloud flush runs  
- **And** after reload (or another device pull) labels and links are unchanged.

---

## Epic Q — Bulk transfer (privileged workspace mode)

### US-Q1 — Duplicate selected projects to another profile

- **Persona:** Trust profile operator  
- **Goal:** Clone initiatives into another portfolio.

**Acceptance criteria**

- **Given** workspace-wide mode and table multi-select  
- **When** the user chooses Duplicate and a target profile  
- **Then** copies are created with new IDs and “(copy)” title suffix  
- **And** originals remain in source profiles.

### US-Q2 — Move selected projects to another profile

- **Persona:** Trust profile operator  
- **Goal:** Re-home initiatives to the correct owner profile.

**Acceptance criteria**

- **Given** workspace-wide mode and table multi-select  
- **When** the user chooses Move and a target profile  
- **Then** projects are removed from source profiles and added to the target  
- **And** board/MoSCoW order arrays on sources are cleaned.

---

## Traceability

Map story IDs to [PRD.md](PRD.md) FR IDs and [TRACEABILITY_MATRIX.md](TRACEABILITY_MATRIX.md) during release review.
