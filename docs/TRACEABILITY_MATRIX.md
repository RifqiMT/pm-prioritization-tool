# Enterprise Traceability Matrix

> Cross-feature logic and constraints: [FEATURE_LOGIC_AND_CONSTRAINTS.md](FEATURE_LOGIC_AND_CONSTRAINTS.md)

**Purpose:** Map PRD requirements to concrete implementation evidence and verification steps.  
**Standard:** Requirement IDs must remain synchronized with [PRD.md](PRD.md).  
**Last audited:** 2026-06-29 · **Baseline:** `APP_ASSET_VERSION` = `20260629-ui195`

---

## Legend

| Column | Meaning |
|--------|---------|
| **Requirement ID** | Stable ID from PRD |
| **Requirement Summary** | One-line acceptance intent |
| **Code Evidence** | Primary files and handlers |
| **Verification** | Manual QA or deterministic checks |

**Privileged workspace mode:** Requirements **FR-10.x** are verified against [GUARDRAILS.md §7](GUARDRAILS.md) (not duplicated in marketing docs).

---

## FR-1 Profiles

| Requirement ID | Requirement Summary | Code Evidence | Verification |
|---|---|---|---|
| FR-1.1 | Create profile (name, optional team) | `index.html` create form; `src/app.js` profile creation; `saveState()` | Create with/without team; profile appears and is activatable |
| FR-1.2 | Edit profile (name/team/password) | Edit modal; `src/app.js` save + `resetProfileEditPasswordFieldTypes()` | Edits persist after refresh; password hash stored |
| FR-1.3 | Delete profile (password if protected) | Delete modal; `markProfileLocked()`; password verify | Wrong password blocks delete; correct password succeeds |
| FR-1.4 | Activate profile | Profile selection; `activeProfileId` + render refresh | Workspace views show active profile roadmaps only (unless FR-10) |
| FR-1.5 | Search profiles | Profiles panel search; `profilesFilterQuery` | Search narrows by name/team |
| FR-1.6 | Optional password on create | `src/modules/profile-security.js` hashing | Locked until unlock; no plaintext in storage |

---

## FR-2 Roadmaps

| Requirement ID | Requirement Summary | Code Evidence | Verification |
|---|---|---|---|
| FR-2.1 | CRUD roadmaps via modal | `index.html` roadmap modal; `src/app.js` create/edit | Create/edit/view; fields persist across views |
| FR-2.2 | RICE input validation | `src/rice.js` `validateRoadmapInput` | Invalid boundaries block save |
| FR-2.3 | Metadata (type, status, MoSCoW, period, countries, t-shirt, labels, links, note) | Roadmap modal + normalization helpers | Fields visible in table/cards/views/filters; note in CSV |
| FR-2.4 | Bulk delete (table) | Selection + bulk delete handlers | Confirm dialog; selection clears after delete |
| FR-2.5 | Roadmap ID in modal footer | Modal footer metadata | ID stable across edits/export |
| FR-2.6 | Modal footer disclosure (compact) | `syncRoadmapModalFooterMetaDetails`; `<details>` in modal footer | ≤1400px collapsed by default; desktop open |
| FR-2.7 | Rich-text descriptions (6 surfaces) | `rich-text-editor.js`; `#roadmapNote`; four RICE fields | Toolbar in edit; hidden in view; HTML sanitized |
| FR-2.8 | Roadmap tasks | Task rows in modal; `normalizeRoadmapTasks`; CSV `roadmapTasks` | Tasks persist after save and cloud reload |
| FR-2.9 | Labels/links cloud persistence | `serializeRoadmapForStorage`; `storage.js` flush; `roadmap-metadata.js` | Labels/links survive prod reload |
| FR-2.10 | RACI assignments | Roadmap modal RACI section; `normalizeRoadmapRaci`; `renderRaciMatrix` | Names persist; Business/Tech filter works |
| FR-2.11 | KANO scores | Roadmap modal KANO section; `renderKanoPortfolioMatrix` | Scores 1–5 place roadmaps on matrix |
| FR-2.14 | Multi-quarter periods | `roadmap-periods.js`; `roadmapPeriods[]` in modal | Periods validate; latest drives status |

---

## FR-3 RICE

| Requirement ID | Requirement Summary | Code Evidence | Verification |
|---|---|---|---|
| FR-3.1 | Formula `(R × I × C) ÷ E` | `src/rice.js` `calculateRiceScore` | Known inputs → expected score |
| FR-3.2 | Reach ≥ 0 | `src/rice.js` validation | Negative reach rejected |
| FR-3.3 | Impact/Effort 1–5 | `src/rice.js` validation | Out-of-range rejected |
| FR-3.4 | Confidence 0–100 normalization | `src/rice.js` | Percent vs decimal handled |
| FR-3.5 | RICE tooltip explainability | `src/app.js` tooltip render | Formula + calculation line visible |

---

## FR-4 Financial frameworks

| Requirement ID | Requirement Summary | Code Evidence | Verification |
|---|---|---|---|
| FR-4.1 | Custom amount | `computeFrameworkFinancialImpact` | Manual value persists |
| FR-4.2 | CLV | Framework branch in `src/app.js` | Valid CLV inputs compute impact |
| FR-4.3 | NPS | NPS branch + sanitizers | NPS fields → consistent impact |
| FR-4.4 | Risk | Risk branch | Expected loss math |
| FR-4.5 | Headcount | Headcount branch | FTE × loaded cost |
| FR-4.6 | Operational | Operational branch | Unit + cycle savings |
| FR-4.7 | Framework switch clears irrelevant inputs | `sanitizeFinancialImpactInputs` | Switching resets stale keys |
| FR-4.8 | Table framework column + filter | Framework icon column; `filterFinancialFramework` | Filter matches stored framework |

---

## FR-5 Views

| Requirement ID | Requirement Summary | Code Evidence | Verification |
|---|---|---|---|
| FR-5.1 | Desktop sortable table + semantic columns | `table-revamp-modern.css`; `renderRoadmaps` table branch | Columns align; sort works; bulk select in toolbar |
| FR-5.2 | Compact table card list + FAB + selection bar | `table-compact-cards.css`; `buildRoadmapTableCard`; `#portfolioFab` | ≤1400px: cards not wide grid; FAB creates roadmap; selection bar on multi-select |
| FR-5.2.1 | Group-by control | `#tableGroupBySelect`; `TABLE_GROUP_BY_OPTIONS` | All options listed |
| FR-5.2.2 | Persist `tableGroupBy` | `state.tableGroupBy`; `saveState()` | Preference survives refresh |
| FR-5.2.3 | Group summary live region | `#tableGroupBySummary` | Announces group + count |
| FR-5.2.4 | Group-by dimensions | `renderTableCompactGrouped` | Status, MoSCoW, type, currency, etc. group correctly |
| FR-5.3 | Board status columns + DnD + RICE sort + card chrome | `renderScrumBoard`; `board-compact.css`; `portfolio-cards-compact.css` | DnD updates status; compact **Move to**; actions on one row (desktop) |
| FR-5.4 | MoSCoW 2×2 + display names + header row | `moscowDisplayNames`; `getMoscowDisplayName()`; `moscow-compact.css` | Headers show **Must Have** etc.; badge + description one row |
| FR-5.5 | Map metrics | `renderRoadmapsMap`; metric pills | Count/RICE/financial switch updates legend |
| FR-5.6 | RACI matrix | `renderRaciMatrix`; `#roadmapsRaciView`; `raciMatrixDomain` | Desktop matrix; compact cards; domain toggle |
| FR-5.7 | KANO portfolio | `renderKanoPortfolioMatrix`; `portfolio-kano-modern.css`; `kanoPortfolioPanel` | Positioned/unpositioned panels; drag on desktop |
| FR-5.8 | Fullscreen all views | `src/modules/fullscreen.js`; `fullscreen-compact.css` | Fullscreen preserves compact layout |
| FR-5.9 | Locked profile blocks data | `getUnlockedActiveProfile()`; view guards | No roadmap leakage when locked |
| FR-5.10 | Compact layout ≤1400px | `COMPACT_LAYOUT_MAX_WIDTH_PX`; `initCompactLayoutClass()` | At 1024px and 375px: compact classes; no horizontal board/MoSCoW scroll |
| US-R1 / US-R2 | RACI stories | `renderRaciMatrix`; roadmap modal RACI section | Epic R acceptance |
| US-S1 / US-S2 | KANO stories | `renderKanoPortfolioMatrix`; `portfolio-kano-modern.css` | Epic S acceptance |

---

## FR-6 Filters

| Requirement ID | Requirement Summary | Code Evidence | Verification |
|---|---|---|---|
| FR-6 | Filters apply to all views | `applyFilters`; `getPortfolioRoadmapsBaseList` | Table/board/MoSCoW/map/RACI/KANO share filtered set |
| FR-6.1.1 | Title substring filter | `filterTitle` | Typing narrows roadmaps |
| FR-6.1.2 | Title autocomplete | Title listbox in filters drawer | Keyboard navigation; max suggestions |
| FR-6.1.3 | Label substring filter | `filterLabel` | Matches any label on roadmap |
| FR-6.1.4 | Label autocomplete | Label listbox | Same UX as title |
| FR-6.2 | Quick filters | Type, countries, period controls | Combined with search |
| FR-6.3 | Advanced filters | Impact, effort, currency, framework, status, t-shirt, MoSCoW, financial range | Each constraint works independently |
| FR-6.4 | Labels presence filter | `filterLabels` with/without | With/without/any behaviors |
| FR-6.5 | Links presence filter | `filterLinks` with/without | With/without/any behaviors |
| FR-6.6 | Active filter summary pill | Filter summary renderer | Pill lists labels/links filters |
| FR-6.7 | Compact filters sheet | `#portfolioFiltersSheet`; `filters-sheet-modern.css`; mobile command deck | At ≤1400px: sheet opens/closes; filters persist |

---

## FR-7 Exchange rates

| Requirement ID | Requirement Summary | Code Evidence | Verification |
|---|---|---|---|
| FR-7 | FX refresh + EUR display | `src/modules/exchange-rates.js`; `exchangeRatesToEUR` in state | Refresh updates rates; table/map/profile EUR labels; missing rate shows fallback message |

---

## FR-8 Export / import

| Requirement ID | Requirement Summary | Code Evidence | Verification |
|---|---|---|---|
| FR-8.1 | Export JSON | `export-payload.js` `buildJsonExportDocument`; `sanitizeProfilesForExport` | Download; protected profiles omitted without unlock |
| FR-8.2 | Export CSV | `export-payload.js` `CSV_COLUMN_IDS`; `*ExtraData` round-trip columns | One row per roadmap; full metadata columns |
| FR-8.3 | Export password gate | Export unlock modal | Wrong password omits profile |
| FR-8.4 | Import JSON merge | `handleImportJsonFile`; `mergeImportedProfiles` | Update by id; no duplicates |
| FR-8.5 | Import CSV merge | `handleImportCsvFile` | Rows merge safely |
| FR-8.6 | Import/export modal parity | `export-modals-modern.css` | Shared cards + responsive footer |

---

## FR-9 UX / accessibility

| Requirement ID | Requirement Summary | Code Evidence | Verification |
|---|---|---|---|
| FR-9.1 | Single visible tooltip | `activeTooltipWrap`; `hideAllTooltipsExcept` | Only one tooltip open |
| FR-9.2 | Modal field tooltips | `ensureRoadmapFormFieldTooltips` | All roadmap modal fields covered |
| FR-9.3 | Responsive ≤1400px phone UI | `compact-modern.css`; `initCompactLayoutClass` | Icon tabs; FAB; compact toolbars |
| FR-9.4 | Password show/hide | `bindProfilePasswordToggles` | Eye toggle on all password fields |
| FR-9.5 | Delete confirmations | Delete modals | Destructive actions require confirm |
| FR-9.6 | Site footer links | `index.html` `.app-site-footer`; `app-footer.css` | LinkedIn, website, GitHub, article open correctly |
| FR-9.7 | Card visual + action parity | `portfolio-cards-compact.css`; `roadmap-actions-modern.css` | 12px radius; single action row on desktop board/MoSCoW |

---

## FR-2.12 / FR-2.13 Optional AI (session-only)

| Requirement ID | Requirement Summary | Code Evidence | Verification |
|---|---|---|---|
| FR-2.12 | LLM roadmap analysis | `roadmap-llm-summary.js`; Summary section in roadmap modal | Tavily + Groq; three paragraphs; session-only |
| FR-2.13 | 5 Why Framework | `roadmap-5why-framework.js`; `#roadmapModalSectionFiveWhy` (view-only) | WHY 1→5 questions; session-only |
| US-U1 | LLM summary story | `RoadmapLlmSummary.generate` | Epic U acceptance |
| US-V1 | Five Why story | `RoadmapFiveWhyFramework.generateNextWhy` | Epic V acceptance |

---

## FR-11 BYOK API keys

| Requirement ID | Requirement Summary | Code Evidence | Verification |
|---|---|---|---|
| FR-11.1 | Store Groq + Tavily locally | `byok-api-keys.js`; `pm_byok_v1` | Encrypted envelope in localStorage |
| FR-11.2 | Validate on save | `api/byok/validate-groq.js`; `validate-tavily.js` | Invalid keys rejected with message |
| FR-11.3 | Never sync to cloud | Export + `serialize` paths | Keys absent from MongoDB/export |
| FR-11.4 | Header affordance | `#byokApiKeysBtn`; status dot | Configured count visible |
| FR-11.5 | CSP allows providers | `vercel.json` connect-src | Groq/Tavily reachable in production |
| US-T1 | BYOK configuration story | `ByokApiKeys` modal workflow | Epic T acceptance |

---

## FR-10 Privileged workspace mode

| Requirement ID | Requirement Summary | Code Evidence | Verification |
|---|---|---|---|
| FR-10.1 | Activation rules | `src/constants.js` trust label; toggle handlers — **see GUARDRAILS §7** | Only trust profile sees toggle; requires unlock |
| FR-10.2 | Read scope all roadmaps | `getPortfolioRoadmapsBaseList` when mode on | All profiles’ roadmaps visible with owner metadata |
| FR-10.3 | Write scope to owner profile | Save paths attach `ownerProfileId` | Edit persists to owning profile |
| FR-10.4 | Table owner column + filter + group-by | Profile column; `filterOwnerProfile`; owner group-by | Only when mode active |
| FR-10.5 | Owner stripes on cards | `buildPortfolioCardOwnerStrip`; `prependPortfolioCardOwnerStrip` | Table compact, board, MoSCoW show owner stripe |
| FR-10.6 | Deactivation restores scope | Toggle off → re-render | Single-profile scope immediately |
| FR-10.7 | Bulk duplicate / move | `handleBulkRoadmapTransfer`; `roadmapBulkTransferModal` | Duplicate copies to target profile; move re-homes roadmaps |

---

## Traceability governance

1. Add or update a row when PRD IDs change — **PRD is the requirement source of truth**.  
2. Link code evidence to functions that actually implement the behavior (grep before claiming).  
3. Run verification at **375px**, **1024px**, and **>1400px** for layout-related rows.  
4. Do not mark release-ready without passing FR-10 checks in GUARDRAILS §7 when that feature ships.  
5. Changelog entries must not name privileged mode in titles (see GUARDRAILS §5).

---

## Related documents

- [PRD.md](PRD.md) — requirement definitions  
- [USER_STORIES.md](USER_STORIES.md) — acceptance narratives  
- [GUARDRAILS.md](GUARDRAILS.md) — §7 privileged workspace policy  
- [CHANGELOG.md](CHANGELOG.md) — release history  
