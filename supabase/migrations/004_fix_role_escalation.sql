-- ====================================================================
-- SECURITY FIX: role escalation via client-controlled profile insert
-- ====================================================================
-- The original "profiles: insert own on signup" policy only checked
-- `id = auth.uid()` and placed no constraint on `role`. Any authenticated
-- client could INSERT a profiles row with role='admin' directly via the
-- Supabase client SDK, self-granting admin access — RLS was checking WHO
-- owns the row, never WHAT the row was allowed to say. This migration
-- removes the client's ability to write role at all: profile creation
-- moves to a SECURITY DEFINER trigger on auth.users that reads the
-- requested role out of raw_user_meta_data (set at signUp() time) and
-- clamps it to the only two roles the public registration flow may ever
-- grant. 'admin' can never be reached through this path, full stop.

-- 1. Remove the vulnerable client-side insert policy. Profiles are now
--    written only by the trigger below (SECURITY DEFINER, bypasses RLS)
--    or by an admin/service-role action. No `authenticated` role ever
--    gets an INSERT grant on this table again.
drop policy if exists "profiles: insert own on signup" on public.profiles;

-- 2. Trigger function: fires after every new auth.users row. Clamps role
--    to 'entrepreneur' unless the signup metadata explicitly requested
--    'institution' — 'admin' (or anything else) silently falls back to
--    'entrepreneur' rather than erroring, so a malformed/malicious
--    metadata payload can't even probe for behavior differences.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := new.raw_user_meta_data ->> 'role';
  safe_role public.user_role;
begin
  safe_role := case
    when requested_role = 'institution' then 'institution'::public.user_role
    else 'entrepreneur'::public.user_role
  end;

  insert into public.profiles (id, role, full_name, email, cell_number)
  values (
    new.id,
    safe_role,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    new.raw_user_meta_data ->> 'cell_number'
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. Admins may still update role (e.g. promoting a verified institution
--    contact), but only admins — never the row owner. This replaces any
--    implicit assumption that "update own" would have covered role too;
--    it explicitly does not.
drop policy if exists "profiles: update own" on public.profiles;

create policy "profiles: update own non-privileged fields" on public.profiles
  for update using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select role from public.profiles where id = auth.uid()) -- role is immutable to the owner
  );

create policy "profiles: admin update any" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- 4. Belt-and-braces: revoke direct INSERT on profiles from the
--    `authenticated` role entirely at the grant level, not just via RLS
--    policy. This means even a future policy regression that accidentally
--    re-opens INSERT can't be exploited — Postgres will still reject the
--    write at the grant layer. All profile creation must go through the
--    SECURITY DEFINER trigger above.
revoke insert on public.profiles from authenticated;

comment on function public.handle_new_user() is
  'Security-critical: the only path by which a profiles row is created for a new signup. Clamps role to entrepreneur/institution — admin accounts must be provisioned via a separate, audited admin-only flow (see ADMIN_PROVISIONING in SECURITY.md), never through public registration.';
