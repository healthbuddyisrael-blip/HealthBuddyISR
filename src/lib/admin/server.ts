import "server-only";
import { z } from "zod";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  overviewSchema,
  detailSchema,
  traineeAnalyticsSchema,
  type AnalyticsRange,
} from "./model";

export async function loadAdminOverview(
  range: AnalyticsRange,
  search: string,
  page: number,
) {
  await requireRole("admin");
  const client = await createClient();
  const { data, error } = await client.rpc("get_admin_coach_analytics", {
    p_range_days: range,
    p_search: search,
    p_page: page,
  });
  const parsed = overviewSchema.safeParse(data);
  if (error || !parsed.success) {
    console.error("admin overview read failed", {
      code: error?.code ?? "invalid_result",
    });
    return null;
  }
  return parsed.data;
}
export async function loadAdminCoach(
  coachId: string,
  range: AnalyticsRange,
  search: string,
  page: number,
) {
  await requireRole("admin");
  if (!z.uuid().safeParse(coachId).success) notFound();
  const client = await createClient();
  const { data, error } = await client.rpc("get_admin_coach_detail", {
    p_coach_id: coachId,
    p_range_days: range,
    p_search: search,
    p_page: page,
  });
  if (!error && data === null) notFound();
  const parsed = detailSchema.safeParse(data);
  if (error || !parsed.success) {
    console.error("admin coach read failed", {
      code: error?.code ?? "invalid_result",
    });
    return null;
  }
  return parsed.data;
}
export async function loadAdminTrainee(
  coachId: string,
  traineeId: string,
  range: AnalyticsRange,
) {
  await requireRole("admin");
  if (
    !z.uuid().safeParse(coachId).success ||
    !z.uuid().safeParse(traineeId).success
  )
    notFound();
  const client = await createClient();
  const { data, error } = await client.rpc("get_admin_trainee_analytics", {
    p_coach_id: coachId,
    p_trainee_id: traineeId,
    p_range_days: range,
  });
  if (!error && data === null) notFound();
  const parsed = traineeAnalyticsSchema.safeParse(data);
  if (error || !parsed.success) {
    console.error("admin trainee read failed", {
      code: error?.code ?? "invalid_result",
    });
    return null;
  }
  return parsed.data;
}
