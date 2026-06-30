/**
 * Gantt view — ISO weeks, quarter ranges, week status mapping.
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");

global.normalizeRoadmapDeadline = (value) => {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  return text;
};

global.formatRoadmapDeadlineForDisplay = (value) => value || "";
global.getRoadmapDeadlineDayDelta = (deadline) => {
  const text = String(deadline || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const parts = text.split("-").map(Number);
  const due = new Date(parts[0], parts[1] - 1, parts[2]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
};
global.formatRoadmapDeadlineRelativeHint = (deadline) => {
  const delta = global.getRoadmapDeadlineDayDelta(deadline);
  if (delta == null) return "";
  if (delta < 0) return `${Math.abs(delta)} days overdue`;
  if (delta === 0) return "Due today";
  return `Due in ${delta} days`;
};
global.getRoadmapDeadlineHintTone = (deadline) => {
  const delta = global.getRoadmapDeadlineDayDelta(deadline);
  if (delta == null) return "neutral";
  if (delta < 0) return "overdue";
  if (delta === 0) return "today";
  if (delta <= 7) return "soon";
  return "upcoming";
};
global.roadmapStatusList = ["Not Started", "In Progress", "On Hold", "Done", "Cancelled"];

const source = fs.readFileSync(path.join(__dirname, "../src/modules/gantt-view.js"), "utf8");
const GanttView = eval(source.replace(/const GanttView = /, ""));

assert.ok(GanttView, "GanttView module should load");
assert.strictEqual(typeof GanttView.getISOWeekKey, "function");
assert.strictEqual(typeof GanttView.periodToDateRange, "function");
assert.strictEqual(typeof GanttView.buildRowWeekStatuses, "function");

const q1Range = GanttView.periodToDateRange("2026-Q1");
assert.ok(q1Range);
assert.strictEqual(q1Range.start.getMonth(), 0);
assert.strictEqual(q1Range.end.getMonth(), 2);

const weeks = GanttView.buildTimelineWeeks([
  {
    id: "r1",
    periods: [{ period: "2026-Q1", status: "In Progress" }],
    deadline: "2026-03-15"
  }
]);
assert.ok(weeks.length >= 52, "timeline should span at least MIN_WEEKS");

const months = GanttView.buildTimelineMonths(weeks);
assert.ok(months.length > 0, "monthly timeline should be built from weeks");
assert.ok(
  months.length < weeks.length,
  "monthly columns should be fewer than weekly columns"
);

const monthSpans = GanttView.getPeriodMonthSpan(
  [{ period: "2026-Q1", status: "In Progress" }],
  months
);
assert.ok(monthSpans.length === 1, "Q1 should map to one monthly span");
assert.ok(monthSpans[0].span >= 2, "Q1 should cover multiple months");

const q1Month = months.find((entry) => entry.key === "2026-01");
assert.ok(q1Month, "monthly timeline should include Jan 2026");
assert.strictEqual(
  GanttView.monthOverlapsRange(q1Month, q1Range),
  true,
  "January should overlap Q1"
);

const statusMap = GanttView.buildRowWeekStatuses(
  [{ period: "2026-Q1", status: "In Progress" }],
  weeks
);
const activeWeeks = [...statusMap.entries()].filter(([, status]) => status === "In Progress");
assert.ok(activeWeeks.length >= 12, "Q1 should cover multiple ISO weeks");

const mixedStatusMap = GanttView.buildRowWeekStatuses(
  [
    { period: "2026-Q1", status: "Done" },
    { period: "2026-Q2", status: "In Progress" }
  ],
  weeks
);
const q1Week = weeks.find((wk) => GanttView.weekOverlapsRange(wk, GanttView.periodToDateRange("2026-Q1")));
const q2Week = weeks.find((wk) => GanttView.weekOverlapsRange(wk, GanttView.periodToDateRange("2026-Q2")));
assert.ok(q1Week && q2Week, "timeline should include Q1 and Q2 weeks");
assert.strictEqual(mixedStatusMap.get(q1Week), "Done");
assert.strictEqual(mixedStatusMap.get(q2Week), "In Progress");

const jan1 = new Date(2026, 0, 1);
const weekKey = GanttView.getISOWeekKey(jan1);
assert.match(weekKey, /^\d{4}-W\d{2}$/);

const overdueState = GanttView.resolveRoadmapDeadlineState("2020-01-01", [
  { period: "2026-Q2", status: "In Progress", slug: "in-progress", startIdx: 0, endIdx: 2, span: 3 }
]);
assert.ok(overdueState, "deadline state should resolve");
assert.strictEqual(overdueState.isOverdue, true);
assert.strictEqual(overdueState.exceeds, true);

const futureDeadline = new Date();
futureDeadline.setMonth(futureDeadline.getMonth() + 3);
const futureKey = `${futureDeadline.getFullYear()}-${String(futureDeadline.getMonth() + 1).padStart(2, "0")}-${String(futureDeadline.getDate()).padStart(2, "0")}`;
const exceedsState = GanttView.resolveRoadmapDeadlineState(futureKey, [
  { period: "2026-Q4", status: "In Progress", slug: "in-progress", startIdx: 0, endIdx: 0, span: 1 }
]);
assert.ok(exceedsState);
assert.strictEqual(exceedsState.timelineExceeds, true);
assert.strictEqual(exceedsState.isOverdue, false);
assert.strictEqual(exceedsState.exceeds, true);

const weekTimeline = ["2026-W10", "2026-W11", "2026-W12"];
assert.strictEqual(GanttView.resolveTodayTimelineIndex(weekTimeline, "week", "2026-W11", ""), 1);
assert.strictEqual(
  GanttView.resolveTodayTimelineIndex(
    [{ key: "2026-01", year: 2026, month: 0 }, { key: "2026-02", year: 2026, month: 1 }],
    "month",
    "",
    "2026-02"
  ),
  1
);

assert.strictEqual(
  GanttView.weekOverlapsRange(weekKey, q1Range),
  GanttView.weekOverlapsRange(weekKey, q1Range)
);

const adjacentSpans = [
  { startIdx: 0, endIdx: 2, span: 3, period: "2026-Q1", status: "Not Started" },
  { startIdx: 3, endIdx: 5, span: 3, period: "2026-Q2", status: "In Progress" }
];
const firstSegment = GanttView.resolveBarSegmentGeometry(adjacentSpans[0], 0, adjacentSpans, 12);
const secondSegment = GanttView.resolveBarSegmentGeometry(adjacentSpans[1], 1, adjacentSpans, 12);
assert.strictEqual(firstSegment.joinsNext, true);
assert.strictEqual(firstSegment.rightPad, 0);
assert.strictEqual(secondSegment.joinsPrev, true);
assert.strictEqual(secondSegment.leftPad, 0);

const loneSegment = GanttView.resolveBarSegmentGeometry(
  { startIdx: 2, endIdx: 4, span: 3 },
  0,
  [{ startIdx: 2, endIdx: 4, span: 3 }],
  12
);
assert.strictEqual(loneSegment.leftPad, 3);
assert.strictEqual(loneSegment.rightPad, 3);

console.log("test-gantt-view: OK");
