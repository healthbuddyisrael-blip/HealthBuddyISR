# V1 UX audit

Audited before product edits: every page under `src/app`, role layouts and loading states; application shell; auth and invitation forms; invitation status/actions and HTML/text email delivery; all step, coach, and admin presentation components; shared feedback, buttons, inputs and navigation feedback.

Findings to address:

- Header has a generic account link instead of the existing role destinations and can crowd a narrow phone. Main top spacing delays the trainee action.
- Today and day-detail rings are oversized on narrow phones. Calendar rings can exceed the seven-column cell width. Long counts and percentages need containment without changing values.
- Dialog styling/focus behavior is duplicated. Numeric editors need consistent Hebrew validation and quick value replacement. Auth action forms can reset entered values after errors.
- Invitation empty state adds a second h1. Revocation looks like an ordinary action. Pagination styling differs across lists.
- Coach/admin loading states incorrectly announce steps. Local retrieval failures lack the shared error presentation.
- Email/name wrapping and mixed-direction values need consistent isolation. Summary terminology differs between coach/admin. Product name differs between application and email.
- Reduced-motion handling is incomplete. Plain links/summary controls need consistent visible focus.

Constraints: leave server guards, queries, actions' authorization, RLS, historical calculations and database schema unchanged. No hosted Supabase credentials are configured. Browser availability and connected-flow verification must be reported separately.
