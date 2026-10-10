import Link from "next/link";
import { AuthForm } from "@/components/shared/auth-form";
import { passwordLogin, googleLogin } from "@/app/auth/actions";

export function LoginForm() {
  return (
    <div className="mt-8 space-y-6">
      <AuthForm
        action={passwordLogin}
        fields={[
          {
            name: "email",
            label: "אימייל",
            type: "email",
            autoComplete: "username",
          },
          {
            name: "password",
            label: "סיסמה",
            type: "password",
            autoComplete: "current-password",
          },
        ]}
        submitLabel="כניסה"
      />
      <Link
        href="/forgot-password"
        className="inline-flex min-h-12 items-center rounded-lg text-sm font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
      >
        שכחתי סיסמה
      </Link>
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <hr className="flex-1" />
        <span>או</span>
        <hr className="flex-1" />
      </div>
      <AuthForm
        action={googleLogin}
        submitLabel="המשך עם Google"
        variant="outline"
      />
    </div>
  );
}
