"use client";

import { useActionState } from "react";
import { resendInvitation, revokeInvitation } from "@/app/invitations/actions";
import { Button } from "@/components/ui/button";
import { ErrorState, SuccessFeedback } from "@/components/shared/feedback";

export function InvitationActions({
  id,
  pendingInvitation,
}: {
  id: string;
  pendingInvitation: boolean;
}) {
  const [resend, sendAction, sending] = useActionState(resendInvitation, {});
  const [revoke, revokeAction, revoking] = useActionState(revokeInvitation, {});
  const busy = sending || revoking;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start gap-3">
        {pendingInvitation ? (
          <form action={sendAction}>
            <input type="hidden" name="invitationId" value={id} />
            <Button type="submit" variant="outline" disabled={busy}>
              {sending ? "שולחים…" : "שליחה מחדש"}
            </Button>
          </form>
        ) : null}
        <details className="rounded-xl border p-3">
          <summary className="min-h-12 cursor-pointer content-center font-semibold text-destructive focus-visible:outline-2 focus-visible:outline-offset-4">
            ביטול הזמנה
          </summary>
          <form action={revokeAction} className="space-y-3 pt-3">
            <input type="hidden" name="invitationId" value={id} />
            <p className="font-semibold">לבטל את ההזמנה?</p>
            <p>לא ניתן יהיה להשתמש בקישור שנשלח.</p>
            <Button type="submit" variant="destructive" disabled={busy}>
              {revoking ? "מבטלים…" : "כן, ביטול הזמנה"}
            </Button>
          </form>
        </details>
      </div>
      {resend.error || revoke.error ? (
        <ErrorState message={resend.error ?? revoke.error ?? ""} />
      ) : null}
      {resend.success || revoke.success ? (
        <SuccessFeedback message={resend.success ?? revoke.success ?? ""} />
      ) : null}
    </div>
  );
}
