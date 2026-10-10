import "server-only";
import { cookies } from "next/headers";
import { z } from "zod";
import { serverEnv } from "@/lib/env/server";
import { invitationTokenSchema } from "@/lib/validation/auth";
import { sealContext, openContext } from "./context-codec";

const options = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 600,
};
const pendingSchema = z.object({
  purpose: z.literal("invitation"),
  token: invitationTokenSchema,
});
const recoverySchema = z.object({
  purpose: z.literal("recovery"),
  userId: z.uuid(),
  sessionId: z.uuid(),
});

export async function setPendingInvitation(token: string) {
  (await cookies()).set(
    "hb-invitation",
    sealContext(
      { purpose: "invitation", token },
      serverEnv.AUTH_CONTEXT_SECRET,
      Date.now() + 600_000,
    ),
    options,
  );
}
export async function getPendingInvitation() {
  const parsed = pendingSchema.safeParse(
    openContext(
      (await cookies()).get("hb-invitation")?.value,
      serverEnv.AUTH_CONTEXT_SECRET,
    ),
  );
  return parsed.success ? parsed.data.token : null;
}
export async function clearPendingInvitation() {
  (await cookies()).delete("hb-invitation");
}
export async function setRecoveryContext(userId: string, sessionId: string) {
  (await cookies()).set(
    "hb-recovery",
    sealContext(
      { purpose: "recovery", userId, sessionId },
      serverEnv.AUTH_CONTEXT_SECRET,
      Date.now() + 600_000,
    ),
    options,
  );
}
export async function getRecoveryContext() {
  const parsed = recoverySchema.safeParse(
    openContext(
      (await cookies()).get("hb-recovery")?.value,
      serverEnv.AUTH_CONTEXT_SECRET,
    ),
  );
  return parsed.success ? parsed.data : null;
}
export async function clearRecoveryContext() {
  (await cookies()).delete("hb-recovery");
}
