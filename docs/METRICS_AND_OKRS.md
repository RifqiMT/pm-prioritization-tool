# Product Metrics and OKRs

## 1. Product Metrics

| Metric ID | Metric | Definition | Formula | Target |
|---|---|---|---|---|
| PM-01 | Prioritization Completeness | Projects with valid RICE and category metadata. | `valid_prioritized_projects / total_projects` | >= 90% |
| PM-02 | Framework Adoption | Projects using non-custom financial frameworks. | `non_custom_framework_projects / total_projects` | >= 50% |
| PM-03 | Workflow Throughput | Net projects processed per planning cycle. | `created + updated + status_moved` | +20% QoQ |
| PM-04 | Map Utility | Usage of map for review sessions. | `map_view_sessions / total_sessions` | >= 25% |
| PM-05 | Export Reliability | Successful exports over attempts. | `successful_exports / export_attempts` | >= 99% |

## 2. UX and Quality Metrics

| Metric ID | Metric | Definition | Formula | Target |
|---|---|---|---|---|
| UX-01 | RICE Explainability Usage | Use of RICE tooltip interactions. | `rice_tooltip_interactions / table_sessions` | Upward trend |
| UX-02 | Validation Friction | Validation errors per submit. | `validation_errors / submit_attempts` | <= 0.3 |
| UX-03 | Table Scanability | Header-overflow defects in key columns. | QA defect count | 0 critical |
| UX-04 | Time-to-Decision | Time from project open to saved prioritization. | median interaction time | Downward trend |
| UX-05 | Tooltip Exclusivity Reliability | Cases where multiple tooltips overlap simultaneously. | `multi_tooltip_incidents / tooltip_sessions` | 0 |
| UX-06 | Modal Guidance Coverage | Share of modal input/select/textarea fields with standardized tooltip. | `fields_with_standard_tooltip / total_modal_fields` | 100% |

## 3. Engineering Metrics

| Metric ID | Metric | Definition | Formula | Target |
|---|---|---|---|---|
| ENG-01 | Runtime Error Rate | Sessions with uncaught runtime errors. | `error_sessions / total_sessions` | <= 0.5% |
| ENG-02 | Persistence Reliability | Save/load failures. | `storage_failures / storage_ops` | <= 0.1% |
| ENG-03 | Import Integrity | Import runs without duplicate corruption. | `clean_imports / import_attempts` | >= 99% |
| ENG-04 | Render Responsiveness | Time to table rerender after filter/sort. | p95 interaction latency | <= 300ms |

## 4. OKR Framework

### Objective 1 — Improve prioritization trust
- KR1.1: Raise PM-01 to >= 95%
- KR1.2: Reduce UX-02 to <= 0.2
- KR1.3: Increase UX-01 interaction rate by 30%
- KR1.4: Keep UX-05 at 0 across regression test cycles

### Objective 2 — Strengthen financial planning discipline
- KR2.1: Raise PM-02 to >= 65%
- KR2.2: Maintain EUR display accuracy defect count at 0 high severity

### Objective 3 — Maintain reliability at scale
- KR3.1: Keep ENG-01 <= 0.5%
- KR3.2: Keep ENG-03 >= 99%
- KR3.3: Keep ENG-04 p95 <= 300ms
- KR3.4: Keep modal guidance coverage (UX-06) at 100%

## 5. Review Cadence

- Weekly: ENG metrics
- Bi-weekly: UX metrics
- Monthly: product metrics and OKR health
- Quarterly: target recalibration

---

## 6. Measurement Methodology (how to compute & validate)

This app is local-first and does not stream telemetry by default. Metrics must therefore be collected using one of the following approaches:

1. **Instrumented QA runs (preferred):** QA/testers run repeatable scenarios and record results using a lightweight checklist and exported console summaries.
2. **Manual sampling:** PM/QA samples a defined number of sessions and classifies outcomes against rubric definitions below.
3. **Developer debug signals:** during development, engineers can temporarily enable console logging to validate formulas. No passwords or sensitive content must be logged.

### Metric operational definitions

- **Prioritization Completeness (PM-01):** A project counts as “valid” when it has valid RICE boundaries, a valid category/status/MoSCoW selection, and the computed score is finite (not NaN/Infinity).
- **Framework Adoption (PM-02):** A project counts as “non-custom” when `financialImpactFramework` is one of `clv`, `nps`, `risk`, `headcount`, or `operational`.
- **Workflow Throughput (PM-03):** Count `created`, `updated`, and `status_moved` within the selected planning cycle window. Define “status moved” as a change to `projectStatus` that results in a visible board column change.
- **Map Utility (PM-04):** A “map view session” counts when the user navigates to Map view and successfully renders at least one geography layer (or shows the defined empty/error state).
- **Export Reliability (PM-05):** An “export attempt” is a click on Export JSON/CSV. A “successful export” is a completed download start event (anchor click) without errors.

### UX / Quality metric collection

- **RICE Explainability Usage (UX-01):** Count tooltip open interactions on RICE score surfaces (table tooltip or board tooltip contexts) divided by number of table sessions sampled.
- **Validation Friction (UX-02):** Count distinct validation errors shown to the user during a single submit flow (project save actions), divided by total submit attempts sampled.
- **Tooltip Exclusivity Reliability (UX-05):** A “multi-tooltip incident” is any moment where more than one tooltip is visible concurrently. For manual QA, record a failure when two tooltips overlap in the viewport at the same time.
- **Modal Guidance Coverage (UX-06):** “Field with standardized tooltip” means the field has tooltip markup or receives fallback injection through standardized tooltip logic.

### Engineering metric collection

- **Runtime Error Rate (ENG-01):** Count sessions with uncaught runtime errors observed in console during a test script.
- **Persistence Reliability (ENG-02):** Count failures where save/load does not persist expected fields after refresh.
- **Import Integrity (ENG-03):** “Clean import” means import completes without duplicated corruption. A corruption case includes duplicated project IDs when merge logic should match by ID.
- **Render Responsiveness (ENG-04):** Measure rerender latency from filter/sort action trigger to final visible table render. Target p95 ≤ 300ms on a typical development laptop.

---

## 7. OKR Review Template (weekly/monthly)

When reviewing metrics:
1. Identify the **top 1–2 regressions** by target distance (current vs target).
2. Link the regression to a **likely code surface** (render pipeline, validation, export/import, or tooltip orchestration).
3. Record an actionable follow-up:
   - “add guardrail”
   - “add UI fallback”
   - “improve sanitization”
4. Update `docs/CHANGELOG.md` once a fix is user-visible or affects delivery readiness.
