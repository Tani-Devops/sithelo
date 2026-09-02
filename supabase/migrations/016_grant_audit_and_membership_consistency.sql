-- ====================================================================
-- Grant audit + check_rate_limit restriction + institution membership
-- consistency invariant
-- ====================================================================

-- --------------------------------------------------------------------
-- PART A: explicit REVOKE EXECUTE FROM PUBLIC on every SECURITY DEFINER
-- function. In Postgres, a newly created function is executable by
-- PUBLIC by default unless explicitly revoked — several of these
-- functions already had explicit grants to specific roles (which
-- narrows effective access since a later GRANT doesn't undo an implicit
-- PUBLIC grant on its own), but none had an explicit REVOKE FROM PUBLIC
-- stated, which means the actual privilege state depended on grant
-- ordering rather than being asserted outright. Making it explicit and
-- unambiguous for every one, not just the ones added this migration.
-- --------------------------------------------------------------------

revoke execute on function public.handle_new_user() from public;
revoke execute on function public.admin_set_institution_membership(uuid, uuid) from public;
revoke execute on function public.admin_promote_user(uuid) from public;
revoke execute on function public.admin_demote_user(uuid, public.user_role) from public;
revoke execute on function public.set_application_review_metadata() from public;
revoke execute on function public.mark_message_read(uuid) from public;
revoke execute on function public.create_imported_business(uuid, text, text, text, text, public.business_type, text, public.sa_province, text) from public;
revoke execute on function public.has_passport_relationship(uuid, uuid) from public;
revoke execute on function public.get_passport_detail(uuid) from public;
revoke execute on function public.list_passport_documents(uuid) from public;

-- Re-assert the intended grants explicitly rather than relying on
-- migrations 009/010/011/012/015 having gotten it right the first time.
grant execute on function public.admin_set_institution_membership(uuid, uuid) to authenticated;
grant execute on function public.admin_promote_user(uuid) to authenticated;
grant execute on function public.admin_demote_user(uuid, public.user_role) to authenticated;
grant execute on function public.mark_message_read(uuid) to authenticated;
grant execute on function public.has_passport_relationship(uuid, uuid) to authenticated, service_role;
grant execute on function public.get_passport_detail(uuid) to authenticated;
grant execute on function public.list_passport_documents(uuid) to authenticated;
-- handle_new_user and set_application_review_metadata are trigger
-- functions — never called directly by anyone, only fired by Postgres
-- itself on insert/update. No execute grant needed for any role.
-- create_imported_business is bulk-import-only (service role), already
-- correctly scoped in migration 013 — re-asserted here for completeness.
grant execute on function public.create_imported_business(uuid, text, text, text, text, public.business_type, text, public.sa_province, text) to service_role;

-- --------------------------------------------------------------------
-- PART B: check_rate_limit() — no client (browser) ever calls this
-- directly. Every current caller (all 3 edge functions using it, plus
-- the Next.js signed-url route) goes through the service-role client.
-- The `authenticated` grant from migration 008 was unused privilege —
-- exactly what a least-privilege audit exists to catch. Also: an
-- attacker with only the anon/authenticated key should not be able to
-- write arbitrary rows into rate_limits by calling this with a made-up
-- key/max/window, which the authenticated grant technically allowed
-- even though nothing in the product intended it to be reachable that
-- way.
-- --------------------------------------------------------------------

revoke execute on function public.check_rate_limit(text, int, int) from authenticated;
-- service_role retains it (the only real caller); PUBLIC was never
-- granted it in the first place per Part A's blanket revoke pattern,
-- applied here too:
revoke execute on function public.check_rate_limit(text, int, int) from public;

comment on function public.check_rate_limit is
  'service_role only (migration 016) — no authenticated-role grant. Called exclusively via the service-role client from edge functions and the Next.js signed-url route, never directly by a browser.';

-- --------------------------------------------------------------------
-- PART C: institution membership consistency invariant
-- --------------------------------------------------------------------
-- institution_id != null must imply role = 'institution'. Enforced via
-- trigger rather than a bare CHECK constraint, because a CHECK
-- constraint would make admin_promote_user() fail outright if it ever
-- promoted a former institution user without separately remembering to
-- null out institution_id first — a trigger can correct the invariant
-- automatically (clear institution_id whenever role changes away from
-- 'institution'), which is more forgiving of legitimate admin actions
-- while still making the inconsistent state unreachable.

create or replace function public.enforce_institution_membership_consistency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role <> 'institution' and new.institution_id is not null then
    new.institution_id := null;
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_institution_membership_consistency() from public;
-- Trigger function, never called directly — no execute grant needed.

drop trigger if exists trg_institution_membership_consistency on public.profiles;
create trigger trg_institution_membership_consistency
  before insert or update on public.profiles
  for each row execute function public.enforce_institution_membership_consistency();

comment on function public.enforce_institution_membership_consistency is
  'Enforces institution_id != null implies role = institution by auto-clearing institution_id whenever role changes away from institution — runs on every profiles write, including via admin_promote_user()/admin_demote_user(), so the invariant holds regardless of which code path changes role.';
