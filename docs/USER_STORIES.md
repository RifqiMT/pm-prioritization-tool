# User Stories

| Field | Value |
|-------|-------|
| **Product** | Product Management Prioritization Tool |
| **Version** | 2.0.0 |
| **Last updated** | 2026-07-09 |
| **Compact breakpoint** | ≤ **1400px** (`COMPACT_LAYOUT_MAX_WIDTH_PX`) |

**Purpose:** Epics and user-story contracts with **Given / When / Then** acceptance criteria, including edge cases and error handling.

> Cross-feature logic: [FEATURE_LOGIC_AND_CONSTRAINTS.md](FEATURE_LOGIC_AND_CONSTRAINTS.md) · **22 epics**, **43+ stories**

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
   - **And** the user can add roadmaps to it.

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
   - **And** table, board, MoSCoW, map, RACI, and KANO views refresh.

2. **Locked profile**  
   - **Given** the profile is password-protected and locked  
   - **When** it is active  
   - **Then** the locked banner shows  
   - **And** roadmap data does not render in any view.

**Error / edge handling**

- **Given** the active profile is deleted  
- **When** the UI re-renders  
- **Then** selection falls back to another profile or empty state.

---

## Epic B — Roadmap prioritization

### US-B1 — Enter RICE fields and see computed score

- **Persona:** Product Manager  
- **Goal:** Rank work with RICE.  
- **Preconditions:** Active profile unlocked.

**Acceptance criteria**

1. **Compute score**  
   - **Given** valid Reach, Impact, Confidence, Effort  
   - **When** the user saves the roadmap  
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

### US-B3 — Track multi-quarter delivery periods

- **Persona:** Delivery Lead  
- **Goal:** Represent when an initiative spans multiple planning quarters with per-quarter status.

**Acceptance criteria**

1. **Add periods**  
   - **Given** the user edits a roadmap  
   - **When** they add one or more `YYYY-Q[1-4]` entries with status in the Periods section  
   - **Then** `roadmapPeriods[]` persists on save  
   - **And** the chronologically latest period drives derived `roadmapStatus`.

2. **Filter match**  
   - **Given** a portfolio filter includes a quarter  
   - **When** any period on a roadmap matches  
   - **Then** the roadmap appears in filtered views.

3. **Legacy migration**  
   - **Given** a roadmap has only legacy `roadmapPeriod`  
   - **When** it loads  
   - **Then** it normalizes into `roadmapPeriods` without data loss.

---

### US-B4 — Reuse labels, RACI names, and links from existing roadmaps

- **Persona:** Product Manager  
- **Goal:** Enter metadata consistently without retyping values used elsewhere in the portfolio.

**Acceptance criteria**

1. **Label suggestions**  
   - **Given** the user opens the roadmap edit modal  
   - **When** they focus a label input (`list="roadmapLabelSuggestions"`)  
   - **Then** up to **40** distinct labels from the portfolio appear as browser datalist options.

2. **RACI name suggestions**  
   - **Given** the user edits RACI assignments  
   - **When** they type a name (`list="roadmapRaciNameSuggestions"`)  
   - **Then** previously used RACI names from the portfolio are suggested.

3. **Link suggestions**  
   - **Given** the user adds roadmap links  
   - **When** they type label or URL fields  
   - **Then** `#roadmapLinkLabelSuggestions` and `#roadmapLinkUrlSuggestions` offer prior values.

4. **Privileged workspace scope**  
   - **Given** privileged workspace mode is active  
   - **When** suggestions refresh  
   - **Then** values are collected from all profiles, not only the active one.

**Error / edge handling**

- **Given** no prior values exist for a field  
- **When** the datalist renders  
- **Then** the user can still type any free-text value (suggestions are optional).

---

## Epic C — Financial frameworks

### US-C1 — Select framework and see planning value

- **Persona:** Geo / Finance PM  
- **Goal:** Use the right value model per initiative.

**Acceptance criteria**

1. **Framework compute**  
   - **Given** the user selects a non-custom framework and valid inputs  
   - **When** the roadmap saves  
   - **Then** `financialImpactValue` is computed per framework rules.

2. **Framework switch**  
   - **Given** the user changes framework in the modal  
   - **When** the change applies  
   - **Then** prior framework inputs do not leak into the new framework.

---

## Epic D — Multi-view planning

### US-D1 — Switch among seven portfolio views

- **Persona:** Delivery Lead  
- **Goal:** Use the right visualization for the meeting (Table, Board, MoSCoW, Map, RACI, KANO, Gantt).

**Acceptance criteria**

1. **View toggle**  
   - **Given** an unlocked profile with roadmaps  
   - **When** the user selects a view tab (Table, Board, MoSCoW, Map, RACI, KANO, or Gantt)  
   - **Then** only that view is visible  
   - **And** filters continue to apply across all seven views.

2. **Fullscreen**  
   - **Given** the user enables fullscreen on a view  
   - **When** fullscreen is active  
   - **Then** compact layout rules still apply at ≤1400px.

---

### US-D2 — Use compact filters sheet on tablet/phone

- **Persona:** Product Manager (mobile)  
- **Goal:** Apply portfolio filters without horizontal clutter at ≤1400px.

**Acceptance criteria**

1. **Open sheet**  
   - **Given** viewport width ≤1400px  
   - **When** the user taps Filters in the mobile command deck  
   - **Then** the portfolio filters bottom sheet opens with active filter count on the trigger.

2. **Close sheet**  
   - **Given** the filters sheet is open  
   - **When** the user taps backdrop, close control, or presses Esc  
   - **Then** the sheet dismisses and filter state persists.

---

### US-D3 — Plan delivery on the Gantt timeline

- **Persona:** Delivery Lead  
- **Goal:** See when initiatives run across quarters and when they are due.

**Acceptance criteria**

1. **Period bars**  
   - **Given** roadmaps with `roadmapPeriods[]` entries  
   - **When** the user opens the Gantt view  
   - **Then** each roadmap row shows colored bar segments aligned to quarter date ranges  
   - **And** segment color reflects per-period status.

2. **Deadline marker**  
   - **Given** a roadmap with `roadmapDeadline` set to `YYYY-MM-DD`  
   - **When** Gantt renders  
   - **Then** a deadline marker appears on the timeline for that date.

3. **Zoom and today**  
   - **Given** the Gantt toolbar  
   - **When** the user selects Monthly / Standard / Wide or taps Jump to today  
   - **Then** `ganttZoom` updates and the viewport scrolls to the current week when requested.

---

## Epic E — Data portability

### US-E1 — Export and import workspace data

- **Persona:** Product Manager  
- **Goal:** Backup and merge portfolios.

**Acceptance criteria**

1. **Export JSON**  
   - **Given** exportable profiles (unlocked or unprotected)  
   - **When** the user exports JSON  
   - **Then** a file downloads via `ExportPayload.buildJsonExportDocument` including all `WORKSPACE_PERSISTED_STATE_KEYS`, profiles, and roadmaps.

2. **Export CSV**  
   - **Given** exportable roadmaps  
   - **When** the user exports CSV  
   - **Then** rows use `ExportPayload.CSV_COLUMN_IDS` including `roadmapPeriods`, `roadmapRaci`, and `*ExtraData` columns for round-trip.

3. **Import merge**  
   - **Given** a valid JSON export  
   - **When** the user imports  
   - **Then** profiles/roadmaps merge by id without wiping unrelated data.

**Error / edge handling**

- **Given** a locked protected profile not verified  
- **When** export runs  
- **Then** that profile is omitted and the user is informed.

### US-E2 — Concurrent cloud workspace merge

- **Persona:** Product Manager (shared MongoDB workspace)  
- **Goal:** Edit the same cloud workspace from multiple browsers without resurrecting deleted items or losing parallel work.

**Acceptance criteria**

1. **Union merge on save**  
   - **Given** MongoDB is configured and two sessions have different profiles or roadmaps  
   - **When** either session saves  
   - **Then** `WorkspaceMerge.mergeWorkspacePayloads` unions entities by id and keeps the copy with the newer `modifiedAt`.

2. **Tombstone propagation**  
   - **Given** session A deletes a roadmap  
   - **When** session B saves or pulls  
   - **Then** `workspaceTombstones` prevents the deleted roadmap from reappearing unless recreated with a newer `modifiedAt`.

3. **Pre-save remote fetch**  
   - **Given** local edits are pending cloud sync  
   - **When** `preparePayloadForRemoteSave` runs  
   - **Then** local payload is deduped, remote state is fetched and merged before `PUT /api/state`.

4. **Content-fingerprint dedupe**  
   - **Given** two roadmaps with the same title, period, countries, MoSCoW, type, and t-shirt size but different ids  
   - **When** merge or pre-save dedupe runs  
   - **Then** one roadmap survives (lowest id anchor; newest field data); duplicates are tombstoned.

5. **Revision conflict recovery**  
   - **Given** session A and B save simultaneously with stale `expectedRevision`  
   - **When** the server returns HTTP 409 with conflict payload  
   - **Then** the client merges conflict payload and retries without user data loss.

**Error / edge handling**

- **Given** two sessions edit the **same** roadmap simultaneously  
- **When** both save within seconds  
- **Then** the version with the later `modifiedAt` wins (no row-level locking).

---

## Epic F — UX standardization

### US-F1 — Exactly one tooltip visible at a time

(See US-B2 — same acceptance.)

### US-F2 — Standardized modal field tooltips

- **Persona:** Product Manager  
- **Goal:** Self-explanatory roadmap form.

**Acceptance criteria**

- **Given** the roadmap modal is open  
- **When** the user focuses supported fields  
- **Then** standardized tooltip guidance is available (native or injected fallback).

### US-F3 — Roadmap footer metadata

- **Persona:** Product Manager  
- **Goal:** Audit ID, dates, RICE, and financial context.

**Acceptance criteria**

1. **Desktop footer**  
   - **Given** viewport &gt; 1400px  
   - **When** the roadmap modal is open  
   - **Then** footer metadata (`Roadmap details`) is expanded and shows ID, timestamps, RICE, financial/EUR context.

2. **Compact footer**  
   - **Given** viewport ≤ 1400px  
   - **When** the modal opens  
   - **Then** metadata is in a `<details>` block collapsed by default  
   - **And** the user can expand **Roadmap details**.

---

### US-F4 — Share portfolio context via URL

- **Persona:** Product Manager  
- **Goal:** Send a colleague a link that opens the same profile, view, and roadmap.

**Acceptance criteria**

1. **URL sync**  
   - **Given** the user changes active profile, view tab, or opens a roadmap in the modal  
   - **When** navigation completes  
   - **Then** the browser URL updates to `#pm/?roadmap=&view=&profile=` when applicable.

2. **Incoming link**  
   - **Given** a valid share URL and matching workspace data  
   - **When** the page loads  
   - **Then** the app activates the profile and view  
   - **And** opens the roadmap in view mode when the profile is unlocked.

3. **Locked profile**  
   - **Given** the link targets a password-protected locked profile  
   - **When** the page loads  
   - **Then** the unlock flow runs before opening the roadmap.

4. **Missing roadmap**  
   - **Given** the roadmap id is not in the workspace  
   - **When** the link loads  
   - **Then** the user sees a toast explaining import/sync is required.

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
   - **Given** ≥1 roadmap selected on compact table cards  
   - **When** selection changes  
   - **Then** the floating selection bar shows bulk delete.

2. **FAB**  
   - **Given** compact layout  
   - **When** the portfolio workspace is visible  
   - **Then** FAB creates a new roadmap.

---

### US-G4 — Fullscreen preserves compact layouts

- **Persona:** Stakeholder  
- **Goal:** Present on roadmapor or tablet.

**Acceptance criteria**

- **Given** fullscreen on board, MoSCoW, table, or map at ≤1400px  
- **When** fullscreen opens  
- **Then** compact CSS applies  
- **And** `refreshCompactFullscreenEnter()` runs for correct measurements.

---

## Epic H — Search and advanced filters

### US-H1 — Title autocomplete

- **Persona:** Product Manager  
- **Goal:** Find roadmaps quickly by title.  
- **Preconditions:** Active scope has roadmaps with titles.

**Acceptance criteria**

1. **Suggestions**  
   - **Given** the user types in **Title** search  
   - **When** matching titles exist  
   - **Then** up to 12 suggestions appear in a listbox  
   - **And** keyboard navigation highlights options.

2. **Apply filter**  
   - **Given** a title query (typed or selected)  
   - **When** filters run  
   - **Then** only roadmaps whose title contains the query (case-insensitive) remain in table, board, MoSCoW, and map.

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
   - **Then** roadmaps with at least one label containing the query remain.

---

### US-H3 — Labels presence filter (any / with / without)

- **Persona:** Product Manager  
- **Goal:** Audit tagging hygiene.

**Acceptance criteria**

| Selection | **Given** roadmaps A (no labels), B (has labels) | **When** filter applies | **Then** |
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
| With links | `filterLinks` = with | Roadmaps with ≥1 link |
| Without links | `filterLinks` = without | Roadmaps with zero links |

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
   - **Then** each column uses `roadmaps-table-col--*` on `<col>`, `<th>`, and `<td>`  
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
- **Goal:** Read and act on roadmaps without horizontal scroll.  
- **Preconditions:** ≤1400px; table view.

**Acceptance criteria**

1. **Card layout**  
   - **Given** compact layout and table view  
   - **When** roadmaps render  
   - **Then** each roadmap is a card (not a 12-column grid row)  
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
- **Goal:** Review roadmaps in logical sections on tablet.

**Acceptance criteria**

1. **Control**  
   - **Given** compact table view  
   - **When** the user opens **Group by**  
   - **Then** options include: No grouping; Owner profile (§7 only); Status; MoSCoW; T-shirt size; Financial framework; Roadmap type; Currency.

2. **Persist**  
   - **Given** the user selects a group-by option  
   - **When** the workspace saves  
   - **Then** `state.tableGroupBy` restores on reload.

3. **Summary**  
   - **Given** a group is rendered  
   - **When** the section header displays  
   - **Then** `#tableGroupBySummary` announces group label and roadmap count.

**Error / edge handling**

- **Given** group-by value with zero roadmaps  
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
- **Then** roadmap status updates and the card moves to the correct column/stack.

---

## Epic M — Privileged workspace mode

Policy and eligibility: **[GUARDRAILS.md §7](GUARDRAILS.md)** only.

### US-M1 — Cross-profile read with owner context

- **Persona:** Trust profile operator  
- **Goal:** See all workspace roadmaps with clear ownership.

**Acceptance criteria**

- **Given** mode active per §7  
- **When** portfolio views render  
- **Then** roadmaps from all profiles appear with owner metadata  
- **And** owner chips/stripes show on table cards, board cards, MoSCoW cards, and map tooltips.

---

### US-M2 — Writes persist to owner profile

- **Persona:** Trust profile operator  
- **Goal:** Edit without re-homing roadmaps.

**Acceptance criteria**

- **Given** mode active and user edits another profile’s roadmap  
- **When** save completes  
- **Then** changes persist on that roadmap’s owner profile  
- **And** user messaging states owner profile context.

---

### US-M3 — Deactivate restores single-profile scope

- **Persona:** Trust profile operator  
- **Goal:** Return to normal portfolio isolation.

**Acceptance criteria**

- **Given** mode was active  
- **When** the user turns mode off  
- **Then** views immediately show only the active profile’s roadmaps  
- **And** owner-only filters and columns hide.

---

## Epic N — Rich-text descriptions

### US-N1 — Format roadmap, Note, and RICE narratives

- **Persona:** Product Manager  
- **Goal:** Write readable descriptions across six rich-text surfaces without leaving the app.

**Acceptance criteria**

- **Given** the user creates or edits a roadmap  
- **When** they use bold, lists, or alignment on **Description**, **Note**, or any of the four RICE description fields  
- **Then** formatting is saved as sanitized HTML (`roadmap.description`, `roadmap.note`, RICE `*Description` fields)  
- **And** view mode shows formatted text without the editing toolbar  
- **And** CSV export strips HTML to plain text for all six surfaces.

**Error / edge handling**

- **Given** view mode  
- **When** the modal opens  
- **Then** description fields are read-only and toolbar is hidden.

---

## Epic O — Roadmap tasks

### US-O1 — Track tasks with status on a roadmap

- **Persona:** Delivery Lead  
- **Goal:** Break work into trackable items under an initiative.

**Acceptance criteria**

- **Given** the user adds task rows in the roadmap modal  
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
- **When** the user saves labels and links on a roadmap  
- **Then** an immediate cloud flush runs  
- **And** after reload (or another device pull) labels and links are unchanged.

---

## Epic Q — Bulk transfer (privileged workspace mode)

### US-Q1 — Duplicate selected roadmaps to another profile

- **Persona:** Trust profile operator  
- **Goal:** Clone initiatives into another portfolio.

**Acceptance criteria**

- **Given** workspace-wide mode and table multi-select  
- **When** the user chooses Duplicate and a target profile  
- **Then** copies are created with new IDs and “(copy)” title suffix  
- **And** originals remain in source profiles.

### US-Q2 — Move selected roadmaps to another profile

- **Persona:** Trust profile operator  
- **Goal:** Re-home initiatives to the correct owner profile.

**Acceptance criteria**

- **Given** workspace-wide mode and table multi-select  
- **When** the user chooses Move and a target profile  
- **Then** roadmaps are removed from source profiles and added to the target  
- **And** board/MoSCoW order arrays on sources are cleaned.

---

## Epic R — RACI accountability matrix

### US-R1 — Assign RACI roles on a roadmap

- **Persona:** Product Manager  
- **Goal:** Document who is Responsible, Accountable, Consulted, and Informed per initiative.  
- **Preconditions:** Profile unlocked; roadmap exists or is being created.

**Acceptance criteria**

1. **Add RACI entries**  
   - **Given** the user opens the RACI section in the roadmap modal  
   - **When** they add names with Business or Tech domain  
   - **Then** entries persist on save and reload.

2. **Domain filter in matrix view**  
   - **Given** roadmaps have RACI data  
   - **When** the user switches Business ↔ Tech in the RACI view  
   - **Then** the matrix re-renders showing only entries for that domain.

**Error / edge handling**

- **Given** an empty name field  
- **When** the user saves  
- **Then** blank rows are stripped by `normalizeRoadmapRaci`.

---

### US-R2 — Review RACI matrix in workshops

- **Persona:** Delivery Lead, Stakeholder  
- **Goal:** See accountability at portfolio level without opening each roadmap.

**Acceptance criteria**

- **Given** filtered roadmaps with RACI assignments  
- **When** the user opens the RACI view on desktop  
- **Then** a five-column matrix lists Responsible, Accountable, Consulted, Informed per roadmap.  
- **And** on compact layout, each roadmap appears as a card with role sections.

---

## Epic S — KANO portfolio matrix

### US-S1 — Score roadmap on KANO axes

- **Persona:** Product Manager  
- **Goal:** Classify initiatives by functionality depth and customer satisfaction response.

**Acceptance criteria**

1. **Set scores in modal**  
   - **Given** the roadmap KANO section  
   - **When** the user selects functionality (1–5) and satisfaction (1–5)  
   - **Then** scores persist and the roadmap appears in the **Positioned** KANO panel.

2. **Category legend**  
   - **Given** both axes are set  
   - **When** the user views the modal KANO matrix  
   - **Then** the category (Attractive, One-dimensional, Must-be, etc.) is shown per `kanoCategoryLegend`.

**Error / edge handling**

- **Given** only one axis is set  
- **When** the user saves  
- **Then** the roadmap remains in **Not positioned** until both axes are valid integers 1–5.

---

### US-S2 — Explore portfolio KANO map

- **Persona:** Portfolio Stakeholder  
- **Goal:** See which roadmaps are delighters vs must-haves at portfolio level.

**Acceptance criteria**

- **Given** roadmaps with KANO scores  
- **When** the user opens the KANO view with **Positioned** selected  
- **Then** the portfolio matrix groups roadmaps by category.  
- **And** **Not positioned** lists roadmaps missing scores with a **Set KANO scores** action.

---

## Epic T — BYOK API keys

### US-T1 — Configure Groq and Tavily keys locally

- **Persona:** Product Manager  
- **Goal:** Enable LLM features without storing keys in the cloud workspace.

**Acceptance criteria**

- **Given** the user opens header → API keys  
- **When** they paste, validate, and save each provider key  
- **Then** keys are encrypted in `localStorage` on this device only  
- **And** the header shows configured status (e.g. “2 of 2 ready”).

**Error / edge handling**

- **Given** an invalid key format  
- **When** the user saves  
- **Then** validation fails with a provider-specific hint; key is not stored.

---

## Epic U — LLM roadmap analysis

### US-U1 — Generate three-paragraph roadmap briefing

- **Persona:** Product Manager  
- **Goal:** Produce a stakeholder-ready narrative from roadmap data + optional web context.

**Acceptance criteria**

1. **Prerequisites**  
   - **Given** both Groq and Tavily keys are configured  
   - **When** the user clicks **Generate LLM analysis** in the Summary section  
   - **Then** Tavily enriches from roadmap links/search and Groq returns three paragraphs.

2. **Tone toggle**  
   - **Given** a professional summary was generated  
   - **When** the user selects **Simplified**  
   - **Then** a simplified variant is generated or shown per module rules.

**Error / edge handling**

- **Given** missing BYOK keys  
- **When** the user clicks generate  
- **Then** status explains which provider keys to add via header → API keys.

- **Given** Groq rate limit  
- **When** the pipeline retries  
- **Then** user sees a friendly wait/retry message (no silent failure).

---

## Epic V — 5 Why Framework

### US-V1 — Generate iterative WHY questions in view mode

- **Persona:** Product Manager  
- **Goal:** Explore root-cause framing for a roadmap item using structured WHY 1→5 questions without persisting AI output to the portfolio.

**Acceptance criteria**

1. **View-only access**  
   - **Given** the user opens a roadmap in **view** mode  
   - **When** they navigate to the **5 Why Framework** section  
   - **Then** the section is visible with **Ask WHY 1** enabled when BYOK keys are configured.

2. **Iterative generation**  
   - **Given** WHY 1 was generated  
   - **When** the user clicks **Ask WHY 2** (through WHY 5)  
   - **Then** each new question appears in the ordered list with its level lens label  
   - **And** questions are plain English only (no answers or assumptions).

3. **Reset**  
   - **Given** at least one WHY exists  
   - **When** the user clicks **Reset chain**  
   - **Then** session output clears and the button returns to **Ask WHY 1**.

**Error / edge handling**

- **Given** missing BYOK keys  
- **When** the user opens the section  
- **Then** status explains which provider keys to add via header → API keys.

- **Given** Groq or Tavily rate limit  
- **When** generation retries  
- **Then** user sees a friendly wait/retry message.

- **Given** create or edit modal mode  
- **When** the user opens the roadmap modal  
- **Then** the Five Why section remains hidden (view-only feature).

---

## Traceability

Map story IDs to [PRD.md](PRD.md) FR IDs and [TRACEABILITY_MATRIX.md](TRACEABILITY_MATRIX.md) during release review.

| Epic | PRD |
|------|-----|
| R | FR-2.10, FR-5.6 |
| S | FR-2.11, FR-5.7 |
| T | FR-11 |
| U | FR-2.12, FR-11 |
| V | FR-2.13, FR-11 |
