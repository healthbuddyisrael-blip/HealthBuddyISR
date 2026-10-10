import test from "node:test";
import assert from "node:assert/strict";
import { businessDate } from "../src/lib/steps/model.ts";
import {
  imageExtension,
  pilotWeek,
  reportInputSchema,
  reportingWeek,
  reportOverdue,
  screenshotLimit,
  type PilotOverview,
  type PilotDetail,
} from "../src/lib/pilot/model.ts";
import "./tsx-loader.mts";
import { createElement as h } from "react";
import { renderWithRouter as render } from "./calendar-renderer.mts";
const { PilotOverviewTable } =
  await import("../src/components/pilot/overview.tsx");
const { ReportWorkspace } =
  await import("../src/components/pilot/report-workspace.tsx");
const id = "c0000000-0000-4000-8000-000000000004";
const input = {
  trainee_id: id,
  week_start: "2026-10-04",
  status: "submitted" as const,
  revision: null,
  average_daily_steps: 6450.25,
  strength_workouts: 1,
  aerobic_workouts: 2,
  call_completed: true,
  call_date: "2026-10-11",
  general_feeling: "Good",
  difficulties: "None",
  progress: "Walking",
  agreements: "Continue",
  next_week_goal: "Walk after lunch",
  attention_required: false,
};
test("Sunday follow-up covers preceding Sunday/Saturday, including Jerusalem midnight and year boundaries", () => {
  assert.equal(reportingWeek("2026-10-11"), "2026-10-04");
  assert.equal(
    reportingWeek(businessDate(new Date("2026-10-10T21:30:00Z"))),
    "2026-10-04",
  );
  assert.equal(reportingWeek("2027-01-03"), "2026-12-27");
  assert.equal(pilotWeek("2026-09-30", "2026-10-11"), "2026-09-27");
  assert.equal(pilotWeek("2026-10-12", "2026-10-11"), "2026-10-04");
  assert.equal(reportOverdue("2026-10-04", "2026-10-11"), false);
  assert.equal(reportOverdue("2026-10-04", "2026-10-12"), true);
});
test("draft and conversation status independent; submission requires activities, notes and a post-week date", () => {
  assert.ok(reportInputSchema.safeParse(input).success);
  assert.ok(
    reportInputSchema.safeParse({
      ...input,
      status: "draft",
      average_daily_steps: null,
      progress: "",
    }).success,
  );
  assert.ok(
    reportInputSchema.safeParse({ ...input, call_date: "2026-10-20" }).success,
    "late call retains original reporting period",
  );
  for (const invalid of [
    { strength_workouts: -1 },
    { strength_workouts: 1.5 },
    { aerobic_workouts: -1 },
    { average_daily_steps: -1 },
    { call_date: "2026-10-10" },
    { call_completed: false },
    { next_week_goal: "" },
    { week_start: "2026-10-05" },
  ])
    assert.equal(
      reportInputSchema.safeParse({ ...input, ...invalid }).success,
      false,
    );
});
test("screenshot byte signatures, MIME and size validated; SVG and mislabeled files rejected", () => {
  assert.equal(
    imageExtension(Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10), "image/png"),
    "png",
  );
  assert.equal(
    imageExtension(Uint8Array.of(255, 216, 255, 0), "image/jpeg"),
    "jpg",
  );
  assert.equal(
    imageExtension(new TextEncoder().encode("RIFF1234WEBP"), "image/webp"),
    "webp",
  );
  assert.throws(() =>
    imageExtension(new Uint8Array(screenshotLimit + 1), "image/png"),
  );
  assert.throws(() =>
    imageExtension(new TextEncoder().encode("<svg></svg>"), "image/svg+xml"),
  );
  assert.throws(() =>
    imageExtension(Uint8Array.of(255, 216, 255), "image/png"),
  );
});
const overview: PilotOverview = {
  week_start: "2026-10-04",
  week_end: "2026-10-10",
  total: 1,
  summary: {
    participants: 1,
    submitted: 1,
    missing: 0,
    conversations: 1,
    pending_conversations: 0,
    overdue: 0,
    completion_rate: 100,
  },
  coaches: [],
  participants: [
    {
      trainee_id: id,
      trainee_name: "משתתפת",
      coach_id: null,
      coach_name: "מאמן",
      status: "submitted",
      call_completed: true,
      call_date: "2026-10-11",
      last_call_date: "2026-10-11",
      average_daily_steps: 6450.25,
      strength_workouts: 1,
      aerobic_workouts: 2,
      source: "manual_coach",
      next_week_goal: "Walk after lunch",
      difficulties: "None",
      attention_required: false,
      overdue: false,
      previous_goal_met: true,
      step_change: 450.25,
      goals_met_recent: 2,
    },
  ],
};
test("coach/admin overview displays average, one strength and two aerobic independently", () => {
  for (const admin of [true, false]) {
    const markup = render(
      h(PilotOverviewTable, { data: overview, admin, today: "2026-10-11" }),
    );
    assert.match(markup, /6,450/);
    assert.match(markup, /אימוני כוח: 1/);
    assert.match(markup, /אירובי: 2/);
    assert.doesNotMatch(markup, /45,151|אימוני כוח: 7/);
  }
});
export const detail: PilotDetail = {
  name: "משתתפת",
  traineeId: id,
  week: "2026-10-04",
  startsOn: "2026-10-04",
  endsOn: null,
  report: null,
  reports: [],
  figures: [
    {
      week_start: "2026-10-04",
      average_daily_steps: 6450.25,
      strength_workouts: 1,
      aerobic_workouts: 2,
      source: "manual_coach",
      step_days: 7,
    },
  ],
  total: 0,
  page: 1,
  screenshotUrl: null,
  readOnly: false,
  today: "2026-10-11",
};
test("mobile form has draft/submit, private image input, all five notes; participant view has no entry form", () => {
  const coach = render(
    h(ReportWorkspace, { data: detail, basePath: "/coach/trainees/" + id }),
  );
  assert.match(coach, /type="file"/);
  assert.match(coach, /שמירת טיוטה/);
  assert.match(coach, /הגשת דיווח/);
  assert.equal((coach.match(/<textarea/g) ?? []).length, 5);
  assert.doesNotMatch(coach, /OCR|HealthKit|apple/i);
  const participant = render(
    h(ReportWorkspace, {
      data: { ...detail, readOnly: true },
      basePath: "/app",
      participant: true,
    }),
  );
  assert.doesNotMatch(
    participant,
    /type="file"|<textarea|name="average_daily_steps"/,
  );
  assert.match(participant, /אין צורך בדיווח עצמאי/);
});
