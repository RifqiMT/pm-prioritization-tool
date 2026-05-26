# Persona — Product Manager (Primary)

## Snapshot

- **Name**: The Portfolio PM
- **Role**: Product Manager (roadmap owner)
- **Seniority**: Mid → Senior
- **Operating context**: Quarterly planning + weekly execution syncs across multiple teams

## Goals (outcomes)

- Build an **explainable** roadmap where prioritization decisions can be defended to stakeholders.
- Compare initiatives consistently across **impact, effort, and confidence**, not just “loudness”.
- Add value lenses (e.g., financial impact) without turning planning into accounting.
- Maintain a portfolio that is **easy to revisit** across planning cycles.

## Jobs-to-be-done (JTBD)

- **When** I’m preparing a planning session, **I want** a lightweight workspace to capture initiatives and compute priority, **so that** the team aligns on what to do next and why.
- **When** a stakeholder challenges a score, **I want** to show the exact inputs and formula, **so that** trust increases and debate is grounded in data.
- **When** I’m switching between products/teams, **I want** separate portfolios, **so that** prioritization doesn’t mix unrelated contexts.

## Pain points

- Scores and value assumptions spread across docs, spreadsheets, and tools → hard to audit.
- Teams apply different RICE rubrics → inconsistent prioritization outcomes.
- “Confidence” becomes a gut feel with no explanation; “effort” becomes political.
- Recreating the same planning spreadsheet every quarter wastes time.
- Tools that require backend setup or heavy admin often fail adoption.

## Key behaviors in this app

- Creates **Profiles** for separate contexts (team/product/owner).
- Creates Projects and fills RICE inputs, expects immediate computed score.
- Uses the **RICE score tooltip** to communicate explainability (R/I/C/E meanings + formula + calculation line).
- Sets **MoSCoW** category for delivery intent.
- Uses **Financial frameworks** when value discussion needs a shared model.
- Uses filters (including **Countries** and **Project period**) to create meeting-ready slices.
- Exports data periodically for backup and portability.

## Critical UX expectations

- **Every field explains itself**: all variable inputs in the create/edit modal provide consistent tooltip guidance.
- **One tooltip at a time**: tooltips never overlap across table, cards, and modal fields.
- **Fast scanning**: table and cards maintain clear hierarchy (labels, chips, icons).
- **Safe destructive actions**: deletes require confirmation; bulk delete is clearly guarded.

## Success signals (how they define “it works”)

- Planning session completes without “where did this number come from?” confusion.
- Stakeholders accept the ranking because it is transparent and reproducible.
- Import/export works reliably (no duplicated corruption).
- Profiles keep portfolios cleanly separated.

## Common scenarios

1. **Quarterly planning**
   - Create or select a profile
   - Add/refresh projects with RICE inputs and MoSCoW category
   - Apply filters (period, type, countries) to slice the discussion
   - Use export for snapshot sharing

2. **Stakeholder review**
   - Sort by RICE, show top 10
   - Open RICE tooltip for a contested project
   - Switch to Board/MOSCOW view to align prioritization with execution/strategy intent

## Risks / guardrails for this persona

- Avoid presenting financial estimates as accounting truth; position as planning support.
- Maintain consistent rubric calibration across teams before debating scores.

