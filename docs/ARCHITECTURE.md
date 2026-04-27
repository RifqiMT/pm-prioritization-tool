# Architecture Overview

## 1. Runtime Model

- Local-first browser application
- No backend dependency for core workflow
- State persisted in browser storage

## 2. Current Audited Source Topology

Runtime-audited files in this repository snapshot:

- `index.html`
- `css/main.css`
- `src/app.js`
- `src/rice.js`

Referenced script contracts in `index.html` that are not present in this snapshot:

- `src/constants.js`
- `src/utils.js`
- `src/modules/exchange-rates.js`
- `src/modules/fullscreen.js`

These are treated as runtime contracts and documented accordingly.

## 3. Core Architectural Responsibilities

### `index.html`
- App shell and primary UI structure
- Table/board/moscow/map view containers
- Modal scaffolding and form controls

### `css/main.css`
- Component and layout styling
- Tooltip behavior and icon-pill visual semantics
- View responsiveness and table usability constraints

### `src/rice.js`
- RICE calculation and input validation boundary logic

### `src/app.js`
- State lifecycle, event wiring, rendering, CRUD
- Framework compute pipelines
- Sorting/filtering/map aggregation
- Tooltip orchestration
- Import/export behavior
- Modal field tooltip auto-completion and standardized copy injection

## 4. Key Data Flow

1. User updates form/view controls.
2. `app.js` validates and normalizes inputs.
3. Computed outputs (RICE/financial) update UI.
4. State is persisted and re-rendered by active view.

## 5. Financial Framework Pipeline

- Selector chooses active framework
- Input sanitization limits fields by framework
- Framework-specific compute function derives impact
- Output feeds table and map financial displays
- Framework icon column surfaces model identity in table

## 6. Tooltip Architecture

- Unified class-driven tooltip system across heterogeneous cells
- Shared hover/focus selectors for icon/text wrappers
- Specialized wrappers for cells like financial and rice score
- Single-tooltip governance through active wrapper tracking and global hide-except behavior
- Cursor-anchored title tooltip positioning on cards for perceived alignment quality

## 7. Filtering Architecture

- Quick filters (title/type/countries/period) + advanced filters (impact/effort/currency/framework/status/size/MOSCOW)
- Framework filter compares normalized framework value to selected advanced filter option
- Active-filter pill summarizes currently engaged filter dimensions

## 8. Architectural Risks

- Missing module source files can create documentation/runtime drift
- Additional columns in dense table layouts can reduce readability
- Formula UX can be misunderstood without explanatory tooltip content
- Complex tooltip lifecycles can regress into duplicate visible overlays without centralized policy

## 9. Mitigations

- Keep docs tied to audited code snapshot
- Use concise column labels and icon-based semantics
- Enforce explainable tooltip standards for derived metrics
- Enforce single-tooltip policy in shared tooltip orchestration path
