# Weekly calendar and green palette

The trainee, coach trainee detail and admin trainee detail calendars display
exactly seven days, Sunday through Saturday. Previous/next arrows move seven days
at a time across month and year boundaries. The current week is the default;
future weeks cannot be opened, and future days within this week remain disabled.
Historical editing and effective-date step targets retain their existing behavior.

Calendar selection uses `?week=YYYY-MM-DD`, normalized to Sunday. Malformed or
future values fall back to the current week. Old `?month=YYYY-MM` links open the
week containing that month's first day. Admin calendar navigation preserves the
selected analytics range; coach calendar/history navigation preserves the selected
week and call-history page. Activity summaries follow the same selected week.
Current baseline comparison and current call status remain explicitly current;
calendar browsing does not move the coaching KPI to a historical week.

The existing monthly calendar component was replaced with `WeeklyStepCalendar`.
Dashboard reads now fetch only the selected week's activity reports and target
transitions. Calendar and coaching JavaScript share the same week-start helper;
PostgreSQL uses the equivalent Sunday-based definition. No database changes were
needed for this UI change.

The palette now uses mint page backgrounds, sage navigation and table headings,
pale green cards, richer green calendar/report accents and a soft gradient on the
today card. Dark text, input borders, focus indicators and primary buttons retain
accessible contrast. Color supplements the existing date, status and text labels.

Automated checks cover seven-day rendering, navigation, query validation, retained
role routes/range/history parameters, date boundaries, unknown/zero reports,
historical targets and text/focus/input contrast. The existing local Edge browser
audit also exercises the weekly calendar fixture at mobile and desktop widths.

Week navigation updates the header and dates immediately using an optimistic
transition. Each day displays an animated loading indicator until the selected
week is ready; stale reports cannot be opened during the transition.
