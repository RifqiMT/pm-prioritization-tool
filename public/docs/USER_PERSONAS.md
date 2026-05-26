# User Personas (Hub)

This hub summarizes the target users for the Product Management Prioritization Tool and links to **one-file-per-persona** deep dives under `docs/personas/`.

## How to use personas in this product

- Use personas to validate that features remain aligned to real workflows.
- Use them to design default behaviors (e.g., explainability tooltips, safe destructive actions).
- Use them in prioritization: if a change breaks a persona’s critical workflow, it needs mitigation.

## Persona set

### 1) Product Manager (Primary)

- **Primary workflow**: capture initiatives → score (RICE) → categorize (MoSCoW) → compare in multiple views → export.
- **Key need**: explainability (inputs + formula must be obvious).
- **Deep dive**: `personas/PM_PRIMARY.md`

### 2) Delivery / Team Lead

- **Primary workflow**: weekly planning and status movement (board/table).
- **Key need**: speed + clarity (fast slicing, fast status transitions).
- **Deep dive**: `personas/DELIVERY_LEAD.md`

### 3) Portfolio / Strategy Stakeholder

- **Primary workflow**: review and challenge prioritization decisions.
- **Key need**: transparency + guardrails (avoid “black-box” scoring or misleading financial certainty).
- **Deep dive**: `personas/PORTFOLIO_STAKEHOLDER.md`

### 4) Geo / Finance Focus PM

- **Primary workflow**: country/period slicing + EUR-normalized aggregation (map/reporting).
- **Key need**: usable filters + credible normalization.
- **Deep dive**: `personas/GEO_FINANCE_PM.md`

## Persona-to-feature mapping (at a glance)

- **Profiles**: PM Primary (portfolio separation), Delivery Lead (execution context)
- **RICE tooltip explainability**: PM Primary, Stakeholder
- **MOSCOW view**: PM Primary, Stakeholder
- **Board view**: Delivery Lead
- **Map + FX normalization**: Geo/Finance PM
- **Export/Import**: everyone (data ownership + portability)

