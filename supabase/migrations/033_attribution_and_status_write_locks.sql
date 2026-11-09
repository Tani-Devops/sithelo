-- ====================================================================
-- Migration 033: close two remaining client-write gaps found in audit
-- ====================================================================

-- --------------------------------------------------------------------
-- PART A — documents.uploaded_by was client-settable on INSERT
-- --------------------------------------------------------------------
-- Migration 021's documents INSERT grant included uploaded_by, and no
-- trigger forces it to auth.uid() (contrast opportunities.created_by).
-- Nothing consumed it for authorization, so no escalation existed, but
-- it was the same trust-client-attribution gap the 021 pass closed
-- elsewhere. The only real writer is POST /api/documents/upload, which
-- runs with the service client and derives uploaded_by from the
-- verified session — so the column can simply leave the grant. Client
-- SDK inserts now land with uploaded_by = null (it's nullable), which
-- is exactly what an unattributed row should look like.

revoke insert on public.documents from authenticated;
grant insert (id, passport_id, document_type, file_path, file_name, issued_date, expiry_date) on public.documents to authenticated;
-- uploaded_by excluded from the INSERT grant (033) — forced to null for
-- client writes; the sanctioned route sets it from the session.

-- --------------------------------------------------------------------
-- PART B — institutions could set opportunities.status to any value
-- --------------------------------------------------------------------
-- The 002-era "opportunities: institution manage own" policy is `for
-- all`, and the table-level UPDATE grant made every column writable —
-- an institution could UPDATE its own opportunity to status='awarded'
-- (or re-open a closed/cancelled one) with no application/winner
-- existence check. Migration 029 fixed this class for `applications`
-- with a transition allowlist; opportunities still had the raw hole.
--
-- Fix: revoke table-level UPDATE and grant back only the editable
-- content columns. `status` (and institution_id/created_by/created_at/
-- updated_at/id) are now unwritable by authenticated clients entirely.
-- No UI or API path updates status today; when the product needs a
-- close/cancel flow it must go through a dedicated SECURITY DEFINER
-- function with a transition allowlist (mirroring admin_review_institution
-- and 029's application transition table), not a re-grant of the column.

revoke update on public.opportunities from authenticated;
grant update (
  title, opportunity_type, category, description, province, municipality,
  businesses_needed, value_estimate, closing_date, requirements, created_by
) on public.opportunities to authenticated;
-- Excluded from UPDATE (033): status, institution_id, created_at,
-- updated_at, id. created_by REMAINS grantable deliberately: its
-- immutability is already enforced by the enforce_opportunity_created_by
-- trigger (019), which silently reverts attempts to reassign it — the
-- behavior the test suite asserts (005_adversarial_pass_regression).
-- institution_id immutability is enforced by the existing WITH CHECK.
-- Cross-tenant edits remain RLS-filtered to zero rows by the existing
-- institution-own policy; this only closes the privileged-column write.

comment on table public.opportunities is
  'status is UPDATE-revoked from authenticated (033): no client may transition an opportunity''s lifecycle state. A future close/cancel UI must use a dedicated SECURITY DEFINER function with a transition allowlist (see 029 for the applications precedent).';
