# Persona — Delivery / Team Lead

## Snapshot

- **Name**: The Execution Lead
- **Role**: Engineering Manager / Delivery Lead / Squad Lead
- **Operating context**: Weekly delivery planning + dependency management + stakeholder reporting

## Goals (outcomes)

- Keep delivery aligned with the **agreed priority order**.
- Make status transitions visible and low-friction.
- Ensure projects have enough context to be actionable (not just a title).

## Jobs-to-be-done (JTBD)

- **When** priorities shift, **I want** to quickly re-rank and re-slice the backlog, **so that** the team focuses on the right work.
- **When** the squad is operating weekly, **I want** a board-like view, **so that** status changes are fast and visible.

## Pain points

- Priority becomes outdated as work progresses.
- Hard to reconcile what’s “important” vs what’s “in progress”.
- Status changes get lost in chat or separate tools.

## Key behaviors in this app

- Uses **Board** view for status movement.
- Uses Table sorting/filtering to focus on top items by RICE, status, type, size.
- Relies on quick context via tooltips (status/description on cards).

## Critical UX expectations

- Drag/drop (or equivalent) must feel responsive and not glitch.
- Filters must be fast and predictable.
- Visual hierarchy should support “scan and decide” behavior.

## Success signals

- Weekly planning completes faster.
- Fewer “why are we doing this now?” escalations due to stale priority.
- Stakeholder updates can be produced from the same portfolio view.

## Relevant behaviors (board status + mobile)
- I can quickly hide/show status columns using **clickable status toggle pills** so standups focus on the most relevant work states.
- The UI keeps at least one status column visible to avoid empty/misleading board states.
- On mobile/tablet, the status selector is still usable without hover-only affordances, using `aria-pressed` and touch-friendly targets.

