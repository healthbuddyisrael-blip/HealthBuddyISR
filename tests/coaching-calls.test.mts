import test from "node:test";
import assert from "node:assert/strict";
import {
  checkinInputSchema,
  coachingWeekStart,
  coachingQuery,
  coachingHref,
  historyPage,
  type Checkin,
  type OversightRow,
  type CoachingHistoryData,
} from "../src/lib/coaching/model.ts";
import { businessDate } from "../src/lib/steps/model.ts";
import "./tsx-loader.mts";
import { createElement as h } from "react";
import { renderToStaticMarkup as render } from "react-dom/server";
const { CallFields } =
  await import("../src/components/coaching/call-fields.tsx");
const { CallHistory } =
  await import("../src/components/coaching/call-history.tsx");
const { CoachingSummary } =
  await import("../src/components/coaching/oversight-summary.tsx");
const { CoachingOversightTable } =
  await import("../src/components/coaching/oversight-table.tsx");
const { RecentCallActivity } =
  await import("../src/components/coaching/recent-activity.tsx");

const input = {
  traineeId: "a0000000-0000-4000-8000-000000000004",
  weekStart: "2026-09-27",
  callCompleted: true,
  callDate: "2026-10-03",
  generalStatus: "Good week",
  difficulties: "Work hours",
  agreements: "Morning walks",
  nextWeekGoal: "6500 + strength",
  adminAttentionRequired: true,
  adminAttentionReason: "Review schedule",
};
const report: Checkin = {
  id: "a0000000-0000-4000-8000-000000000010",
  trainee_id: input.traineeId,
  coach_id: "a0000000-0000-4000-8000-000000000002",
  week_start: input.weekStart,
  week_end: "2026-10-03",
  legacy_monday_week: false,
  call_completed: true,
  call_date: input.callDate,
  general_status: input.generalStatus,
  difficulties: input.difficulties,
  agreements: input.agreements,
  next_week_goal: input.nextWeekGoal,
  admin_attention_required: true,
  admin_attention_reason: input.adminAttentionReason,
  created_at: "2026-10-03T10:00:00Z",
  updated_at: "2026-10-03T10:00:00Z",
};
test("completed weekly call requires four concise notes and an in-week date", () => {
  assert.ok(checkinInputSchema.safeParse(input).success);
  for (const change of [
    { generalStatus: " " },
    { difficulties: "" },
    { agreements: "" },
    { nextWeekGoal: "" },
    { agreements: "x".repeat(501) },
    { adminAttentionReason: "x".repeat(301) },
    { callDate: null },
    { callDate: "2026-09-26" },
    { callDate: "2026-10-05" },
    { weekStart: "2026-09-29" },
    { traineeId: "other" },
    { coach_id: report.coach_id },
    { callCompleted: false },
    { adminAttentionRequired: false },
  ])
    assert.equal(
      checkinInputSchema.safeParse({ ...input, ...change }).success,
      false,
    );
  assert.equal(
    checkinInputSchema.parse({ ...input, generalStatus: " Good " })
      .generalStatus,
    "Good",
  );
});
test("incomplete draft can have empty notes and no call date", () => {
  assert.ok(
    checkinInputSchema.safeParse({
      ...input,
      callCompleted: false,
      callDate: null,
      generalStatus: "",
      difficulties: "",
      agreements: "",
      nextWeekGoal: "",
      adminAttentionRequired: false,
      adminAttentionReason: "",
    }).success,
  );
});
test("week transitions use Sunday-Saturday and Jerusalem business dates", () => {
  assert.equal(coachingWeekStart("2026-10-04"), "2026-10-04");
  assert.equal(coachingWeekStart("2026-10-05"), "2026-10-04");
  assert.equal(coachingWeekStart("2027-01-01"), "2026-12-27");
  assert.equal(
    coachingWeekStart(businessDate(new Date("2026-10-03T21:30:00Z"))),
    "2026-10-04",
  );
  assert.throws(() => coachingWeekStart("2026-02-30"));
});
test("admin query handling validates filters, pages and historical weeks", () => {
  assert.deepEqual(
    coachingQuery(
      { week: "2026-10-03", filter: "missing", page: "2" },
      "2026-10-04",
    ),
    { week: "2026-09-27", filter: "missing", page: 2 },
  );
  for (const week of ["2026-02-30", "2027-01-01", ["2026-09-01"], "bad"])
    assert.equal(coachingQuery({ week }, "2026-10-04").week, "2026-10-04");
  for (const page of ["0", "-1", "1.5", "2147483648", ["2"]])
    assert.equal(historyPage(page), 1);
  assert.equal(
    coachingQuery({ filter: "injection" }, "2026-10-04").filter,
    "all",
  );
  assert.equal(
    coachingHref("2026-09-27", "attention", 2),
    "/admin/coaching?week=2026-09-27&filter=attention&page=2",
  );
});
test("call form remains short, supports completion and attention, and locks edited week", () => {
  const markup = render(
    h(CallFields, { report, today: "2026-10-04", disabled: false }),
  );
  assert.equal((markup.match(/<textarea/g) ?? []).length, 5);
  assert.equal((markup.match(/checked=""/g) ?? []).length, 2);
  assert.match(
    markup,
    /<input(?=[^>]*name="weekStart")(?=[^>]*readOnly="")[^>]*>/,
  );
  assert.match(markup, /maxLength="500"/);
  assert.match(markup, /name="nextWeekGoal"/);
  const draft = render(
    h(CallFields, { report: null, today: "2026-10-04", disabled: false }),
  );
  assert.doesNotMatch(draft, /name="callDate"|name="adminAttentionReason"/);
  assert.match(draft, /טיוטה/);
  assert.equal((draft.match(/<textarea/g) ?? []).length, 4);
});
test("history exposes goal/difficulty and escalation without edit controls for admin", () => {
  const markup = render(h(CallHistory, { reports: [report] }));
  assert.match(markup, /6500 \+ strength/);
  assert.match(markup, /Work hours/);
  assert.match(markup, /Review schedule/);
  assert.match(markup, /<details/);
  assert.doesNotMatch(markup, /<input|<textarea|עדכון תיעוד/);
  assert.match(
    render(h(CallHistory, { reports: [report], onEdit: () => {} })),
    /עדכון תיעוד/,
  );
});
test("admin compliance summary preserves zero numerator and empty denominator", () => {
  const empty = render(
    h(CoachingSummary, {
      summary: {
        active_trainees: 0,
        calls_completed: 0,
        calls_missing: 0,
        attention_cases: 0,
        compliance_percentage: null,
      },
    }),
  );
  assert.match(empty, /—/);
  assert.doesNotMatch(empty, /0%/);
  const full = render(
    h(CoachingSummary, {
      summary: {
        active_trainees: 40,
        calls_completed: 34,
        calls_missing: 6,
        attention_cases: 6,
        compliance_percentage: 85,
      },
    }),
  );
  assert.match(full, /85%/);
  assert.match(full, />34</);
  assert.match(full, />6</);
});
test("admin list surfaces goal, step target, missing calls, unassigned and explicit attention", () => {
  const row: OversightRow = {
    trainee_id: input.traineeId,
    trainee_name: "Trainee",
    coach_id: null,
    coach_name: null,
    week_start: input.weekStart,
    week_end: "2026-10-03",
    call_completed: false,
    call_date: null,
    last_call_date: "2026-09-26",
    current_goal: "6500 + strength",
    step_target: 6500,
    attention_week: "2026-09-21",
    attention_reason: "Review schedule",
    attention_checkin_id: report.id,
    call_missing: true,
    call_overdue: true,
    prior_call_overdue: true,
    missing_report_days: 4,
    needs_attention: true,
  };
  const markup = render(h(CoachingOversightTable, { trainees: [row] }));
  assert.match(markup, /6500 \+ strength/);
  assert.match(markup, /6,500/);
  assert.match(markup, /אין מאמן משויך/);
  assert.match(markup, /באיחור/);
  assert.match(markup, /Review schedule/);
  assert.match(markup, /href="\/admin\/coaching\/a0000000/);
  assert.doesNotMatch(markup, /<input|<form/);
});
test("recent call activity displays observations without manual activity entry or fabricated zeros", () => {
  const data: CoachingHistoryData = {
    total: 1,
    current: report,
    reports: [report],
    current_goal: report.next_week_goal,
    current_expected: true,
    step_target: 6000,
    recent_activity: {
      average_daily_steps: 5840,
      step_days: 5,
      strength_days: 5,
      cardio_days: 0,
      strength_sessions: 1,
      cardio_sessions: 0,
      strength_sessions_per_week: null,
      cardio_sessions_per_week: null,
    },
  };
  const markup = render(h(RecentCallActivity, { data }));
  assert.match(markup, /5,840/);
  assert.match(markup, /6,000/);
  assert.match(markup, /5\/7/);
  assert.match(markup, /אימוני אירובי: —/);
  assert.doesNotMatch(markup, /<input|<textarea/);
});
