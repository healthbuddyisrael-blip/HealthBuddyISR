import { z } from "zod";
import { APP_LOCALE, APP_TIMEZONE } from "../config.ts";

export function businessDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000"))
    return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}
export const dateSchema = z.string().refine(validDate);
// PostgreSQL integer storage limit, not a product limit.
export const stepsSchema = z.number().int().min(0).max(2147483647);
const workoutFields = {
  strength_workout_completed: z.boolean().nullable().optional(),
  cardio_workout_completed: z.boolean().nullable().optional(),
};
export const saveStepsSchema = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("today"), steps: stepsSchema, ...workoutFields })
    .strict(),
  z
    .object({
      kind: z.literal("historical"),
      date: dateSchema,
      steps: stepsSchema,
      ...workoutFields,
    })
    .strict(),
]);
export type SaveStepsInput = z.infer<typeof saveStepsSchema>;
export type SaveStepsResult = { ok: true } | { ok: false; message: string };
export type Target = { effective_from: string; target_steps: number };
export type Report = {
  date: string;
  steps: number;
  strength_workout_completed?: boolean | null;
  cardio_workout_completed?: boolean | null;
};
export type Day = {
  date: string;
  steps: number | null;
  target: number | null;
  percentage: number | null;
  future: boolean;
  strength_workout_completed?: boolean | null;
  cardio_workout_completed?: boolean | null;
};
export function effectiveTarget(
  targets: Target[],
  date: string,
): number | null {
  let selected: Target | undefined;
  for (const target of targets)
    if (
      target.effective_from <= date &&
      (!selected || target.effective_from > selected.effective_from)
    )
      selected = target;
  return selected?.target_steps ?? null;
}
export function completion(
  steps: number | null,
  target: number | null,
): number | null {
  return steps === null || target === null || target <= 0
    ? null
    : Math.round((steps / target) * 100);
}
export function visualProgress(percentage: number | null): number {
  return Math.min(Math.max(percentage ?? 0, 0), 100);
}
export function weekStart(date: string): string {
  if (!validDate(date)) throw new Error("Invalid date");
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() - value.getUTCDay());
  return value.toISOString().slice(0, 10);
}
export function adjacentWeek(week: string, delta: number): string | null {
  const value = new Date(`${weekStart(week)}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + delta * 7);
  return value.getUTCFullYear() < 1 || value.getUTCFullYear() > 9999
    ? null
    : value.toISOString().slice(0, 10);
}
export function weekBounds(week: string) {
  const start = weekStart(week),
    end = new Date(`${start}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 6);
  return { start, end: end.toISOString().slice(0, 10) };
}
export function selectedWeek(
  value: unknown,
  today: string,
  legacyMonth?: unknown,
): string {
  if (
    typeof value === "string" &&
    validDate(value) &&
    value <= today &&
    validDate(weekStart(value))
  )
    return weekStart(value);
  if (
    value === undefined &&
    typeof legacyMonth === "string" &&
    selectedMonth(legacyMonth, today) === legacyMonth
  )
    return weekStart(`${legacyMonth}-01`);
  return weekStart(today);
}
export function selectedMonth(value: unknown, today: string): string {
  const current = today.slice(0, 7);
  return typeof value === "string" &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(value) &&
    validDate(`${value}-01`) &&
    value <= current
    ? value
    : current;
}
export function monthBounds(month: string) {
  const start = `${month}-01`;
  if (!validDate(start)) throw new Error("Invalid month");
  const date = new Date(`${start}T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1, 0);
  return {
    start,
    end: date.toISOString().slice(0, 10),
    days: date.getUTCDate(),
    offset: new Date(`${start}T12:00:00Z`).getUTCDay(),
  };
}
export function adjacentMonth(month: string, delta: number): string | null {
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + delta);
  const year = date.getUTCFullYear();
  return year < 1 || year > 9999 ? null : date.toISOString().slice(0, 7);
}
export function calendarDays(
  month: string,
  today: string,
  reports: Report[],
  targets: Target[],
): Day[] {
  const dates = Array.from(
    { length: monthBounds(month).days },
    (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`,
  );
  return activityDays(dates, today, reports, targets);
}
export function weeklyCalendarDays(
  week: string,
  today: string,
  reports: Report[],
  targets: Target[],
): Day[] {
  const start = weekStart(week);
  const dates = Array.from({ length: 7 }, (_, index) => {
    const value = new Date(`${start}T12:00:00Z`);
    value.setUTCDate(value.getUTCDate() + index);
    return value.toISOString().slice(0, 10);
  });
  return activityDays(dates, today, reports, targets);
}
function activityDays(
  dates: string[],
  today: string,
  reports: Report[],
  targets: Target[],
): Day[] {
  const lookup = new Map(reports.map((report) => [report.date, report]));
  return dates.map((date) => {
    const report = lookup.get(date);
    const steps = report?.steps ?? null;
    const target = effectiveTarget(targets, date);
    return {
      date,
      steps,
      target,
      percentage: completion(steps, target),
      future: date > today,
      strength_workout_completed: report?.strength_workout_completed ?? null,
      cardio_workout_completed: report?.cardio_workout_completed ?? null,
    };
  });
}
export function formatSteps(value: number): string {
  return new Intl.NumberFormat(APP_LOCALE).format(value);
}
export function formatDate(date: string, monthOnly = false): string {
  return new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: APP_TIMEZONE,
    ...(monthOnly ? {} : { day: "numeric" as const }),
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));
}
