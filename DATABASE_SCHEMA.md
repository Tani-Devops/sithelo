# Zenzele — Database Schema Reference

Full source: `supabase/migrations/001_core_schema.sql`. This is the human-readable index.

| Table | Purpose | Key relationships |
|---|---|---|
| `profiles` | Extends `auth.users`; role + identity | `institution_id` → institutions |
| `institutions` | Institution orgs (municipalities, DFIs, etc.) | `primary_contact_id` → profiles |
| `business_passports` | **Core entity.** Identity, scores, verification status | `owner_id` → profiles |
| `verifications` | One row per verification type (CIPC/SARS/VAT/etc.) per passport | `passport_id` → business_passports |
| `documents` | Uploaded certificates/files, storage-backed | `passport_id` → business_passports |
| `business_references` | Client references + ratings | `passport_id` → business_passports |
| `opportunities` | Procurement/funding/ED/partnership listings | `institution_id` → institutions |
| `matches` | Computed match scores (written only by `match-businesses`) | opportunity + passport |
| `applications` | Entrepreneur applications to opportunities | opportunity + passport |
| `shortlists` | Institution-saved businesses | institution + passport |
| `notifications` | In-app notification feed | `recipient_id` → profiles |
| `messages` | Direct messages, optionally tied to an opportunity | sender/recipient → profiles |
| `audit_logs` | Immutable, service-role-write-only | polymorphic `entity_type`/`entity_id` |
| `passport_activity` | Timeline shown on the passport page | `passport_id` → business_passports |
| `trust_score_history` | Sparkline data, one row per recalculation | `passport_id` → business_passports |
| `entrepreneur_profiles` | Human reality layer — 1:1 with a profile | `user_id` → profiles |
| `entrepreneur_financial_snapshots` | Self-reported revenue/expense/draw ranges, append-only history | `entrepreneur_profile_id` → entrepreneur_profiles |
| `entrepreneur_needs` | Stated needs (equipment, funding, etc.), with priority | `entrepreneur_profile_id` → entrepreneur_profiles |
| `entrepreneur_goals` | Stated 12-month goals | `entrepreneur_profile_id` → entrepreneur_profiles |
| `entrepreneur_persona_state` | Current Sithelo Persona — recalculable, never client-writable | `entrepreneur_profile_id` → entrepreneur_profiles (unique) |
| `business_capabilities` | What the business can do — institution-safe once published | `passport_id` → business_passports |
| `business_assets` | What the business owns — institution-safe once published | `passport_id` → business_passports |

Migration `025_entrepreneur_reality_persona.sql` (Aug 2026 pass) — see DATA_CLASSIFICATION.md's "Tier 0" section for the sensitivity model behind these seven tables.

## Enums

`user_role`, `verification_status`, `business_type`, `opportunity_type`, `opportunity_status`, `application_status`, `document_status`, `sa_province` — all defined at the top of `001_core_schema.sql`.

## Scores are always derived, never hand-edited

`trust_score`, `business_health_score`, `readiness_score`, `profile_completeness` on `business_passports` are written exclusively by the `calculate-trust-score` edge function. No UI should ever expose a direct edit control for these fields — if a number looks wrong, fix the underlying verification/document data and recalculate.

The same rule now applies to `entrepreneur_persona_state` in full — it isn't just UI convention there, it's enforced at the grant level (no `authenticated` INSERT/UPDATE at all). Persona is recomputed, from real stored data, via `src/lib/persona/recompute.ts` — called by both `/api/persona/recompute` and `/api/onboarding/complete` — never hand-edited and never computed by AI (see PRODUCT_REQUIREMENTS.md).

## RLS summary

See `002_rls_policies.sql` for the literal policies. Pattern used throughout: owners get `for all` on their own rows; institutions/admins get scoped `for select` on `is_published = true` passports only; writes to computed/audit tables are service-role only (no policy grants insert to `authenticated`).

## Storage buckets

See `003_storage_buckets.sql`: `passport-documents` (private), `passport-images` (public), `institution-logos` (public), `generated-pdfs` (private), `bulk-imports` (admin-only).
