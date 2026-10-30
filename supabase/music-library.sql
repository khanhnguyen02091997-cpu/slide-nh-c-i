-- Shared music library ("Nhạc có sẵn"): songs the admin uploads once, every invitation can pick them.
-- Files live in the media bucket under library/music/... Run once in Supabase SQL Editor (after schema.sql). Safe to run again.
-- Only upload music you have the right to share (your own, bought royalty-free, or public domain).

create table if not exists public.music_library (
  id uuid primary key default gen_random_uuid(),
  path text not null unique check (path like 'library/music/%'),
  name text not null,
  artist text not null default '',
  mood text not null default '',
  position int not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.music_library to anon, authenticated;
grant insert, update, delete on public.music_library to authenticated;
alter table public.music_library enable row level security;

drop policy if exists "library read" on public.music_library;
create policy "library read" on public.music_library for select using (true);
drop policy if exists "library admin" on public.music_library;
create policy "library admin" on public.music_library for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Anyone may open (sign) library files; only admins add or remove them.
drop policy if exists "library media read" on storage.objects;
create policy "library media read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'media' and name like 'library/%');
drop policy if exists "library media write" on storage.objects;
create policy "library media write" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and name like 'library/%' and public.is_admin());
drop policy if exists "library media delete" on storage.objects;
create policy "library media delete" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and name like 'library/%' and public.is_admin());
