import type { Metadata } from "next";
import { LoginForm } from "@/components/shared/login-form";
import { AuthPanel } from "@/components/shared/auth-panel";
import { ErrorState, SuccessFeedback } from "@/components/shared/feedback";
import { publicAuthMessage } from "@/lib/auth/messages";

export const metadata: Metadata = { title: "כניסה למערכת" };
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const message = publicAuthMessage(params.error);
  return (
    <AuthPanel title="כניסה למערכת">
      {message ? <ErrorState message={message} /> : null}
      {params.success === "password" ? (
        <SuccessFeedback message="הסיסמה עודכנה. אפשר להיכנס למערכת." />
      ) : null}
      <LoginForm />
    </AuthPanel>
  );
}
