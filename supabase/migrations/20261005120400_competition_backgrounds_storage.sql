-- 12: private storage bucket for the leader's own competition background photo.
--
-- Files: competition-backgrounds/<party_id>/<random uuid>.jpg
-- The app re-encodes every photo in the browser before upload (max 1600 px, JPEG), which also
-- removes hidden metadata such as GPS location. The bucket itself only accepts JPEG up to 2 MB.
-- Read: members of that party (through short-lived signed URLs). Write/delete: its leader only.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('competition-backgrounds', 'competition-backgrounds', false, 2097152, array['image/jpeg'])
on conflict (id) do nothing;

create policy "competition-backgrounds: party members read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'competition-backgrounds'
    and (storage.foldername(name))[1] = (select private.my_party_id())::text
  );

create policy "competition-backgrounds: leader uploads"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'competition-backgrounds'
    and (storage.foldername(name))[1] = (select private.my_party_id())::text
    and (select private.is_party_leader(private.my_party_id()))
  );

create policy "competition-backgrounds: leader replaces"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'competition-backgrounds'
    and (storage.foldername(name))[1] = (select private.my_party_id())::text
    and (select private.is_party_leader(private.my_party_id()))
  )
  with check (
    bucket_id = 'competition-backgrounds'
    and (storage.foldername(name))[1] = (select private.my_party_id())::text
    and (select private.is_party_leader(private.my_party_id()))
  );

create policy "competition-backgrounds: leader deletes"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'competition-backgrounds'
    and (storage.foldername(name))[1] = (select private.my_party_id())::text
    and (select private.is_party_leader(private.my_party_id()))
  );
