import { z } from "zod";
import { coachQuery } from "../coach/model.ts";
import { dateSchema, stepsSchema } from "../steps/model.ts";

export type AnalyticsRange = 7 | 30;
export function adminQuery(query: {
  range?: unknown;
  page?: unknown;
  q?: unknown;
}) {
  return {
    ...coachQuery(query),
    range: (query.range === "30" ? 30 : 7) as AnalyticsRange,
  };
}
export function percentText(value: number | null): string {
  return value === null ? "—" : `${Math.round(value)}%`;
}
const count = z.number().int().nonnegative();
const percent = z.number().nonnegative().nullable();
export const metricsSchema = z.object({
  trainee_count: count,
  active_trainee_count: count,
  reported_days: count,
  expected_days: count,
  eligible_reported_days: count,
  target_reached_days: count,
  reporting_rate: percent,
  target_attainment_rate: percent,
  average_completion: percent,
});
export type Metrics = z.infer<typeof metricsSchema>;
export const adminCoachSchema = metricsSchema.extend({
  coach_id: z.uuid(),
  full_name: z.string(),
  email: z.email(),
});
export const adminTraineeSchema = metricsSchema.extend({
  trainee_id: z.uuid(),
  full_name: z.string(),
  today_steps: stepsSchema.nullable(),
  today_target: z.number().int().positive().nullable(),
  last_reported_date: dateSchema.nullable(),
});
export const overviewSchema = z.object({
  today: dateSchema,
  range_days: z.union([z.literal(7), z.literal(30)]),
  summary: metricsSchema.extend({ coach_count: count }),
  total: count,
  coaches: z.array(adminCoachSchema),
});
export const detailSchema = z.object({
  today: dateSchema,
  range_days: z.union([z.literal(7), z.literal(30)]),
  coach: adminCoachSchema,
  total: count,
  trainees: z.array(adminTraineeSchema),
});
export const traineeAnalyticsSchema = metricsSchema.extend({
  trainee_id: z.uuid(),
  full_name: z.string(),
  today: dateSchema,
  range_days: z.union([z.literal(7), z.literal(30)]),
});
