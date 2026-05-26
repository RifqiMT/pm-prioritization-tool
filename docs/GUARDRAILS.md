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

---

## 6. Export / import Guardrails (security + data integrity)

### 6.1 Export security behavior
- Exported files must not include password-protected profile content unless:
  - the profile has no password, or
  - the profile is unlocked with the correct password in the current session, or
  - the user completes verification for that specific profile in the export unlock dialog.
- If any password is missing or incorrect during export verification:
  - the affected profile is omitted from the exported payload.
- The app must avoid logging or persisting plaintext passwords anywhere.

### 6.2 Export omission rules
- “At least one profile” must remain exportable:
  - if all profiles are password-protected and verification fails for all of them, the export action must fail gracefully.
- Export success messaging must explicitly reflect omission counts and/or skipped profile names when available.

### 6.3 Import merge behavior constraints
- Import must merge by stable IDs:
  - profile merge: by `profile.id`
  - project merge: by `project.id` within a profile
- Import must not create duplicate corruption:
  - repeated imports of the same file should converge (no duplicate insertion for the same IDs).
- Import must handle invalid input safely:
  - JSON parse errors and malformed shapes must be handled with user-facing errors and without partial corruption.

### 6.4 UI parity constraint (export/import)
- Export and import dialogs must:
  - follow the same component language (header, body, footer actions)
  - support mobile/tablet layout consistently
  - avoid legacy all-caps or dark-background overrides that reduce usability.

## 6. Production (Vercel) Guardrails

- Deploy as **static assets only**; do not add server-side secrets to the repository.
- Treat `localStorage` as **per-origin**: production URL, preview URLs, and localhost each have separate data.
- After changing CSP in `vercel.json`, run the post-deploy smoke test in `docs/DEPLOYMENT.md` (map tiles, exchange rates, Leaflet).
- Remind users to export backups; Vercel does not persist portfolio data.
