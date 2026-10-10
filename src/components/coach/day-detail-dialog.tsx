"use client";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { formatDate, formatSteps, type Day } from "@/lib/steps/model";
import { ProgressRing } from "@/components/steps/progress-ring";

export function DayDetailDialog({
  day,
  onClose,
}: {
  day: Day;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    element?.showModal();
    return () => {
      element?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="day-detail-title"
      onCancel={onClose}
      className="entry-dialog"
    >
      <h2 id="day-detail-title" className="mb-5 text-xl font-bold">
        {formatDate(day.date)}
      </h2>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <dl className="space-y-3">
          <div>
            <dt className="text-sm text-muted-foreground">צעדים שדווחו</dt>
            <dd>{day.steps === null ? "לא דווח" : formatSteps(day.steps)}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">יעד</dt>
            <dd>{day.target === null ? "אין יעד" : formatSteps(day.target)}</dd>
          </div>
          {day.percentage !== null && (
            <div>
              <dt className="text-sm text-muted-foreground">השלמה</dt>
              <dd>
                <span dir="ltr">{day.percentage}%</span>
              </dd>
            </div>
          )}
        </dl>
        <dl className="space-y-2 text-sm">
          <div>
            <dt>אימון כוח</dt>
            <dd>
              {day.strength_workout_completed == null
                ? "לא ידוע"
                : day.strength_workout_completed
                  ? "הושלם"
                  : "לא בוצע"}
            </dd>
          </div>
          <div>
            <dt>אימון אירובי</dt>
            <dd>
              {day.cardio_workout_completed == null
                ? "לא ידוע"
                : day.cardio_workout_completed
                  ? "הושלם"
                  : "לא בוצע"}
            </dd>
          </div>
        </dl>
        <ProgressRing
          percentage={day.percentage}
          emptyLabel={day.target === null ? "אין יעד" : "לא דווח"}
        />
      </div>
      <Button type="button" className="mt-6 w-full" onClick={onClose}>
        סגירה
      </Button>
    </dialog>
  );
}
