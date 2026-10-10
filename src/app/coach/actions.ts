"use server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { targetChangeSchema, type TargetResult } from "@/lib/coach/model";

export async function setTodayTarget(input: unknown): Promise<TargetResult> {
  await requireRole("coach");
  const parsed = targetChangeSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: "יש להזין יעד צעדים כמספר שלם גדול מאפס." };
  const client = await createClient();
  const { error } = await client.rpc("set_today_step_target", {
    p_trainee_id: parsed.data.traineeId,
    p_target_steps: parsed.data.targetSteps,
  });
  if (error) {
    console.error("coach target mutation failed", { code: error.code });
    return { ok: false, message: "לא הצלחנו לעדכן את היעד. נסו שוב." };
  }
  revalidatePath("/coach");
  revalidatePath(`/coach/trainees/${parsed.data.traineeId}`);
  revalidatePath("/app");
  return { ok: true, targetSteps: parsed.data.targetSteps };
}
