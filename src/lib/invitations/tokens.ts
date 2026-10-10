import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { invitationTokenSchema } from "@/lib/validation/auth";

export function generateInvitationToken() {
  return randomBytes(32).toString("base64url");
}
export function hashInvitationToken(token: string) {
  return createHash("sha256")
    .update(invitationTokenSchema.parse(token))
    .digest("hex");
}
export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
