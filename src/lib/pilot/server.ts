import "server-only";
import { z } from "zod";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { businessDate } from "@/lib/steps/model";
import {
  figuresSchema,
  overviewSchema,
  pilotReportSchema,
  screenshotBucket,
  type PilotDetail,
} from "./model";
export async function pilotMembership(traineeId: string) {
  const client = await createClient();
  const { data, error } = await client
    .from("pilot_participants")
    .select("starts_on,ends_on")
    .eq("trainee_id", traineeId)
    .maybeSingle();
  if (error) throw new Error("Pilot enrollment could not be loaded");
  return data as { starts_on: string; ends_on: string | null } | null;
}
export async function loadPilotOverview(week: string, page = 1) {
  const client = await createClient();
  const { data, error } = await client.rpc("get_pilot_week_overview", {
    p_week_start: week,
    p_page: page,
  });
  const parsed = overviewSchema.safeParse(data);
  if (error || !parsed.success) {
    console.error("pilot overview read failed", {
      code: error?.code ?? "invalid_result",
    });
    return null;
  }
  return parsed.data;
}
export async function loadPilotDetail(
  traineeId: string,
  week: string,
  readOnly: boolean,
  page = 1,
): Promise<PilotDetail | null> {
  if (!z.uuid().safeParse(traineeId).success) notFound();
  const client = await createClient();
  const member = await pilotMembership(traineeId);
  if (!member) notFound();
  const [profile, current, history, figures] = await Promise.all([
    client
      .from("profiles")
      .select("full_name")
      .eq("id", traineeId)
      .maybeSingle(),
    client
      .from("pilot_weekly_reports")
      .select("*")
      .eq("trainee_id", traineeId)
      .eq("week_start", week)
      .maybeSingle(),
    client
      .from("pilot_weekly_reports")
      .select("*", { count: "exact" })
      .eq("trainee_id", traineeId)
      .order("week_start", { ascending: false })
      .range((page - 1) * 12, page * 12 - 1),
    client
      .from("pilot_weekly_figures")
      .select(
        "week_start,average_daily_steps,strength_workouts,aerobic_workouts,source,step_days",
      )
      .eq("trainee_id", traineeId)
      .lte("week_start", week)
      .order("week_start", { ascending: false })
      .limit(12),
  ]);
  if (profile.error || current.error || history.error || figures.error)
    return null;
  if (!profile.data) notFound();
  const report = pilotReportSchema.nullable().parse(current.data);
  let screenshotUrl: string | null = null;
  if (report?.screenshot_path) {
    const signed = await client.storage
      .from(screenshotBucket)
      .createSignedUrl(report.screenshot_path, 120);
    if (!signed.error) screenshotUrl = signed.data.signedUrl;
  }
  return {
    name: profile.data.full_name,
    traineeId,
    week,
    report,
    reports: z.array(pilotReportSchema).parse(history.data),
    figures: z.array(figuresSchema).parse(figures.data),
    total: history.count ?? 0,
    page,
    screenshotUrl,
    readOnly,
    today: businessDate(),
    startsOn: member.starts_on,
    endsOn: member.ends_on,
  };
}
