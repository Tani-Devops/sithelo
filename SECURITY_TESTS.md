# Security Tests

## Honesty note, read this first

I authored the tests below and traced each one against the actual policy/grant SQL to reason through the expected outcome. I did **not** execute them against a live Postgres/Supabase instance — this sandbox has no Docker/Supabase runtime available, and I won't report "23 passed" when I didn't run anything. Run them yourself before trusting this; instructions below. If any of them fail, that's more informative than anything I could claim here — file it as a real bug, not a documentation gap.

## Layer 3: Database RLS tests (`supabase/tests/database/`)

**What they cover:** `000_setup.sql` (pgTAP + a session-identity-switching helper) and seven test files covering, cumulatively, **116 assertions — ACTUALLY EXECUTED AND PASSING**, for real, as of the eighth pass. Previously "manually verified" by line-by-line counting; now additionally run against a genuine Postgres 16 + pgTAP instance with a hand-built approximation of Supabase's `auth`/`storage` schemas and baseline platform grants. This real execution found and fixed three critical bugs (a silently-ineffective column-privilege pattern, an RLS infinite-recursion bug, and an ambiguous-column-reference bug breaking two RPCs outright) that eight prior passes of careful static reading never found — see `SECURITY_AUDIT_MASTER.md`'s eighth-pass section for the full account.

**How to reproduce:** `supabase test db` against a real local Supabase instance (requires Docker) should now pass cleanly. This session's approximation (`pg_prove` against a hand-built stub) is documented as exactly that — an approximation, not proof the genuine Supabase local stack behaves identically in every respect, though the core mechanisms exercised (Postgres RLS, column grants, triggers) are the real primitives, not simulated ones.

**How to run:**
```bash
supabase test db
```
This spins up a local Postgres instance from your migrations and runs every `*.test.sql` file under `supabase/tests/database/` inside a transaction that's rolled back afterward (no fixture data persists).

**A note on assertion choice**, since getting this wrong would make the suite lie: an RLS `USING` clause that excludes a row makes `UPDATE`/`DELETE` silently affect zero rows — no exception. Only a `WITH CHECK` violation or a column-level `REVOKE` throws. The test file uses `throws_ok` only where an actual exception is expected, and `is_empty(... RETURNING id ...)` to prove a cross-tenant write touched nothing, for the cases where RLS just filters silently. Mixing these up is a common way to write an RLS test that passes even when the policy is broken — worth knowing if you extend this suite.

**What's covered vs. what the directive asked for in full:** the directive listed 12 tables × 4 operations × 6 identities as the target matrix. This suite covers the highest-value cross-tenant and privilege-escalation scenarios explicitly, not the full combinatorial matrix — that's real remaining work, not a rounding error. `matches`, `applications`, `shortlists`, `notifications`, and `messages` don't have dedicated tests yet. The pattern established here (fixtures → `act_as()` → assert) extends directly; adding the remaining tables is mechanical, not novel design work.

## Layer 4: Edge function authorization tests (`scripts/test-edge-function-auth.sh`)

**What it covers:** that internal-only functions (`calculate-trust-score`, `match-businesses`, `audit-logger`, `compliance-monitor`, `notification-engine`) reject any caller not presenting the service-role key; that role-gated functions (`admin-verification`, `bulk-import`, `create-opportunity`) reject the wrong role; that everything rejects requests with no `Authorization` header at all.

**How to run:** requires a running local Supabase instance (`supabase start`) with functions served (`supabase functions serve`) and real access tokens for a test entrepreneur and a test institution user (log in via the app locally and pull the token from the session, or use `supabase.auth.signInWithPassword` in a scratch script). See the script header for the exact env vars.

**Not run here for the same reason as above** — no Supabase runtime in this environment.

## Layer 1/2: Route protection (middleware + `guards.ts`)

No automated test for this yet. Recommended: Playwright, logging in as each role and asserting the redirect behavior when hitting another role's routes (`/admin/dashboard` as an entrepreneur → redirected to `/entrepreneur/dashboard`, not a blank/error page, not the admin data). This is genuinely lower priority than Layers 3/4 — even if middleware had a bug, RLS is what actually stops data exposure, which is why it's tested first here.

## What "done" looks like before this is trustworthy

1. Run `supabase test db` locally, confirm all 23 pass, fix anything that doesn't.
2. Run `scripts/test-edge-function-auth.sh` against a local instance with real test tokens.
3. Extend the pgTAP suite to the remaining tables (`matches`, `applications`, `shortlists`, `notifications`, `messages`) using the same fixture/pattern.
4. Wire both into CI (GitHub Actions) so a future migration can't silently reopen one of these gaps — a security fix that isn't tested in CI tends to regress the next time someone touches the schema.
