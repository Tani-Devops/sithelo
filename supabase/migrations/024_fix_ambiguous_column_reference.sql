-- ====================================================================
-- Fix ambiguous "id" column reference — found via real execution
-- ====================================================================
-- Both list_passport_documents() and get_passport_activity() declare
-- `id uuid` as part of their RETURNS TABLE, which creates an implicit
-- PL/pgSQL variable named `id` in scope for the whole function body.
-- Their internal profile lookup, `select role into v_caller_role from
-- public.profiles where id = auth.uid()`, has a bare `id` reference
-- that Postgres can't disambiguate between that implicit variable and
-- `profiles.id` — confirmed via actual execution:
--   ERROR: column reference "id" is ambiguous
--   DETAIL: It could refer to either a PL/pgSQL variable or a table column.
-- This broke BOTH functions entirely for every caller, not just
-- malicious ones — another case (like the recursive WITH CHECK bug)
-- where the actual defect is worse than "insecure": the feature simply
-- didn't work. get_passport_trust_history() has no `id` column in its
-- return shape and was confirmed unaffected. get_passport_detail()
-- returns jsonb (no RETURNS TABLE columns to shadow anything) and was
-- also confirmed unaffected.

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
  from public.profiles where profiles.id = auth.uid();

  if v_caller_role is null then
    raise exception 'Not authorized to view this passport''s documents';
  end if;

  select owner_id, is_published into v_owner_id, v_is_published
  from public.business_passports where business_passports.id = p_passport_id;

  if v_owner_id is null then
    raise exception 'Passport not found';
  end if;

  if v_caller_role = 'institution' and v_caller_institution_id is not null and v_is_published then
    v_is_authorized_institution := public.has_passport_relationship(v_caller_institution_id, p_passport_id);
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

revoke all on function public.list_passport_documents from public;
grant execute on function public.list_passport_documents(uuid) to authenticated;

create or replace function public.get_passport_activity(p_passport_id uuid)
returns table (
  id uuid,
  activity_type text,
  description text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role public.user_role;
  v_owner_id uuid;
begin
  select role into v_caller_role from public.profiles where profiles.id = auth.uid();
  if v_caller_role is null then
    raise exception 'Not authorized to view this passport''s activity';
  end if;

  select owner_id into v_owner_id from public.business_passports where business_passports.id = p_passport_id;
  if v_owner_id is null then
    raise exception 'Passport not found';
  end if;

  if v_owner_id <> auth.uid() and v_caller_role <> 'admin' then
    raise exception 'Not authorized to view this passport''s activity';
  end if;

  return query
    select a.id, a.activity_type, a.description, a.created_at
    from public.passport_activity a
    where a.passport_id = p_passport_id
    order by a.created_at desc
    limit 6;
end;
$$;

revoke all on function public.get_passport_activity from public;
grant execute on function public.get_passport_activity(uuid) to authenticated;
