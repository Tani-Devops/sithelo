-- ====================================================================
-- CRITICAL FIX: every purely column-level REVOKE (with no accompanying
-- RLS WITH CHECK or trigger) has been silently non-functional
-- ====================================================================
-- Discovered via actual execution against a real Postgres instance with
-- Supabase's real baseline grants replicated (GRANT ALL ON ALL TABLES
-- IN SCHEMA public TO authenticated — Supabase's own documented
-- platform convention, applied once at project provisioning, before any
-- application migration runs). Confirmed via a minimal isolated
-- reproduction, then a direct functional test:
--
--   grant update on t to authenticated;
--   revoke update (b) on t from authenticated;
--   set role authenticated; update t set b = 99;  -- SUCCEEDS
--
-- Postgres's column-level and table-level privileges are NOT layered
-- restrictively — a table-level GRANT UPDATE/SELECT makes the table
-- updatable/selectable on EVERY column regardless of a more specific
-- column-level REVOKE naming that column. The only way a column-level
-- REVOKE actually restricts anything is if NO table-level grant exists
-- to begin with — i.e., REVOKE the table-level privilege first, then
-- GRANT it back only on the specific columns that should remain
-- accessible. This is the inverse of the pattern used throughout
-- migrations 005/006/014/017/018/019, which all assumed "grant broad,
-- then revoke narrow" would work — it doesn't, given Supabase's real
-- baseline grants.
--
-- What this means concretely: the migration 017 "critical fix" closing
-- the Business Passport direct-SELECT bypass was NOT actually enforced
-- at the database layer this whole time — an institution could still
-- run .select("business_email") directly. Confirmed by direct
-- reproduction against real Postgres privilege semantics, not assumed.
--
-- What is NOT affected: RLS `WITH CHECK` subquery-based immutability
-- (profiles.institution_id/role, applications.opportunity_id/
-- passport_id) and trigger-based forcing (opportunities.created_by,
-- application status-transition-triggered reviewed_by) are a
-- completely separate mechanism from column grants and were confirmed,
-- by actually running the test suite, to work correctly. Only the
-- PURELY-column-revoke-based protections needed this fix.
--
-- NEWLY DISCOVERED gap while fixing this: applications.reviewed_by/
-- reviewed_at's trigger only forces the real actor when `status` is
-- ALSO changing in the same statement — a client sending `UPDATE
-- applications SET reviewed_by = 'forged'` with status unchanged was
-- never caught by the trigger OR by any WITH CHECK. This migration
-- closes that specifically, via the same revoke-table-grant-columns
-- pattern.

-- --------------------------------------------------------------------
-- business_passports
-- --------------------------------------------------------------------

revoke select on public.business_passports from authenticated;
grant select (
  id, owner_id, passport_code, business_name, registration_number,
  business_type, established_year, industry, sub_industry, province,
  municipality, business_description, core_services, equipment_owned,
  capacity_range, employees_count, years_trading, website, logo_url,
  cover_image_url, trust_score, overall_verification_status, bbbee_level,
  is_published, created_at, updated_at
) on public.business_passports to authenticated;
-- Deliberately excluded from SELECT: business_email, business_phone,
-- head_office_address, key_clients, annual_turnover,
-- business_health_score, readiness_score, profile_completeness,
-- bbbee_expiry — FUNCTION ONLY via get_passport_detail(), for everyone,
-- including the owner, for real this time.

revoke update on public.business_passports from authenticated;
grant update (
  business_name, registration_number, business_type, established_year,
  industry, sub_industry, province, municipality, head_office_address,
  business_description, core_services, key_clients, equipment_owned,
  capacity_range, employees_count, annual_turnover, years_trading,
  website, business_email, business_phone, logo_url, cover_image_url,
  bbbee_level, bbbee_expiry
) on public.business_passports to authenticated;
-- Deliberately excluded from UPDATE: trust_score, business_health_score,
-- readiness_score, profile_completeness, overall_verification_status,
-- is_published, owner_id, passport_code — matches migration 005's
-- original intent, now actually enforced.

-- INSERT was NEVER column-restricted at all, at any layer — an even
-- more severe variant of the same bug class, found while fixing this:
-- a malicious entrepreneur could create a BRAND NEW passport row with
-- trust_score=100, is_published=true, overall_verification_status=
-- 'verified' explicitly set in the INSERT statement itself, since the
-- RLS "passports: owner insert own" WITH CHECK only ever validated
-- owner_id, never the scored/verification fields.
revoke insert on public.business_passports from authenticated;
grant insert (
  owner_id, business_name, registration_number, business_type,
  established_year, industry, sub_industry, province, municipality,
  head_office_address, business_description, core_services, key_clients,
  equipment_owned, capacity_range, employees_count, annual_turnover,
  years_trading, website, business_email, business_phone, logo_url,
  cover_image_url, bbbee_level, bbbee_expiry
) on public.business_passports to authenticated;
-- trust_score/business_health_score/readiness_score/profile_completeness/
-- overall_verification_status/is_published/passport_code all excluded
-- from INSERT — every new passport starts at the column DEFAULTs
-- (trust_score=0, is_published=false, overall_verification_status=
-- 'unverified') regardless of what the client's INSERT statement
-- attempts to include.

-- --------------------------------------------------------------------
-- documents
-- --------------------------------------------------------------------

revoke insert on public.documents from authenticated;
grant insert (id, passport_id, document_type, file_path, file_name, issued_date, expiry_date, uploaded_by) on public.documents to authenticated;
-- status excluded — defaults to 'pending_review', for real this time.

revoke update on public.documents from authenticated;
-- No UPDATE columns granted at all — matches the original design intent
-- (no current UI updates a document post-upload); previously this
-- "restriction" was accidentally a no-op given the table-level grant.

-- --------------------------------------------------------------------
-- applications
-- --------------------------------------------------------------------

revoke update on public.applications from authenticated;
grant update (status, cover_note, opportunity_id, passport_id) on public.applications to authenticated;
-- reviewed_by/reviewed_at excluded entirely — trigger-only, for real
-- this time, closing the "status unchanged, reviewed_by forged" gap
-- found while fixing this. opportunity_id/passport_id remain grantable
-- at the column level because their immutability is independently
-- enforced by RLS WITH CHECK (a different, already-working mechanism)
-- — granting the column privilege doesn't bypass that.

-- --------------------------------------------------------------------
-- verifications
-- --------------------------------------------------------------------

revoke update on public.verifications from authenticated;
grant update (status, notes, reference_number, issued_date, expiry_date) on public.verifications to authenticated;
-- verified_by/verified_at excluded — trigger-only, for real this time.
-- (Only admins reach this via the "verifications: admin manage" RLS
-- policy in the first place; this column grant is the second, now
-- actually-functional layer underneath that.)

-- --------------------------------------------------------------------
-- notifications
-- --------------------------------------------------------------------

revoke update on public.notifications from authenticated;
grant update (is_read) on public.notifications to authenticated;
-- title/body/category/channel/metadata excluded, for real this time.

-- --------------------------------------------------------------------
-- business_references
-- --------------------------------------------------------------------

revoke select on public.business_references from authenticated;
grant select (id, passport_id, reference_name, reference_organisation, project_description, rating, created_at) on public.business_references to authenticated;
-- reference_contact excluded, for real this time — including from the
-- owner, same reasoning and same follow-up note as business_passports:
-- a future references-management UI needs a dedicated function.

-- --------------------------------------------------------------------
-- profiles — already correctly protected via RLS WITH CHECK (confirmed
-- working by actual test execution), but applying the same
-- revoke-table-grant-columns treatment for UPDATE anyway, for
-- consistency and genuine defense-in-depth now that it will actually
-- function as a second layer, not a no-op one.
-- --------------------------------------------------------------------

revoke update on public.profiles from authenticated;
grant update (full_name, cell_number, avatar_url) on public.profiles to authenticated;
-- role/institution_id excluded, for real this time (previously
-- "protected" only by the WITH CHECK subquery, which does work
-- independently — this is additional, not corrective, for profiles
-- specifically).

comment on table public.business_passports is
  'CRITICAL, corrected in migration 021: prior column-level REVOKEs (migration 005/017) were silently non-functional because a table-level GRANT (Supabase''s baseline platform grant to authenticated) made column-specific revokes irrelevant — Postgres column privileges do not override a broader table-level grant. Fixed by revoking table-level SELECT/UPDATE entirely and granting back only the intended columns. See migration 021''s header for the full account, discovered via actual execution, not assumed.';
