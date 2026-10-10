import { z } from "zod";
import { dateSchema } from "../steps/model.ts";

export const baselineInputSchema = z
  .object({
    traineeId: z.uuid(),
    programStart: dateSchema,
    programEnd: dateSchema,
    manualSteps: z.number().min(0).max(2147483647).nullable(),
    strength: z.number().min(0).max(7),
    cardio: z.number().min(0).max(7),
  })
  .strict()
  .refine(
    (v) =>
      new Date(v.programEnd).getTime() - new Date(v.programStart).getTime() >=
      13 * 86400000,
  );
export const windowSchema = z.object({
  average_daily_steps: z.number().nullable(),
  step_days: z.number(),
  strength_days: z.number(),
  cardio_days: z.number(),
  strength_sessions: z.number(),
  cardio_sessions: z.number(),
  strength_sessions_per_week: z.number().nullable(),
  cardio_sessions_per_week: z.number().nullable(),
});
export const progressSchema = z.object({
  baseline: z.object({
    baseline_average_daily_steps: z.number(),
    baseline_strength_sessions_per_week: z.number(),
    baseline_cardio_sessions_per_week: z.number(),
    baseline_period_start: dateSchema,
    baseline_period_end: dateSchema,
    program_start: dateSchema,
    program_end: dateSchema,
    steps_source: z.enum(["historical", "manual"]),
  }),
  window_start: dateSchema,
  window_end: dateSchema,
  completed: z.boolean(),
  current: windowSchema,
});
export type ActivityProgressData = z.infer<typeof progressSchema>;
export const weeklySchema = z.object({
  week_start: dateSchema,
  average_daily_steps: z.number(),
  step_days: z.number(),
  strength_days: z.number(),
  cardio_days: z.number(),
  strength_sessions: z.number().nullable(),
  cardio_sessions: z.number().nullable(),
});
export type ActivityData = {
  progress: ActivityProgressData | null;
  weeks: z.infer<typeof weeklySchema>[];
};
export function activityChange(baseline: number, current: number | null) {
  return {
    absolute: current === null ? null : current - baseline,
    percentage:
      current === null || baseline === 0
        ? null
        : ((current - baseline) * 100) / baseline,
  };
}
