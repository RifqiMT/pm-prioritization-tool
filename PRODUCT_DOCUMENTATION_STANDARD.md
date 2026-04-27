# Product Documentation Standard

This standard defines how product documentation is authored, reviewed, and kept in sync with implemented behavior.

## 1. Required Document Set

The following files are mandatory and must be maintained together:

- `README.md`
- `PRODUCT_DOCUMENTATION_STANDARD.md`
- `docs/README.md`
- `docs/PRD.md`
- `docs/USER_PERSONAS.md`
- `docs/USER_STORIES.md`
- `docs/VARIABLES.md`
- `docs/METRICS_AND_OKRS.md`
- `docs/DESIGN_GUIDELINES.md`
- `docs/ARCHITECTURE.md`
- `docs/TRACEABILITY_MATRIX.md`
- `docs/GUARDRAILS.md`
- `docs/CHANGELOG.md`

## 2. Quality Criteria

Each documentation update must:

1. Reflect current runtime behavior and UI.
2. Use professional wording and readable structure.
3. Describe product, business, and technical logic.
4. Include assumptions, limitations, and edge-case notes.
5. Reference implementation locations (files/functions) where relevant.

## 3. Coverage Requirements

### Product Coverage
- Problem statement, goals, scope, non-goals
- Feature behavior by user workflow
- Financial framework and prioritization logic
- Filtering model (including advanced filters and naming standardization)
- Tooltip behavior contract (single-active-tooltip rule + accessibility parity)

### User Coverage
- Persona goals, pain points, and workflow context
- Stories with acceptance criteria

### Data Coverage
- Variable catalog with formula and examples
- Relationship chart linking inputs to outputs
- Modal metadata fields and their rendering rules (`Project ID`, `Created`, `Last modified`, `RICE`, `Financial`, FX)

### Delivery Coverage
- Product metrics and OKRs
- Guardrails and operating constraints
- Traceability from requirement to implementation
- Changelog entries for user-visible UX adjustments and bug fixes

## 4. Governance Workflow

For any feature/code change:

1. Update relevant code.
2. Update `docs/CHANGELOG.md`.
3. Update PRD, stories, personas if behavior or scope changed.
4. Update variables/metrics/design/traceability/guardrails if impacted.
5. Run a final consistency pass across all docs.
6. Validate tooltip and filter naming consistency against implemented UI labels.

## 5. Review Checklist

- [ ] README and docs hub reflect latest architecture and features
- [ ] PRD aligns with actual implemented behaviors
- [ ] Stories and personas cover active product workflows
- [ ] Variables include latest fields and formulas
- [ ] Metrics/OKRs remain measurable and actionable
- [ ] Traceability matrix maps key requirements to code evidence
- [ ] Guardrails cover business, technical, and delivery limits
- [ ] Changelog records user-visible and architectural changes
- [ ] Tooltip behavior docs reflect current single-tooltip lifecycle logic
- [ ] Modal metadata layout docs reflect current left/right groupings

## 6. Source-of-Truth Rule

When docs conflict with code, code is the source of truth. Documentation must be corrected in the same change cycle.
