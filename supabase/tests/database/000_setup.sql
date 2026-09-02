-- ====================================================================
-- Test setup: pgTAP extension + a helper schema/function for switching
-- the DB session's effective identity between test users, mirroring
-- how PostgREST sets request.jwt.claims per request in production.
-- Run before 001_rls_security.test.sql (numeric prefix ensures order).
-- ====================================================================
create extension if not exists pgtap with schema extensions;

create schema if not exists test_helpers;

create or replace function test_helpers.act_as(p_user_id uuid, p_role text default 'authenticated')
returns void language plpgsql as $$
begin
  if p_user_id is null then
    perform set_config('request.jwt.claims', '{}', true);
  else
    perform set_config('request.jwt.claims', json_build_object('sub', p_user_id)::text, true);
  end if;
  perform set_config('role', p_role, true);
end;
$$;

-- Every subsequent call to act_as() within a test file runs AS whichever
-- role the PREVIOUS call switched to (authenticated/anon/service_role),
-- not as the superuser that ran this setup file — found via actual
-- execution, not assumed. Without these grants, the second act_as()
-- call in any test file fails with "permission denied for schema
-- test_helpers" before ever reaching the role-switch logic.
grant usage on schema test_helpers to authenticated, anon, service_role;
grant execute on function test_helpers.act_as(uuid, text) to authenticated, anon, service_role;
