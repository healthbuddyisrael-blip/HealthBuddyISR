"use client";

import { useActionState, useId, useState } from "react";
import { inviteCoach, inviteTrainee } from "@/app/invitations/actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ErrorState, SuccessFeedback } from "@/components/shared/feedback";

export function InvitationForm({ role }: { role: "coach" | "trainee" }) {
  const [email, setEmail] = useState("");
  const [target, setTarget] = useState("");
  const feedbackId = useId();
  const [state, action, pending] = useActionState(
    role === "coach" ? inviteCoach : inviteTrainee,
    {},
  );
  return (
    <form action={action} aria-busy={pending} className="space-y-5">
      <label className="block space-y-2">
        <span className="font-semibold">
          {role === "coach" ? "אימייל המאמן" : "אימייל המתאמן"}
        </span>
        <Input
          name="email"
          type="email"
          autoComplete="email"
          dir="ltr"
          maxLength={254}
          required
          readOnly={pending}
          value={email}
          onChange={(event) => {
            event.target.setCustomValidity("");
            setEmail(event.target.value);
          }}
          onInvalid={(event) =>
            event.currentTarget.setCustomValidity(
              "יש להזין כתובת אימייל תקינה.",
            )
          }
          aria-describedby={state.error ? feedbackId : undefined}
        />
      </label>
      {role === "trainee" ? (
        <label className="block space-y-2">
          <span className="font-semibold">יעד צעדים יומי</span>
          <Input
            name="initialTargetSteps"
            type="number"
            inputMode="numeric"
            dir="ltr"
            min={1}
            max={2147483647}
            step={1}
            placeholder="10000"
            required
            readOnly={pending}
            value={target}
            onChange={(event) => {
              event.target.setCustomValidity("");
              setTarget(event.target.value);
            }}
            onInvalid={(event) =>
              event.currentTarget.setCustomValidity(
                "יש להזין יעד צעדים שלם גדול מ-0.",
              )
            }
            aria-describedby={state.error ? feedbackId : undefined}
          />
        </label>
      ) : null}
      {state.error ? (
        <div id={feedbackId}>
          <ErrorState message={state.error} />
        </div>
      ) : null}
      {state.success ? <SuccessFeedback message={state.success} /> : null}
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "שולחים…" : "שליחת הזמנה"}
      </Button>
    </form>
  );
}
