# Product Metrics and OKRs

## Scope

This document defines measurable product health, adoption, and operational metrics for the Product Management Prioritization Tool, plus OKR framing for the product team.

---

## 1) North Star and Supporting Metrics

### North Star Metric

- **Prioritized Project Throughput (PPT)**  
  Number of projects per month that are fully prioritized (valid RICE + MOSCOW category + status set) in active profiles.

Formula:

`PPT = count(project where riceScore > 0 AND moscowCategory != null AND projectStatus != null in month)`

---

## 2) Product Metrics

| Metric ID | Metric | Definition | Formula | Suggested Target |
|---|---|---|---|---|
| PM-01 | Active Profile Usage | Profiles with interaction activity in period. | `count(distinct activeProfileId touched)` | >= 5 profiles/month (team-scale baseline) |
| PM-02 | Project Capture Volume | Projects created in period. | `count(project.createdAt in period)` | +15% QoQ |
| PM-03 | Prioritization Completeness | Share of projects with complete required prioritization fields. | `projects_with_valid_RICE / total_projects` | >= 90% |
| PM-04 | MOSCOW Classification Coverage | Share of projects with valid MOSCOW category. | `projects_with_moscow / total_projects` | 100% (default should enforce) |
| PM-05 | Financial Coverage | Share of projects with financial impact entered. | `projects_with_financial / total_projects` | >= 60% (portfolio-dependent) |
| PM-06 | Exchange-Rate Freshness | Percent of sessions with today-valid rates (Berlin date). | `sessions_with_today_rates / total_sessions` | >= 98% |
| PM-07 | Filter-to-Action Efficiency | Median time from filter interaction to project action (view/edit/status move). | `median(t_action - t_filter)` | <= 30 sec |
| PM-08 | View Utility Distribution | Relative usage across Table/Board/MOSCOW/Map. | `view_switch_count by view` | No single view > 80% long-term |
| PM-09 | Import Merge Integrity | Import runs with no duplicate insert and no schema failure. | `successful_imports / total_imports` | >= 99% |
| PM-10 | Data Ownership Reliability | Export success rate. | `successful_exports / total_exports` | >= 99.5% |

---

## 3) UX and Quality Metrics

| Metric ID | Metric | Definition | Formula | Suggested Target |
|---|---|---|---|---|
| UX-01 | Task Completion: Add Project | Users complete add-project flow without validation error loops. | `completed_adds / add_starts` | >= 95% |
| UX-02 | Validation Friction | Avg validation errors per add/edit attempt. | `validation_error_count / form_submissions` | <= 0.3 |
| UX-03 | Readability Accessibility Proxy | Share of sessions using default zoom without manual override in core screens. | observed analytics proxy | >= 90% |
| UX-04 | Action Misclick Proxy | Undo-like corrective actions after delete prompt cancel/confirm mismatch proxy. | custom interaction heuristic | <= 2% |
| UX-05 | Fullscreen Presentation Use | Fullscreen invocations per planning session. | `fullscreen_toggle_count / sessions` | Baseline then +20% for planning teams |

---

## 4) Engineering/Operational Metrics

| Metric ID | Metric | Definition | Formula | Suggested Target |
|---|---|---|---|---|
| ENG-01 | Runtime Error Rate | JS runtime errors per session. | `errors / sessions` | <= 0.5% |
| ENG-02 | Local Persistence Reliability | Failed state save/read events. | `storage_failures / state_ops` | <= 0.1% |
| ENG-03 | Exchange ETL Success | Successful ETL refresh operations. | `successful_refreshes / total_refreshes` | >= 98% |
| ENG-04 | Render Latency (Table) | Time to render table after filter/sort change. | `t_render_complete - t_action` | p95 <= 300ms |
| ENG-05 | Import Parse Failure Rate | Failed import due to malformed JSON/CSV. | `parse_failures / total_imports` | <= 1% |

---

## 5) OKRs (Product Team)

### Objective 1: Improve prioritization quality and decision confidence

- **KR1.1** Raise Prioritization Completeness (PM-03) to >= 95%.
- **KR1.2** Raise MOSCOW Coverage (PM-04) to 100% sustained.
- **KR1.3** Reduce validation friction (UX-02) to <= 0.2.

### Objective 2: Increase planning workflow efficiency

- **KR2.1** Reduce Filter-to-Action median time (PM-07) to <= 20 sec.
- **KR2.2** Increase board and MOSCOW usage share (PM-08) by 25% combined.
- **KR2.3** Maintain table render latency p95 <= 250ms (ENG-04).

### Objective 3: Strengthen reliability and data trust

- **KR3.1** Maintain export success >= 99.5% (PM-10).
- **KR3.2** Maintain import merge integrity >= 99% (PM-09).
- **KR3.3** Maintain exchange ETL success >= 98% (ENG-03).
- **KR3.4** Keep runtime errors <= 0.5% sessions (ENG-01).

---

## 6) Instrumentation Recommendations

- Add lightweight event logs for:
  - view switches
  - filter changes
  - project CRUD attempts/success/failure
  - exchange refresh trigger + source + result
  - import/export outcomes
- Keep logs anonymous and local-first compatible; avoid personal data.

---

## 7) Review Cadence

- Weekly: operational and reliability metrics (`ENG-*`, ETL health).
- Bi-weekly: UX flow metrics and task completion (`UX-*`).
- Monthly: OKR checkpoint and product metrics (`PM-*`).
- Quarterly: adjust targets based on portfolio maturity.

