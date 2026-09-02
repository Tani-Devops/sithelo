-- ====================================================================
-- ZENZELE DEMO SEED DATA
-- For local development only. DO NOT run against production.
-- Mirrors the example businesses/institutions used in the reference
-- design boards (Ubuntu Civils, Nomsa Manufacturing, City of Tshwane)
-- so the UI has realistic content to render against locally.
-- Requires corresponding auth.users rows to exist first (create via
-- Supabase Studio or the auth admin API, then update the UUIDs below).
-- ====================================================================

-- Institutions
insert into public.institutions (id, name, institution_type) values
  ('00000000-0000-0000-0000-000000000001', 'City of Tshwane', 'municipality'),
  ('00000000-0000-0000-0000-000000000002', 'Small Enterprise Development Agency (seda)', 'dfi');

-- NOTE: profiles rows require a matching auth.users.id (FK). In local dev,
-- create test users first via `supabase auth admin`, then insert profiles
-- and business_passports referencing those real UUIDs. Example shape:
--
-- insert into public.profiles (id, role, full_name, email) values
--   ('<real-auth-uid>', 'entrepreneur', 'Nomsa Dlamini', 'nomsa@example.co.za');
--
-- insert into public.business_passports (owner_id, business_name, registration_number,
--   business_type, industry, province, municipality, trust_score, overall_verification_status, is_published)
-- values
--   ('<real-auth-uid>', 'Ubuntu Civils (Pty) Ltd', '2020/123456/07', 'private_company',
--    'Construction & Civil Works', 'Gauteng', 'Ekurhuleni', 94, 'verified', true);
