"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveDailySteps } from "@/app/app/actions";
import { WorkoutInputs } from "@/components/activity/workout-inputs";
import {
  completion,
  formatDate,
  formatSteps,
  stepsSchema,
  type Day,
} from "@/lib/steps/model";

export function StepEntryDialog({
  day,
  isToday,
  onClose,
  onSaved,
}: {
  day: Day;
  isToday: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);
  const [value, setValue] = useState(
    day.steps === null ? "" : String(day.steps),
  );
  const [error, setError] = useState("");
  const [strength, setStrength] = useState<boolean | null>(
    day.steps === null ? false : (day.strength_workout_completed ?? null),
  );
  const [cardio, setCardio] = useState<boolean | null>(
    day.steps === null ? false : (day.cardio_workout_completed ?? null),
  );
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    element?.showModal();
    input.current?.focus();
    input.current?.select();
    return () => {
      element?.close();
      previous?.focus();
    };
  }, []);
  const parsed = /^\d+$/.test(value)
    ? stepsSchema.safeParse(Number(value))
    : null;
  const percentage = parsed?.success
    ? completion(parsed.data, day.target)
    : null;
  return (
    <dialog
      ref={dialog}
      aria-labelledby="step-entry-title"
      onCancel={(event) => {
        if (submitting.current) event.preventDefault();
        else onClose();
      }}
      className="entry-dialog"
    >
      <h2 id="step-entry-title" className="text-xl font-bold">
        {isToday ? "צעדים להיום" : formatDate(day.date)}
      </h2>
      <p className="mt-2 text-muted-foreground">
        {day.target === null
          ? "אין יעד זמין לתאריך זה"
          : `יעד: ${formatSteps(day.target)} צעדים`}
      </p>
      <form
        noValidate
        aria-busy={pending}
        className="mt-6 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (submitting.current) return;
          if (!parsed?.success) {
            setError("יש להזין מספר שלם של צעדים, אפס ומעלה.");
            return;
          }
          submitting.current = true;
          setError("");
          startTransition(async () => {
            try {
              const result = await saveDailySteps(
                isToday
                  ? {
                      kind: "today",
                      steps: parsed.data,
                      strength_workout_completed: strength,
                      cardio_workout_completed: cardio,
                    }
                  : {
                      kind: "historical",
                      date: day.date,
                      steps: parsed.data,
                      strength_workout_completed: strength,
                      cardio_workout_completed: cardio,
                    },
              );
              if (result.ok) onSaved();
              else setError(result.message);
            } catch {
              setError("לא הצלחנו לשמור את הצעדים. נסו שוב.");
            } finally {
              submitting.current = false;
            }
          });
        }}
      >
        <label htmlFor="step-count" className="block font-semibold">
          {isToday ? "כמה צעדים עשית היום?" : "צעדים שדווחו:"}
        </label>
        <Input
          ref={input}
          id="step-count"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          dir="ltr"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={pending}
          aria-invalid={!!error}
          aria-describedby={error ? "step-error" : undefined}
        />
        {percentage !== null && (
          <p>
            השלמה: <span dir="ltr">{percentage}%</span>
          </p>
        )}
        <WorkoutInputs
          strength={strength}
          cardio={cardio}
          onStrength={setStrength}
          onCardio={setCardio}
          disabled={pending}
          historicalUnknown={
            day.steps !== null && (strength === null || cardio === null)
          }
        />
        {error && (
          <p id="step-error" role="alert" className="text-sm text-destructive">
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
