import { render } from "@react-email/render";
import {
  InvitationEmail,
  invitationSubject,
  type InvitationEmailProps,
} from "./templates/invitation-email.ts";

// Only the external delivery boundary is replaceable in tests.
export type EmailTransport = (email: {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
}) => Promise<{ messageId: string }>;
export type InvitationDelivery = InvitationEmailProps & {
  email: string;
  invitationId: string;
};
export const DELIVERY_FAILURE =
  "ההזמנה נוצרה, אך שליחת המייל נכשלה. ניתן לנסות לשלוח אותה מחדש.";

export async function deliverInvitation(
  input: InvitationDelivery,
  transport: EmailTransport,
) {
  const subject = invitationSubject(input.role);
  const target =
    input.role === "trainee"
      ? `\nיעד צעדים יומי: ${input.initialTargetSteps?.toLocaleString("he-IL")} צעדים\n`
      : "";
  try {
    const html = await render(InvitationEmail(input));
    const { messageId } = await transport({
      to: input.email,
      subject,
      html,
      text: `${subject}\n${target}\nלהשלמת ההרשמה: ${input.invitationUrl}\nהקישור תקף למשך ${input.validDays} ימים.\nאם לא ציפית להזמנה הזו, ניתן להתעלם מהמייל.`,
      idempotencyKey: `invitation/${input.invitationId}`,
    });
    return { success: true as const, messageId };
  } catch {
    // Provider exception strings can contain the request/secret URL; never propagate them.
    return { success: false as const, error: DELIVERY_FAILURE };
  }
}
