import test from "node:test";
import assert from "node:assert/strict";
import {
  adjacentMonth,
  businessDate,
  calendarDays,
  completion,
  effectiveTarget,
  formatDate,
  formatSteps,
  monthBounds,
  saveStepsSchema,
  selectedMonth,
  validDate,
  visualProgress,
} from "../src/lib/steps/model.ts";

for (const [steps, expected] of [
  [0, 0],
  [7430, 74],
  [10000, 100],
  [11200, 112],
  [15000, 150],
]) {
  test(`completion ${steps} => ${expected}%`, () =>
    assert.equal(completion(steps!, 10000), expected));
}
test("missing report and missing/invalid target have no percentage", () => {
  assert.equal(completion(null, 10000), null);
  assert.equal(completion(100, null), null);
  assert.equal(completion(100, 0), null);
});
test("visual progress clamps without changing displayed completion", () => {
  assert.equal(visualProgress(150), 100);
  assert.equal(visualProgress(-1), 0);
  assert.equal(visualProgress(null), 0);
});
const targets = [
  { effective_from: "2026-10-15", target_steps: 10000 },
  { effective_from: "2026-10-01", target_steps: 8000 },
];
test("historical resolution is order independent and includes exact transition date", () => {
  assert.equal(effectiveTarget(targets, "2026-09-30"), null);
  assert.equal(effectiveTarget(targets, "2026-10-10"), 8000);
  assert.equal(effectiveTarget(targets, "2026-10-15"), 10000);
  assert.equal(effectiveTarget(targets, "2026-10-20"), 10000);
});
test("calendar preserves historical targets and distinguishes absence from zero", () => {
  const reports = [
    { date: "2026-10-10", steps: 8000 },
    { date: "2026-10-20", steps: 8000 },
    { date: "2026-10-02", steps: 0 },
  ];
  const days = calendarDays("2026-10", "2026-10-25", reports, targets);
  assert.equal(days[9]!.percentage, 100);
  assert.equal(days[19]!.percentage, 80);
  assert.equal(days[1]!.percentage, 0);
  assert.equal(days[2]!.percentage, null);
  assert.equal(days[2]!.steps, null);
  const beforeChange = calendarDays(
    "2026-10",
    "2026-10-25",
    reports,
    targets.slice(1),
  );
  assert.equal(days[9]!.percentage, beforeChange[9]!.percentage);
  assert.equal(days[25]!.future, true);
});
test("malformed, array, and future month values fall back safely", () => {
  for (const value of [
    "2026-13",
    "2026-1",
    "2026-10-01",
    "0000-01",
    "2027-01",
    ["2026-09"],
    "2026-09' OR true",
  ])
    assert.equal(selectedMonth(value, "2026-10-02"), "2026-10");
  assert.equal(selectedMonth("2026-09", "2026-10-02"), "2026-09");
  assert.equal(adjacentMonth("2026-10", 1), "2026-11");
  assert.equal(
    calendarDays("2026-11", "2026-10-02", [], []).every((day) => day.future),
    true,
  );
});
test("strict real dates and leap-year month boundaries", () => {
  assert.equal(validDate("2024-02-29"), true);
  for (const date of [
    "2026-02-29",
    "2026-04-31",
    "2026-1-01",
    "2026-10-02T00:00:00Z",
    "0000-01-01",
  ])
    assert.equal(validDate(date), false);
  assert.deepEqual(monthBounds("2024-02"), {
    start: "2024-02-01",
    end: "2024-02-29",
    days: 29,
    offset: 4,
  });
});
test("business date uses Jerusalem across midnight and winter/summer offsets", () => {
  assert.equal(businessDate(new Date("2026-10-01T21:30:00Z")), "2026-10-02");
  assert.equal(businessDate(new Date("2026-01-01T22:30:00Z")), "2026-01-02");
});
test("input validation rejects identity override, empty, fractions, negatives, bad dates", () => {
  assert.equal(
    saveStepsSchema.safeParse({ kind: "today", steps: 0 }).success,
    true,
  );
  for (const input of [
    { kind: "today", steps: "" },
    { kind: "today", steps: -1 },
    { kind: "today", steps: 1.2 },
    { kind: "today", steps: 1, trainee_id: "other" },
    { kind: "today", steps: 1, date: "2027-01-01" },
    { kind: "historical", steps: 1, date: "2026-02-29" },
  ])
    assert.equal(saveStepsSchema.safeParse(input).success, false);
});
test("Hebrew centralized formatting", () => {
  assert.equal(formatSteps(10000), "10,000");
  assert.match(formatDate("2026-10-12"), /אוקטובר/);
});
