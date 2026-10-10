"use server";
import { revalidatePath } from "next/cache";
import {
  getCurrentProfile,
  requireAuthenticatedUser,
} from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { baselineInputSchema } from "@/lib/activity/model";

export async function createActivityBaseline(input: unknown) {
  await requireAuthenticatedUser();
  const profile = await getCurrentProfile();
  if (!profile || !["coach", "admin"].includes(profile.role))
    return { ok: false, message: "אין הרשאה לשמור נתוני פתיחה." };
  const parsed = baselineInputSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      message: "יש לבדוק את הערכים ואת תאריכי התוכנית (לפחות 14 ימים).",
    };
  const v = parsed.data;
  const client = await createClient();
  const { error } = await client.rpc("create_activity_baseline", {
    p_trainee_id: v.traineeId,
    p_program_start: v.programStart,
    p_program_end: v.programEnd,
    p_manual_steps: v.manualSteps,
    p_strength: v.strength,
    p_cardio: v.cardio,
  });
  if (error) {
    console.error("activity baseline creation failed", { code: error.code });
    return {
      ok: false,
      message:
        "השמירה נכשלה. ללא 7 ימי צעדים לפני התוכנית נדרש ערך ידני. נתוני פתיחה קיימים נשארים קבועים.",
    };
  }
  revalidatePath("/app");
  revalidatePath("/coach", "layout");
  revalidatePath("/admin", "layout");
  return { ok: true, message: "נתוני הפתיחה נשמרו." };
}
