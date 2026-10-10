# Workout count investigation — 2026-10-10

The local calculation reproduces the reported 1-to-7 behavior: a complete
one-day activity window with one true strength flag returns one recorded session
and a weekly frequency of `1 * 7 / 1 = 7`. The shared progress component presented
that frequency as workouts per week, without identifying it as an average.
Aerobic workouts use the same calculation. Participant, coach, and admin detail
screens share that component. The production investigation now confirms the
reported participant's first-day window has this exact 1-to-7 behavior.

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

Deployment follow-up: the corrected Supabase CLI login now lists
`health-buddy-production` (`jvfevkatchjmajrioxod`), matching the local project link
and app URL. The former access blocker is resolved. The unrelated Supabase
project was not modified.

Read-only access through the existing application credential succeeded against
the guarded Health Buddy project. The reported participant has exactly one daily
report with strength true and aerobic false: recorded counts 1 and 0.
There were no duplicate daily rows in that result. This supports a calculation
or presentation issue. Read-only production SQL confirmed that the participant's
program start matches the first report date, and that the deployed function
returned a strength count of 1 but a one-day weekly frequency of 7.

The corrected repository `https://github.com/healthbuddyisrael-blip/HealthBuddyISR.git`
cloned into the ignored `.local-postgres/healthbuddyisr-deployment-repo` directory
and had no remote commits when checked.
There are no remote commits to compare for conflicts. The original workspace
and fix remain intact. The documented release workflow deploys directory source
to Vercel project `health-buddy-israel`; no Git integration is configured in the
release notes. Read-only Vercel inspection succeeded and its verified domain is
`health-buddy-israel.vercel.app`. The source and fix are committed locally in the
corrected repository. GitHub still returns 403 for writes by `Talmal6`, so that
repository push remains pending collaborator access.

The migration preserves the existing signature, return types, invoker security,
empty search path, and complete-window calculations. Fresh local upgrade/replay
passes. The production function matched the expected previous definition, and
the dry run listed only `20261010000100`. That migration is now applied and
recorded in production migration history. No stored reports were updated.

Before/after checks confirm the first-day projected frequency changed from 7 to
NULL, while the recorded strength/aerobic counts remain 1/0. Fingerprints for
all daily reports, baselines, weekly activity, completed outcomes and function
permissions match exactly. Function security and return types remain unchanged.
The shared UI component renders the actual production response as counts 1/0.
An authenticated live browser session is still required for direct screen
verification; no authentication or role configuration was changed to obtain one.
All 91 application tests, lint and typecheck were rerun successfully during
deployment. Local SQL/concurrency regressions also passed during preparation.

The application fix is now live at `https://health-buddy-israel.vercel.app`.
Production deployment `dpl_J9bW2iHF2fkzjZhQtXk4ng1S7Le2` reached READY through the
existing directory deployment workflow. Five public pages and 15 deployed assets
passed smoke checks, including Hebrew RTL, security headers and credential
exposure checks. All four existing production HTTP regression tests passed.
The hosted production build succeeded; no weekly reporting redesign or health
integration was introduced. Remaining follow-up is GitHub write access and
an authenticated production browser check of the participant/coach/admin screens.
