import { z } from "zod";
import {
  effectiveTarget,
  formatDate,
  stepsSchema,
  type Report,
  type Target,
} from "../steps/model.ts";

export const targetChangeSchema = z
  .object({
    traineeId: z.uuid(),
    targetSteps: stepsSchema.refine((value) => value > 0),
  })
  .strict();
export type TargetResult =
  { ok: true; targetSteps: number } | { ok: false; message: string };
export const coachDashboardSchema = z.object({
  total: z.number().int().nonnegative(),
  trainees: z.array(
    z.object({
      trainee_id: z.uuid(),
      full_name: z.string(),
      today_steps: stepsSchema.nullable(),
      today_target: z.number().int().positive().nullable(),
      last_reported_date: z.string().nullable(),
    }),
  ),
});
export function coachQuery(query: { page?: unknown; q?: unknown }) {
  const page =
    typeof query.page === "string" && /^[1-9]\d*$/.test(query.page)
      ? Number(query.page)
      : 1;
  return {
    page: Number.isInteger(page) && page <= 2147483647 ? page : 1,
    search: typeof query.q === "string" ? query.q.trim().slice(0, 200) : "",
  };
}
export function shiftDate(date: string, delta: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + delta);
  return value.toISOString().slice(0, 10);
}
export function lastReported(date: string | null, today: string): string {
  return date === null
    ? "טרם דווח"
    : date === today
      ? "היום"
      : date === shiftDate(today, -1)
        ? "אתמול"
        : formatDate(date);
}
export function sevenDaySummary(
  today: string,
  reports: Report[],
  targets: Target[],
) {
  const start = shiftDate(today, -6);
  const reported = reports.filter(
    (report) => report.date >= start && report.date <= today,
  );
  const eligible = reported.flatMap((report) => {
    const target = effectiveTarget(targets, report.date);
    return target !== null && target > 0
      ? [{ steps: report.steps, target }]
      : [];
  });
  return {
    reportedDays: reported.length,
    eligibleDays: eligible.length,
    reachedDays: eligible.filter((day) => day.steps >= day.target).length,
    averageSteps: reported.length
      ? Math.round(
          reported.reduce((sum, day) => sum + day.steps, 0) / reported.length,
        )
      : null,
    averageCompletion: eligible.length
      ? Math.round(
          eligible.reduce(
            (sum, day) => sum + (day.steps / day.target) * 100,
            0,
          ) / eligible.length,
        )
      : null,
  };
}
