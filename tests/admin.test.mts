import test from "node:test";
import assert from "node:assert/strict";
import {
  adminQuery,
  percentText,
  metricsSchema,
  overviewSchema,
} from "../src/lib/admin/model.ts";

test("only 7/30-day URL windows are accepted and unsafe inputs fall back", () => {
  assert.equal(adminQuery({ range: "30" }).range, 30);
  assert.equal(adminQuery({ range: "7" }).range, 7);
  for (const range of [undefined, "0", "31", "7 OR true", ["30"], 30])
    assert.equal(adminQuery({ range }).range, 7);
  assert.deepEqual(adminQuery({ range: "30", page: "2", q: " נועם " }), {
    range: 30,
    page: 2,
    search: "נועם",
  });
});
test("analytics percentages round only for display, preserve null and exceed 100%", () => {
  assert.equal(percentText(null), "—");
  assert.equal(percentText(0), "0%");
  assert.equal(percentText(74.4), "74%");
  assert.equal(percentText(74.5), "75%");
  assert.equal(percentText(150), "150%");
});
test("analytics result validation retains explicit denominator counts and missing ratios", () => {
  const metrics = {
    trainee_count: 0,
    active_trainee_count: 0,
    reported_days: 0,
    expected_days: 0,
    eligible_reported_days: 0,
    target_reached_days: 0,
    reporting_rate: null,
    target_attainment_rate: null,
    average_completion: null,
  };
  assert.deepEqual(metricsSchema.parse(metrics), metrics);
  assert.equal(
    overviewSchema.safeParse({
      today: "2026-10-10",
      range_days: 7,
      summary: { ...metrics, coach_count: 0 },
      total: 0,
      coaches: [],
    }).success,
    true,
  );
  assert.equal(
    overviewSchema.safeParse({
      today: "2026-02-29",
      range_days: 7,
      summary: { ...metrics, coach_count: 0 },
      total: 0,
      coaches: [],
    }).success,
    false,
  );
});
