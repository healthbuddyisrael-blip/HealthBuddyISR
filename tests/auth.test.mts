import test from "node:test";
import assert from "node:assert/strict";
import { sealContext, openContext } from "../src/lib/auth/context-codec.ts";
import { roleDestination, roleForPath } from "../src/lib/auth/routing.ts";
import {
  invitationTokenSchema,
  registrationSchema,
  profileSchema,
  emailSchema,
} from "../src/lib/validation/auth.ts";

test("signed context rejects tampering, wrong key, expiry, malformed input", () => {
  const secret = "test-only-signing-key";
  const value = sealContext(
    { purpose: "invitation", token: "fixture" },
    secret,
    2000,
  );
  assert.deepEqual(openContext(value, secret, 1000), {
    purpose: "invitation",
    token: "fixture",
  });
  assert.equal(openContext(value, secret, 2000), null);
  assert.equal(openContext(value, "another-key", 1000), null);
  assert.equal(openContext(`x${value}`, secret, 1000), null);
  assert.equal(openContext(`${value}.extra`, secret, 1000), null);
  assert.equal(openContext("broken", secret), null);
});

test("route boundaries map only canonical roles and whole path segments", () => {
  assert.equal(roleDestination("trainee"), "/app");
  assert.equal(roleDestination("coach"), "/coach");
  assert.equal(roleDestination("admin"), "/admin");
  assert.equal(roleForPath("/coach/trainees/id"), "coach");
  assert.equal(roleForPath("/admin/coaches/id"), "admin");
  assert.equal(roleForPath("/app"), "trainee");
  assert.equal(roleForPath("/application"), null);
  assert.equal(roleForPath("/coach-extra"), null);
  assert.equal(roleForPath("/login"), null);
});

test("registration validates confirmation, entropy-shaped tokens, and bounded inputs", () => {
  const input = {
    token: "A".repeat(43),
    fullName: "ישראל ישראלי",
    password: "valid-password",
    confirmation: "valid-password",
  };
  assert.equal(registrationSchema.safeParse(input).success, true);
  assert.equal(
    registrationSchema.safeParse({ ...input, confirmation: "different" })
      .success,
    false,
  );
  assert.equal(
    registrationSchema.safeParse({ ...input, fullName: " " }).success,
    false,
  );
  assert.equal(
    registrationSchema.safeParse({
      ...input,
      password: "short",
      confirmation: "short",
    }).success,
    false,
  );
  assert.equal(invitationTokenSchema.safeParse("../../admin").success, false);
  assert.equal(
    invitationTokenSchema.safeParse("A".repeat(10000)).success,
    false,
  );
  assert.equal(emailSchema.parse("Coach@Example.com"), "coach@example.com");
});

test("database profile parser accepts only persisted supported roles", () => {
  const profile = {
    id: "10000000-0000-4000-8000-000000000001",
    email: "user@example.com",
    full_name: "ישראל",
    role: "trainee",
  };
  assert.equal(profileSchema.safeParse(profile).success, true);
  assert.equal(
    profileSchema.safeParse({ ...profile, role: "owner" }).success,
    false,
  );
  assert.equal(
    profileSchema.safeParse({ user_metadata: { role: "admin" } }).success,
    false,
  );
});
