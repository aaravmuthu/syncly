# Syncly security audit + fixes: 2026-09-28

This log covers one session: a read-only 20-item security audit, followed by fixes 1 and 2, which the user approved.
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

Local `main` is synced to `e0478e0`. The unrelated WIP in `src/routes/demo.tsx` was left uncommitted and untouched.

## Audit results

| # | Item | Status | Severity | Now |
|---|---|---|---|---|
| 1 | Hide API keys | PASS | — | |
| 2 | Env variables | FAIL | Low | open |
| 3 | Keys in git | PASS | — | nothing needs rotating |
| 4 | Admin routes | PASS | — | |
| 5 | Auth on endpoints | FAIL | Low | open |
| 6 | User permissions (IDOR) | FAIL | High | **fixed** |
| 7 | Input validation | PASS | — | |
| 8 | XSS | PASS | — | |
| 9 | SQL injection | PASS | — | |
| 10 | DB rules (RLS) | FAIL | High | **fixed** |
| 11 | Rate limiting | FAIL | Medium | open |
| 12 | Spend cap | FAIL | Medium | open |
| 13 | File uploads | PASS | — | |
| 14 | CSRF | PASS | — | |
| 15 | CORS | PASS | — | |
| 16 | HTTPS | PASS | — | |
| 17 | Security headers | FAIL | Low | open |
| 18 | Cookies | N/A | — | session is in localStorage |
| 19 | Debug mode | FAIL | Low | open |
| 20 | Prod settings | FAIL | Medium | open |

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

## Migrations (all applied to prod and recorded)

| File | Contents | When applied |
|---|---|---|
| `20260928000000_approval_source_and_profile_guards.sql` | `decided_via`, the expiry constraint, the profiles trigger, the participants policy | before publish: additive and safe with the old code |
| `20260928000100_server_only_approvals_and_plan_state.sql` | revoke approval writes, host-only plan update, the plans trigger | after publish, since it breaks the old code |
| `20260928000200_grant_decided_via_select.sql` | `grant select (decided_via) on parent_approvals to authenticated` | regression fix |

Each file was applied with `supabase db query --linked -f` (the first two were wrapped in `begin`/`commit`) and then recorded with `supabase migration repair --status applied <version> --linked`.
`types.ts` got `decided_via` by hand; a freshly generated copy matched.

## Regression found and fixed

- **Cause.** Signed-in users read `parent_approvals` through a column-level SELECT grant that leaves out `token`. The new `decided_via` column wasn't on it.
- **Effect.** After PR #4 was published, `getPlan`'s approvals query failed with `42501 permission denied`. The error was swallowed, so the plan page showed an empty approval list; nothing crashed. The guardian hub was unaffected because it reads with the admin client.
- **Fix.** Migration `20260928000200`. Verified as `authenticated`: `id, decided_via` can be read, and `token` is still denied.
- **Lesson.** When adding a column to a table with column-level grants, grant the column explicitly.

## Verification not done

- The approval flow was not exercised end to end with a real teen and guardian account. The DB rules were checked by querying as the `authenticated` role.

## Remaining fix plan (needs user approval)

1. **Dependencies.** `bun update` the MCP SDK, `@lovable.dev/mcp-js`, `ajv`, `js-yaml` and `nanoid`; add overrides for `fast-uri` ≥3.1.6, `hono` ≥4.12.34 and `qs`; then re-run `bun audit`, `tsc` and the wrangler build.
2. **Rate limits and spend.**
   - Code: an `ai_usage` table plus an `assertAiQuota(userId, feature)` helper allowing about 30 calls per user per day. Add auth to the three location functions.
   - Dashboards (user): Supabase Auth CAPTCHA and rate limits, a Google Cloud budget cap, a URL restriction on the Mapbox token, a Geoapify cap.
3. **Dev/prod split.** A second Supabase project for local dev (dashboard step for the user), then point `.env.local` at it.
4. **Low cleanup:**
   - delete `api/example.functions.ts`;
   - add `.env.example` and `.gitignore` rules;
   - add a generic error helper to replace the 56 raw error throws;
   - narrow `frame-ancestors` (test the Lovable preview first);
   - add `X-Frame-Options` and a Permissions-Policy for geolocation and the microphone.
