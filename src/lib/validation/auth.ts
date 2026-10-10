import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .pipe(z.email("יש להזין אימייל תקין"))
  .transform((value) => value.toLowerCase());
export const fullNameSchema = z
  .string({ error: "יש להזין שם מלא" })
  .trim()
  .min(1, "יש להזין שם מלא")
  .max(100, "השם ארוך מדי");
export const passwordSchema = z
  .string({ error: "יש להזין סיסמה" })
  .min(10, "הסיסמה צריכה להכיל לפחות 10 תווים")
  .max(128, "הסיסמה ארוכה מדי");
export const invitationTokenSchema = z
  .string({ error: "ההזמנה אינה תקפה או שפג תוקפה." })
  .regex(/^[A-Za-z0-9_-]{43}$/, "ההזמנה אינה תקפה או שפג תוקפה.");
export const userRoleSchema = z.enum(["admin", "coach", "trainee"]);
export const profileSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  full_name: fullNameSchema,
  role: userRoleSchema,
});
export const passwordConfirmationSchema = z
  .object({
    password: passwordSchema,
    confirmation: z.string({ error: "יש להזין אימות סיסמה" }),
  })
  .refine((value) => value.password === value.confirmation, {
    message: "הסיסמאות אינן תואמות",
    path: ["confirmation"],
  });
export const registrationSchema = passwordConfirmationSchema.safeExtend({
  token: invitationTokenSchema,
  fullName: fullNameSchema,
});
export const existingInvitationSchema = z.object({
  token: invitationTokenSchema,
  fullName: fullNameSchema,
  password: z.string().min(1),
});
export const activationSchema = z.object({ fullName: fullNameSchema });
export const recoveryTokenSchema = z.string().regex(/^[a-zA-Z0-9_-]{32,256}$/);
export type AuthActionState = { error?: string; success?: string };
