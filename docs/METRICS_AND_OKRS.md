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

### Objective 2 — Strengthen financial planning discipline
- KR2.1: Raise PM-02 to >= 65%
- KR2.2: Maintain EUR display accuracy defect count at 0 high severity

### Objective 3 — Maintain reliability at scale
- KR3.1: Keep ENG-01 <= 0.5%
- KR3.2: Keep ENG-03 >= 99%
- KR3.3: Keep ENG-04 p95 <= 300ms

## 5. Review Cadence

- Weekly: ENG metrics
- Bi-weekly: UX metrics
- Monthly: product metrics and OKR health
- Quarterly: target recalibration
