-- Private user avatars and school logos with owner-scoped upload permissions.

alter table public.profiles add column avatar_path text;

revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url, avatar_path, phone) on public.profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('school-logos', 'school-logos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy avatars_select_related
on storage.objects for select
to authenticated
using (
  bucket_id = 'avatars'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or public.shares_school_with(((storage.foldername(name))[1])::uuid)
  )
);

create policy avatars_insert_own
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy avatars_update_own
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy avatars_delete_own
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy school_logos_select_member
on storage.objects for select
to authenticated
using (
  bucket_id = 'school-logos'
  and public.is_school_member(((storage.foldername(name))[1])::uuid)
);

create policy school_logos_insert_management
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'school-logos'
  and public.has_school_role(
    ((storage.foldername(name))[1])::uuid,
    array['owner', 'admin']
  )
);

create policy school_logos_update_management
on storage.objects for update
to authenticated
using (
  bucket_id = 'school-logos'
  and public.has_school_role(
    ((storage.foldername(name))[1])::uuid,
    array['owner', 'admin']
  )
)
with check (
  bucket_id = 'school-logos'
  and public.has_school_role(
    ((storage.foldername(name))[1])::uuid,
    array['owner', 'admin']
  )
);

create policy school_logos_delete_management
on storage.objects for delete
to authenticated
using (
  bucket_id = 'school-logos'
  and public.has_school_role(
    ((storage.foldername(name))[1])::uuid,
    array['owner', 'admin']
  )
);
