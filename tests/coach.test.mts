import test from "node:test";
import assert from "node:assert/strict";
import {
  coachQuery,
  lastReported,
  sevenDaySummary,
  targetChangeSchema,
} from "../src/lib/coach/model.ts";
import { calendarDays, completion } from "../src/lib/steps/model.ts";

test("last reported date handles absence, today, yesterday, and Hebrew dates", () => {
  assert.equal(lastReported(null, "2026-10-02"), "טרם דווח");
  assert.equal(lastReported("2026-10-02", "2026-10-02"), "היום");
  assert.equal(lastReported("2026-10-01", "2026-10-02"), "אתמול");
  assert.match(lastReported("2026-09-12", "2026-10-02"), /ספטמבר/);
  assert.equal(lastReported("2026-09-30", "2026-10-01"), "אתמול");
});
test("zero counts as reported; missing days do not; average steps uses reported days", () => {
  const summary = sevenDaySummary(
    "2026-10-02",
    [
      { date: "2026-10-01", steps: 0 },
      { date: "2026-10-02", steps: 10000 },
    ],
    [{ effective_from: "2026-09-01", target_steps: 10000 }],
  );
  assert.deepEqual(summary, {
    reportedDays: 2,
    eligibleDays: 2,
    reachedDays: 1,
    averageSteps: 5000,
    averageCompletion: 50,
  });
});
test("seven-day window is inclusive and excludes older and future reports", () => {
  const reports = [
    { date: "2026-09-25", steps: 1 },
    { date: "2026-09-26", steps: 10 },
    { date: "2026-10-02", steps: 30 },
    { date: "2026-10-03", steps: 1 },
  ];
  assert.equal(sevenDaySummary("2026-10-02", reports, []).reportedDays, 2);
});
test("missing target days count for step average but not achievement/completion denominator", () => {
  const summary = sevenDaySummary(
    "2026-10-02",
    [
      { date: "2026-09-30", steps: 5000 },
      { date: "2026-10-01", steps: 10000 },
    ],
    [{ effective_from: "2026-10-01", target_steps: 10000 }],
  );
  assert.deepEqual(summary, {
    reportedDays: 2,
    eligibleDays: 1,
    reachedDays: 1,
    averageSteps: 7500,
    averageCompletion: 100,
  });
});
test("completion average uses each historical target and keeps values above 100%", () => {
  const reports = [
    { date: "2026-10-01", steps: 9600 },
    { date: "2026-10-02", steps: 8000 },
  ];
  const history = [
    { effective_from: "2026-09-01", target_steps: 8000 },
    { effective_from: "2026-10-02", target_steps: 10000 },
  ];
  assert.deepEqual(sevenDaySummary("2026-10-02", reports, history), {
    reportedDays: 2,
    eligibleDays: 2,
    reachedDays: 1,
    averageSteps: 8800,
    averageCompletion: 100,
  });
});
test("average completion rounds once after averaging raw ratios", () => {
  const summary = sevenDaySummary(
    "2026-10-02",
    [
      { date: "2026-10-01", steps: 1249 },
      { date: "2026-10-02", steps: 1249 },
    ],
    [{ effective_from: "2026-09-01", target_steps: 10000 }],
  );
  assert.equal(summary.averageCompletion, 12);
});
test("same-day target replacement recalculates today and preserves yesterday", () => {
  const reports = [
    { date: "2026-10-01", steps: 8000 },
    { date: "2026-10-02", steps: 8000 },
  ];
  const old = [{ effective_from: "2026-09-01", target_steps: 8000 }];
  const changed = [
    ...old,
    { effective_from: "2026-10-02", target_steps: 10000 },
  ];
  const corrected = [
    ...old,
    { effective_from: "2026-10-02", target_steps: 9000 },
  ];
  assert.equal(
    calendarDays("2026-10", "2026-10-02", reports, changed)[0]!.percentage,
    100,
  );
  assert.equal(
    calendarDays("2026-10", "2026-10-02", reports, changed)[1]!.percentage,
    80,
  );
  assert.equal(
    calendarDays("2026-10", "2026-10-02", reports, corrected)[0]!.percentage,
    100,
  );
  assert.equal(
    calendarDays("2026-10", "2026-10-02", reports, corrected)[1]!.percentage,
    89,
  );
  assert.equal(completion(0, 9000), 0);
});
test("empty summary has no fabricated averages", () => {
  assert.deepEqual(sevenDaySummary("2026-10-02", [], []), {
    reportedDays: 0,
    eligibleDays: 0,
    reachedDays: 0,
    averageSteps: null,
    averageCompletion: null,
  });
});
test("target schema accepts only UUID and a positive storage-compatible integer", () => {
  const valid = {
    traineeId: "60000000-0000-4000-8000-000000000002",
    targetSteps: 10000,
  };
  assert.equal(targetChangeSchema.safeParse(valid).success, true);
  for (const value of [0, -1, 1.5, "", 2147483648])
    assert.equal(
      targetChangeSchema.safeParse({ ...valid, targetSteps: value }).success,
      false,
    );
  for (const extra of [
    { coachId: "other" },
    { effective_from: "2026-10-03" },
    { created_by: "other" },
  ])
    assert.equal(
      targetChangeSchema.safeParse({ ...valid, ...extra }).success,
      false,
    );
  assert.equal(
    targetChangeSchema.safeParse({ ...valid, traineeId: "not-uuid" }).success,
    false,
  );
});
test("search/pagination handle unsafe query shapes without identity parameters", () => {
  for (const page of ["0", "-1", "1.5", "2 OR true", ["2"], "2147483648"])
    assert.equal(coachQuery({ page }).page, 1);
  assert.deepEqual(coachQuery({ page: "2", q: " ישראל " }), {
    page: 2,
    search: "ישראל",
  });
  assert.equal(coachQuery({ q: ["test"] }).search, "");
});
