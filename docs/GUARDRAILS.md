# Product and Technical Guardrails

## Purpose

This document defines non-negotiable boundaries and constraints for product evolution to protect reliability, usability, and business intent.

---

## 1) Business Guardrails

1. **Local-first principle is mandatory**
   - The product must remain usable without requiring account signup or managed backend.
2. **Prioritization integrity**
   - RICE and MOSCOW must remain explicit and user-auditable.
3. **Data ownership**
   - Users must retain control via export/import pathways.
4. **No hidden scoring**
   - Any ranking logic must be visible and explainable.
5. **No destructive defaults**
   - Destructive actions (delete profile/project) require confirmation.

---

## 2) Technical Guardrails

1. **Persistence**
   - Use a stable storage schema under `STORAGE_KEY` (`rice_prioritizer_v1`).
   - Migrations must be backward-safe when adding fields.
2. **Validation**
   - Required RICE fields and boundary checks cannot be bypassed.
3. **Exchange rates**
   - ETL must preserve fallback resilience; if remote source fails, app remains usable.
4. **UI consistency**
   - Do not reintroduce mixed dark/light fragments in the same theme profile.
5. **Accessibility**
   - Maintain keyboard focus visibility and sensible ARIA for core controls.

---

## 3) Performance Guardrails

1. **Render responsiveness**
   - Filter/sort interactions should remain near-instant for typical dataset sizes.
2. **No heavy runtime dependencies**
   - Keep architecture lightweight (plain JS + static assets).
3. **Efficient rerenders**
   - Avoid unnecessary full-view rerender loops.

---

## 4) Data Guardrails

1. **Country canonicalization**
   - Normalize aliases to canonical country names before persistence/import merge.
2. **Currency normalization**
   - Uppercase and trim currency codes before conversion.
3. **Import merge safety**
   - Merge by profile identity (ID/name) and project ID; skip duplicates; do not blind overwrite.
4. **Date consistency**
   - Use Berlin day semantics for exchange rate freshness logic.

---

## 5) Security and Privacy Guardrails

1. **No secrets in source or docs**
   - API keys, tokens, credentials must never be hardcoded.
2. **Local data scope**
   - User data remains in browser local storage unless explicitly exported by user.
3. **No silent network dependency**
   - Core prioritization remains usable when external API calls fail.

---

## 6) UX Guardrails

1. **Action clarity**
   - Primary, secondary, and destructive actions must remain clearly distinct.
2. **Header/table synchronization**
   - Table column width logic must keep header and body aligned.
3. **Responsive integrity**
   - Narrow layouts must preserve readability and tappable controls.
4. **Feedback**
   - User-triggered mutations should show clear confirmations (toasts/modals).

---

## 7) Release Guardrails (Checklist)

- [ ] PRD requirement mapping updated (`TRACEABILITY_MATRIX.md`)
- [ ] Validation and edge-case paths tested
- [ ] Exchange-rate behavior validated (manual, stale-open, scheduled)
- [ ] Import/export smoke-tested (JSON + CSV)
- [ ] Accessibility quick pass completed (keyboard + focus)
- [ ] Changelog updated

