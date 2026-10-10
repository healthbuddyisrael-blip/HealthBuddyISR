import "server-only";
import { z } from "zod";
import { createPrivilegedClient } from "@/lib/supabase/privileged";
import { invitationTokenSchema, userRoleSchema } from "@/lib/validation/auth";
import { hashInvitationToken } from "./tokens";

const invitationSchema = z.object({
  email: z.email(),
  role: z.enum(["coach", "trainee"]),
  coach_id: z.uuid().nullable(),
  initial_target_steps: z.number().int().positive().nullable(),
});

export async function getValidInvitation(token: string) {
  if (!invitationTokenSchema.safeParse(token).success) return null;
  const { data, error } = await createPrivilegedClient()
    .from("invitations")
    .select("email,role,coach_id,initial_target_steps")
    .eq("token_hash", hashInvitationToken(token))
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) return null;
  const parsed = invitationSchema.safeParse(data);
  if (!parsed.success) return null;
  if (
    parsed.data.role === "trainee" &&
    (!parsed.data.coach_id || !parsed.data.initial_target_steps)
  )
    return null;
  return parsed.data;
}

export async function activateInvitation(
  token: string,
  userId: string,
  fullName: string,
) {
  const { data, error } = await createPrivilegedClient().rpc(
    "accept_invitation",
    {
      p_token_hash: hashInvitationToken(token),
      p_auth_user_id: userId,
      p_full_name: fullName,
    },
  );
  const parsed = userRoleSchema.safeParse(data);
  return {
    role: !error && parsed.success ? parsed.data : null,
    errorCode: error?.code,
  };
}
