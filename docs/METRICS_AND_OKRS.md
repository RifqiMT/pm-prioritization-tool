# Product Metrics and OKRs

| Field | Value |
|-------|-------|
| **Last updated** | 2026-06-06 |
| **Measurement** | Local-first — no default telemetry; manual QA + optional instrumentation |

---

## 1. Product metrics (outcomes)

| Metric ID | Metric | Definition | Formula | Target |
|-----------|--------|------------|---------|--------|
| PM-01 | Prioritization completeness | Share of roadmaps with valid RICE + status + MoSCoW | `valid_prioritized_roadmaps / total_roadmaps` | ≥ 90% |
| PM-02 | Framework adoption | Roadmaps using structured (non-custom) frameworks | `non_custom_framework_roadmaps / total_roadmaps` | ≥ 50% |
| PM-03 | Workflow throughput | Net roadmap activity per planning cycle | `created + updated + status_moved` | +20% QoQ |
| PM-04 | Map utility | Sessions using map for review | `map_view_sessions / total_sessions` | ≥ 25% |
| PM-05 | Export reliability | Successful exports | `successful_exports / export_attempts` | ≥ 99% |
| PM-06 | **Activation** | New workspaces that reach “first valuable state” within 7 days | `activated_workspaces_7d / new_workspaces` | ≥ 60% |
| PM-07 | **Engagement** | Active workspaces with ≥1 meaningful edit in 14 days | `active_workspaces_14d / total_workspaces` | ≥ 40% |
| PM-08 | **Retention proxy** | Workspaces returning after 30 days with ≥1 session | `returning_workspaces_30d / workspaces_30d_ago` | ≥ 35% |
| PM-11 | **RACI coverage** | Roadmaps with ≥1 RACI role populated | `roadmaps_with_raci / total_roadmaps` | ≥ 50% |
| PM-12 | **KANO positioning** | Roadmaps with both KANO axes set (1–5) | `kano_positioned_roadmaps / total_roadmaps` | ≥ 40% |
| PM-13 | **BYOK configuration** | Devices with both Groq and Tavily keys saved | `byok_fully_configured_devices / active_devices` | ≥ 25% (among LLM adopters) |
| PM-14 | **LLM summary usage** | Roadmap modal sessions with successful summary generation | `llm_summary_success / llm_summary_attempts` | ≥ 85% |
| PM-15 | **Five Why usage** | View-modal sessions completing ≥1 WHY question | `five_why_success / five_why_attempts` | ≥ 80% |

### PM-06 Activation — operational definition

A workspace is **activated** when **all** are true within 7 days of first open:

1. ≥1 profile created or selected  
2. ≥3 roadmaps with valid RICE (finite score)  
3. User opened ≥2 distinct views (e.g. Table + Board, MoSCoW, RACI, or KANO)

`activated_workspaces_7d / new_workspaces`

### PM-07 Engagement — operational definition

An **active workspace** in a 14-day window has:

- ≥1 roadmap create or update, **or**
- ≥5 filter applications (any filter change that triggers `applyFilters`), **or**
- ≥1 export attempt

`active_workspaces_14d / total_workspaces` (denominator: workspaces with ≥1 roadmap)

### PM-08 Retention proxy — operational definition

Among workspaces that had ≥3 roadmaps 30 days ago, count those with ≥1 session (any view navigation + save) in the last 7 days.

`returning_workspaces_30d / workspaces_30d_ago`

---

## 2. UX and quality metrics

| Metric ID | Metric | Definition | Formula | Target |
|-----------|--------|------------|---------|--------|
| UX-01 | RICE explainability | Tooltip opens on RICE surfaces | `rice_tooltip_opens / table_or_board_sessions` | Upward trend |
| UX-02 | Validation friction | Validation errors per save | `validation_errors / submit_attempts` | ≤ 0.3 |
| UX-03 | Table scanability | Critical header/column overflow defects | QA defect count | 0 critical |
| UX-04 | Time-to-decision | Median time open modal → saved roadmap | median seconds (sampled) | Downward trend |
| UX-05 | Tooltip exclusivity | Overlapping tooltips | `multi_tooltip_incidents / tooltip_sessions` | 0 |
| UX-06 | Modal guidance coverage | Fields with standardized tooltip | `fields_with_tooltip / total_modal_fields` | 100% |
| UX-07 | Compact layout usability | Critical horizontal overflow on board/MoSCoW at compact widths | `overflow_defects / compact_qa_sessions` | 0 critical |
| UX-08 | Compact task completion | Move status / jump MoSCoW quadrant without desktop controls | `successful_compact_tasks / compact_task_attempts` | ≥ 95% |
| UX-09 | Filter discoverability | Sessions using labels/links filter or autocomplete | `filter_feature_sessions / portfolio_sessions` | ≥ 30% |
| UX-10 | Compact table grouping | Compact sessions using non-`none` group-by | `group_by_sessions / compact_table_sessions` | ≥ 20% |

**UX-07 widths:** 375px, 768px, **1400px** (breakpoint), plus 1280px split-screen sample.

---

## 3. Engineering metrics

| Metric ID | Metric | Definition | Formula | Target |
|-----------|--------|------------|---------|--------|
| ENG-01 | Runtime error rate | Sessions with uncaught errors | `error_sessions / total_sessions` | ≤ 0.5% |
| ENG-02 | Persistence reliability | Save/load failures after refresh | `storage_failures / storage_ops` | ≤ 0.1% |
| ENG-03 | Import integrity | Clean merges | `clean_imports / import_attempts` | ≥ 99% |
| ENG-04 | Render responsiveness | Table rerender after filter/sort | p95 latency (ms) | ≤ 300 |
| ENG-05 | Cloud sync success | Debounced PUT without user-visible failure | `successful_cloud_saves / cloud_save_attempts` | ≥ 99% |
| ENG-06 | Metadata round-trip | Labels/links unchanged after save + reload (cloud) | `metadata_match_after_reload / metadata_save_attempts` | ≥ 99% |
| PM-09 | Rich metadata usage | Roadmaps with labels, links, or tasks | `roadmaps_with_metadata / total_roadmaps` | ≥ 40% |

---

## 4. OKRs (product team)

### Objective 1 — Improve prioritization trust

| Key result | Metric | Target |
|------------|--------|--------|
| KR1.1 | PM-01 completeness | ≥ 95% |
| KR1.2 | UX-02 validation friction | ≤ 0.2 |
| KR1.3 | UX-01 RICE tooltip usage | +30% vs prior quarter |
| KR1.4 | UX-05 tooltip exclusivity | 0 incidents per release |

### Objective 2 — Strengthen financial planning discipline

| Key result | Metric | Target |
|------------|--------|--------|
| KR2.1 | PM-02 framework adoption | ≥ 65% |
| KR2.2 | EUR display accuracy | 0 high-severity defects |

### Objective 3 — Maintain reliability at scale

| Key result | Metric | Target |
|------------|--------|--------|
| KR3.1 | ENG-01 runtime errors | ≤ 0.5% |
| KR3.2 | ENG-03 import integrity | ≥ 99% |
| KR3.3 | ENG-04 render p95 | ≤ 300ms |
| KR3.4 | UX-06 modal tooltips | 100% |

### Objective 4 — Excellent experience on tablets and phones (≤1400px)

| Key result | Metric | Target |
|------------|--------|--------|
| KR4.1 | UX-07 compact overflow | 0 critical per release |
| KR4.2 | UX-08 compact tasks | ≥ 95% |
| KR4.3 | UX-09 filter features | ≥ 30% sessions |
| KR4.4 | Footer + FAB discoverability | Pass compact usability checklist |

### Objective 6 — Portfolio governance (RACI & KANO)

| Key result | Metric | Target |
|------------|--------|--------|
| KR6.1 | PM-11 RACI coverage | ≥ 50% |
| KR6.2 | PM-12 KANO positioning | ≥ 40% |
| KR6.3 | RACI view adoption | ≥ 20% of portfolio sessions open RACI tab |
| KR6.4 | KANO view adoption | ≥ 15% of portfolio sessions open KANO tab |

### Objective 7 — Optional AI assistance (BYOK)

| Key result | Metric | Target |
|------------|--------|--------|
| KR7.1 | PM-13 BYOK full configuration | ≥ 25% among users who try LLM |
| KR7.2 | PM-14 LLM summary success rate | ≥ 85% |
| KR7.3 | Zero BYOK keys in cloud export | 0 incidents per release |
| KR7.4 | CSP / connect-src regressions | 0 production blocks on Groq/Tavily |
| KR7.5 | PM-15 Five Why success rate | ≥ 80% among users who start a WHY chain |

### Objective 5 — Grow meaningful product usage (activation & return)

| Key result | Metric | Target |
|------------|--------|--------|
| KR5.1 | PM-06 activation (7d) | ≥ 60% |
| KR5.2 | PM-07 engagement (14d) | ≥ 40% |
| KR5.3 | PM-08 retention proxy (30d) | ≥ 35% |
| KR5.4 | PM-05 export reliability | ≥ 99% |

---

## 5. Review cadence

| Cadence | Metrics |
|---------|---------|
| Weekly | ENG-01, ENG-02, ENG-05 |
| Bi-weekly | UX-01–UX-10 |
| Monthly | PM-01–PM-12, OKR health |
| Quarterly | Target recalibration, persona validation |

---

## 6. Measurement methodology

The app does not stream telemetry by default. Collect metrics via:

1. **Instrumented QA runs** — repeatable scripts + checklist export  
2. **Manual sampling** — PM/QA classifies sessions against definitions below  
3. **Temporary debug logging** — development only; no passwords or PII  

### Core definitions (summary)

- **Valid prioritized roadmap (PM-01):** Valid RICE bounds, finite score, valid `roadmapStatus` and `moscowCategory` from enums.  
- **Non-custom framework (PM-02):** `financialImpactFramework` ∈ `clv`, `nps`, `risk`, `headcount`, `operational`.  
- **Status moved (PM-03):** `roadmapStatus` change that moves card between board columns.  
- **Map session (PM-04):** Navigate to Map + layer renders or defined empty state.  
- **Successful export (PM-05):** Download starts without error after Export click.  
- **Roadmap with RACI (PM-11):** At least one of `raci.responsible`, `accountable`, `consulted`, `informed` has a non-empty entry after normalization.  
- **KANO positioned (PM-12):** Both `kanoFunctionality` and `kanoSatisfaction` are integers 1–5.  
- **BYOK fully configured (PM-13):** `ByokApiKeys` reports both Groq and Tavily keys decryptable on device.  
- **LLM summary success (PM-14):** Generate click completes with three non-empty paragraphs and no error status class.  
- **Five Why success (PM-15):** Ask WHY click completes with a non-empty question in `#roadmapFiveWhyOutput` and no error status class.  

### UX collection notes

- **UX-09:** Count session if user applies `filterLabels`, `filterLinks`, or selects an autocomplete suggestion.  
- **UX-10:** Count when `tableGroupBy !== "none"` on compact table.  
- **UX-07:** Critical defect = required horizontal scroll for primary board/MoSCoW content or primary actions.  

### Engineering collection notes

- **ENG-04:** Time from filter/sort event to stable table/card paint.  
- **ENG-05:** Cloud optional; skip when `MONGODB_URI` unset.  

---

## 7. OKR review template

1. List **top 1–2 regressions** by distance to target.  
2. Link each to a **code surface** (filters, render, storage, tooltips).  
3. Record follow-up: guardrail, UI fallback, or sanitization fix.  
4. Update [CHANGELOG.md](CHANGELOG.md) when user-visible.  

---

## 8. References

- [PRD.md](PRD.md) — functional requirements  
- [USER_STORIES.md](USER_STORIES.md) — acceptance scenarios for QA scripts  
- [BUSINESS_GUIDELINES.md](BUSINESS_GUIDELINES.md) — RICE/MoSCoW rubrics  
