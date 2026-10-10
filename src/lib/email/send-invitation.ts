import "server-only";
import { publicEnv } from "@/lib/env/public";
import { gmailTransport } from "./client";
import { deliverInvitation } from "./delivery";
import type { InvitationSummary } from "@/lib/invitations/model";

export async function sendInvitation(
  invitation: InvitationSummary,
  rawToken: string,
  inviterId: string,
) {
  const invitationUrl = new URL(
    `/invite/${rawToken}`,
    publicEnv.NEXT_PUBLIC_APP_URL,
  ).href;
  const result = await deliverInvitation(
    {
      email: invitation.email,
      invitationId: invitation.id,
      role: invitation.role,
      initialTargetSteps: invitation.initial_target_steps,
      invitationUrl,
      validDays: Math.round(
        (Date.parse(invitation.expires_at) -
          Date.parse(invitation.created_at)) /
          86_400_000,
      ),
    },
    gmailTransport,
  );
  // No provider payloads, emails, hashes, or URLs. UUIDs and result only.
  console.info("invitation_delivery", {
    invitationId: invitation.id,
    inviterId,
    role: invitation.role,
    success: result.success,
    messageId: result.success ? result.messageId : undefined,
  });
  return result;
}
