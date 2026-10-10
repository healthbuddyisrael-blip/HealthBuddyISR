import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env/public";
import {
  clearPendingInvitation,
  clearRecoveryContext,
  getPendingInvitation,
} from "@/lib/auth/context";
import { getValidInvitation } from "@/lib/invitations/server";
import { normalizeEmail } from "@/lib/invitations/tokens";
import { profileSchema } from "@/lib/validation/auth";
import { roleDestination } from "@/lib/auth/routing";
import { clearSessionCookies } from "@/lib/auth/clear-session";

export async function GET(request: NextRequest) {
  // OAuth callback exchanges PKCE codes; membership activation requires a later POST.
  const supabase = await createClient();
  const go = (path: string) => {
    const response = NextResponse.redirect(
      new URL(path, publicEnv.NEXT_PUBLIC_APP_URL),
    );
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  };
  const fail = async (code: string, exchangedSession = false) => {
    await clearPendingInvitation();
    await clearRecoveryContext();
    // A forged/cancelled callback must not log out an unrelated existing session.
    if (exchangedSession) {
      await supabase.auth.signOut({ scope: "local" });
      await clearSessionCookies();
    }
    return go(`/login?error=${code}`);
  };
  const code = request.nextUrl.searchParams.get("code");
  if (!code || request.nextUrl.searchParams.has("error")) return fail("oauth");
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return fail("oauth");
  await clearRecoveryContext();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email || !user.email_confirmed_at) return fail("membership", true);
  const token = await getPendingInvitation();
  if (token) {
    const invitation = await getValidInvitation(token);
    if (!invitation) return fail("invitation", true);
    if (normalizeEmail(user.email) !== invitation.email)
      return fail("mismatch", true);
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    if (existing) return fail("membership", true);
    return go("/invite/complete");
  }
  const { data, error: profileError } = await supabase
    .from("profiles")
    .select("id,email,full_name,role")
    .eq("id", user.id)
    .maybeSingle();
  const profile = profileSchema.safeParse(data);
  if (profileError || !profile.success) return fail("membership", true);
  return go(roleDestination(profile.data.role));
}
