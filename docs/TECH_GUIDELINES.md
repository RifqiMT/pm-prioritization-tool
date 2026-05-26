# Technical Guidelines

Engineering standards for the Product Management Prioritization Tool codebase.

---

## 1. Stack summary

| Layer | Technology |
|-------|------------|
| UI | HTML5, CSS3, vanilla JavaScript (no framework) |
| Map | Leaflet 1.9.4 (CDN) |
| Crypto | Web Crypto API (PBKDF2-SHA256) |
| Persistence | `localStorage` (profiles), `sessionStorage` (unlock session) |
| Hosting | Static (Vercel); `vercel.json` CSP and caching |
| Build | None — files served as-is |

---

## 2. Script load order

Defined in `index.html` (order matters — globals, not ES modules):

1. `src/constants.js`
2. `src/utils.js`
3. `src/modules/profile-security.js`
4. `src/rice.js`
5. `src/modules/exchange-rates.js`
6. `src/modules/fullscreen.js`
7. `src/modules/overlay-manager.js`
8. `src/modules/storage.js`
9. `src/app.js` — defines `init()` and runs on `DOMContentLoaded`

All shared symbols are **global functions and constants**. Do not introduce ES module imports without a planned migration.

---

## 3. CSS architecture

Load order (later wins for equal specificity):

1. `main.css` — base tokens, global buttons, legacy modals
2. `workspace-modern.css`
3. `header-modern.css`
4. `profiles-modern.css`
5. `portfolio-modern.css`
6. `profile-modals-modern.css`
7. `export-modals-modern.css`
8. `view-toolbars-modern.css`
9. `compact-modern.css` — compact chrome (≤1024px)
10. `moscow-compact.css`
11. `board-compact.css`
12. `table-compact.css`
13. `fullscreen-compact.css`
14. `app-footer.css`

**Compact layout:** `initCompactLayoutClass()` in `src/app.js` toggles `html.is-compact-layout` / `is-phone-layout` at `max-width: 1024px`. Compact sheets use `html.is-compact-layout` selectors — not separate tablet breakpoints.

**Rule:** Prefer new UI in `*-modern.css` or `*-compact.css` files with scoped selectors. Override `main.css` `!important` globals (red buttons, flex-end toolbars) explicitly when needed.

---

## 4. State management

Central object: `state` in `src/app.js`.

Persisted via `saveState()` → `localStorage` key `rice_prioritizer_v1` (`STORAGE_KEY` in `constants.js`), with optional cloud sync via `src/modules/storage.js` (`AppStorage`).

| Field | Persisted | Notes |
|-------|-----------|-------|
| `profiles` | Yes | Includes `passwordSalt` / `passwordHash` when protected |
| `activeProfileId` | Yes | |
| `sortField`, `sortDirection` | Yes | |
| `projectsView` | Yes | `table\|board\|moscow\|map` |
| `scrumBoardSortByRice`, `moscowSortByRice` | Yes | |
| `boardHiddenStatuses` | Yes | Board column visibility |
| `mapMetric` | Yes | |
| `exchangeRatesToEUR`, `exchangeRatesDate`, `exchangeRatesLastSource` | Yes | |

**Not persisted:** `unlockedProfileIds` (session only, `sessionStorage`).

---

## 5. Security module

`src/modules/profile-security.js` exposes `ProfileSecurity` global:

- `hashProfilePassword`, `verifyProfilePassword`
- `validatePasswordPair`, `generateSalt`
- Never store plaintext passwords

Export gate: `getExportableProfiles()` — only unprotected or session-unlocked profiles; export dialog verifies passwords before file generation.

---

## 6. Financial framework pipeline

1. `normalizeFinancialFramework(val)` — canonical key
2. `sanitizeFinancialImpactInputs(framework, inputs)` — whitelist per framework
3. `computeFrameworkFinancialImpact(framework, inputs, customAmount)` — returns number or null
4. On framework switch in modal, inputs reset to prevent cross-framework leakage

---

## 7. Rendering conventions

- **Single render entry:** `renderProjects()` refreshes table + active view.
- **Locked profiles:** use `getUnlockedActiveProfile()` for any project data surface (table, board, moscow, map).
- **Tooltips:** `hideAllTooltipsExcept`, `activeTooltipWrap` — exactly one visible tooltip.
- **IDs:** `generateId(prefix)` from `utils.js`.

---

## 8. Import / export

| Format | Handler | Merge |
|--------|---------|-------|
| JSON | `handleImportJsonFile` | `mergeImportedProfiles` by profile/project id |
| CSV | `handleImportCsvFile` | Row-based project merge |

Export:

- `getExportableProfiles()` filters protected profiles
- `sanitizeProfilesForExport()` strips unsafe shapes, normalizes financial inputs
- JSON includes workspace preferences; CSV is project-flat only

---

## 9. Error handling

- User-facing: `showToast`, `window.alert` for import failures, inline/modal errors for unlock
- Console: `console.error` with context; never log passwords
- Validation: `validateProjectInput` in `rice.js` before save

---

## 10. Testing expectations (manual)

Minimum smoke path before release:

1. Create profile (with and without password)
2. CRUD project with each financial framework
3. All four views + fullscreen
4. Filter + sort table
5. Board drag order + status column hide
6. Export JSON/CSV with locked profile (verify omission)
7. Import merge JSON
8. Vercel smoke: map tiles, exchange rate refresh (see `DEPLOYMENT.md`)

---

## 11. Performance

- No framework re-render cost; full re-render on state change is acceptable at portfolio sizes typical for local-first use.
- Map: Leaflet layer rebuilt on metric change; avoid unnecessary `renderProjectsMap` calls.
- Target: no perceptible lag &lt; 500 projects per profile on modern laptop.

---

## 12. Dependencies

- **No npm runtime dependencies** for the app itself (`package.json` dev script only).
- CDN: Leaflet, Google Fonts (Inter).

When adding CDN resources, update `vercel.json` CSP `connect-src` / `img-src`.
