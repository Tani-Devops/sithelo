-- ====================================================================
-- Explicit grants for RLS-helper functions
-- ====================================================================
-- Found during a full EXECUTE-grant audit: is_admin() and
-- current_institution_id() have never had an explicit grant/revoke
-- statement anywhere across 19 migrations — they've relied on
-- Postgres's default (PUBLIC executable) the entire time, undocumented.
--
-- Confirmed this is CORRECT, not an oversight to fix by revoking: both
-- functions are referenced inside RLS policy expressions throughout
-- migration 002 (18 references). When Postgres evaluates a table's RLS
-- policy for a query, it must invoke any function the policy
-- expression calls — and that invocation requires the QUERYING ROLE
-- (whatever role is running the original SELECT/UPDATE/etc, typically
-- `authenticated`) to itself have EXECUTE privilege on the function.
-- Revoking EXECUTE on these two from authenticated would not just
-- restrict direct .rpc() calls — it would break RLS evaluation on
-- nearly every table in the schema for every ordinary user. This is
-- categorically different from has_passport_relationship() et al.,
-- which are called directly by client code via .rpc() and were
-- correctly restricted precisely because direct callability was the
-- risk. is_admin()/current_institution_id() are never called directly
-- by client code at all (confirmed: zero .rpc("is_admin"...) or
-- .rpc("current_institution_id"...) calls anywhere in src/) — their
-- only callers are RLS policy expressions themselves, which is exactly
-- why PUBLIC-executable is the correct and necessary state.
--
-- This migration changes nothing about actual behavior. It converts an
-- accidental-by-omission default into an explicit, documented decision
-- — the same standard every other function's grant state has now been
-- held to.

grant execute on function public.is_admin() to public;
grant execute on function public.current_institution_id() to public;

comment on function public.is_admin is
  'Intentionally PUBLIC-executable (migration 020, made explicit) — required for RLS policy evaluation across nearly every table. Only ever reveals the CALLER''S OWN admin status (auth.uid()-scoped internally), never information about another user, so this is not an oracle risk the way a caller-controlled-argument function would be. Never called directly via .rpc() by client code — confirmed by repository search.';
comment on function public.current_institution_id is
  'Intentionally PUBLIC-executable (migration 020, made explicit) — same reasoning as is_admin(): required for RLS policy evaluation, only ever reveals the caller''s own institution membership, never called directly via .rpc() by client code.';
