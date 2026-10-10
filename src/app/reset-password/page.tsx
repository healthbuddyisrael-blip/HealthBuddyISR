import { AuthPanel } from "@/components/shared/auth-panel";
import { AuthForm } from "@/components/shared/auth-form";
import { ErrorState } from "@/components/shared/feedback";
import { updateRecoveredPassword } from "@/app/auth/actions";
import { getRecoveryContext } from "@/lib/auth/context";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { AUTH_MESSAGES } from "@/lib/auth/messages";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function ResetPassword() {
  const context = await getRecoveryContext();
  const user = await getCurrentUser();
  const { data } = await (await createClient()).auth.getClaims();
  const valid =
    context &&
    user &&
    context.userId === user.id &&
    context.sessionId === data?.claims.session_id;
  return (
    <AuthPanel title="בחירת סיסמה חדשה">
      {valid ? (
        <AuthForm
          action={updateRecoveredPassword}
          fields={[
            {
              name: "password",
              label: "סיסמה חדשה",
              type: "password",
              autoComplete: "new-password",
              minLength: 10,
              maxLength: 128,
            },
            {
              name: "confirmation",
              label: "אימות סיסמה",
              type: "password",
              autoComplete: "new-password",
            },
          ]}
          submitLabel="עדכון סיסמה"
        />
      ) : (
        <ErrorState message={AUTH_MESSAGES.recovery}>
          <Button asChild variant="outline">
            <Link href="/forgot-password">בקשת קישור חדש</Link>
          </Button>
        </ErrorState>
      )}
    </AuthPanel>
  );
}
