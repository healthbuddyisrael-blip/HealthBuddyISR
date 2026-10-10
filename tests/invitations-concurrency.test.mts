import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { invitationSummarySchema } from "../src/lib/invitations/model.ts";

// Real concurrent PostgreSQL sessions; never run against production or hosted Supabase.
const database = process.env.TEST_DATABASE_NAME;
assert.ok(
  ["127.0.0.1", "localhost", "::1"].includes(
    process.env.TEST_DATABASE_HOST ?? "127.0.0.1",
  ),
  "Local database only",
);
if (!database?.startsWith("healthbuddy_auth_"))
  throw new Error(
    "Set TEST_DATABASE_NAME to a disposable healthbuddy_auth_* database",
  );
const executable = process.env.TEST_PSQL_PATH ?? "psql";
const args = [
  "-X",
  "-q",
  "-t",
  "-A",
  "-h",
  process.env.TEST_DATABASE_HOST ?? "127.0.0.1",
  "-p",
  process.env.TEST_DATABASE_PORT ?? "55439",
  "-U",
  "postgres",
  "-d",
  database,
  "-v",
  "ON_ERROR_STOP=1",
];
function sql(query: string) {
  const result = spawnSync(executable, args, {
    input: query,
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
function concurrent(query: string) {
  const child = spawn(executable, args, { windowsHide: true });
  let stdout = "",
    stderr = "";
  let signal: () => void = () => {};
  const ready = new Promise<void>((resolve) => {
    signal = resolve;
  });
  child.stdout.on("data", (data) => {
    stdout += String(data);
    if (stdout.includes("READY")) signal();
  });
  child.stderr.on("data", (data) => {
    stderr += String(data);
  });
  const done = new Promise<{
    code: number | null;
    stdout: string;
    stderr: string;
  }>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => {
      signal();
      resolve({ code, stdout, stderr });
    });
  });
  child.stdin.end(query);
  return { ready, done };
}
const actor = "50000000-0000-4000-8000-000000000001";
const email = "concurrency-invitation@example.test";
const session = `begin; set local role authenticated; select set_config('request.jwt.claim.sub','${actor}',true);`;
const lock = `select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('inviter:${actor}',0)); select 'READY'; select pg_sleep(1);`;

test("concurrent creation and rotation leave exactly one active hash, never a plaintext token", async () => {
  sql(
    `insert into auth.users(id,email,email_confirmed_at) values('${actor}','invitation-test-admin@example.test',now()); insert into public.profiles(id,email,full_name,role) values('${actor}','invitation-test-admin@example.test','Test Admin','admin');`,
  );
  const rawTokens = Array.from({ length: 4 }, () =>
    randomBytes(32).toString("base64url"),
  );
  const hashes = rawTokens.map((token) =>
    createHash("sha256").update(token).digest("hex"),
  );
  try {
    const first = concurrent(
      `${session}${lock}select public.create_coach_invitation('${email}','${hashes[0]}'); commit;`,
    );
    await first.ready;
    const second = concurrent(
      `${session}select public.create_coach_invitation('${email}','${hashes[1]}'); commit;`,
    );
    const created = await Promise.all([first.done, second.done]);
    assert.equal(created[0].code, 0, created[0].stderr);
    assert.notEqual(created[1].code, 0);
    assert.match(created[1].stderr, /Duplicate invitation/);
    assert.equal(
      sql(
        `select count(*) from public.invitations where email='${email}' and revoked_at is null and accepted_at is null and expires_at>now()`,
      ),
      "1",
    );
    const oldId = sql(
      `select id from public.invitations where email='${email}'`,
    );
    const actualSummary = invitationSummarySchema.parse(
      JSON.parse(
        sql(
          `select private.invitation_summary(i) from public.invitations i where email='${email}'`,
        ),
      ),
    );
    assert.equal(actualSummary.id, oldId);
    assert.equal(actualSummary.role, "coach");
    const rotate1 = concurrent(
      `${session}${lock}select public.rotate_invitation('${oldId}','${hashes[2]}'); commit;`,
    );
    await rotate1.ready;
    const rotate2 = concurrent(
      `${session}select public.rotate_invitation('${oldId}','${hashes[3]}'); commit;`,
    );
    const rotated = await Promise.all([rotate1.done, rotate2.done]);
    assert.equal(rotated[0].code, 0, rotated[0].stderr);
    assert.notEqual(rotated[1].code, 0);
    assert.match(rotated[1].stderr, /Invitation unavailable/);
    assert.equal(
      sql(
        `select count(*) from public.invitations where email='${email}' and revoked_at is null and accepted_at is null and expires_at>now()`,
      ),
      "1",
    );
    assert.equal(
      sql(
        `select token_hash from public.invitations where email='${email}' and revoked_at is null`,
      ),
      hashes[2],
    );
    assert.equal(
      sql(
        `select count(*) from public.invitations where email='${email}' and revoked_at is not null`,
      ),
      "1",
    );
    const records = sql(
      `select row_to_json(i) from public.invitations i where email='${email}'`,
    );
    for (const token of rawTokens) {
      assert.ok(!records.includes(token));
      for (const result of [...created, ...rotated])
        assert.ok(!(result.stdout + result.stderr).includes(token));
    }
  } finally {
    sql(`delete from auth.users where id='${actor}'`);
  }
});
