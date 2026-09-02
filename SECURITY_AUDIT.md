# Zenzele — Security Audit (Third Pass)

This covers the ten items from the latest hardening directive, in order. Each fix cites the exact file/migration. Tests are labeled by what actually happened — run, or **NOT EXECUTED — REQUIRES LIVE/STAGING SUPABASE** — per the explicit instruction not to claim a pass I didn't generate. See `AUDIT.md` for the first two hardening passes (role escalation, admin impersonation, institution_id, Business Passport self-verification, etc.) — this document doesn't repeat those.

## 1. Application authorization

**Vulnerability found**, severity **critical**: `"applications: entrepreneur manage own"` (migration 002) was `for all` — an entrepreneur could `UPDATE` their own application's `status` to `'awarded'` directly, or forge `reviewed_by`. Separately, `"applications: institution update status own opportunity"` had a `USING` clause but **no `WITH CHECK`**, meaning an institution updating an application they legitimately own could also silently reassign it to a different `opportunity_id` or `passport_id`.

**Remediation:** `supabase/migrations/006_fix_applications_messages.sql`. Split into `entrepreneur select own` / `entrepreneur insert own` / `entrepreneur update own limited` (status can only move to `withdrawn`, `opportunity_id`/`passport_id` immutable via same-row subquery comparison) / `institution update review own opportunity` (status changes only, `opportunity_id`/`passport_id` immutable) / admin retains `for all`. A `BEFORE UPDATE` trigger (`set_application_review_metadata`) forces `reviewed_by`/`reviewed_at` to the real authenticated actor whenever status moves to a reviewer-driven state — client-supplied values for those two columns are never trusted, even as defense in depth beyond the RLS check.

**Tests added:** `supabase/tests/database/002_applications_messages_security.test.sql`, groups 1–4 (7 assertions: cannot self-award, cannot self-shortlist, cannot forge `reviewed_by`, can withdraw, institution B cannot touch institution A's application, authorized institution can review and `reviewed_by` is trigger-set correctly, cannot reassign to a different passport, admin can manage).

**Executed:** NOT EXECUTED — REQUIRES LIVE/STAGING SUPABASE. Traced against the actual policy/trigger SQL; not run against a live Postgres instance (no Docker/Supabase runtime in this environment).

## 2. Message authorization

**Vulnerability found**, severity **high**: `"messages: recipient mark read"` was `for update using (recipient_id = auth.uid())` with **no `WITH CHECK` at all** — a recipient marking a message read could, in the same statement, rewrite `body`, `sender_id`, `recipient_id`, or `opportunity_id` to anything.

**Remediation:** same migration (006). New policy `"messages: recipient mark read only"` adds a `WITH CHECK` requiring every column except `is_read` to match its current stored value (same-row subquery pattern). Column-level `REVOKE UPDATE (sender_id, recipient_id, opportunity_id, body)` from `authenticated` as defense in depth — `is_read` is the only column the client SDK can ever write on this table after insert, full stop, regardless of future policy changes.

**Tests added:** same file, group 5 (5 assertions: can mark read, cannot rewrite body/sender_id/recipient_id, cannot forge sender_id on insert).

**Executed:** NOT EXECUTED — REQUIRES LIVE/STAGING SUPABASE.

## 3. Business Passport data minimization

**Gap found** (not a live vulnerability — the base table's RLS already required `is_published = true` and institution/admin role — but a real over-exposure once that bar was met): institutions querying `business_passports` directly get every column, including `head_office_address`, `business_email`, `business_phone`, `key_clients`, and exact `annual_turnover`. "Published for matching" was never a deliberate decision to also mean "published for full disclosure."

**Remediation:** `supabase/migrations/007_institution_discovery_view.sql` — `public.institution_business_directory`, a `security_invoker = true` view exposing only the discovery-appropriate column set. Institutions/admins should query this for search, not the base table. Full classification documented in `DATA_CLASSIFICATION.md`, including an explicit **open question** I did not resolve unilaterally: whether/how an "authorized interaction" (shortlist, application) should unlock tier-2 data. I built the document access route (item 4) to answer this for *documents* specifically, but the equivalent for plain contact/financial fields on the passport itself isn't built — flagged, not guessed at.

**Tests added:** `002_applications_messages_security.test.sql`, group 6 (2 assertions: the view's column list, checked via `information_schema.columns`, excludes the five sensitive fields + `owner_id`; the view isn't so restrictive that legitimate discovery breaks).

**Executed:** NOT EXECUTED — REQUIRES LIVE/STAGING SUPABASE.

## 4. Private document access

**Gap found:** no route existed at all to serve a document — `passport-documents` was already correctly private (owner-folder-scoped + admin, migration 003), so there was no live over-exposure, but the product literally couldn't show a document to anyone including its own owner without one.

**Remediation:** `src/app/api/documents/[id]/signed-url/route.ts` — a Next.js Route Handler that: authenticates via `requireAuth()`, loads the document + its passport's `owner_id` via the service-role client (bypassing RLS deliberately, because it's about to apply its own stricter, more specific authorization than table RLS can express), authorizes (owner, or admin, or an institution with a **real relationship** to the passport — an existing `shortlists` row or `applications` row tying that specific institution to that specific business, not just "the passport is published"), mints a 60-second signed URL via `createSignedUrl()`, logs the access to `audit_logs` (action `document.accessed`, including which basis granted access), and returns the URL. Rate-limited (30/hour/user) — see item 5.

**Not yet done:** no frontend document viewer calls this route yet (no UI exists to browse a passport's documents at all — see `ROADMAP.md`). The route is real and callable but currently only reachable via direct API call, not a button in the product.

**Executed:** NOT EXECUTED — REQUIRES LIVE/STAGING SUPABASE. This is a Next.js Route Handler, not a pgTAP-testable unit; it needs either a running dev server + real session cookies, or a Playwright test. Neither was run here.

## 5. Rate limiting / abuse protection

**Approach:** Supabase-native, no external service, per the directive's constraint. `supabase/migrations/008_rate_limiting.sql` adds a `rate_limits` table (no client grants — written only via the function below) and `check_rate_limit(key, max_requests, window_seconds)`, a `SECURITY DEFINER` fixed-window counter.

**Applied to:** `bulk-import` (5/hour/admin), `create-opportunity` (30/hour/caller), `generate-business-passport-pdf` (10/hour/caller), the document signed-URL route (30/hour/user).

**Deliberately not reimplemented:** login, registration, password reset, OTP/email verification — Supabase Auth already rate-limits these at the platform level (documented, not configurable per-project beyond what Supabase exposes). Building a second, app-level limiter on top would just create two systems that can disagree about the same thing.

**Not yet applied:** AI requests (no AI-calling edge function exists yet to attach it to — `src/lib/ai/index.ts` is a library, not an endpoint, so there's no anonymous-facing surface to protect yet), messaging (no dedicated send-message edge function exists — see item 6's note on the same gap), search (no search endpoint exists yet, per `ROADMAP.md`).

**Executed:** NOT EXECUTED — REQUIRES LIVE/STAGING SUPABASE.

## 6. Zod validation

**Applied to all 8 existing edge functions:** `create-opportunity`, `admin-verification`, `verify-business-passport`, `generate-business-passport-pdf`, `bulk-import`, `match-businesses`, `calculate-trust-score`, `notification-engine`. Shared schemas in `supabase/functions/_shared/schemas.ts` (Zod, `.strict()` on every object so unknown fields are rejected, not silently dropped — deliberately, since a client still sending a stale field like the old `admin_id` is exactly the kind of thing that should be loud, not quietly ignored). Every schema validates UUIDs, enums, string length caps, numeric ranges.

**Two items from the directive's list are not edge functions in this architecture and were not force-fit into becoming ones:** "create/send message" and "application creation" currently happen via direct Supabase client table inserts, protected by the RLS from items 1–2 above, not via an edge function. Building dedicated edge functions for these purely to attach Zod validation would be architecture change for its own sake, which the directive itself said not to do ("do not change the product architecture unnecessarily"). If message/application length limits matter beyond what RLS + the schema's own column types already provide, the honest fix is a Postgres `CHECK` constraint on `messages.body`/`applications.cover_note` length, not a new edge function — not yet added, flagged here as a real gap rather than silently closed.

**Client-provided role/user ID/institution ID/owner ID/audit actor ID:** none of the 8 schemas accept these as trusted fields — `institution_id` in `createOpportunitySchema` is explicitly commented as "only honored for admin callers," enforced in the handler, not the schema.

## 7. Bulk CSV import

**Vulnerability found**, severity **medium**: the original parser was `line.split(",")` — breaks on any quoted field containing a comma (e.g., a business description), has no file size/row count/field length limits, and does nothing to prevent CSV formula injection if this data is ever exported back to a spreadsheet later.

**Remediation:** full rewrite, `supabase/functions/bulk-import/index.ts`. Real RFC 4180 parsing via `papaparse`. Added: 2MB file size cap, 2000 row cap, 500-char field length cap, per-row validation (email format, required fields, `business_type` enum), duplicate detection (both within the same file via a `Set`, and against existing `profiles` by email), and formula-injection sanitization (any field starting with `=`, `+`, `-`, or `@` gets a leading `'` prepended, neutralizing it as a spreadsheet formula while preserving the visible value). Import summary now includes `skipped_duplicates` alongside `created`/`failed`/`errors`. Audit logging unchanged (already present, now includes the duplicate count).

**Not done:** true transactional atomicity (all-or-nothing) across the multi-table per-row insert sequence (invite → profile update → passport insert → activity insert). This would require a Postgres function wrapping the whole row in a single transaction, callable via RPC, rather than sequential JS-client calls. The current per-row try/catch gives partial-success-with-detailed-errors behavior, which is arguably the right behavior for a 2000-row import anyway (one bad row shouldn't roll back 1999 good ones) — but if true atomicity is actually wanted, that's a different design, not implemented here.

**Executed:** NOT EXECUTED — REQUIRES LIVE/STAGING SUPABASE (needs a real storage bucket with an uploaded CSV and `auth.admin.inviteUserByEmail` access).

## 8. Admin provisioning

**Remediation:** `supabase/migrations/009_admin_provisioning.sql` — `admin_promote_user(target_user_id)` and `admin_demote_user(target_user_id, new_role)`, both `SECURITY DEFINER`, both self-check `is_admin()` internally and `raise exception` if the caller isn't one, both audit-logged. `admin_demote_user` refuses to demote the last remaining admin (`select count(*) ... where role = 'admin'`, blocks if `<= 1`).

**Bootstrap (first admin):** documented in `SUPABASE_SETUP.md` as a direct SQL `UPDATE` run with database-owner credentials. No stored secret or token exists for this — direct database access *is* the bootstrap mechanism, which means there's nothing that could later leak, satisfying "no permanent bootstrap secret should remain active" by not having one at all rather than by expiring one.

**Every admin after the first must go through `admin_promote_user`** — there is no other path; public registration clamps to `entrepreneur`/`institution` only (migration 004), and there's no other function or policy that writes `role = 'admin'`.

**Tests added:** `002_applications_messages_security.test.sql`, group 7 (2 assertions: non-admin cannot call `admin_promote_user`; the sole remaining admin cannot be demoted).

**Executed:** NOT EXECUTED — REQUIRES LIVE/STAGING SUPABASE.

## 9. Testing

**Expanded from 23 to 40 pgTAP assertions** across two files (`001_rls_security.test.sql` unchanged at 23, new `002_applications_messages_security.test.sql` adds 17). Covers: applications (self-approval, cross-institution, authorized review, admin), messages (read-marking vs. content tampering, forged sender), the discovery view's column exclusions, admin provisioning (non-admin rejection, last-admin protection).

**Coverage gap, stated plainly:** this is still not the full 12-table × 4-operation × 6-identity matrix the original directive asked for. `matches`, `shortlists`, `notifications`, and storage-object-level access are not yet covered by dedicated tests (storage access is *architecturally* covered — the signed-URL route in item 4 is the only path, and direct storage RLS denies everyone else — but there's no automated test proving that, since it's an HTTP/Storage-API concern pgTAP can't reach). Added `scripts/test-edge-function-auth.sh` (item 4/6's HTTP-layer complement) in the prior pass; not extended this pass beyond what already existed.

**Playwright route authorization tests:** not added. This remains the one layer (Layer 1/2 — middleware + `guards.ts` route redirects) with zero automated coverage; `SECURITY_TESTS.md` already flagged this as lower priority than RLS since RLS is the layer that actually stops data exposure if the others have a bug, and that reasoning still holds, but it means "an entrepreneur hitting `/admin/dashboard` gets redirected, not shown data" is currently only true because I read the code, not because a test proves it.

**Executed:** NOT EXECUTED — REQUIRES LIVE/STAGING SUPABASE, for all of the above.

## 10. CI security gate

**Added:** `.github/workflows/security-gate.yml` — three jobs: `typecheck-and-build` (runs `tsc --noEmit` + `next build` against placeholder env vars, no live Supabase needed), `database-security-tests` (`supabase start` + `supabase test db`, runs the full pgTAP suite against a fresh local instance built from the actual migrations), `edge-function-auth-tests` (starts local Supabase, serves functions locally, provisions two real throwaway test users via the GoTrue admin API using Supabase's documented local-dev default keys — not a production secret — signs in as each to get real access tokens, then runs `scripts/test-edge-function-auth.sh` against them).

**Honest caveat:** I authored this workflow by reasoning through the correct sequence of `supabase` CLI commands and GoTrue admin API calls, but **I did not run it** — there's no GitHub Actions runner or Supabase CLI available in this environment to validate the YAML executes correctly end-to-end. If the CI run fails on first try, the most likely culprits are the exact `supabase status -o json` field names (`SERVICE_ROLE_KEY`/`ANON_KEY` — I'm fairly confident in these but haven't confirmed against a specific CLI version) or timing (the `sleep 5` after `supabase functions serve &` is a guess, not a health-check).

**Executed:** NOT EXECUTED — REQUIRES A REAL GITHUB ACTIONS RUN (not just a live Supabase project — this needs the actual CI environment to validate).

## Summary: what's real vs. what's authored-but-unverified

Every fix in items 1–8 is grounded in reading the actual current policy/function SQL before writing the remediation — I did not pattern-match from the directive's description without checking, and where I found something already correctly restricted (e.g., document storage RLS in item 4), I said so rather than "fixing" a non-problem. But per the explicit instruction not to claim tests passed: **nothing in this document has been executed against a live system.** Every "Executed" line above says so plainly. Before trusting any of this in production: run `supabase test db` locally, run the CI workflow for real and fix whatever breaks on first attempt, and run `scripts/test-edge-function-auth.sh` against a real local instance.

## Remaining risks (carried forward + new)

- Business Passport tier-2 data (contact/financial fields) has no "authorized interaction unlocks it" mechanism — currently binary (owner+admin only), not the graduated access the directive implied should exist. Real product decision needed, not guessed at (see `DATA_CLASSIFICATION.md`).
- No frontend document viewer exists to actually call the new signed-URL route — the backend is real, the UI isn't built.
- CSV import lacks true transactional atomicity (see item 7).
- AI request endpoints have no rate limiting because no AI-calling endpoint exists yet.
- Playwright route-authorization tests don't exist (item 9).
- The CI workflow is unverified (item 10).
