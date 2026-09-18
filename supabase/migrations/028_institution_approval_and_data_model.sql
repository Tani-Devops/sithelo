-- ====================================================================
-- Migration 028: institution profile data model + approval workflow
--
-- PROBLEM 1 (data model): complete_institution_onboarding() (migration
-- 027) only ever wrote `name` and `institution_type` to public.institutions
-- -- everything else the onboarding form collects (province, municipality,
-- website, primary contact name/email/phone, description, focus_area) was
-- recorded ONLY inside audit_logs.changes, because those columns didn't
-- exist on institutions yet. That made the audit log the de facto
-- system-of-record for the institution's own profile, which is backwards:
-- audit_logs exists to record that a change happened, not to hold the
-- current state. This migration adds the missing columns so the
-- institution's current profile lives on the institution row itself,
-- where RLS ("institutions: read all authenticated") already lets
-- anyone read it and admins can review it directly.
--
-- PROBLEM 2 (trust): today, an institution-role account that completes
-- onboarding gets a fully live institution row with no distinct notion
-- of "reviewed" — nothing stops it from immediately posting an `active`
-- opportunity and presenting itself as an approved Sithelo institution.
-- Before a controlled pilot, that's not acceptable. This migration adds
-- an approval_status lifecycle (pending -> approved / rejected) and an
-- admin-only decision function, and a later migration (029) is not
-- needed for this specific rule because the enforcement point that
-- matters -- "an unapproved institution cannot publish an active
-- opportunity" -- is added directly below as a trigger on `opportunities`,
-- since that trigger must fire regardless of which client (including the
-- service-role-backed create-opportunity edge function) performs the
-- write. RLS alone would not catch a service-role write; a trigger does.
--
-- PRODUCTION DATA SAFETY: institutions that already exist today were
-- created before this concept existed and have, in practice, already
-- been operating (posting opportunities, reviewing applications) under
-- implicit trust. Retroactively marking them all "pending" would lock
-- real institutions out of their own opportunities the moment this
-- migration runs. So: the new column is added with a default of
-- 'pending' (which is what every NEW institution should start as), and
-- then a one-time backfill immediately approves every institution that
-- already existed before this migration. Only institutions onboarded
-- from this point forward go through real admin review.
-- ====================================================================

create type public.institution_approval_status as enum ('pending', 'approved', 'rejected');

alter table public.institutions
  add column approval_status public.institution_approval_status not null default 'pending',
  add column province public.sa_province,
  add column municipality text,
  add column website text,
  add column primary_contact_name text,
  add column primary_contact_email text,
  add column primary_contact_phone text,
  add column description text,
  add column focus_area text,
  add column reviewed_by uuid references public.profiles(id),
  add column reviewed_at timestamptz,
  add column rejection_reason text;

create index idx_institutions_approval_status on public.institutions(approval_status);

-- One-time backfill: every institution that existed before this
-- migration was already operating under the old (no-approval) model --
-- grandfather them in as approved rather than retroactively blocking
-- them. This intentionally runs unconditionally right after the column
-- add, before any new institution can exist with approval_status =
-- 'pending' from a real onboarding call, so it only ever touches
-- pre-existing rows.
update public.institutions
set approval_status = 'approved', reviewed_at = now()
where approval_status = 'pending';

-- --------------------------------------------------------------------
-- Re-point complete_institution_onboarding() (027) at the real columns
-- instead of audit_logs.changes. Ownership/role/rate-limit checks are
-- unchanged from 027 -- only what happens to the descriptive fields
-- changes.
-- --------------------------------------------------------------------
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
    name, institution_type, primary_contact_id, approval_status,
    province, municipality, website,
    primary_contact_name, primary_contact_email, primary_contact_phone,
    description, focus_area
  ) values (
    trim(p_name), nullif(trim(coalesce(p_institution_type, '')), ''), v_user_id, 'pending',
    p_province, nullif(trim(coalesce(p_municipality, '')), ''), nullif(trim(coalesce(p_website, '')), ''),
    nullif(trim(coalesce(p_contact_name, '')), ''), trim(p_contact_email), nullif(trim(coalesce(p_contact_phone, '')), ''),
    nullif(trim(coalesce(p_description, '')), ''), nullif(trim(coalesce(p_focus_area, '')), '')
  )
  returning id into v_institution_id;

  update public.profiles set institution_id = v_institution_id where id = v_user_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, changes)
  values (
    v_user_id, 'institution.onboarded', 'institution', v_institution_id,
    jsonb_build_object('name', trim(p_name), 'contact_email', trim(p_contact_email))
  );

  return query select v_institution_id;
end;
$$;

comment on function public.complete_institution_onboarding is
  'Atomic self-service institution onboarding (027, re-pointed at real institutions columns in 028): creates a new institutions row with approval_status = pending and links the calling institution-role user to it in one transaction. Cannot attach a caller to an EXISTING institution, cannot be called twice by the same user, cannot be called by a non-institution-role account, and cannot set approval_status to anything other than pending -- approval is exclusively a decision made through admin_review_institution().';

revoke all on function public.complete_institution_onboarding from public;
grant execute on function public.complete_institution_onboarding to authenticated;

-- --------------------------------------------------------------------
-- Admin decision function. This is the ONLY sanctioned way
-- approval_status ever moves out of 'pending' -- institutions has no
-- client-facing UPDATE policy for non-admins (see "institutions: admin
-- manage" in migration 002), so a client can never set this column
-- directly regardless of this function's existence. is_admin() is
-- re-checked here too, defense-in-depth, exactly like every other
-- admin-only RPC in this codebase (e.g. mark_message_read's counterparts).
-- --------------------------------------------------------------------
create or replace function public.admin_review_institution(
  p_institution_id uuid,
  p_decision text, -- 'approve' | 'reject'
  p_notes text default null
)
returns table (institution_id uuid, approval_status public.institution_approval_status)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid := auth.uid();
  v_current_status public.institution_approval_status;
  v_contact_id uuid;
  v_new_status public.institution_approval_status;
begin
  if v_admin_id is null or not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if p_decision not in ('approve', 'reject') then
    raise exception 'invalid_decision' using errcode = '22023';
  end if;

  select approval_status, primary_contact_id into v_current_status, v_contact_id
  from public.institutions where id = p_institution_id for update;

  if v_current_status is null then
    raise exception 'institution_not_found' using errcode = 'P0002';
  end if;
  if v_current_status <> 'pending' then
    raise exception 'institution_already_reviewed' using errcode = 'P0001';
  end if;

  v_new_status := case when p_decision = 'approve' then 'approved' else 'rejected' end;

  update public.institutions
  set approval_status = v_new_status,
      reviewed_by = v_admin_id,
      reviewed_at = now(),
      rejection_reason = case when p_decision = 'reject' then p_notes else null end
  where id = p_institution_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, changes)
  values (v_admin_id, 'institution.' || p_decision || 'd', 'institution', p_institution_id,
    jsonb_build_object('decision', p_decision, 'notes', p_notes));

  if v_contact_id is not null then
    insert into public.notifications (recipient_id, category, title, body, metadata)
    values (
      v_contact_id, 'approval',
      case when p_decision = 'approve' then 'Your institution was approved' else 'Your institution registration needs attention' end,
      case when p_decision = 'approve'
        then 'Your institution has been approved on Sithelo. You can now publish active opportunities.'
        else coalesce('Your institution registration was not approved. ' || p_notes, 'Your institution registration was not approved.')
      end,
      jsonb_build_object('institution_id', p_institution_id)
    );
  end if;

  return query select p_institution_id, v_new_status;
end;
$$;

comment on function public.admin_review_institution is
  'The only path by which institutions.approval_status ever leaves pending. Re-checks is_admin() itself (defense in depth on top of the fact that institutions has no client UPDATE policy for non-admins), locks the row FOR UPDATE to avoid a double-decision race, and only ever acts on institutions currently pending -- an already-approved or already-rejected institution must be handled by a deliberate follow-up decision, not silently overwritten by a second call.';

revoke all on function public.admin_review_institution from public;
grant execute on function public.admin_review_institution to authenticated;

-- --------------------------------------------------------------------
-- Enforcement point that actually matters: an opportunity cannot become
-- (or be created as) 'active' unless its institution is approved. This
-- is a trigger, not an RLS policy, because create-opportunity (the edge
-- function) writes via the service role, which bypasses RLS entirely --
-- a trigger is the only enforcement point that fires unconditionally
-- for every writer, RLS-exempt service role included.
-- --------------------------------------------------------------------
create or replace function public.enforce_institution_approved_for_active_opportunity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.institution_approval_status;
begin
  if new.status = 'active' then
    select approval_status into v_status from public.institutions where id = new.institution_id;
    if v_status is distinct from 'approved' then
      raise exception 'institution_not_approved: institution % is not approved and cannot publish an active opportunity', new.institution_id
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_institution_approved_for_active_opportunity() from public;

drop trigger if exists trg_opportunity_requires_approved_institution on public.opportunities;
create trigger trg_opportunity_requires_approved_institution
  before insert or update on public.opportunities
  for each row execute function public.enforce_institution_approved_for_active_opportunity();

comment on trigger trg_opportunity_requires_approved_institution on public.opportunities is
  'Blocks status=active on insert or update unless the owning institution.approval_status = approved. Fires for every writer including the service-role client used by the create-opportunity edge function, which RLS alone would not catch.';
