-- ====================================================================
-- Business Passport data minimization for institution discovery
-- ====================================================================
-- Bug: institutions currently query business_passports directly for
-- search, which returns EVERY column once is_published=true —
-- head_office_address, business_email, business_phone, key_clients
-- (often named client relationships, themselves confidential), and
-- annual_turnover in full. "Published for matching" was being treated
-- as "published for full disclosure," which isn't the same thing and
-- was never a deliberate decision.
--
-- Fix: a view exposing only the columns appropriate for discovery/
-- matching. Institutions and admins query THIS, not business_passports
-- directly, for search. Full contact/financial detail remains behind
-- the existing owner/admin-only RLS on the base table — there is
-- currently no "engagement unlocks full profile" feature (e.g. after
-- shortlisting or a submitted application) to grant institutions
-- broader access; that's a real product decision to make deliberately,
-- not something this migration should invent unasked. Documented as
-- open in DATA_CLASSIFICATION.md rather than silently either exposing
-- or permanently withholding it.

create view public.institution_business_directory
with (security_invoker = true) as
select
  id,
  passport_code,
  business_name,
  business_type,
  established_year,
  industry,
  sub_industry,
  province,
  municipality,               -- city/town-level location, not head_office_address
  business_description,
  core_services,
  equipment_owned,
  capacity_range,
  employees_count,
  years_trading,
  website,                    -- a business's own public website is not confidential
  logo_url,
  cover_image_url,
  trust_score,
  overall_verification_status,
  bbbee_level,
  is_published
from public.business_passports
where is_published = true;

comment on view public.institution_business_directory is
  'Institution/admin search surface — deliberately excludes head_office_address, business_email, business_phone, key_clients, and annual_turnover. See DATA_CLASSIFICATION.md. `security_invoker = true` means this view still runs under the querying user''s own RLS on the base table, so it narrows what''s exposed on top of RLS, it does not substitute for RLS.';

-- security_invoker views don't get their own separate RLS policy set —
-- they inherit the base table's. The existing "passports: published
-- readable by institutions" policy on business_passports already scopes
-- this correctly (published rows, institution/admin caller); this grant
-- just makes the view itself queryable.
grant select on public.institution_business_directory to authenticated;
