import { z } from "zod";

const httpUrl = z.url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "http:" || protocol === "https:";
}, "Must be an HTTP(S) URL");

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: httpUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .trim()
    .startsWith("sb_publishable_")
    .min(20),
  NEXT_PUBLIC_APP_URL: httpUrl,
});

export const serverEnvSchema = publicEnvSchema.extend({
  ADMIN_EMAIL: z.email(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(20),
  AUTH_CONTEXT_SECRET: z.string().min(43),
  GMAIL_USER: z.email(),
  GMAIL_APP_PASSWORD: z
    .string()
    .transform((value) => value.replace(/\s/g, ""))
    .pipe(z.string().min(16)),
  EMAIL_FROM: z
    .string()
    .trim()
    .refine((value) => {
      const address = value.match(/^[^<>\r\n]+<([^<>]+)>$/)?.[1] ?? value;
      return !/[\r\n]/.test(value) && z.email().safeParse(address).success;
    }, "Must be a sender email or Name <sender@verified-domain>"),
});

function parseEnv<T extends z.ZodType>(
  schema: T,
  values: unknown,
): z.output<T> {
  const result = schema.safeParse(values);
  if (!result.success) {
    // Report field names/reasons only; never echo secret values.
    const issues = result.error.issues.map(
      (issue) => `${issue.path.join(".")}: ${issue.message}`,
    );
    throw new Error(
      `Invalid environment configuration. Check .env.local or deployment settings.\n${issues.join("\n")}`,
    );
  }
  return result.data;
}

export function validatePublicEnv(values: unknown) {
  return parseEnv(publicEnvSchema, values);
}

export function validateServerEnv(values: unknown) {
  const parsed = parseEnv(serverEnvSchema, values);
  const platform = values as Record<string, unknown>;
  if (platform.VERCEL_ENV === "production") {
    for (const field of [
      "NEXT_PUBLIC_APP_URL",
      "NEXT_PUBLIC_SUPABASE_URL",
    ] as const) {
      const url = new URL(parsed[field]);
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.pathname !== "/" ||
        url.search ||
        url.hash ||
        url.hostname === "localhost" ||
        url.hostname.endsWith(".localhost") ||
        url.hostname === "127.0.0.1" ||
        url.hostname === "[::1]"
      ) {
        throw new Error(
          `Invalid production configuration: ${field} must be an HTTPS origin.`,
        );
      }
    }
    if (platform.NEXT_TEST_WASM_DIR) {
      throw new Error(
        "Invalid production configuration: NEXT_TEST_WASM_DIR is local-only.",
      );
    }
  }
  return parsed;
}
