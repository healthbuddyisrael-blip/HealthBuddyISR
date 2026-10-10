# Hosted Before User Created Hook verification

Verified on 2026-10-04 for project `jvfevkatchjmajrioxod`.

## Final hosted configuration

- Auth new-user creation is enabled: `disable_signup = false`.
- Email authentication is enabled; anonymous signup remains disabled.
- Before User Created Hook is enabled with URI `pg-functions://postgres/private/before_user_created`.
- The configured function is the existing `private.before_user_created(event jsonb)`.
- Enabled the Hook and read back its configuration before reopening ordinary signup, avoiding an unprotected signup interval.
- No public signup UI or `/signup` or `/register` application routes were added. Existing HTTP tests confirm those boundaries.

## Function security

The Hook remains SECURITY INVOKER with an explicit empty search path. Among API roles, only `supabase_auth_admin` has EXECUTE. PUBLIC, anon, authenticated, and service_role cannot execute it. The trusted database owner retains its normal operator privileges.

Auth has private schema USAGE and the existing narrow invitation-column grants/RLS allowlist. No function logic, grants, RLS policies, schema, or migrations were changed.

## Actual hosted Auth results

| Case                      | Hosted result                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------- |
| Uninvited email           | Public Auth signup rejected with the Hook's HTTP 403 message; no Auth user or profile             |
| Expired invitation        | Public Auth signup rejected with the Hook's HTTP 403 message; no Auth user or profile             |
| Revoked invitation        | Public Auth signup rejected with the Hook's HTTP 403 message; no Auth user or profile             |
| Accepted invitation       | Public Auth signup rejected with the Hook's HTTP 403 message; no Auth user or profile             |
| Active coach invitation   | Hook-aware Auth signup-link generation created a real Auth identity; no automatic membership      |
| Active trainee invitation | Hook-aware Auth signup-link generation created a real Auth identity; no automatic membership      |
| Existing admin            | Password login and authenticated analytics succeeded after Hook activation and after test cleanup |

Rejected cases used the real public `/auth/v1/signup` endpoint with the publishable key. Allowed cases used `auth.admin.generateLink({ type: "signup", ... })`, which executes the creation Hook and creates the real identity without sending an email. Generated confirmation links/tokens were held only in memory, never logged or saved. Privileged `auth.admin.createUser` was not used as evidence of Hook enforcement: trusted Admin user creation is a different operation.

See Supabase's [Hook contract](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook), [generateLink documentation](https://supabase.com/docs/reference/javascript/auth-admin-generatelink), and [Auth implementation](https://github.com/supabase/auth/blob/master/internal/api/mail.go).

## Controlled test data and cleanup

All test emails were unique designated aliases of the operator's Gmail address; passwords and tokens were generated in memory. No emails were sent.

- The expired invitation was an operator-created, narrowly scoped fixture with already-past creation/expiry dates. No immutable expiry was rewritten.
- Coach/trainee issuance, revocation, and acceptance otherwise used existing domain RPCs.
- Temporarily activated the test coach only because database integrity requires a real coach profile to issue a valid trainee invitation. This also produced the genuine accepted-invitation test case.
- Never activated trainee membership or created assignments/targets/reports.
- Removed the unactivated trainee Auth identity through `cleanup_unactivated_auth_user`, with its trusted attempt marker; hosted cleanup succeeded.
- Removed the temporary activated coach through the documented reviewed operator Auth-tooling procedure. Verified exact test email/metadata/UUID, exclusion of the real admin, zero assignments/targets, and only revoked test invitations before Auth Admin deletion. Existing cascade/restrict constraints remained intact.
- Final hosted state has only the real admin Auth user/profile and zero coach/trainee profiles. The real admin's matching identity, confirmed email, and admin role remain valid.
- Three inactive coach test invitations remain as expired/revoked/accepted history. No active test invitation remains. The trainee invitation cascaded with its temporary inviting coach under the existing schema.
- Removed the temporary `ADMIN_VERIFICATION_PASSWORD` local environment variable after verification.

## Browser and regression verification

Actual isolated Edge browser password login against the local built app connected to hosted Supabase succeeded and reached `/admin`. Admin page/invitation management, wrong-role redirects, Hebrew RTL, mobile overflow, and logout followed by protected-route denial passed with no browser runtime exceptions.

This is local-application/hosted-Auth verification, not a deployed Vercel production-domain or Google OAuth test.

- Four auth unit tests and all 62 application tests passed.
- Four anonymous/public HTTP tests passed, including no public signup navigation/routes.
- Fresh isolated local migration replay, six SQL/RLS suites, and three concurrency scenarios passed. Synthetic SQL fixtures were never run against hosted Supabase.
- Typecheck, lint, formatting, build, and browser/server secret scan passed.
- Hosted schema comparison: 148 objects unchanged; all nine migration versions unchanged; RLS remains enabled on all five application tables.

## Next step

It is safe to proceed to Google OAuth configuration. New invited Google identities can now reach the configured creation allowlist rather than a global signup prohibition. Actual Google OAuth registration/login, wrong-account handling, and uninvited Google rejection must still be tested after provider configuration; they are not marked verified here.
