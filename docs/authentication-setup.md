# Phone sign-up and two-factor authentication

Apply `supabase/migrations/20261009010000_require_verified_mfa.sql` before deploying the application. Authentication fails closed if the migration's security RPC is absent. Test the migration in staging with regular, guardian, link-based and service-role workflows before production. Add the restrictive MFA policy to any new protected tables.

## Provider configuration

In the hosted Supabase dashboard:

1. Enable the Phone authentication provider and phone confirmation. Configure an SMS provider such as Twilio with server-side credentials. Keep phone confirmation enabled so phone/password sign-up proves ownership.
2. Enable Phone MFA enrollment and verification. This may require a paid Supabase plan. Configure SMS rate limits and provider spending limits.
3. For optional email-code sign-in, include `{{ .Token }}` in the Magic Link email template. Keep confirmation and password recovery templates intact. Configure production SMTP; a template containing only a link will not supply the code expected by the UI.
4. Keep `/auth-callback` and `/auth?mode=update` in the project's allowed redirect URLs.

For email **second-factor** codes, set these server-only environment variables:

- `RESEND_API_KEY`: a Resend sending key.
- `AUTH_EMAIL_FROM`: a sender address on a verified Resend domain, such as `Syncly <security@your-domain.example>`.
- `AUTH_OTP_SECRET`: a cryptographically random secret with at least 32 bytes. Rotating it invalidates pending codes.
- The app's existing `SUPABASE_SERVICE_ROLE_KEY` / `SB_SERVICE_ROLE_KEY` configuration must also be present.

Never prefix these values with `VITE_` or expose them to the browser. Resend email verification and Supabase's email-code sign-in use separate delivery paths.

## User flows and enforcement

Account & privacy → Two-factor authentication offers separate email and SMS setup. Each method becomes enabled only after verifying a setup code. Phone-only users can add and confirm a recovery email here before enrolling email verification. Enabling both methods requires both after sign-in.

SMS uses Supabase native MFA and AAL2. Email MFA uses a server-generated six-digit code delivered only to the account's confirmed email. Its HMAC digest is bound to the authenticated user, signed session ID, unique challenge and operation. Verification runs atomically in PostgreSQL, expires after ten minutes, consumes a code once and stops after five wrong attempts. Sends are limited across sessions to one per minute and ten per hour. Email verification lasts twelve hours for the same session; a new session requires a new code.

Email OTP sign-in cannot also count as an independent email second factor. Accounts with email MFA enabled must start with their password or Google sign-in. The server enforces this distinction, including when the UI is bypassed. Email MFA does not claim to produce Supabase AAL2: the shared `has_required_mfa()` gate independently checks native MFA and email session verification. It gates RLS table and Storage access, and server functions before service-role operations. The challenge/status endpoints alone accept a first-factor session; their service-only SQL operations accept identity/session IDs from signed server context, never from request input. Private data remains inaccessible until every enabled factor is satisfied.

Supabase Auth's credential management API remains managed by Supabase; the custom email gate protects Syncly data and application server operations. Password recovery uses Supabase's ownership checks. Phone users receive an SMS recovery code, then choose a new password and sign in again to complete enabled second factors. Users with native MFA must also pass that challenge before updating their password. Keep an operator-assisted procedure for lost second factors; there is no client bypass or downloadable recovery-code system in this change.

## Staging checks

- Phone sign-up: verify SMS; sign out; sign in with phone/password. Recover a forgotten phone password through SMS and sign in again.
- Email/password, Google, email-code sign-in and email password recovery still work. Wrong and expired codes fail.
- Enroll each factor independently and together. Cancel incomplete setup. Verify email removal requires a fresh email code and a fully verified session.
- Attempt email OTP sign-in on an email-MFA account: it must require password or Google before second-factor delivery.
- With an unverified enrolled account's token, call a protected server function, query private tables and request private Storage data: all must be denied. Verify access only after every enabled factor succeeds.
- Call service-only email RPCs or query email security tables as authenticated/anonymous users: access must be denied. Replay, switch sessions, change operation, exceed attempts, expire codes and race resend requests: verification must fail or rate-limit.
- Change an account email: old email verification must stop granting access. A new confirmed address and code are required.
- Check provider failures, resend timers, mobile keyboard, keyboard navigation and reduced motion.
- Cookie choices: accept/reject/custom, reload, reopen settings, malformed/expired preferences and blocked storage.

Live delivery and SQL policy/transaction behavior require a configured staging Supabase database and provider credentials; unit tests and the build cannot verify those services.

## Cookie preferences

No optional analytics or advertising integration is currently installed. Essential auth/theme/consent storage works independently of optional consent. Future optional integrations must check `hasCookieConsent('analytics' | 'marketing')` before loading and listen for `syncly:cookie-consent` to apply revocation. Choices are versioned and expire after 180 days.

## Automated verification

Run `bun run test:auth` after installing dependencies. The isolated PostgreSQL tests apply the real migration in PGlite with minimal Supabase claim/schema fixtures; they cover RLS, native/email factor combinations, privileged RPC access, session and email binding, attempt exhaustion, expiry, single use and resend limits. They do not send messages or change a hosted database. The regular `bun run test` suite also includes these tests.

Codes use a six-box field (`CodeInput`) that submits on the last digit. While the server checks, the boxes merge into a disc with a progress ring. Acceptance plays only after server verification succeeds: the ring closes into a checkmark badge, the rest of the form fades and becomes inert, then the step lifts away. A rejected code shakes, flushes red and clears right to left. Reduced motion keeps opacity changes only. Failed continuation can be retried without submitting the consumed code again.
