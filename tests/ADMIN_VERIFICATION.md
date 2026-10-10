# V1 admin analytics verification

Apply `supabase/migrations/20261002000300_admin_analytics.sql` in order before deploying the admin screens. No hosted migration was applied from this workspace.

## Screens

- `/admin`: system summary, coach cards ordered by name, name/email search, 25-coach pages, and 7/30-day URL state. Existing coach invitations are linked below the primary content and available at `/admin/invitations`.
- `/admin/coaches/[coachId]`: coach identity and aggregate metrics plus a scoped, paginated trainee list with today values, last report, and window metrics. Search/range/page state does not alter the coach's overall summary. Unknown IDs and non-coach profile IDs use not-found semantics.
- `/admin/coaches/[coachId]/trainees/[traineeId]`: optional read-only calendar drill-down and the same 7/30-day trainee metrics. The database verifies the exact coach/trainee pair before any calendar data is loaded. Calendar navigation preserves pair and range. State resets when the trainee or month changes.
- Mobile uses stacked metrics and cards; desktop uses compact card grids. Search inputs are labeled, links/buttons are keyboard usable, progress includes accessible text, and range/pagination links have inline pending feedback. Route loading skeletons cover overview and drill-downs. No color-based classifications, ranking, charts, or analytics mutation controls were added.

The calendar, ring, day dialog, target semantics, and Hebrew date/number formatting are reused. Admin analytics never import step-entry or target-change dialogs. Invitation lifecycle/delivery logic remains unchanged; pagination and revalidation support its new admin route.

## Canonical definitions

PostgreSQL `private.admin_trainee_metrics` supplies shared per-trainee facts; `private.admin_metric_values` calculates shared ratios. All public admin RPCs use these helpers. Analytics are not recalculated from raw step datasets in Next.js.

For range `N` (7 or 30), the inclusive window is `[business_date() - (N - 1), business_date()]`, using `Asia/Jerusalem` independently of database session timezone.

1. **Total coaches/trainees:** application profiles of the corresponding persisted role. Invitations and Auth-only users do not count.
2. **Active trainee:** at least one report row anywhere in the selected window, including zero. A report without a target still counts as activity.
3. **Reporting eligibility start:** `max(window_start, business_date(coach_trainees.created_at), first_target.effective_from)`. Expected days are the inclusive dates through today. No assignment/first target or a start after today yields zero expected days. This follows V1's assignment/initial-target lifecycle; profile creation does not substitute for assignment.
4. **Reporting numerator:** reports with a valid effective target on or after eligibility start, within the window. Rate is that count divided by expected days. Reports backfilled before assignment/first-target eligibility do not inflate reporting rate.
5. **Eligible reported day for attainment/completion:** a window report with a valid positive target effective on that report's date. Missing reports and reports before the first target are excluded. Achievement requires the actual step count to be at least the target, not a rounded percentage to be 100%.
6. **Target attainment:** achieved eligible days divided by eligible reported days.
7. **Average completion:** mean of uncapped `steps * 100 / historical_target` over eligible reports. Aggregates sum raw completion ratios and eligible counts before division; they do not average trainee or coach percentages.
8. **Empty denominators:** NULL, rendered `—`. A real zero report can legitimately produce 0%; absent data does not fabricate that result. UI rounds only the final percentage to whole numbers.

Today's steps remain NULL when no row exists. Today's target is the latest transition effective on/before the SQL business date. Last report is the latest reported calendar date. The admin read-only calendar uses the same historical resolution and visual clamp as the trainee/coach calendars.

## Database strategy and authorization

- `get_admin_coach_analytics(range, search, page)` returns system aggregates and at most 25 narrow coach records in one call. System totals remain global when the coach list is filtered or paginated.
- `get_admin_coach_detail(coach_id, range, page, search)` returns the requested coach's summary and at most 25 matching trainees in one call.
- `get_admin_trainee_analytics(coach_id, trainee_id, range)` verifies the matching pair and returns a narrow summary. The calendar then uses the existing bounded authenticated loader.

Every data function is SECURITY INVOKER with an explicit empty search path, fixed SQL, and persisted admin-role verification derived from `auth.uid()`. Execution is closed to PUBLIC, anon, service_role, and Auth administration roles; authenticated non-admin callers fail the role check. The private data helper also verifies admin role, so calling it directly does not bypass authorization. The arithmetic-only helper exposes no database data.

Normal application calls use the authenticated Supabase session. Existing RLS/read permissions remain intact; no table-write permissions, target corrections, relationship mutations, or service-role filtering were introduced. UUIDs/query shapes are validated on the server; RPCs separately validate range/search/page and existence/pairing. Diagnostics contain operation names and sanitized error codes, not SQL/provider payloads or user-facing UUIDs.

## Executed checks

- 46 Node tests passed: existing auth/invitation/trainee/coach tests, eight new admin domain/render tests, and existing invitation/target concurrency tests.
- New deterministic `supabase/tests/admin.sql` passed against a disposable PostgreSQL Auth-role harness. It covers empty systems, membership-only counts, pending invitation exclusion, active/zero/missing reports, 7/30 boundaries, lifecycle start, Jerusalem summer/winter and session-timezone behavior, historical transitions, weighted uncapped averages, no-target reports, coach isolation, no-trainee coaches, literal name/email search, real multi-page results, unknown IDs, exact trainee pairing, role denials, and admin mutation denial.
- Existing SQL integrity, Auth Hook/RLS, invitation, daily-step, and coach suites passed with every migration applied. Existing concurrent invitation acceptance passed with one success and the competing request correctly rejected.
- Built-app HTTP auth suite passed all four tests, including anonymous protection of admin overview, coach detail, invitation management, and the new trainee drill-down, plus existing auth/callback/recovery/signup safeguards.
- Lint, typecheck, formatting, and production build passed using process-local placeholder configuration. Browser bundles were scanned for private environment names and placeholder service-role/context/email secrets; none were present.

The deterministic clock in `admin.sql` changes only a test transaction and preserves real RLS/target triggers. All fixture and clock changes roll back. Never execute these fixtures against a hosted or production database.

## Connected verification status

Only `.env.example` is present; no configured Supabase Auth/PostgREST project was available. These checks do not establish hosted persistence or actual authenticated HTTP route acceptance/denial. Unknown-ID not-found behavior is verified at the database boundary and implemented in server loaders; a connected authenticated browser route test remains pending. Component render tests establish markup/read-only controls, not browser focus or mobile visual behavior.

Pending connected checklist: admin login and `/admin`; compare coach/trainee totals; switch 7/30; coach search and drill-down; verify scoped trainees and today values against coach/trainee pages; missing versus zero; historical target changes and >100% completion; coach/trainee accounts against admin URLs; unknown coach and mismatched trainee pair; mobile and keyboard interaction; existing invitation delivery/acceptance, Google, recovery, and step/target flows.

Run `npm run test:admin`. Run SQL suites only against a disposable `healthbuddy_auth_*` harness with all migrations applied, using `psql -X -v ON_ERROR_STOP=1 -f supabase/tests/admin.sql`. See README for local harness/concurrency tooling.

## Scope choices

The optional read-only trainee route was included to allow historical inspection without duplicating a calendar or exposing coach mutation controls. Invitation management moved to its own protected route to preserve the requested overview hierarchy. Search is bounded to 200 characters and pages to 25 records; no custom dates, ranking, exports, or extra analytics categories were added.
