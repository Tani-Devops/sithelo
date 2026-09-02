-- ====================================================================
-- Fix notifications UPDATE policy — found during the RLS master audit
-- (RLS_MASTER_AUDIT.md), same bug class as the messages fix but lower
-- severity (notifications are one-way system messages, not a two-party
-- record where tampering could rewrite a paper trail). Fixing it anyway
-- rather than leaving a known gap on the books.
-- ====================================================================

drop policy if exists "notifications: recipient mark read" on public.notifications;

create policy "notifications: recipient mark read only" on public.notifications
  for update using (recipient_id = auth.uid())
  with check (
    recipient_id = auth.uid()
    and title = (select n2.title from public.notifications n2 where n2.id = notifications.id)
    and body is not distinct from (select n2.body from public.notifications n2 where n2.id = notifications.id)
    and category = (select n2.category from public.notifications n2 where n2.id = notifications.id)
    and channel = (select n2.channel from public.notifications n2 where n2.id = notifications.id)
  );

revoke update (title, body, category, channel, metadata) on public.notifications from authenticated;

comment on table public.notifications is
  'Only is_read is writable by the recipient after insert (column-level revoke, migration 014). Same pattern as messages — see AUDIT.md / RLS_MASTER_AUDIT.md.';
