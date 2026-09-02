-- ====================================================================
-- Admin provisioning: promote/demote functions for admins
-- ====================================================================
-- The bootstrap admin (the very first one) is provisioned out-of-band —
-- direct SQL against the database, documented in SUPABASE_SETUP.md —
-- because there's no admin yet to authorize it through the app, and a
-- stored bootstrap secret/token is itself a standing risk ("no
-- permanent bootstrap secret should remain active"). Every admin AFTER
-- the first is provisioned through the functions below, which require
-- the caller to already be an admin.

create or replace function public.admin_promote_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_role public.user_role;
begin
  if not public.is_admin() then
    raise exception 'Only admins may promote users to admin';
  end if;

  select role into v_target_role from public.profiles where id = target_user_id;
  if v_target_role is null then
    raise exception 'Target user not found';
  end if;
  if v_target_role = 'admin' then
    raise exception 'User is already an admin';
  end if;

  update public.profiles set role = 'admin' where id = target_user_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, changes)
  values (auth.uid(), 'admin.promoted', 'profile', target_user_id, jsonb_build_object('previous_role', v_target_role, 'new_role', 'admin'));
end;
$$;

create or replace function public.admin_demote_user(target_user_id uuid, new_role public.user_role)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_count int;
begin
  if not public.is_admin() then
    raise exception 'Only admins may demote another admin';
  end if;
  if new_role = 'admin' then
    raise exception 'Use admin_promote_user to grant admin, not admin_demote_user';
  end if;

  -- Last-admin protection: never allow the platform to end up with zero
  -- admins, which would be an unrecoverable lockout without direct DB
  -- access.
  select count(*) into v_admin_count from public.profiles where role = 'admin';
  if v_admin_count <= 1 then
    raise exception 'Cannot demote the last remaining admin';
  end if;

  update public.profiles set role = new_role where id = target_user_id and role = 'admin';
  if not found then
    raise exception 'Target user not found or is not currently an admin';
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, changes)
  values (auth.uid(), 'admin.demoted', 'profile', target_user_id, jsonb_build_object('previous_role', 'admin', 'new_role', new_role));
end;
$$;

comment on function public.admin_promote_user is
  'The only sanctioned path to create an admin after the initial bootstrap admin. Requires the caller to already be an admin. Every call is audited.';
comment on function public.admin_demote_user is
  'Demotes an admin to entrepreneur/institution. Refuses to demote the last remaining admin. Every call is audited.';

grant execute on function public.admin_promote_user(uuid) to authenticated;
grant execute on function public.admin_demote_user(uuid, public.user_role) to authenticated;
-- Execute grants are safe to give broadly here because the functions
-- self-enforce is_admin() internally (SECURITY DEFINER + explicit
-- check) — a non-admin calling this gets a raised exception, not access.
