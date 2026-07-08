# Product Guardrails

| Field | Value |
|-------|-------|
| **Last updated** | 2026-07-09 |
| **Implementation baseline** | `APP_ASSET_VERSION` = `20260709-ui199` |

Cross-feature behavior summaries live in [FEATURE_LOGIC_AND_CONSTRAINTS.md](FEATURE_LOGIC_AND_CONSTRAINTS.md). This file defines **hard limits** and policies that must not be violated.

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
- **No header × dismiss in modals:** dialogs close via labeled footer actions (Cancel, Done, Save, etc.), Esc, and backdrop where appropriate — never a top-right × icon (see [DESIGN_GUIDELINES.md](DESIGN_GUIDELINES.md) §5.12).

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

### 6.5 Export payload integrity
- JSON export must use `ExportPayload.buildJsonExportDocument` so all `WORKSPACE_PERSISTED_STATE_KEYS` round-trip.
- CSV export must use `ExportPayload.CSV_COLUMN_IDS`; unknown entity keys serialize via `profileExtraData` / `roadmapExtraData` JSON columns.
- `roadmapPeriods`, `roadmapRaci`, and workspace filter state must survive export → import without loss when profiles are exportable.
- BYOK API keys and LLM/Five Why session output must never appear in export files.

### 6.6 ShareLink deep-link constraints
- Share URLs encode **references only** (profile id, view name, roadmap id) — never embed roadmap content or passwords.
- Recipients must already have the same workspace data (MongoDB sync, import, or shared machine); links are not a data-transfer mechanism.
- Locked profiles must not expose roadmap content until unlock succeeds; deep links queue the standard unlock flow.
- Legacy `?roadmap=&view=&profile=` query params are migrated to hash format; do not rely on query strings for new shares.

### 6.7 Concurrent cloud merge constraints
- Cloud sync is **merge-based**, not locked transactions — simultaneous editors should expect last merged save to win on the same entity when timestamps are close.
- `workspaceTombstones` must be included in every serialized workspace payload so deletes propagate; do not strip tombstones on export unless intentionally archiving.
- Entities recreated with `modifiedAt` newer than a tombstone timestamp may reappear (intentional resurrection).
- **Content-fingerprint dedupe** (`getRoadmapIdentityKey`) collapses roadmaps that look identical in the UI (title + period + countries + MoSCoW + type + t-shirt). Survivor id is the lowest anchor id; do not rely on duplicate rows persisting after cloud sync.
- `WorkspaceMerge` deduplicates profiles with the same normalized name — avoid duplicate profile names in shared workspaces.
- **Revision conflicts:** client must send `expectedRevision`; stale revision triggers 409 — client auto-merges and retries; do not bypass revision checks in custom integrations.
- MongoDB document size limit (~16 MB) still applies; very large portfolios require export/archive.

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
- Only that profile may see the **Super admin** toggle (`#superAdminModeToggle`). Other profiles must never show the toggle, even if team is labeled **Super Admin** — team label alone does **not** grant access.
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

---

## 8. BYOK and LLM analysis guardrails

### 8.1 BYOK (Bring Your Own Key)

- API keys (Groq, Tavily) are **user-supplied** and stored **only** in browser `localStorage` under `pm_byok_v1`, encrypted with AES-GCM + PBKDF2 (device salt).
- Keys are **never** written to workspace export JSON, MongoDB, or server environment variables.
- Validation endpoints (`/api/byok/validate-*`) receive the key **only** during an explicit user save/validate action; do not log keys.
- Clearing site data or uninstalling the browser profile **deletes** BYOK keys — users must re-enter them.
- Do not add server-side storage of user API keys without a new security review and PRD amendment.

### 8.2 LLM roadmap analysis

- Requires **both** Groq and Tavily keys configured via BYOK.
- Tavily may fetch roadmap **links** and run limited web search; outbound calls go directly from the browser to Tavily/Groq (not through MongoDB).
- Generated summaries are **session-only** in the roadmap modal — not persisted on the roadmap object or synced to cloud.
- Outputs are **planning assistance**, not authoritative product decisions; users must review before sharing externally.
- Respect provider rate limits (`GROQ_TPM_LIMIT`, `TAVILY_MIN_GAP_MS` in `roadmap-llm-summary.js`); surface user-friendly retry messages.
- Do not send profile passwords, BYOK ciphertext, or `PM_API_SECRET` in LLM prompts.

### 8.3 Five Why Framework

- Requires **both** Groq and Tavily keys (same BYOK store as FR-2.12); shares rate-limit constants pattern with `roadmap-llm-summary.js`.
- **View-only** roadmap modal section — not available in create/edit modes.
- Generates **questions only** (WHY 1→5); must not answer, assume, or invent facts not present in saved roadmap fields.
- Each level uses a DMAIC-aligned lens (Define → Measure → Analyze → Improve → Control) mapped to plain-English labels in `WHY_LEVEL_LENS`.
- Output is **session-only** (`roadmapFiveWhyGenerated`); not persisted on roadmap entity, export JSON, or MongoDB.
- Independent pipeline from LLM Summary — only shares BYOK keys and Tavily/Groq clients; do not merge session state between modules.
- Redundancy detection retries up to `FIVE_WHY_REDUNDANCY_RETRY_ATTEMPTS` before fallback question; surface errors via `#roadmapFiveWhyStatus`.

### 8.4 CSP and deployment

- `vercel.json` `connect-src` must include `https://api.groq.com` and `https://api.tavily.com` when BYOK features ship.
- After CSP changes, verify LLM summary and Five Why generation on production per [DEPLOYMENT.md](DEPLOYMENT.md).
