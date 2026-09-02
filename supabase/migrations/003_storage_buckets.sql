-- ====================================================================
-- ZENZELE STORAGE BUCKETS
-- Migration 003: idempotent bucket creation + storage policies
-- ====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('passport-documents', 'passport-documents', false, 10485760, array['application/pdf','image/jpeg','image/png']),
  ('passport-images', 'passport-images', true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('institution-logos', 'institution-logos', true, 2097152, array['image/jpeg','image/png','image/webp']),
  ('generated-pdfs', 'generated-pdfs', false, 10485760, array['application/pdf']),
  ('bulk-imports', 'bulk-imports', false, 5242880, array['text/csv'])
on conflict (id) do nothing;

-- passport-documents: owner read/write, admin read
create policy "docs: owner insert" on storage.objects
  for insert with check (
    bucket_id = 'passport-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "docs: owner read" on storage.objects
  for select using (
    bucket_id = 'passport-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "docs: admin read all" on storage.objects
  for select using (bucket_id = 'passport-documents' and public.is_admin());

-- passport-images: public read, owner write
create policy "images: public read" on storage.objects
  for select using (bucket_id = 'passport-images');
create policy "images: owner write" on storage.objects
  for insert with check (
    bucket_id = 'passport-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- institution-logos: public read, institution admin write
create policy "logos: public read" on storage.objects
  for select using (bucket_id = 'institution-logos');
create policy "logos: institution write" on storage.objects
  for insert with check (
    bucket_id = 'institution-logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- generated-pdfs: owner read only (written by service role in edge function)
create policy "pdfs: owner read" on storage.objects
  for select using (
    bucket_id = 'generated-pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- bulk-imports: admin only
create policy "bulk_imports: admin manage" on storage.objects
  for all using (bucket_id = 'bulk-imports' and public.is_admin())
  with check (bucket_id = 'bulk-imports' and public.is_admin());
