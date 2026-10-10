import test from "node:test";
import assert from "node:assert/strict";
import "./tsx-loader.mts";
import { createElement } from "react";
import { renderWithRouter as renderToStaticMarkup } from "./calendar-renderer.mts";
import { weeklyCalendarDays } from "../src/lib/steps/model.ts";

const { AnalyticsMetrics, TraineeAnalyticsMetrics } =
  await import("../src/components/admin/analytics-metrics.tsx");
const { TraineeAnalyticsList } =
  await import("../src/components/admin/trainee-analytics-list.tsx");
const { RangeControls, AnalyticsPagination, AnalyticsSearch } =
  await import("../src/components/admin/analytics-controls.tsx");
const { ReadOnlyStepCalendar } =
  await import("../src/components/steps/read-only-step-calendar.tsx");
const empty = {
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
test("system no-data metrics display null percentages as dashes", () => {
  const markup = renderToStaticMarkup(
    createElement(AnalyticsMetrics, {
      metrics: { ...empty, coach_count: 0 },
      system: true,
    }),
  );
  assert.match(markup, /אחוז עמידה ביעד/);
  assert.match(markup, /ממוצע השלמת יעד/);
  assert.match(markup, /—/);
  assert.doesNotMatch(markup, /0%/);
});
test("trainee metrics distinguish reporting and attainment denominators", () => {
  const markup = renderToStaticMarkup(
    createElement(TraineeAnalyticsMetrics, {
      metrics: {
        ...empty,
        trainee_count: 1,
        active_trainee_count: 1,
        reported_days: 4,
        expected_days: 7,
        eligible_reported_days: 4,
        target_reached_days: 3,
        reporting_rate: 400 / 7,
        target_attainment_rate: 75,
        average_completion: 120,
      },
    }),
  );
  assert.match(markup, /4 מתוך 7 ימים/);
  assert.match(markup, /3 מתוך 4 ימים שדווחו עם יעד/);
  assert.match(markup, /57%/);
  assert.match(markup, /75%/);
  assert.match(markup, /120%/);
});
test("admin trainee cards preserve missing today data and expose no mutation controls", () => {
  const trainee = {
    ...empty,
    trainee_count: 1,
    trainee_id: "80000000-0000-4000-8000-000000000005",
    full_name: "ישראל",
    today_steps: null,
    today_target: 10000,
    last_reported_date: null,
  };
  const markup = renderToStaticMarkup(
    createElement(TraineeAnalyticsList, {
      trainees: [trainee],
      coachId: "80000000-0000-4000-8000-000000000002",
      today: "2026-10-10",
      range: 30,
    }),
  );
  assert.match(markup, /לא דווח/);
  assert.match(markup, /10,000/);
  assert.match(markup, /טרם דווח/);
  assert.match(markup, /\/admin\/coaches\/.+\/trainees\/.+\?range=30/);
  assert.doesNotMatch(markup, /0%|שינוי יעד|עריכת צעדים|שמירה|<input/);
});
test("range/search/pagination links preserve selected range and stay in admin routes", () => {
  const range = renderToStaticMarkup(
    createElement(RangeControls, { path: "/admin", range: 7, search: "ישראל" }),
  );
  const pagination = renderToStaticMarkup(
    createElement(AnalyticsPagination, {
      path: "/admin",
      range: 30,
      search: "coach",
      page: 1,
      total: 26,
    }),
  );
  const search = renderToStaticMarkup(
    createElement(AnalyticsSearch, {
      path: "/admin",
      range: 30,
      search: "",
      label: "חיפוש מאמן",
    }),
  );
  assert.match(range, /range=30/);
  assert.match(range, /aria-current="page"/);
  assert.match(pagination, /range=30&amp;page=2&amp;q=coach/);
  assert.match(search, /name="range" value="30"/);
  assert.match(search, /for="analytics-search"/);
});
test("read-only admin calendar retains coach/trainee pairing and range across week navigation", () => {
  const path =
    "/admin/coaches/80000000-0000-4000-8000-000000000002/trainees/80000000-0000-4000-8000-000000000005";
  const markup = renderToStaticMarkup(
    createElement(ReadOnlyStepCalendar, {
      days: weeklyCalendarDays("2026-10-04", "2026-10-10", [], []),
      today: "2026-10-10",
      week: "2026-10-04",
      basePath: path,
      range: 30,
    }),
  );
  assert.match(markup, new RegExp(`${path}\\?week=2026-09-27&amp;range=30`));
  assert.doesNotMatch(
    markup,
    /href="\/coach|href="\/app|<input|שינוי יעד|עריכת צעדים/,
  );
});
