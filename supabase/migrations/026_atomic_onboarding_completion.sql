-- ====================================================================
-- Migration 026: atomic onboarding completion
--
-- Bug being fixed: POST /api/onboarding/complete performed five
-- sequential JS-client inserts (business_passports, entrepreneur_
-- profiles, entrepreneur_financial_snapshots, entrepreneur_needs,
-- entrepreneur_goals). Each insert commits independently — nothing
-- spans them in a transaction. If any insert after the first one
-- failed, the business_passports row was already committed and
-- permanently orphaned: no entrepreneur_profile exists for it, so
-- onboarding never actually completed, but every subsequent attempt
-- hits the "You already have a Business Passport" guard and the user
-- can never finish. That guard was also a plain SELECT-then-INSERT
-- from the JS client, which is racy on its own (no unique constraint
-- backed it up).
--
-- This is exactly the failure mode already solved once in this
-- codebase for bulk-import (013_transactional_bulk_import.sql) — same
-- fix, applied here: the entire write happens in ONE Postgres
-- transaction inside a single security-definer function. Either the
-- whole onboarding record is created, or none of it is.
-- ====================================================================

-- One business passport per owner, enforced at the DB level (previously
-- only an app-level promise). Also gives us a clean, race-safe 409 via
-- unique_violation if two requests somehow land concurrently.
alter table public.business_passports
  add constraint business_passports_owner_id_key unique (owner_id);

create or replace function public.complete_entrepreneur_onboarding(
  p_business_name text,
  p_business_type public.business_type default null,
  p_industry text default null,
  p_province public.sa_province default null,
  p_municipality text default null,
  p_business_description text default null,
  p_years_trading int default null,
  p_employees_count int default null,
  p_primary_income_source boolean default null,
  p_dependants_count int default null,
  p_household_income_dependency public.dependency_level default null,
  p_operating_location_type text default null,
  p_transport_mode text default null,
  p_internet_access boolean default null,
  p_electricity_access boolean default null,
  p_premises_status text default null,
  p_weekly_revenue_range public.revenue_range default null,
  p_weekly_business_expense_range public.revenue_range default null,
  p_personal_draw_range public.revenue_range default null,
  p_income_consistency public.income_consistency default null,
  p_needs text[] default '{}',
  p_goals jsonb default '[]'::jsonb -- array of {goal_type, notes}
)
returns table (passport_id uuid, entrepreneur_profile_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid := auth.uid();
  v_passport_id uuid;
  v_profile_id uuid;
  v_needs_count int;
  v_goal jsonb;
  v_goals_count int;
begin
  -- owner_id is always taken from the authenticated session, never a
  -- parameter — a caller cannot write onboarding data for another user.
  if v_owner_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if p_business_name is null or length(trim(p_business_name)) = 0 then
    raise exception 'business_name_required' using errcode = '22023';
  end if;

  if exists (select 1 from public.business_passports where owner_id = v_owner_id) then
    raise exception 'already_onboarded' using errcode = 'P0001';
  end if;

  insert into public.business_passports (
    owner_id, business_name, business_type, industry, province, municipality,
    business_description, years_trading, employees_count
  ) values (
    v_owner_id, trim(p_business_name), p_business_type, p_industry, p_province, p_municipality,
    p_business_description, p_years_trading, p_employees_count
  )
  returning id into v_passport_id;

  insert into public.entrepreneur_profiles (
    user_id, province, municipality, primary_income_source, dependants_count,
    household_income_dependency, operating_location_type, transport_mode,
    internet_access, electricity_access, premises_status
  ) values (
    v_owner_id, p_province, p_municipality, p_primary_income_source, p_dependants_count,
    p_household_income_dependency, p_operating_location_type, p_transport_mode,
    p_internet_access, p_electricity_access, p_premises_status
  )
  returning id into v_profile_id;

  if p_weekly_revenue_range is not null or p_weekly_business_expense_range is not null or p_personal_draw_range is not null then
    insert into public.entrepreneur_financial_snapshots (
      entrepreneur_profile_id, weekly_revenue_range, weekly_business_expense_range,
      personal_draw_range, income_consistency
    ) values (
      v_profile_id, p_weekly_revenue_range, p_weekly_business_expense_range,
      p_personal_draw_range, p_income_consistency
    );
  end if;

  v_needs_count := coalesce(array_length(p_needs, 1), 0);
  if v_needs_count > 0 then
    for i in 1..v_needs_count loop
      insert into public.entrepreneur_needs (entrepreneur_profile_id, need_type, priority)
      values (v_profile_id, p_needs[i], v_needs_count - i + 1);
    end loop;
  end if;

  v_goals_count := coalesce(jsonb_array_length(p_goals), 0);
  if v_goals_count > 0 then
    for i in 0..(v_goals_count - 1) loop
      v_goal := p_goals -> i;
      insert into public.entrepreneur_goals (entrepreneur_profile_id, goal_type, notes, priority)
      values (
        v_profile_id,
        v_goal ->> 'goal_type',
        v_goal ->> 'notes',
        v_goals_count - i
      );
    end loop;
  end if;

  return query select v_passport_id, v_profile_id;
end;
$$;

comment on function public.complete_entrepreneur_onboarding is
  'Atomic write for entrepreneur onboarding: business_passports + entrepreneur_profiles + optional financial snapshot/needs/goals succeed or fail together. Fixes the orphaned-passport bug where a partial failure permanently blocked a user with "already have a Business Passport" despite never completing onboarding. owner_id/user_id always taken from auth.uid(), never a parameter.';

revoke all on function public.complete_entrepreneur_onboarding from public;
grant execute on function public.complete_entrepreneur_onboarding to authenticated;
