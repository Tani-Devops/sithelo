-- ====================================================================
-- Migration 027: institution onboarding
--
-- Bug being fixed: src/lib/auth/guards.ts's requireInstitution() has
-- always redirected an institution-role user with no institution_id to
-- /institution/onboarding, but that route never existed — every
-- institution registration (src/app/register/page.tsx supports
-- role=institution today) lands in a redirect to a 404. There is no
-- way, today, for a self-registered institution user to ever reach a
-- working dashboard.
--
-- Why a new function rather than a plain client-side insert: migration
-- 005 already closed the one obvious way to "fix" this — it explicitly
-- REVOKEs UPDATE (institution_id) on profiles from authenticated and
-- makes RLS on institutions admin-only for INSERT/UPDATE ("institutions:
-- admin manage"). That fix was for a real vulnerability (an institution
-- user rewriting their own institution_id to another institution's id
-- and inheriting that institution's opportunities/applications/
-- shortlists). This migration does not reopen that gap: it does not let
-- a caller attach themselves to an EXISTING institution at all — the
-- only thing this function can do is create a brand-new institution row
-- and link the caller, once, to that new row. Existing institution_id
-- values are never touched by this path.
--
-- Mirrors the pattern already established for entrepreneur onboarding
-- (migration 026 / complete_entrepreneur_onboarding): one Postgres
-- transaction, security definer, ownership taken exclusively from
-- auth.uid(), so a partial failure can never leave a half-linked user
-- or an orphaned institution row.
-- ====================================================================

create or replace function public.complete_institution_onboarding(
  p_name text,
  p_institution_type text default null,
  p_province public.sa_province default null,
  p_municipality text default null,
  p_website text default null,
  p_contact_name text default null,
  p_contact_email text default null,
  p_contact_phone text default null,
  p_description text default null,
  p_focus_area text default null
)
returns table (institution_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_role public.user_role;
  v_existing_institution_id uuid;
  v_institution_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select role, institution_id into v_role, v_existing_institution_id
  from public.profiles where id = v_user_id;

  if v_role is null then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;

  -- Only institution-role accounts may run this, and only once. This is
  -- what stops the function being used as a side door for an
  -- entrepreneur or admin to acquire an institution_id, and what stops
  -- an already-linked institution user from silently creating (and
  -- switching themselves to) a second institution.
  if v_role <> 'institution' then
    raise exception 'not_an_institution_account' using errcode = '42501';
  end if;
  if v_existing_institution_id is not null then
    raise exception 'already_onboarded' using errcode = 'P0001';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'name_required' using errcode = '22023';
  end if;
  if p_contact_email is null or length(trim(p_contact_email)) = 0 then
    raise exception 'contact_email_required' using errcode = '22023';
  end if;

  insert into public.institutions (
    name, institution_type, primary_contact_id
  ) values (
    trim(p_name), nullif(trim(coalesce(p_institution_type, '')), ''), v_user_id
  )
  returning id into v_institution_id;

  -- The only write to profiles.institution_id this function ever makes
  -- is for the calling user, to the institution it just created in this
  -- same transaction — never an arbitrary/pre-existing id, and never on
  -- behalf of another user. This is exactly the case migration 005's
  -- comment anticipated ("institution self-service onboarding, if built
  -- later, must call [a guarded function] rather than updating profiles
  -- directly").
  update public.profiles set institution_id = v_institution_id where id = v_user_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, changes)
  values (
    v_user_id, 'institution.onboarded', 'institution', v_institution_id,
    jsonb_build_object(
      'name', trim(p_name),
      'province', p_province,
      'municipality', p_municipality,
      'contact_email', trim(p_contact_email)
    )
  );

  -- Contact details, website, description and focus area beyond `name`/
  -- `institution_type`/`primary_contact_id` are not columns on
  -- `institutions` today (see 001_core_schema.sql) — rather than widen
  -- the core table for fields that are only used once at onboarding
  -- time, they're recorded in the audit log above so they're not lost,
  -- and surfaced to admins there. A future migration can add dedicated
  -- columns if institutions need to edit these after onboarding.

  return query select v_institution_id;
end;
$$;

comment on function public.complete_institution_onboarding is
  'Atomic self-service institution onboarding: creates a new institutions row and links the calling institution-role user to it in one transaction. Cannot be used to attach a caller to an EXISTING institution (only a freshly created one), cannot be called twice by the same user, and cannot be called by a non-institution-role account. This is the only sanctioned self-service path that touches profiles.institution_id -- see migration 005, which revoked direct client UPDATE on that column after a tenant-isolation vulnerability.';

revoke all on function public.complete_institution_onboarding from public;
grant execute on function public.complete_institution_onboarding to authenticated;
