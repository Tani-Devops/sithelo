-- ====================================================================
-- Fix admin_set_institution_membership() — found via real test execution
-- ====================================================================
-- The function silently "succeeded" (updated institution_id) even when
-- the target user's role wasn't 'institution' — but the consistency
-- trigger (migration 016) then immediately auto-nulled it back, since
-- institution_id != null requires role = 'institution'. Net effect: an
-- admin calling this function against a non-institution user would see
-- no error, but the change wouldn't actually stick — confusing,
-- silent-failure behavior, found because a test asserted the change
-- "took effect" and it genuinely hadn't. Fixed by making the
-- precondition explicit: this function requires the target to already
-- be an institution-role user, and says so clearly if not, rather than
-- silently no-op-ing via an unrelated trigger the caller may not even
-- know exists.

create or replace function public.admin_set_institution_membership(
  target_user_id uuid,
  new_institution_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_role public.user_role;
begin
  if not public.is_admin() then
    raise exception 'Only admins may change institution membership';
  end if;

  select role into v_target_role from public.profiles where id = target_user_id;
  if v_target_role is null then
    raise exception 'Target user not found';
  end if;
  if v_target_role <> 'institution' then
    raise exception 'Target user must already have role=institution — use admin_promote_user or a dedicated role-change path first if converting a user to an institution account';
  end if;

  update public.profiles
  set institution_id = new_institution_id
  where id = target_user_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, changes)
  values (
    auth.uid(), 'institution_membership.changed', 'profile', target_user_id,
    jsonb_build_object('new_institution_id', new_institution_id)
  );
end;
$$;

comment on function public.admin_set_institution_membership is
  'Requires the target user to already have role=institution (migration 022, corrected after real test execution surfaced a silent-failure case) — this function changes WHICH institution someone belongs to, not their role.';
