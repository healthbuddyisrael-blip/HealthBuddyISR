"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import type { Checkin } from "@/lib/coaching/model";
import { coachingWeekStart } from "@/lib/coaching/model";

export function CallFields({
  report,
  today,
  disabled,
}: {
  report: Checkin | null;
  today: string;
  disabled: boolean;
}) {
  const [completed, setCompleted] = useState(report?.call_completed ?? false);
  const [attention, setAttention] = useState(
    report?.admin_attention_required ?? false,
  );
  return (
    <fieldset disabled={disabled} className="space-y-3">
      <label className="block text-sm font-semibold">
        {report?.legacy_monday_week
          ? "תחילת שבוע היסטורי (לפני המעבר לשבוע ישראלי)"
          : "תחילת שבוע (יום ראשון)"}
        <Input
          name="weekStart"
          type="date"
          defaultValue={report?.week_start ?? coachingWeekStart(today)}
          max={coachingWeekStart(today)}
          required
          readOnly={!!report}
        />
      </label>
      <label className="flex min-h-12 items-center gap-3 font-semibold">
        <input
          name="callCompleted"
          type="checkbox"
          checked={completed}
          onChange={(e) => setCompleted(e.target.checked)}
          className="h-5 w-5 accent-primary"
        />
        שיחת טלפון אישית הושלמה
      </label>
      {completed && (
        <label className="block text-sm font-semibold">
          תאריך שיחה
          <Input
            name="callDate"
            type="date"
            defaultValue={report?.call_date ?? today}
            max={today}
            required
          />
        </label>
      )}
      <p className="text-sm text-muted-foreground">
        משפט או שניים בכל שדה מספיקים (עד 500 תווים). אם לא היו קשיים, ציינו זאת
        בקצרה.
      </p>
      {(
        [
          ["generalStatus", "איך עבר השבוע?", report?.general_status],
          ["difficulties", "מה היו הקשיים העיקריים?", report?.difficulties],
          ["agreements", "מה הוסכם?", report?.agreements],
          ["nextWeekGoal", "יעד לשבוע הבא", report?.next_week_goal],
        ] as const
      ).map(([name, label, value]) => (
        <label key={name} className="block text-sm font-semibold">
          {label}
          <textarea
            name={name}
            rows={2}
            maxLength={500}
            required={completed}
            defaultValue={value ?? ""}
            className="mt-1 block w-full rounded-md border border-input bg-background p-2 font-normal focus-visible:outline-2 focus-visible:outline-ring"
          />
        </label>
      ))}
      <label className="flex min-h-12 items-center gap-3 text-sm font-semibold">
        <input
          name="adminAttentionRequired"
          type="checkbox"
          checked={attention}
          onChange={(e) => setAttention(e.target.checked)}
          className="h-5 w-5 accent-primary"
        />
        נדרשת תשומת לב מנהל
      </label>
      {attention && (
        <label className="block text-sm font-semibold">
          סיבה קצרה (לא חובה)
          <textarea
            name="adminAttentionReason"
            rows={2}
            maxLength={300}
            defaultValue={report?.admin_attention_reason ?? ""}
            className="mt-1 block w-full rounded-md border border-input bg-background p-2 font-normal focus-visible:outline-2 focus-visible:outline-ring"
          />
        </label>
      )}
      {!completed && (
        <p className="text-sm text-muted-foreground">
          תיעוד ללא סימון שיחה שהושלמה נשמר כטיוטה ואינו נחשב לעמידה בדרישה
          השבועית.
        </p>
      )}
    </fieldset>
  );
}
