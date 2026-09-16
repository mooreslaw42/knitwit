-- Somewhere for the pictures to live that is not a database row.
--
-- M4 of docs/plans/multi-user.md. Photos already have ids and already live outside the store blob;
-- this gives those ids a home on the server so a second device can see them.
--
-- Bytes do not belong in Postgres. A stash with thirty yarn photos is several megabytes, and every
-- one of them would ride along on every sync of the row that owns it. Storage holds the bytes, the
-- row holds the id, and the id is all that travels.

insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

-- Private, and owner-only. The path is `{user_id}/{photo_id}.jpg`, so the first folder *is* the
-- owner — which is what makes this checkable in a policy rather than merely intended.
--
-- Worth being blunt about why the bucket is not public: a public bucket means anyone with a URL can
-- read the object, and photo ids, while random, are not secrets. A knitter's stash and their
-- half-finished presents are theirs.

create policy "read own photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "write own photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "replace own photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "delete own photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
