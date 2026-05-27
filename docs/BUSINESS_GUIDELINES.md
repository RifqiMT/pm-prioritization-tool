# Business Guidelines

Guidelines for teams using the Product Management Prioritization Tool in planning, prioritization, and stakeholder communication.

---

## 1. Purpose of the tool

The application supports **portfolio-level prioritization** in the browser, with optional **cloud sync** when deployed on Vercel with MongoDB. It is designed for:

- Capturing initiatives as **projects** within **profiles** (portfolios)
- Ranking with **RICE**
- Expressing delivery intent with **MoSCoW**
- Estimating value with **financial frameworks** (planning-grade, not accounting)
- Communicating through **Table**, **Board**, **MoSCoW**, and **Map** views

---

## 2. RICE calibration

### Formula

**RICE Score = (Reach × Impact × Confidence) ÷ Effort**

| Input | Scale | Guidance |
|-------|-------|----------|
| **Reach** | Non-negative integer | Users, customers, or events affected in the planning window |
| **Impact** | 1–5 | Per-unit impact if Reach occurs (team rubric should define anchors) |
| **Confidence** | 0–100% | Evidence strength; stored as % and normalized in formula |
| **Effort** | 1–5 | Relative cost; higher effort lowers score |

### Practices

- Document your team’s **Impact** and **Effort** anchors in a shared rubric.
- Revisit **Confidence** when new data arrives; do not treat scores as permanent.
- Use the in-app **RICE tooltip** in meetings to explain inputs and the computed line.

---

## 3. MoSCoW usage

Categories: **Must have**, **Should have**, **Could have**, **Won't have**.

- Assign every in-scope project a MoSCoW category before roadmap sign-off.
- MoSCoW answers *delivery intent*; RICE answers *relative priority* — use both.
- The MoSCoW view supports optional **RICE sort** within each quadrant.

---

## 4. Financial frameworks

Frameworks produce a **planning estimate** in project currency, with optional **EUR** display via exchange rates.

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

## 5. Profiles and security

- One **profile** per portfolio context (product line, squad, business unit).
- Optional **profile password** protects sensitive portfolios on shared machines.
- Unlock is **per browser tab session**; users must re-enter password after closing the tab or refreshing (by design).
- **Export** includes password-protected profiles only when the correct password was entered (inline unlock, session unlock, or export verification dialog).

---

## 6. Planning workflows

### Quarterly planning

1. Create or select profile.
2. Import prior quarter export (merge) or start fresh.
3. Enter/update projects with RICE + MoSCoW + framework as needed.
4. Filter by **Project period** (YYYY-Qn) and **Countries** for roadmap slices.
5. Export JSON backup before major edits.

### Weekly execution

1. **Board** view by **project status**; use RICE sort or drag-and-drop to reorder within columns.
2. Drag-and-drop order when RICE sort is off (per-status order persisted per profile).
3. Update status as work progresses.

### Stakeholder reviews

- **Table:** sortable register with Framework, Type, Status icons.
- **Map:** Count, RICE, or EUR by country.
- **MoSCoW:** four-quadrant narrative.

---

## 7. Data portability

| Action | Behavior |
|--------|----------|
| **Export JSON** | Full backup: profiles, projects, preferences, password hashes for unlocked profiles |
| **Export CSV** | Flat project rows for spreadsheets |
| **Import** | **Merge** by ID — updates existing, adds new; does not wipe workspace |

Recommend: export after each planning milestone.

---

## 8. What this tool is not

- Not a project management system (no sprints, assignments, or dependencies).
- Not multi-user real-time collaboration.
- Not SOX/accounting-grade financial reporting.
- Not a substitute for legal/compliance review of sensitive data on shared devices.

See [GUARDRAILS.md](GUARDRAILS.md) for technical limits.
