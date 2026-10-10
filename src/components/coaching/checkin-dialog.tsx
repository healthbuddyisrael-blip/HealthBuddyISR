"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { saveWeeklyCheckin } from "@/app/coaching/actions";
import { Button } from "@/components/ui/button";
import { RecentCallActivity } from "./recent-activity";
import { CallFields } from "./call-fields";
import type { Checkin, CoachingHistoryData } from "@/lib/coaching/model";

export function CheckinDialog({
  traineeId,
  report,
  data,
  today,
  onClose,
  onSaved,
}: {
  traineeId: string;
  report: Checkin | null;
  data: CoachingHistoryData;
  today: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    submitting = useRef(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  useEffect(() => {
    const element = ref.current,
      previous = document.activeElement as HTMLElement | null;
    element?.showModal();
    return () => {
      element?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="weekly-call-title"
      className="entry-dialog max-h-[90dvh] overflow-y-auto"
      onCancel={(event) => {
        if (submitting.current) event.preventDefault();
        else onClose();
      }}
    >
      <h2 id="weekly-call-title" className="mb-3 text-xl font-bold">
        תיעוד שיחה שבועית
      </h2>
      <RecentCallActivity data={data} />
      <form
        className="mt-4 space-y-4"
        aria-busy={pending}
        onSubmit={(event) => {
          event.preventDefault();
          if (submitting.current) return;
          const fields = new FormData(event.currentTarget);
          submitting.current = true;
          setError("");
          startTransition(async () => {
            try {
              const result = await saveWeeklyCheckin({
                traineeId,
                weekStart: fields.get("weekStart"),
                callCompleted: fields.has("callCompleted"),
                callDate: fields.has("callCompleted")
                  ? fields.get("callDate")
                  : null,
                generalStatus: fields.get("generalStatus"),
                difficulties: fields.get("difficulties"),
                agreements: fields.get("agreements"),
                nextWeekGoal: fields.get("nextWeekGoal"),
                adminAttentionRequired: fields.has("adminAttentionRequired"),
                adminAttentionReason: fields.has("adminAttentionRequired")
                  ? (fields.get("adminAttentionReason") ?? "")
                  : "",
              });
              if (result.ok) onSaved();
              else setError(result.message);
            } catch {
              setError("לא הצלחנו לשמור. נסו שוב.");
            } finally {
              submitting.current = false;
            }
          });
        }}
      >
        <CallFields report={report} today={today} disabled={pending} />
        <p className="text-sm text-muted-foreground">
          יעד הצעדים המספרי מנוהל בנפרד דרך ״שינוי יעד״ בדף המתאמן.
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "שומרים…" : "שמירה"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={onClose}
          className="w-full"
        >
          ביטול
        </Button>
      </form>
    </dialog>
  );
}
