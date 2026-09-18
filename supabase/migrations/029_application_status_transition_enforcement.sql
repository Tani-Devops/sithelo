-- ====================================================================
-- Migration 029: database-enforced application status transitions
--
-- GAP: enforce_application_integrity() (migration 023) already stops an
-- entrepreneur from setting any status other than 'withdrawn', and
-- already makes opportunity_id/passport_id immutable. It does NOT
-- constrain what an institution (or a forged direct API/DB call
-- authenticated as one) can set application.status to. Today, an
-- institution updating its own application row -- which RLS legitimately
-- allows, since it owns the opportunity -- can set status to ANY
-- application_status value from ANY current value: submitted -> awarded
-- directly, awarded -> shortlisted, rejected -> awarded, etc. The React
-- layer (src/app/institution/applications/page.tsx's ALLOWED_TRANSITIONS
-- map) only ever offers the legitimate next steps as buttons, but that
-- is a UX convenience, not a security boundary -- a direct PATCH to
-- Supabase's REST API bypasses it entirely.
--
-- FIX: extend the same trigger (replace, not duplicate -- there is
-- exactly one BEFORE UPDATE trigger on applications, and it should stay
-- that way) with:
--   1. A terminal-state lock: once an application reaches awarded,
--      rejected, or withdrawn, no further status change is accepted from
--      a non-admin caller, in either direction.
--   2. An explicit institution-side transition table, checked only when
--      status is actually changing and the caller is an institution:
--        submitted    -> under_review | rejected
--        under_review -> shortlisted  | rejected
--        shortlisted  -> awarded      | rejected
--      any other institution-attempted transition is rejected.
--   3. Everything from 023 (opportunity_id/passport_id immutability,
--      entrepreneur-can-only-withdraw) is preserved unchanged.
--
-- Admin remains exempt from the transition table (as it already was for
-- opportunity_id/passport_id immutability in 023) for legitimate manual
-- corrections -- but is still bound by ownership via RLS, and every
-- admin action is still audit-logged by the caller.
-- ====================================================================

create or replace function public.enforce_application_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role public.user_role;
  v_transition_ok boolean;
begin
  -- opportunity_id/passport_id immutable for everyone except admin.
  if not public.is_admin() then
    if new.opportunity_id is distinct from old.opportunity_id or new.passport_id is distinct from old.passport_id then
      raise exception 'opportunity_id and passport_id are immutable after an application is created';
    end if;
  end if;

  -- No status change at all: nothing further to check (e.g. a
  -- cover_note edit or a reviewed_by/reviewed_at trigger-only write).
  if new.status is not distinct from old.status then
    return new;
  end if;

  select role into v_caller_role from public.profiles where id = auth.uid();

  -- No resolvable caller role (service-role/migration/seed context, no
  -- authenticated session): skip role-specific transition enforcement
  -- rather than block legitimate operational writes with no session to
  -- evaluate. Admin is exempt from the transition table entirely, same
  -- as the immutability check above.
  if v_caller_role is null or public.is_admin() then
    return new;
  end if;

  -- Terminal states: once an application is awarded, rejected, or
  -- withdrawn, it is done. No non-admin caller -- institution or
  -- entrepreneur -- can move it anywhere else, including back into an
  -- earlier state or sideways into another terminal state.
  if old.status in ('awarded', 'rejected', 'withdrawn') then
    raise exception 'application_status_is_final: % is a terminal status and cannot be changed', old.status
      using errcode = '42501';
  end if;

  if v_caller_role = 'entrepreneur' then
    if new.status <> 'withdrawn' then
      raise exception 'Entrepreneurs may only withdraw an application, not set status to %', new.status
        using errcode = '42501';
    end if;
    return new;
  end if;

  if v_caller_role = 'institution' then
    v_transition_ok := case
      when old.status = 'submitted' and new.status in ('under_review', 'rejected') then true
      when old.status = 'under_review' and new.status in ('shortlisted', 'rejected') then true
      when old.status = 'shortlisted' and new.status in ('awarded', 'rejected') then true
      else false
    end;
    if not v_transition_ok then
      raise exception 'invalid_status_transition: % -> % is not a permitted institution transition', old.status, new.status
        using errcode = '42501';
    end if;
    return new;
  end if;

  -- Any other role reaching here (should not happen given RLS scoping
  -- applications to entrepreneur-owner/institution-owner/admin) is
  -- rejected by default rather than silently allowed.
  raise exception 'invalid_status_transition: role % may not change application status' , v_caller_role
    using errcode = '42501';
end;
$$;

comment on function public.enforce_application_integrity is
  'Extends migration 023: adds a terminal-state lock (awarded/rejected/withdrawn are final for non-admins) and an explicit institution-side transition table (submitted->under_review|rejected, under_review->shortlisted|rejected, shortlisted->awarded|rejected), on top of the existing opportunity_id/passport_id immutability and entrepreneur-can-only-withdraw rules. The React ALLOWED_TRANSITIONS map in src/app/institution/applications/page.tsx is UX only -- this trigger is the actual security boundary, and rejects a direct API/DB write that skips the UI.';

-- Trigger itself is unchanged (still the single trg_application_integrity
-- from migration 023, now pointing at the updated function body above --
-- CREATE OR REPLACE on the function is sufficient, no DROP/CREATE TRIGGER
-- needed).
