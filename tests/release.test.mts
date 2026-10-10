import test from "node:test";
import assert from "node:assert/strict";
import { validateServerEnv } from "../src/lib/env/schema.ts";
import { securityHeaders } from "../src/lib/security/headers.ts";

const environment = {
  NEXT_PUBLIC_APP_URL: "https://app.example.test",
  NEXT_PUBLIC_SUPABASE_URL: "https://project.example.test",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_placeholder",
  ADMIN_EMAIL: "healthbuddyisrael@gmail.com",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-placeholder-not-real",
  AUTH_CONTEXT_SECRET: "test-only-context-signing-placeholder-longer-than-43",
  GMAIL_USER: "healthbuddyisrael@gmail.com",
  GMAIL_APP_PASSWORD: "test-only-placeholder-app-password",
  EMAIL_FROM: "Test <sender@example.test>",
  VERCEL_ENV: "production",
};

test("production rejects unsafe origins without printing values or secrets", () => {
  assert.doesNotThrow(() => validateServerEnv(environment));
  for (const field of ["NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SUPABASE_URL"]) {
    for (const value of [
      "http://localhost:3000",
      "https://example.test/path",
      "https://user:private@example.test",
      "https://example.test?token=private",
      "https://example.test#private",
    ]) {
      assert.throws(
        () => validateServerEnv({ ...environment, [field]: value }),
        (error: Error) =>
          error.message.includes(field) && !error.message.includes("private"),
      );
    }
  }
  assert.throws(() =>
    validateServerEnv({ ...environment, NEXT_TEST_WASM_DIR: "local-path" }),
  );
});

test("local builds retain local origins and HTTP without production HSTS", () => {
  assert.doesNotThrow(() =>
    validateServerEnv({
      ...environment,
      VERCEL_ENV: "development",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    }),
  );
  assert.equal(
    securityHeaders(false).some(
      (header) => header.key === "Strict-Transport-Security",
    ),
    false,
  );
  const production = Object.fromEntries(
    securityHeaders(true).map(({ key, value }) => [key, value]),
  );
  assert.equal(production["X-Content-Type-Options"], "nosniff");
  assert.equal(production["X-Frame-Options"], "DENY");
  assert.equal(production["Strict-Transport-Security"], "max-age=31536000");
});
