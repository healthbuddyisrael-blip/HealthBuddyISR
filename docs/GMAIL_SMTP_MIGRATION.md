# Gmail SMTP transport — 2026-10-04

## Architecture and scope

Invitation actions still call `sendInvitation` in the server-only
`src/lib/email/send-invitation.ts`. It constructs the canonical token URL and
uses the existing `deliverInvitation` rendering/result abstraction. Only
`src/lib/email/client.ts` changed provider implementation, from Resend to
Nodemailer/Gmail. Hebrew RTL React Email templates and text fallback are unchanged.

The central transporter is created lazily on first send and reused per process:
`smtp.gmail.com`, port 465, `secure: true`, normal certificate validation,
bounded connection/socket timeouts, no debug/logger output, and file/URL content
access disabled. No SMTP connection or `verify()` call occurs during imports,
typechecking, builds or application startup. No public SMTP endpoint was added.

Sender comes exclusively from `EMAIL_FROM`; the recipient remains the trusted
invitation summary. Browser input cannot choose sender, subject or HTML structure.
Recipients rejected by SMTP, a mismatched accepted recipient, or thrown SMTP
errors map to the existing safe Hebrew delivery-failure result. Error payloads
are discarded; logs contain invitation/inviter IDs, role, success and safe
Message-ID, not auth options, raw tokens, bodies or URLs.

The database commit still precedes delivery. Failure leaves the invitation
pending. Sending again still revokes the old invitation and creates a new
row/token before delivery; quotas, expiry, revoke and acceptance remain unchanged.
SMTP lacks Resend's API idempotency guarantee. The existing token-free delivery
key now yields a stable Message-ID for correlation, not a claimed SMTP deduplication
guarantee. No automatic retries/outbox or extra delivery state were added.

## Configuration

Required server-only settings are now `GMAIL_USER`, `GMAIL_APP_PASSWORD`, and
`EMAIL_FROM`. For V1:

```text
GMAIL_USER=healthbuddyisrael@gmail.com
EMAIL_FROM=Health Buddy <healthbuddyisrael@gmail.com>
```

Enable 2-Step Verification, create a dedicated Google App Password for Health
Buddy, and supply it securely as `GMAIL_APP_PASSWORD`. Never use the normal
account password. Copied spacing is normalized; validation reports field names
and constraints without echoing values. `.env.example` contains empty values only.
See the current README setup instructions and linked official Google/Nodemailer
documentation. Restart/redeploy after changing credentials.

`RESEND_API_KEY` is no longer read or required. Resend's package and imports were
removed; `nodemailer` and development types were installed and the lockfile
updated. Historical verification snapshots retain obsolete provider references,
explicitly marked as historical. Current application instructions use Gmail SMTP.

The ignored `.env.local` has the V1 user/sender configured, but no real App
Password. A non-delivery placeholder was supplied only in process memory for
build/start checks. It was not written to the local environment file.

Invitation emails use Gmail SMTP through the application. **Supabase Auth recovery
emails remain managed by Supabase Auth until custom SMTP is separately configured.**
Recovery code/templates/session proof, Auth Hook, Google OAuth and Supabase users
were not modified or configured by this change.

## Verification

- Eight new SMTP-boundary tests exercise the real domain rendering and server
  wrapper: lazy initialization/no verify, correct coach subject/from/recipient,
  trainee target/text/RTL, transporter reuse, rejected/partially rejected/wrong
  recipients, sanitized thrown credential/body errors, and Gmail env validation.
  Only Nodemailer's external transport is mocked. A test-only empty `server-only`
  marker permits Node execution outside Next's compiler; production retains its
  server-only boundary. Authorization/token/DB lifecycle tests are not replaced
  with mocks.
- `npm test`: 62 passing auth, invitation, email, trainee, coach, admin, rendering
  and release cases. Four local anonymous HTTP tests passed against the built app.
- Fresh loopback-only PostgreSQL replay: all nine migrations, six SQL suites and
  three real two-session concurrency scenarios passed. These include resend
  rotation/revoke/activation regressions. No fixture tests targeted hosted Supabase.
- `npm run lint`, `npm run typecheck`, `npm run format:check` and `npm run build`
  passed using the documented Windows compiler override and process-local email
  placeholder. Builds did not attempt Gmail delivery.
- Browser credential scan passed with actual available server secrets compared;
  it checks normalized Gmail passwords when present and rejects SMTP markers in
  client assets. No real App Password was available to compare. Git history remains
  unavailable in this workspace.
- Runtime dependency audit: zero vulnerabilities. Existing five high development
  lint-chain findings remain; no automated major-version fixes were applied.

**Zero database migrations were added.** Existing migration files, hosted schema,
RLS, invitation action logic, templates and authentication semantics are unchanged.
No admin bootstrap or hosted-user modification was performed.

**Real Gmail delivery was not tested and no mail was sent.** A real App Password,
explicitly approved recipient controlled by the user and confirmation for one
deliberate test are still required. SMTP acceptance alone will not establish inbox
receipt; inspect Hebrew direction, sender and CTA in the received message.

### Subsequent controlled SMTP test

After the user securely configured the App Password and approved
`healthbuddyisrael@gmail.com` as recipient, one clearly labeled Hebrew RTL
diagnostic email was sent through the actual server-only Gmail transport.
Gmail SMTP accepted it. Mailbox receipt and email-client rendering remain awaiting
user confirmation. No invitation, Auth user or database record was created.
The diagnostic CTA explicitly points to the configured local application; it does
not verify a production domain or invitation-acceptance link. An ignored local
attempt record prevents an automatic repeat of this one-email diagnostic.

Application verification can continue toward the next controlled bootstrap step
once real local/production Gmail configuration is supplied. Admin bootstrap remains
a separately authorized step, and hosted Auth/provider/recovery/Vercel workflows
remain release gates. This transport change is not a production release approval.

## Files changed

- `src/lib/email/client.ts`, `src/lib/email/send-invitation.ts`
- `src/lib/env/schema.ts`, `src/lib/env/server.ts`, `.env.example`
- `package.json`, `package-lock.json`
- `tests/email.test.mts`, `tests/release.test.mts`, `tests/release-secret-scan.mts`
- `README.md`, historical notices in `docs/PRODUCTION_RELEASE_GATE.md` and
  `docs/HOSTED_SUPABASE_SETUP.md`, this report
- Local ignored `.env.local`: non-secret Gmail user/sender configuration only
