# Hosted Supabase setup — 2026-10-04

> Historical verification snapshot. Resend provider/configuration references below are obsolete after the Gmail SMTP switch. Current invitation transport and required variables are documented in the README; these snapshots preserve results at their original dates.

## Result

Project `jvfevkatchjmajrioxod` is linked through Supabase CLI 2.119.0.
The supplied Dashboard Project URL is
`https://jvfevkatchjmajrioxod.supabase.co`.
No database password was required: authenticated CLI login-role connections and
read-only linked queries succeeded. No application key was used as a CLI token
or database password.

Before deployment, remote migration history and public/private application
objects were empty. The dry run listed exactly the following nine migrations,
with no seeds or roles. All nine were then applied using `db push --yes`:

1. `20261001000100_canonical_model.sql`
2. `20261001000200_integrity_functions.sql`
3. `20261001000300_trusted_admin_bootstrap.sql`
4. `20261001000400_invitation_activation.sql`
5. `20261001000500_application_rls.sql`
6. `20261001000600_invitation_management.sql`
7. `20261002000100_save_daily_steps.sql`
8. `20261002000200_coach_dashboard.sql`
9. `20261002000300_admin_analytics.sql`

The final migration list matches all nine local versions, with no missing or
unexpected remote versions. The follow-up dry run reports no pending migrations.
No reset, seed, migration-history repair, fake Auth user, application fixture or
admin bootstrap was executed.

## Hosted structural verification

Read-only catalog fingerprints match the clean local PostgreSQL migration replay:
148 objects and 280 effective API-role permission checks, with zero differences.
Comparisons cover tables/columns, enum definitions, function definitions and
settings, constraints, triggers, indexes, policies and effective role permissions.
Managed Supabase Auth/system schemas are outside this application-schema comparison.

| Table            | RLS     | Policies | Non-internal triggers |
| ---------------- | ------- | -------- | --------------------- |
| `profiles`       | Enabled | 1        | 4                     |
| `coach_trainees` | Enabled | 1        | 2                     |
| `daily_steps`    | Enabled | 3        | 2                     |
| `step_targets`   | Enabled | 1        | 2                     |
| `invitations`    | Enabled | 2        | 4                     |

The role integrity, historical target, invitation activation/management,
daily-step, coach dashboard and admin analytics functions match the repository
replay. The schema comparison returned fingerprints, not function bodies or user
data. Verification SQL is in `supabase/verification/schema_fingerprint.sql` and
`supabase/verification/application_privileges.sql`.

One concurrent read-only CLI check encountered temporary login-role password
authentication failure. A sequential retry succeeded without additional credentials.
Keep hosted CLI commands sequential to avoid overlapping login-role initialization.

## Local runtime configuration and remaining checks

`.env.local` contains the supplied project URL/publishable key/server secret and
local `NEXT_PUBLIC_APP_URL`, `ADMIN_EMAIL` contact configuration, and a newly
generated `AUTH_CONTEXT_SECRET`. No secret values are recorded here. The admin
contact is configuration only; no Auth identity or profile was created.
`.env.local` is excluded by `.gitignore`; no Git checkout/index exists in this
workspace, so actual repository-history/tracked-file verification remains pending.
The privileged client is `server-only`; browser clients use public settings only.

`RESEND_API_KEY` and `EMAIL_FROM` remain unavailable. The existing environment
validation rejects typecheck/build without them; no fake email credentials or
validation bypass was introduced. A fresh hosted-configured application build
and local public-route smoke test remain blocked until these are supplied securely.
Earlier local-placeholder builds are not evidence of this configured build.

The existing browser assets pass credential-pattern and available configured
secret comparisons. The scanner also checks CLI-token patterns and available
database-password/access-token environment values. CLI credentials stored outside
the process environment are not extracted. A new-build scan is still required
after the remaining runtime configuration is supplied.

Hosted public Auth connectivity returned HTTP 200 with the publishable key.
Anonymous PostgREST reads of all five application tables returned HTTP 401.
Real authenticated RLS/role workflows remain untested; no users were fabricated.
No hosted Auth Hook/provider/SMTP configuration is claimed: SQL function deployment
does not enable the Before User Created Hook in hosted Auth.

The database migration prerequisites for the next controlled admin-bootstrap
step are verified. Bootstrap has not been authorized/performed in this task.
Rotate the server secret previously shared in chat before provisioning real
users. Complete runtime configuration and checks, then explicitly authorize the
documented trusted bootstrap and hosted Auth setup. This is not a release approval.

## Commands executed

Commands used the official `npx` CLI, with no secrets in arguments:

```text
npx --yes supabase link --project-ref jvfevkatchjmajrioxod
npx --yes supabase migration list
npx --yes supabase db push --dry-run
npx --yes supabase db query --linked <read-only catalog query>
npx --yes supabase db push --yes
npx --yes supabase migration list
npx --yes supabase db push --dry-run
npx --yes supabase db query --linked --file supabase/verification/schema_fingerprint.sql
npx --yes supabase db query --linked --file supabase/verification/application_privileges.sql
```

Application checks: `npm run lint` and `npm run format:check` passed;
`npm test` passed all 54 domain/render/release cases. `npm run typecheck` and
`npm run build` were executed and failed on the missing `RESEND_API_KEY` and
`EMAIL_FROM`, before compilation. These are unresolved configuration failures,
not successful hosted application checks. No tests were disabled.

The secret scan passed across 172 current source/config/existing-browser files,
including comparison with the actual configured server secret and signing secret.
No available database-password value was present to compare; CLI-token patterns
are checked without extracting OS-stored CLI credentials. Existing browser assets
predate this hosted configuration. No fresh-build scan or application public-route
browser smoke test is claimed.

Changes in this step are limited to local ignored environment configuration,
read-only verification SQL/reporting, extended secret-scan coverage and exclusion
of generated Supabase `.temp`/`.branches` metadata from formatting/deployment.
No migration files, business logic, Auth semantics or RLS were modified.
