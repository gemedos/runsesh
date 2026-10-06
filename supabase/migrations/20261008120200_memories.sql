-- 19: memories, photos of the day, approved 2026-10-06 (docs/design.md §11).
--
-- A player posts up to 3 photos per day, for today only, no captions, kept until they delete
-- them. Visible to the owner, their party members and their friends (same rule as the profile).
--
-- Upload order (enforced): 1) insert the row (checks owner, day window and the 3-per-day limit),
-- 2) upload the file to the private bucket at exactly that row's path. Storage only accepts a file
-- whose path belongs to one of the uploader's own rows, so files cannot be uploaded without
-- passing the limit. Photos are re-encoded in the browser first (JPEG, max 1600 px), which drops
-- hidden metadata such as GPS location; the bucket accepts JPEG only, max 2 MB.
-- Files: memories/<user_id>/<random uuid>.jpg. Shown through short-lived signed URLs.

create table public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  path text not null unique,
  created_at timestamptz not null default now(),

  constraint memories_path_check check (
    path ~ ('^' || user_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$')
  )
);
create index memories_user_day_idx on public.memories (user_id, day desc);

comment on table public.memories is 'Photo memories. Owner writes; owner, party members and friends read. Files in storage bucket memories.';

/** True if the caller may see a player's memories: themselves, a party member or a friend. */
create or replace function private.can_view_user(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user = (select auth.uid()) or private.shares_party(p_user) or private.are_friends(p_user);
$$;
revoke all on function private.can_view_user(uuid) from public, anon;
grant execute on function private.can_view_user(uuid) to authenticated;

revoke all on table public.memories from public, anon, authenticated;
grant select, delete on table public.memories to authenticated;
grant insert (id, user_id, day, path) on table public.memories to authenticated;

alter table public.memories enable row level security;

create policy "memories: owner, party and friends read"
  on public.memories for select to authenticated
  using ((select private.can_view_user(user_id)));

create policy "memories: owner posts for today"
  on public.memories for insert to authenticated
  with check (
    user_id = (select auth.uid())
    -- "Today" in any time zone: the UTC day before, of, or after.
    and day between ((pg_catalog.now() at time zone 'UTC')::date - 1) and ((pg_catalog.now() at time zone 'UTC')::date + 1)
  );

create policy "memories: owner deletes"
  on public.memories for delete to authenticated
  using (user_id = (select auth.uid()));

-- No update policy and no update grant: a memory is never changed, only deleted.

-- At most 3 memories per player per day (serialised per player and day, so parallel uploads
-- cannot slip past the count).
create or replace function private.memories_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('memories:' || new.user_id::text || ':' || new.day::text, 0));
  if (select pg_catalog.count(*) from public.memories m where m.user_id = new.user_id and m.day = new.day) >= 3 then
    raise exception 'memory_limit' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke all on function private.memories_limit() from public, anon, authenticated;

create trigger memories_limit
  before insert on public.memories
  for each row execute function private.memories_limit();

-- ---------------------------------------------------------------------------
-- Storage: private bucket, JPEG only, 2 MB.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('memories', 'memories', false, 2097152, array['image/jpeg'])
on conflict (id) do nothing;

create policy "memories files: owner, party and friends read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'memories'
    and exists (select 1 from public.memories m where m.path = name) -- RLS on memories decides who
  );

create policy "memories files: owner uploads for an own row"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'memories'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.memories m where m.path = name and m.user_id = (select auth.uid()))
  );

create policy "memories files: owner deletes"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'memories'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
