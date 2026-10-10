# Production release gate — 2026-10-03

> Historical verification snapshot. Resend provider/configuration references below are obsolete after the Gmail SMTP switch. Current invitation transport and required variables are documented in the README; these snapshots preserve results at their original dates.

**NOT READY FOR RELEASE**

This is a release evidence record and a deployment checklist, not a claim that
the hosted stack has been configured. No production domain or project identifiers
have been supplied. No Supabase, Vercel, Resend, Google Cloud, mailbox, or real
authenticated test-user access is configured in this workspace. Provider plugins
were discovered and suggested, but were not connected. No production data was
changed and no real email was sent.

## Evidence and blockers

| Release item                        | Actual result                                                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Production URL/domain               | Not supplied; no HTTPS production smoke test                                                                             |
| Supabase project/configuration      | Not connected; URL, keys, plan, region and Auth settings unknown                                                         |
| Migrations                          | Nine migrations applied from zero on two new local PostgreSQL databases; not applied to hosted Supabase                  |
| Schema drift                        | Local catalog inventory available; production migration history/schema not inspected                                     |
| Initial admin                       | Trusted bootstrap reviewed/tested locally; no real verified Auth user/profile for `healthbuddyisrael@gmail.com` verified |
| Auth Hook                           | SQL/grants/RLS tested locally; hosted Before User Created configuration and actual Auth invocation not verified          |
| Google OAuth                        | Official setup requirements reviewed; consent/client/provider configuration and real account flows not verified          |
| Password login/recovery/logout      | Local routing/proof/error behavior checked; real passwords, delivered recovery email and session revocation not verified |
| Resend sender/domain                | Not configured; provider verification/DNS/mailbox delivery not verified                                                  |
| Invitations                         | Local creation/rotation/revocation/quota/activation/compensation tests pass; hosted lifecycle not verified               |
| Trainee/coach/admin workflows       | Local domain, rendering, SQL and route boundaries tested; no real authenticated browser workflow                         |
| Isolation/IDOR/RLS                  | Six local SQL suites pass; hosted sessions/PostgREST not verified                                                        |
| Analytics                           | Deterministic local historical-target/lifecycle/zero/missing/>100% assertions pass; no hosted manual cross-check         |
| Timezone                            | Central JS and PostgreSQL Jerusalem business-date semantics tested locally; hosted boundary not observed                 |
| Vercel deployment                   | No linked project/token/CLI; no real install/build/deployment or deployment-log review                                   |
| Secret scan                         | Current source/browser assets inspected locally; no production credentials available to match; no Git history available  |
| Privileged/service-role functions   | Audited below; no authorization/RLS changes made                                                                         |
| Headers                             | Baseline headers added; sensitive routes keep `no-referrer`; real production headers/cookies/CSP not verified            |
| Dependencies                        | Runtime audit: zero findings. Full audit: five high findings in development lint chain; see classification below         |
| Devices/accessibility/email clients | Local headless Edge checks only; no physical device, screen reader or real email-client inspection                       |
| Automated verification              | See final execution results below; local evidence cannot substitute for hosted execution                                 |

Release is blocked until all of the following are completed:

1. Identify the canonical production HTTPS domain, Supabase project, Vercel
   project/team, verified sending domain, and designated test recipients. Connect
   providers or securely configure operator credentials; never paste secrets into
   documentation/chat or commit them.
2. Apply migrations using the supported workflow, inspect migration history/drift,
   verify hosted tables/policies/functions and bootstrap the real verified admin.
3. Enable the actual hosted Auth Hook and verify invited/uninvited password and
   Google identities. Complete OAuth and exact redirect configuration.
4. Configure verified Resend delivery and separate Supabase Auth SMTP/template.
   Demonstrate delivered invitations and working password recovery.
5. Deploy on Vercel with correct production-scoped configuration, domain/TLS,
   production logs, headers and cookies. Review the actual deployment logs.
6. Execute the hosted matrix below, including cross-tenant/direct-RPC denial,
   historical targets, read-only admin/coach restrictions and analytics comparison.

## Repository-derived deployment order

All nine migrations use explicit dependencies and schema-qualified functions.
No migration requires fixture UUIDs, fake Auth users, local filesystem paths or a
production reset. Do not apply `supabase/tests/postgres_harness.sql` to Supabase:
it only represents minimal managed-Auth columns/roles in plain local PostgreSQL.

| Order | Migration                                    | Purpose                                               |
| ----- | -------------------------------------------- | ----------------------------------------------------- |
| 1     | `20261001000100_canonical_model.sql`         | Five tables, types, constraints, RLS enabled          |
| 2     | `20261001000200_integrity_functions.sql`     | Business date, historical targets, integrity triggers |
| 3     | `20261001000300_trusted_admin_bootstrap.sql` | One-time operator bootstrap                           |
| 4     | `20261001000400_invitation_activation.sql`   | Auth Hook, atomic activation, guarded Auth cleanup    |
| 5     | `20261001000500_application_rls.sql`         | Authenticated role/ownership policies                 |
| 6     | `20261001000600_invitation_management.sql`   | Quotas, create/rotate/revoke, safe invitation outputs |
| 7     | `20261002000100_save_daily_steps.sql`        | Authenticated own-step upsert                         |
| 8     | `20261002000200_coach_dashboard.sql`         | Bounded coach retrieval, today's target correction    |
| 9     | `20261002000300_admin_analytics.sql`         | Caller-authorized read-only admin analytics           |

For an existing database, migration 4 rejects legacy trainee invitations without
a valid initial target. Investigate existing data and prepare a reviewed remedy;
do not fabricate targets or bypass constraints. For a fresh project this issue
does not arise.

1. Run `npm ci` with the lockfile and complete local checks. Use Node 24 LTS as
   documented. The Windows-only `NEXT_TEST_WASM_DIR` override is never a Vercel
   environment variable. Vercel uses declared Next/native compiler dependencies;
   webpack mode and the matching WASM dev dependency remain for local use.
2. Verify migrations from zero on non-production. The current safe plain-PG
   runner is `npm run test:release:db`, with `TEST_PSQL_PATH` set when necessary.
   It requires a loopback host, creates a new random `healthbuddy_auth_release_*`
   database, retains it for inspection, and never resets or reuses a database.
   It runs six SQL suites and three real two-session concurrency scenarios.
   A clean managed Supabase rehearsal remains necessary for Auth/PostgREST.
3. Select the intended project explicitly; inspect its existing migration history
   and schema before applying anything. Use `npx supabase login`,
   `npx supabase link --project-ref <confirmed-ref>`,
   `npx supabase migration list`, `npx supabase db push --dry-run`, then
   `npx supabase db push`. Never run `db reset` against production.
4. Save a read-only schema/catalog inventory using
   `supabase/verification/release_inventory.sql`. Compare repository-replayed
   public/private schema with a hosted schema-only dump and migration history;
   allow managed Supabase infrastructure differences only when documented.
   An inventory alone does not establish absence of drift.
5. Keep ordinary user creation closed while the initial admin is provisioned.
   Use trusted Supabase Auth Admin tooling to create/invite the real admin; do
   not insert an Auth SQL fixture or mark an unverified identity as verified.
   After actual email verification, use database `postgres` to call
   `private.bootstrap_initial_admin(<real-auth-uuid>, <real-display-name>)`.
   Check matching Auth/profile UUID, confirmed email and persisted `admin` role.
6. Configure and ENABLE Before User Created in hosted Auth: PostgreSQL schema
   `private`, function `before_user_created(event jsonb)`. Function creation is
   insufficient. Enable ordinary invited identity creation only after this is
   active; anonymous sign-in remains disabled. No permanent admin-email bypass.
7. Configure providers, email and redirects below, deploy, then execute real flows.

## Environment separation and provider configuration

Use distinct Supabase projects/keys for development or preview and production.
Do not give preview deployments production service credentials or database
access. Preview invitation emails must use a deliberate staging origin; do not
wildcard every Vercel preview host in production Auth redirects. Local SQL and
concurrency suites are loopback-only and use synthetic `example.test` users.

The application requires exactly these existing names:

| Variable                               | Exposure             | Production value/source                                              |
| -------------------------------------- | -------------------- | -------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Public               | Confirmed production Supabase HTTPS origin                           |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public               | Production `sb_publishable_...` key                                  |
| `NEXT_PUBLIC_APP_URL`                  | Public               | Canonical production HTTPS origin, no path/query/fragment            |
| `SUPABASE_SERVICE_ROLE_KEY`            | Server secret        | Production secret/service-role credential; retain existing name      |
| `AUTH_CONTEXT_SECRET`                  | Server secret        | Random 32-byte base64url signing secret; consistent across instances |
| `ADMIN_EMAIL`                          | Server configuration | `healthbuddyisrael@gmail.com`, not an authorization bypass           |
| `RESEND_API_KEY`                       | Server secret        | Restricted sending key for verified domain                           |
| `EMAIL_FROM`                           | Server configuration | Accepted address on verified sender domain                           |

Set Vercel Production/Preview/Development scopes deliberately and redeploy after
public-variable changes. Do not expose private values using `NEXT_PUBLIC_`.
Production validation rejects HTTP/non-origin URLs and local compiler overrides.
Domain ownership is an operator check: syntactic URL validation cannot prove it.

Google: configure a Web application OAuth client in the intended Google Cloud
project, consent/audience/branding and applicable scopes. Application origins go
in authorized JavaScript origins where required. The authorized provider redirect
is the **Supabase** `https://<project-ref>.supabase.co/auth/v1/callback`, not the
application callback. Store the Google secret only in the Supabase Google
provider configuration. Set Supabase Site URL to the canonical app origin and
allow the exact app `/auth/callback` and `/auth/recovery` redirects. Preserve
provider email verification. See [Supabase Google setup](https://supabase.com/docs/guides/auth/social-login/auth-google)
and [Google's web-server OAuth documentation](https://developers.google.com/identity/protocols/oauth2/web-server).

Supabase Auth recovery requires custom production SMTP; application Resend SDK
configuration does not configure Auth mail. The reset template must link to
`{{ .RedirectTo }}?token_hash={{ .TokenHash }}` with the application redirect
`<production-origin>/auth/recovery`. The app hardcodes OTP type `recovery`, uses
an explicit confirmation POST, and binds recovery proof to the verified session.
Default fragment/code-only reset links do not match this implementation. See
[Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) and
[Resend SMTP](https://resend.com/docs/send-with-smtp).

Resend: verify domain ownership/DNS using the provider's actual records and
confirm **Verified** status, then test delivery and mailbox receipt. Do not use a
temporary test sender. Disable open/click tracking for bearer-link emails.
Invitation HTML/text contain only context, target, expiry and CTA; no internal
IDs. Inspect actual received RTL rendering; template tests alone are insufficient.
See [Resend domain verification](https://resend.com/docs/dashboard/domains/introduction).

## Security and operations audit

No database migrations, RLS policies, role guards, invitation quotas or permission
boundaries were changed in this phase. Server actions remain authenticated POST
operations. OAuth GET exchanges a code but does not accept an invitation; an
explicit POST performs membership activation. Browser-controlled redirect targets
are not used. No permissive authenticated CORS headers were added.

Every final SECURITY DEFINER function has an explicit empty `search_path` and no
dynamic SQL. Execute grants and caller checks were reviewed:

| Functions                                                                                        | Purpose and execution boundary                                                                                                   |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `accept_invitation`, `cleanup_unactivated_auth_user`                                             | Service-only atomic activation/attempt-bound cleanup; managed Auth cascade still needs hosted verification                       |
| `private.current_role`, `private.is_assigned_trainee`                                            | Authenticated, caller-bound role/ownership checks without recursive RLS                                                          |
| `create_coach_invitation`, `create_trainee_invitation`, `rotate_invitation`, `revoke_invitation` | Authenticated execution with DB-enforced role/owner/quota; no caller-selected inviter or role                                    |
| `set_today_step_target`                                                                          | Authenticated assigned coach only; server-date insert or today's value correction; preserves original author and historical rows |

The bootstrap and Auth Hook are SECURITY INVOKER. Bootstrap execution is
operator-only and closes after the first admin. Hook execution/select grants are
limited to `supabase_auth_admin`, with active-invitation RLS. Step saving, coach
dashboard and admin analytics are invoker operations with authenticated identity,
role checks and RLS; no arbitrary admin/coach identity parameter.

Privileged Supabase client modules are `server-only`. Their usages are limited
to invitation hash lookup, trusted activation/new-identity provisioning/guarded
cleanup and existence-neutral member recovery lookup. Ordinary trainee, coach
and admin retrieval/mutations use authenticated sessions and RLS.

Added global `nosniff`, frame denial, restricted device Permissions Policy and
baseline referrer policy. Secret-bearing routes override to `no-referrer` and
`noindex`. HSTS is emitted only for Vercel Production, with no subdomain/preload
claim. No CSP was introduced or claimed. Actual HTTPS response/cookie behavior
must be inspected after deployment.

Source diagnostics log sanitized codes/operation names or opaque IDs, not raw
tokens, URLs, passwords, provider error payloads or keys. External hosting/Auth/
email access-log redaction and retention remain unverified. Configure these
before testing bearer links; do not attach links to screenshots or reports.

Current files contain no discovered live credential values. Build placeholders
are non-secret and intentionally local. No Git checkout/history is present, so
historical secret exposure cannot be ruled out; scan the actual source repository
history before release and rotate any previously committed credentials. Provider
secrets and actual production browser bundles must also be scanned when available.

Full `npm audit` reports five high findings in the development-only chain
`eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces`.
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) concerns
stack exhaustion from nested patterns. Registry latest `braces` is 3.0.3, still
affected. The suggested major downgrade of Next ESLint config is not applied.
Runtime `npm audit --omit=dev` reports zero vulnerabilities. These libraries are
lint tooling, not imported by application routes; lint only trusted repository
patterns and do not run it on arbitrary user input. Track a patched release and
re-audit immediately before deployment. This is a documented development finding,
not an established production-reachable high vulnerability.

Observability uses existing Vercel app/deployment logs, Supabase database/Auth
logs and Resend delivery events. Operator access/retention/incident ownership are
not verified. No third-party monitoring platform was added.

Backup plan, retention and recovery capability are unknown until the project is
connected. Inspect actual Database → Backups settings, record last backup and
retention, and rehearse restoration on non-production. Before any destructive
change, secure a verified backup and reviewed rollback plan; keep dumps encrypted
outside the repo. PITR is not claimed. See [Supabase backups](https://supabase.com/docs/guides/platform/backups).

Account deletion is an operator request, not a new UI or ad-hoc SQL flow. Verify
identity, assess retention obligations and references, back up safely, rehearse
on staging, then use a reviewed procedure with Auth tooling. Trainee data cascades
from Auth/profile deletion; coaches with assignments and referenced target authors
are restricted. Do not bypass foreign keys or silently transfer trainees. No
deletion procedure has been executed on hosted data.

Production verification should use clearly designated consenting test accounts,
including two coaches and separate trainees. Record whether test data should
remain; removal requires a reviewed operator procedure. Never use real trainee
personal data or publish account passwords/raw invitation links as evidence.

## Hosted end-to-end matrix

`NOT TESTED` is neither PASS nor evidence of a known product failure. Every row
below requires a real configured hosted stack and is currently a release gate.

| Flow                                                                           | Real hosted test |
| ------------------------------------------------------------------------------ | ---------------- |
| Admin login                                                                    | NOT TESTED       |
| Admin invite coach                                                             | NOT TESTED       |
| Coach email received                                                           | NOT TESTED       |
| Coach password registration                                                    | NOT TESTED       |
| Coach Google registration (separate new account)                               | NOT TESTED       |
| Coach login                                                                    | NOT TESTED       |
| Coach invite trainee                                                           | NOT TESTED       |
| Trainee email received                                                         | NOT TESTED       |
| Trainee password registration                                                  | NOT TESTED       |
| Trainee Google registration (separate new account)                             | NOT TESTED       |
| Trainee step entry/update/refresh                                              | NOT TESTED       |
| Historical step edit                                                           | NOT TESTED       |
| Zero, missing, >100%, future-day behavior                                      | NOT TESTED       |
| Coach sees trainee steps                                                       | NOT TESTED       |
| Coach changes target and same-day correction                                   | NOT TESTED       |
| Historical target preserved                                                    | NOT TESTED       |
| Admin analytics 7/30 days and manual denominator cross-check                   | NOT TESTED       |
| Invitation resend: old link fails/new link works                               | NOT TESTED       |
| Invitation revoke and revoked-email Auth denial                                | NOT TESTED       |
| Wrong Google account rejection/state unchanged                                 | NOT TESTED       |
| Uninvited password/direct Auth/brand-new Google rejection                      | NOT TESTED       |
| Existing Auth identity invitation without password overwrite                   | NOT TESTED       |
| Password recovery: delivery/reset/old-password denial/unknown-email neutrality | NOT TESTED       |
| Logout for all roles and protected refresh denial                              | NOT TESTED       |
| Cross-coach isolation/direct PostgREST/RPC ID substitution                     | NOT TESTED       |
| Trainee cross-user and target-write denial                                     | NOT TESTED       |
| Coach step-write/backdated/future/unassigned target denial                     | NOT TESTED       |
| Admin protected step/target mutation denial                                    | NOT TESTED       |
| Anonymous data denial and non-admin admin denial                               | NOT TESTED       |
| Production smoke: public/protected routes/assets/no redirect loop              | NOT TESTED       |
| Production headers/cookies/HTTPS                                               | NOT TESTED       |

For analytics manually compare a known, small test cohort containing a missing
day, zero report, >100% report and target transition. Expected days start at
`max(window start, assignment business date, first target effective date)`.
Attainment uses only reports with a valid target; completion averages uncapped
per-day historical ratios. No report never becomes zero; zero remains reported.
Use actual hosted activation dates rather than backdating assignments/targets.

## Local execution results

Local results: 54 domain/render/accessibility/release tests, four anonymous HTTP
tests and two Node-driven database concurrency tests passed (60 Node test cases).
All six SQL suites passed against a fresh migration chain. A separate real
two-session acceptance race also passed: exactly one membership committed.
Catalog verification confirmed all five application tables have RLS enabled.
No local automated tests used production credentials or a remote database.

The built local app returned expected security headers and protected redirects.
Edge/CDP checks passed 70 screen/width combinations (320, 375, 390, 430, 768,
1024 and 1440px): real `/`, `/login`, `/forgot-password`, invalid invitation and
unproven reset-password pages, plus five separate SSR component fixtures. Login
Tab navigation/validation and a read-only dialog's focus/Escape behavior were
checked. Selected mobile screenshots were inspected. No authenticated step-entry,
coach target-edit or role-navigation keyboard workflow was executed. Browser
evidence cannot establish authenticated persistence or hosted authorization.

Current-source/config/browser-asset credential-pattern scan passed (171 files);
real production credential comparison and repository history remain unavailable.
`npm run lint`, `npm run typecheck`, `npm run format:check` and `npm run build`
passed locally with explicitly non-secret local placeholders and the documented
Windows compiler override. This is not a Vercel build or hosted deployment.

Remaining non-blocking coverage limitations include no physical mobile device,
formal screen-reader assessment or real email-client coverage, no self-service
deletion UI and no dedicated monitoring platform. These do not justify omitting
the hosted critical flows above. No product features or visual redesign were
added; changes are limited to release safeguards, local-test isolation, catalog
inspection and operator documentation.
