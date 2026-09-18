-- ====================================================================
-- Migration 030: Business Passport identifier prefix
--
-- business_passports.passport_code has defaulted to a 'ZEN-' prefix
-- since migration 001 (a stale reference to the project's previous
-- name). This changes the DEFAULT expression only, so every NEWLY
-- inserted passport from this point forward gets a 'SIT-' prefix.
--
-- Existing passport_code values are NOT touched. Passport codes are
-- unique, potentially already shared with an entrepreneur, printed,
-- or referenced elsewhere (applications, PDFs) -- rewriting issued
-- identifiers destructively would break those references for no
-- functional benefit. Historical ZEN- codes remain valid Sithelo
-- Business Passport identifiers; only the convention for future codes
-- changes.
-- ====================================================================

alter table public.business_passports
  alter column passport_code set default ('SIT-' || extract(year from now()) || '-' || lpad(floor(random()*99999)::text,5,'0'));

comment on column public.business_passports.passport_code is
  'Unique Business Passport identifier. Passports issued before migration 030 use a legacy ZEN- prefix (a stale pre-Sithelo project name) and are preserved as-is; every passport issued from migration 030 onward uses the SIT- prefix. Both prefixes are valid, currently-issued Sithelo identifiers -- do not treat ZEN- codes as invalid or attempt to migrate them.';
