import test from "node:test";
import assert from "node:assert/strict";
import {
  weekStart,
  weekBounds,
  adjacentWeek,
  selectedWeek,
  weeklyCalendarDays,
} from "../src/lib/steps/model.ts";
import "./tsx-loader.mts";
import { createElement as h } from "react";
import { renderWithRouter as render } from "./calendar-renderer.mts";
const { WeeklyStepCalendar, CalendarDay } =
  await import("../src/components/steps/weekly-step-calendar.tsx");

test("weekly dates cross month, leap-year and year boundaries consistently", () => {
  assert.equal(weekStart("2026-10-04"), "2026-10-04");
  assert.deepEqual(weekBounds("2026-10-01"), {
    start: "2026-09-27",
    end: "2026-10-03",
  });
  assert.equal(adjacentWeek("2026-09-27", 1), "2026-10-04");
  assert.equal(adjacentWeek("2026-01-04", -1), "2025-12-28");
  assert.deepEqual(weekBounds("2024-02-29"), {
    start: "2024-02-25",
    end: "2024-03-02",
  });
  assert.equal(adjacentWeek("0001-01-07", -1), null);
});
test("week selection rejects future/invalid queries and retains old month links", () => {
  for (const value of ["2026-02-30", "2026-10-05", ["2026-09-01"], "invalid"])
    assert.equal(selectedWeek(value, "2026-10-04"), "2026-10-04");
  assert.equal(selectedWeek("2026-09-25", "2026-10-04"), "2026-09-20");
  assert.equal(selectedWeek(undefined, "2026-10-04", "2026-09"), "2026-08-30");
});
test("weekly reports preserve zero, unknown workouts and historical targets across months", () => {
  const days = weeklyCalendarDays(
    "2026-09-27",
    "2026-10-02",
    [
      { date: "2026-09-30", steps: 0 },
      {
        date: "2026-10-01",
        steps: 6000,
        strength_workout_completed: true,
        cardio_workout_completed: false,
      },
    ],
    [
      { effective_from: "2026-09-01", target_steps: 5000 },
      { effective_from: "2026-10-01", target_steps: 6000 },
    ],
  );
  assert.equal(days.length, 7);
  assert.equal(days[0]!.date, "2026-09-27");
  assert.equal(days[6]!.date, "2026-10-03");
  assert.equal(days[3]!.steps, 0);
  assert.equal(days[3]!.target, 5000);
  assert.equal(days[3]!.strength_workout_completed, null);
  assert.equal(days[4]!.percentage, 100);
  assert.equal(days[4]!.strength_workout_completed, true);
  assert.equal(days[5]!.steps, null);
  assert.equal(days[6]!.future, true);
});
test("weekly calendar renders seven day controls and preserves history pagination", () => {
  const markup = render(
    h(WeeklyStepCalendar, {
      week: "2026-09-27",
      today: "2026-10-02",
      days: weeklyCalendarDays("2026-09-27", "2026-10-02", [], []),
      onEdit: () => {},
      pending: false,
      basePath: "/coach/trainees/test",
      callsPage: 2,
    }),
  );
  assert.equal((markup.match(/type="button"/g) ?? []).length, 7);
  assert.match(markup, /week=2026-09-20&amp;callsPage=2/);
  assert.doesNotMatch(markup, /href="[^"]*week=2026-10-04|month=/);
  assert.match(markup, /aria-label="השבוע הבא"/);
  assert.match(markup, /aria-current="date"/);
});
test("previous weeks offer forward navigation back to the current week", () => {
  const markup = render(
    h(WeeklyStepCalendar, {
      week: "2026-09-20",
      today: "2026-10-02",
      days: weeklyCalendarDays("2026-09-20", "2026-10-02", [], []),
      onEdit: () => {},
      pending: false,
    }),
  );
  assert.match(markup, /href="\/app\?week=2026-09-27"/);
});
test("days show animated loading and cannot open stale reports while loading", () => {
  const day = weeklyCalendarDays("2026-09-27", "2026-10-02", [], [])[0]!;
  const markup = render(
    h(CalendarDay, {
      day,
      today: "2026-10-02",
      onEdit: () => {},
      loading: true,
    }),
  );
  assert.match(markup, /disabled=""/);
  assert.match(markup, /aria-busy="true"/);
  assert.match(markup, /animate-spin/);
  assert.match(markup, /טוענים דיווח יומי/);
});
