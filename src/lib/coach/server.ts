import "server-only";
import { z } from "zod";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { loadDashboard } from "@/lib/steps/server";
import { loadCoachingHistory } from "@/lib/coaching/server";
import type { Report, Target } from "@/lib/steps/model";
import { coachDashboardSchema, sevenDaySummary, shiftDate } from "./model";

export async function loadCoachDashboard(page: number, search: string) {
  await requireRole("coach");
  const client = await createClient();
  const { data, error } = await client.rpc("get_coach_dashboard", {
    p_page: page,
    p_search: search,
  });
  const parsed = coachDashboardSchema.safeParse(data);
  if (error || !parsed.success) {
    console.error("coach dashboard read failed", {
      code: error?.code ?? "invalid_result",
    });
    return null;
  }
  return parsed.data;
}
export async function loadCoachDetail(
  traineeId: string,
  week: string,
  today: string,
  callsPage = 1,
) {
  const coach = await requireRole("coach");
  if (!z.uuid().safeParse(traineeId).success) notFound();
  const client = await createClient();
  const ownership = await client
    .from("coach_trainees")
    .select("trainee_id")
    .eq("coach_id", coach.id)
    .eq("trainee_id", traineeId)
    .maybeSingle();
  if (ownership.error) {
    console.error("coach assignment read failed", {
      code: ownership.error.code,
    });
    return null;
  }
  if (!ownership.data) notFound();
  const start = shiftDate(today, -6);
  const [profile, dashboard, reports, baseline, transitions, coaching] =
    await Promise.all([
      client
        .from("profiles")
        .select("full_name")
        .eq("id", traineeId)
        .eq("role", "trainee")
        .maybeSingle(),
      loadDashboard(traineeId, week, today),
      client
        .from("daily_steps")
        .select("date,steps")
        .eq("trainee_id", traineeId)
        .gte("date", start)
        .lte("date", today),
      client
        .from("step_targets")
        .select("effective_from,target_steps")
        .eq("trainee_id", traineeId)
        .lt("effective_from", start)
        .order("effective_from", { ascending: false })
        .limit(1),
      client
        .from("step_targets")
        .select("effective_from,target_steps")
        .eq("trainee_id", traineeId)
        .gte("effective_from", start)
        .lte("effective_from", today),
      loadCoachingHistory(traineeId, callsPage),
    ]);
  const error =
    profile.error ?? reports.error ?? baseline.error ?? transitions.error;
  if (error || !dashboard || !coaching) {
    console.error("coach detail read failed", {
      code: error?.code ?? "dashboard",
    });
    return null;
  }
  if (!profile.data) notFound();
  return {
    coaching,
    callsPage,
    name: profile.data.full_name as string,
    ...dashboard,
    summary: sevenDaySummary(
      today,
      reports.data as Report[],
      [...(baseline.data ?? []), ...(transitions.data ?? [])] as Target[],
    ),
  };
}
