import { z } from "zod";
import {
  adjacentWeek,
  businessDate,
  dateSchema,
  validDate,
  weekBounds,
  weekStart,
} from "../steps/model.ts";
export const screenshotBucket = "pilot-step-evidence";
export const screenshotLimit = 3 * 1024 * 1024;
export function reportingWeek(today = businessDate()) {
  return adjacentWeek(weekStart(today), -1)!;
}
export function pilotWeek(value: unknown, today = businessDate()) {
  return typeof value === "string" &&
    validDate(value) &&
    weekBounds(value).end < today
    ? weekStart(value)
    : reportingWeek(today);
}
export function reportOverdue(week: string, today: string) {
  return today > adjacentWeek(week, 1)!;
}
const note = z.string().trim().max(500);
export const reportInputSchema = z
  .object({
    trainee_id: z.uuid(),
    week_start: dateSchema.refine((v) => weekStart(v) === v),
    status: z.enum(["draft", "submitted"]),
    revision: z.number().int().positive().nullable(),
    average_daily_steps: z
      .number()
      .min(0)
      .max(2147483647)
      .multipleOf(0.01)
      .nullable(),
    strength_workouts: z.number().int().min(0).max(2147483647).nullable(),
    aerobic_workouts: z.number().int().min(0).max(2147483647).nullable(),
    call_completed: z.boolean(),
    call_date: dateSchema.nullable(),
    general_feeling: note,
    difficulties: note,
    progress: note,
    agreements: note,
    next_week_goal: note,
    attention_required: z.boolean(),
    previous_goal_met: z.boolean().nullable().optional().default(null),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (
      v.call_completed
        ? v.call_date === null || v.call_date <= weekBounds(v.week_start).end
        : v.call_date !== null
    )
      ctx.addIssue({
        code: "custom",
        path: ["call_date"],
        message: "תאריך השיחה צריך להיות אחרי סיום שבוע הפעילות.",
      });
    if (
      v.status === "submitted" &&
      (!v.call_completed ||
        v.average_daily_steps === null ||
        v.strength_workouts === null ||
        v.aerobic_workouts === null ||
        [
          v.general_feeling,
          v.difficulties,
          v.progress,
          v.agreements,
          v.next_week_goal,
        ].some((x) => !x))
    )
      ctx.addIssue({
        code: "custom",
        message:
          "להגשה יש להשלים נתוני פעילות, שיחה וכל שדות המעקב. אפשר לשמור טיוטה.",
      });
  });
export type PilotInput = z.infer<typeof reportInputSchema>;
export const pilotReportSchema = z.object({
  id: z.uuid(),
  trainee_id: z.uuid(),
  coach_id: z.uuid(),
  week_start: dateSchema,
  week_end: dateSchema,
  source: z.literal("manual_coach"),
  status: z.enum(["draft", "submitted"]),
  revision: z.number().int(),
  average_daily_steps: z.number().nullable(),
  strength_workouts: z.number().nullable(),
  aerobic_workouts: z.number().nullable(),
  screenshot_path: z.string().nullable(),
  call_completed: z.boolean(),
  call_date: dateSchema.nullable(),
  general_feeling: z.string(),
  difficulties: z.string(),
  progress: z.string(),
  agreements: z.string(),
  next_week_goal: z.string(),
  attention_required: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  submitted_at: z.string().nullable(),
  previous_goal_met: z.boolean().nullable(),
});
export type PilotReport = z.infer<typeof pilotReportSchema>;
export const figuresSchema = z.object({
  week_start: dateSchema,
  average_daily_steps: z.number().nullable(),
  strength_workouts: z.number().nullable(),
  aerobic_workouts: z.number().nullable(),
  source: z.enum(["manual_coach", "historical_daily"]),
  step_days: z.number(),
});
export type PilotFigures = z.infer<typeof figuresSchema>;
export const overviewSchema = z.object({
  week_start: dateSchema,
  week_end: dateSchema,
  total: z.number(),
  summary: z.object({
    participants: z.number(),
    submitted: z.number(),
    missing: z.number(),
    conversations: z.number(),
    pending_conversations: z.number(),
    overdue: z.number(),
    completion_rate: z.number().nullable(),
  }),
  coaches: z.array(
    z.object({
      coach_id: z.uuid(),
      coach_name: z.string(),
      participants: z.number(),
      submitted: z.number(),
      conversations: z.number(),
    }),
  ),
  participants: z.array(
    z.object({
      trainee_id: z.uuid(),
      trainee_name: z.string(),
      coach_id: z.uuid().nullable(),
      coach_name: z.string().nullable(),
      status: z.enum(["missing", "draft", "submitted"]),
      call_completed: z.boolean(),
      call_date: dateSchema.nullable(),
      last_call_date: dateSchema.nullable(),
      average_daily_steps: z.number().nullable(),
      strength_workouts: z.number().nullable(),
      aerobic_workouts: z.number().nullable(),
      source: z.string().nullable(),
      next_week_goal: z.string().nullable(),
      difficulties: z.string().nullable(),
      attention_required: z.boolean(),
      overdue: z.boolean(),
      previous_goal_met: z.boolean().nullable().optional().default(null),
      step_change: z.number().nullable().optional().default(null),
      goals_met_recent: z.number().optional().default(0),
    }),
  ),
});
export type PilotOverview = z.infer<typeof overviewSchema>;
export type PilotDetail = {
  name: string;
  traineeId: string;
  week: string;
  startsOn: string;
  endsOn: string | null;
  report: PilotReport | null;
  reports: PilotReport[];
  figures: PilotFigures[];
  total: number;
  page: number;
  screenshotUrl: string | null;
  readOnly: boolean;
  today: string;
};
export function imageExtension(bytes: Uint8Array, mime: string) {
  if (bytes.length === 0 || bytes.length > screenshotLimit)
    throw new Error("התמונה צריכה להיות עד 3MB.");
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b);
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const text = (start: number, end: number) =>
    String.fromCharCode(...bytes.slice(start, end));
  const webp = text(0, 4) === "RIFF" && text(8, 12) === "WEBP";
  if (mime === "image/png" && png) return "png";
  if (mime === "image/jpeg" && jpeg) return "jpg";
  if (mime === "image/webp" && webp) return "webp";
  throw new Error("אפשר להעלות תמונת PNG, JPEG או WebP בלבד.");
}
