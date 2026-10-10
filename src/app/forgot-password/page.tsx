import { AuthPanel } from "@/components/shared/auth-panel";
import { AuthForm } from "@/components/shared/auth-form";
import { requestPasswordReset } from "@/app/auth/actions";
import Link from "next/link";

export default function ForgotPassword() {
  return (
    <AuthPanel title="שכחתי סיסמה">
      <AuthForm
        action={requestPasswordReset}
        fields={[
          {
            name: "email",
            label: "אימייל",
            type: "email",
            autoComplete: "email",
          },
        ]}
        submitLabel="שליחת הוראות לאיפוס"
      />
      <Link
        href="/login"
        className="mt-4 inline-flex min-h-12 items-center text-sm font-semibold text-primary underline"
      >
        חזרה לכניסה
      </Link>
    </AuthPanel>
  );
}
