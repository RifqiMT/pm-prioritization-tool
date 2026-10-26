/**
 * Profile overview timeline aggregation tests (quarterly + annually).
 */
const assert = require("assert");
const ProfileOverviewTimeline = require("../src/modules/profile-overview-timeline.js");

assert.ok(ProfileOverviewTimeline);
assert.strictEqual(typeof ProfileOverviewTimeline.buildSeries, "function");
assert.ok(ProfileOverviewTimeline.METRICS.length >= 8);
assert.ok(ProfileOverviewTimeline.GRANULARITIES.some((g) => g.id === "year"));
assert.strictEqual(ProfileOverviewTimeline.normalizeGranularity("annually"), "year");
assert.strictEqual(ProfileOverviewTimeline.normalizeGranularity("quarter"), "quarter");

const empty = ProfileOverviewTimeline.buildSeries([], "roadmapType");
assert.strictEqual(empty.empty, true);
assert.match(empty.emptyMessage, /No quarterly data/i);

const emptyYear = ProfileOverviewTimeline.buildSeries([], "roadmapType", {}, "year");
assert.strictEqual(emptyYear.empty, true);
assert.match(emptyYear.emptyMessage, /No yearly data/i);

const roadmaps = [
  {
    id: "r1",
    roadmapType: "Feature",
    tshirtSize: "M",
    moscowCategory: "Must have",
    financialImpactFramework: "clv",
    financialImpactCurrency: "EUR",
    financialImpactValue: 1000,
    reachValue: 100,
    impactValue: 3,
    confidenceValue: 80,
    effortValue: 2,
    roadmapPeriods: [
      { period: "2025-Q4", status: "Done" },
      { period: "2026-Q1", status: "Done" },
      { period: "2026-Q2", status: "In Progress" }
    ]
  },
  {
    id: "r2",
    roadmapType: "Bug",
    tshirtSize: "S",
    moscowCategory: "Should have",
    financialImpactFramework: "custom",
    financialImpactCurrency: "USD",
    financialImpactValue: 500,
    reachValue: 50,
    impactValue: 2,
    confidenceValue: 70,
    effortValue: 1,
    roadmapPeriod: "2026-Q2"
  },
  {
    id: "r3",
    roadmapType: "Feature",
    moscowCategory: "Could have",
    financialImpactValue: 200,
    financialImpactCurrency: "EUR",
    // no period — excluded from timeline
    reachValue: 10,
    impactValue: 1,
    confidenceValue: 50,
    effortValue: 1
  }
];

const helpers = {
  getPeriodEntries(roadmap) {
    if (Array.isArray(roadmap.roadmapPeriods) && roadmap.roadmapPeriods.length) {
      return roadmap.roadmapPeriods.map((entry) => ({
        period: String(entry.period).toUpperCase(),
        status: entry.status
      }));
    }
    if (roadmap.roadmapPeriod) {
      return [{ period: String(roadmap.roadmapPeriod).toUpperCase(), status: "Not Started" }];
    }
    return [];
  },
  getFinancialImpactEur(roadmap) {
    const amount = Number(roadmap.financialImpactValue);
    if (!Number.isFinite(amount)) return null;
    const currency = String(roadmap.financialImpactCurrency || "EUR").toUpperCase();
    if (currency === "EUR") return amount;
    if (currency === "USD") return amount * 0.9;
    return amount;
  },
  calculateRiceScore(roadmap) {
    const r = Number(roadmap.reachValue);
    const i = Number(roadmap.impactValue);
    const c = Number(roadmap.confidenceValue) / 100;
    const e = Number(roadmap.effortValue);
    if (![r, i, c, e].every(Number.isFinite) || e <= 0) return null;
    return (r * i * c) / e;
  },
  getKanoKey(roadmap) {
    if (roadmap.kanoFunctionality == null || roadmap.kanoSatisfaction == null) {
      return ProfileOverviewTimeline.UNPOSITIONED_KANO_KEY;
    }
    return "attractive";
  }
};

const byType = ProfileOverviewTimeline.buildSeries(roadmaps, "roadmapType", helpers);
assert.strictEqual(byType.empty, false);
assert.strictEqual(byType.granularity, "quarter");
assert.deepStrictEqual(byType.periods, ["2025-Q4", "2026-Q1", "2026-Q2"]);
assert.strictEqual(byType.kind, "category");
const feature = byType.series.find((s) => s.key === "Feature");
const bug = byType.series.find((s) => s.key === "Bug");
assert.ok(feature);
assert.ok(bug);
assert.deepStrictEqual(feature.values, [1, 1, 1]); // r1 in each quarter
assert.deepStrictEqual(bug.values, [0, 0, 1]); // r2 in Q2 only

const byTypeYear = ProfileOverviewTimeline.buildSeries(roadmaps, "roadmapType", helpers, "year");
assert.strictEqual(byTypeYear.granularity, "year");
assert.deepStrictEqual(byTypeYear.periods, ["2025", "2026"]);
const featureY = byTypeYear.series.find((s) => s.key === "Feature");
const bugY = byTypeYear.series.find((s) => s.key === "Bug");
// r1 spans 2025 + 2026 → once each year; r2 only 2026
assert.deepStrictEqual(featureY.values, [1, 1]);
assert.deepStrictEqual(bugY.values, [0, 1]);
// Unique portfolio: r1 + r2 = 2 (not 1+1+1 from summing year buckets / periods)
assert.strictEqual(byTypeYear.uniqueCount, 2);
assert.strictEqual(featureY.uniqueCount, 1);
assert.strictEqual(bugY.uniqueCount, 1);
assert.strictEqual(byType.uniqueCount, 2);

const yearSvg = ProfileOverviewTimeline.renderSvg(byTypeYear, { containerWidth: 800 });
assert.match(yearSvg, /Unique roadmaps/i);
assert.doesNotMatch(yearSvg, /Across years/i);
// Legend shows unique category counts (1 Feature + 1 Bug), not period-summed totals
assert.match(yearSvg, /profile-timeline-legend-count">1</);

const byMoscow = ProfileOverviewTimeline.buildSeries(roadmaps, "moscow", helpers);
assert.ok(byMoscow.series.some((s) => s.key === "Must have"));

const byCurrency = ProfileOverviewTimeline.buildSeries(roadmaps, "currency", helpers);
const eur = byCurrency.series.find((s) => s.key === "EUR");
const usd = byCurrency.series.find((s) => s.key === "USD");
assert.deepStrictEqual(eur.values, [1, 1, 1]);
assert.deepStrictEqual(usd.values, [0, 0, 1]);

const financial = ProfileOverviewTimeline.buildSeries(roadmaps, "financialImpact", helpers);
assert.strictEqual(financial.kind, "numeric");
assert.strictEqual(financial.aggregation, "sum");
// Q4'25: r1 1000; Q1'26: r1 1000; Q2'26: r1 1000 + r2 450
assert.strictEqual(financial.series[0].values[0], 1000);
assert.strictEqual(financial.series[0].values[1], 1000);
assert.strictEqual(financial.series[0].values[2], 1450);

const financialYear = ProfileOverviewTimeline.buildSeries(
  roadmaps,
  "financialImpact",
  helpers,
  "year"
);
// 2025: r1 once 1000; 2026: r1 1000 + r2 450 (not double-counted for Q1+Q2)
assert.deepStrictEqual(financialYear.periods, ["2025", "2026"]);
assert.strictEqual(financialYear.series[0].values[0], 1000);
assert.strictEqual(financialYear.series[0].values[1], 1450);

const rice = ProfileOverviewTimeline.buildSeries(roadmaps, "riceScore", helpers);
assert.strictEqual(rice.aggregation, "average");
const riceR1 = helpers.calculateRiceScore(roadmaps[0]);
const riceR2 = helpers.calculateRiceScore(roadmaps[1]);
assert.strictEqual(rice.series[0].values[0], riceR1);
assert.strictEqual(rice.series[0].values[1], riceR1);
assert.strictEqual(rice.series[0].values[2], (riceR1 + riceR2) / 2);

const riceYear = ProfileOverviewTimeline.buildSeries(roadmaps, "riceScore", helpers, "year");
assert.strictEqual(riceYear.series[0].values[0], riceR1);
assert.strictEqual(riceYear.series[0].values[1], (riceR1 + riceR2) / 2);

const svg = ProfileOverviewTimeline.renderSvg(byType, { containerWidth: 900 });
assert.match(svg, /profile-timeline-svg/);
assert.match(svg, /2026-Q1/);
assert.match(svg, /profile-timeline-legend/);
assert.match(svg, /profile-timeline-kpi/);
assert.match(svg, /width="100%"/);
assert.match(svg, /profile-timeline-tooltip/);
assert.match(svg, /profile-timeline-col-track/);
assert.match(svg, /viewBox="0 0 900 /);

assert.match(yearSvg, /Active years/i);
assert.match(yearSvg, /per year/i);
assert.match(yearSvg, />2025</);
assert.match(yearSvg, />2026</);

const financialSvg = ProfileOverviewTimeline.renderSvg(financial);
assert.match(financialSvg, /profile-timeline-bar--numeric/);
assert.match(financialSvg, /1\.5k|1k/);

assert.strictEqual(ProfileOverviewTimeline.formatCompactNumber(370000), "370k");
assert.strictEqual(ProfileOverviewTimeline.formatCompactNumber(2600000), "2.6M");
assert.strictEqual(ProfileOverviewTimeline.periodToBucket("2026-Q2", "year"), "2026");
assert.strictEqual(ProfileOverviewTimeline.periodToBucket("2026-Q2", "quarter"), "2026-Q2");

const filtered = ProfileOverviewTimeline.applySeriesFilter(byType, ["Feature"]);
assert.strictEqual(filtered.isFiltered, true);
assert.deepStrictEqual(filtered.filterKeys, ["Feature"]);
assert.strictEqual(filtered.model.series.length, 1);
assert.strictEqual(filtered.model.series[0].key, "Feature");
assert.strictEqual(filtered.model.uniqueCount, 1);

assert.deepStrictEqual(ProfileOverviewTimeline.toggleSeriesFilter(byType, null, "Bug"), ["Bug"]);
assert.strictEqual(ProfileOverviewTimeline.toggleSeriesFilter(byType, ["Bug"], "Bug"), null);
// Selecting every series is equivalent to no filter
assert.strictEqual(ProfileOverviewTimeline.toggleSeriesFilter(byType, ["Bug"], "Feature"), null);

const filteredSvg = ProfileOverviewTimeline.renderSvg(filtered.model, {
  seriesFilter: ["Feature"],
  legendModel: byType
});
assert.match(filteredSvg, /has-series-filter/);
assert.match(filteredSvg, /profile-timeline-clear-filter/);
assert.match(filteredSvg, /is-filter-on/);
assert.match(filteredSvg, /Filter by category/);

const emptySvg = ProfileOverviewTimeline.renderSvg(empty);
assert.match(emptySvg, /profile-timeline-empty/);

assert.strictEqual(ProfileOverviewTimeline.normalizeViewMode("table"), "table");
assert.strictEqual(ProfileOverviewTimeline.normalizeViewMode("chart"), "chart");
assert.ok(ProfileOverviewTimeline.VIEW_MODES.some((mode) => mode.id === "table"));

const tableHtml = ProfileOverviewTimeline.renderTable(byType);
assert.match(tableHtml, /profile-timeline-table/);
assert.match(tableHtml, /data-view="table"/);
assert.match(tableHtml, /2025-Q4|2026-Q1|2026-Q2/);
assert.match(tableHtml, /Feature/);
assert.match(tableHtml, /Total/);
assert.match(tableHtml, /profile-timeline-table-value__growth/);
assert.match(tableHtml, /is-up|is-down|is-flat/);

const filteredTable = ProfileOverviewTimeline.renderTable(filtered.model, {
  seriesFilter: ["Feature"],
  legendModel: byType
});
assert.match(filteredTable, /has-series-filter/);
assert.match(filteredTable, /Feature/);
// Table columns are filtered; legend still lists Bug as an off filter chip
assert.match(filteredTable, /is-filter-off"[^>]*data-series="Bug"/);
assert.match(
  filteredTable,
  /<thead><tr><th[^>]*>Period<\/th><th[^>]*class="[^"]*profile-timeline-table-total[^"]*"[^>]*>Total<\/th><th[^>]*class="[^"]*profile-timeline-table-series[^"]*"[^>]*>[\s\S]*?Feature[\s\S]*?<\/th>/
);

const emptyTable = ProfileOverviewTimeline.renderTable(empty);
assert.match(emptyTable, /profile-timeline-empty/);

console.log("test-profile-overview-timeline: ok");
