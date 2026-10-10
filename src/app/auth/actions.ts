"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createPrivilegedClient } from "@/lib/supabase/privileged";
import { publicEnv } from "@/lib/env/public";
import { loginSchema } from "@/lib/validation/login";
import {
  activationSchema,
  emailSchema,
  existingInvitationSchema,
  invitationTokenSchema,
  passwordConfirmationSchema,
  profileSchema,
  recoveryTokenSchema,
  registrationSchema,
  type AuthActionState,
} from "@/lib/validation/auth";
import { AUTH_MESSAGES } from "@/lib/auth/messages";
import { clearSessionCookies } from "@/lib/auth/clear-session";
import { roleDestination } from "@/lib/auth/routing";
import {
  clearPendingInvitation,
  clearRecoveryContext,
  getPendingInvitation,
  getRecoveryContext,
  setPendingInvitation,
  setRecoveryContext,
} from "@/lib/auth/context";
import {
  activateInvitation,
  getValidInvitation,
} from "@/lib/invitations/server";
import { normalizeEmail } from "@/lib/invitations/tokens";

// Codes only. Never log provider messages, URLs, form data, passwords, or tokens.
function diagnostic(operation: string, code?: string, userId?: string) {
  console.error("auth_operation_failed", {
    operation,
    userId,
    code: code && /^[a-zA-Z0-9_]{1,64}$/.test(code) ? code : "unknown",
  });
}

async function finishLogin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email || !user.email_confirmed_at) {
    await supabase.auth.signOut({ scope: "local" });
    await clearSessionCookies();
    return { error: AUTH_MESSAGES.membership };
  }
  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,full_name,role")
    .eq("id", user.id)
    .maybeSingle();
  const profile = profileSchema.safeParse(data);
  if (!error && profile.success) {
    await clearPendingInvitation();
    await clearRecoveryContext();
    redirect(roleDestination(profile.data.role));
  }
  const token = await getPendingInvitation();
  const invitation = token ? await getValidInvitation(token) : null;
  if (invitation && normalizeEmail(user.email) === invitation.email)
    redirect("/invite/complete");
  await supabase.auth.signOut({ scope: "local" });
  await clearSessionCookies();
  await clearPendingInvitation();
  return { error: AUTH_MESSAGES.membership };
}

export async function passwordLogin(
  _previous: AuthActionState,
  form: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: form.get("email"),
    password: form.get("password"),
  });
  if (!parsed.success) return { error: "יש להזין אימייל וסיסמה תקינים." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    ...parsed.data,
    email: normalizeEmail(parsed.data.email),
  });
  if (error) return { error: AUTH_MESSAGES.credentials };
  return finishLogin();
}

export async function googleLogin(
  _previous: AuthActionState,
  form: FormData,
): Promise<AuthActionState> {
  const token = form.get("token");
  if (token !== null) {
    const parsed = invitationTokenSchema.safeParse(token);
    if (!parsed.success || !(await getValidInvitation(parsed.data)))
      return { error: AUTH_MESSAGES.invitation };
    await setPendingInvitation(parsed.data);
  }
  await clearRecoveryContext();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${publicEnv.NEXT_PUBLIC_APP_URL}/auth/callback`,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) {
    await clearPendingInvitation();
    return { error: AUTH_MESSAGES.oauth };
  }
  redirect(data.url);
}

export async function logout() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    // Local session removal remains necessary if remote session revocation fails.
    await supabase.auth.signOut({ scope: "local" });
    diagnostic("logout", error.code);
  }
  await clearPendingInvitation();
  await clearRecoveryContext();
  await clearSessionCookies();
  redirect("/login");
}

export async function registerFromInvitation(
  _previous: AuthActionState,
  form: FormData,
): Promise<AuthActionState> {
  const parsed = registrationSchema.safeParse({
    token: form.get("token"),
    fullName: form.get("fullName"),
    password: form.get("password"),
    confirmation: form.get("confirmation"),
  });
  if (!parsed.success)
    return {
      error: parsed.error.issues[0]?.message ?? AUTH_MESSAGES.invitation,
    };
  const { token, fullName, password } = parsed.data;
  const invitation = await getValidInvitation(token);
  if (!invitation) return { error: AUTH_MESSAGES.invitation };
  await setPendingInvitation(token);
  const sessionClient = await createClient();
  const {
    data: { user: currentUser },
  } = await sessionClient.auth.getUser();
  if (currentUser)
    return {
      error:
        "כבר התחברתם לחשבון. יש להשלים את ההזמנה מהחשבון המתאים או להתנתק.",
    };
  const privileged = createPrivilegedClient();
  const attemptId = randomUUID();
  const { data, error } = await privileged.auth.admin.createUser({
    email: invitation.email,
    password,
    // Possession of the private random invitation link is the email verification proof.
    email_confirm: true,
    app_metadata: { activation_attempt_id: attemptId },
  });
  if (error || !data.user) {
    if (error?.code === "email_exists" || error?.code === "user_already_exists")
      return { error: AUTH_MESSAGES.existing };
    diagnostic("create_invited_user", error?.code);
    return { error: AUTH_MESSAGES.unavailable };
  }
  const result = await activateInvitation(token, data.user.id, fullName);
  if (!result.role) {
    // Safe even if RPC response was lost AFTER successful commit: cleanup refuses profiles.
    const cleanup = await privileged.rpc("cleanup_unactivated_auth_user", {
      p_auth_user_id: data.user.id,
      p_attempt_id: attemptId,
    });
    diagnostic("activate_new_user", result.errorCode, data.user.id);
    if (cleanup.error)
      diagnostic("compensate_new_user", cleanup.error.code, data.user.id);
    if (cleanup.data === true) return { error: AUTH_MESSAGES.invitation };
    // A completed concurrent activation can proceed; an orphan remains blocked by membership checks.
    if (cleanup.error)
      return {
        error:
          "החשבון נוצר אך ההפעלה לא הושלמה. יש להתחבר כדי לנסות להשלים את ההזמנה, או לפנות למזמין.",
      };
  }
  const { error: loginError } = await sessionClient.auth.signInWithPassword({
    email: invitation.email,
    password,
  });
  if (loginError)
    return { error: "החשבון הופעל. יש להיכנס עם האימייל והסיסמה שבחרתם." };
  return finishLogin();
}

export async function existingInvitationLogin(
  _previous: AuthActionState,
  form: FormData,
): Promise<AuthActionState> {
  const parsed = existingInvitationSchema.safeParse({
    token: form.get("token"),
    fullName: form.get("fullName"),
    password: form.get("password"),
  });
  if (!parsed.success) return { error: "יש להזין שם מלא וסיסמה." };
  const invitation = await getValidInvitation(parsed.data.token);
  if (!invitation) return { error: AUTH_MESSAGES.invitation };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: invitation.email,
    password: parsed.data.password,
  });
  if (error) return { error: AUTH_MESSAGES.credentials };
  await setPendingInvitation(parsed.data.token);
  const activationForm = new FormData();
  activationForm.set("fullName", parsed.data.fullName);
  return acceptPendingInvitation({}, activationForm);
}

export async function acceptPendingInvitation(
  _previous: AuthActionState,
  form: FormData,
): Promise<AuthActionState> {
  const parsed = activationSchema.safeParse({ fullName: form.get("fullName") });
  if (!parsed.success) return { error: "יש להזין שם מלא." };
  const token = await getPendingInvitation();
  const invitation = token ? await getValidInvitation(token) : null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!token || !invitation) {
    await clearPendingInvitation();
    return { error: AUTH_MESSAGES.invitation };
  }
  if (
    !user?.email ||
    !user.email_confirmed_at ||
    normalizeEmail(user.email) !== invitation.email
  ) {
    await clearPendingInvitation();
    await supabase.auth.signOut({ scope: "local" });
    await clearSessionCookies();
    return { error: AUTH_MESSAGES.membership };
  }
  const result = await activateInvitation(token, user.id, parsed.data.fullName);
  if (!result.role) {
    await clearPendingInvitation();
    diagnostic("activate_existing_user", result.errorCode);
    return { error: AUTH_MESSAGES.invitation };
  }
  await clearPendingInvitation();
  await clearRecoveryContext();
  redirect(roleDestination(result.role));
}

export async function requestPasswordReset(
  _previous: AuthActionState,
  form: FormData,
): Promise<AuthActionState> {
  const email = emailSchema.safeParse(form.get("email"));
  if (!email.success) return { error: "יש להזין אימייל תקין." };
  const privileged = createPrivilegedClient();
  const { data } = await privileged
    .from("profiles")
    .select("id")
    .eq("email", email.data)
    .maybeSingle();
  const id = z.uuid().safeParse(data?.id);
  if (id.success) {
    const { data: auth } = await privileged.auth.admin.getUserById(id.data);
    if (
      auth.user?.identities?.some((identity) => identity.provider === "email")
    ) {
      const supabase = await createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
        redirectTo: `${publicEnv.NEXT_PUBLIC_APP_URL}/auth/recovery`,
      });
      if (error) diagnostic("request_recovery", error.code);
    }
  }
  return {
    success: "אם קיים חשבון עבור הכתובת שהוזנה, נשלחו הוראות לאיפוס הסיסמה.",
  };
}

export async function verifyRecovery(
  _previous: AuthActionState,
  form: FormData,
): Promise<AuthActionState> {
  const token = recoveryTokenSchema.safeParse(form.get("recoveryToken"));
  if (!token.success) return { error: AUTH_MESSAGES.recovery };
  const supabase = await createClient();
  await clearRecoveryContext();
  const { error } = await supabase.auth.verifyOtp({
    type: "recovery",
    token_hash: token.data,
  });
  if (error) return { error: AUTH_MESSAGES.recovery };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: claims } = await supabase.auth.getClaims();
  const sessionId = z.uuid().safeParse(claims?.claims.session_id);
  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };
  if (
    !user?.email_confirmed_at ||
    !sessionId.success ||
    !profile ||
    !user.identities?.some((identity) => identity.provider === "email")
  ) {
    await supabase.auth.signOut({ scope: "local" });
    await clearSessionCookies();
    return { error: AUTH_MESSAGES.recovery };
  }
  await clearPendingInvitation();
  await setRecoveryContext(user.id, sessionId.data);
  redirect("/reset-password");
}

export async function updateRecoveredPassword(
  _previous: AuthActionState,
  form: FormData,
): Promise<AuthActionState> {
  const parsed = passwordConfirmationSchema.safeParse({
    password: form.get("password"),
    confirmation: form.get("confirmation"),
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? AUTH_MESSAGES.recovery };
  const context = await getRecoveryContext();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: claims } = await supabase.auth.getClaims();
  if (
    !context ||
    !user ||
    context.userId !== user.id ||
    context.sessionId !== claims?.claims.session_id
  ) {
    await clearRecoveryContext();
    return { error: AUTH_MESSAGES.recovery };
  }
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error)
    return {
      error: "לא ניתן לעדכן את הסיסמה. יש לנסות שוב או לבקש קישור חדש.",
    };
  await clearRecoveryContext();
  await supabase.auth.signOut();
  await clearSessionCookies();
  redirect("/login?success=password");
}
