import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { profileSchema } from "@/lib/validation/auth";
import { roleDestination } from "./routing";
import type { UserRole } from "@/types/domain";

// React cache is request-scoped; no shared authorization/session cache.
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  return error ? null : data.user;
});

export const getCurrentProfile = cache(async () => {
  const user = await getCurrentUser();
  if (!user?.email_confirmed_at) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,full_name,role")
    .eq("id", user.id)
    .maybeSingle();
  if (error) return null;
  const parsed = profileSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
});

export async function requireAuthenticatedUser() {
  const user = await getCurrentUser();
  if (!user?.email_confirmed_at) redirect("/login");
  return user;
}

export async function requireRole(role: UserRole) {
  await requireAuthenticatedUser();
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?error=membership");
  if (profile.role !== role) redirect(roleDestination(profile.role));
  return profile;
}
