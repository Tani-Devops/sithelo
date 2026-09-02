# Zenzele — Data Classification Model

## Three tiers

### 1. Discovery data — visible to any institution once a passport is published

`business_name`, `business_type`, `established_year`, `industry`, `sub_industry`, `province`, `municipality`, `business_description`, `core_services`, `equipment_owned`, `capacity_range`, `employees_count`, `years_trading`, `website`, `logo_url`, `cover_image_url`, `trust_score`, `overall_verification_status`, `bbbee_level`.

This is exactly the column set in `public.institution_business_directory` (migration 007). Institutions query this view for search/discovery, not `business_passports` directly.

### 2. Owner-private business data — visible only to the owner and admin

`head_office_address` (street-level, not just municipality), `business_email`, `business_phone`, `key_clients` (a business's named client relationships are themselves confidential — disclosing them isn't Zenzele's call to make on a business's behalf), `annual_turnover` (exact figure).

**Current state:** these remain on `business_passports` and are protected by the base table's RLS — an institution querying `business_passports` directly for a *published* passport still sees these columns today, because the existing `"passports: published readable by institutions"` policy is row-level (is the row visible) not column-level (which columns). The discovery view (tier 1) solves this for the search/browse path. It does **not** retroactively lock these columns on the base table, because that would also block the owner and admin from seeing their own/managed data if done carelessly, and because whether an institution should ever see full contact/financial detail — and under what condition — is a product decision, not a default I should invent. See "Open question" below.

### 3. Confidential compliance data — verifier/owner/admin only, never institution-visible via search

Raw uploaded documents (CIPC certificates, bank confirmation letters, insurance certificates, etc.) in the `passport-documents` storage bucket, and the `verifications` table's `reference_number`/`notes` columns. An institution should see *that* a business is CIPC-verified (the badge), never the certificate PDF itself, unless a specific, audited access grant says otherwise. See `DOCUMENT_ACCESS.md` for the signed-URL architecture that enforces this.

## Open question — not answered by this migration

~~The directive that prompted this classification says tier-2 data should be exposed "if the business interaction authorizes it"~~ **Resolved in migration 011** (`get_passport_detail()`): an institution unlocks tier-2 fields (`business_email`, `business_phone`, `head_office_address`, `key_clients`, `annual_turnover`) specifically when it has a `shortlists` entry or an `applications` row tying it to that business — the same relationship test already used to gate document access, deliberately reused so "authorized institution" means one consistent thing across the product, not two slightly different checks that could drift apart. Owner/admin get tier-3 (internal scoring detail) on top. Every non-owner access is audit-logged.

## Enforcement summary

| Tier | Enforced by |
|---|---|
| 1. Discovery | `institution_business_directory` view (migration 007) — column allowlist |
| 2. Owner-private | `business_passports` RLS (owner/admin only for these columns' *practical* visibility today — not yet column-separated for the institution-published case, see above) |
| 3. Confidential compliance | Private storage bucket + signed URLs (`DOCUMENT_ACCESS.md`) + `verifications` RLS (owner/admin only, no institution SELECT policy exists on that table's sensitive columns beyond what `verify-business-passport`'s readiness report already summarizes) |

## Tier 0 — Entrepreneur reality layer (migration 025, Aug 2026 pass)

Added for the "understand the person, not just the business" MVP (see PRODUCT_REQUIREMENTS.md). This is **more sensitive than tier 2** — it's personal/economic, not business — and is treated accordingly:

`entrepreneur_profiles` (dependants, household income dependency, transport/electricity/internet access, premises status), `entrepreneur_financial_snapshots` (self-reported revenue/expense/draw ranges — never exact figures, see onboarding wizard), `entrepreneur_needs`, `entrepreneur_goals`, `entrepreneur_persona_state` (the explanation of where someone is in their journey, which itself references the reality data above).

**Owner + admin only, full stop.** No institution policy exists on any of these five tables — not a narrower one, none at all. This is deliberate, not an oversight pending a future decision (unlike tier 2's "open question" above): institutions must never see household income, dependants, personal expenses, debt, or personal financial circumstances, and there is no product case (yet raised) where that changes. `entrepreneur_persona_state` additionally has no `authenticated` INSERT/UPDATE grant at all — even the owner cannot write their own persona; only the service-role recompute path (`/api/persona/recompute`, `/api/onboarding/complete`) can.

`business_capabilities` and `business_assets` are **not** tier 0 — they describe the business (what it can do, what it owns), not the person, so they follow tier 1's institution-safe-once-published rule, mirroring `business_passports`/`institution_business_directory` visibility. The one exception: `verified` on `business_capabilities` is owner-read-only (column-level revoke) — only an admin/backend process can mark a capability verified, matching how verification works everywhere else in the schema.

See `supabase/tests/database/008_reality_persona_layer_security.test.sql` for the RLS regression coverage (not yet executed against live Postgres — see MVP_STATUS.md).
