-- ====================================================================
-- Migration 035: close the verification -> publication loop
-- ====================================================================
-- Before this migration three links in the core loop had no writer:
--
--   1. Nothing ever created a `verifications` row, so the admin queue
--      was always empty and every trust score stayed at 0.
--   2. Nothing ever moved `documents.status` off 'pending_review'.
--   3. Nothing ever set `business_passports.is_published = true` (the
--      column is UPDATE-revoked from clients, and no function set it),
--      so institution discovery and matching never had a candidate.
--
-- All three are closed here with triggers, so the rules hold no matter
-- which runtime performs the write (Next route handler, edge function,
-- SQL editor):
--
--   documents INSERT          -> a pending verification request
--   verification status change -> matching documents' status follows
--   verification verified      -> passport re-checked for publication
--   passport UPDATE            -> auto-publish once the threshold is met
--
-- PUBLICATION THRESHOLD (product decision: publish automatically once a
-- threshold is met, never by the owner flipping a switch):
--   - business_name, industry, province and business_description filled
--   - at least one verification with status = 'verified'
-- Publication is one-way. A passport that later drops below the
-- threshold (e.g. its only verification expires) stays published:
-- institutions with live applications must keep their access, and the
-- trust score already reflects the expiry.
-- ====================================================================

-- --------------------------------------------------------------------
-- PART A — one verification row per (passport, type)
-- --------------------------------------------------------------------
-- calculate-trust-score sums the weight of every verified row, so two
-- verified 'cipc' rows would double-count. The request trigger below
-- relies on this index for its ON CONFLICT clause.
create unique index if not exists idx_verifications_passport_type
  on public.verifications (passport_id, verification_type);

-- --------------------------------------------------------------------
-- PART B — document type -> verification type
-- --------------------------------------------------------------------
-- Kept in lockstep with ALLOWED_DOCUMENT_TYPES in
-- src/app/api/documents/upload/route.ts. 'other' (and anything unknown)
-- maps to null: it is stored, but never requests a verification.
create or replace function public.verification_type_for_document(p_document_type text)
returns text
language sql
immutable
as $$
  select case p_document_type
    when 'cipc_certificate' then 'cipc'
    when 'tax_clearance' then 'sars'
    when 'vat_certificate' then 'vat'
    when 'bbbee_certificate' then 'bbbee'
    when 'cidb_certificate' then 'cidb'
    when 'insurance_certificate' then 'insurance'
    when 'bank_confirmation' then 'bank'
    when 'municipal_supplier_certificate' then 'municipal_supplier'
    else null
  end;
$$;

-- --------------------------------------------------------------------
-- PART C — uploading a document requests a verification
-- --------------------------------------------------------------------
-- A new row lands as 'pending'. An existing row is only re-opened when
-- it is rejected/expired/unverified; a pending or verified row is left
-- alone (a renewal uploaded while still verified does not drop the
-- business back to pending — it is re-opened when the current one
-- expires and a document is uploaded after that).
--
-- SECURITY DEFINER because entrepreneurs have no write path to
-- `verifications` (and must not get one). The only thing a caller can
-- cause here is a *pending request* for their own passport, capped at
-- one per type by the unique index — never a verified status.
create or replace function public.request_verification_for_document()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text := public.verification_type_for_document(new.document_type);
begin
  if v_type is null then
    return new;
  end if;

  insert into public.verifications (passport_id, verification_type, status, issued_date, expiry_date)
  values (new.passport_id, v_type, 'pending', new.issued_date, new.expiry_date)
  on conflict (passport_id, verification_type) do update
    set status = 'pending',
        issued_date = excluded.issued_date,
        expiry_date = excluded.expiry_date,
        verified_by = null,
        verified_at = null,
        notes = null,
        created_at = now()
    where verifications.status in ('rejected', 'expired', 'unverified');

  return new;
end;
$$;

revoke execute on function public.request_verification_for_document() from public;

drop trigger if exists trg_document_requests_verification on public.documents;
create trigger trg_document_requests_verification
  after insert on public.documents
  for each row execute function public.request_verification_for_document();

-- --------------------------------------------------------------------
-- PART D — a verification decision flows to documents and publication
-- --------------------------------------------------------------------
create or replace function public.apply_verification_outcome()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'verified' then
    update public.documents d
      set status = 'valid'
      where d.passport_id = new.passport_id
        and d.status = 'pending_review'
        and public.verification_type_for_document(d.document_type) = new.verification_type;

    -- Touch the passport so trg_passport_auto_publish re-evaluates the
    -- threshold. No-op for passports that are already published.
    update public.business_passports
      set updated_at = now()
      where id = new.passport_id
        and coalesce(is_published, false) = false;
  elsif new.status = 'expired' then
    update public.documents d
      set status = 'expired'
      where d.passport_id = new.passport_id
        and d.status = 'valid'
        and public.verification_type_for_document(d.document_type) = new.verification_type;
  end if;

  return new;
end;
$$;

revoke execute on function public.apply_verification_outcome() from public;

drop trigger if exists trg_verification_outcome on public.verifications;
create trigger trg_verification_outcome
  after insert or update of status on public.verifications
  for each row execute function public.apply_verification_outcome();

-- --------------------------------------------------------------------
-- PART E — auto-publish once the threshold is met
-- --------------------------------------------------------------------
-- BEFORE UPDATE so the flag is set in the same row write. Column-level
-- UPDATE on is_published stays revoked from `authenticated` (005/021):
-- that privilege is checked against the statement's SET list, not
-- against what a trigger assigns, so owners still cannot publish
-- themselves — they can only make the threshold true.
create or replace function public.auto_publish_passport()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.is_published, false) then
    return new;
  end if;

  if coalesce(btrim(new.business_name), '') <> ''
     and coalesce(btrim(new.industry), '') <> ''
     and new.province is not null
     and coalesce(btrim(new.business_description), '') <> ''
     and exists (
       select 1 from public.verifications v
       where v.passport_id = new.id and v.status = 'verified'
     )
  then
    new.is_published := true;

    insert into public.passport_activity (passport_id, activity_type, description)
    values (new.id, 'published', 'Business Passport is now visible to institutions');
  end if;

  return new;
end;
$$;

revoke execute on function public.auto_publish_passport() from public;

drop trigger if exists trg_passport_auto_publish on public.business_passports;
create trigger trg_passport_auto_publish
  before update on public.business_passports
  for each row execute function public.auto_publish_passport();

comment on function public.auto_publish_passport() is
  'Sets is_published = true (one-way) once a passport has business_name, industry, province, business_description and at least one verified verification. The only writer of is_published; clients remain UPDATE-revoked on the column.';

-- --------------------------------------------------------------------
-- PART F — backfill
-- --------------------------------------------------------------------
-- Documents uploaded before this migration never requested a
-- verification. Create the pending requests they should have produced
-- (latest document per passport/type supplies the dates).
insert into public.verifications (passport_id, verification_type, status, issued_date, expiry_date)
select distinct on (d.passport_id, public.verification_type_for_document(d.document_type))
  d.passport_id,
  public.verification_type_for_document(d.document_type),
  'pending',
  d.issued_date,
  d.expiry_date
from public.documents d
where public.verification_type_for_document(d.document_type) is not null
order by d.passport_id, public.verification_type_for_document(d.document_type), d.created_at desc
on conflict (passport_id, verification_type) do nothing;

-- Passports that already meet the threshold publish on this touch.
update public.business_passports bp
  set updated_at = now()
  where coalesce(bp.is_published, false) = false
    and exists (
      select 1 from public.verifications v
      where v.passport_id = bp.id and v.status = 'verified'
    );
