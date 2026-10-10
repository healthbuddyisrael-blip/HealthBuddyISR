"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { businessDate } from "@/lib/steps/model";
import { checkinInputSchema, coachingWeekStart } from "@/lib/coaching/model";

export async function saveWeeklyCheckin(input: unknown) {
  await requireRole("coach");
  const parsed = checkinInputSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      message:
        "יש להשלים ארבעה סיכומים קצרים ותאריך שיחה באותו שבוע. השבוע מתחיל ביום שני.",
    };
  const v = parsed.data,
    today = businessDate();
  if (
    coachingWeekStart(v.weekStart) > coachingWeekStart(today) ||
    (v.callDate !== null && v.callDate > today)
  )
    return { ok: false, message: "לא ניתן לתעד שיחה עתידית." };
  const client = await createClient();
  const { error } = await client.rpc("save_weekly_checkin", {
    p_trainee_id: v.traineeId,
    p_week_start: v.weekStart,
    p_call_completed: v.callCompleted,
    p_call_date: v.callDate,
    p_general_status: v.generalStatus,
    p_difficulties: v.difficulties,
    p_agreements: v.agreements,
    p_next_week_goal: v.nextWeekGoal,
    p_admin_attention_required: v.adminAttentionRequired,
    p_admin_attention_reason: v.adminAttentionReason,
  });
  if (error) {
    console.error("weekly checkin save failed", { code: error.code });
    return {
      ok: false,
      message:
        "לא הצלחנו לשמור את השיחה. יש לבדוק את התאריך ואת הרשאת המאמן ולנסות שוב.",
    };
  }
  revalidatePath("/coach", "layout");
  revalidatePath("/admin", "layout");
  return { ok: true, message: "התיעוד השבועי נשמר." };
}
