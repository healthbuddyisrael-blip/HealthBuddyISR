import Link from "next/link";
import { AuthPanel } from "@/components/shared/auth-panel";
import { AuthForm } from "@/components/shared/auth-form";
import { ErrorState } from "@/components/shared/feedback";
import { getValidInvitation } from "@/lib/invitations/server";
import { getCurrentUser } from "@/lib/auth/session";
import { AUTH_MESSAGES } from "@/lib/auth/messages";
import {
  existingInvitationLogin,
  googleLogin,
  registerFromInvitation,
  logout,
} from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { formatSteps } from "@/lib/steps/model";

export const dynamic = "force-dynamic";
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invitation = await getValidInvitation(token);
  if (!invitation)
    return (
      <AuthPanel title="הזמנה למערכת">
        <ErrorState message={AUTH_MESSAGES.invitation} />
        <p className="mt-4 text-muted-foreground">
          אפשר לפנות למזמין כדי לקבל קישור חדש.
        </p>
      </AuthPanel>
    );
  const user = await getCurrentUser();
  return (
    <AuthPanel title="השלמת הרשמה">
      <div className="space-y-6">
        <p className="leading-7">
          ההזמנה נשלחה לכתובת{" "}
          <bdi dir="ltr" className="break-all font-semibold">
            {invitation.email}
          </bdi>
        </p>
        <p className="text-sm text-muted-foreground">
          {invitation.role === "coach"
            ? "הזמנה להצטרפות כמאמן"
            : "הזמנה להצטרפות כמתאמן"}
          {invitation.initial_target_steps !== null && (
            <>
              {" "}
              · יעד יומי:{" "}
              <bdi dir="ltr">
                {formatSteps(invitation.initial_target_steps)}
              </bdi>{" "}
              צעדים
            </>
          )}
        </p>
        {user ? (
          <div className="space-y-4">
            <p>
              כבר התחברתם לחשבון. כדי להשלים את ההזמנה, המשיכו עם החשבון שאליו
              היא נשלחה או התנתקו ובחרו חשבון אחר.
            </p>
            <AuthForm
              action={googleLogin}
              hidden={{ token }}
              submitLabel="המשך עם Google"
              variant="outline"
            />
            <form action={logout}>
              <Button variant="outline">התנתקות</Button>
            </form>
          </div>
        ) : (
          <>
            <AuthForm
              action={googleLogin}
              hidden={{ token }}
              submitLabel="המשך עם Google"
            />
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <hr className="flex-1" />
              <span>או</span>
              <hr className="flex-1" />
            </div>
            <AuthForm
              action={registerFromInvitation}
              hidden={{ token }}
              submitLabel="יצירת חשבון"
              fields={[
                {
                  name: "fullName",
                  label: "שם מלא",
                  autoComplete: "name",
                  maxLength: 100,
                },
                {
                  name: "password",
                  label: "סיסמה",
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
            />
          </>
        )}
        <details className="rounded-xl border p-4">
          <summary className="min-h-12 cursor-pointer py-3 font-semibold">
            כבר יש חשבון? התחברות להשלמת ההזמנה
          </summary>
          <div className="mt-4">
            <AuthForm
              action={existingInvitationLogin}
              hidden={{ token }}
              submitLabel="התחברות והשלמת ההזמנה"
              fields={[
                {
                  name: "fullName",
                  label: "שם מלא",
                  autoComplete: "name",
                  maxLength: 100,
                },
                {
                  name: "password",
                  label: "סיסמה קיימת",
                  type: "password",
                  autoComplete: "current-password",
                },
              ]}
            />
          </div>
        </details>
        <Link
          href="/login"
          className="inline-flex min-h-12 items-center rounded-lg text-primary underline focus-visible:outline-2"
        >
          כניסה למערכת
        </Link>
      </div>
    </AuthPanel>
  );
}
