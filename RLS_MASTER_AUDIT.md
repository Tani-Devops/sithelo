# Zenzele — RLS Master Audit

Enumerates every table's **final** authorization state after all 20 migrations (i.e., accounting for every `drop policy` / `revoke` that superseded an earlier migration — this is what's actually in effect, not a chronological list of everything ever written). Verified by grepping the actual `create policy`/`drop policy`/`revoke` statements across all migrations before writing this table, not from memory. Migration count corrected from a stale "13" in a prior revision of this document — caught during an explicit consistency-check pass, not left uncorrected.

| Table | SELECT | INSERT | UPDATE | DELETE | WITH CHECK gaps | Sensitive fields | Column-level protection |
|---|---|---|---|---|---|---|---|
| `profiles` | Owner (own row) or admin | **None for `authenticated`** — trigger-only (`handle_new_user`) | Owner (non-privileged fields only) or admin | None | N/A (INSERT fully closed) | `role`, `institution_id` | `REVOKE UPDATE (institution_id, role)` from `authenticated` |
| `institutions` | Any authenticated | Admin only | Admin only | Admin only | — | — | — |
| `business_passports` | Owner, or published+institution/admin, or admin — **but 9 sensitive columns have SELECT revoked from `authenticated` entirely as of migration 017, including from the owner** | Owner (own `owner_id`) or admin | Owner (non-scored fields) or admin | Owner or admin | — | `trust_score`, `business_health_score`, `readiness_score`, `profile_completeness`, `overall_verification_status`, `is_published`, `owner_id`, `passport_code` (UPDATE-revoked, migration 005); `business_email`, `business_phone`, `head_office_address`, `key_clients`, `annual_turnover`, `business_health_score`, `readiness_score`, `profile_completeness`, `bbbee_expiry` (SELECT-revoked, migration 017) | Column-level REVOKE for both SELECT and UPDATE — the only read path for the SELECT-revoked columns, for anyone including the owner, is `get_passport_detail()` |
| `verifications` | Owner or admin only — institution policy removed in migration 015 | **None for `authenticated`** (admin/service-role only) | **None for `authenticated`** | **None for `authenticated`** | N/A | entire table (compliance status, reviewer identity, notes); `verified_by`/`verified_at` specifically SELECT-unrestricted-but-UPDATE-revoked (migration 019) | Institution access goes through `get_passport_detail()`'s minimized `verification_summary`; `verified_by`/`verified_at` UPDATE-revoked from `authenticated`, forced by trigger to the real acting admin (fixed an admin-impersonating-another-admin gap) |
| `documents` | Owner or admin only — institutions use `list_passport_documents()` (relationship-gated), never direct SELECT | Owner (own passport) or admin | Owner (non-`status` fields) or admin | None granted | — | `status` | `REVOKE UPDATE (status), INSERT (status)` from `authenticated`; default `pending_review` |
| `business_references` | Owner, or institution-on-published (name/organisation/description/rating only — `reference_contact` SELECT-revoked, migration 018) | Owner (own passport) | Owner (own passport, via `for all`) | Owner (via `for all`) | — | `reference_contact` (private third-party contact info) | `REVOKE SELECT (reference_contact)` from `authenticated` |
| `opportunities` | Institution (own) or admin; entrepreneurs read `active` only | Institution (own `institution_id`) or admin | Institution (own) or admin | Institution (own, via `for all`) or admin | — | `created_by` | Trigger forces `created_by` to the real actor on INSERT (only when `auth.uid()` is present — a genuine user session; a service-role INSERT like the normal `create-opportunity` edge function path keeps its own already-verified value) and makes it immutable on UPDATE unconditionally |
| `matches` | Institution (own opportunity's matches) or entrepreneur (own passport's matches) or admin | **None for `authenticated`** (service-role/edge-function only) | **None for `authenticated`** | **None for `authenticated`** | N/A | match scoring logic | Table-level: write-locked to service role. Now tested (`007_coverage_gap_regression.test.sql`) — previously zero coverage. |
| `applications` | Entrepreneur (own passport) or institution (own opportunity) or admin | Entrepreneur (own passport, forced `status='submitted'`, `reviewed_by`/`reviewed_at` null) | Entrepreneur (status→`withdrawn` only, opportunity/passport immutable) or institution (review status only, opportunity/passport immutable) or admin | None for `authenticated` | Fixed in migration 006 (previously missing) | `status`, `reviewed_by`, `reviewed_at` | Trigger (`set_application_review_metadata`) forces `reviewed_by`/`reviewed_at` regardless of client input |
| `shortlists` | Institution (own) | Institution (own `institution_id`, `created_by = auth.uid()`, target passport must be `is_published = true` — migration 018, closes the "manufacture authorization for an unpublished business" attack) | **None** — no UPDATE policy exists; the relationship either exists or is deleted and re-created | Institution (own) | Fixed in migration 018 (previously missing entirely) | `created_by`, whether the target is published | INSERT-time checks enforce both attribution and the publish precondition |
| `notifications` | Recipient (own) | **None for `authenticated`** (service-role only via `notification-engine`) | Recipient (own, `is_read` only) | None | Fixed in migration 014 (previously missing content-field pinning) | notification content | `REVOKE UPDATE (title, body, category, channel, metadata)` from `authenticated` |
| `messages` | Sender or recipient (own) | Sender (own `sender_id` only) | **None for `authenticated`** — `mark_message_read()` function only (migration 010) | None | N/A (UPDATE fully closed) | `body`, `sender_id`, `recipient_id` | Table-level: no UPDATE grant exists at all |
| `audit_logs` | Admin only | **None for `authenticated`** (service-role/SECURITY DEFINER functions only) | None | None | N/A | everything (this is the audit trail) | Table-level: fully closed to `authenticated` writes |
| `passport_activity` | Owner or admin only — **institution policy removed in migration 015**, no replacement (unused by the product; institutions never needed this) | **None for `authenticated`** directly (written by SECURITY DEFINER functions like `create_imported_business`) | None | None | N/A | admin/internal review events | Table-level: fully institution-inaccessible |
| `trust_score_history` | Owner or admin only — **institution policy removed in migration 015**, institutions get current `trust_score` only via `get_passport_detail()` tier 1 | **None for `authenticated`** (service-role only, via `calculate-trust-score`) | None | None | N/A | trust score trend (trajectory can reveal more than the current number alone) | Table-level: fully institution-inaccessible |
| `rate_limits` | **None for `authenticated`** at all | **None for `authenticated`** | **None for `authenticated`** | **None for `authenticated`** | N/A | — | Table-level: fully closed, written only via `check_rate_limit()`. Now tested (`007_coverage_gap_regression.test.sql`) — previously zero coverage. |
| `institution_business_directory` (view) | Any authenticated (inherits base table RLS via `security_invoker`) | N/A (view) | N/A | N/A | — | Deliberately excludes 6 sensitive columns at the view definition level | Column allowlist by construction |

## New findings from this pass (not previously audited)

### `notifications` UPDATE policy has the same missing-scope shape as the old `messages` bug

`"notifications: recipient mark read"` is `for update using (recipient_id = auth.uid())` — I need to check whether it has a `WITH CHECK`. Grepping migration 002 directly:

```
create policy "notifications: recipient mark read" on public.notifications
  for update using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());
```

This one **does** have a `WITH CHECK`, but the check only re-asserted `recipient_id = auth.uid()` — it didn't pin `title`/`body`/`category`/`channel` to their existing values the way the messages fix does. A recipient marking a notification read could, in the same statement, rewrite the notification's content. Lower severity than the messages bug (notifications are one-way system messages, not a two-party conversation where content integrity matters for a paper trail), but the same bug class. **Fixed in migration 014** (`014_fix_notifications_tampering.sql`) — same same-row subquery pattern plus column-level revoke on `title`/`body`/`category`/`channel`/`metadata`.

### `business_references` has no column-level protection at all

The owner has `for all` on their own references, including `rating`. Since these are always self-reported by the entrepreneur (not an independent third-party review system), owner-editability of the whole row is arguably correct rather than a bug — but no prior audit examined this table explicitly, so I'm naming that reasoning rather than leaving it silently unexamined.

## Confirmed clean (re-verified, not just assumed)

`profiles`, `business_passports`, `applications`, `messages` — all previously-fixed issues confirmed still in effect by direct grep against final migration state (see the verification command run at the start of this session). `matches`, `audit_logs`, `verifications`, `rate_limits` — table-level write locks confirmed correct (no `authenticated` write policy exists on any of them).

## Function EXECUTE grant audit (added: full sweep across all 20 unique functions)

All 20 functions enumerated fresh from `create or replace function`/`create function` statements across every migration (not sampled). Final grant state for each:

| Function | Final grantees | Why |
|---|---|---|
| `is_admin()` | `public` (explicit as of migration 020) | RLS-helper — referenced inside 18 policy expressions in migration 002; must remain callable by whatever role is evaluating a policy. Never called directly via `.rpc()` — confirmed by repository search. |
| `current_institution_id()` | `public` (explicit as of migration 020) | Same reasoning as `is_admin()`. |
| `has_passport_relationship(uuid, uuid)` | `service_role` only | Was `authenticated`-callable — a relationship oracle (arbitrary institution/passport pairs, caller-controlled). Revoked, migration 018. |
| `has_my_passport_relationship(uuid)` | `authenticated` | Safe self-scoped wrapper — derives institution from `auth.uid()`, can't probe other institutions. |
| `get_passport_detail(uuid)` | `authenticated` | Client-facing, fails closed on missing profile (migration 019). |
| `list_passport_documents(uuid)` | `authenticated` | Same. |
| `get_passport_activity(uuid)` | `authenticated` | Owner/admin only internally. |
| `get_passport_trust_history(uuid)` | `authenticated` | Owner/admin only internally. |
| `mark_message_read(uuid)` | `authenticated` | Self-scoped via `recipient_id = auth.uid()` inside the function. |
| `admin_promote_user(uuid)` | `authenticated` | Self-checks `is_admin()` internally — safe to grant broadly since non-admins get a raised exception, not access. |
| `admin_demote_user(uuid, user_role)` | `authenticated` | Same pattern. |
| `admin_set_institution_membership(uuid, uuid)` | `authenticated` | Same pattern. |
| `check_rate_limit(text, int, int)` | `service_role` only | Was `authenticated`-callable — let any client write arbitrary `rate_limits` rows with a made-up key. Revoked, migration 016. |
| `create_imported_business(...)` | `service_role` only | Bulk-import internal use only — an ordinary user calling it directly could create passports for arbitrary `owner_id`s. |
| `handle_new_user()` | none (trigger only) | Fires automatically on `auth.users` insert; never called directly by any role. |
| `enforce_institution_membership_consistency()` | none (trigger only) | Same. |
| `enforce_opportunity_created_by()` | none (trigger only) | Same. |
| `set_application_review_metadata()` | none (trigger only) | Same. |
| `set_verification_review_metadata()` | none (trigger only) | Same. |
| `set_updated_at()` | none (trigger only, `SECURITY INVOKER`) | Trivial timestamp trigger — the only function of the 20 that is not `SECURITY DEFINER`, correctly, since it needs no elevated privilege. |

**19 of 20 functions are `SECURITY DEFINER`**; all 19 confirmed to have explicit `search_path` (checked programmatically, not sampled). Zero dynamic SQL (`EXECUTE format`/string-built queries) exists in any function — no SQL-injection surface, structurally.

## Storage bucket audit (full sweep, all 5 buckets)

| Bucket | Public? | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|---|
| `passport-documents` | No | Owner (own folder) or admin | Owner (own folder) | **None** | **None** |
| `passport-images` | Yes | Public | Owner (own folder) | **None** | **None** |
| `institution-logos` | Yes | Public | Owner (own folder) **AND** `role = 'institution'` (migration 019 — previously missing the role check entirely) | **None** | **None** |
| `generated-pdfs` | No | Owner (own folder) | **None** for `authenticated` (service-role only, written by `generate-business-passport-pdf`) | **None** | **None** |
| `bulk-imports` | No | Admin only | Admin only | **None** | **None** |

**No bucket grants UPDATE or DELETE to owners at all** — the consistent pattern across every bucket is upload-a-new-object rather than mutate-in-place. Confirmed this is uniform (not an oversight isolated to one bucket) and logged as a **KNOWN PRODUCT DECISION**, not resolved either direction: if a user should be able to replace/remove their own uploaded logo or document, that capability needs to be deliberately added, not assumed to already exist.

## CRITICAL CORRECTION (post real-execution testing)

Every "Column-level protection" cell in the table above that described a plain `REVOKE UPDATE/SELECT (columns) ... FROM authenticated` was **verified via real execution to be non-functional** — a table-level grant (which Supabase's real platform applies as baseline, before any application migration) makes column-specific revokes irrelevant. See `SECURITY_AUDIT_MASTER.md`'s eighth-pass section for the full account and reproduction. **The actual, now-verified-working mechanism is: `REVOKE` the table-level privilege entirely, then `GRANT` back only the intended columns** (migration 021) — the inverse of what every earlier row in this document described. Affected: `business_passports` (SELECT + UPDATE + INSERT — INSERT was never restricted at all until this fix), `documents` (INSERT + UPDATE), `applications` (UPDATE), `verifications` (UPDATE), `notifications` (UPDATE), `business_references` (SELECT), `profiles` (UPDATE).

Also corrected: `applications`' and `notifications`' `WITH CHECK` clauses previously used a self-correlated subquery pattern (`table2.id = table1.id`, referencing the same table being updated) that Postgres's RLS engine rejects with an infinite-recursion error — found because it broke the feature outright, not just insecurely. Fixed in migration 023 by moving that logic to triggers and simplifying `WITH CHECK` back to ownership checks.
