import { spawnSync, spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";

// This runner cannot target a remote database. It creates a new database, never
// resets/reuses one, and retains it for inspection after verification.
const host = process.env.TEST_DATABASE_HOST ?? "127.0.0.1";
assert.ok(
  ["127.0.0.1", "localhost", "::1"].includes(host),
  "Local database only",
);
assert.ok(
  !process.env.PGSERVICE && !process.env.PGSERVICEFILE,
  "PG service overrides are not permitted",
);
const psql = process.env.TEST_PSQL_PATH ?? "psql";
const createdb =
  psql === "psql"
    ? "createdb"
    : join(
        dirname(psql),
        process.platform === "win32" ? "createdb.exe" : "createdb",
      );
const database = `healthbuddy_auth_release_${randomBytes(8).toString("hex")}`;
const connection = [
  "-h",
  host,
  "-p",
  process.env.TEST_DATABASE_PORT ?? "55439",
  "-U",
  "postgres",
];
const args = [
  "-X",
  "-q",
  ...connection,
  "-d",
  database,
  "-v",
  "ON_ERROR_STOP=1",
];
function run(executable: string, arguments_: string[], expected = 0) {
  const result = spawnSync(executable, arguments_, {
    encoding: "utf8",
    windowsHide: true,
    timeout: 120_000,
  });
  assert.equal(
    result.status,
    expected,
    result.stderr || result.error?.message || "Database command failed",
  );
  return result;
}
run(createdb, [...connection, database]);
console.log(`Fresh LOCAL database: ${database}`);
function sqlFile(file: string) {
  run(psql, [...args, "-f", file]);
  console.log(`PASS ${file}`);
}
sqlFile("supabase/tests/postgres_harness.sql");
for (const file of readdirSync("supabase/migrations")
  .filter((file) => file.endsWith(".sql"))
  .sort()) {
  if (file === "20261004000300_israeli_calendar_weeks.sql")
    sqlFile("supabase/tests/legacy_coaching_fixture.sql");
  sqlFile(`supabase/migrations/${file}`);
  if (file === "20261004000300_israeli_calendar_weeks.sql")
    sqlFile("supabase/tests/legacy_coaching_verify.sql");
}
for (const suite of [
  "integrity",
  "auth_rls",
  "invitations",
  "steps",
  "coach",
  "admin",
  "activity",
  "workout_counts",
  "pilot_weekly",
  "coaching_calls",
]) {
  sqlFile(`supabase/tests/${suite}.sql`);
}
sqlFile("supabase/tests/concurrency_fixture.sql");
function session(file: string) {
  const child = spawn(psql, [...args, "-f", file], { windowsHide: true });
  let error = "";
  child.stdout.resume();
  child.stderr.on("data", (chunk) => {
    error += String(chunk);
  });
  const done = new Promise<{ code: number | null; error: string }>(
    (resolve, reject) => {
      child.on("error", reject);
      child.on("close", (code) => resolve({ code, error }));
    },
  );
  return done;
}
const first = session("supabase/tests/concurrency_accept_slow.sql");
await new Promise((resolve) => setTimeout(resolve, 300));
const second = session("supabase/tests/concurrency_accept.sql");
const outcomes = await Promise.all([first, second]);
assert.equal(
  outcomes.filter(({ code }) => code === 0).length,
  1,
  "Exactly one acceptance must commit",
);
assert.match(
  outcomes.find(({ code }) => code !== 0)!.error,
  /Invitation unavailable/,
);
sqlFile("supabase/tests/concurrency_verify.sql");
const concurrency = spawnSync(
  process.execPath,
  [
    "--test",
    "tests/invitations-concurrency.test.mts",
    "tests/coach-concurrency.test.mts",
  ],
  {
    windowsHide: true,
    encoding: "utf8",
    timeout: 120_000,
    env: {
      ...process.env,
      TEST_DATABASE_NAME: database,
      TEST_DATABASE_HOST: host,
      TEST_PSQL_PATH: psql,
    },
  },
);
assert.equal(concurrency.status, 0, concurrency.stderr || concurrency.stdout);
console.log(concurrency.stdout);
console.log(
  "PASS fresh local migrations, ten SQL suites, three concurrency scenarios. Hosted Auth/PostgREST remain unverified.",
);
