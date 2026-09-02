-- ====================================================================
-- Message security hardening: dedicated mark_message_read() function
-- ====================================================================
-- Migration 006 fixed the missing WITH CHECK on the recipient's UPDATE
-- policy by adding same-row subquery comparisons for every column except
-- is_read, plus a column-level REVOKE on the other four. That's correct,
-- but it's still a general-purpose UPDATE grant with a narrow carve-out
-- — the kind of shape that's easy to accidentally widen later (e.g. a
-- future migration adding a legitimate-seeming column to the message
-- table that someone forgets to add to the immutability check).
--
-- This migration removes UPDATE access to `messages` from `authenticated`
-- entirely and replaces it with a single-purpose SECURITY DEFINER
-- function. There is no UPDATE surface left to accidentally widen.

drop policy if exists "messages: recipient mark read only" on public.messages;
revoke update on public.messages from authenticated;

create or replace function public.mark_message_read(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.messages
  set is_read = true
  where id = p_message_id
    and recipient_id = auth.uid();

  if not found then
    raise exception 'Message not found or you are not the recipient';
  end if;
end;
$$;

comment on function public.mark_message_read is
  'The ONLY way to mark a message read. Replaces broad UPDATE access — recipient_id = auth.uid() is checked inside the function itself, not via RLS, so there is no UPDATE grant on the table at all for authenticated to potentially misuse.';

grant execute on function public.mark_message_read(uuid) to authenticated;
