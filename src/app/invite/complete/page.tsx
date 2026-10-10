import { AuthPanel } from "@/components/shared/auth-panel";
import { AuthForm } from "@/components/shared/auth-form";
import { ErrorState } from "@/components/shared/feedback";
import { getPendingInvitation } from "@/lib/auth/context";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/session";
import { getValidInvitation } from "@/lib/invitations/server";
import { normalizeEmail } from "@/lib/invitations/tokens";
import { AUTH_MESSAGES } from "@/lib/auth/messages";
import { acceptPendingInvitation, logout } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";

export default async function CompleteInvitation() {
  const token = await getPendingInvitation();
  const invitation = token ? await getValidInvitation(token) : null;
  const user = await getCurrentUser();
  const profile = await getCurrentProfile();
  const valid =
    invitation &&
    user?.email &&
    user.email_confirmed_at &&
    normalizeEmail(user.email) === invitation.email &&
    !profile;
  return (
    <AuthPanel title="השלמת הרשמה">
      {valid ? (
        <div className="space-y-6">
          <p>
            החשבון אומת:{" "}
            <bdi dir="ltr" className="break-all">
              {invitation.email}
            </bdi>
          </p>
          <AuthForm
            action={acceptPendingInvitation}
            fields={[
              {
                name: "fullName",
                label: "שם מלא",
                autoComplete: "name",
                maxLength: 100,
              },
            ]}
            submitLabel="השלמת ההזמנה"
          />
        </div>
      ) : (
        <ErrorState message={AUTH_MESSAGES.invitation} />
      )}
      <form action={logout} className="mt-6">
        <Button variant="outline">התנתקות</Button>
      </form>
    </AuthPanel>
  );
}
