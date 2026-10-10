# Personal activity baseline and progress

This feature measures activity against the participant's own starting point.
It does not prescribe or log detailed workouts.

## Setup and data

Apply `supabase/migrations/20261004000100_activity_baselines.sql` before releasing
the updated application. Existing migrations are unchanged. The migration adds
two nullable boolean columns to `daily_steps` and a separate `activity_baselines`
table. Existing reports retain NULL workout fields; no historical values are
backfilled. Existing trainees without a known baseline display a setup message.
The assigned coach or an admin creates the baseline in the trainee detail page
after the entry interview. There is no public signup/onboarding wizard to extend.

The pilot supports one coaching period per trainee, lasting at least 14 days.
The coach/admin supplies start/end dates and the pre-coaching strength/cardio
weekly frequencies (0–7, including fractional values). These use the same
one-workout-day counting convention as reports. Dates and reference values are
frozen together; corrections require a reviewed database operation, and the
application offers no baseline update/delete action. The trainee foreign key
cascades when the trainee is deleted. The primary key supports all per-trainee
baseline lookups; the existing unique trainee/date report index supports windows.

Steps use the seven calendar days immediately before `program_start`. When all
seven days have reports, PostgreSQL computes the unrounded mean and marks the
source `historical`, ignoring any manual fallback. Otherwise a manually supplied
mean is required, marked `manual`. Partial historical data is not extrapolated.
Zero is a valid explicit value. No baseline or interview values are invented.
Baseline creation date, reference dates, source and program dates are persisted.
Later reports, including corrections to historical steps, never alter the baseline.

## Reporting and calculations

New daily reports default both checkboxes to false. Both can be true. Trainees
can edit their own existing allowed dates using the same steps flow. On legacy
reports, an untouched checkbox retains NULL; toggling it records the chosen
boolean. The form explains unknown historical fields. Steps-only callers still
use `save_daily_steps`, which preserves workout observations. Activity callers
send both flags atomically to `save_daily_activity`; neither flag is mandatory
for legacy callers. Coach/admin daily-report editing permissions are unchanged.

`weekly_activity` groups by Sunday–Saturday calendar weeks. It exposes the mean
of recorded steps, step report count, workout observation counts, and counts
of true workout flags. A day with both flags true contributes one to each count.
Workout counts are NULL when no workout observations exist; otherwise they are
observed counts, with coverage out of seven shown alongside them. Missing days
are never implied to be false. The calendar and activity summary show the selected
Sunday–Saturday week; entirely unreported weeks have no summary row. Previous/next
week navigation uses the same week boundaries as coaching calls. Existing month
links open the week containing the first day of that month.

`activity_window` is the shared SQL calculation used by progress and outcomes.
Steps average only recorded days, including explicit zero, without rounding in
storage/calculation. Workout frequencies are available only when every calendar
day in the requested window has a non-NULL observation for that dimension and
the window spans at least seven calendar days:
`true_day_count * 7 / calendar_days`. This deliberately conservative missing-data
rule avoids pretending missing reports are no workouts or extrapolating them.
The recorded totals (`strength_sessions`, `cardio_sessions`) always count true
daily flags once each; they are distinct from weekly average frequency. The
shared progress component displays these totals for its labelled date window,
and labels the baseline comparison as an average per week. Short windows show
recorded counts immediately, without projecting a single workout into seven.
Apply `20261010000100_workout_frequency_minimum_window.sql` for this correction.
It replaces only the shared calculation function and preserves stored data,
permissions, weekly summaries, and complete historical 7/14-day comparisons.

Current activity uses up to the last 14 days within the coaching period, bounded
by today and the program end. Before the program starts, there is no current
activity. Once completed, the window remains exactly `program_end - 13` through
`program_end`, inclusive. Reports after the program end do not affect outcomes.
Final workout frequency equals the 14-day count divided by two. Steps use the
recorded-day mean and show coverage; a partial mean is explicitly labelled.

Changes are final/current minus baseline. The database also exposes a step
percentage change only when baseline steps are nonzero. The UI shows absolute
changes for all three dimensions, retaining fractional weekly frequencies and
avoiding percentage changes for workout metrics.

## Screens and authorization

- Trainee dashboard: activity comparison, weekly summaries, daily checkboxes.
- Coach trainee detail: baseline creation, comparison, summaries and read-only
  daily workout observations.
- Admin trainee detail: baseline creation, comparison, summaries and read-only
  daily observations.
- Admin overview: compact cohort summary independent of existing page filters.

All new RPCs are SECURITY INVOKER with an empty search path. Views use
`security_invoker=true`, so underlying table RLS and grants apply. Baseline reads
are limited to the trainee, assigned coach or admin. Baseline inserts require an
assigned coach or admin; no authenticated update/delete grant or policy exists.
A trigger validates trainee role, historical provenance and immutability.
Workout writes use existing trainee-only report RLS and column grants; identity
and report dates remain protected. Anonymous and service roles have no new RPC
grants. The pilot summary additionally checks the persisted admin role.

## Cohort outcomes and verification

`activity_outcomes` exposes one row per completed baseline with coverage, final
values and changes. `get_pilot_activity_summary` calculates participant/baseline/
completion counts, paired step means/medians and change means/medians, and the
percentage improving each dimension. It includes a completed participant in a
dimension only with all 14 observations for that dimension. The two-of-three
improvement rate requires full coverage of all three dimensions. Each denominator
is returned and displayed; an empty eligible cohort yields NULL, never 0%.
Step reference/final averages use the same eligible cohort for comparability.

Run `npm test`, `npm run test:release:db` (local PostgreSQL only), `npm run lint`,
`npm run typecheck`, `npm run format:check` and `npm run build`.
`tests/activity.test.mts` exercises validation, checkbox rendering, legacy fields,
comparison edge cases and progress rendering. `supabase/tests/activity.sql`
tests actual baseline creation, historical preference, manual fallbacks,
weekly/window/outcome/cohort calculations, missing reports, unknown flags,
steps-only regression and role isolation. The database runner applies all
migrations to a new disposable local database and also runs the existing suites.
`supabase/tests/workout_counts.sql` additionally verifies zero/one/three workouts,
independent aerobic counts, retries, seven daily rows joined to a weekly summary,
short-window frequency suppression, historical rates, and role consistency.

This workspace has no Git metadata or remote, so pulling the latest repository
was unavailable. The new migration has been verified locally; applying it to
hosted Supabase and deploying the application are separate release steps.
