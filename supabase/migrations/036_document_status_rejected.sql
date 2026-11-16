-- ====================================================================
-- Migration 036: add 'rejected' to document_status
-- ====================================================================
-- Needed by the renewal review in 037: an admin can turn down a renewal
-- document without touching the (still valid) verification it was
-- submitted for. Kept in its own migration because Postgres cannot use
-- a newly added enum value in the same transaction that adds it.
alter type public.document_status add value if not exists 'rejected';
