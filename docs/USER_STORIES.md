# User Stories

**Product:** Product Management Prioritization Tool  
**Version:** 2.0.0  
**Last updated:** 2026-05-26  
**Purpose:** This document turns epics into user-story contracts with clear **Given / When / Then** acceptance criteria, including edge cases and error handling.

---

## Story Template

Each story includes:
- **Persona**: who needs it
- **Goal**: what outcome they want
- **Preconditions**: what must be true before the story starts
- **Acceptance Criteria**: expected behavior in normal and edge cases
- **Error / Edge Handling**: what happens when inputs are invalid or security constraints apply

---

## Epic A — Portfolio Setup

### US-A1 — Create profile-based portfolios
- **Persona:** Product Manager
- **Goal:** Separate portfolio contexts by team/product.
- **Preconditions:** User opens the app and can create profiles.

**Acceptance Criteria**
1. **Create profile successfully**
   - **Given** the user enters a valid profile name
   - **When** the user clicks create
   - **Then** the new profile appears in the profile list
   - **And** the profile is available for project creation.
2. **Optional team handling**
   - **Given** the user leaves team empty (optional)
   - **When** the profile is created
   - **Then** the profile is created without a team value
   - **And** UI labels remain stable (no broken layout).

**Error / Edge Handling**
- **Given** the user enters an empty profile name
- **When** the user submits
- **Then** the app prevents creation and shows an appropriate validation message.

---

### US-A2 — Switch active profile quickly
- **Persona:** Product Manager
- **Goal:** Ensure all views reflect the selected context.
- **Preconditions:** At least one profile exists.

**Acceptance Criteria**
1. **Activate profile**
   - **Given** the user selects a profile in the profiles panel
   - **When** the user activates it
   - **Then** `activeProfileId` is updated
   - **And** the portfolio header and all project views refresh to show that profile’s data.
2. **Locked profile behavior**
   - **Given** the selected profile is password-protected
   - **When** the profile is locked
   - **Then** the app shows the locked banner and prevents project rendering across views.

**Error / Edge Handling**
- **Given** a profile is deleted while selected
- **When** the UI rerenders
- **Then** active selection falls back to the next available profile (or shows “No profile selected”).

---

## Epic B — Project Prioritization

### US-B1 — Enter RICE fields and see computed score
- **Persona:** Product Manager
- **Goal:** Rank work objectively using RICE.
- **Preconditions:** Active profile is unlocked (or at least project surfaces are accessible).

**Acceptance Criteria**
1. **Compute score from inputs**
   - **Given** valid values for Reach, Impact, Confidence, and Effort are entered
   - **When** the user saves the project
   - **Then** the RICE score is computed with the formula used by the app
   - **And** the score is displayed in relevant views (table and board sort).
2. **Normalize confidence**
   - **Given** Confidence is greater than 1 (stored as percent-style)
   - **When** the score is computed
   - **Then** Confidence is normalized to a decimal before calculation.

**Error / Edge Handling**
- **Given** Reach is negative
- **When** user submits
- **Then** validation blocks save.
- **Given** Effort is invalid (<= 0 or not in allowed scale)
- **When** user submits
- **Then** validation blocks save or produces a safe score per app logic (no NaN/Infinity).

---

### US-B2 — Explain RICE using tooltip details
- **Persona:** Product Manager
- **Goal:** Make scoring transparent and defensible.

**Acceptance Criteria**
1. **Tooltip contains full explanation**
   - **Given** a user hovers/focuses the RICE tooltip target
   - **When** the tooltip appears
   - **Then** it includes:
     - Abbreviation expansion for R / I / C / E
     - The RICE formula
     - The numeric calculation line when inputs are valid.
2. **Single tooltip visibility**
   - **Given** multiple tooltip triggers exist
   - **When** the user opens one tooltip
   - **Then** any previously visible tooltip is hidden.

**Error / Edge Handling**
- **Given** the user moves quickly between tooltip triggers
- **When** tooltips are rerendered
- **Then** the app avoids overlapping tooltips and remains keyboard-accessible.

---

### US-B3 — MOSCOW categorization
- **Persona:** Product Manager
- **Goal:** Express delivery intent clearly.

**Acceptance Criteria**
1. **Select MoSCoW category**
   - **Given** the user edits a project
   - **When** they select a valid MoSCoW category
   - **Then** the project record stores `moscowCategory` (or null-safe equivalent)
   - **And** the MoSCoW view places the project into the matching quadrant.
2. **RICE sort toggle (optional)**
   - **Given** the MoSCoW RICE sort toggle is enabled
   - **When** the MoSCoW view renders
   - **Then** projects in each quadrant are ordered by computed RICE.

**Error / Edge Handling**
- **Given** invalid MoSCoW category value is selected
- **When** user saves
- **Then** app prevents invalid persistence (no broken quadrant mapping).

---

## Epic C — Financial Evaluation

### US-C1 — Choose a financial framework per project
- **Persona:** Product Manager
- **Goal:** Use value logic aligned with the planning model.

**Acceptance Criteria**
1. **Switch framework**
   - **Given** a project is edited
   - **When** the user selects a framework (custom/clv/nps/risk/headcount/operational)
   - **Then** framework-specific inputs render
   - **And** irrelevant framework inputs are cleared to avoid leakage.

**Error / Edge Handling**
- **Given** the user switches frameworks multiple times
- **When** the project is saved
- **Then** only the correct inputs for the active framework are sanitized and persisted.

---

### US-C2 — Framework-specific inputs compute impact consistently
- **Persona:** Product Manager
- **Goal:** Consistent calculation across frameworks.

**Acceptance Criteria**
1. **Compute impact on save**
   - **Given** valid framework inputs are entered
   - **When** the user saves
   - **Then** `financialImpactValue` is computed or normalized by the framework rules
   - **And** `financialImpactCurrency` is set when needed.
2. **Switching sanitizes**
   - **Given** the user changes frameworks
   - **When** computation runs
   - **Then** the prior framework’s impact logic is not reused.

**Error / Edge Handling**
- **Given** missing required inputs for the selected framework
- **When** user saves
- **Then** validation blocks or sets safe null/zero values consistent with app rules (no NaN).

---

### US-C3 — Identify framework using icon + tooltip
- **Persona:** Stakeholder
- **Goal:** Identify model type quickly.

**Acceptance Criteria**
1. **Table shows framework icon**
   - **Given** table view is open
   - **When** projects render
   - **Then** each project row includes the Framework icon.
2. **Tooltip describes framework**
   - **Given** the user hovers/focuses the framework icon
   - **When** tooltip appears
   - **Then** it includes framework name and explanatory content.

**Error / Edge Handling**
- **Given** a project uses custom framework without expected fields
- **When** tooltip is rendered
- **Then** tooltip remains readable and does not crash.

---

## Epic D — Execution Views

### US-D1 — Table sorting and filtering
- **Persona:** Team Lead
- **Goal:** Quickly find critical slices.

**Acceptance Criteria**
1. **Sort**
   - **Given** the table is visible
   - **When** the user selects a sort order
   - **Then** rows reorder according to app sort logic.
2. **Filter**
   - **Given** the user sets quick/advanced filters
   - **When** filters apply
   - **Then** only projects matching filter criteria appear.
3. **Framework naming consistency**
   - **Given** the user uses advanced filters
   - **When** they select the framework filter
   - **Then** the UI consistently labels it as `Framework` across table and filters.

**Error / Edge Handling**
- **Given** filters conflict (e.g., impossible ranges)
- **When** filtering runs
- **Then** the app shows a safe empty state without errors.

---

### US-D2 — Board status drag/drop and toggleable columns
- **Persona:** Team Lead
- **Goal:** Efficient execution changes via board.

**Acceptance Criteria**
1. **Drag/drop status transition**
   - **Given** RICE sort is off (board allows ordering)
   - **When** the user drags a card to a different status column
   - **Then** the project’s status updates
   - **And** the card moves to the correct column.
2. **Clickable status filter pills**
   - **Given** the board legend displays status pills
   - **When** the user clicks a status pill
   - **Then** that status column is hidden or shown
   - **And** the clicked pill reflects its active state via `aria-pressed`.
3. **At least one column visible**
   - **Given** multiple statuses exist
   - **When** the user attempts to hide the last visible column
   - **Then** the app prevents hiding all columns.
4. **Persistence**
   - **Given** a user hides columns
   - **When** they reload the page
   - **Then** hidden state persists via saved state (boardHiddenStatuses).

**Error / Edge Handling**
- **Given** a project has an unexpected/missing status value
- **When** the board renders
- **Then** the app safely falls back to a defined default status.

---

### US-D3 — MoSCoW grid movement
- **Persona:** Product Manager
- **Goal:** Reflect priority intent shifts.

**Acceptance Criteria**
1. **Move between quadrants**
   - **Given** a project exists
   - **When** the user updates its MoSCoW category (via grid interactions or edit modal)
   - **Then** the project appears in the corresponding MoSCoW quadrant.
2. **Optional RICE sort**
   - **Given** MoSCoW RICE sort toggle is enabled
   - **When** quadrant renders
   - **Then** projects are ordered by computed RICE.

**Error / Edge Handling**
- **Given** invalid MoSCoW input
- **When** user saves
- **Then** save is blocked or data normalized to valid enum.

---

### US-D4 — Map aggregation by projects / RICE / financial
- **Persona:** PM (Geo/Finance)
- **Goal:** Understand regional trade-offs.

**Acceptance Criteria**
1. **Segmented metric selector**
   - **Given** the Map view is open
   - **When** the user selects Count / RICE / EUR
   - **Then** the map aggregation uses the selected metric
   - **And** the legend updates accordingly.
2. **FX normalization readiness**
   - **Given** FX exchange rates are unavailable
   - **When** financial metric is selected
   - **Then** the app fails gracefully (fallback messaging; no crashes).

**Error / Edge Handling**
- **Given** map tiles or data loading fails
- **When** user remains on Map view
- **Then** the map shows an empty/error state with guidance.

---

### US-D5 — Card tooltips provide quick context
- **Persona:** Product Manager
- **Goal:** See status and description without editing.

**Acceptance Criteria**
1. **Tooltip content on hover/focus**
   - **Given** a board/MoSCoW card tooltip trigger exists
   - **When** user hovers/focuses the card title
   - **Then** tooltip includes status and description content.
2. **Tooltip exclusivity**
   - **Given** another tooltip is visible
   - **When** a new card tooltip is opened
   - **Then** the previous tooltip is hidden.

**Error / Edge Handling**
- **Given** missing description fields
- **When** tooltip renders
- **Then** it remains readable and omits empty lines safely.

---

## Epic E — Data Governance

### US-E1 — Export JSON/CSV and enforce password-gated profiles
- **Persona:** Product Manager
- **Goal:** Backup/share safely without leaking locked portfolios.

**Acceptance Criteria**
1. **Protected profiles are not silently exported**
   - **Given** at least one password-protected profile exists
   - **When** the user initiates Export (JSON or CSV)
   - **Then** export includes only:
     - profiles without a password, and
     - profiles that are unlocked with the correct password (this session) OR are verified in the export unlock dialog.
2. **Incorrect password excludes that profile**
   - **Given** a user enters an incorrect password for a protected profile in the export unlock dialog
   - **When** they confirm export verification
   - **Then** that profile is omitted from the exported file.
3. **Missing password excludes that profile**
   - **Given** a protected profile’s password field is empty
   - **When** verification runs
   - **Then** that profile is omitted from the exported file.
4. **User feedback**
   - **Given** one or more profiles were omitted
   - **When** export completes
   - **Then** the app shows a success toast explaining skipped protected profiles.

**Error / Edge Handling**
- **Given** the security module fails to load
- **When** export verification is attempted
- **Then** the app shows an error message and avoids generating an export file that could violate security expectations.

---

### US-E2 — Import merge behavior avoids corruption
- **Persona:** Product Manager
- **Goal:** Safely merge exported data into the workspace.

**Acceptance Criteria**
1. **Merge by IDs**
   - **Given** an import file contains profiles and projects with IDs
   - **When** import runs
   - **Then** profiles/projects with matching IDs are merged/updated
   - **And** entities with new IDs are added.
2. **No duplicate corruption**
   - **Given** an import is repeated with the same file
   - **When** import runs again
   - **Then** duplicates are not created for the same IDs.
3. **UI parity**
   - **Given** the export and import dialogs are opened
   - **When** user compares them
   - **Then** both use the same modern modal design system:
     - consistent header/palette
     - consistent format cards
     - consistent responsive behavior.

**Error / Edge Handling**
- **Given** an invalid JSON/CSV file is selected
- **When** the import runs
- **Then** import fails with a user-facing error message and does not partially corrupt state.

---

### US-E3 — Local-first persistence without backend
- **Persona:** Solo PM
- **Goal:** Work without server setup.

**Acceptance Criteria**
1. **Persist data locally**
   - **Given** the user saves profiles and projects
   - **When** they refresh the page
   - **Then** the data remains in localStorage.
2. **Session-only unlock behavior**
   - **Given** a profile is unlocked
   - **When** the user refreshes or closes/reopens the tab
   - **Then** the unlock state resets by design (user must unlock again).

**Error / Edge Handling**
- **Given** localStorage fails (privacy mode or quota)
- **When** saving occurs
- **Then** the app logs errors and shows a failure toast/message where possible.

---

## Epic F — UX Standardization and Explainability

### US-F1 — Exactly one tooltip visible at a time
- **Persona:** PM
- **Goal:** Prevent clutter and confusion.

**Acceptance Criteria**
1. **Single tooltip lifecycle**
   - **Given** the user opens a tooltip
   - **When** the user opens another tooltip before closing the first
   - **Then** only one tooltip remains visible at any time.
2. **Cross-surface behavior**
   - **Given** a tooltip is open in table/cards/modal
   - **When** another surface triggers a tooltip
   - **Then** the app hides the prior tooltip and shows only the new one.

**Error / Edge Handling**
- **Given** rapid hover events
- **When** tooltip state changes quickly
- **Then** tooltip positions remain stable enough to avoid UI jitter.

---

### US-F2 — Standardized tooltip guidance for every variable field
- **Persona:** PM
- **Goal:** Make form completion self-explanatory.

**Acceptance Criteria**
1. **Standardized tooltip presence**
   - **Given** the user opens a project create/edit modal
   - **When** they focus each variable input
   - **Then** standardized tooltip guidance is present for supported variables.
2. **Fallback guidance**
   - **Given** a field lacks explicit tooltip markup
   - **When** modal initializes
   - **Then** the app injects fallback standardized tooltip copy where required.

**Error / Edge Handling**
- **Given** tooltip injection fails
- **When** user opens the modal
- **Then** the app still renders inputs and does not break modal layout.

---

### US-F3 — Advanced filter naming standardization (`Framework`)
- **Persona:** PM
- **Goal:** Keep terminology consistent across UI surfaces.

**Acceptance Criteria**
1. **Label consistency**
   - **Given** the user opens advanced filters
   - **When** they view the framework filter label
   - **Then** the label is exactly `Framework` (not “Value model”, “Finance”, etc.).
2. **Filter matches data**
   - **Given** the user selects a framework in filters
   - **When** filtering applies
   - **Then** filtered results reflect the stored framework keys for each project.

**Error / Edge Handling**
- **Given** a project has no framework selected
- **When** filters run
- **Then** the project is handled consistently (excluded or treated as custom/null per app rules).

---

### US-F4 — Project footer metadata includes Project ID + grouped context
- **Persona:** PM
- **Goal:** Faster audit and review.

**Acceptance Criteria**
1. **Footer layout correctness**
   - **Given** the project edit/view modal is open
   - **When** the metadata footer is visible
   - **Then** left-side metadata includes Project ID and timestamps
   - **And** right-side metadata includes RICE score and financial/EUR context.
2. **No misleading precision**
   - **Given** EUR conversion uses exchange rates
   - **When** the footer shows financial context
   - **Then** it remains clear that values are estimates and may depend on FX availability.

**Error / Edge Handling**
- **Given** exchange rates are unavailable
- **When** footer renders financial context
- **Then** it shows consistent messaging without corrupt numbers.

---

## Epic G — Compact / mobile layout (≤1024px)

### US-G1 — Unified phone UI on tablets and phones
- **Persona:** Mobile / field PM
- **Goal:** Use the same touch-first layout on any non-desktop width.
- **Preconditions:** Viewport width ≤1024px.

**Acceptance Criteria**
1. **Layout classes**
   - **Given** the viewport is 768px or 1024px wide
   - **When** the page loads or resizes
   - **Then** `html` has `is-compact-layout` and `is-phone-layout`
   - **And** desktop-only horizontal board/MoSCoW layouts are not used.
2. **No horizontal board/MoSCoW scroll**
   - **Given** the user opens Board or MoSCoW on compact
   - **When** the view renders
   - **Then** columns/quadrants stack vertically
   - **And** the user can scroll vertically only to see all content.

**Error / Edge Handling**
- **Given** the user rotates the device or resizes the window across 1024px
- **When** layout refreshes
- **Then** classes update without requiring a full page reload.

---

### US-G2 — MoSCoW compact navigator
- **Persona:** Product Manager
- **Goal:** Jump between MoSCoW quadrants quickly on compact.
- **Preconditions:** MoSCoW view active; compact layout.

**Acceptance Criteria**
1. **Nav pills**
   - **Given** four MoSCoW categories exist
   - **When** the compact nav renders
   - **Then** a 2×2 pill grid shows Must / Should / Could / Won't with counts.
2. **Scroll sync**
   - **Given** the user scrolls the quadrant list
   - **When** a quadrant enters the observer threshold
   - **Then** the matching nav pill receives active state (`syncMoscowCompactNav`).

---

### US-G3 — Table bulk actions on compact
- **Persona:** Delivery Lead
- **Goal:** Delete or manage multiple projects without desktop toolbar.
- **Preconditions:** Table view; compact layout.

**Acceptance Criteria**
1. **Selection bar**
   - **Given** one or more projects are selected
   - **When** selection changes on compact
   - **Then** the floating selection bar appears with bulk delete
   - **And** the desktop toolbar bulk delete control is not the primary path.
2. **FAB**
   - **Given** compact layout
   - **When** the portfolio workspace is visible
   - **Then** a FAB is available to create a new project.

---

### US-G4 — Fullscreen preserves compact layouts
- **Persona:** Stakeholder
- **Goal:** Present MoSCoW or board on a projector or tablet in fullscreen.
- **Preconditions:** Compact or desktop layout.

**Acceptance Criteria**
1. **Fullscreen host**
   - **Given** the user toggles fullscreen on board, MoSCoW, table, or map
   - **When** fullscreen activates
   - **Then** `body` uses the fullscreen host class
   - **And** compact CSS rules still apply when viewport ≤1024px.
2. **Layout refresh**
   - **Given** fullscreen was entered on compact
   - **When** fullscreen opens
   - **Then** `refreshCompactFullscreenEnter()` runs so grids/columns measure correctly.

---

### US-G5 — Site footer readability
- **Persona:** All users
- **Goal:** See maintainer attribution and links on all devices.
- **Preconditions:** Page loaded.

**Acceptance Criteria**
1. **Footer layout**
   - **Given** any viewport width
   - **When** the user scrolls to the page footer
   - **Then** credit, LinkedIn, and website appear in a centered one-row grid
   - **And** text contrast meets readable maroon-on-cream styling (`app-footer.css`).

