# Product Requirements Document (PRD)

## Product
Product Management Prioritization Tool

## Version
2.0 (aligned to current audited implementation)

## 1. Product Overview

The app is a local-first prioritization workspace for product teams. It combines:

- RICE scoring for quantitative ranking
- MoSCoW categorization for delivery intent
- Financial impact frameworks for value estimation
- Multi-view planning (Table, Board, MOSCOW, Map)

No backend is required. Data is stored in-browser and can be exported/imported.

## 2. Goals and Non-Goals

### Goals
- Standardize project prioritization across teams/profiles
- Improve transparency of prioritization logic
- Support value estimation with multiple financial frameworks
- Provide fast planning and communication views

### Non-Goals
- Multi-user collaboration/authentication
- Server-side persistence
- Accounting-grade financial reporting

## 3. Target Users

- Product managers
- Team leads / delivery leads
- Portfolio stakeholders
- PMs with geographic and financial reporting needs

## 4. Functional Requirements

### FR-1 Profiles and Project CRUD
- Create, edit, view, delete profiles
- Create, edit, view, delete projects
- Bulk delete in table view

### FR-2 Prioritization Logic
- RICE formula: `(Reach × Impact × Confidence) ÷ Effort`
- Validation boundaries:
  - Reach: `>= 0`
  - Impact: `1..5`
  - Confidence: `0..100`
  - Effort: `1..5`

### FR-3 Financial Frameworks
Supported frameworks:

- `custom`
- `clv`
- `nps`
- `risk`
- `headcount`
- `operational`

Framework-specific inputs are sanitized/reset when switching to prevent stale cross-framework contamination.

### FR-4 Planning Views
- **Table:** sortable/filterable tabular view, action controls
- **Board:** status workflow + drag/drop
- **MOSCOW:** 2x2 strategic prioritization grid
- **Map:** country-level aggregation of projects/RICE/financial (EUR)
- **Advanced filtering:** includes framework-level filtering using standardized label `Framework`

### FR-5 UX Tooling
- Unified tooltip system across table/cards/modal fields
- RICE score tooltip includes abbreviation meanings + formula + computed line
- Framework icon column in table (`Framework`) similar to Type/State icon behavior
- Card project title tooltip includes `Status` + `Description`
- Tooltip lifecycle enforces **single visible tooltip** across app
- Modal fields enforce standardized tooltip coverage for all variable inputs

### FR-6 Modal Metadata Footer
- Left metadata block shows: `Project ID`, `Created`, `Last modified`
- Right financial metadata block shows: `Financial (EUR)`, `Exchange rate`, `RICE score`

### FR-7 Data Mobility
- Export JSON/CSV
- Import JSON/CSV with merge semantics (profile/project reconciliation)

## 5. Non-Functional Requirements

- Browser compatibility for modern Chromium/Firefox/Safari
- Local persistence reliability via `localStorage`
- Responsive layout for desktop/tablet/mobile use
- Accessible interaction patterns (keyboard focus, aria labels, readable contrast)

## 6. Data and Domain Constraints

- Country names normalized to canonical representation
- Currency conversion shown as decision support
- Missing optional values should degrade gracefully (`—`)

## 7. Success Criteria

- Teams can complete end-to-end prioritization in one workspace
- Users can explain score/value derivation directly from tooltip/inputs
- Export/import preserves portfolio integrity
- Framework switching does not leak stale values
- Only one tooltip is visible at any point during interaction
- Every create/edit modal variable field provides tooltip guidance

## 8. Risks and Mitigations

- **Risk:** docs drift from runtime behavior  
  **Mitigation:** enforce traceability matrix updates per change
- **Risk:** financial overconfidence from modeled values  
  **Mitigation:** tooltip and guardrails position values as planning estimates
- **Risk:** local-only storage loss  
  **Mitigation:** promote periodic exports
