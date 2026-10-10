# צעדים ביחד — HealthBuddy

Hebrew, RTL step tracking for coaches and trainees. Authentication, invitations/email, trainee and coach dashboards, today-only target management, and read-only V1 admin analytics are implemented. Admins can inspect system metrics, coaches, trainees, and historical calendars using 7/30-day windows. Hosted Auth/provider/email integration still requires real configuration and verification.

## Production release gate

See [the release gate and deployment runbook](docs/PRODUCTION_RELEASE_GATE.md) for the current verdict, migration order, provider setup, hosted verification matrix, and operational limitations. Local success is not a production release approval.
The [2026-10-04 hosted Supabase setup report](docs/HOSTED_SUPABASE_SETUP.md) records the subsequent successful migration deployment and schema/permission verification, plus remaining local runtime configuration blockers. The release-gate report above is the earlier 2026-10-03 snapshot; it does not include this later hosted evidence.

## Stack and local development

The coach-entered pilot weekly workflow, enrollment, private evidence, source
precedence, and release verification are documented in
[Pilot weekly reporting](docs/PILOT_WEEKLY_REPORTING.md).

Next.js 16 App Router, React 19, strict TypeScript, Tailwind CSS 4, shadcn/Radix primitives, Supabase Auth/PostgreSQL/SSR, Zod, React Hook Form, Nodemailer/Gmail SMTP, and React Email rendering. ESLint and Prettier enforce code quality. No separate backend or global state library.

Use Node.js 24 LTS (minimum 22.18) and npm. Dependencies and the download cache are project-local. Copy `.env.example` to `.env.local`, fill in configuration, then:

```bash
npm install
npm run dev
```

Open http://localhost:3000. Root HTML has `lang="he" dir="rtl"`; a Hebrew-capable system font avoids remote font downloads. The existing responsive shell, focus states, touch targets, and feedback components remain in place.

## Environment

| Variable                               | Required | Purpose                                                                                                                                                                                                    |
| -------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Yes      | Supabase API URL.                                                                                                                                                                                          |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes      | Public `sb_publishable_...` key, never a secret key.                                                                                                                                                       |
| `NEXT_PUBLIC_APP_URL`                  | Yes      | Canonical application origin; localhost locally, HTTPS in production. Callbacks use this configured origin, never a browser-supplied destination.                                                          |
| `SUPABASE_SERVICE_ROLE_KEY`            | Yes      | Server-only service-role/secret credential for trusted provisioning, invitation validation, and member recovery lookup. Normal application queries use the user's session and RLS.                         |
| `AUTH_CONTEXT_SECRET`                  | Yes      | At least 43 characters: generate 32 random bytes encoded as base64url. Signs short-lived invitation/recovery cookies. Share consistently across application instances; rotation invalidates pending flows. |
| `ADMIN_EMAIL`                          | Yes      | Initial admin contact `healthbuddyisrael@gmail.com`; never used for normal authorization. The operator bootstrap selects this specific verified Auth identity.                                             |
| `GMAIL_USER`                           | Yes      | Server-only SMTP account: `healthbuddyisrael@gmail.com`.                                                                                                                                                   |
| `GMAIL_APP_PASSWORD`                   | Yes      | Server-only Google App Password; never the normal account password.                                                                                                                                        |
| `EMAIL_FROM`                           | Yes      | V1 sender: `Health Buddy <healthbuddyisrael@gmail.com>`. Never browser-controlled.                                                                                                                         |

Generate the context secret locally:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Zod validates required configuration before dev/build. Never commit `.env.local` or real secrets. Private environment access and the privileged Supabase client import `server-only`. Public configuration is fixed at build time. No Google secret is needed in application/browser environment variables; configure it in Supabase's provider settings.

## Architecture and source layout

```text
Next.js Server Components / Server Actions
  ↓ Supabase Auth: verified identity + SSR cookies
  ↓ PostgreSQL: profiles + integrity constraints + RLS
Gmail SMTP → transactional invitation email delivery after database commit

src/app/                 public auth screens, protected invitations, trainee/coach dashboards, read-only admin analytics and drill-downs
src/components/          existing ui/layout/shared components
src/lib/auth/            verified session, routing, signed context, messages
src/lib/invitations/     server-only tokens/validation, safe summaries and lifecycle status
src/lib/email/           server-only Gmail SMTP transport/send orchestration and React template
src/lib/supabase/        browser, user-session server, proxy, privileged clients
src/lib/validation/      Zod boundary schemas
src/types/               small domain types; genuine generated types come later
supabase/migrations/     ordered canonical schema, activation, and RLS migrations
supabase/tests/          executable PostgreSQL integrity/auth/RLS assertions
tests/auth.test.mts      Node tests for context integrity, validation, and routing
```

`@/` resolves to `src/`. Tailwind 4 uses CSS theme configuration in `src/styles/globals.css`; shadcn configuration is in `components.json`. See `src/types/README.md` to generate actual Supabase database types after applying migrations; no generated schema types are fabricated.

## Roles and registration policy

- `admin`: manages/invites coaches; reads administrative data.
- `coach`: invites trainees with an initial daily target; manages targets and reads assigned trainees' reports.
- `trainee`: belongs to exactly one coach; submits and edits their own daily reports.

There is no public signup. All accounts are invitation-only.

Email/password and Google both use Supabase Auth. An Auth identity alone is not application membership. Roles and assignments come exclusively from trusted database profiles, not user metadata, provider metadata, browser state, or query parameters. No automatic Auth-to-profile trigger exists. There are no `/signup` or `/register` routes.

### Password invitation activation

`/invite/<raw-token>` validates the token on the server before showing the read-only invited email and Hebrew activation form. Registration is an explicit Server Action POST. The server takes the email from the invitation and creates a new Auth account using the Admin API, then calls `accept_invitation` and signs in with a normal password session.

Possession of the private, random invitation link is deliberately treated as email verification proof for this flow: only this validated server operation uses `email_confirm: true`. Tokens use 32 cryptographically random bytes, URL-safe encoding, and SHA-256 hashes in the database. Existing Auth identities are never given a replacement password: the user must sign in using the existing password or Google and then activate the invitation.

Auth creation and application activation cannot share one cross-service transaction. Each newly created identity is tagged with a server-generated `app_metadata.activation_attempt_id`. On activation failure, a service-only compensation RPC locks that Auth row and deletes it only if the trusted attempt marker matches and no application profile exists. This prevents a race with successful concurrent activation or a lost success response. It intentionally performs a narrowly guarded database deletion rather than an unsafe separate Admin API check/delete. Hosted managed-Auth cascade behavior remains an integration check. If cleanup itself fails, the UI explains that the identity was created but activation did not finish; diagnostics record the opaque Auth UUID and sanitized code for operator review. The unactivated identity still cannot access application data.

### Google invitation activation

An explicit Google-start POST stores invitation context in a signed, 10-minute HttpOnly cookie (`Secure` in production, `SameSite=Lax`). PKCE is handled by the Supabase SSR client. `/auth/callback` exchanges the code, obtains the verified Supabase user, and compares that trusted email to the server-validated invitation email. Mismatches, cancellations, callback errors, expired tokens, and incompatible existing profiles fail closed. Terminal callback failures clear pending context; failures after a successful code exchange also sign out the exchanged session. A cancelled or fabricated error callback cannot sign out an unrelated existing session.

After a matching callback, `/invite/complete` collects a validated full name and requires an explicit POST to activate membership. The OAuth callback does **not** consume an invitation on GET. This additional confirmation preserves the requirement that opening a URL cannot create application membership. Pending raw tokens are kept only in the short-lived signed cookie, not localStorage, analytics, or database rows.

Normal Google login without invitation context requires an existing profile. Supabase handles identity linking; the application never merges Auth rows or transfers profiles between UUIDs. Ambiguous linking/provider errors fail safely. Manual linking UX is out of scope.

### Atomic activation and initial targets

Migration `20261001000400` adds immutable `invitations.initial_target_steps`: NULL for coaches and a positive integer for trainees. The target is chosen by the inviting coach, never the trainee. If old trainee invitations already exist without an initial target, this migration intentionally fails rather than guessing a value; prepare a reviewed data migration to supply vetted targets or remove/reissue those legacy records before deployment.

`public.accept_invitation(p_token_hash, p_auth_user_id, p_full_name)` is service-role-only. Its SECURITY DEFINER scope is limited to trusted Auth lookup and atomic provisioning. It locks the invitation, checks expiry after acquiring the lock, verifies the Auth email/confirmation, and rejects any existing membership. A coach gets only a profile. A trainee gets a profile, coach assignment, and initial target effective on `business_date()` with the invitation's coach as author. It marks the invitation accepted in the same transaction and explicitly validates deferred setup constraints before returning. Duplicate/concurrent acceptance produces one success and deterministic failure without duplicate rows.

## Login, logout, recovery, and protected routes

`/login` contains email/password, Google, and forgot-password options, with no registration link. Password login calls `signInWithPassword`, verifies the Auth user, loads their own RLS-protected profile, and redirects using its persisted role. An unprofiled identity is denied and signed out unless it is continuing a valid matching invitation.

Role destinations are trainee → `/app`, coach → `/coach`, admin → `/admin`. Proxy checks protect whole route prefixes and preserve refreshed cookies. Server layouts **and pages** use `requireRole`; future data loaders and mutations must also verify authorization. SSR `getUser`/verified claims and database profiles are used; client caches and route visibility never authorize access. Session responses are private/no-store. Logout is a POST and clears local Supabase/context cookies even if remote revocation fails.

`/forgot-password` always gives the same existence-neutral success message. Recovery is offered to members with an email identity; Google-only members use Google login. The email link opens `/auth/recovery`; an explicit confirmation POST verifies a Supabase recovery OTP. It issues a signed, short-lived recovery marker bound to the verified user and JWT session ID. `/reset-password` and its action both require that proof. Ordinary login sessions cannot use the reset form. Password updates use Supabase, then clear recovery/session state. Password minimum is 10 characters; no custom password storage or arbitrary complexity rules.

## Database model, dates, and historical semantics

| Table            | Purpose                                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| `profiles`       | Auth UUID primary key, normalized unique email, name, immutable role, timestamps.                           |
| `coach_trainees` | Unique trainee assignment and coach/trainee pair; database role checks.                                     |
| `daily_steps`    | One nonnegative integer report per trainee/date; historical edits allowed, future Jerusalem dates rejected. |
| `step_targets`   | Positive append-only target transitions, unique trainee/effective date, coach/admin attribution.            |
| `invitations`    | Hashed token, normalized email, immutable role/actor/coach/initial target/expiry, irreversible acceptance.  |

Historical targets are never overwritten. `get_step_target(uuid,date)` returns the latest target effective on/before the requested date, or NULL before the first target. Migration `20261002000200` introduces the narrowly scoped `set_today_step_target(uuid,integer)` RPC: assigned coaches may insert today's transition or correct today's value until the business day ends, preserving its ID, original author, and creation timestamp. Earlier target rows remain immutable. Direct target INSERT/UPDATE/DELETE is unavailable to authenticated application users; coaches cannot backdate or schedule targets. The service client retains its existing trusted provisioning privileges and cannot directly UPDATE/DELETE targets.

No daily_steps row means no report, not zero steps. Zero is a valid submitted count. Completion percentages and target-reached flags remain derived; no automatic zero reports or materialized analytics are created.

`APP_TIMEZONE` in application configuration and SQL `business_date` centralize their respective date boundaries for `Asia/Jerusalem`. Timestamps are `timestamptz` UTC instants; daily reports and target transitions use calendar `DATE`. SQL uses statement time and handles Jerusalem DST independently of the session timezone. No additional UUID extension is needed.

Auth deletion cascades to the profile. Trainee deletion cascades to reports, targets, and relationships. Coaches with assignments and target authors referenced by surviving history are RESTRICTed, preventing orphaned trainees or attribution loss. Invitations cascade when their inviter/coach is deleted. Profile roles/UUIDs are immutable in V1; conversions require a reviewed migration.

## RLS and privileged functions

RLS is enabled on every application table. Migration `20261001000500` adds these policies with limited operation/column grants:

- Profiles: own profile, assigned trainee profiles for coaches, all profiles for admins. No browser writes.
- Relationships: involved coach/trainee or admin reads. No browser writes.
- Steps: own trainee SELECT/INSERT and steps-only UPDATE; assigned coach/admin SELECT. No DELETE.
- Targets: own trainee SELECT, assigned coach SELECT/INSERT with `created_by = auth.uid()`, admin SELECT. No UPDATE/DELETE.
- Invitations: admin read; coaches read their own; trainees have no general access. Issuance/rotation/revocation use caller-bound RPCs. Migration `20261001000600` closes direct INSERT for authenticated/service-role clients and direct service-role UPDATE/DELETE, so quota and concurrency gates cannot be bypassed by normal table operations. Authenticated SELECT column grants exclude token hashes, including hash-based filters and `SELECT *`.

`private.current_role()` and `private.is_assigned_trainee(uuid)` are narrow caller-bound SECURITY DEFINER checks to avoid recursive profile/relationship policies. Only authenticated users can execute them; the private schema is not exposed by the Data API. They expose no arbitrary query or caller-selected identity capability.

The Auth Hook is SECURITY INVOKER with column-level SELECT grants and an active-invitation RLS policy solely for `supabase_auth_admin`; it needs no RLS bypass. Activation/compensation are service-only SECURITY DEFINER RPCs because they require trusted Auth access and atomic writes. The initial bootstrap remains operator-only SECURITY INVOKER. All functions have explicit empty search paths and no production dynamic SQL. Privileged RPC execution is revoked from PUBLIC/anon/authenticated as applicable. Never enable FORCE RLS on these owner-bound helper tables without reviewing function behavior.

## Migrations and checks

With a locally installed Supabase CLI and Docker:

```bash
npx supabase start
npx supabase db reset --local
```

Local reset destroys local data and replays versioned migrations. For hosted deployment:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push --dry-run
npx supabase db push
```

Do not reset production to deploy migrations. Generate database types from the applied schema as documented in `src/types/README.md`.

```bash
npm run lint
npm run typecheck
npm run format:check
npm run test:auth
npm run test:invitations
npm test
npm run build
```

After building, run `npm run start -- --port 3100` in one terminal and `npm run test:auth:http` in another for anonymous protected-route and auth-screen HTTP checks. These do not test hosted sessions or provider login.

Database suites run only on a disposable, migrated local database:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -X -v ON_ERROR_STOP=1 -f supabase/tests/integrity.sql
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -X -v ON_ERROR_STOP=1 -f supabase/tests/auth_rls.sql
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -X -v ON_ERROR_STOP=1 -f supabase/tests/invitations.sql
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -X -v ON_ERROR_STOP=1 -f supabase/tests/steps.sql
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -X -v ON_ERROR_STOP=1 -f supabase/tests/coach.sql
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -X -v ON_ERROR_STOP=1 -f supabase/tests/admin.sql
```

All six SQL suites (integrity, auth_rls, invitations, steps, coach, admin) roll back synthetic fixtures. Without Docker/Supabase, `postgres_harness.sql` supplies only the Auth columns, `auth.uid`, and API roles needed for an isolated plain-PostgreSQL test cluster. **Never apply the harness to Supabase/production.** Concurrent acceptance tests use `concurrency_fixture.sql`, two simultaneous psql sessions running `concurrency_accept_slow.sql` and `concurrency_accept.sql`, then `concurrency_verify.sql` to assert one membership and remove fixtures. One competing command must fail with `Invitation unavailable`; that is the expected test result.

This workspace verified real SQL/RLS on isolated PostgreSQL 17.10, not a hosted Supabase Auth service. Tests cover allowlist, expiry/acceptance, initial target constraints, mismatch, atomic rollback, duplicate/concurrent activation, safe compensation, and cross-role reads/writes. Node tests cover signed context tampering/expiry, route boundaries, and Zod validation. No real Google OAuth, SMTP recovery, GoTrue hook invocation, or hosted PostgREST integration was completed.

### Restricted Windows compiler workaround

This machine blocks native Next.js SWC. Development/build scripts use supported Webpack mode with a project-local matching WASM compiler. In PowerShell:

```powershell
$env:NEXT_TEST_WASM_DIR = (Resolve-Path node_modules/@next/swc-wasm-nodejs).Path
npm run typecheck
npm run build
npm run dev
```

This internal Next.js override is a machine-specific workaround and may change on upgrades. It is unnecessary on Vercel; normal machines use native SWC. Keep the WASM version aligned with Next.js.

## Initial admin and Before User Created Hook deployment

Function creation and Auth Hook activation are separate operations. Required production order:

1. Keep normal signups closed during initial setup. With the Hook not yet enabled, a trusted operator creates/invites the real `healthbuddyisrael@gmail.com` account through Supabase Auth Admin tooling. Never insert a fake `auth.users` row.
2. Verify the real account/email and obtain its Auth UUID.
3. As database `postgres`, call `private.bootstrap_initial_admin('<real-auth-uuid>'::uuid, '<real-display-name>')`.
4. Confirm `profiles.id` matches that Auth UUID and `profiles.role = 'admin'`.
5. In Supabase Dashboard → Authentication → Hooks, configure **Before User Created** as a PostgreSQL function: schema `private`, function `before_user_created(event jsonb)`. Save/enable it and test an uninvited email is rejected.
6. Enable normal Auth user creation/email signup with the Hook active; Google must be able to create invited identities. Anonymous signup remains disabled. There is no permanent primary-admin email exception in the Hook.

The migrations grant `supabase_auth_admin` private schema usage, Hook execution, and SELECT on only invitation email/role/accepted_at/revoked_at/expires_at. Its Auth-only RLS policy restricts rows to active invitations. PUBLIC, anon, authenticated, and service_role cannot execute the Hook. It returns `{}` for an allowed email and a 403 error object otherwise; it never consumes tokens or assigns roles. See [Supabase's Hook contract](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook).

Local `supabase/config.toml` has signup enabled **and the Hook enabled by default**. For initial local admin provisioning only, temporarily disable `auth.hook.before_user_created`, restart the local stack in an isolated setup, bootstrap the real admin, then restore/enable the Hook and restart. Never deploy an externally accessible signup-enabled configuration with the Hook disabled.

## Exact Google and Supabase configuration

In **Google Cloud Console**:

1. Create/select a project and configure Google Auth Platform/OAuth consent: app name, support email, permitted audience, and production consent/publishing status. Add test users while in testing mode.
2. Create an OAuth **Web application** client.
3. Add authorized JavaScript origins: `http://localhost:3000` for development and the exact production application origin, e.g. `https://<app-domain>`; add each intended staging origin explicitly.
4. Add authorized redirect URI **exactly as shown in Supabase's Google provider settings**, normally `https://<project-ref>.supabase.co/auth/v1/callback`. Use the corresponding custom Auth domain if configured. This Google redirect is **not** the application's `/auth/callback`. Separate Supabase projects need their own listed callback URIs.

In **Supabase Dashboard → Authentication → Sign In / Providers → Google**:

1. Enable Google, enter the Google OAuth client ID and secret, and keep email verification checks enabled. Do not enable options that skip provider email verification.
2. Under URL Configuration, set Site URL to the same canonical origin as `NEXT_PUBLIC_APP_URL`.
3. Allow exact application redirects: `http://localhost:3000/auth/callback`, `http://localhost:3000/auth/recovery`, and the equivalent production/staging URLs. Avoid broad production wildcards.
4. Keep email/password enabled and email verification enabled; set password minimum to 10. Ensure the Before User Created Hook is active before allowing ordinary new Auth users.

For local Google testing, configure `[auth.external.google]` with `enabled = true`, client ID, and `secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"`; supply the secret outside version control and use the exact local Supabase callback URI shown by local provider configuration (normally `http://localhost:54321/auth/v1/callback`). The local provider is not configured with real credentials in this repository. See [official Google setup](https://supabase.com/docs/guides/auth/social-login/auth-google).

## Password recovery email configuration

In Supabase Authentication → Email Templates → **Reset Password**, use the application confirmation route, with the redirect specified by `resetPasswordForEmail`:

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}">איפוס הסיסמה</a>
```

The configured redirect is `<APP_URL>/auth/recovery`. The application hardcodes `verifyOtp` type `recovery`; it never trusts a browser-selected OTP type. Configure trusted SMTP/sender credentials and appropriate Auth rate limits for production recovery delivery. Invitation emails use Gmail SMTP through the application. Supabase Auth recovery emails remain managed by Supabase Auth until custom SMTP is separately configured. Default implicit-fragment or code-only recovery links do not match this confirmation route: update the template before testing.

## Manual hosted integration checklist

1. Bootstrap and verify the initial admin in the order above.
2. Enable and verify the Before User Created Hook.
3. Configure Google consent/provider credentials.
4. Configure exact Google and application redirect URLs.
5. Create a trusted invitation fixture using a generated token/hash and valid actor/role; trainee fixtures must include the coach-defined positive initial target. Do not run synthetic Auth SQL fixtures on hosted systems.
6. Accept with email/password; confirm profile, assignment/target if trainee, acceptance, and normal session.
7. Create another valid invitation fixture.
8. Accept with Google; confirm the explicit completion POST and all membership rows.
9. Choose the wrong Google account; confirm mismatch rejection and no consumption.
10. Attempt uninvited new Google signup; confirm the Auth Hook prevents identity creation.
11. Test returning Google login without invitation context.
12. Test returning password login and logout.
13. Navigate directly to each wrong-role route and verify no protected content/data is delivered.
14. Test password recovery mail, explicit confirmation, reset, old-password failure, and expired/replayed recovery links.
15. Test existing Auth identities without profiles, existing members attempting another invitation, expired/accepted tokens, OAuth cancellation, and double submission.
16. Force activation failure for a newly created password identity and verify guarded compensation, managed Auth/session cleanup, and no partially provisioned application rows.

## Invitation management and lifecycle

Migration `20261001000600_invitation_management.sql` adds `revoked_at` and rejects simultaneous acceptance/revocation. Active means **unused, unrevoked, and unexpired** in the Auth Hook, application validation, acceptance RPC, and management operations. Status is derived: accepted → revoked → expired → pending; no status column is stored.

- Create → commit → send → accept.
- Send again → atomically revoke old row → create fresh token/hash and row → commit → send new email.
- Revoke → preserve row → immediately invalidate the old link.

Plaintext invitation tokens are never persisted in the database or an application delivery queue. They are generated in server memory, SHA-256 hashed, and passed only to transactional email delivery. The existing short-lived HttpOnly OAuth context cookie remains necessary during acceptance; no tokens/URLs are returned by management actions, stored in localStorage, or logged. The mail provider and recipient necessarily receive the link; configure provider retention and tracking appropriately.

`/admin/invitations`, linked from the admin overview, requires a bootstrapped admin profile and manages coach invitations. Admins may manage any coach invitation. `/coach/invitations`, linked from the coach dashboard, requires a coach profile and manages only that coach's trainee invitations; email and initial target are the only creation inputs. Responsive lists show 25 items/page with created/expiry dates, derived states, and target where relevant. Sending again needs no confirmation; revoke uses a keyboard-accessible inline confirmation. Expired rows cannot be resent; use the new-invitation form to issue a new seven-day link. Accepted/revoked rows show history without mutation controls.

Narrow authenticated SECURITY DEFINER RPCs (`create_coach_invitation`, `create_trainee_invitation`, `rotate_invitation`, `revoke_invitation`) derive role/actor/assignment from `auth.uid()` and the persisted profile. No RPC accepts browser-selected role, inviter, coach, or expiry. Execution is denied to PUBLIC, anon, service_role, and supabase_auth_admin. Private helpers have no caller EXECUTE grant. Direct invitation INSERT/UPDATE/DELETE is closed to normal clients, including service-role table mutations; activation retains its dedicated service-only RPC.

`private.invitation_limits()` is the central authoritative configuration: **168 hours** and **20 generated invitations per rolling hour per inviter**, including rotations and delivery failures. Email validity text is calculated from returned database timestamps. Change limits through a versioned migration. Transaction advisory locks serialize inviter quota accounting, then normalized email conflicts; there is no table-wide lock. Simultaneous same-row resends produce one success, one stale-operation failure, and one active replacement. Existing members and conflicting invitations are rejected without revealing another coach's details. Expired/revoked/accepted historical rows never impose global email uniqueness.

### Delivery and failure behavior

The database invitation is committed before transactional email delivery. If delivery fails, the invitation remains pending and a resend creates a fresh token. The Hebrew error explains this; the raw URL is never displayed as a fallback. The UI refreshes the list even on delivery failure. A crash between commit and send has the same pending/retry behavior; there is no plaintext-token outbox or automatic retry. SMTP acceptance is not proof of mailbox receipt; inspect the designated recipient inbox and Gmail bounce messages.

`src/lib/email/client.ts` is the server-only Nodemailer SMTP boundary. `send-invitation.ts` constructs the canonical URL and emits only safe IDs/result metadata. React Email renders the Hebrew HTML template (`html lang="he" dir="rtl"`); HTML/text alternatives contain a registration CTA and trainee target where appropriate. Each new row supplies a token-free delivery key mapped to a stable Message-ID for correlation. SMTP has no provider idempotency guarantee; the existing database lifecycle remains authoritative. Only the external transport is replaced in email tests; SQL authorization/concurrency and token semantics are exercised against PostgreSQL.

### Gmail SMTP V1 setup

See the [Gmail transport migration report](docs/GMAIL_SMTP_MIGRATION.md) for implementation scope, regression evidence and remaining real-delivery verification.

1. Enable **2-Step Verification** on `healthbuddyisrael@gmail.com`.
2. Create a [Google App Password](https://support.google.com/accounts/answer/185833) specifically for Health Buddy. App Password availability depends on Google account/security policy; never enable deprecated less-secure-app access or use the normal Gmail password.
3. Store it securely as `GMAIL_APP_PASSWORD` in the ignored local environment and production secret settings. Never commit `.env.local` or paste the password into logs/chat.
4. Set `GMAIL_USER=healthbuddyisrael@gmail.com` and `EMAIL_FROM=Health Buddy <healthbuddyisrael@gmail.com>`. Keep `NEXT_PUBLIC_APP_URL` as the correct local/canonical production origin. No Gmail variable uses a public prefix. `RESEND_API_KEY` is no longer used and should be removed from deployment settings.
5. The centralized transporter uses `smtp.gmail.com`, port **465**, `secure: true`, with normal certificate validation and SMTP debug logging disabled. Creation is lazy and reused per process; connection happens only during sending. Builds/typechecking do not connect or call `verify()`. See [Nodemailer SMTP configuration](https://nodemailer.com/smtp).
6. After explicitly approving one controlled recipient and one deliberate delivery, check mailbox receipt, Hebrew RTL rendering, target/expiry and correct CTA. No real mail is sent by automated tests. Send-again/revoke verification retains its existing token-rotation rules.

Gmail SMTP is the V1 transport and may later be replaced by a dedicated transactional provider without changing invitation-domain logic. Gmail account limits and security policies apply; database quotas remain enforced. No retry queue or provider-level delivery deduplication is claimed. A database commit followed by SMTP failure leaves a pending invitation, with safe Hebrew failure feedback and the existing send-again recovery action.

Invitation delivery does **not** configure Supabase Auth SMTP. Password recovery and Auth email templates must be configured/tested separately in hosted Supabase. No Google OAuth or Auth Hook changes are part of this transport switch.

No real Gmail App Password or approved test recipient was available for this implementation. **No actual email was sent or mailbox delivery verified.** The build checks use explicit process-local non-delivery placeholders; no placeholder App Password is saved in `.env.local`.

### Invitation test commands

`npm run test:invitations` tests Hebrew/RTL rendering, safe template content, deterministic provider success/failure, input validation, and derived states. `supabase/tests/invitations.sql` tests real database ownership/roles, members/duplicates/conflicts, rotation/revocation, hook/activation regressions, immutable terms, quotas, and safe projections; it rolls back fixtures.

For the real two-session concurrency test, use only a disposable **plain PostgreSQL harness** database named `healthbuddy_auth_*` with all migrations applied (never hosted Supabase). In PowerShell:

```powershell
$env:TEST_DATABASE_NAME = 'healthbuddy_auth_invitations'
$env:TEST_DATABASE_HOST = '127.0.0.1'
$env:TEST_DATABASE_PORT = '55439'
$env:TEST_PSQL_PATH = 'C:\Program Files\PostgreSQL\17\bin\psql.exe'
npm run test:invitations:db
```

The concurrency test creates/deletes synthetic harness users, races actual issuance and rotation, checks one active hash, and asserts raw tokens never appear in database rows or RPC output. Credentials use local PostgreSQL tooling, not mocked authorization. Existing unit/HTTP/SQL auth suites remain required; hosted password/Google/logout/recovery regression verification remains the manual checklist above.

## Vercel and sensitive URL handling

Deploy as a Next.js project with Node.js 24 and environment variables for each environment. Public variables must be set before building. Private credentials/context secrets must never use `NEXT_PUBLIC_` names. Invitation/email/recovery routes set no-referrer/noindex headers and use private session rendering. Application diagnostics log operation names, sanitized codes, and opaque user UUIDs—not credentials, provider payloads, invitation tokens, or hashes. Next.js incoming-request logging is disabled because secret-bearing URLs would otherwise appear in development logs.

Before hosted release, configure platform/reverse-proxy/access-log retention or redaction to exclude invitation token paths and recovery query strings, and exclude these routes from any future analytics. The repository cannot control external hosting logs. No analytics integration exists here. Gmail SMTP invitation sending requires the App Password/sender configuration and the deliberate delivery test above.
