"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  businessDate,
  saveStepsSchema,
  type SaveStepsResult,
} from "@/lib/steps/model";

export async function saveDailySteps(input: unknown): Promise<SaveStepsResult> {
  await requireRole("trainee");
  const parsed = saveStepsSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      message: "יש להזין מספר שלם של צעדים, אפס ומעלה, ותאריך תקין.",
    };
  const today = businessDate();
  const date = parsed.data.kind === "today" ? today : parsed.data.date;
  if (date > today)
    return { ok: false, message: "לא ניתן להזין צעדים לתאריך עתידי." };
  const supabase = await createClient();
  // Legacy steps-only callers must not erase existing workout observations.
  const activity =
    parsed.data.strength_workout_completed !== undefined ||
    parsed.data.cardio_workout_completed !== undefined;
  if (
    activity &&
    (parsed.data.strength_workout_completed === undefined ||
      parsed.data.cardio_workout_completed === undefined)
  )
    return { ok: false, message: "יש לשלוח את שני שדות הפעילות יחד." };
  const { error } = await supabase.rpc(
    activity ? "save_daily_activity" : "save_daily_steps",
    {
      p_date: date,
      p_steps: parsed.data.steps,
      ...(activity
        ? {
            p_strength: parsed.data.strength_workout_completed,
            p_cardio: parsed.data.cardio_workout_completed,
          }
        : {}),
    },
  );
  if (error) {
    console.error("daily_steps save failed", { code: error.code });
    return { ok: false, message: "לא הצלחנו לשמור את הצעדים. נסו שוב." };
  }
  revalidatePath("/app");
  revalidatePath("/coach", "layout");
  revalidatePath("/admin", "layout");
  return { ok: true };
}
