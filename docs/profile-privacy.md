# Profile column privacy prerequisite for native iOS

## Behavior

Authenticated profile table reads return only the existing member-card projection: id, display_name, avatar_emoji, avatar_url, bio, school, grad_year. Existing RLS still limits which rows are visible. Bio, school and graduation year remain intentionally group-visible as they were in the existing web member cards; do not put confidential planning answers in these fields.

Home/contact/location/planning settings, auth user ID, pairing codes and future columns are denied at the column privilege boundary. The migration removes both table-level SELECT and any independently granted column SELECT from PUBLIC, anon and authenticated before restoring the explicit projection. Limiting columns in application queries alone is not a privacy control.

`my_profile()` returns only the signed caller’s complete profile, has no identity input, explicitly enforces `has_required_mfa()`, fixes its search path, and denies anonymous/PUBLIC execution. It is suitable for native PostgREST RPC access. Own updates remain under existing own-row RLS and server-column triggers. Guardian private details continue through the existing trusted server flow and explicit relationship checks; a guardian JWT has no direct private-column privilege over the teen’s profile.

Avatar uploads update the private user_id-scoped row on the trusted server client; other existing roster SELECTs use only the allowed projection and need no rewrite.

## Validation

`src/tests/profile-privacy.test.ts` applies the real relevant initial-schema, profile/group RLS, pairing, profile guards, MFA and new privacy migrations in PGlite with dummy Supabase identity/schema/grant fixtures. It reproduces the previous disclosure before applying the new migration. 26 profile privacy cases plus 12 existing MFA cases passed locally on October 10, 2026, using one Vitest worker, no external network, an empty environment, capped runtime resources and disposable scratch writes. The full copied-source TypeScript check also passed with a bounded 1 GB heap (the initial 512 MB check exhausted its heap). This is focused coverage, not a complete hosted-schema audit.

Cases cover all listed private fields, wildcard and WHERE/ORDER probes, safe roster/embedded joins, outsider/anonymous denial, self writes, caller-only full RPC, guardian/service-role compatibility, native and email MFA, future-column default denial and migration reapplication.

## Rollout

1. Publish the avatar-writer change before or with this migration.
2. Apply `supabase/migrations/20261013000000_profile_column_privacy.sql` in staging; require the existing MFA migration first.
3. With ordinary test accounts, confirm member cards, own profile/avatar/settings, guardian Family Hub and full-profile RPC behavior. Check both authenticated grants and PUBLIC inheritance; no client may select private peer columns or wildcard profiles.
4. Apply in production only after staging checks. No hosted database, deployment or live user data was accessed in this work.

Native M0 may proceed with an offline skeleton. Live iOS access depends on deploying this prerequisite and the separately documented versioned iOS API endpoints. Applying a migration is not accomplished by pushing this branch.
