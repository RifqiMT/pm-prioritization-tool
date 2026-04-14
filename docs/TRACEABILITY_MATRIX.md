# Enterprise Traceability Matrix

This matrix maps product requirements to implementation artifacts and validation paths.

## Legend

- **Req ID**: Requirement ID from `PRD.md`.
- **Code Evidence**: Key source files implementing requirement.
- **Verification**: How requirement can be validated.

---

| Req ID | Requirement Summary | Code Evidence | Verification |
|---|---|---|---|
| FR-P1 | Create profile with required name and optional team | `src/app.js` (`addProfile`, form submit handlers), `index.html` (`addProfileForm`) | Create profile with/without team; verify appears in list |
| FR-P2 | Switch active profile and scoped rendering | `src/app.js` (`setActiveProfile`, `renderProjects`, filters) | Switch profiles and verify data isolation |
| FR-P3 | View profile details read-only modal | `src/app.js` (profile view modal handlers), `index.html` modals | Open View and confirm no edit controls |
| FR-P4 | Edit profile fields | `src/app.js` (profile edit flow), modal controls | Update name/team and verify persistence |
| FR-P5 | Delete profile with confirmation | `src/app.js` (delete modal + confirm), `index.html` delete modal | Delete profile and verify projects removed |
| FR-J1 | Create project with required fields | `src/app.js` (project modal + submit), `src/rice.js` validation | Add project valid payload; appears in all views |
| FR-J2 | Edit project | `src/app.js` project edit/open handlers | Edit any field and verify updated timestamps |
| FR-J3 | View project read-only | `src/app.js` view modal flow | Open View and verify immutability |
| FR-J4 | Delete single project | `src/app.js` delete flow | Delete from table/card; confirm removal |
| FR-J5 | Bulk delete selected projects | `src/app.js` bulk delete handlers | Select multiple rows then delete |
| FR-R1 | Enforce RICE input bounds | `src/rice.js` `validateProjectInput` | Submit invalid values and verify validation error |
| FR-R2 | Compute and display RICE formula | `src/rice.js` (`calculateRiceScore`, `formatRice`), table/card render in `src/app.js` | Confirm displayed score and calculation tooltip |
| FR-R3 | Optional metadata fields on project | `src/app.js` project schema, form bindings | Set each optional field and verify view/filter behavior |
| FR-E1 | Manual exchange rates refresh | `src/modules/exchange-rates.js` (`refreshManual`) + header button events | Click refresh and verify date/source update |
| FR-E2 | Auto refresh on stale app open | `src/modules/exchange-rates.js` (`ensure`) | Set stale date and reload app |
| FR-E3 | Daily refresh at Berlin midnight | `src/modules/exchange-rates.js` (`scheduleDailyRefresh`) | Validate scheduled refresh behavior |
| FR-E4 | Last updated label (manual/auto) | `src/modules/exchange-rates.js` (`updateLabel`) | Confirm label includes date and source |
| FR-F1 | Multi-dimensional filters | `src/app.js` filter state + handlers; `index.html` filter controls | Apply combinations and verify results |
| FR-F2 | Filters affect all views | `src/app.js` (`applyFilters`, `renderProjects`, board/map render) | Compare filtered table/board/moscow/map |
| FR-F3 | Table sorting by supported columns | `src/app.js` sort state + `sortProjects` | Sort on each sortable header |
| FR-V1 | Full table experience with actions/tooltips | `index.html` table structure; `src/app.js` row render logic | Validate columns and row actions |
| FR-V2 | Board view status workflow | `src/app.js` board rendering + drag handlers | Drag cards across statuses |
| FR-V3 | MOSCOW grid workflow | `src/app.js` MOSCOW render + drag handlers | Drag cards across quadrants |
| FR-V4 | Map metric modes | `src/app.js` map aggregation/render | Switch map metric and verify legend |
| FR-V5 | Fullscreen with cross-view switch | `src/modules/fullscreen.js` | Enter fullscreen and switch views |
| FR-X1 | Export JSON/CSV | `src/app.js` export modal + builders | Export both formats and open files |
| FR-X2 | Import JSON/CSV merge logic | `src/app.js` import parser + merge flow; utilities | Import sample data; verify duplicate handling |
| FR-T1 | Structured tooltips not clipped | `src/app.js`, CSS tooltip system, fullscreen portal logic | Trigger tooltips in table/fullscreen/modal |
| FR-T2 | Toast confirmations | `src/app.js` toast helpers | Validate on create/update/delete/import/export |
| NFR-1 | Browser-only runtime | `index.html`, no backend runtime requirement | Open by file/static server |
| NFR-2 | localStorage persistence | `src/constants.js` (`STORAGE_KEY`), `src/app.js` load/save | Reload and verify state preserved |
| NFR-3 | Resilient exchange sources + fallback | `src/modules/exchange-rates.js` | Simulate source failure and verify fallback |
| NFR-4 | Accessibility baseline | `index.html` ARIA labels + keyboard-friendly controls | Keyboard traversal and aria review |
| NFR-5 | Reduced-motion support | `css/main.css` prefers-reduced-motion rules | Enable reduced motion and verify behavior |

---

## Traceability Process Recommendation

1. Every new requirement added to PRD must receive a new `Req ID`.
2. PRs should include matrix update lines for changed/added IDs.
3. Release signoff should include validation evidence for all `Must` requirements.

