-- ====================================================================
-- CRITICAL FIX: graduated Business Passport access was never enforced
-- at the database layer for SELECT — only for UPDATE
-- ====================================================================
-- Confirmed by direct inspection before writing this migration: grep
-- across every prior migration for `revoke select` on business_passports
-- returns zero results. Migration 005 revoked UPDATE on the sensitive
-- columns (trust_score, is_published, etc.) — real and correct — but
-- never touched SELECT. RLS row policies ("passports: published
-- readable by institutions") only gate WHICH ROWS are visible, not
-- WHICH COLUMNS. This means every migration since 011 that built
-- get_passport_detail() as "the authoritative graduated-access path" was
-- true only by convention — any institution with a valid session could
-- call `supabase.from("business_passports").select("*")` directly via
-- the REST API for any published passport and receive business_email,
-- business_phone, head_office_address, key_clients, and annual_turnover
-- regardless of whether they had any shortlist/application relationship
-- at all. get_passport_detail() existed; nothing stopped bypassing it.
--
-- This is the real critical finding of this pass — not a re-statement
-- of something already fixed.
--
-- Fix: column-level REVOKE SELECT on every tier-2 and tier-3 field from
-- `authenticated`, full stop — including for the owner. This is
-- deliberate: column grants apply per-role, not per-row, so there is no
-- way to grant "owner may SELECT this column on their own row only" at
-- the grant layer. The owner reads their own sensitive fields through
-- get_passport_detail() too (which already returns full tier-3 data to
-- the owner, unchanged) — there is now exactly ONE path to these
-- columns for everyone, including the owner, which is also exactly what
-- "one intentional path" for sensitive data means in practice, not just
-- for institutions.

revoke select (
  business_email,
  business_phone,
  head_office_address,
  key_clients,
  annual_turnover,
  business_health_score,
  readiness_score,
  profile_completeness,
  bbbee_expiry
) on public.business_passports from authenticated;

comment on table public.business_passports is
  'CRITICAL: business_email, business_phone, head_office_address, key_clients, annual_turnover, business_health_score, readiness_score, profile_completeness, bbbee_expiry have SELECT revoked from authenticated entirely (migration 017) — this includes the owner. The ONLY way to read these columns, for anyone, is get_passport_detail() (SECURITY DEFINER, bypasses this grant by running as the function owner). A direct `.select("*")` or `.select("business_email")` against this table will now fail with "permission denied for column" for every authenticated caller, which is the intended enforcement, not a bug — see SECURITY_AUDIT_MASTER.md Phase 1 for the full writeup of why this had to be a hard database boundary rather than a frontend convention. Trust/verification columns (trust_score, overall_verification_status, is_published, owner_id, passport_code) remain SELECT-able (needed for discovery/matching/ownership display) but UPDATE-revoked per migration 005 — SELECT and UPDATE privileges are tracked independently here, deliberately.';
