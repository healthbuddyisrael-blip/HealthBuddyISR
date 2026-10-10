import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { historySchema, overviewSchema, type CoachingFilter } from "./model";

export async function loadCoachingHistory(traineeId: string, page = 1) {
  // Caller routes verify coach ownership or admin identity; RPC repeats that check.
  const client = await createClient();
  const { data, error } = await client.rpc("get_weekly_call_history", {
    p_trainee_id: traineeId,
    p_page: page,
  });
  const parsed = historySchema.safeParse(data);
  if (error || !parsed.success) {
    console.error("weekly history read failed", {
      code: error?.code ?? "invalid_result",
    });
    return null;
  }
  return parsed.data;
}
export async function loadCoachingOverview(
  week: string,
  filter: CoachingFilter,
  page: number,
) {
  await requireRole("admin");
  const client = await createClient();
  const { data, error } = await client.rpc("get_weekly_coaching_overview", {
    p_week_start: week,
    p_filter: filter,
    p_page: page,
  });
  const parsed = overviewSchema.safeParse(data);
  if (error || !parsed.success) {
    console.error("weekly oversight read failed", {
      code: error?.code ?? "invalid_result",
    });
    return null;
  }
  return parsed.data;
}
