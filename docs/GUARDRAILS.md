# Product Guardrails

| Field | Value |
|-------|-------|
| **Last updated** | 2026-05-28 |
| **Implementation baseline** | `APP_ASSET_VERSION` = `20260528-ui192` |

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

### 3.1 Compact layout (≤1400px)

- **Single breakpoint policy:** All widths ≤`COMPACT_LAYOUT_MAX_WIDTH_PX` (1400) use the same phone UI (`is-compact-layout` + `is-phone-layout`). Do not reintroduce tablet-only hybrid grids.
- **No horizontal scroll** on board or MoSCoW in compact mode; use vertical stacks and nav pills instead.
- **Bulk delete on table:** Use the floating selection bar on compact; do not rely on desktop-only toolbar delete.
- **Touch targets:** Primary actions (FAB, nav pills, selection bar) must remain tappable (≥44px where feasible).
- **Fullscreen:** Compact CSS must apply inside the fullscreen host (`fullscreen-compact.css`).

## 4. Data Guardrails

- Keep canonical country normalization during import and rendering.
- Preserve deterministic mapping between framework inputs and computed outputs.
- Prevent duplicate entity insertion on import merge paths.
- Preserve stable roadmap identifiers and show them in modal metadata for auditability.

## 5. Delivery Guardrails

- Update PRD + traceability + changelog for behavior changes (changelog must not name **Super Admin**; see §7).
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
  - roadmap merge: by `roadmap.id` within a profile
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

---

## 7. Super Admin guardrails

**Documentation policy:** Super Admin behavior and the Super Admin profile are defined **only in this section**. Do not describe Super Admin in the PRD, user stories, README marketing copy, variables dictionary, or changelog titles—refer engineers and operators here instead.

### 7.1 Super Admin profile (who may use it)

- **Super Admin profile** = the workspace **trust profile** whose display name matches the decoded `WORKSPACE_TRUST_PROFILE_LABEL` constant in `src/constants.js` (currently **Rifqi Tjahyono**).
- Only that profile may see the **Super admin** toggle (`#superAdminModeToggle`). Other profiles must never show the toggle, even if team is labeled **Super Admin** (`SUPER_ADMIN_TEAM_LABEL` does **not** grant access).
- The toggle requires the trust profile to be **unlocked** (password satisfied for the session) before Super Admin mode can turn on.
- Class `html.is-workspace-trust-profile` on `<html>` gates visibility in CSS; `isSuperAdminProfile()` in `src/app.js` gates runtime logic.

### 7.2 Super Admin mode (what it does)

- Persisted flag: `state.superAdminMode` (boolean in workspace payload / `saveState`).
- Active only when: trust profile is active, toggle is on, profile is unlocked → `isSuperAdminModeActive()`.
- **Read scope:** portfolio views list **all roadmaps in the workspace** (every profile), with owner metadata attached (`ownerProfileId`, `ownerProfileName`).
- **Write scope:** create, edit, and delete apply to each roadmap’s **home (owner) profile**, not by re-homing roadmaps to the active session profile — except **bulk move**, which explicitly transfers selected roadmaps to a chosen target profile (super admin table selection only).
- **Bulk transfer (table selection):** when mode is active, multi-select in table view exposes **Duplicate selected** and **Move selected**. Duplicate deep-copies roadmaps into a target profile (new IDs, “(copy)” title suffix). Move removes roadmaps from source profiles and adds them to the target profile; board/MoSCoW order arrays on source profiles are cleaned.
- **UI when active** (`html.is-super-admin-mode`):
  - Workspace banner and header badge (“Super admin · all profiles”).
  - Table **Profile** column + sort; optional **Owner profile** advanced filter and table group-by **Owner profile**.
  - Owner identity chips / card strips on table cards, Scrum/MoSCoW cards, and map tooltips (including **per-profile breakdown** of the selected map metric for each country).
  - Roadmap modal **Owner profile** selector on create; warnings when editing/deleting another profile’s roadmap.
- **UI placement:** desktop → `#superAdminToggleDesktopSlot` in portfolio command bar; phones/tablets (≤1400px) → `#superAdminToggleMobileSlot` in the profile picker bar on the **same row** as the picker.

### 7.3 Super Admin UX and safety guardrails

- Never show owner-only filters, Profile column, or cross-profile owner strips unless Super Admin mode is active.
- Cross-profile rows/cards must remain visually distinct from the active profile’s own roadmaps (e.g. external-profile highlight).
- Toast and modal copy must state that changes persist in the **owner profile**.
- Turning Super Admin off must restore single-profile scope immediately (re-render table, board, MoSCoW, map).
- Do not log or export the trust-profile label token; treat `WORKSPACE_TRUST_PROFILE_LABEL` as an implementation detail.

### 7.4 Super Admin delivery guardrails

- Changes to Super Admin eligibility, toggle placement, or cross-profile rules require updating **this section** and bumping `APP_ASSET_VERSION`.
- Do not document Super Admin in [VARIABLES.md](VARIABLES.md); use technical names (`superAdminMode`, `filterOwnerProfile`) only in code comments or here.
