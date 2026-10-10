import { z } from "zod";
import { emailSchema } from "./auth";

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "יש להזין סיסמה").max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;
