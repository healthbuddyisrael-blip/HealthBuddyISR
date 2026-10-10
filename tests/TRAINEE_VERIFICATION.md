# Trainee dashboard verification

Apply `supabase/migrations/20261002000100_save_daily_steps.sql` in migration order before using step entry. It adds an authenticated SECURITY INVOKER RPC, not a service-role operation. Existing RLS and column grants remain unchanged. PostgreSQL table upserts through PostgREST would update identity/date columns that trainees cannot update; this RPC uses `INSERT ... ON CONFLICT (trainee_id,date) DO UPDATE SET steps=excluded.steps` instead. Auth supplies the ID. There is no ID parameter.

The server action checks verified trainee membership, validates a strict Zod union, derives today's date for `kind: today`, checks historical dates against today, invokes the RPC with the user's session, and revalidates `/app`. Steps are limited only by PostgreSQL's existing signed integer storage range. Empty values are rejected; zero is valid.

Month data uses five parallel authenticated queries: month reports, the last target before the month, transitions within the month, today's latest target, and today's report. Each query filters the server-verified profile ID; RLS also restricts visibility. The calendar computes effective targets per day on the server. The baseline plus month's transitions are bounded to at most 32 rows, independent of lifetime history. URL months are strictly validated and future months fall back to the current month.

Dates use `Asia/Jerusalem` from configuration and real ISO calendar validation. Hebrew dates and numbers use centralized `he-IL` helpers. Completion is rounded to whole percentages; only ring fill is clamped to 0–100. No report and no target produce no percentage; zero remains 0% when a target exists. No percentage is persisted.

Mobile uses one compact seven-column Sunday–Saturday calendar and a native modal bottom sheet; desktop uses the same components with more detail. Native modal focus containment, initial input focus, focus restoration, labeled inputs, live feedback, visible focus outlines, disabled future buttons, and textual ring labels are implemented. Manual screen-reader/device verification remains pending.

## Executed locally

- Node domain/auth/invitation suites: 23 tests passed, including 14 dashboard domain tests.
- Existing invitation concurrency Node suite: passed against disposable PostgreSQL.
- PostgreSQL `steps.sql`: current/past insert and replacement, uniqueness, zero, negative/future rejection, cross-user isolation, caller-bound targets, identity/date grant preservation, and coach/anonymous RPC rejection passed.
- Existing PostgreSQL integrity, auth/RLS, and invitation suites passed with all migrations applied.
- Built-app HTTP auth suite: four tests passed, including all protected route prefixes, Hebrew RTL login, malformed invitation/recovery protection, and callback/public-signup behavior.
- Lint, typecheck, formatting, and production build passed. Type generation/build used process-local placeholder configuration because real project configuration is absent.
- Production browser assets were scanned for private environment names and the placeholder service-role/context/email secrets; no matches were found.

The database is a disposable plain PostgreSQL Auth-role harness, **not hosted Supabase**. These checks do not verify Supabase Auth, PostgREST transport, Google authentication, hosted persistence, or delivery providers. No hosted migration was applied. No authenticated browser login or visual interaction was performed.

## Required connected-browser verification

Use a configured local/staging Supabase project and invitation-provisioned trainee. Do not replace Auth/RLS with mocks or disable guards.

- [ ] Log in as trainee and open `/app`; confirm today's target.
- [ ] Submit today's steps; refresh and confirm persistence.
- [ ] Update today's steps; confirm one row for the date.
- [ ] Open yesterday; insert and update its steps.
- [ ] Confirm future dates cannot be clicked or saved, including a direct forged action request.
- [ ] Navigate to the previous month; refresh and use browser back/forward.
- [ ] Confirm a historical target transition changes completion on the correct dates.
- [ ] Confirm 110%+ displays its actual percentage with a full ring.
- [ ] Confirm zero is a real report and an absent report has no fake 0%.
- [ ] Confirm no-target dates show no percentage; corrupted missing-today-target state shows a generic error.
- [ ] Verify phone numeric keyboard, keyboard-only dialog focus/Escape/return, and screen-reader labels.
- [ ] Repeat password recovery, Google callback, invitation activation/management, and coach/admin role redirects with real users.

Run `npm run test:steps` for domain coverage. Run the SQL assertions with `psql -X -v ON_ERROR_STOP=1 -f supabase/tests/steps.sql` only against a disposable local harness with all migrations applied. Never execute test fixtures against a hosted or production database.
