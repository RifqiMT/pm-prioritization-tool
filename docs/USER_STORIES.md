# User Stories

## Epic A — Portfolio Setup

- **US-A1** As a Product Manager, I want to create profile-based portfolios so I can separate contexts by team/product.
- **US-A2** As a Product Manager, I want to switch active profile quickly so all views reflect the same context.

## Epic B — Project Prioritization

- **US-B1** As a Product Manager, I want to enter RICE fields and see computed score so I can rank work objectively.
- **US-B2** As a Product Manager, I want RICE tooltip details (R/I/C/E meanings + formula + calculation line) so scoring is explainable.
- **US-B3** As a Product Manager, I want MOSCOW categorization so strategic urgency is explicit.

## Epic C — Financial Evaluation

- **US-C1** As a Product Manager, I want to choose a financial framework per project so value logic fits use case.
- **US-C2** As a Product Manager, I want framework-specific inputs and auto-computed impact so calculations are consistent.
- **US-C3** As a stakeholder, I want a framework icon column with tooltip so I can identify model type at a glance.

## Epic D — Execution Views

- **US-D1** As a Team Lead, I want table sorting/filtering so I can focus on critical slices quickly.
- **US-D2** As a Team Lead, I want board drag/drop so status transitions are fast.
- **US-D3** As a Product Manager, I want MOSCOW grid movement so category shifts are visible and actionable.
- **US-D4** As a PM (Geo/Finance), I want map aggregation by projects/RICE/financial so regional trade-offs are visible.

## Epic E — Data Governance

- **US-E1** As a Product Manager, I want JSON/CSV export so I can back up and share data safely.
- **US-E2** As a Product Manager, I want import merge behavior that avoids duplicate corruption.
- **US-E3** As a Solo PM, I want local-first persistence so I can operate without backend setup.

## Acceptance Criteria Highlights

- Framework switch clears non-relevant framework inputs.
- RICE score tooltip presents:
  - abbreviation expansion
  - core formula
  - numeric calculation line when inputs are valid
- Table includes compact `Framework` column with icon + tooltip.
- Removing RICE Values standalone column does not remove access to RICE component values.
