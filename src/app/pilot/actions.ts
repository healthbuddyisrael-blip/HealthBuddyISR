"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { businessDate, weekBounds } from "@/lib/steps/model";
import { dateSchema, weekStart } from "@/lib/steps/model";
import {
  imageExtension,
  reportInputSchema,
  screenshotBucket,
  screenshotLimit,
} from "@/lib/pilot/model";
export async function savePilotReport(form: FormData) {
  const coach = await requireRole("coach");
  let input: unknown;
  try {
    input = JSON.parse(String(form.get("report")));
  } catch {
    return { ok: false, message: "נתוני הדיווח אינם תקינים." };
  }
  const parsed = reportInputSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "יש לבדוק את הנתונים.",
    };
  const v = parsed.data;
  if (
    weekBounds(v.week_start).end >= businessDate() ||
    (v.call_date && v.call_date > businessDate())
  )
    return {
      ok: false,
      message: "אפשר לדווח על שבוע שהסתיים ועל שיחה שכבר התקיימה.",
    };
  const client = await createClient();
  const owned = await client
    .from("coach_trainees")
    .select("trainee_id")
    .eq("trainee_id", v.trainee_id)
    .eq("coach_id", coach.id)
    .maybeSingle();
  if (owned.error || !owned.data)
    return { ok: false, message: "אין הרשאה לדווח עבור המתאמן." };
  const current = await client
    .from("pilot_weekly_reports")
    .select("screenshot_path,revision")
    .eq("trainee_id", v.trainee_id)
    .eq("week_start", v.week_start)
    .maybeSingle();
  if (current.error)
    return { ok: false, message: "לא הצלחנו לקרוא את הדיווח הקיים." };
  if ((current.data?.revision ?? null) !== v.revision)
    return {
      ok: false,
      message: "הדיווח השתנה. יש לרענן לפני שמירת תיקון.",
      conflict: true,
    };
  let path: string | null = current.data?.screenshot_path ?? null;
  let uploaded: string | null = null;
  const file = form.get("screenshot");
  if (file instanceof File && file.size > 0) {
    if (file.size > screenshotLimit)
      return { ok: false, message: "התמונה צריכה להיות עד 3MB." };
    const bytes = new Uint8Array(await file.arrayBuffer());
    let extension: string;
    try {
      extension = imageExtension(bytes, file.type);
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
    if (form.get("evidenceConfirmed") !== "true")
      return {
        ok: false,
        message: "יש לאשר שהתמונה מציגה את שבוע הדיווח הנבחר.",
      };
    uploaded = `${v.trainee_id}/${v.week_start}/${randomUUID()}.${extension}`;
    const upload = await client.storage
      .from(screenshotBucket)
      .upload(uploaded, bytes, { contentType: file.type, upsert: false });
    if (upload.error)
      return {
        ok: false,
        message: "העלאת התמונה נכשלה. הנתונים נשמרו בטופס; נסו שוב.",
      };
    path = uploaded;
  }
  if (v.status === "submitted" && !path)
    return { ok: false, message: "להגשה נדרשת תמונת צעדים. אפשר לשמור טיוטה." };
  const { revision, ...fields } = v;
  const saved = await client.rpc("save_pilot_weekly_report", {
    p_report: { ...fields, screenshot_path: path },
    p_expected_revision: revision,
  });
  if (saved.error) {
    if (uploaded) {
      const cleanup = await client.storage
        .from(screenshotBucket)
        .remove([uploaded]);
      if (cleanup.error)
        console.error("pilot failed-upload cleanup requires review", {
          code: cleanup.error.name,
        });
    }
    return {
      ok: false,
      message:
        saved.error.code === "40001"
          ? "הדיווח השתנה. יש לרענן לפני שמירת תיקון."
          : "לא הצלחנו לשמור. בדקו את הנתונים וההרשאה ונסו שוב.",
      conflict: saved.error.code === "40001",
    };
  }
  let cleanupFailed = false;
  if (uploaded && current.data?.screenshot_path) {
    const cleanup = await client.storage
      .from(screenshotBucket)
      .remove([current.data.screenshot_path]);
    cleanupFailed = !!cleanup.error;
    if (cleanupFailed)
      console.error("pilot evidence cleanup failed", {
        code: cleanup.error?.name,
      });
  }
  for (const route of ["/coach", "/admin", "/app"])
    revalidatePath(route, "layout");
  return {
    ok: true,
    message: cleanupFailed
      ? "הדיווח נשמר. ניקוי התמונה הקודמת דורש בדיקת מנהל."
      : v.status === "submitted"
        ? "הדיווח השבועי הוגש."
        : "הטיוטה נשמרה.",
  };
}
export async function setPilotEnrollment(form: FormData) {
  await requireRole("admin");
  const parsed = z
    .object({
      traineeId: z.uuid(),
      start: dateSchema.refine((v) => weekStart(v) === v),
      end: dateSchema.nullable(),
    })
    .safeParse({
      traineeId: form.get("traineeId"),
      start: form.get("start"),
      end: form.get("end") || null,
    });
  if (!parsed.success)
    return { ok: false, message: "יש לבחור מתאמן ותאריכים." };
  const client = await createClient();
  const { error } = await client.rpc("set_pilot_enrollment", {
    p_trainee_id: parsed.data.traineeId,
    p_starts_on: parsed.data.start,
    p_ends_on: parsed.data.end,
  });
  if (error)
    return {
      ok: false,
      message:
        "לא נשמר. תחילת הדיווח צריכה להיות יום ראשון; יש לשמר תקופות שכבר דווחו.",
    };
  for (const route of ["/coach", "/admin", "/app"])
    revalidatePath(route, "layout");
  return { ok: true, message: "שיוך הפיילוט נשמר." };
}
