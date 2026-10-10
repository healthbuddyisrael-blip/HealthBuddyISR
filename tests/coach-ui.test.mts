import test from "node:test";
import assert from "node:assert/strict";
import "./tsx-loader.mts";
import { createElement } from "react";
import { renderWithRouter as renderToStaticMarkup } from "./calendar-renderer.mts";
import { weeklyCalendarDays } from "../src/lib/steps/model.ts";

const { DayDetailDialog } =
  await import("../src/components/coach/day-detail-dialog.tsx");
const { WeeklyStepCalendar } =
  await import("../src/components/steps/weekly-step-calendar.tsx");

test("coach day detail renders real data with no edit input, form, or save action", () => {
  const markup = renderToStaticMarkup(
    createElement(DayDetailDialog, {
      day: {
        date: "2026-10-01",
        steps: 11000,
        target: 10000,
        percentage: 110,
        future: false,
      },
      onClose: () => {},
    }),
  );
  assert.match(markup, /11,000/);
  assert.match(markup, /10,000/);
  assert.match(markup, /110%/);
  assert.doesNotMatch(markup, /<input|<form|שמירה/);
  assert.match(markup, /aria-labelledby="day-detail-title"/);
});
test("read-only day detail preserves missing and zero states", () => {
  const base = { date: "2026-10-01", target: 10000, future: false };
  const missing = renderToStaticMarkup(
    createElement(DayDetailDialog, {
      day: { ...base, steps: null, percentage: null },
      onClose: () => {},
    }),
  );
  const zero = renderToStaticMarkup(
    createElement(DayDetailDialog, {
      day: { ...base, steps: 0, percentage: 0 },
      onClose: () => {},
    }),
  );
  assert.match(missing, /לא דווח/);
  assert.doesNotMatch(missing, /0%/);
  assert.match(zero, /0%/);
  assert.doesNotMatch(zero, /לא דווח/);
});
test("coach calendar navigation stays on the owned detail route; future days are disabled", () => {
  const path = "/coach/trainees/70000000-0000-4000-8000-000000000003";
  const markup = renderToStaticMarkup(
    createElement(WeeklyStepCalendar, {
      week: "2026-09-27",
      today: "2026-10-02",
      days: weeklyCalendarDays("2026-09-27", "2026-10-02", [], []),
      pending: false,
      basePath: path,
      onEdit: () => {},
    }),
  );
  assert.match(markup, new RegExp(`${path}\\?week=2026-09-20`));
  assert.doesNotMatch(markup, /href="\/app|week=2026-10-04/);
  assert.match(markup, /<button[^>]*disabled=""[^>]*aria-label="3 באוקטובר/);
  assert.doesNotMatch(markup, /<input|<form/);
});
