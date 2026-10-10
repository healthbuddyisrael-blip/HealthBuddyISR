# Google OAuth configuration preflight

Inspected on 2026-10-04 for Supabase project `jvfevkatchjmajrioxod`.

This is a configuration preflight, not successful Google OAuth verification. The operator confirmed the application is not deployed and explicitly deferred final production Google origins/redirects until a Vercel HTTPS deployment exists. The operator subsequently configured the hosted Google provider; this task made no hosted configuration changes.

## Existing application flow

`googleLogin` in `src/app/auth/actions.ts` uses the authenticated-cookie Supabase SSR client and sends `redirectTo = NEXT_PUBLIC_APP_URL + /auth/callback`, with Google's account-selection prompt.

Current configured application callback: `http://localhost:3000/auth/callback`.

The operator supplied `https://jvfevkatchjmajrioxod.supabase.co/auth/v1/callback` as the hosted Supabase Google provider callback. A real hosted PKCE authorization-initiation request then returned HTTP 302 to Google with exactly that `redirect_uri` and the configured client ID. OAuth state was not logged or saved; no Google sign-in or user creation occurred. This verifies the provider callback without guessing it from the project reference.

`src/app/auth/callback/route.ts` exchanges the PKCE code, verifies the Auth identity and email, validates signed invitation context, rejects account mismatch, and routes existing members by their persisted profile role. Invitation completion requires a separate validated POST; the callback GET does not assign roles or create membership. No flow changes were made.

## Read-back hosted configuration

| Setting                         | Observed value                                        |
| ------------------------------- | ----------------------------------------------------- |
| Google enabled                  | Yes                                                   |
| Google client ID configured     | Yes                                                   |
| Google client secret configured | Yes                                                   |
| Site URL                        | `http://localhost:3000`                               |
| Redirect allowlist              | Empty                                                 |
| Before User Created Hook        | Enabled                                               |
| Hook URI                        | `pg-functions://postgres/private/before_user_created` |
| Ordinary new-user creation      | Enabled (`disable_signup=false`)                      |

No Google credentials were available through the checked secure local environment variables. No deployment origin has been provided. No hosted configuration was changed during this preflight.

## Inputs required to continue

1. Actual deployed HTTPS application origin. Localhost is not a production origin.
2. The exact hosted provider callback has now been supplied and verified: `https://jvfevkatchjmajrioxod.supabase.co/auth/v1/callback`.
3. Google client credentials are now configured in hosted Supabase. Google Console client type, authorized origins, and redirect registration still require verification. No local copy of the Client Secret is needed for the application's runtime.
4. User-controlled Google browser sign-in for the real admin, invited new account, uninvited new account, and wrong-account cases. Gmail aliases are not distinct Google identities and cannot replace these tests.

Google authorized JavaScript origins must match the actual application origins. Google's authorized redirect URI is the exact hosted Supabase provider callback, while the Supabase redirect allowlist must contain the application's exact `/auth/callback` URL. Preserve intentional recovery redirects and avoid arbitrary URL/wildcard expansion.

Follow the current official [Supabase Google provider instructions](https://supabase.com/docs/guides/auth/social-login/auth-google) and [Google Web server OAuth instructions](https://developers.google.com/identity/protocols/oauth2/web-server). Keep provider email-verification checks enabled and do not change the invitation Hook or RLS to make OAuth work.

## Prepared production configuration

Let `PRODUCTION_ORIGIN` mean the actual canonical HTTPS origin obtained from the production Vercel deployment/domain, without a trailing path. It is a documentation placeholder, not a new environment variable or a selected hostname.

| Location                                | Required value after deployment                             |
| --------------------------------------- | ----------------------------------------------------------- |
| Vercel Production `NEXT_PUBLIC_APP_URL` | `PRODUCTION_ORIGIN`                                         |
| Google OAuth client type                | Web application                                             |
| Google authorized JavaScript origin     | `PRODUCTION_ORIGIN`                                         |
| Google authorized redirect URI          | `https://jvfevkatchjmajrioxod.supabase.co/auth/v1/callback` |
| Supabase Site URL                       | `PRODUCTION_ORIGIN`                                         |
| Supabase allowed OAuth redirect         | `PRODUCTION_ORIGIN/auth/callback`                           |
| Supabase allowed recovery redirect      | `PRODUCTION_ORIGIN/auth/recovery`                           |

The application route `/auth/callback` receives the Supabase PKCE authorization code and exchanges it server-side. `/invite/complete` is the subsequent matching-invitation completion page, not Google's authorized redirect URI. Existing-member destinations remain `/admin`, `/coach`, and `/app`, determined by persisted role.

The recovery request constructs `/auth/recovery`; the separate `/reset-password` page requires established recovery proof. Do not register `/reset-password` as a replacement for the existing recovery callback.

Configure Google consent branding/audience and only the required OpenID/profile/email scopes. Include controlled test accounts if the Google app is in Testing mode; confirm publishing/audience configuration is appropriate before production rollout. Preserve provider email verification and the enabled invitation Hook.

Do not add every preview hostname or wildcard production redirects. Preview/local environments should be allowed only intentionally. `http://localhost:3000` may be added for local testing only after verifying that the Google Web client's origins and hosted Supabase's exact redirect allowlist explicitly support it. Neither localhost OAuth support nor a production hostname was configured in this task.

Deployment comes next; once the production origin is known, verify the Google Console Web client configuration, apply the exact origin/redirect settings, and perform real Google sign-ins. The hosted provider credentials and exact Supabase callback are already configured/verified, respectively. No Google client credentials are required in the application's browser or normal Next.js runtime environment.

## Verification completed and remaining

- Four auth unit tests passed.
- Four public/anonymous HTTP tests passed, including safe OAuth-error redirection and no public signup UI/routes.
- Existing SSR/PKCE callback and invitation authorization were inspected.
- Production build and browser/server credential scan passed with the current configuration.
- Actual Google admin login, invited registration, uninvited rejection, wrong-account rejection, returning-member login, provider cancellation, identity linking, and duplicate-user behavior remain **untested**.
- HTTP callback-error handling was tested; that is not a real Google cancellation test.

It is not yet verified safe to proceed to full coach/trainee hosted E2E through Google. Resume configuration after the missing inputs and real browser sign-ins are available. Do not treat the earlier non-Google Hook tests as Google-flow evidence.
