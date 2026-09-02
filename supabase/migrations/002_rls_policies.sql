-- ====================================================================
-- ZENZELE ROW LEVEL SECURITY
-- Migration 002: RLS enabled + policies on every table
-- ====================================================================

alter table public.profiles enable row level security;
alter table public.institutions enable row level security;
alter table public.business_passports enable row level security;
alter table public.verifications enable row level security;
alter table public.documents enable row level security;
alter table public.business_references enable row level security;
alter table public.opportunities enable row level security;
alter table public.matches enable row level security;
alter table public.applications enable row level security;
alter table public.shortlists enable row level security;
alter table public.notifications enable row level security;
alter table public.messages enable row level security;
alter table public.audit_logs enable row level security;
alter table public.passport_activity enable row level security;
alter table public.trust_score_history enable row level security;

-- ---------- helper: is admin ----------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.current_institution_id()
returns uuid language sql stable security definer set search_path = public as $$
  select institution_id from public.profiles where id = auth.uid();
$$;

-- ---------- PROFILES ----------
create policy "profiles: read own" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "profiles: update own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles: insert own on signup" on public.profiles
  for insert with check (id = auth.uid());

-- ---------- INSTITUTIONS ----------
create policy "institutions: read all authenticated" on public.institutions
  for select using (auth.role() = 'authenticated');
create policy "institutions: admin manage" on public.institutions
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- BUSINESS PASSPORTS ----------
-- Owners manage their own; published passports are readable by any authenticated
-- institution/admin user for search purposes; admins have full access.
create policy "passports: owner full access" on public.business_passports
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "passports: published readable by institutions" on public.business_passports
  for select using (
    is_published = true
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('institution','admin'))
  );
create policy "passports: admin full access" on public.business_passports
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- VERIFICATIONS ----------
create policy "verifications: owner read" on public.verifications
  for select using (
    exists (select 1 from public.business_passports bp where bp.id = passport_id and bp.owner_id = auth.uid())
  );
create policy "verifications: institution read on published" on public.verifications
  for select using (
    exists (
      select 1 from public.business_passports bp
      join public.profiles p on p.id = auth.uid()
      where bp.id = passport_id and bp.is_published = true and p.role in ('institution','admin')
    )
  );
create policy "verifications: admin manage" on public.verifications
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- DOCUMENTS ----------
create policy "documents: owner manage" on public.documents
  for all using (
    exists (select 1 from public.business_passports bp where bp.id = passport_id and bp.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.business_passports bp where bp.id = passport_id and bp.owner_id = auth.uid())
  );
create policy "documents: admin manage" on public.documents
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- BUSINESS REFERENCES ----------
create policy "references: owner manage" on public.business_references
  for all using (
    exists (select 1 from public.business_passports bp where bp.id = passport_id and bp.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.business_passports bp where bp.id = passport_id and bp.owner_id = auth.uid())
  );
create policy "references: institution read on published" on public.business_references
  for select using (
    exists (
      select 1 from public.business_passports bp join public.profiles p on p.id = auth.uid()
      where bp.id = passport_id and bp.is_published = true and p.role in ('institution','admin')
    )
  );

-- ---------- OPPORTUNITIES ----------
create policy "opportunities: institution manage own" on public.opportunities
  for all using (institution_id = public.current_institution_id())
  with check (institution_id = public.current_institution_id());
create policy "opportunities: entrepreneurs read active" on public.opportunities
  for select using (
    status = 'active'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('entrepreneur','admin'))
  );
create policy "opportunities: admin manage" on public.opportunities
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- MATCHES (written only by service role / edge functions) ----------
create policy "matches: institution read own opportunity matches" on public.matches
  for select using (
    exists (select 1 from public.opportunities o where o.id = opportunity_id and o.institution_id = public.current_institution_id())
  );
create policy "matches: entrepreneur read own passport matches" on public.matches
  for select using (
    exists (select 1 from public.business_passports bp where bp.id = passport_id and bp.owner_id = auth.uid())
  );
create policy "matches: admin all" on public.matches for all using (public.is_admin()) with check (public.is_admin());

-- ---------- APPLICATIONS ----------
create policy "applications: entrepreneur manage own" on public.applications
  for all using (
    exists (select 1 from public.business_passports bp where bp.id = passport_id and bp.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.business_passports bp where bp.id = passport_id and bp.owner_id = auth.uid())
  );
create policy "applications: institution read/update own opportunity" on public.applications
  for select using (
    exists (select 1 from public.opportunities o where o.id = opportunity_id and o.institution_id = public.current_institution_id())
  );
create policy "applications: institution update status own opportunity" on public.applications
  for update using (
    exists (select 1 from public.opportunities o where o.id = opportunity_id and o.institution_id = public.current_institution_id())
  );
create policy "applications: admin all" on public.applications for all using (public.is_admin()) with check (public.is_admin());

-- ---------- SHORTLISTS ----------
create policy "shortlists: institution manage own" on public.shortlists
  for all using (institution_id = public.current_institution_id())
  with check (institution_id = public.current_institution_id());

-- ---------- NOTIFICATIONS ----------
create policy "notifications: recipient read/update own" on public.notifications
  for select using (recipient_id = auth.uid());
create policy "notifications: recipient mark read" on public.notifications
  for update using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- ---------- MESSAGES ----------
create policy "messages: participants read" on public.messages
  for select using (sender_id = auth.uid() or recipient_id = auth.uid());
create policy "messages: sender send" on public.messages
  for insert with check (sender_id = auth.uid());
create policy "messages: recipient mark read" on public.messages
  for update using (recipient_id = auth.uid());

-- ---------- AUDIT LOGS (read-only for admins, writes via service role only) ----------
create policy "audit_logs: admin read" on public.audit_logs
  for select using (public.is_admin());

-- ---------- PASSPORT ACTIVITY ----------
create policy "activity: owner read" on public.passport_activity
  for select using (
    exists (select 1 from public.business_passports bp where bp.id = passport_id and bp.owner_id = auth.uid())
  );
create policy "activity: institution read on published" on public.passport_activity
  for select using (
    exists (
      select 1 from public.business_passports bp join public.profiles p on p.id = auth.uid()
      where bp.id = passport_id and bp.is_published = true and p.role in ('institution','admin')
    )
  );

-- ---------- TRUST SCORE HISTORY ----------
create policy "trust_history: owner read" on public.trust_score_history
  for select using (
    exists (select 1 from public.business_passports bp where bp.id = passport_id and bp.owner_id = auth.uid())
  );
create policy "trust_history: institution read on published" on public.trust_score_history
  for select using (
    exists (
      select 1 from public.business_passports bp join public.profiles p on p.id = auth.uid()
      where bp.id = passport_id and bp.is_published = true and p.role in ('institution','admin')
    )
  );
