import "server-only";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env/public";
import { roleForPath, roleDestination } from "@/lib/auth/routing";
import { profileSchema } from "@/lib/validation/auth";

/** Refresh sessions and redirect wrong-role requests early; pages and RLS enforce access too. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([name, value]) =>
            response.headers.set(name, value),
          );
        },
      },
    },
  );
  // Verify/refresh signed claims; never trust getSession() for server authorization.
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  response.headers.set("Cache-Control", "private, no-store");
  const requiredRole = roleForPath(request.nextUrl.pathname);
  if (requiredRole) {
    let destination: string | null = null;
    if (claimsError || !claims?.claims.sub) destination = "/login";
    else {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,email,full_name,role")
        .eq("id", claims.claims.sub)
        .maybeSingle();
      const profile = profileSchema.safeParse(data);
      if (error || !profile.success) destination = "/login?error=membership";
      else if (profile.data.role !== requiredRole)
        destination = roleDestination(profile.data.role);
    }
    if (destination) {
      const redirected = NextResponse.redirect(
        new URL(destination, publicEnv.NEXT_PUBLIC_APP_URL),
      );
      response.cookies
        .getAll()
        .forEach((cookie) => redirected.cookies.set(cookie));
      response.headers.forEach((value, name) => {
        if (name !== "set-cookie" && !name.startsWith("x-middleware"))
          redirected.headers.set(name, value);
      });
      return redirected;
    }
  }
  return response;
}
