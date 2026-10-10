# Pilot weekly reporting

## Workflow

An admin explicitly enrolls participants at `/admin/pilot`. Start dates are
Sunday week starts; an optional end date ends the pilot period. Enrollment does
not fabricate reports or change existing daily data. Existing report periods
cannot be excluded by a later enrollment edit. Search supports the enrollment
selector without fetching an entire participant directory.

Coaches use `/coach/pilot` or their existing participant detail page. The default
report covers the last completed Sunday–Saturday week in Asia/Jerusalem. On
2026-10-11 this is October 4–10. Week selection remains independent of the date
of submission. Conversations are dated after the reporting week and cannot be
in the future. Late reporting and historical corrections are supported.

The form includes average daily steps, independent actual strength/aerobic
session counts, a step screenshot, five personal follow-up notes, a flexible
next-week goal, conversation status/date, and an optional attention marker.
An optional coach assessment records whether the previous goal was met; it is
not inferred from activity or interpreted as a medical improvement.

Drafts permit missing activity/evidence/notes. A completed conversation may
remain a draft. Submission requires complete activity values, a screenshot,
a completed conversation and all five notes (write "none" for no difficulties).
Corrections update the same report. Returning a submitted report to draft is
explicitly labelled and removes its authoritative status until resubmitted.

During an active pilot period the participant dashboard is read-only. The coach
enters reports; participants do not need to log in. Outside the enrollment dates,
the original daily workflow remains available. Historical daily records remain
readable. A DB trigger prevents participant daily writes for pilot dates, including
legacy RPC calls; it does not alter or remove existing daily reports.

## Database and source of truth

Migration `20261011000100_pilot_weekly_reporting.sql` adds:

- `pilot_participants`: explicit enrollment, dates and administrator attribution.
- `pilot_weekly_reports`: unique participant/week, coach attribution, manual
  source, draft/submitted status, activities, screenshot path, five notes,
  conversation metadata, timestamps and optimistic revision.
- `pilot_weekly_figures`: one authoritative row per participant/week. Submitted
  coach reports replace daily aggregates for the same key. Without a submitted
  report the original `weekly_activity` row is used. Drafts never contribute
  activity. Sources are alternatives, never sums.
- `set_pilot_enrollment`, `save_pilot_weekly_report`, and
  `get_pilot_week_overview`: tightly scoped, caller-verified operations.
- `pilot_daily_write_guard`: preserves non-pilot behavior and prior statistics.

No daily rows are generated from a weekly report. No workout values are
multiplied by seven. The manual average retains its meaning and two decimal
places. The existing daily weekly view, baseline calculations and the previously
deployed short-window workout correction remain intact. Pilot screens use the
new source-of-truth view; legacy daily analytics remain historical daily metrics.
The source field currently accepts `manual_coach`; a future synchronization
release can extend it without replacing the conversation record. No synchronization,
wearable integration or OCR is implemented.

Only persisted coaches assigned to a participant can write that report. An
admin can read all reports; participants can read only their own submitted
reports. Direct table inserts/updates/deletes are not granted. Narrow write RPCs
repeat membership, assignment, period and evidence checks and lock membership
and assignments. The unique key prevents duplicate creation; revisions reject
stale edits instead of silently overwriting another correction. Existing
authentication, role definitions and invitation flows are unchanged.

## Evidence storage

`pilot-step-evidence` is private, accepting PNG/JPEG/WebP up to 3MB. The server
checks MIME, byte signature and size. The Next action body limit is 4MB so that
image and form metadata fit within the host request limit. The coach confirms
that the image shows the selected reporting dates; no data is parsed from it.

Object paths are `participant_uuid/Sunday_week_start/random_uuid.extension`.
Storage policies verify the caller's persisted role, current assignment and
pilot period. Admins may read screenshots; participants cannot read Storage
objects. API clients cannot use overwrite to replace files. Reports validate
that a referenced object exists in the private bucket for the exact participant
and week. Submitted reports cannot reference missing evidence.

Authorized views use 120-second signed URLs, never permanent public URLs or the
shared image optimizer. A refresh control renews expired links. Files are uploaded
under a new unique path before saving. On failed saves the new file is removed;
after successful replacement the previous unreferenced file is removed. Storage
deletion policy protects any referenced image. Process crashes/network cleanup
failures can leave unreferenced objects; operators should inspect such objects
older than a day before deleting through Storage. Never delete objects referenced
by a report. Cleanup failures are logged without secrets or screenshots.

## Monitoring

`/admin/pilot` computes expectations for the selected reporting period using
enrollment, including participants without a report. It shows submitted/missing
reports, completed/pending conversations, overdue counts and completion rate.
The denominator is the selected eligible pilot cohort, independent of report
presence and list pagination. No reports are overdue during the following Sunday;
overdue begins on Monday in Jerusalem. Coach summaries show outstanding work.

Participant cards show coach, status, conversation date, authoritative activity,
goal, difficulties, explicit attention, week-over-week step change when both weeks
exist, and manually assessed goals met in the last four submitted reports.
Histories show source/coverage, recorded counts, progress and goals. An admin can
open a complete read-only report and its evidence. No medical inference is made.

## Verification and deployment

`npm test` includes `tests/pilot.test.mts`. The disposable local database runner
also runs `supabase/tests/pilot_weekly.sql`, including Storage RLS metadata checks.
The local Storage harness tests policy evaluation rather than pretending to run
the managed Storage upload service. `tests/ux-browser.mts` includes mobile/desktop
SSR fixtures for the pilot form and monitoring page; these are layout checks,
not authenticated browser submission tests.

Before hosted release verify project `jvfevkatchjmajrioxod`, review the dry run,
compare the existing bucket/schema/migration history, and capture historical
daily/baseline/weekly fingerprints. Apply this additive migration before releasing
the application. Do not reset or seed production. Review fingerprints afterward.
Enrollment of actual participants requires an explicit cohort/date decision or
an administrator's deliberate action in the new UI.

The original workspace has no Git metadata. The supplied HealthBuddyISR remote
was empty when checked; prepared local commits remain in an isolated checkout.
GitHub write access is unresolved. No code is claimed pushed to that repository,
and no attempt is made to use the abandoned Talmal6 account.

### Production release — October 10, 2026

Migration `20261011000100_pilot_weekly_reporting.sql` was applied successfully to
`jvfevkatchjmajrioxod`. The application was deployed through the established Vercel
directory deployment workflow. Deployment `dpl_8m6bvJJhkT5FgLiz4tzWYGDTD4xC` is
READY at https://health-buddy-israel.vercel.app.

Following explicit cohort approval, both currently active, assigned participants
were enrolled with reporting-week start October 4, 2026. Eligibility was checked
against the existing seven-day activity metric, coach assignment, program dates,
and account suspension/deletion status. No inactive or unassigned accounts were
enrolled. The first reporting day is October 11 for October 4–10; the deadline is
the end of October 11 in Asia/Jerusalem. Reports become overdue at October 12
00:00 local time. The first week cannot be submitted before it closes.

Read-only production checks confirmed private Storage with the 3 MB limit and
PNG/JPEG/WebP allowlist, both pilot tables protected by RLS, and all three evidence
policies installed. Coach/admin overview queries ran under persisted identities
with the authenticated database role. Historical canonical figures have zero
differences from the original weekly view. Before/after fingerprints match for
daily records, baseline records, weekly figures, profiles, assignments, legacy
coaching check-ins, and the existing workout-counting function. Batya's October
4–10 historical fallback remains one strength workout and zero aerobic workouts.
No weekly reports or screenshots were fabricated for verification.

Validation passed: 96 application tests; 10 local SQL/RLS suites and three existing
concurrency scenarios; lint; typecheck; production build; 84 responsive browser
layout checks; production public-page/asset smoke checks; and four production HTTP
authentication regression tests including the new pilot routes.

Authenticated production browser upload, draft, submit, replacement and correction
checks still require an authorized session/test account. Managed Storage upload
behavior was not verified end to end in production. The correct GitHub remote
still has no branches; this release is preserved locally, but GitHub write access
remains unresolved and the release has not been pushed there.
