# Coach dashboard verification

Apply `supabase/migrations/20261002000200_coach_dashboard.sql` in order before deploying the coach screens. No hosted migration has been applied from this workspace.

## Implementation

- `/coach` retains coach-only page/layout guards and displays a responsive trainee card list, today reports/targets/completion, last reported date, name search, and 25-row pagination. Missing reports stay missing; zero is a report. Sorting is by full name with ID as a stable tie-breaker.
- `get_coach_dashboard(page, search)` is SECURITY INVOKER with an explicit empty search path, fixed SQL, authenticated-only execution, and a persisted coach-role check. It derives the coach from `auth.uid()`, selects assigned trainees before pagination, and retrieves today's report, effective target, and latest report in one database call. It returns only narrow paginated data and a scoped total. Completion remains derived by the existing TypeScript helper.
- `/coach/trainees/[traineeId]` validates the UUID and verifies the authenticated coach's assignment before fetching trainee profile, reports, or targets. Unknown/unowned trainees both call `notFound()`. Month navigation repeats the ownership check. Every data query uses the authenticated Supabase client and existing RLS.
- The detail view reuses `loadDashboard`, `MonthlyStepCalendar`, `CalendarDay`, `ProgressRing`, percentage semantics, historical-target resolution, date/number formatting, and month validation. The calendar adds an optional route base, keeping `/app` as the default. Coach day selection opens a read-only modal with no input, form, or save action.
- Existing invitation management moved to `/coach/invitations` and remains linked from both populated and empty coach dashboards. Its mutation, delivery, RLS, and lifecycle logic remain in place; pagination and revalidation support the new route.
- Coach loading screens reuse the existing loading skeleton. Target updates use local pending state, prevent duplicate submissions, close on success, refresh current data, and announce concise Hebrew feedback. Native dialogs provide focus containment/restoration and labeled fields; layouts remain RTL/mobile-first.

## Target corrections and security

`setTodayTarget` requires a verified coach, validates an exact `{ traineeId, targetSteps }` Zod object, and invokes authenticated `set_today_step_target`. No coach, author, or date may be supplied. PostgreSQL's existing integer storage limit is the only target maximum.

The SECURITY DEFINER RPC independently checks persisted coach role and assignment, validates a positive target, and derives the date from SQL `business_date()`. Its unique-key upsert inserts today's transition or updates only `target_steps`. The trigger permits a same-day correction only under the trusted RPC execution owner, with an assigned authenticated coach and unchanged identity/date/author/creation timestamp. Authenticated clients have no direct target-write grant or policy. Historical rows reject updates even under that trusted execution owner. No new global UPDATE permission or historical-delete feature is introduced.

Same-day concurrent corrections serialize through the existing unique constraint and row locks, preserving a single transition and original attribution. Revalidation covers `/coach`, the affected detail route, and `/app`. Changes recalculate today; dates before today retain their original completion.

## Seven-day summary

The window is seven calendar dates ending at the current Jerusalem business date, independent of the selected calendar month. Queries fetch only the week's reports, the preceding target baseline, and the week's transitions.

Reports, including zero, determine the reported-day count and step-average denominator. Achievement and completion averages include only reported days with a valid effective target; the UI explicitly identifies that denominator when it differs. Completion averages use uncapped raw daily ratios with each day's historical target and round only the final average. Empty averages display no fabricated values.

## Executed checks

- 36 Node unit/render tests passed: existing auth/invitation/trainee suites plus 10 coach domain and three actual-component rendering tests.
- New target-correction concurrency test and existing invitation issuance/rotation concurrency test passed against a disposable PostgreSQL harness.
- `coach.sql` passed real role/RLS tests for assigned/unassigned reads, step-write denial, immutable assignments, caller-scoped RPCs, search, real 25-row pagination, missing versus zero, last report date, target insertion/correction, original attribution, historical completion, direct-write denial, backdate/future rejection, and summary denominators.
- Existing `integrity.sql`, `auth_rls.sql`, `invitations.sql`, and `steps.sql` passed. Auth/RLS tests now use the today-only target RPC rather than the obsolete direct future-insert permission; the security expectations were tightened.
- Existing concurrent invitation acceptance scripts passed: one membership/acceptance succeeded and the competing request was rejected as expected.
- Four built-app HTTP auth tests passed, including anonymous protection of coach/detail/invitation, trainee, and admin prefixes; Hebrew login, malformed activation/recovery protection, and callback behavior.
- Lint, typecheck, formatting, and production build passed using process-local placeholder configuration. Production browser assets contained none of the private environment names or placeholder service-role/context/email secrets scanned.

Database checks used a disposable **plain PostgreSQL Auth-role harness**, not hosted Supabase. `coach.sql` temporarily advances its transaction-local test clock across two days; it does not bypass RLS or target triggers, and all clock/fixture changes roll back. Do not execute these fixtures on hosted or production databases.

## Connected-environment status

Only `.env.example` is present. No configured Supabase Auth/PostgREST project or authenticated browser session was available. Hosted persistence, authenticated HTTP role redirects, unowned trainee URL behavior in a connected app, Google login, and mobile visual/focus interaction were **not verified**. Render tests check markup, not browser focus behavior. No hosted Supabase behavior is claimed.

Pending connected manual checks: coach login; own-trainee scoping; today values/missing reports; detail access and historical navigation; historical target transitions; today's target change and completion refresh; unchanged yesterday; same-day correction without duplicate rows; read-only steps; another coach's trainee URL; and mobile/keyboard dialog behavior. Repeat invitation activation/management, trainee editing, and Google/recovery flows with real users before hosted release.

Run `npm run test:coach`. For concurrency, set `TEST_DATABASE_NAME` to a disposable `healthbuddy_auth_*` database with all migrations applied, and `TEST_PSQL_PATH` as documented in README, then run `npm run test:coach:db`.
