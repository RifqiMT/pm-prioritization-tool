# Business Guidelines

Guidelines for teams using the Product Management Prioritization Tool in planning, prioritization, and stakeholder communication.

| Field | Value |
|-------|-------|
| **Last updated** | 2026-06-06 |
| **Audience** | Product managers, delivery leads, portfolio stakeholders |

---

## 1. Purpose of the tool

The application supports **portfolio-level prioritization** in the browser, with optional **cloud sync** when deployed on Vercel with MongoDB. It is designed for:

- Capturing initiatives as **roadmaps** within **profiles** (portfolios)
- Ranking with **RICE**
- Expressing delivery intent with **MoSCoW** (presented as **Must Have**, **Should Have**, **Could Have**, **Won't Have** in the UI)
- Estimating value with **financial frameworks** (planning-grade, not accounting)
- Communicating through **Table**, **Board**, **MoSCoW**, and **Map** views
- Filtering and grouping work by metadata including **labels** and **links**

Cross-profile workspace behavior for the designated trust profile is defined in **[GUARDRAILS.md §7](GUARDRAILS.md)**.

---

## 2. RICE calibration

### Formula

**RICE Score = (Reach × Impact × Confidence) ÷ Effort**

| Input | Scale | Guidance |
|-------|-------|----------|
| **Reach** | Non-negative integer | Users, customers, or events affected in the planning window (e.g. per quarter) |
| **Impact** | 1–5 | Per-unit impact if Reach occurs — define anchors as a team |
| **Confidence** | 0–100% | Evidence strength; stored as % and normalized in formula |
| **Effort** | 1–5 | Relative person-weeks or sprint cost; higher effort lowers score |

### Suggested Impact rubric (example)

| Score | Anchor |
|-------|--------|
| 1 | Minimal — cosmetic or negligible user value |
| 2 | Low — small subset benefits |
| 3 | Medium — clear value for a segment |
| 4 | High — major segment or revenue lever |
| 5 | Massive — strategic or company-critical outcome |

### Suggested Effort rubric (example)

| Score | Anchor |
|-------|--------|
| 1 | Days — trivial change |
| 2 | ~1 sprint |
| 3 | 2–3 sprints |
| 4 | Quarter-scale initiative |
| 5 | Multi-quarter program |

### Practices

- Document your team’s **Impact** and **Effort** anchors in a shared rubric (Confluence/Notion); link from roadmap descriptions.
- Revisit **Confidence** when new data arrives; do not treat scores as permanent.
- Use the in-app **RICE tooltip** in meetings to explain inputs and the computed line.
- When two roadmaps tie on RICE, break ties with MoSCoW category and delivery risk — not politics.

---

## 3. MoSCoW usage

**Stored values** (filters, export): `Must have`, `Should have`, `Could have`, `Won't have`.  
**Display labels** (quadrants, compact nav): **Must Have**, **Should Have**, **Could Have**, **Won't Have**.

| Category | Business meaning |
|----------|------------------|
| **Must Have** | Critical for launch; non-negotiable for the committed scope |
| **Should Have** | Important; include if capacity allows |
| **Could Have** | Desirable; time-boxed nice-to-haves |
| **Won't Have** | Explicitly out of scope for this horizon |

### Practices

- Assign every in-scope roadmap a MoSCoW category before roadmap sign-off.
- MoSCoW answers *delivery intent*; RICE answers *relative priority* — use both.
- Enable **RICE sort** within MoSCoW quadrants when discussing order inside a category.
- On compact layouts, use **Jump to quadrant** pills instead of horizontal scrolling.

---

## 4. Financial frameworks

Frameworks produce a **planning estimate** in roadmap currency, with optional **EUR** display via exchange rates.

| Framework | When to use |
|-----------|-------------|
| **Custom** | Known €/$ value from finance or leadership |
| **CLV** | Retention/margin/customer-lifetime value uplift |
| **NPS** | Promoter movement → retention, expansion, referral |
| **Risk** | Expected loss reduction vs mitigation cost |
| **Headcount** | Time saved → avoided FTE equivalent |
| **Operational** | Unit cost and cycle-time improvements |

**Business rule:** Label outputs as *decision support*. Do not use map/table EUR totals as audited financial statements.

---

## 5. Labels, links, tasks, and search hygiene

| Control | Business use |
|---------|----------------|
| **Title search + autocomplete** | Find initiatives quickly in large portfolios |
| **Label search + autocomplete** | Theme slicing (e.g. `growth`, `compliance`) |
| **Labels filter (any / with / without)** | Audits for undocumented themes or mandatory tagging policies |
| **Links filter (any / with / without)** | Ensure PRDs, designs, or tickets are attached before review |
| **Roadmap labels** | Multi-word tags on each initiative (e.g. `Platform`, `Q2 bet`) |
| **Roadmap links** | Named URLs to specs, Figma, Jira, or docs |
| **Roadmap tasks** | Sub-items with workflow status for delivery tracking inside an initiative |

**Recommendation:** Define a small allowed label vocabulary in team guidelines; avoid one-off labels that break filters. When using cloud sync, save roadmaps after editing labels/links so metadata flushes to MongoDB immediately.

---

## 6. Profiles and security

- One **profile** per portfolio context (product line, squad, business unit).
- Optional **profile password** protects sensitive portfolios on shared machines.
- Unlock is **per browser tab session**; users re-enter password after closing the tab or refreshing (by design).
- **Export** includes password-protected profiles only when the correct password was entered (inline unlock, session unlock, or export verification dialog).
- Workspace-wide cross-profile operations: see **[GUARDRAILS.md §7](GUARDRAILS.md)**.

---

## 7. Planning workflows

### Quarterly planning

1. Create or select profile.
2. Import prior quarter export (merge) or start fresh.
3. Enter/update roadmaps with RICE + MoSCoW + framework as needed.
4. Filter by **Roadmap period** (YYYY-Qn), **Countries**, **Labels**, and **Links**.
5. Export JSON backup before major edits.

### Weekly execution

1. **Board** view by **roadmap status**; RICE sort or drag-and-drop within columns.
2. Update status as work progresses; use compact **Move to** on tablets.
3. Bulk-delete cancelled rows via table selection (desktop toolbar or compact selection bar).

### Stakeholder reviews

- **Table:** sortable register with Framework, Type, Status icons; group compact cards by MoSCoW or status.
- **Map:** Count, RICE, or EUR by country.
- **MoSCoW:** four-quadrant narrative with full category names.
- **RACI:** portfolio accountability matrix; toggle **Business** vs **Tech** perspective before governance reviews.
- **KANO:** portfolio value map; use **Positioned** / **Not positioned** to close gaps before roadmap sign-off.

### RACI calibration

| Role | Business meaning |
|------|------------------|
| **Responsible** | Does the work to complete the initiative |
| **Accountable** | Ultimately answerable; one clear owner per roadmap where possible |
| **Consulted** | Two-way input before decisions |
| **Informed** | Kept up to date on progress |

Use **Business** domain for product/commercial stakeholders and **Tech** for engineering/platform owners. Empty roles are allowed but reduce matrix usefulness — aim for at least **Accountable** on in-flight roadmaps.

### KANO calibration

| Axis | Scale | Guidance |
|------|-------|----------|
| **Functionality** | 1–5 (Absent → Full) | How completely the capability is delivered |
| **Satisfaction** | 1–5 (Very dissatisfied → Delighted) | How customers respond when the capability exists |

Scores drive category placement (Attractive, One-dimensional, Must-be, Indifferent, Reverse) per `kanoCategoryLegend` in `constants.js`. Use KANO for **portfolio classification**, not as a replacement for RICE priority.

### LLM roadmap analysis (optional)

- Requires user-owned **Groq** and **Tavily** API keys (BYOK) — not included in workspace subscription or MongoDB.
- Use for **draft briefings** before exec reviews; always human-review before external distribution.
- Summaries incorporate roadmap fields, optional Tavily link extraction, and limited web search — treat as **assistive**, not authoritative prioritization.
- Generated text is **not stored** in the portfolio export; regenerate as needed per session.

### 5 Why Framework (optional)

- Same BYOK prerequisites as LLM analysis (Groq + Tavily on device).
- Use in **view-only** roadmap sessions to facilitate root-cause workshops — the tool outputs **questions**, not answers; facilitators lead discussion.
- Five levels map to DMAIC phases (Define → Control) with plain-English labels; do not treat generated questions as validated research.
- Session output is **not stored** in export or cloud; reset and regenerate per meeting as needed.
- Independent from LLM Summary — use Summary for stakeholder briefings, Five Why for facilitated inquiry.

---

## 8. Data portability and export practices

| Action | Behavior |
|--------|----------|
| **Export JSON** | Full backup: profiles, roadmaps, preferences, password hashes for unlocked profiles |
| **Export CSV** | Flat roadmap rows for spreadsheets |
| **Import** | **Merge** by ID — updates existing, adds new; does not wipe workspace |

### Export practices (recommended)

| Practice | Why |
|----------|-----|
| Export JSON after each planning milestone | Recoverable point-in-time |
| Export before bulk delete or import | Rollback path |
| Name files with date + profile (`portfolio-2026-Q2.json`) | Audit trail |
| Verify locked profiles in export dialog | Avoid silent omission of sensitive data |
| Store exports outside the browser | `localStorage` is not backup storage |
| Do not email exports with password hashes to wide distribution | Treat exports as confidential |

CSV export is best for **stakeholder spreadsheets**; JSON export is best for **full restore and migration**.

---

## 9. What this tool is not

- Not a delivery execution system (no sprints, capacity planning, assignments, or dependency graphs).
- Not multi-user real-time collaboration.
- Not SOX/accounting-grade financial reporting.
- Not a substitute for legal/compliance review of sensitive data on shared devices.

See [GUARDRAILS.md](GUARDRAILS.md) for technical limits.
