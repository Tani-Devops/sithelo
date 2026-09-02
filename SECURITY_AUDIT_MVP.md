# SECURITY_AUDIT_MVP.md — Sithelo MVP build pass (Aug 2026)

Scope note: this document is the MVP-directive-required deliverable (§42). The detailed reasoning lives in SECURITY_AUDIT_MASTER.md's "Aug 2026 pass" section — this is the condensed version for someone deciding whether to ship.

## New attack surface introduced this pass

Seven new tables (migration 025), two new Route Handlers (`/api/persona/recompute`, `/api/onboarding/complete`), and the pages/server actions that call them.

## Regression checklist (directive §37), evaluated against this pass's changes

| Risk | Applies to this pass? | Status |
|---|---|---|
| Role escalation | No new role logic added | N/A — unchanged |
| `institution_id` reassignment | Not touched | N/A — unchanged |
| Passport self-verification | `business_capabilities.verified` is the new equivalent — column-revoke-then-grant applied (migration 021 pattern) | Addressed in migration 025 |
| Graduated passport access | `get_passport_detail()` untouched; new edit page reads via that RPC, doesn't bypass it | Unchanged, verified by inspection |
| Direct SELECT bypass | New reality tables have zero institution SELECT policy — nothing to bypass into | Addressed by design (no grant exists) |
| Shortlist authorization | Not touched | N/A — unchanged |
| Relationship oracle | `owns_passport_for()`/`owns_entrepreneur_profile()` are new but follow the same `security definer` + `set search_path = public` shape as `has_passport_relationship()` | Addressed, pattern-consistent |
| `reviewed_by` forgery | Not touched | N/A — unchanged |
| Opportunity `created_by` forgery | `/institution/opportunities/new` posts through the existing `create-opportunity` edge function unchanged — the form never sets `created_by`/`institution_id` | Unchanged, verified by inspection |
| Reference contact exposure | Not touched | N/A — unchanged |
| Message body modification | Not touched | N/A — unchanged |
| Notification modification | Not touched | N/A — unchanged |
| Signed URL access | Not touched | N/A — unchanged |
| Document access | Not touched | N/A — unchanged |
| Rate limiting | `/api/persona/recompute` calls the existing `check_rate_limit` RPC before writing; `/api/onboarding/complete` relies on the one-passport-per-owner check (409 on retry) rather than a separate rate limit — acceptable since it can only meaningfully succeed once per user | Addressed / accepted |
| `SECURITY DEFINER` grants | Both new helper functions (`owns_entrepreneur_profile`, `owns_passport_for`) are `security definer` with `set search_path = public`, matching the required pattern exactly | Addressed |
| `search_path` | Set explicitly on both new functions | Addressed |
| Service-role boundaries | `entrepreneur_persona_state` has literally no `authenticated` write grant — the strictest boundary in the schema so far, stricter than anything in the pre-existing tables | Addressed |

## The one new privacy bypass class this layer specifically had to avoid (directive §37: "must not create a new privacy bypass")

Institution read access to `business_capabilities`/`business_assets` is scoped to `is_published = true`, reusing the exact condition already governing `business_passports` and `institution_business_directory` — not a new or independently-derived condition that could drift out of sync with the existing publish gate. The five genuinely sensitive tables (`entrepreneur_profiles` and its four children) get no institution policy of any kind, which is a stronger guarantee than a scoped one: there's no condition to get wrong.

## What "addressed" means here, honestly

Every row in the table above reflects design-time review against the actual migration 025 SQL and the actual calling code in the new Route Handlers/pages — not execution. See MVP_STATUS.md's NOT EXECUTED section: none of this has been confirmed by running it against real Postgres. The pgTAP file (`008_reality_persona_layer_security.test.sql`) encodes 16 of the checks above as executable assertions for whoever runs it next.

## Recommendation

Do not treat this document as a substitute for running `supabase test db` on staging. It documents what was *designed* to hold and *reasoned through* against the codebase's established security patterns — the same bar as reading code carefully, not the bar the project's prior security passes eventually reached (genuine `pg_prove` execution, 116/116, per SECURITY_AUDIT_MASTER.md). Reaching that same bar for migration 025 is the single highest-value next step before any further UI work builds on top of these tables.
