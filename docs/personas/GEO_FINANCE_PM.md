# Persona — Geo / Finance Focus PM

## Snapshot

- **Name**: The Regional Portfolio PM
- **Role**: Product Manager / Ops PM / Growth PM
- **Operating context**: Multi-region planning, currency normalization, regional roll-ups

## Goals (outcomes)

- Compare project value across countries and currencies in a **common baseline** (EUR).
- Understand portfolio coverage by region and how priorities differ geographically.
- Use consistent frameworks to avoid ad-hoc value estimation.

## Jobs-to-be-done (JTBD)

- **When** planning regionally, **I want** to slice and aggregate by country/period, **so that** I can prioritize investment by market opportunity.
- **When** values are in different currencies, **I want** normalized reporting, **so that** stakeholders can compare apples-to-apples.

## Pain points

- Currency conversions are manual and error-prone.
- Country-level reporting is fragmented across spreadsheets.
- Framework inputs are inconsistent across projects.

## Key behaviors in this app

- Uses **Countries** filter and project “Target countries” metadata.
- Uses **Map** view and switches map metric (projects / RICE / financial).
- Uses exchange rate refresh to keep EUR normalization current.

## Critical UX expectations

- Filters must be quick and easy to use (searchable dropdowns).
- Map aggregation must be understandable and not misleading.
- FX errors should fail gracefully with clear messaging (no silent wrong numbers).

## Success signals

- Stakeholders can see “where value is” by region in minutes.
- Quarterly regional reviews require less manual prep work.

## Relevant behaviors (EUR normalization + export gate)
- I can switch Map metrics using the **segmented pills** (Count / RICE / EUR) and immediately understand what the legend represents.
- I can trust EUR totals by relying on FX refresh and guardrails that prevent silent wrong numbers when exchange rates are unavailable.
- When exporting, password-gated portfolios are included only after verification, so region/financial exports do not accidentally leak protected data.

