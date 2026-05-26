# Changelog

All notable changes to the Product Management Prioritization Tool are recorded here.

**Product:** Product Management Prioritization Tool  
**Documentation owner:** Product Team  
**Format:** [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) (adapted)

---

## How to read this file

| Field | Meaning |
|-------|---------|
| **Date** | When the change landed in the repository (YYYY-MM-DD). |
| **Author** | **Product Team** unless a specific contributor is named. |
| **Area** | Product, UI, Security, Data, Docs, Infra. |
| **Impact** | User-visible, developer, or documentation-only. |

When updating this file after a change:

1. Add entries under `[Unreleased]` during development.
2. On release, move `[Unreleased]` into a dated version section (e.g. `[2.0.0] - 2026-05-26`).
3. Cross-link PRD, user stories, and traceability matrix when behavior changes.

---

## [Unreleased]

### Deploy — Vercel protection + diagnostics — Product Team — Impact: user-visible

- Detect Vercel Deployment Protection (401 on `/api`) and show setup banner.
- Add `scripts/disable-vercel-deployment-protection.sh` and Step 0 in `VERCEL_MONGODB_FIX.md`.

### Data — MongoDB persistence on Vercel — Product Team — Impact: user-visible

- Added `/api/health` and `/api/state` serverless routes with MongoDB Atlas storage.
- Frontend `AppStorage` module: loads/saves workspace to cloud when `MONGODB_URI` is configured; migrates existing `localStorage` data on first connect.
- Header storage status, **Cloud** action, and connect modal for `PM_API_SECRET`.
- See [DEPLOYMENT.md](DEPLOYMENT.md) for required Vercel environment variables.

---

## [2.0.0] - 2026-05-26

Major release: local-first portfolio workspace with profile security, modern responsive UI, export password gate, and full product documentation suite.

### Documentation — 2026-05-26 — Product Team — Docs — Impact: internal + delivery

- Re-audited codebase and published enterprise documentation suite:
  - `README.md`, `PRODUCT_DOCUMENTATION_STANDARD.md`, `docs/README.md`
  - `docs/PRD.md`, `docs/USER_PERSONAS.md`, `docs/personas/*`
  - `docs/USER_STORIES.md` (Given/When/Then acceptance criteria)
  - `docs/VARIABLES.md` (formulas + Mermaid relationship charts)
  - `docs/METRICS_AND_OKRS.md`, `docs/DESIGN_GUIDELINES.md`
  - `docs/ARCHITECTURE.md`, `docs/TECH_GUIDELINES.md`, `docs/BUSINESS_GUIDELINES.md`
  - `docs/TRACEABILITY_MATRIX.md`, `docs/GUARDRAILS.md`, `docs/DEPLOYMENT.md`
  - `docs/CHANGELOG.md` (this file; author label **Product Team**)

### UI — Export & import modals — 2026-05-26 — Product Team — Impact: user-visible

- **Import data** dialog aligned with **Export data**: shared header, card-style JSON/CSV picker, cream palette, mobile-friendly layout.
- Shared `data-transfer-*` styles; import includes **merge, not replace** callout.
- Dynamic subtitles show workspace counts; export flow notes when protected profiles need passwords.
- Removed legacy dark modal background override for export/import panels.

### UI — Export modals — 2026-05-26 — Product Team — Impact: user-visible

- **Unlock for export** and **Export data** redesigned: profile-style header, scrollable body, per-profile unlock cards (avatar, password, eye toggle).
- Format chooser uses descriptive JSON/CSV option cards instead of legacy outline buttons.
- Footer actions stack on phone; primary/ghost buttons match profile modal patterns.

### Security — Export password gate — 2026-05-26 — Product Team — Impact: user-visible + security

- JSON and CSV exports include only profiles **without a password** or **unlocked with the correct password** (session unlock or export dialog verification).
- Profiles with **missing or incorrect** passwords are **omitted** from the export file; toast summarizes skipped profiles.
- Export unlock dialog uses the same **show/hide password** eye toggle as profile modals.

### UI — Locked profile banner — 2026-05-26 — Product Team — Impact: user-visible

- Removed redundant **Use unlock dialog** from the locked banner; single inline password + **Unlock** flow.
- Modal unlock remains for view/edit actions from profile list.

### UI — Profile & toolbar controls — 2026-05-26 — Product Team — Impact: user-visible

- Password **show/hide** buttons: neutral icon style, no layout jump on hover/click.
- **Remove password** switch: static checkbox (no sliding thumb).
- Map metric pills and RICE sort toggle: calmer active state without sliding animations.

### UI — Map “Show by” metric — 2026-05-26 — Product Team — Impact: user-visible

- Replaced dropdown with **segmented pill control** (Count / RICE / EUR).
- Touch-friendly; keyboard navigable (`radiogroup` + arrow keys); compact on phone.

### UI — Board status column filters — 2026-05-26 — Product Team — Impact: user-visible

- Board toolbar status pills are **toggle buttons** to show/hide columns.
- Active pills use status colors; hidden pills appear muted with strikethrough.
- **Show all** when any column is hidden; at least one column must remain visible.
- Preference persists in `localStorage` as `boardHiddenStatuses`.

### UI — View toolbars — 2026-05-26 — Product Team — Impact: user-visible

- Unified `view-toolbar` for Table, Board, MoSCoW, and Map.
- Fixed legacy `main.css` flex-end collapse on table/map toolbars (title left, controls right via CSS grid).

### UI — Profile modals — 2026-05-26 — Product Team — Impact: user-visible

- Revamped **Edit profile** and **Unlock profile** modals: light sheet, sticky footer, security section, mobile bottom-sheet behavior.

### UI — Profiles, portfolio, header, workspace — 2026-05-26 — Product Team — Impact: user-visible

- Profiles v2 cards, portfolio command bar, collapsible filters, FAB on mobile.
- Header actions menu on phones; modern ghost toolbar on tablet/desktop.
- `workspace-modern.css`, `header-modern.css`, `profiles-modern.css`, `portfolio-modern.css`, `profile-modals-modern.css`, `export-modals-modern.css`, `view-toolbars-modern.css`.

### Security — Profile passwords — 2026-05-26 — Product Team — Impact: user-visible + security

- `profile-security.js`: PBKDF2-SHA256 password hashing; never store plaintext passwords.
- `loadState()` persists `passwordSalt` / `passwordHash` after refresh.
- Board, MoSCoW, and Map no longer leak project data when profile is locked.
- Session unlock resets on tab close/refresh; inline unlock on locked banner.
- Delete protected profile requires correct password.

### Data — Import / export — 2026-05-26 — Product Team — Impact: user-visible

- JSON export includes workspace preferences; CSV is flat project rows.
- Import merges profiles/projects by ID without duplicate corruption for same IDs.

### Product — Explainability & filters — 2026-05-26 — Product Team — Impact: user-visible

- Single visible tooltip app-wide; standardized modal field tooltips.
- RICE tooltip: abbreviations, formula, calculation line.
- Table **Framework** column + advanced **Framework** filter naming.
- Project modal footer: Project ID, timestamps, RICE, financial/EUR context.
- Board/MoSCoW card tooltips: status + description.

### Infra — Vercel deployment — 2026-05-26 — Product Team — Impact: developer + ops

- `vercel.json`: static deploy, security headers (CSP), asset caching.
- `package.json`, `.gitignore`, `.vercelignore`; `docs/DEPLOYMENT.md` smoke tests.

---

## [1.x] — Prior baseline (pre-2.0.0 UI refresh)

Earlier iterations introduced core RICE scoring, multi-view planning (table/board/MoSCoW/map), financial frameworks, and JSON/CSV portability. Detailed history before 2026-05-26 was consolidated into **2.0.0** during the documentation audit.

For archaeology, refer to git history on `main` and agent transcripts cited in project README.

---

## Versioning policy

- **MAJOR** (e.g. 3.0.0): breaking changes to stored data format or incompatible import/export.
- **MINOR** (e.g. 2.1.0): new features, backward-compatible persistence.
- **PATCH** (e.g. 2.0.1): bug fixes and UI polish without new capabilities.

---

## Related documents

- [PRD.md](PRD.md) — requirements baseline for 2.0.0  
- [TRACEABILITY_MATRIX.md](TRACEABILITY_MATRIX.md) — requirement → code mapping  
- [README.md](../README.md) — product overview and quick start
