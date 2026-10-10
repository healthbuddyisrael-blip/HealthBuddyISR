# Weekly coaching calls and admin oversight

The required interaction is one personal phone call per trainee per week, with
four short notes. Messages between calls remain flexible. No messaging system,
quotas, clinical questionnaires, or activity copies are added.

## Data and authorization

Apply `supabase/migrations/20261004000200_weekly_coaching_calls.sql` after the
activity-baseline migration and before deploying the updated application.
Previous migrations are unchanged. `weekly_coaching_checkins` references existing
profiles and coach assignments. Its unique `(trainee_id, week_start)` constraint
permits one record per trainee/week; an upsert updates that same weekly record,
retaining its identity and creation time. Other weeks are never overwritten.
`week_end` is generated from the Sunday start date. Indexes support coach/week,
weekly aggregation, attention lookups, and per-trainee history.

Completed calls require a real, non-future call date within that week and nonblank
general status, difficulties, agreements, and next-week goal. Each note is limited
to 500 characters; an optional attention reason is limited to 300. A statement
such as “No difficulties” is sufficient. Incomplete records are drafts, require
no call date, and never satisfy compliance. History can be backfilled for actual
past calls; the application does not infer that an undocumented phone call occurred.

Assigned coaches can create calls and update their own authored records. They can
read histories for their currently assigned trainees. Admins can read every report
and overview, including histories of trainees without a current assignment.
Trainees cannot read or edit private coaching notes. Anonymous callers have no new
table or RPC access. There are no application delete permissions.

Column grants protect identities, week dates, authorship, and timestamps; a trigger
also validates assignment, immutable identity, note trimming and future dates.
RLS checks both current persisted coach role and assignment for writes. Every new
RPC is SECURITY INVOKER with an empty search path; the compliance view uses
`security_invoker=true`. Admin overview RPCs additionally require the persisted
admin role. Supabase session clients are used throughout, without a privileged
client bypass. This pilot has no assignment-transfer UI; if a trainee is reassigned
externally, old authorship remains intact and the new coach cannot edit old-coach
notes. Reassignment and historical authorship permissions need a separate workflow.

## Weeks, eligibility and compliance

Weeks run **Sunday through Saturday**. PostgreSQL `coaching_week_start` and JavaScript
`coachingWeekStart` share that definition, matching the activity weekly view.
“Today” uses the existing Asia/Jerusalem business date, including across midnight.

Each calendar week overlapping the trainee's coaching period expects one call,
including partial first/final weeks. Period dates come from `activity_baselines`.
Before baseline setup, profile enrollment date supplies the start and membership
continues through today. Trainees whose program has not started are excluded.
Completed programs remain expected through their final calendar week and disappear
from subsequent current-week operational lists. No activity-report requirement is
used to select active trainees: absence of daily reports never removes a trainee
from oversight. A missing assignment remains visible and flagged despite the normal
schema requiring one coach per trainee.

Compliance is completed-and-documented expected calls divided by expected trainees
for that week. Missing rows and drafts both count as missing. A new Sunday starts a
new compliance period automatically. Current-week missing calls are pending until
Saturday ends. Missing calls in ended weeks are overdue. Any earlier expected week
with a missing call also creates a separate prior-call-overdue attention flag.
An empty denominator produces NULL/“—”, never a fabricated 0%.

## Coach experience

The trainee detail page has an obvious weekly call action, the latest goal,
current-week status and lightweight chronological history. A dialog offers a
completion checkbox, date, four short text fields and an attention checkbox with
an optional reason. Coaches can edit the current record, select an existing
historical record, or document another past week using its Sunday date.

The dialog shows the existing recorded activity for the **rolling last seven days
through today**: average steps, workout-day counts and the current numeric step
target. Coverage is shown; unknown workouts are not displayed as zero. Historical
call edits still show this explicitly labelled current recent-activity window.
The free-text next-week goal complements the existing “Change target” action.
It never creates/replaces a structured step target. Saving a call writes no daily
activity data and does not alter baseline or target values.

## Admin experience and attention

The admin overview displays current weekly totals and links to `/admin/coaching`,
also available in admin navigation. That screen provides week navigation/date
selection and All / Missing / Needs attention / Completed filters. It lists every
expected trainee with assigned coach, weekly status, last documented call, latest
completed call goal, effective numeric step target, and attention reasons. Summary
counts cover the whole selected week, independently of filters and pagination.
Results are ordered with attention and missing calls first and paginated by 25.

Attention includes a pending/missing selected-week call, prior overdue calls, no
assigned coach, explicit coach flags, or at least three missing daily reports in
the rolling up-to-seven-day window ending at the selected week's end (or today,
whichever is earlier). This reporting window is bounded by enrollment/program
start. Missing reports are operational gaps, never zero activity observations.

Explicit attention flags from older reports remain visible until their author
clears them; a newer unflagged call does not silently resolve an older concern.
The newest still-marked concern and its week/reason appear in the table; all marked
reports remain in history. There is no automatic interpretation of text and no
separate admin-resolution workflow. Editing a report changes its current state;
this feature preserves weekly records, not an immutable audit of every revision.

Admin trainee detail includes call history; `/admin/coaching/[traineeId]` offers
the complete paginated read-only history, including for an unassigned trainee.
Goals are taken from the latest completed call by Israeli week, never from incomplete drafts
or the most recently edited older report. On historical overview weeks, latest
calls/goals/flags are limited to reports from that week or earlier, while edits
and resolution flags reflect the records' current state.

## Later pilot analytics

`weekly_coaching_compliance` provides one fact row for every expected trainee/week,
including absent reports, with call completion and coaching identities. It supports
weekly rates, all-expected-calls compliance, average completed calls per trainee,
and comparisons by week/coach without the Data API row cap truncating aggregation.
For example, run aggregates as an authenticated admin:

```sql
select week_start, count(*) as expected,
       count(*) filter (where call_completed) as completed,
       100.0 * count(*) filter (where call_completed) / nullif(count(*), 0) as compliance
from public.weekly_coaching_compliance
group by week_start order by week_start;

select trainee_id, bool_and(call_completed) as all_expected_calls_completed,
       count(*) filter (where call_completed) as completed_calls
from public.weekly_coaching_compliance
group by trainee_id;

select count(*) as currently_marked_escalations
from public.weekly_coaching_checkins where admin_attention_required;
```

For final program compliance, restrict expected weeks to finished weeks or completed
programs; current weeks are still in progress. The escalation count represents
currently marked reports, not a lifetime event count after flags have been cleared.
Historical coach attribution for completed calls is also available from the
check-in author; the compliance view's coach represents the current assignment.

## Verification and release limitations

`tests/coaching-calls.test.mts` covers validation, dates/week transitions, query
handling, form/history/overview rendering, goal and attention visibility, and recent
activity integration. `supabase/tests/coaching_calls.sql` exercises actual creation,
upserts, uniqueness, notes, historical weeks, compliance, filters, missing/overdue
calls, active eligibility, unassigned flags and admin/coach/trainee RLS boundaries.
The fresh local database runner includes this suite alongside all existing suites.

Run `npm test`, `npm run test:release:db`, `npm run lint`, `npm run typecheck`,
`npm run format:check` and `npm run build`. The local DB runner never targets a
hosted database. This workspace has no Git metadata/remote, so pulling latest was
unavailable. Hosted migration/application deployment and real-session browser
verification are separate release steps.

The Sunday?Saturday definition is applied by the follow-up migration
`20261004000300_israeli_calendar_weeks.sql`. Existing Monday reports retain their
IDs, original dates and summaries, are labelled historical in the UI, and remain
editable by their authorized author. Legacy completion counts in the Israeli week
of its actual call date; multiple legacy calls in one new week satisfy one
expected call without deleting or combining any historical reports.
