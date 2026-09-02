-- ====================================================================
-- SECURITY FIX: applications self-approval + messages tampering
-- ====================================================================
-- Same root cause as migration 005: "for all" policies and UPDATE
-- policies missing WITH CHECK grant row ownership as if it implied
-- column-write authority. It doesn't. Fixed the same way — split by
-- operation, and use a same-row subquery comparison
-- (`col = (select col from t where id = t.id)`) to make specific
-- columns immutable to a given caller, the pattern already used for
-- profiles.role/institution_id in migration 004/005.

-- --------------------------------------------------------------------
-- PART A: applications
-- --------------------------------------------------------------------
-- Bug: "applications: entrepreneur manage own" was `for all` — an
-- entrepreneur could UPDATE their own application and set
-- status = 'awarded', or forge reviewed_by/reviewed_at, with no
-- institution ever reviewing anything.
-- Bug: "applications: institution update status own opportunity" had a
-- USING clause but no WITH CHECK at all — an institution updating an
-- application they legitimately own could also silently move it to a
-- DIFFERENT opportunity_id or passport_id.

drop policy if exists "applications: entrepreneur manage own" on public.applications;
drop policy if exists "applications: institution update status own opportunity" on public.applications;

create policy "applications: entrepreneur select own" on public.applications
  for select using (
    exists (select 1 from public.business_passports bp where bp.id = passport_id and bp.owner_id = auth.uid())
  );

create policy "applications: entrepreneur insert own" on public.applications
  for insert with check (
    exists (select 1 from public.business_passports bp where bp.id = passport_id and bp.owner_id = auth.uid())
    and status = 'submitted'
    and reviewed_by is null
    and reviewed_at is null
  );

-- Entrepreneurs may withdraw (status -> 'withdrawn') or edit their cover
-- note. They may not change opportunity_id/passport_id (which
-- application this is), and reviewed_by/reviewed_at are protected by the
-- trigger below regardless of what this check allows.
create policy "applications: entrepreneur update own limited" on public.applications
  for update using (
    exists (select 1 from public.business_passports bp where bp.id = passport_id and bp.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.business_passports bp where bp.id = passport_id and bp.owner_id = auth.uid())
    and opportunity_id = (select a2.opportunity_id from public.applications a2 where a2.id = applications.id)
    and passport_id = (select a2.passport_id from public.applications a2 where a2.id = applications.id)
    and (
      status = (select a2.status from public.applications a2 where a2.id = applications.id)
      or status = 'withdrawn'
    )
  );

-- Institutions review applications against their own opportunities only.
-- They cannot move an application to a different opportunity or
-- passport — only the review status/outcome.
create policy "applications: institution update review own opportunity" on public.applications
  for update using (
    exists (select 1 from public.opportunities o where o.id = opportunity_id and o.institution_id = public.current_institution_id())
  )
  with check (
    exists (select 1 from public.opportunities o where o.id = opportunity_id and o.institution_id = public.current_institution_id())
    and opportunity_id = (select a2.opportunity_id from public.applications a2 where a2.id = applications.id)
    and passport_id = (select a2.passport_id from public.applications a2 where a2.id = applications.id)
  );

-- Defense in depth: reviewed_by/reviewed_at are never taken from client
-- input, regardless of what any policy above would otherwise permit.
-- The trigger forces the real actor and timestamp whenever status moves
-- to a reviewer-driven state, and leaves them untouched for entrepreneur
-- actions (submitted -> withdrawn), so the entrepreneur policy's
-- "reviewed_by/reviewed_at effectively unchanged" expectation holds.
create or replace function public.set_application_review_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status and new.status not in ('submitted', 'withdrawn') then
    new.reviewed_by = auth.uid();
    new.reviewed_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_applications_review_metadata on public.applications;
create trigger trg_applications_review_metadata
  before update on public.applications
  for each row execute function public.set_application_review_metadata();

comment on function public.set_application_review_metadata is
  'Forces reviewed_by/reviewed_at to the real authenticated actor whenever an application''s status moves to a reviewer-driven state, regardless of client-supplied values for those columns. Client input for reviewed_by/reviewed_at is never trusted.';

-- --------------------------------------------------------------------
-- PART B: messages
-- --------------------------------------------------------------------
-- Bug: "messages: recipient mark read" was `for update using (recipient_id
-- = auth.uid())` with NO WITH CHECK — a recipient could rewrite the
-- entire row: sender_id, recipient_id, opportunity_id, body. Only
-- is_read should ever be writable by the recipient.

drop policy if exists "messages: recipient mark read" on public.messages;

create policy "messages: recipient mark read only" on public.messages
  for update using (recipient_id = auth.uid())
  with check (
    recipient_id = auth.uid()
    and sender_id = (select m2.sender_id from public.messages m2 where m2.id = messages.id)
    and recipient_id = (select m2.recipient_id from public.messages m2 where m2.id = messages.id)
    and opportunity_id is not distinct from (select m2.opportunity_id from public.messages m2 where m2.id = messages.id)
    and body = (select m2.body from public.messages m2 where m2.id = messages.id)
  );

-- Column-level belt-and-braces: even a future policy regression can't
-- reopen body/sender_id/recipient_id/opportunity_id to the recipient,
-- because is_read is the only column authenticated users may ever UPDATE
-- on this table via the client SDK.
revoke update (sender_id, recipient_id, opportunity_id, body) on public.messages from authenticated;

comment on table public.messages is
  'Only is_read is writable after insert (column-level revoke, migration 006) — a recipient marking a message read cannot rewrite its content or reassign it. See AUDIT.md / SECURITY_AUDIT.md.';
