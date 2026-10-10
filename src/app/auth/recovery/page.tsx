import { AuthPanel } from "@/components/shared/auth-panel";
import { AuthForm } from "@/components/shared/auth-form";
import { ErrorState } from "@/components/shared/feedback";
import { verifyRecovery } from "@/app/auth/actions";
import { recoveryTokenSchema } from "@/lib/validation/auth";
import { AUTH_MESSAGES } from "@/lib/auth/messages";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function RecoveryConfirmation({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string }>;
}) {
  const params = await searchParams;
  const token = recoveryTokenSchema.safeParse(params.token_hash);
  // Opening an email link does not consume a token (including email scanner requests).
  return (
    <AuthPanel title="איפוס סיסמה">
      {token.success ? (
        <AuthForm
          action={verifyRecovery}
          hidden={{ recoveryToken: token.data }}
          submitLabel="המשך לאיפוס הסיסמה"
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
