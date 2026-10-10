"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentProfile, requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  generateInvitationToken,
  hashInvitationToken,
} from "@/lib/invitations/tokens";
import {
  createCoachInvitationSchema,
  createTraineeInvitationSchema,
  invitationSummarySchema,
  invitationOperationError,
} from "@/lib/invitations/model";
import { sendInvitation } from "@/lib/email/send-invitation";
import type { AuthActionState } from "@/lib/validation/auth";

async function sendCreatedInvitation(
  data: unknown,
  error: { code?: string } | null,
  token: string,
  actorId: string,
): Promise<AuthActionState> {
  if (error) return { error: invitationOperationError(error.code) };
  const invitation = invitationSummarySchema.safeParse(data);
  if (!invitation.success)
    return {
      error: "הפעולה לא הושלמה. יש לרענן את רשימת ההזמנות לפני ניסיון נוסף.",
    };
  // RPC has committed before external email. Revalidate even when delivery fails.
  revalidatePath("/admin");
  revalidatePath("/admin/invitations");
  revalidatePath("/coach");
  revalidatePath("/coach/invitations");
  const delivery = await sendInvitation(invitation.data, token, actorId);
  return delivery.success
    ? { success: "ההזמנה נשלחה בהצלחה." }
    : { error: delivery.error };
}

export async function inviteCoach(
  _previous: AuthActionState,
  form: FormData,
): Promise<AuthActionState> {
  const profile = await requireRole("admin");
  const input = createCoachInvitationSchema.safeParse({
    email: form.get("email"),
  });
  if (!input.success) return { error: "יש להזין אימייל תקין." };
  const token = generateInvitationToken();
  const client = await createClient();
  const { data, error } = await client.rpc("create_coach_invitation", {
    p_email: input.data.email,
    p_token_hash: hashInvitationToken(token),
  });
  return sendCreatedInvitation(data, error, token, profile.id);
}

export async function inviteTrainee(
  _previous: AuthActionState,
  form: FormData,
): Promise<AuthActionState> {
  const profile = await requireRole("coach");
  const input = createTraineeInvitationSchema.safeParse({
    email: form.get("email"),
    initialTargetSteps: form.get("initialTargetSteps"),
  });
  if (!input.success)
    return {
      error: input.error.issues[0]?.message ?? "יש לבדוק את פרטי ההזמנה.",
    };
  const token = generateInvitationToken();
  const client = await createClient();
  const { data, error } = await client.rpc("create_trainee_invitation", {
    p_email: input.data.email,
    p_initial_target_steps: input.data.initialTargetSteps,
    p_token_hash: hashInvitationToken(token),
  });
  return sendCreatedInvitation(data, error, token, profile.id);
}

export async function resendInvitation(
  _previous: AuthActionState,
  form: FormData,
): Promise<AuthActionState> {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "coach"))
    return { error: "לא נמצאה הרשאה מתאימה לחשבון הזה." };
  const id = z.uuid().safeParse(form.get("invitationId"));
  if (!id.success) return { error: invitationOperationError() };
  const token = generateInvitationToken();
  const client = await createClient();
  const { data, error } = await client.rpc("rotate_invitation", {
    p_invitation_id: id.data,
    p_token_hash: hashInvitationToken(token),
  });
  return sendCreatedInvitation(data, error, token, profile.id);
}

export async function revokeInvitation(
  _previous: AuthActionState,
  form: FormData,
): Promise<AuthActionState> {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "coach"))
    return { error: "לא נמצאה הרשאה מתאימה לחשבון הזה." };
  const id = z.uuid().safeParse(form.get("invitationId"));
  if (!id.success) return { error: invitationOperationError() };
  const client = await createClient();
  const { error } = await client.rpc("revoke_invitation", {
    p_invitation_id: id.data,
  });
  if (error) return { error: invitationOperationError(error.code) };
  revalidatePath("/admin");
  revalidatePath("/admin/invitations");
  revalidatePath("/coach");
  revalidatePath("/coach/invitations");
  return { success: "ההזמנה בוטלה. לא ניתן להשתמש בקישור שנשלח." };
}
