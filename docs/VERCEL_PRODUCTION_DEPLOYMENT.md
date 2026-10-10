# First Vercel production deployment

Verified on 2026-10-04.

- Team: HB (`hb-95c1`).
- Project: `health-buddy-israel`.
- Production origin: <https://health-buddy-israel.vercel.app>.
- Deployment: `dpl_3ae6Xp1h46ykrozu3QTZJyBYnF7e`, status `READY`.
- Hosted Supabase project: `jvfevkatchjmajrioxod`.
- Vercel used Node 24, `npm ci`, and the repository's `npm run build`.
- The Linux build succeeded without the local Windows WASM override.

## Environment

These variables are configured for Production only:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL
AUTH_CONTEXT_SECRET
ADMIN_EMAIL
GMAIL_USER
GMAIL_APP_PASSWORD
EMAIL_FROM
```

The production `NEXT_PUBLIC_APP_URL` matches the production origin above. It was
configured before the first build, so a corrective redeployment was unnecessary.
Local development retains its localhost origin. Server credentials are sensitive
Vercel variables. No Resend configuration or local WASM override was uploaded.
Local environment files, CLI metadata, database fixtures, and caches are excluded
from deployment. This workspace has no Git metadata; commit history could not be
audited. Linking uploads this directory; automatic Git deployments are not set up.

## Verification

- Public HTTPS routes `/`, `/login`, `/forgot-password`,
  `/invite/not-a-token`, and `/reset-password` returned 200 and Hebrew RTL markup.
- Fifteen referenced browser assets returned 200 and passed a comparison against
  locally available secret values.
- Four existing HTTP tests passed against production, including anonymous denial
  for all protected role routes, no public signup routes, safe invalid invitation
  and recovery states, and safe OAuth cancellation handling.
- Production responses included `nosniff`, frame denial, Referrer Policy,
  Permissions Policy, and HSTS. No redirect loops were observed.
- All 62 application tests passed. Local lint, typecheck, format check, build,
  and the current source/server/browser secret scan passed.
- `npm audit --omit=dev` reported no vulnerabilities. Full audit reported five
  high findings in the development ESLint dependency chain, rooted in `braces`;
  no automated breaking dependency changes were applied.

These checks used HTTP requests, not a rendered browser or physical device.
Authenticated production login, Gmail delivery from Vercel, password recovery
delivery, and real Google OAuth have not been tested on this deployment.

## Next controlled step

The stable HTTPS origin is now available for Google production configuration.
Google Console origins and Supabase Site URL/redirect allowlists were not changed
during deployment. Configure those using the existing callback flow, then perform
real OAuth tests before inviting real coaches or trainees. No database migrations,
Auth users, hook configuration, or application business logic changed here.

This successful deployment is not a declaration that the full production release
gate has passed.
