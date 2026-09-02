# Zenzele — Access Control Matrix

Every table × every role × every operation, as of migration 020. Built from the actual final policy/grant state (verified this session, not from memory or a prior document). Legend:

- **ALLOW** — the operation succeeds
- **DENY** — RLS or a column/table-level grant blocks it outright
- **OWN ONLY** — allowed only when the row belongs to the caller (owner, sender/recipient, or institution)
- **RELATIONSHIP** — allowed only for an institution with a `shortlists`/`applications` tie to the specific passport (`has_passport_relationship()`)
- **FUNCTION ONLY** — no direct table access exists; the operation is only reachable via a specific `SECURITY DEFINER` function
- **N/A** — the role/operation combination doesn't meaningfully apply

Roles: **Anon** (unauthenticated), **Ent-own** (entrepreneur acting on their own data), **Ent-other** (entrepreneur acting on another entrepreneur's data), **Inst-rel** (institution with a relationship to the specific passport), **Inst-none** (institution with no relationship), **Admin**.

## `profiles`

| Operation | Anon | Ent-own | Ent-other | Inst-rel | Inst-none | Admin |
|---|---|---|---|---|---|---|
| SELECT | DENY | OWN ONLY | DENY | DENY | DENY | ALLOW |
| INSERT | DENY | DENY | DENY | DENY | DENY | DENY (trigger-only, `handle_new_user`) |
| UPDATE | DENY | OWN ONLY, excl. `role`/`institution_id` | DENY | — | — | ALLOW (via `admin_promote_user`/`admin_demote_user`/`admin_set_institution_membership`, not raw UPDATE) |
| DELETE | DENY | DENY | DENY | — | — | DENY (no policy grants this — profiles are role-changed, never deleted) |

## `institutions`

| Operation | Anon | Ent-own | Ent-other | Inst-rel | Inst-none | Admin |
|---|---|---|---|---|---|---|
| SELECT | DENY | ALLOW (any authenticated) | ALLOW | ALLOW | ALLOW | ALLOW |
| INSERT | DENY | DENY | DENY | DENY | DENY | ALLOW |
| UPDATE | DENY | DENY | DENY | DENY | DENY | ALLOW |
| DELETE | DENY | DENY | DENY | DENY | DENY | ALLOW |

## `business_passports`

9 columns (`business_email`, `business_phone`, `head_office_address`, `key_clients`, `annual_turnover`, `business_health_score`, `readiness_score`, `profile_completeness`, `bbbee_expiry`) have `SELECT` **column-level revoked from `authenticated` entirely — including the owner.** They are FUNCTION ONLY (`get_passport_detail()`) for every role, no exceptions. The table below covers the remaining columns.

| Operation | Anon | Ent-own | Ent-other (unpublished) | Ent-other (published) | Inst-rel | Inst-none | Admin |
|---|---|---|---|---|---|---|---|
| SELECT (non-revoked cols) | DENY | ALLOW | DENY | ALLOW | ALLOW | ALLOW | ALLOW |
| SELECT (revoked cols) | DENY | FUNCTION ONLY | DENY | DENY | FUNCTION ONLY | DENY | FUNCTION ONLY |
| INSERT | DENY | OWN ONLY | — | — | DENY | DENY | ALLOW |
| UPDATE (non-scored cols) | DENY | OWN ONLY | DENY | DENY | DENY | DENY | ALLOW |
| UPDATE (scored/verification cols) | DENY | DENY (column-revoked) | DENY | DENY | DENY | DENY | DENY (column-revoked — only service-role writes reach these) |
| DELETE | DENY | OWN ONLY | DENY | DENY | DENY | DENY | ALLOW |

## `verifications`

| Operation | Anon | Ent-own | Ent-other | Inst-rel | Inst-none | Admin |
|---|---|---|---|---|---|---|
| SELECT (raw rows) | DENY | ALLOW | DENY | DENY (gets `verification_summary` via `get_passport_detail()` — FUNCTION ONLY) | DENY | ALLOW |
| INSERT | DENY | DENY | DENY | DENY | DENY | ALLOW |
| UPDATE (non-actor cols) | DENY | DENY | DENY | DENY | DENY | ALLOW |
| UPDATE (`verified_by`/`verified_at`) | DENY | DENY | DENY | DENY | DENY | DENY (column-revoked — trigger-only) |
| DELETE | DENY | DENY | DENY | DENY | DENY | ALLOW |

## `documents`

| Operation | Anon | Ent-own | Ent-other | Inst-rel | Inst-none | Admin |
|---|---|---|---|---|---|---|
| SELECT (raw table) | DENY | ALLOW | DENY | DENY (metadata via `list_passport_documents()` — FUNCTION ONLY; file via signed-url route) | DENY | ALLOW |
| INSERT (non-`status` cols) | DENY | OWN ONLY | DENY | DENY | DENY | ALLOW |
| INSERT/UPDATE `status` | DENY | DENY (column-revoked, defaults `pending_review`) | DENY | DENY | DENY | ALLOW |
| DELETE | DENY | DENY (no policy) | DENY | DENY | DENY | DENY (no policy either — KNOWN PRODUCT DECISION) |

## `business_references`

| Operation | Anon | Ent-own | Ent-other | Inst-rel (published) | Inst-none | Admin |
|---|---|---|---|---|---|---|
| SELECT (non-contact cols) | DENY | ALLOW | DENY | ALLOW | DENY | ALLOW |
| SELECT (`reference_contact`) | DENY | DENY (column-revoked, incl. owner) | DENY | DENY | DENY | ALLOW |
| INSERT | DENY | OWN ONLY | DENY | DENY | DENY | — |
| UPDATE | DENY | OWN ONLY | DENY | DENY | DENY | — |
| DELETE | DENY | OWN ONLY | DENY | DENY | DENY | — |

## `opportunities`

| Operation | Anon | Ent (any) | Inst-own | Inst-other | Admin |
|---|---|---|---|---|---|
| SELECT | DENY | ALLOW if `status='active'` | ALLOW | DENY | ALLOW |
| INSERT | DENY | DENY | OWN institution_id only; `created_by` forced/preserved correctly | DENY | ALLOW |
| UPDATE (non-`created_by`) | DENY | DENY | OWN ONLY | DENY | ALLOW |
| UPDATE `created_by` | DENY | DENY | DENY (immutable, unconditional trigger) | DENY | DENY (same trigger applies to admin too) |
| DELETE | DENY | DENY | OWN ONLY | DENY | ALLOW |

## `matches`

Write-locked entirely — no `authenticated` INSERT/UPDATE/DELETE policy exists for any role; only the `match-businesses` service-role writes.

| Operation | Anon | Ent-own-passport | Ent-other-passport | Inst-own-opp | Inst-other-opp | Admin |
|---|---|---|---|---|---|---|
| SELECT | DENY | ALLOW | DENY | ALLOW | DENY | ALLOW |
| INSERT/UPDATE/DELETE | DENY | DENY | DENY | DENY | DENY | DENY (service-role only) |

## `applications`

| Operation | Anon | Ent-own | Ent-other | Inst-own-opp | Inst-other | Admin |
|---|---|---|---|---|---|---|
| SELECT | DENY | ALLOW | DENY | ALLOW | DENY | ALLOW |
| INSERT | DENY | OWN ONLY, forced `status='submitted'` | DENY | DENY | DENY | ALLOW |
| UPDATE `status` | DENY | OWN ONLY, only → `withdrawn` | DENY | OWN opportunity only | DENY | ALLOW |
| UPDATE `reviewed_by`/`reviewed_at` | DENY | DENY (column-revoked) | DENY | DENY (trigger-only) | DENY | DENY (trigger-only, even for admin) |
| UPDATE `opportunity_id`/`passport_id` | DENY | DENY (immutable) | DENY | DENY (immutable) | DENY | ALLOW (admin's `for all` has no WITH CHECK here — deliberate, for corrections) |
| DELETE | DENY | DENY (no policy) | DENY | DENY (no policy) | DENY | ALLOW |

## `shortlists`

| Operation | Anon | Ent (any) | Inst-own | Inst-other | Admin |
|---|---|---|---|---|---|
| SELECT | DENY | DENY (no entrepreneur policy) | OWN ONLY | DENY | **no explicit admin policy — gap, see below** |
| INSERT | DENY | DENY | OWN institution_id, `created_by=auth.uid()`, target must be `is_published=true` | DENY | — |
| UPDATE | DENY | DENY | DENY (no UPDATE policy — relationships insert/delete, never mutate) | DENY | — |
| DELETE | DENY | DENY | OWN ONLY | DENY | — |

**Gap found while building this matrix:** no admin policy exists on `shortlists` at all — admin cannot SELECT/manage entries via RLS (would need service role). Not an over-exposure; a functionality gap. **KNOWN PRODUCT DECISION.**

## `notifications`

| Operation | Anon | Own (recipient) | Other | Admin |
|---|---|---|---|---|
| SELECT | DENY | OWN ONLY | DENY | **no explicit admin policy — same gap** |
| INSERT | DENY | DENY | DENY | DENY (service-role only) |
| UPDATE (`is_read` only) | DENY | OWN ONLY | DENY | — |
| UPDATE (content cols) | DENY | DENY (column-revoked) | DENY | — |
| DELETE | DENY | DENY (no policy) | DENY | — |

## `messages`

No `UPDATE` grant exists for `authenticated` at all as of migration 010 — `is_read` is set exclusively via `mark_message_read()`.

| Operation | Anon | Sender/Recipient | Third party | Admin |
|---|---|---|---|---|
| SELECT | DENY | OWN ONLY | DENY | **no explicit admin policy — same gap** |
| INSERT | DENY | `sender_id=auth.uid()` only | — | — |
| UPDATE (raw SQL) | DENY | DENY (no grant) | DENY | — |
| UPDATE via `mark_message_read()` | DENY | ALLOW (recipient only) | DENY | — |
| DELETE | DENY | DENY (no policy) | DENY | — |

## `audit_logs`

Fully immutable — no UPDATE/DELETE policy for **any** role, including admin.

| Operation | Anon | Non-admin authenticated | Admin |
|---|---|---|---|
| SELECT | DENY | DENY | ALLOW |
| INSERT/UPDATE/DELETE | DENY | DENY | DENY (INSERT is service-role/function only; UPDATE/DELETE unconditionally denied to everyone) |

## `passport_activity`

| Operation | Anon | Ent-own | Ent-other | Inst (any) | Admin |
|---|---|---|---|---|---|
| SELECT (raw table) | DENY | ALLOW | DENY | DENY (owner/admin only — `get_passport_activity()` has no institution tier) | ALLOW |
| INSERT/UPDATE/DELETE | DENY | DENY | DENY | DENY | DENY (written only by `SECURITY DEFINER` functions; immutable once written) |

## `trust_score_history`

| Operation | Anon | Ent-own | Ent-other | Inst (any) | Admin |
|---|---|---|---|---|---|
| SELECT (raw table) | DENY | ALLOW | DENY | DENY (current score only, via `get_passport_detail()` tier 1 — never the trend) | ALLOW |
| INSERT/UPDATE/DELETE | DENY | DENY | DENY | DENY | DENY (service-role INSERT only, via `calculate-trust-score`; immutable history) |

## `rate_limits`

Fully closed — zero policies grant `authenticated` anything.

| Operation | Anon | Any authenticated | Admin | service_role |
|---|---|---|---|---|
| SELECT/INSERT/UPDATE | DENY | DENY | DENY | ALLOW (via `check_rate_limit()`) |
| DELETE | DENY | DENY | DENY | N/A — no cleanup path built yet (documented TODO in migration 008) |

## `institution_business_directory` (view)

`security_invoker = true`, inherits `business_passports`' base RLS, fixed column allowlist structurally excludes all 9 sensitive fields regardless of caller.

| Operation | Anon | Ent (any) | Inst (published only) | Admin |
|---|---|---|---|---|
| SELECT | DENY | ALLOW | ALLOW | ALLOW |
| INSERT/UPDATE/DELETE | N/A — read-only view | | | |

## Gaps surfaced by building this matrix (not previously named this explicitly)

Three tables — `shortlists`, `notifications`, `messages` — have **no explicit admin SELECT policy**. Not a live exposure (nothing is over-permissioned), but it means an admin moderation/support UI for any of these three would currently need the service role rather than admin's own RLS-scoped session. Logged as a **KNOWN PRODUCT DECISION** — not fixed by reflexively adding `is_admin()` policies without a concrete admin UI driving the need.

## CRITICAL CORRECTION (post real-execution testing, migration 021/023/024)

This matrix was built from *reading* the migration SQL. Real execution against actual Postgres subsequently found that every "column-level revoke" enforcement described above (business_passports SELECT/UPDATE/INSERT, documents INSERT/UPDATE, applications UPDATE, verifications UPDATE, notifications UPDATE, business_references SELECT) had been **silently non-functional** — a table-level grant defeats a column-level revoke in Postgres, and Supabase's real baseline grants exactly that at the table level. The DENY outcomes shown in this matrix for those specific cells are now correct **because of migration 021's fix** (revoke-table-then-grant-columns), not because of the mechanism originally described when this matrix was first written. Also: `applications`/`notifications` `WITH CHECK` immutability was rewritten as triggers (migration 023) after the original self-correlated-subquery version caused RLS infinite recursion. See `SECURITY_AUDIT_MASTER.md`'s eighth-pass section for the full account — 116/116 pgTAP assertions now pass under real execution, which is what actually substantiates every DENY in this document, not the SQL reading alone.
