# Product Guardrails

## 1. Business Guardrails

- Keep prioritization explainable; no hidden scoring paths.
- Support **local-only** mode (file:// or static serve without API) and **cloud** mode (MongoDB on Vercel) without breaking either path.
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

### 3.1 Compact layout (≤1024px)

- **Single breakpoint policy:** All widths ≤1024px use the same phone UI (`is-compact-layout` + `is-phone-layout`). Do not reintroduce tablet-only hybrid grids.
- **No horizontal scroll** on board or MoSCoW in compact mode; use vertical stacks and nav pills instead.
- **Bulk delete on table:** Use the floating selection bar on compact; do not rely on desktop-only toolbar delete.
- **Touch targets:** Primary actions (FAB, nav pills, selection bar) must remain tappable (≥44px where feasible).
- **Fullscreen:** Compact CSS must apply inside the fullscreen host (`fullscreen-compact.css`).

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
- **Cloud workspace** is keyed by `PM_WORKSPACE_ID` + `PM_API_SECRET`; protect the secret like a password.
- `localStorage` remains a **per-origin cache**; preview URLs and production are separate origins unless using the same domain and workspace id intentionally.
- MongoDB free tier: monitor document size (~16 MB cap per document); very large portfolios may require splitting workspaces or archiving via export.
- After changing CSP in `vercel.json`, run the post-deploy smoke test in `docs/DEPLOYMENT.md` (map tiles, exchange rates, Leaflet).
- Remind users to export backups; cloud data lives in MongoDB — browser cache alone is not a backup.
- `PM_WORKSPACE_ID` + `PM_API_SECRET` protect the cloud document; rotating secrets invalidates old clients until reconfigured.
