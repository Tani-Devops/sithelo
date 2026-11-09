-- ====================================================================
-- BOOTSTRAP ADMIN — one-time, out-of-band provisioning
-- ====================================================================
-- The app's promotion path (admin_promote_user, migration 009) requires
-- the caller to ALREADY be an admin — circular for the very first admin.
-- A standing "bootstrap secret" in an edge function would itself be a
-- permanent privilege-escalation risk, so the least-standing-privilege
-- option is this manual, audited, one-time script.
--
-- HOW TO USE
-- 1. Register the target user through the app normally (role ends up
--    'entrepreneur' — client-supplied role is clamped, migration 004).
-- 2. Replace REPLACE_ME@example.com below with that user's signup email.
-- 3. Run this ENTIRE script once via the Supabase SQL editor or psql as
--    the postgres (project owner) role. It must NEVER be committed as a
--    migration and must NEVER run as an application role (anon /
--    authenticated / service_role).
-- 4. Discard/rotate this script. Promote every subsequent admin through
--    admin_promote_user() in the app instead.
--
-- Failure modes: raises if no profile matches the email; silently no-ops
-- if the user is already an admin (idempotent re-run safety); writes an
-- audit_logs entry either way so the promotion is on the record even
-- though it happened outside the app.
-- ====================================================================

do $$
declare
  v_profile_id uuid;
  v_was_admin boolean;
begin
  select id, (role = 'admin') into v_profile_id, v_was_admin
  from public.profiles
  where email = 'REPLACE_ME@example.com';

  if v_profile_id is null then
    raise exception 'No profile found for that email — register the user via the app first.';
  end if;

  update public.profiles set role = 'admin' where id = v_profile_id and role <> 'admin';

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, changes, metadata)
  values (
    null, -- no actor: this runs as the database owner, outside any user session
    'admin.bootstrap_promoted',
    'profile',
    v_profile_id,
    jsonb_build_object('new_role', 'admin', 'already_admin', v_was_admin),
    jsonb_build_object(
      'note', 'Provisioned via one-time out-of-band bootstrap script (supabase/scripts/bootstrap_admin.sql)'
    )
  );
end $$;
