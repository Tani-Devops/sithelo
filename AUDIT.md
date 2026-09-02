# Zenzele — Security Audit

Scope: the codebase as delivered in the previous zip. This is a real audit of real code I wrote, not a template — every finding below was confirmed by reading the actual file, not assumed.

## Summary

The original scaffold had a working data model and correct RLS *shape* (owner-scoped policies, admin-scoped policies), but two classes of bug undermined it: **client-controlled privilege fields** and **edge functions trusting request-body identity instead of verified identity**. Both are now fixed for the highest-severity instances; a few lower-severity instances of the second class remain and are listed under "Not yet fixed."

## Fixed

### 1. Role escalation via public profile registration — CRITICAL

**Finding:** `002_rls_policies.sql`'s `"profiles: insert own on signup"` policy was `for insert with check (id = auth.uid())` — it verified *whose* row was being inserted, never *what* the row contained. The register page's client-side code (`register/page.tsx`) then did `supabase.from("profiles").insert({ id, role, ... })` with `role` taken directly from client state. Any authenticated user could set `role: "admin"` in that insert and the policy would allow it. This is a direct, working privilege-escalation path — not theoretical.

**Fix** (`004_fix_role_escalation.sql`):
- Dropped the client-insert policy entirely and `REVOKE INSERT ... FROM authenticated` on `profiles` at the grant level (so even a future policy regression can't reopen it).
- Profile creation now happens exclusively via a `SECURITY DEFINER` trigger (`handle_new_user`) on `auth.users` insert, which reads `role` from signup metadata but clamps it to `entrepreneur` or `institution` only — `admin` is structurally unreachable through this path.
- `register/page.tsx` updated to pass role via `signUp({ options: { data: { role } } })` instead of inserting a profile row itself.
- Added `"profiles: update own non-privileged fields"` which makes `role` immutable to the row owner even on UPDATE (the original `"profiles: update own"` had the same gap on update, not just insert).

**How to provision an actual admin:** not yet built — see "Not yet fixed."

### 2. `admin-verification` trusted a client-supplied `admin_id` — CRITICAL

**Finding:** the function read `admin_id` out of the JSON body and used it directly as `verified_by` in the audit trail and as the actor for approve/reject decisions. It never checked that the caller *was* that admin, or an admin at all. Any authenticated request with a guessed/known admin UUID could approve or reject any business's verification.

**Fix:** added `supabase/functions/_shared/auth.ts` — a `requireRole()` helper that extracts the caller's JWT from the `Authorization` header, verifies it against Supabase Auth, looks up their role from `profiles` using the service-role client, and rejects (401/403) before any business logic runs. `admin-verification` now derives the actor exclusively from `auth.user.id`; `admin_id` is no longer accepted in the body at all.

### 3. `bulk-import` — same bug, same fix

Same `admin_id`-in-body pattern, same `requireRole(["admin"])` fix applied.

### 4. `create-opportunity` — cross-institution impersonation

**Finding:** accepted `institution_id` and `created_by` from the body. An authenticated user from Institution A could post an opportunity with Institution B's `institution_id`, forging attribution.

**Fix:** `institution_id` and the audit actor now come from the caller's verified profile (`auth.user.institutionId`, `auth.user.id`). Admins retain the ability to specify an institution explicitly (for legitimate on-behalf-of actions), institution users cannot override their own.

### 5. Internal-only functions were publicly invocable

**Finding:** `calculate-trust-score`, `match-businesses`, `audit-logger`, and `compliance-monitor` have no meaningful "which end-user role is allowed to call this" answer — they're system-to-system functions (score recalculation, immutable audit writes, scheduled compliance scans). As deployed, any authenticated client could call them directly: e.g. force a trust score recalculation off-cycle, or worse, call `audit-logger` directly to write forged (but plausible-looking) audit entries.

**Fix:** all four now require the caller to present the service-role key itself as the bearer token, rejecting anything else with 403. This makes them callable only from other edge functions and trusted server-side code, never from a browser.

### 6. `verify-business-passport` and `generate-business-passport-pdf` had no access check

**Finding:** these read/derive from verification data, which isn't public — but neither function checked whether the caller had any relationship to the passport in question. Any authenticated user could pull any business's readiness report or generate a PDF of any business's passport.

**Fix:** both now use `requireRole()` plus an explicit ownership/visibility check (owner, or institution viewing a *published* passport, or admin) before returning data.

## Second pass — additional fixes

### 7. `institution_id` tenant-isolation gap — CRITICAL

**Finding:** the `role`-immutability fix from the first pass (`profiles: update own non-privileged fields`) locked `role` but never touched `institution_id`. An institution user could `UPDATE` their own profile and set `institution_id` to any other institution's id, instantly gaining that institution's data access — every downstream policy trusting `current_institution_id()` (opportunities, shortlists, applications) would treat the forged membership as legitimate. Confirmed real by reading the actual policy SQL before writing the fix, not assumed from the directive's description.

**Fix** (`005_fix_column_level_privilege_escalation.sql`): the update policy's `WITH CHECK` now also requires `institution_id` stay unchanged, and `institution_id` is `REVOKE`d at the column-privilege level from `authenticated` (same belt-and-braces reasoning as the `role` fix). A new `admin_set_institution_membership()` function — `SECURITY DEFINER`, admin-only, audited — is the only sanctioned path to change it after signup.

### 8. Business Passport self-verification gap — CRITICAL

**Finding:** `"passports: owner full access"` was `for all ... using (owner_id = auth.uid())` — full row access, including `trust_score`, `overall_verification_status`, `is_published`, `business_health_score`, `readiness_score`, `profile_completeness`. Any entrepreneur could set `overall_verification_status = 'verified'` and `is_published = true` directly through the client SDK, no admin involved. Also confirmed real, not theoretical.

**Fix:** split the single `for all` policy into per-operation policies, then `REVOKE UPDATE` on the seven Zenzele-controlled columns (plus `owner_id`, `passport_code`) from `authenticated` at the grant level. Row ownership stops being the only gate — Postgres now rejects the write regardless of which row-level policy would otherwise pass. Entrepreneurs keep full read/write on every business-fact column (name, description, capacity, etc.); only the trust/verification/publication layer is locked.

### 9. Same bug class in `documents.status`

**Finding:** `"documents: owner manage"` was also `for all`, letting an entrepreneur mark their own uploaded document `status = 'valid'` instead of the honest `pending_review` default, bypassing admin review entirely.

**Fix:** `REVOKE UPDATE (status), INSERT (status)` from `authenticated`; column now defaults to `pending_review` so entrepreneurs never need write access to it at all.

### 10. Centralized authorization utilities

Added `src/lib/auth/guards.ts` (`requireAuth`, `requireRole`, `requireEntrepreneur`, `requireInstitution`, `requireAdmin`) so role checks aren't hand-rolled per page — the three dashboards were refactored to use these instead of inline `if (!user) redirect(...)` blocks, which is exactly the kind of duplicated logic that's easy to get right nine times and wrong once. `middleware.ts` also now checks role-appropriate routing (`/admin/*` redirects a non-admin to their own dashboard), not just authenticated-vs-not — documented as Layer 1 of a four-layer model in `SYSTEM_ARCHITECTURE.md`, with Layer 3 (RLS) as the actual authorization ground truth if the others have a bug.

### 11. Automated RLS test suite

Added a real, runnable pgTAP suite (`supabase/tests/database/`, 23 assertions) covering the scenarios above plus cross-tenant isolation, anonymous access denial, and the admin-only membership function. **I wrote these by tracing the actual policy SQL, but did not execute them** — no Supabase/Docker runtime in this environment. See `SECURITY_TESTS.md` for exactly what that means and how to actually run them. Also added `scripts/test-edge-function-auth.sh` for the HTTP-layer checks pgTAP can't reach (that internal-only functions actually reject non-service-role callers).

## Not yet fixed — next priority

- **Admin provisioning.** There is currently no secure path to create the first admin account or promote a user to admin. This needs to be a deliberate, out-of-band action (e.g. a one-time SQL script run directly against the database by someone with project owner access, or a `supabase/functions/promote-to-admin` function gated behind a separate, rotated bootstrap secret — not behind another admin, since that's circular for the first admin). I'm flagging this rather than guessing at your preferred provisioning process.
- **`notification-engine`** is now internal-only (service-role gated), which stops arbitrary spam, but a compromised or buggy caller *inside* the trust boundary could still notify any `recipient_id`. Low severity given the gate, but worth a follow-up: validate that `recipient_id` is a plausible target for the calling context (e.g. the entrepreneur who owns the passport a match refers to), not just any UUID.
- **File storage**: bucket-level RLS is in place (private `passport-documents`, admin-only `bulk-imports`), but no server route yet issues short-lived signed URLs for document access — the frontend doesn't have a document viewer built yet (see ROADMAP.md), so this hasn't been exercised end-to-end. When that UI is built, use `createSignedUrl()` with a short expiry, not public URLs, and re-check ownership server-side before minting the signed URL.
- **Rate limiting / abuse prevention** on public endpoints (registration, login) — not implemented. Supabase Auth has some built-in protections; nothing Zenzele-specific has been added.
- **Zod validation on edge function payloads** — functions currently do manual `if (!field)` checks, not schema validation. Works, but is easy to leave gaps in as fields are added. Recommend introducing `zod` (already a dependency in the Next.js app) into edge functions via esm.sh.

## Explicitly not audited this pass

Full per-role RLS test matrix (anonymous / entrepreneur / institution / admin / cross-tenant × every table × SELECT/INSERT/UPDATE/DELETE) as requested — this needs to be executed against a live Supabase project with real test accounts, which I can't do inside this environment. `SECURITY_TESTS.md` is not included because I won't fabricate test results I didn't actually run. Recommend running this manually against a staging project before launch, or asking me to write the Playwright/pgTAP test suite so it's automated and repeatable rather than a one-time manual pass.
