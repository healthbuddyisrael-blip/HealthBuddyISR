"use client";

import { useActionState, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorState, SuccessFeedback } from "@/components/shared/feedback";
import type { AuthActionState } from "@/lib/validation/auth";

export type AuthField = {
  name: string;
  label: string;
  type?: "text" | "email" | "password";
  autoComplete?: string;
  minLength?: number;
  maxLength?: number;
};

export function AuthForm({
  action,
  fields = [],
  hidden = {},
  submitLabel,
  variant = "default",
}: {
  action: (
    previous: AuthActionState,
    form: FormData,
  ) => Promise<AuthActionState>;
  fields?: AuthField[];
  hidden?: Record<string, string>;
  submitLabel: string;
  variant?: "default" | "outline";
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [values, setValues] = useState<Record<string, string>>({});
  const feedbackId = useId();
  return (
    <form action={formAction} aria-busy={pending} className="space-y-5">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} name={name} type="hidden" value={value} />
      ))}
      {fields.map((field) => (
        <label key={field.name} className="block space-y-2">
          <span className="text-sm font-semibold">{field.label}</span>
          <Input
            name={field.name}
            type={field.type ?? "text"}
            autoComplete={field.autoComplete}
            minLength={field.minLength}
            maxLength={field.maxLength}
            required
            readOnly={pending}
            value={values[field.name] ?? ""}
            onChange={(event) => {
              event.target.setCustomValidity("");
              setValues((previous) => ({
                ...previous,
                [field.name]: event.target.value,
              }));
            }}
            onInvalid={(event) =>
              event.currentTarget.setCustomValidity(
                field.type === "email"
                  ? "יש להזין כתובת אימייל תקינה."
                  : field.minLength
                    ? `יש להזין ${field.label} עם לפחות ${field.minLength} תווים.`
                    : `יש להזין ${field.label}.`,
              )
            }
            aria-describedby={state.error ? feedbackId : undefined}
            dir={
              field.type === "email" || field.type === "password"
                ? "ltr"
                : undefined
            }
          />
          {field.minLength && (
            <span className="block text-sm text-muted-foreground">
              לפחות {field.minLength} תווים
            </span>
          )}
        </label>
      ))}
      {state.error ? (
        <div id={feedbackId}>
          <ErrorState message={state.error} />
        </div>
      ) : null}
      {state.success ? <SuccessFeedback message={state.success} /> : null}
      <Button
        type="submit"
        variant={variant}
        disabled={pending}
        className="w-full"
      >
        {pending ? "רגע…" : submitLabel}
      </Button>
    </form>
  );
}
