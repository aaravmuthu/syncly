# Syncly security audit + fixes: 2026-09-28

This log covers one session: a read-only 20-item security audit, then the fixes the user approved in three batches: 1+2 (approvals and plan state), 3+4 (dependencies and AI limits), and the low-severity cleanup.
No secret values appear in this file.

## Timeline

| Step | What | Result |
|---|---|---|
| 1 | Read-only audit. The live DB was checked with `supabase db query --linked` and the live site with `curl`. | 11 FAIL, 8 PASS, 1 N/A (see table below) |
| 2 | User approved **"do 1 and 2"** | — |
| 3 | Code + two migrations on branch `security/approval-and-plan-writes` | commit `7da5c61`, **PR #4** |
| 4 | Checks: `tsc` clean, eslint clean on changed files, prod build served under `wrangler dev`, and `/`, `/plans`, `/guardian`, `/approve/*` all returned 200 | pass |
| 5 | Applied migration `20260928000000` (part 1) to prod in one transaction and recorded it with `migration repair` | applied |
| 6 | User merged PR #4. The first `gh pr merge` ran outside the repo and failed; the retry used `--repo` and succeeded. | merged `7669ddf` |
| 7 | User published in Lovable, then applied migration `20260928000100` (part 2) to prod and recorded it | applied |
| 8 | Post-apply check found a regression (see below). Fix migration `20260928000200` applied and recorded. | applied |
| 9 | Fix committed on branch `fix/approval-decided-via-grant`, **PR #5**, merged | merged `e0478e0` |
| 10 | This log committed, **PR #6** | merged `aab6188` |
| 11 | User approved **"do 3 and 4"** (dependencies, rate limits). Branch `security/deps-and-ai-limits`, **PR #7** | commit `8c07baa` |
| 12 | Quota SQL dry-run against prod inside a rolled-back transaction, then migration `20260928000300` applied and recorded | applied |
| 13 | User merged PR #7 | merged `db3f157` |
| 14 | User approved **"do the low cleanup and update the log"**. Branch `security/low-cleanup`, **PR #8** | open |

The unrelated WIP in `src/routes/demo.tsx` was left uncommitted and untouched throughout.

## Audit results

| # | Item | Status | Severity | Now |
|---|---|---|---|---|
| 1 | Hide API keys | PASS | — | |
| 2 | Env variables | FAIL | Low | **fixed** (PR #8) |
| 3 | Keys in git | PASS | — | nothing needs rotating |
| 4 | Admin routes | PASS | — | |
| 5 | Auth on endpoints | FAIL | Low | **fixed** (PR #7, #8) |
| 6 | User permissions (IDOR) | FAIL | High | **fixed** |
| 7 | Input validation | PASS | — | |
| 8 | XSS | PASS | — | |
| 9 | SQL injection | PASS | — | |
| 10 | DB rules (RLS) | FAIL | High | **fixed** |
| 11 | Rate limiting | FAIL | Medium | AI capped (PR #7); Auth CAPTCHA is a dashboard step |
| 12 | Spend cap | FAIL | Medium | per-user AI cap (PR #7); provider caps are dashboard steps |
| 13 | File uploads | PASS | — | |
| 14 | CSRF | PASS | — | |
| 15 | CORS | PASS | — | |
| 16 | HTTPS | PASS | — | |
| 17 | Security headers | FAIL | Low | **fixed** (PR #8) |
| 18 | Cookies | N/A | — | session is in localStorage |
| 19 | Debug mode | FAIL | Low | **fixed** (PR #8) |
| 20 | Prod settings | FAIL | Medium | deps fixed (PR #7); dev/prod split open |

### Findings

- **High: parent-approval forgery (items 6/10).**
  - A teen could insert their own `parent_approvals` row with `status='approved'` straight through Supabase REST, because the INSERT policy only checked `profile_id = me` and the `status` column was granted.
  - The approval link was also handed to the teen (`plans.$planId.tsx:197`), so they could open it and approve their own request.
  - The guardian hub would then show the plan as approved.
- **Medium: plan tampering.** The `plans_update_member` policy let any group member change `created_by`, `status` and `selected_recommendation_id`. That allowed an ownership takeover or skipping the vote.
- **Low (fixed together with 2):**
  - `plan_participants` INSERT let a member add any profile to a plan.
  - Users could write `sync_code`, `sync_code_expires_at` and `is_demo` on their own profile.
- **Medium, open:**
  - There are no per-user AI or rate limits and no spend cap. Cost is bounded only by the Gemini free tier plus a backup key.
  - `bun audit` found 18 vulnerabilities: 6 high (`fast-uri` via the MCP SDK and `ajv`, `js-yaml`, `nanoid`), 10 moderate and 2 low.
  - Local dev and prod share one Supabase project.
- **Low, open:**
  - `geocodeZip`, `suggestPlaces` and `reverseZip` (`location.functions.ts`) need no login.
  - The template `getGreeting` function is still exposed.
  - `frame-ancestors` allows `*.lovable.app`; there's no `X-Frame-Options`.
  - Permissions-Policy doesn't restrict geolocation or the microphone.
  - 56 `throw new Error(error.message)` calls send raw DB errors to the client.
  - There's no `.env.example`, and no `.env*` rule in `.gitignore`.
  - `OPTIONS /_serverFn` returns 500.
- **Passed:**
  - Git history only ever held publishable or anon keys.
  - All 34 tables have RLS enabled.
  - The client bundle has no secrets or source maps.
  - HSTS, the nonce CSP and nosniff are live.
  - The avatars bucket is private and type-limited.
  - Every input goes through zod validators.

## Fix 1: parent approvals

- **Server-only writes.** User roles have no INSERT, UPDATE or DELETE on `parent_approvals`, and the `parent_approvals_insert_own` policy was dropped. All writes go through `supabaseAdmin`.
- **New `decided_via` column** (`'guardian' | 'link'`):
  - `decideApproval` (in the guardian hub) sets `guardian`.
  - `respondToApproval` and `parentRespondToPlan` (from a link) set `link`.
  - A link can't overwrite a decision the guardian already made.
- **UI.** The plan page and the hub show "· via link". A link-decided approval stays in the hub's "Waiting on you" with a note until the guardian confirms or changes it.
- **Routing.** "Ask a parent" (formerly "Create approval link") sends the request to a linked guardian's hub, and the teen gets no link. A link is returned only when no guardian is linked.
- **Expiry cap.** New constraint `parent_approvals_expiry_max`: `expires_at <= created_at + 15 days`. The server issues 7- and 14-day links; the extra day absorbs clock skew.

## Fix 2: plan state

- **Host-only updates.** `plans_update_member` was replaced by `plans_update_host` (`created_by = my_profile_id()`).
- **Server-managed columns.** Trigger `plans_guard_server_columns` rejects changes from `anon` or `authenticated` to `created_by`, `group_id`, `status`, `selected_recommendation_id` and `compatibility_score`. On insert, status must be `draft` or `collecting` and the other two must be null.
- **Server writes.** Finalize (`plan.functions.ts`), the resolution vote (`conflict.functions.ts`), the switches to voting (`spots.functions.ts`, `planner.functions.ts`) and the AI compromise (`ai.functions.ts`) now write through `supabaseAdmin` after their existing checks. They also verify that the recommendation belongs to the plan.
- **Participants.** `plan_participants_insert_self_or_host` lets a member add only themselves; the host can add anyone.
- **Profiles.** Trigger `profiles_guard_server_columns` makes `sync_code`, `sync_code_expires_at` and `is_demo` server-only.
- **Still allowed.** Any member can still finalize through the app, because every member sees "Lock this in". Only direct REST tampering is blocked.
- **Why triggers.** Triggers were chosen over column grants on `plans` and `profiles` so that new columns don't need grant updates.

## Fix 3: dependencies (PR #7)

- `overrides` in `package.json`: `fast-uri ^3.1.6`, `hono ^4.12.34`, `js-yaml ^4.3.2`, `nanoid ^3.3.18`, `qs ^6.16.0`. All stay on their current major versions. `vitest` went to `^4.1.11`.
- `bun audit`: **18 → 1**. The one left is low: esbuild's Windows-only dev-server file read. That esbuild is pinned inside `@lovable.dev/mcp-js`, so forcing a newer one could break it.

## Fix 4: AI limits (PR #7)

- **Counter.** An `ai_usage` table (RLS on, no user grants) holds one row per user per UTC day with a per-feature breakdown. The `take_ai_call(user, feature, limit)` security-definer RPC increments it with one atomic upsert and can be run by service_role only.
- **Check.** `assertAiQuota(userId, feature)` in `src/lib/ai-quota.server.ts` runs right before each of the 11 model calls. The Plan B pitch is charged only when one is actually written.
- **Limit.** 100 calls per day. Past that, the user sees "You've hit today's AI limit. It resets at midnight UTC." in the existing toasts.
- **Fails open.** If the counter errors, the call is logged and allowed. It's abuse protection, not access control.
- **Location lookups.** `geocodeZip`, `suggestPlaces` and `reverseZip` now require sign-in. Every caller is under `_authenticated/`.
- **Dry run.** The SQL was run against prod inside a transaction that was rolled back. With a limit of 2 it returned `true, true, false` and `calls=3`, and nothing was left behind.

## Low cleanup (PR #8)

- **Raw DB errors.** A new `src/lib/db-error.ts` has `dbError(error, where, message?)`. It logs `[db:<function>] <code> <message>` on the server and returns a plain error:
  - `23505` becomes "That already exists.";
  - `42501` becomes "You don't have permission to do that.";
  - everything else becomes "Something went wrong. Please try again.";
  - storage upload failures say "Couldn't upload that file. Use an image or recording under 8 MB."
  The audit counted 56 sites; the full sweep found **74** across `src/lib`, including 6 MCP tools and the plan-lifecycle sweep. Before rewriting, I checked that no UI code matches on DB error text and that the only messages the database raises on purpose come from the guard triggers. The two client-side route files that show Supabase Auth errors were left alone: those messages come from the Auth API, not the database.
- **Template function.** `src/lib/api/example.functions.ts` (`getGreeting`, which exposed `NODE_ENV`) was deleted. Nothing imported it.
- **Env files.** Added `.env.example`, listing variable names only. `.gitignore` now ignores `.env.*` except `.env.example`. The committed `.env`, which holds publishable values only, is unaffected.
- **Framing.** `https://*.lovable.app` was removed from `frame-ancestors` (`src/lib/csp.ts`), since anyone's published Lovable app lives there. `lovable.dev`, `*.lovable.dev` and `*.lovableproject.com` stay, so the editor preview keeps working.
- **Headers** (`src/server.ts`):
  - `X-Frame-Options: SAMEORIGIN`, a legacy fallback that CSP-aware browsers ignore;
  - Permissions-Policy adds `geolocation=(self), microphone=(self)`.
- **Preflights.** `OPTIONS /_serverFn/*` now returns `405` with `Allow: GET, POST`. TanStack's handler used to throw a 500 on it.
- **Checks.** `tsc` and eslint are clean. The prod build ran under wrangler: the pages returned 200, the new headers were present, and OPTIONS returned 405.

## Migrations (all applied to prod and recorded)

| File | Contents | When applied |
|---|---|---|
| `20260928000000_approval_source_and_profile_guards.sql` | `decided_via`, the expiry constraint, the profiles trigger, the participants policy | before publish: additive and safe with the old code |
| `20260928000100_server_only_approvals_and_plan_state.sql` | revoke approval writes, host-only plan update, the plans trigger | after publish, since it breaks the old code |
| `20260928000200_grant_decided_via_select.sql` | `grant select (decided_via) on parent_approvals to authenticated` | regression fix |
| `20260928000300_ai_usage_quota.sql` | the `ai_usage` table and the `take_ai_call` RPC | before the PR #7 publish; it's additive |

Each file was applied with `supabase db query --linked -f` (all except `000200` were wrapped in `begin`/`commit`) and then recorded with `supabase migration repair --status applied <version> --linked`.
`types.ts` got `decided_via` and `take_ai_call` by hand; freshly generated copies matched both.

## Regression found and fixed

- **Cause.** Signed-in users read `parent_approvals` through a column-level SELECT grant that leaves out `token`. The new `decided_via` column wasn't on it.
- **Effect.** After PR #4 was published, `getPlan`'s approvals query failed with `42501 permission denied`. The error was swallowed, so the plan page showed an empty approval list; nothing crashed. The guardian hub was unaffected because it reads with the admin client.
- **Fix.** Migration `20260928000200`. Verified as `authenticated`: `id, decided_via` can be read, and `token` is still denied.
- **Lesson.** When adding a column to a table with column-level grants, grant the column explicitly.

## Verification not done

- The approval flow was not exercised end to end with a real teen and guardian account. The DB rules were checked by querying as the `authenticated` role.
- The AI limit was not hit through the real UI, and the address pickers weren't clicked while signed in.
- The friendlier error messages weren't triggered through the UI.
- The Lovable editor preview hasn't been checked since `*.lovable.app` was dropped from `frame-ancestors`. **Check it after publishing PR #8.** If the preview refuses to load, add that host back in `src/lib/csp.ts`.

## Still open

1. **Dev/prod split** (Medium). This needs a second Supabase project for local dev, which is a dashboard step for the user. Then point `.env.local` at it.
2. **Dashboard settings** (user):
   - Supabase Auth CAPTCHA (Turnstile) and a review of the Auth rate limits;
   - a Google Cloud budget alert or cap;
   - URL-restrict the Mapbox token to syncly.website;
   - a Geoapify usage cap.
3. **esbuild low advisory.** It clears when `@lovable.dev/mcp-js` updates its esbuild.
