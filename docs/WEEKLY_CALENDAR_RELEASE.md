# Live weekly-calendar update — 2026-10-04

Production: <https://health-buddy-israel.vercel.app>.

Deployment `dpl_7yeE47wbLgH4rpfqcFPKpPYyScWA` reached Vercel `READY` and was
published to the existing production domain. The prior visible site had not
received the local activity, coaching and calendar work.

The live update includes Sunday–Saturday calendars, seven-day navigation, an
immediate optimistic header/date change and animated loading indicators on the
days until their reports arrive. Day actions are disabled while loading to prevent
opening stale data. It also includes the mint/sage UI and the requested activity
baseline and weekly-call features.

These pending migrations were applied transactionally and recorded in the hosted
Supabase migration history before deployment:

- `20261004000100_activity_baselines.sql`
- `20261004000200_weekly_coaching_calls.sql`
- `20261004000300_israeli_calendar_weeks.sql`

Hosted checks confirmed that Sunday 2026-10-04 and Saturday 2026-10-10 both resolve
to week start 2026-10-04, and that the three weekly-call RLS policies are present.
No baseline or call values were fabricated for existing participants. Existing
daily reports retain unknown workout fields. The Sunday-week migration also has
a local upgrade test preserving two pre-migration Monday reports and their edits,
without double-counting compliance when their call dates share an Israeli week.

Validation passed: 86 application tests, eight existing SQL suites, the additional
legacy upgrade fixture/verification, existing concurrency checks, lint, typecheck,
formatting and production build. The local Edge audit passed 70 screen/width
combinations (five public routes and five separate SSR fixtures at seven widths),
including 320px phone layouts. Production HTTP smoke checks passed for five public
pages and 15 referenced assets, including security headers and secret scanning.

The browser fixtures verify layout; they do not substitute for an authenticated
production session. Real coach/trainee navigation latency was not benchmarked.
The app now exposes loading feedback during the existing fetch rather than
claiming that every database request has become faster.
