import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { weekBounds } from "@/lib/steps/model";
import { progressSchema, weeklySchema, type ActivityData } from "./model";

export async function loadActivity(
  traineeId: string,
  week: string,
): Promise<ActivityData | null> {
  const client = await createClient();
  const bounds = weekBounds(week);
  const [progress, weeks] = await Promise.all([
    client.rpc("get_activity_progress", { p_trainee_id: traineeId }),
    client
      .from("weekly_activity")
      .select(
        "week_start,average_daily_steps,step_days,strength_days,cardio_days,strength_sessions,cardio_sessions",
      )
      .eq("trainee_id", traineeId)
      .eq("week_start", bounds.start)
      .order("week_start"),
  ]);
  const parsed = progressSchema.nullable().safeParse(progress.data);
  const parsedWeeks = z.array(weeklySchema).safeParse(weeks.data);
  if (
    progress.error ||
    weeks.error ||
    !parsed.success ||
    !parsedWeeks.success
  ) {
    console.error("activity progress read failed", {
      code: progress.error?.code ?? weeks.error?.code ?? "invalid_result",
    });
    return null;
  }
  return { progress: parsed.data, weeks: parsedWeeks.data };
}
