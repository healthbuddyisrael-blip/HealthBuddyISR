# Workout count investigation — 2026-10-10

The local calculation reproduces the reported 1-to-7 behavior: a complete
one-day activity window with one true strength flag returns one recorded session
and a weekly frequency of `1 * 7 / 1 = 7`. The shared progress component presented
that frequency as workouts per week, without identifying it as an average.
Aerobic workouts use the same calculation. Participant, coach, and admin detail
screens share that component. Batya's specific production case remains unverified.

The source of recorded workouts is `daily_steps`: one row per trainee/date,
independent nullable strength/cardio flags. `save_daily_activity` upserts that
unique key. A true flag counts once for its type; false means no workout and
NULL means unknown. The existing model records at most one workout of each type
per day; multiple workout days remain independently countable. Supporting
multiple sessions of the same type on one day would require a separate change.

`weekly_activity` aggregates directly from daily reports into one row per
trainee/Sunday week. `loadActivity` reads that view without daily joins or summing
repeated weekly records. Coaching-call recent activity uses recorded session
counts from `activity_window`. Admin cohort outcomes use completed 14-day average
frequencies; those calculations remain unchanged.

The fix displays recorded counts for the explicit progress window and keeps
weekly averages separate. The function-only migration withholds weekly frequency
for windows shorter than seven days. The UI also handles responses from the
older function during rollout. No division of displayed counts, data backfill,
authentication, roles, RLS, reporting workflow or health integration changes.

Verification: all 91 application tests passed, including shared component
rendering of strength/aerobic counts 1/0, 0/0, 3/0 and 1/2. Fresh local PostgreSQL
migration replay passed nine SQL suites and three concurrency scenarios. SQL
regressions verify one-day raw count 1 and frequency NULL, zero/one/three weekly
counts, independent aerobic counts, report retries, seven daily join rows,
historical 7/14-day totals and frequencies, and three-role consistency.
Lint, typecheck, and the production build also passed. UI verification used
rendered shared components and the existing coach/admin/calendar UI tests;
no live authenticated production browser session was available.

Deployment follow-up: local CLI project link and app URL both identify
`jvfevkatchjmajrioxod`, but the logged-in CLI account lists only
`tsjbytyxokbtayrczzku`. Linked queries return 403. No production records were
modified and the migration has not been deployed.

Read-only access through the existing application credential succeeded against
the guarded Health Buddy project. The reported participant has exactly one daily
report with strength true and aerobic false: recorded counts 1 and 0.
There were no duplicate daily rows in that result. This supports a calculation
or presentation issue, but confirming the production 1-to-7 path still requires
reading the baseline/window and deployed function. Database-management access
remains unavailable; the app credential is not used to impersonate participants
or execute schema changes.

The corrected repository `https://github.com/healthbuddyisrael-blip/HealthBuddyISR.git`
cloned into the ignored `.local-postgres/healthbuddyisr-deployment-repo` directory
and had no remote commits before this source upload.
There are no remote commits to compare for conflicts. The original workspace
and fix remain intact. The documented release workflow deploys directory source
to Vercel project `health-buddy-israel`; no Git integration is configured in the
release notes. Read-only Vercel inspection succeeded and its verified domain is
`health-buddy-israel.vercel.app`. The current production deployment is READY
(`dpl_72HWS6aK9EpZ1W7NosXeUyohtuEH`); it was not replaced during this task.

The migration preserves the existing signature, return types, invoker security,
empty search path, and complete-window calculations. Fresh local upgrade/replay
passes, but live schema/function/migration compatibility cannot be certified
without database-management access. Production migration, application release,
authenticated count verification, and historical before/after checks remain
pending that access. All 91 application tests and the local SQL/concurrency
regressions were rerun successfully during deployment preparation.
