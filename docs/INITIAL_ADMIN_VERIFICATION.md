# Controlled initial admin verification

Verified on 2026-10-04 for Supabase project `jvfevkatchjmajrioxod`.

This records the bootstrap-time configuration. The subsequent [hosted Auth Hook verification](HOSTED_AUTH_HOOK_VERIFICATION.md) supersedes the final Hook/signup state below: the Hook is now enabled and ordinary new-user creation is enabled behind its invitation allowlist.

## Key rotation

- Replaced the previously exposed application server key through Supabase Management API using the existing secure CLI identity.
- Updated only the ignored `.env.local` server-key variable.
- Deleted the exposed key. The same Auth Admin endpoint that accepted it before rotation now rejects it with HTTP 401; the replacement is accepted.
- The publishable key was preserved. No secret values are recorded in this report.
- Source, configuration, browser assets, and server assets passed the credential scan. Server environment access and the privileged client remain protected by `server-only`.

## Real admin identity

- Created `healthbuddyisrael@gmail.com` through Supabase Auth Admin `createUser`, with the user's locally supplied password and explicit trusted admin-side email confirmation. No email challenge/delivery test is implied by this confirmation.
- Called the existing operator-only `private.bootstrap_initial_admin` as the trusted database operator.
- Verified exactly one corresponding profile, matching Auth/profile IDs, matching email, confirmed email, and persisted `admin` role.
- Verified password authentication and admin analytics using a real authenticated session with the publishable key.
- Admin attempts to save steps, change targets, and call the coach dashboard RPC were rejected.
- The temporary `ADMIN_BOOTSTRAP_PASSWORD` variable was removed from `.env.local` after verification. It is not an application runtime requirement.

## Browser verification

Used isolated headless Microsoft Edge against the built application at `http://localhost:3000`, connected to the real hosted Supabase project:

- Anonymous `/admin` access redirected to login.
- Wrong-password login returned a generic Hebrew error.
- Keyboard password login succeeded and redirected to `/admin`.
- Actual admin analytics and `/admin/invitations` loaded.
- Admin requests to trainee/coach route prefixes redirected to `/admin`.
- Inspected screenshots at 1440px desktop and 390px mobile; the mobile viewport had no horizontal overflow.
- Logout succeeded; subsequent protected-page access redirected to login.
- No browser runtime exceptions occurred in the completed run.

This does not verify a deployed Vercel production domain, Google OAuth, recovery email delivery, physical devices, or live coach/trainee sessions. No coach or trainee accounts were created.

## Integrity and regression checks

- Hosted application schema fingerprints: all 148 objects unchanged.
- Migration history: all nine repository migrations present and unchanged.
- RLS enabled on all five application tables.
- Hosted totals after verification: one Auth user, one admin; no coaches, trainees, assignments, step reports, targets, or invitations.
- 62 application tests and four anonymous HTTP tests passed.
- Fresh isolated local migration replay, six SQL suites, and three concurrency scenarios passed. These local suites cover the additional role/ownership boundaries without creating hosted fixture accounts.
- Lint, typecheck, format check, production build, and browser/server secret scan passed.
- No application authentication semantics, RLS policies, database functions, migrations, or UI were changed. The only verification-code change extends the existing secret scan to server assets and the temporary bootstrap password.

## Auth configuration and next step

The hosted Before User Created Hook remains **disabled and unchanged**. Ordinary signup was closed before provisioning, following the README's safe deployment order, and remains closed.

The initial admin prerequisite is complete. It is safe to proceed to configuring/enabling `private.before_user_created(event jsonb)` as the hosted Before User Created Hook in a separate controlled step. Verify the hosted Hook configuration before reopening ordinary invited signup, then test real uninvited rejection and invited identity creation. Do not create a permanent email-based authorization exception.

This report completes the controlled bootstrap task; it is not a production-release verdict.
