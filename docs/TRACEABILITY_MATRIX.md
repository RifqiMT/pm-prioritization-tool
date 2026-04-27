# Enterprise Traceability Matrix

| Requirement ID | Requirement Summary | Code Evidence | Verification |
|---|---|---|---|
| FR-1 | Profile and project CRUD | `src/app.js`, `index.html` modal/forms | Create/edit/view/delete flows |
| FR-2 | RICE scoring and validation | `src/rice.js`, `src/app.js` render logic | Validate boundaries and score output |
| FR-3 | Multiple financial frameworks | `src/app.js` framework constants, compute/sanitize functions, `index.html` framework fields | Switch frameworks and verify computed impact |
| FR-4 | Table/Board/MOSCOW/Map views + advanced filtering | `index.html` view containers and filter controls, `src/app.js` renderers + `applyFilters` | Cross-view consistency + framework filter validation |
| FR-5 | Framework icon column in table | `index.html` Framework header, `src/app.js` framework icon rendering, `css/main.css` framework data selectors | Confirm icon + tooltip behavior and sorting |
| FR-6 | Modal metadata footer grouping | `index.html` metadata footer blocks, `src/app.js` modal metadata setters (`projectMetaId`, `projectMetaRice`, etc.) | Verify Project ID left, RICE with financial block right |
| FR-7 | Data portability | `src/app.js` import/export handlers | JSON/CSV round-trip |
| FR-8 | Tooltip standardization and exclusivity | `src/app.js` tooltip orchestration (`ensureProjectFormFieldTooltips`, `hideAllTooltipsExcept`, `activeTooltipWrap`) | Verify one-tooltip-at-a-time and full modal field coverage |
| FR-9 | RICE tooltip explainability improvement | `src/app.js` tooltip lines (abbreviation + formula + calc) | Hover/focus tooltip inspection |
| FR-10 | Spinner removal for number inputs | `css/main.css` number input appearance rules, `src/app.js` wheel-prevent logic | Verify no spinner and no accidental wheel increment |
| FR-11 | Guarded destructive actions | `src/app.js` delete confirmation modal flows | Confirm prompt before delete |

## Traceability Governance

- Add/update a row whenever behavior changes.
- Keep requirement IDs synchronized with `docs/PRD.md`.
- Do not close release readiness without matrix verification pass.
