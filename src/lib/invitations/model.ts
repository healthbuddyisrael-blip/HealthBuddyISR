import { z } from "zod";
import { emailSchema } from "../validation/auth.ts";

export const invitationSummarySchema = z.object({
  id: z.uuid(),
  email: z.email(),
  role: z.enum(["coach", "trainee"]),
  initial_target_steps: z.number().int().positive().nullable(),
  created_at: z.iso.datetime({ offset: true }),
  expires_at: z.iso.datetime({ offset: true }),
  accepted_at: z.iso.datetime({ offset: true }).nullable(),
  revoked_at: z.iso.datetime({ offset: true }).nullable(),
});
export type InvitationSummary = z.infer<typeof invitationSummarySchema>;
export const createCoachInvitationSchema = z.object({ email: emailSchema });
export const createTraineeInvitationSchema = createCoachInvitationSchema.extend(
  {
    initialTargetSteps: z.coerce
      .number({ error: "יש להזין יעד צעדים תקין." })
      .int("היעד חייב להיות מספר שלם.")
      .positive("היעד חייב להיות גדול מאפס.")
      .max(2147483647, "היעד גבוה מדי."),
  },
);
export function invitationStatus(
  invitation: InvitationSummary,
  now = Date.now(),
) {
  if (invitation.accepted_at) return "accepted";
  if (invitation.revoked_at) return "revoked";
  if (Date.parse(invitation.expires_at) <= now) return "expired";
  return "pending";
}
export const INVITATION_STATUS_LABELS = {
  pending: "ממתינה",
  expired: "פגה",
  revoked: "בוטלה",
  accepted: "הושלמה",
} as const;
export function invitationOperationError(code?: string) {
  switch (code) {
    case "HB001":
      return "כבר קיים משתמש פעיל עם כתובת האימייל הזו.";
    case "HB002":
      return "כבר קיימת הזמנה פעילה לכתובת הזו. ניתן לבחור שליחה מחדש ברשימה.";
    case "HB005":
      return "נשלחו יותר מדי הזמנות בזמן קצר. נסו שוב מאוחר יותר.";
    case "HB004":
      return "ההזמנה אינה זמינה לפעולה הזו. להזמנה שפגה יש ליצור הזמנה חדשה.";
    default:
      return "לא ניתן לבצע את הפעולה. נסו שוב או פנו למנהל המערכת.";
  }
}
