import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";

const database = process.env.TEST_DATABASE_NAME;
assert.ok(
  ["127.0.0.1", "localhost", "::1"].includes(
    process.env.TEST_DATABASE_HOST ?? "127.0.0.1",
  ),
  "Local database only",
);
if (!database?.startsWith("healthbuddy_auth_"))
  throw new Error(
    "Use a disposable healthbuddy_auth_* PostgreSQL database only",
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
function session(query: string) {
  const child = spawn(executable, args, { windowsHide: true });
  let output = "",
    error = "";
  let readySignal: () => void = () => {};
  const ready = new Promise<void>((resolve) => {
    readySignal = resolve;
  });
  child.stdout.on("data", (chunk) => {
    output += String(chunk);
    if (output.includes("READY")) readySignal();
  });
  child.stderr.on("data", (chunk) => {
    error += String(chunk);
  });
  const done = new Promise<void>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => {
      readySignal();
      if (code === 0) resolve();
      else reject(new Error(error));
    });
  });
  child.stdin.end(query);
  return { ready, done };
}
test("concurrent today target corrections serialize without duplicates or author changes", async () => {
  const coach = "71000000-0000-4000-8000-000000000001",
    trainee = "71000000-0000-4000-8000-000000000002";
  sql(
    `begin; insert into auth.users(id,email,email_confirmed_at) values('${coach}','target-race-coach@example.test',now()),('${trainee}','target-race-trainee@example.test',now()); insert into public.profiles(id,email,full_name,role) values('${coach}','target-race-coach@example.test','Coach','coach'),('${trainee}','target-race-trainee@example.test','Trainee','trainee'); insert into public.coach_trainees(coach_id,trainee_id) values('${coach}','${trainee}'); insert into public.step_targets(trainee_id,target_steps,effective_from,created_by) values('${trainee}',8000,public.business_date(),'${coach}'); commit;`,
  );
  const original = sql(
    `select row_to_json(t) from (select id,created_by,created_at from public.step_targets where trainee_id='${trainee}') t`,
  );
  const begin = `begin; set local role authenticated; select set_config('request.jwt.claim.sub','${coach}',true);`;
  try {
    const first = session(
      `${begin}select public.set_today_step_target('${trainee}',10000); select 'READY'; select pg_sleep(1); commit;`,
    );
    await first.ready;
    const second = session(
      `${begin}select public.set_today_step_target('${trainee}',9000); commit;`,
    );
    await Promise.all([first.done, second.done]);
    assert.equal(
      sql(
        `select count(*)||':'||max(target_steps) from public.step_targets where trainee_id='${trainee}'`,
      ),
      "1:9000",
    );
    assert.equal(
      sql(
        `select row_to_json(t) from (select id,created_by,created_at from public.step_targets where trainee_id='${trainee}') t`,
      ),
      original,
    );
  } finally {
    sql(
      `delete from auth.users where id='${trainee}'; delete from auth.users where id='${coach}';`,
    );
  }
});
