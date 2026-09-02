-- ====================================================================
-- CRITICAL FIX: self-correlated subqueries in WITH CHECK caused
-- infinite recursion — found via actual execution, not a live security
-- gap this time but an outright FEATURE-BREAKING bug
-- ====================================================================
-- Discovered running the real test suite: `UPDATE applications SET
-- status = 'awarded' ...` failed with "infinite recursion detected in
-- policy for relation applications". Root cause: migration 006's WITH
-- CHECK clauses used patterns like
--   opportunity_id = (select a2.opportunity_id from applications a2 where a2.id = applications.id)
-- — a subquery against the SAME table the policy protects, correlated
-- to the row currently being checked. Postgres's RLS recursion guard
-- rejects this outright. This is NOT like the profiles.role pattern
-- (`select role from profiles where id = auth.uid()`), which is safe
-- because it's filtered by a constant (auth.uid()) rather than
-- correlated to the outer row via primary key — that distinction is
-- exactly what determines whether Postgres detects a cycle.
--
-- Severity: WORSE than the migration 021 finding. That was silently
-- ineffective (attacks succeeded that should have failed). This
-- actively broke the feature for EVERYONE, including legitimate
-- callers — since WITH CHECK evaluates the full NEW row regardless of
-- which columns were in the client's SET clause, even a fully
-- legitimate `UPDATE notifications SET is_read = true` (the only
-- column authenticated even has UPDATE privilege on, per migration
-- 021's correct column-grant fix) would ALSO hit this same recursion
-- error, because the notification's title/body/etc WITH CHECK
-- conditions still get evaluated as part of the full-row check.
--
-- Fix: move immutability/transition-validation logic to triggers, which
-- have safe, native, non-recursive access to OLD/NEW — the same proven
-- pattern already used successfully for opportunities.created_by,
-- applications.reviewed_by, verifications.verified_by. RLS WITH CHECK
-- is simplified back to ownership/relationship checks only, which is
-- what RLS is actually good at; triggers handle "did this specific
-- column change appropriately." Now that migration 021 correctly
-- restricts which columns a client can even include in their SET
-- clause, the WITH CHECK-level column-value pinning was redundant
-- anyway, not just broken.

-- --------------------------------------------------------------------
-- applications
-- --------------------------------------------------------------------

drop policy if exists "applications: entrepreneur update own limited" on public.applications;
drop policy if exists "applications: institution update review own opportunity" on public.applications;

create policy "applications: entrepreneur update own limited" on public.applications
  for update using (
    exists (select 1 from public.business_passports bp where bp.id = passport_id and bp.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.business_passports bp where bp.id = passport_id and bp.owner_id = auth.uid())
  );

create policy "applications: institution update review own opportunity" on public.applications
  for update using (
    exists (select 1 from public.opportunities o where o.id = opportunity_id and o.institution_id = public.current_institution_id())
  )
  with check (
    exists (select 1 from public.opportunities o where o.id = opportunity_id and o.institution_id = public.current_institution_id())
  );

create or replace function public.enforce_application_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role public.user_role;
begin
  -- opportunity_id/passport_id immutable for everyone except admin
  -- (admin's lack of a WITH CHECK restriction here is documented,
  -- deliberate, for legitimate corrections).
  if not public.is_admin() then
    if new.opportunity_id is distinct from old.opportunity_id or new.passport_id is distinct from old.passport_id then
      raise exception 'opportunity_id and passport_id are immutable after an application is created';
    end if;
  end if;

  -- Entrepreneurs may only transition status to withdrawn.
  select role into v_caller_role from public.profiles where id = auth.uid();
  if v_caller_role = 'entrepreneur' and new.status is distinct from old.status and new.status <> 'withdrawn' then
    raise exception 'Entrepreneurs may only withdraw an application, not set status to %', new.status;
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_application_integrity() from public;

drop trigger if exists trg_application_integrity on public.applications;
create trigger trg_application_integrity
  before update on public.applications
  for each row execute function public.enforce_application_integrity();

comment on function public.enforce_application_integrity is
  'Replaces the broken self-correlated-subquery WITH CHECK approach from migration 006 (caused infinite recursion — see this migration''s header). Enforces opportunity_id/passport_id immutability and the entrepreneur-can-only-withdraw rule via safe OLD/NEW comparison instead.';

-- --------------------------------------------------------------------
-- notifications
-- --------------------------------------------------------------------

drop policy if exists "notifications: recipient mark read only" on public.notifications;

create policy "notifications: recipient mark read only" on public.notifications
  for update using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());
-- Content-column immutability no longer needs a WITH CHECK at all — the
-- column-level grant (migration 021: only `is_read` is UPDATE-granted
-- to authenticated) already makes it impossible for the client's SET
-- clause to touch title/body/category/channel. Redundant WITH CHECK
-- conditions checking those columns' values were both unnecessary and
-- the actual cause of the recursion bug.
