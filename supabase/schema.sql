-- Slide Ảnh Cưới: database, row level security and storage.
-- Run once in Supabase: SQL Editor > New query > paste > Run.

create table if not exists public.albums (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  groom text not null default '',
  bride text not null default '',
  wedding_date date,
  message text not null default '',
  mode text not null default 'party',
  style text not null default 'lux',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.album_photos (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.albums on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  path text not null,
  position int not null default 0,
  width int,
  height int,
  created_at timestamptz not null default now()
);

create table if not exists public.album_tracks (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.albums on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  path text not null,
  name text not null default '',
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users on delete cascade,
  day date not null default current_date,
  count int not null default 0,
  primary key (user_id, day)
);

create index if not exists album_photos_album on public.album_photos (album_id, position);
create index if not exists album_tracks_album on public.album_tracks (album_id, position);
create index if not exists albums_user on public.albums (user_id, updated_at desc);

alter table public.albums enable row level security;
alter table public.album_photos enable row level security;
alter table public.album_tracks enable row level security;
alter table public.ai_usage enable row level security;

-- Each person sees and changes only their own rows.
drop policy if exists "own albums" on public.albums;
create policy "own albums" on public.albums for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own photos" on public.album_photos;
create policy "own photos" on public.album_photos for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.albums a where a.id = album_id and a.user_id = auth.uid()));

drop policy if exists "own tracks" on public.album_tracks;
create policy "own tracks" on public.album_tracks for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.albums a where a.id = album_id and a.user_id = auth.uid()));

drop policy if exists "read own usage" on public.ai_usage;
create policy "read own usage" on public.ai_usage for select using (user_id = auth.uid());

-- Counts one AI request for the signed-in person and returns today's total.
create or replace function public.bump_ai_usage() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'signed out'; end if;
  insert into public.ai_usage (user_id, day, count) values (auth.uid(), current_date, 1)
  on conflict (user_id, day) do update set count = public.ai_usage.count + 1
  returning count into n;
  return n;
end $$;
revoke all on function public.bump_ai_usage() from public, anon;
grant execute on function public.bump_ai_usage() to authenticated;

-- Private bucket for photos and music; files live under <user id>/<album id>/...
insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

drop policy if exists "own media read" on storage.objects;
create policy "own media read" on storage.objects for select
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "own media write" on storage.objects;
create policy "own media write" on storage.objects for insert
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "own media update" on storage.objects;
create policy "own media update" on storage.objects for update
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "own media delete" on storage.objects;
create policy "own media delete" on storage.objects for delete
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
