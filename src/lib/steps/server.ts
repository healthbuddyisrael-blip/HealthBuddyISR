import "server-only";
import { createClient } from "@/lib/supabase/server";
import { loadActivity } from "@/lib/activity/server";
import {
  weeklyCalendarDays,
  completion,
  weekBounds,
  type Report,
  type Target,
} from "./model";

export async function loadDashboard(
  traineeId: string,
  week: string,
  today: string,
) {
  const supabase = await createClient();
  const bounds = weekBounds(week);
  const [reports, baseline, transitions, todayTarget, todayReport, activity] =
    await Promise.all([
      supabase
        .from("daily_steps")
        .select(
          "date,steps,strength_workout_completed,cardio_workout_completed",
        )
        .eq("trainee_id", traineeId)
        .gte("date", bounds.start)
        .lte("date", bounds.end),
      supabase
        .from("step_targets")
        .select("effective_from,target_steps")
        .eq("trainee_id", traineeId)
        .lt("effective_from", bounds.start)
        .order("effective_from", { ascending: false })
        .limit(1),
      supabase
        .from("step_targets")
        .select("effective_from,target_steps")
        .eq("trainee_id", traineeId)
        .gte("effective_from", bounds.start)
        .lte("effective_from", bounds.end)
        .order("effective_from"),
      supabase
        .from("step_targets")
        .select("target_steps")
        .eq("trainee_id", traineeId)
        .lte("effective_from", today)
        .order("effective_from", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("daily_steps")
        .select(
          "date,steps,strength_workout_completed,cardio_workout_completed",
        )
        .eq("trainee_id", traineeId)
        .eq("date", today)
        .maybeSingle(),
      loadActivity(traineeId, week),
    ]);
  const error =
    reports.error ??
    baseline.error ??
    transitions.error ??
    todayTarget.error ??
    todayReport.error;
  if (error || !activity) {
    console.error("trainee dashboard read failed", {
      code: error?.code ?? "activity",
    });
    return null;
  }
  // At most one baseline plus seven transitions; never truncate lifetime history
  // at the Data API row cap, and never fetch a target separately for each day.
  const history = [
    ...(baseline.data ?? []),
    ...(transitions.data ?? []),
  ] as Target[];
  const target: number | null = todayTarget.data?.target_steps ?? null;
  if (target === null) console.error("trainee dashboard missing active target");
  const steps = todayReport.data?.steps ?? null;
  return {
    activity,
    days: weeklyCalendarDays(week, today, reports.data as Report[], history),
    today: {
      date: today,
      steps,
      target,
      percentage: completion(steps, target),
      future: false,
      strength_workout_completed:
        todayReport.data?.strength_workout_completed ?? null,
      cardio_workout_completed:
        todayReport.data?.cardio_workout_completed ?? null,
    },
  };
}
