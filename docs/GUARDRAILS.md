# Product Guardrails

## 1. Business Guardrails

- Keep prioritization explainable; no hidden scoring paths.
- Maintain local-first operation as a core product value.
- Preserve user data ownership via export/import capability.
- Present financial outputs as planning estimates, not accounting truth.

## 2. Technical Guardrails

- Do not allow framework input leakage across framework switches.
- Preserve RICE validation boundaries (`reach`, `impact`, `confidence`, `effort`).
- Ensure tooltip architecture remains consistent and non-clipped.
- Enforce one-tooltip-at-a-time behavior across all interaction surfaces.
- Avoid destructive actions without explicit confirmation.

## 3. UX Guardrails

- Dense table columns must remain readable without broken header wrapping.
- Icon-only semantics must always include accessible tooltip/aria context.
- Derived calculations (RICE/financial) must provide explanatory text.
- Every create/edit modal variable field must provide standardized tooltip guidance.
- Framework terminology must stay standardized as `Framework` in filter/table labels.

## 4. Data Guardrails

- Keep canonical country normalization during import and rendering.
- Preserve deterministic mapping between framework inputs and computed outputs.
- Prevent duplicate entity insertion on import merge paths.
- Preserve stable project identifiers and show them in modal metadata for auditability.

## 5. Delivery Guardrails

- Update PRD + traceability + changelog for behavior changes.
- Run lint and sanity-pass for modified files.
- Keep documentation aligned with audited runtime files.
