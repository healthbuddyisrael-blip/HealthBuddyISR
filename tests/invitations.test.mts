import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { InvitationEmail } from "../src/lib/email/templates/invitation-email.ts";
import {
  deliverInvitation,
  DELIVERY_FAILURE,
} from "../src/lib/email/delivery.ts";
import {
  createTraineeInvitationSchema,
  invitationStatus,
  invitationOperationError,
  invitationSummarySchema,
} from "../src/lib/invitations/model.ts";

const summary = {
  id: "40000000-0000-4000-8000-000000000001",
  email: "invite@example.test",
  role: "trainee" as const,
  initial_target_steps: 10000,
  created_at: "2026-10-01T00:00:00Z",
  expires_at: "2026-10-08T00:00:00Z",
  accepted_at: null,
  revoked_at: null,
};
const delivery = {
  email: summary.email,
  invitationId: summary.id,
  role: summary.role,
  initialTargetSteps: 10000,
  invitationUrl: `https://app.example.test/invite/${"A".repeat(43)}`,
  validDays: 7,
};

test("Hebrew RTL templates contain CTA and only intended email-safe content", () => {
  const trainee = renderToStaticMarkup(InvitationEmail(delivery));
  assert.match(trainee, /lang="he"/);
  assert.match(trainee, /dir="rtl"/);
  assert.match(trainee, /השלמת הרשמה/);
  assert.match(trainee.replace(/<[^>]*>/g, ""), /10,000 צעדים/);
  assert.match(trainee, /<bdi dir="ltr">10,000<\/bdi>/);
  assert.match(trainee, /הקישור תקף למשך 7 ימים/);
  assert.ok(trainee.includes(`href="${delivery.invitationUrl}"`));
  assert.ok(!trainee.includes(summary.id));
  assert.doesNotMatch(trainee, /token_hash|coach_id|invited_by/);
  const coach = renderToStaticMarkup(
    InvitationEmail({ ...delivery, role: "coach", initialTargetSteps: null }),
  );
  assert.match(coach, /כמאמן/);
  assert.doesNotMatch(coach, /10,000|יעד הצעדים/);
});

test("delivery uses the external boundary and a token-free idempotency key", async () => {
  let calls = 0;
  const result = await deliverInvitation(delivery, async (email) => {
    calls++;
    assert.equal(email.to, summary.email);
    assert.equal(email.idempotencyKey, `invitation/${summary.id}`);
    assert.ok(email.html.includes(delivery.invitationUrl));
    assert.match(email.html, /lang="he"/);
    assert.match(email.html, /dir="rtl"/);
    assert.match(email.html.replace(/<[^>]*>/g, ""), /10,000 צעדים/);
    assert.ok(email.text.includes(delivery.invitationUrl));
    return { messageId: "test-message" };
  });
  assert.equal(calls, 1);
  assert.deepEqual(result, { success: true, messageId: "test-message" });
});

test("provider errors never expose payloads or claim successful delivery", async () => {
  const result = await deliverInvitation(delivery, async () => {
    throw new Error(`provider secret ${delivery.invitationUrl}`);
  });
  assert.deepEqual(result, { success: false, error: DELIVERY_FAILURE });
  assert.ok(!JSON.stringify(result).includes(delivery.invitationUrl));
});

test("invitation state follows terminal precedence and the exact expiry boundary", () => {
  const expiry = Date.parse(summary.expires_at);
  assert.equal(invitationStatus(summary, expiry - 1), "pending");
  assert.equal(invitationStatus(summary, expiry), "expired");
  assert.equal(
    invitationStatus(
      { ...summary, revoked_at: summary.created_at },
      expiry - 1,
    ),
    "revoked",
  );
  assert.equal(
    invitationStatus(
      { ...summary, accepted_at: summary.created_at },
      expiry - 1,
    ),
    "accepted",
  );
  assert.equal(
    invitationStatus({
      ...summary,
      accepted_at: summary.created_at,
      revoked_at: summary.created_at,
    }),
    "accepted",
  );
});

test("form validation normalizes casing without rewriting aliases and rejects bad targets", () => {
  assert.equal(
    createTraineeInvitationSchema.parse({
      email: " Trainee+test@Example.COM ",
      initialTargetSteps: "10000",
    }).email,
    "trainee+test@example.com",
  );
  for (const target of [null, "", 0, -1, 1.5, 2147483648, "bad"])
    assert.equal(
      createTraineeInvitationSchema.safeParse({
        email: summary.email,
        initialTargetSteps: target,
      }).success,
      false,
    );
  const safe = invitationSummarySchema.parse({
    ...summary,
    token_hash: "hidden",
    coach_id: "hidden",
  });
  assert.ok(!("token_hash" in safe));
  assert.ok(!("coach_id" in safe));
  assert.match(invitationOperationError("HB005"), /יותר מדי/);
  assert.ok(!invitationOperationError("arbitrary SQL secret").includes("SQL"));
});
