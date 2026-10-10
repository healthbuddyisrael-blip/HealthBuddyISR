"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setTodayTarget } from "@/app/coach/actions";
import { targetChangeSchema } from "@/lib/coach/model";

export function TargetDialog({
  traineeId,
  target,
  onClose,
  onSaved,
}: {
  traineeId: string;
  target: number | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    input = useRef<HTMLInputElement>(null),
    submitting = useRef(false);
  const [value, setValue] = useState(target === null ? "" : String(target));
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    const element = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    element?.showModal();
    input.current?.focus();
    input.current?.select();
    return () => {
      element?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="target-title"
      onCancel={(event) => {
        if (submitting.current) event.preventDefault();
        else onClose();
      }}
      className="entry-dialog"
    >
      <h2 id="target-title" className="text-xl font-bold">
        שינוי יעד צעדים
      </h2>
      <form
        noValidate
        aria-busy={pending}
        className="mt-5 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (submitting.current) return;
          const parsed = /^\d+$/.test(value)
            ? targetChangeSchema.safeParse({
                traineeId,
                targetSteps: Number(value),
              })
            : null;
          if (!parsed?.success) {
            setError("יש להזין מספר שלם גדול מאפס.");
            return;
          }
          submitting.current = true;
          setError("");
          startTransition(async () => {
            try {
              const result = await setTodayTarget(parsed.data);
              if (result.ok) onSaved();
              else setError(result.message);
            } catch {
              setError("לא הצלחנו לעדכן את היעד. נסו שוב.");
            } finally {
              submitting.current = false;
            }
          });
        }}
      >
        <label htmlFor="new-target" className="block font-semibold">
          יעד חדש
        </label>
        <Input
          ref={input}
          id="new-target"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          dir="ltr"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={pending}
          aria-invalid={!!error}
          aria-describedby={
            error ? "target-error target-explanation" : "target-explanation"
          }
        />
        <p id="target-explanation" className="text-sm text-muted-foreground">
          היעד החדש ייכנס לתוקף מהיום ולא ישנה נתונים היסטוריים. אפשר לתקן את
          היעד של היום עד סוף היום.
        </p>
        {error && (
          <p
            id="target-error"
            role="alert"
            className="text-sm text-destructive"
          >
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
          className="w-full"
          onClick={onClose}
        >
          ביטול
        </Button>
      </form>
    </dialog>
  );
}
