-- Faza 2G — clinic branding (Pro feature branding_custom).
--
-- Applied to the remote Supabase project via MCP `apply_migration`
-- under the name: phase2g_branding
--
-- Summary:
--   * clinics.branding_json already exists (Faza 1): logo_path + colors.
--   * Private bucket clinic-branding; path {clinic_id}/logo.webp (D21).
--   * Owner write; all clinic members can SELECT (app shell + invoice PDF).
--   * No new tables.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'clinic-branding',
  'clinic-branding',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists clinic_branding_select on storage.objects;
create policy clinic_branding_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'clinic-branding'
    and (storage.foldername(name))[1] = ((select public.current_clinic_id())::text)
  );

drop policy if exists clinic_branding_insert on storage.objects;
create policy clinic_branding_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'clinic-branding'
    and (storage.foldername(name))[1] = ((select public.current_clinic_id())::text)
    and (select public.is_clinic_owner())
  );

drop policy if exists clinic_branding_update on storage.objects;
create policy clinic_branding_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'clinic-branding'
    and (storage.foldername(name))[1] = ((select public.current_clinic_id())::text)
    and (select public.is_clinic_owner())
  )
  with check (
    bucket_id = 'clinic-branding'
    and (storage.foldername(name))[1] = ((select public.current_clinic_id())::text)
    and (select public.is_clinic_owner())
  );

drop policy if exists clinic_branding_delete on storage.objects;
create policy clinic_branding_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'clinic-branding'
    and (storage.foldername(name))[1] = ((select public.current_clinic_id())::text)
    and (select public.is_clinic_owner())
  );
