import "./tsx-loader.mts";
import { registerHooks } from "node:module";
import test from "node:test";
import assert from "node:assert/strict";
import { validateServerEnv } from "../src/lib/env/schema.ts";

const environment = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project.example.test",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_placeholder",
  NEXT_PUBLIC_APP_URL: "https://app.example.test",
  SUPABASE_SERVICE_ROLE_KEY: "test-only-service-placeholder",
  AUTH_CONTEXT_SECRET: "test-only-context-secret-placeholder-at-least-43",
  ADMIN_EMAIL: "admin@example.test",
  GMAIL_USER: "healthbuddyisrael@gmail.com",
  GMAIL_APP_PASSWORD: "test-only-app-password-placeholder",
  EMAIL_FROM: "Health Buddy <healthbuddyisrael@gmail.com>",
};
Object.assign(process.env, environment);
type Mail = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  messageId: string;
};
const boundary = {
  configurations: [] as Record<string, unknown>[],
  mails: [] as Mail[],
  verifyCalls: 0,
  outcome: "success" as
    "success" | "rejected" | "partial-rejection" | "wrong-recipient" | "error",
};
(
  globalThis as typeof globalThis & { smtpTestBoundary: typeof boundary }
).smtpTestBoundary = boundary;
const smtpMock = `export default { createTransport(options) {
  const state=globalThis.smtpTestBoundary;
  state.configurations.push(options);
  return { verify(){ state.verifyCalls++; }, async sendMail(mail) {
    state.mails.push(mail);
    if(state.outcome==='error') throw new Error('SMTP auth '+options.auth.pass+' '+mail.html);
    return {messageId:mail.messageId,
      accepted:['success','partial-rejection'].includes(state.outcome)?[mail.to]:state.outcome==='wrong-recipient'?['other@example.test']:[],
      rejected:['rejected','partial-rejection'].includes(state.outcome)?[mail.to]:[]};
  }};
}};`;
registerHooks({
  resolve(specifier, context, next) {
    // Node does not run Next's server/client compiler. This empty marker applies
    // only in this test worker. Only Nodemailer's external SMTP boundary is mocked;
    // environment validation, rendering and domain delivery code run unchanged.
    if (specifier === "server-only" || specifier === "nodemailer")
      return {
        shortCircuit: true,
        url: `data:text/javascript,${encodeURIComponent(specifier === "server-only" ? "export {};" : smtpMock)}`,
      };
    return next(specifier, context);
  },
});
const { sendInvitation } = await import("../src/lib/email/send-invitation.ts");
const token = "A".repeat(43);
const invitation = {
  id: "40000000-0000-4000-8000-000000000001",
  email: "invite@example.test",
  role: "trainee" as const,
  initial_target_steps: 10000,
  created_at: "2026-10-01T00:00:00Z",
  expires_at: "2026-10-08T00:00:00Z",
  accepted_at: null,
  revoked_at: null,
};
const inviter = "40000000-0000-4000-8000-000000000002";

test("importing email modules neither initializes SMTP nor verifies credentials", () => {
  assert.equal(boundary.configurations.length, 0);
  assert.equal(boundary.mails.length, 0);
  assert.equal(boundary.verifyCalls, 0);
});

test("coach delivery uses trusted recipient/from, Hebrew subject, HTML and text without token logs", async (t) => {
  const logs: unknown[] = [];
  t.mock.method(console, "info", (...args: unknown[]) => {
    logs.push(args);
  });
  const result = await sendInvitation(
    { ...invitation, role: "coach", initial_target_steps: null },
    token,
    inviter,
  );
  assert.equal(result.success, true);
  const mail = boundary.mails.at(-1)!;
  assert.equal(mail.from, environment.EMAIL_FROM);
  assert.equal(mail.to, invitation.email);
  assert.equal(mail.subject, "הוזמנת להצטרף ל-Health Buddy כמאמן");
  assert.match(mail.html, /lang="he"/);
  assert.match(mail.html, /dir="rtl"/);
  assert.match(mail.text, /להשלמת ההרשמה/);
  assert.ok(mail.text.includes(`/invite/${token}`));
  assert.doesNotMatch(mail.text, /10,000/);
  assert.ok(!mail.messageId.includes(token));
  assert.ok(!JSON.stringify(logs).includes(token));
  assert.ok(!JSON.stringify(logs).includes(environment.GMAIL_APP_PASSWORD));
  const configuration = boundary.configurations[0]!;
  assert.equal(configuration.host, "smtp.gmail.com");
  assert.equal(configuration.port, 465);
  assert.equal(configuration.secure, true);
  assert.equal(configuration.logger, false);
  assert.equal(configuration.debug, false);
});

test("trainee target and RTL/text template are preserved and transporter is reused", async (t) => {
  t.mock.method(console, "info", () => {});
  const result = await sendInvitation(invitation, token, inviter);
  assert.equal(result.success, true);
  const mail = boundary.mails.at(-1)!;
  assert.equal(mail.subject, "הוזמנת להצטרף ל-Health Buddy");
  assert.match(mail.html.replace(/<[^>]*>/g, ""), /10,000 צעדים/);
  assert.match(mail.text, /10,000 צעדים/);
  assert.match(mail.text, /7 ימים/);
  assert.equal(boundary.configurations.length, 1);
  assert.equal(boundary.verifyCalls, 0);
});

for (const outcome of [
  "rejected",
  "partial-rejection",
  "wrong-recipient",
  "error",
] as const) {
  test(`SMTP ${outcome} maps to safe failure without credential/body/token logs`, async (t) => {
    boundary.outcome = outcome;
    const logs: unknown[] = [];
    t.mock.method(console, "info", (...args: unknown[]) => {
      logs.push(args);
    });
    const result = await sendInvitation(invitation, token, inviter);
    assert.deepEqual(result, {
      success: false,
      error: "ההזמנה נוצרה, אך שליחת המייל נכשלה. ניתן לנסות לשלוח אותה מחדש.",
    });
    const output = JSON.stringify({ result, logs });
    for (const secret of [token, environment.GMAIL_APP_PASSWORD, "/invite/"])
      assert.ok(!output.includes(secret));
    boundary.outcome = "success";
  });
}

test("Gmail environment validation is required, strips copied spacing, and never echoes values", () => {
  const parsed = validateServerEnv({
    ...environment,
    GMAIL_APP_PASSWORD: "abcd efgh ijkl mnop",
  });
  assert.equal(parsed.GMAIL_APP_PASSWORD, "abcdefghijklmnop");
  for (const field of ["GMAIL_USER", "GMAIL_APP_PASSWORD", "EMAIL_FROM"]) {
    assert.throws(
      () => validateServerEnv({ ...environment, [field]: undefined }),
      (error: Error) =>
        error.message.includes(field) &&
        !error.message.includes(environment.GMAIL_APP_PASSWORD),
    );
  }
  assert.throws(
    () =>
      validateServerEnv({
        ...environment,
        GMAIL_APP_PASSWORD: "private-short",
      }),
    (error: Error) => !error.message.includes("private-short"),
  );
  assert.ok(!("RESEND_API_KEY" in parsed));
});
