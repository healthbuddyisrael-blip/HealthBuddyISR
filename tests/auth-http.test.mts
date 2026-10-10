import test from "node:test";
import assert from "node:assert/strict";

// Run against a local built app without a session; no provider/Auth mocks.
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3100";

test("anonymous users cannot fetch any protected route prefix", async () => {
  for (const path of [
    "/app",
    "/coach",
    "/coach/invitations",
    "/coach/trainees/test-id",
    "/admin",
    "/admin/invitations",
    "/admin/coaches/test-id",
    "/admin/coaches/test-id/trainees/test-id",
  ]) {
    const response = await fetch(`${base}${path}`, { redirect: "manual" });
    assert.equal(response.status, 307, path);
    assert.equal(
      new URL(response.headers.get("location")!, base).pathname,
      "/login",
      path,
    );
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  }
});

test("login is Hebrew RTL with both methods and no public signup link", async () => {
  const response = await fetch(`${base}/login`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(
    response.headers.get("referrer-policy"),
    "strict-origin-when-cross-origin",
  );
  const html = await response.text();
  assert.match(html, /lang="he"/);
  assert.match(html, /dir="rtl"/);
  assert.match(html, /המשך עם Google/);
  assert.match(html, /שכחתי סיסמה/);
  assert.doesNotMatch(html, /href="\/(register|signup)/);
});

test("malformed invitations and missing recovery proof never render activation/password forms", async () => {
  const invitation = await fetch(`${base}/invite/not-a-token`);
  const inviteHtml = await invitation.text();
  assert.match(inviteHtml, /ההזמנה אינה תקפה/);
  assert.doesNotMatch(inviteHtml, /name="password"/);
  assert.equal(invitation.headers.get("referrer-policy"), "no-referrer");
  const reset = await fetch(`${base}/reset-password`);
  assert.doesNotMatch(await reset.text(), /name="password"/);
});

test("cancelled OAuth redirects safely and public signup routes do not exist", async () => {
  const callback = await fetch(`${base}/auth/callback?error=access_denied`, {
    redirect: "manual",
  });
  assert.equal(callback.status, 307);
  const destination = new URL(callback.headers.get("location")!, base);
  assert.equal(destination.pathname, "/login");
  assert.equal(destination.searchParams.get("error"), "oauth");
  for (const path of ["/register", "/signup"])
    assert.equal((await fetch(`${base}${path}`)).status, 404);
});
