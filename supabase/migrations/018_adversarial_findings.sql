-- ====================================================================
-- Adversarial pass: five confirmed findings, fixed
-- ====================================================================
-- Every finding below was confirmed by reading the actual current
-- policy/grant SQL before writing a fix — not assumed from a directive's
-- description. See SECURITY_AUDIT_MASTER.md for the full writeup of
-- each.

-- --------------------------------------------------------------------
-- PHASE 2: has_passport_relationship() was a relationship oracle
-- --------------------------------------------------------------------
-- Confirmed: EXECUTE was granted to `authenticated` with BOTH arguments
-- caller-controlled, and confirmed EVERY legitimate caller (get_passport_
-- detail, list_passport_documents, verify-business-passport, the
-- signed-url route) either runs as a SECURITY DEFINER function (which
-- doesn't need the grant — it executes with the definer's privileges,
-- not the caller's) or uses the service-role client directly. The
-- `authenticated` grant was unused by every real code path and let any
-- authenticated user — including an entrepreneur with no institution at
-- all — probe arbitrary (institution_id, passport_id) pairs and learn
-- relationship existence. That's a real information leak (e.g. whether
-- a specific institution has expressed interest in a specific business)
-- independent of whether it grants data access.

revoke execute on function public.has_passport_relationship(uuid, uuid) from authenticated, public;
-- service_role keeps it — needed by nothing currently (all callers are
-- SECURITY DEFINER functions or already service-role clients), but kept
-- for any future server-side/internal caller that isn't one of those.

-- Safe, caller-derived alternative for any future UI that needs "does MY
-- institution have a relationship with this passport" without being able
-- to probe arbitrary institutions.
create or replace function public.has_my_passport_relationship(p_passport_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_institution_id uuid;
begin
  select institution_id into v_institution_id from public.profiles where id = auth.uid();
  if v_institution_id is null then
    return false;
  end if;
  return public.has_passport_relationship(v_institution_id, p_passport_id);
end;
$$;

revoke execute on function public.has_my_passport_relationship(uuid) from public;
grant execute on function public.has_my_passport_relationship(uuid) to authenticated;

comment on function public.has_my_passport_relationship is
  'Safe, self-scoped wrapper around has_passport_relationship() — derives institution_id from auth.uid() internally, so a caller can only ever ask about their OWN institution''s relationship, never probe another institution''s. Grant this to authenticated; never has_passport_relationship() itself.';

-- --------------------------------------------------------------------
-- PHASE 3: applications.reviewed_by / reviewed_at — do not trust the
-- trigger alone
-- --------------------------------------------------------------------
-- Migration 006's trigger (set_application_review_metadata) forces these
-- on legitimate status transitions, which is correct, but the directive
-- is right not to assume that's sufficient on its own: nothing stopped a
-- client from including reviewed_by/reviewed_at explicitly in their own
-- UPDATE statement's SET list for a row they otherwise have UPDATE
-- rights to (e.g. an institution updating their own opportunity's
-- application) — the WITH CHECK in migration 006 doesn't reference these
-- two columns at all for the institution policy. Column-level REVOKE is
-- the actual hard boundary; the trigger becomes defense-in-depth instead
-- of the only protection. Safe to add: the trigger's internal
-- `new.reviewed_by := auth.uid()` assignment is not itself subject to
-- this REVOKE (privilege checks apply to what the CLIENT's statement
-- explicitly SETs, not what a BEFORE trigger mutates on NEW internally),
-- so legitimate review-status changes continue working unchanged.

revoke update (reviewed_by, reviewed_at) on public.applications from authenticated;

comment on table public.applications is
  'reviewed_by/reviewed_at: UPDATE revoked from authenticated entirely (migration 018) — the ONLY way these are ever set is the set_application_review_metadata trigger, which runs as SECURITY DEFINER and is not subject to this revoke. A client explicitly including these columns in their own UPDATE statement now fails outright rather than being merely discouraged by a WITH CHECK.';

-- --------------------------------------------------------------------
-- PHASE 4: shortlists could manufacture authorization
-- --------------------------------------------------------------------
-- Confirmed: "shortlists: institution manage own" was `for all` with
-- only `institution_id = current_institution_id()` checked — nothing
-- required the target passport to be published, or created_by to match
-- the actual caller. An institution could shortlist an UNPUBLISHED
-- passport directly via the client SDK, and since
-- has_passport_relationship() only checks for a shortlist/application
-- row's existence (not whether it was legitimately created), this
-- manufactured relationship would then unlock tier-2 Passport data AND
-- document access for a business that never published, never consented,
-- and has no idea it was "shortlisted." This is exactly the
-- authorization-by-arbitrary-row-write pattern the adversarial review
-- was looking for, and it was real.
--
-- Business rule enforced here (documented, not silently assumed): a
-- passport must be published before it can be shortlisted at all —
-- shortlisting an unpublished business isn't a supported product flow
-- and shouldn't be reachable via direct API access either.

drop policy if exists "shortlists: institution manage own" on public.shortlists;

create policy "shortlists: institution select own" on public.shortlists
  for select using (institution_id = public.current_institution_id());

create policy "shortlists: institution insert own on published only" on public.shortlists
  for insert with check (
    institution_id = public.current_institution_id()
    and created_by = auth.uid()
    and exists (select 1 from public.business_passports bp where bp.id = passport_id and bp.is_published = true)
  );

create policy "shortlists: institution delete own" on public.shortlists
  for delete using (institution_id = public.current_institution_id());

-- No UPDATE policy — shortlists have no legitimately-mutable fields
-- (the relationship either exists or doesn't); removing and re-adding is
-- the correct operation for "change" here, not an UPDATE.

-- --------------------------------------------------------------------
-- PHASE 6: opportunities.created_by could be forged
-- --------------------------------------------------------------------
-- Confirmed: zero mentions of created_by anywhere in the RLS policy
-- file. institution_id reassignment was already correctly blocked (the
-- existing WITH CHECK ties it to current_institution_id()), but
-- created_by — which is meant to represent the actual staff member who
-- posted the opportunity, used for accountability — had no protection
-- at all against a direct client insert/update setting it to an
-- arbitrary UUID.

create or replace function public.enforce_opportunity_created_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
  elsif tg_op = 'UPDATE' then
    new.created_by := old.created_by; -- immutable after creation
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_opportunity_created_by() from public;
-- Trigger function, never called directly.

drop trigger if exists trg_opportunity_created_by on public.opportunities;
create trigger trg_opportunity_created_by
  before insert or update on public.opportunities
  for each row execute function public.enforce_opportunity_created_by();

comment on function public.enforce_opportunity_created_by is
  'created_by is forced to the real auth.uid() on insert and made immutable on update, regardless of what the client submits — matches the same pattern used for applications.reviewed_by (trigger) and profiles.institution_id (trigger).';

-- --------------------------------------------------------------------
-- PHASE 5: business_references exposed reference_contact to any
-- institution on a published passport
-- --------------------------------------------------------------------
-- A business showcasing references (name, organisation, project,
-- rating) to institutions is legitimate discovery-appropriate content —
-- it's how a business demonstrates credibility. The reference's PRIVATE
-- CONTACT DETAILS are not the business's to disclose to every
-- institution automatically; that's third-party personal information
-- being exposed without that third party's involvement in the decision.

revoke select (reference_contact) on public.business_references from authenticated;

comment on table public.business_references is
  'reference_contact has SELECT revoked from authenticated entirely (migration 018) — visible to the owner (who entered it) and admin only. Institutions see reference_name/reference_organisation/project_description/rating (credibility signal) but never the private contact details of a third party who did not consent to broad disclosure. NOTE: no current UI reads this table at all (confirmed by repo search before this migration) — when a references-management screen is eventually built for the owner, it will need a dedicated SECURITY DEFINER function to read reference_contact for the owner''s own rows, mirroring get_passport_detail()''s pattern, since this column-level revoke applies to the whole authenticated role including the owner.';
