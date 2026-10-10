"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createActivityBaseline } from "@/app/activity/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function BaselineForm({ traineeId }: { traineeId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  return (
    <details className="rounded-2xl border bg-card p-5">
      <summary className="min-h-12 cursor-pointer font-semibold">
        הגדרת נתוני פתיחה ותקופת האימון
      </summary>
      <p className="my-3 text-sm text-muted-foreground">
        נתוני הפתיחה נשמרים פעם אחת. אם קיימים כל 7 דיווחי הצעדים לפני תחילת
        התוכנית, הממוצע יחושב מהם; אחרת יש להזין ממוצע ידני מהראיון.
      </p>
      <form
        className="space-y-4"
        aria-busy={pending}
        onSubmit={(event) => {
          event.preventDefault();
          if (pending) return;
          const data = new FormData(event.currentTarget);
          const manual = String(data.get("manualSteps") ?? "").trim();
          setMessage("");
          startTransition(async () => {
            try {
              const result = await createActivityBaseline({
                traineeId,
                programStart: data.get("programStart"),
                programEnd: data.get("programEnd"),
                manualSteps: manual === "" ? null : Number(manual),
                strength: Number(data.get("strength")),
                cardio: Number(data.get("cardio")),
              });
              setMessage(result.message);
              if (result.ok) router.refresh();
            } catch {
              setMessage("השמירה נכשלה. נסו שוב.");
            }
          });
        }}
      >
        <fieldset disabled={pending} className="space-y-4">
          <label className="block">
            תחילת תוכנית
            <Input name="programStart" type="date" required />
          </label>
          <label className="block">
            סיום תוכנית (לפחות 14 ימים)
            <Input name="programEnd" type="date" required />
          </label>
          <label className="block">
            ממוצע צעדים יומי לפני התוכנית (ידני, אם אין 7 ימים)
            <Input
              name="manualSteps"
              type="number"
              min="0"
              max="2147483647"
              step="any"
            />
          </label>
          <label className="block">
            אימוני כוח בשבוע לפני התוכנית
            <Input
              name="strength"
              type="number"
              min="0"
              max="7"
              step="any"
              required
            />
          </label>
          <label className="block">
            אימוני אירובי בשבוע לפני התוכנית
            <Input
              name="cardio"
              type="number"
              min="0"
              max="7"
              step="any"
              required
            />
          </label>
          <Button type="submit" className="w-full">
            {pending ? "שומרים…" : "שמירת נתוני פתיחה קבועים"}
          </Button>
        </fieldset>
        <p role="status">{message}</p>
      </form>
    </details>
  );
}
