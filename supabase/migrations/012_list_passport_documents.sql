-- ====================================================================
-- list_passport_documents — the missing half of secure document access
-- ====================================================================
-- The signed-url route (Part 4, prior pass) can authorize access to a
-- document IF the caller already knows its id. But `documents` has no
-- institution SELECT policy at all — an authorized institution
-- (shortlisted/applied, per migration 011's relationship test) couldn't
-- actually discover which documents exist to request. This closes that
-- gap with the same relationship check, returning metadata only
-- (never file_path — that stays server-side, resolved only by the
-- signed-url route after its own independent authorization check).

create or replace function public.list_passport_documents(p_passport_id uuid)
returns table (
  id uuid,
  document_type text,
  file_name text,
  status public.document_status,
  issued_date date,
  expiry_date date,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role public.user_role;
  v_caller_institution_id uuid;
  v_owner_id uuid;
  v_is_published boolean;
  v_is_authorized_institution boolean := false;
begin
  select role, institution_id into v_caller_role, v_caller_institution_id
  from public.profiles where id = auth.uid();

  select owner_id, is_published into v_owner_id, v_is_published
  from public.business_passports where business_passports.id = p_passport_id;

  if v_owner_id is null then
    raise exception 'Passport not found';
  end if;

  if v_caller_role = 'institution' and v_caller_institution_id is not null and v_is_published then
    select exists (
      select 1 from public.shortlists s where s.institution_id = v_caller_institution_id and s.passport_id = p_passport_id
    ) or exists (
      select 1 from public.applications a
      join public.opportunities o on o.id = a.opportunity_id
      where o.institution_id = v_caller_institution_id and a.passport_id = p_passport_id
    ) into v_is_authorized_institution;
  end if;

  if v_owner_id <> auth.uid() and v_caller_role <> 'admin' and not v_is_authorized_institution then
    raise exception 'Not authorized to view this passport''s documents';
  end if;

  return query
    select d.id, d.document_type, d.file_name, d.status, d.issued_date, d.expiry_date, d.created_at
    from public.documents d
    where d.passport_id = p_passport_id
    order by d.created_at desc;
end;
$$;

comment on function public.list_passport_documents is
  'Metadata-only document listing with the same relationship-based authorization as get_passport_detail() and the signed-url route. Never returns file_path — that is resolved only by /api/documents/[id]/signed-url after its own independent authorization check, so knowing a document exists never implies being able to fetch it.';

grant execute on function public.list_passport_documents(uuid) to authenticated;
