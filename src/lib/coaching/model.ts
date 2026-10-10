import { z } from "zod";
import { dateSchema, validDate, weekStart } from "../steps/model.ts";
import { windowSchema } from "../activity/model.ts";

export const coachingWeekStart = weekStart;
const weekSchema = dateSchema.refine(
  (date) => coachingWeekStart(date) === date,
);
const note = z.string().trim().max(500);
export const checkinInputSchema = z
  .object({
    traineeId: z.uuid(),
    weekStart: dateSchema.refine((date) =>
      [0, 1].includes(new Date(`${date}T12:00:00Z`).getUTCDay()),
    ),
    callCompleted: z.boolean(),
    callDate: dateSchema.nullable(),
    generalStatus: note,
    difficulties: note,
    agreements: note,
    nextWeekGoal: note,
    adminAttentionRequired: z.boolean(),
    adminAttentionReason: z.string().trim().max(300),
  })
  .strict()
  .refine((v) =>
    !v.callCompleted
      ? v.callDate === null
      : v.callDate !== null &&
        v.callDate >= v.weekStart &&
        v.callDate <=
          new Date(
            new Date(`${v.weekStart}T12:00:00Z`).getTime() + 6 * 86400000,
          )
            .toISOString()
            .slice(0, 10) &&
        [v.generalStatus, v.difficulties, v.agreements, v.nextWeekGoal].every(
          (text) => text.length > 0,
        ),
  )
  .refine((v) => v.adminAttentionRequired || v.adminAttentionReason === "");
export type CheckinInput = z.infer<typeof checkinInputSchema>;
export const checkinSchema = z.object({
  id: z.uuid(),
  trainee_id: z.uuid(),
  coach_id: z.uuid(),
  week_start: dateSchema,
  legacy_monday_week: z.boolean().optional().default(false),
  week_end: dateSchema,
  call_completed: z.boolean(),
  call_date: dateSchema.nullable(),
  general_status: z.string(),
  difficulties: z.string(),
  agreements: z.string(),
  next_week_goal: z.string(),
  admin_attention_required: z.boolean(),
  admin_attention_reason: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Checkin = z.infer<typeof checkinSchema>;
export const historySchema = z.object({
  total: z.number().int().nonnegative(),
  current: checkinSchema.nullable(),
  reports: z.array(checkinSchema),
  current_goal: z.string().nullable(),
  current_expected: z.boolean(),
  recent_activity: windowSchema,
  step_target: z.number().nullable(),
});
export type CoachingHistoryData = z.infer<typeof historySchema>;
export const coachingFilters = [
  "all",
  "missing",
  "attention",
  "completed",
] as const;
export type CoachingFilter = (typeof coachingFilters)[number];
export function coachingQuery(
  query: { week?: unknown; filter?: unknown; page?: unknown },
  today: string,
) {
  const week =
    typeof query.week === "string" &&
    validDate(query.week) &&
    query.week <= today
      ? coachingWeekStart(query.week)
      : coachingWeekStart(today);
  const filter = coachingFilters.find((f) => f === query.filter) ?? "all";
  return { week, filter, page: historyPage(query.page) };
}
export function historyPage(value: unknown): number {
  const page =
    typeof value === "string" && /^[1-9]\d*$/.test(value) ? Number(value) : 1;
  return Number.isInteger(page) && page <= 2147483647 ? page : 1;
}
export const oversightRowSchema = z.object({
  trainee_id: z.uuid(),
  trainee_name: z.string(),
  coach_id: z.uuid().nullable(),
  coach_name: z.string().nullable(),
  week_start: weekSchema,
  week_end: dateSchema,
  call_completed: z.boolean(),
  call_date: dateSchema.nullable(),
  last_call_date: dateSchema.nullable(),
  current_goal: z.string().nullable(),
  step_target: z.number().nullable(),
  attention_week: dateSchema.nullable(),
  attention_reason: z.string().nullable(),
  attention_checkin_id: z.uuid().nullable(),
  call_missing: z.boolean(),
  call_overdue: z.boolean(),
  prior_call_overdue: z.boolean(),
  missing_report_days: z.number().nonnegative(),
  needs_attention: z.boolean(),
});
export type OversightRow = z.infer<typeof oversightRowSchema>;
export const overviewSchema = z.object({
  week_start: weekSchema,
  week_end: dateSchema,
  total: z.number().int().nonnegative(),
  summary: z.object({
    active_trainees: z.number(),
    calls_completed: z.number(),
    calls_missing: z.number(),
    attention_cases: z.number(),
    compliance_percentage: z.number().nullable(),
  }),
  trainees: z.array(oversightRowSchema),
});
export type CoachingOverviewData = z.infer<typeof overviewSchema>;
export function coachingHref(week: string, filter: CoachingFilter, page = 1) {
  return `/admin/coaching?${new URLSearchParams({ week, filter, ...(page > 1 ? { page: String(page) } : {}) })}`;
}
