-- Online wedding invitations (thiệp cưới online): one invitation per album, a public link
-- /t/<slug>, guest replies (RSVP) and wishes. Run once in Supabase: SQL Editor > New query >
-- paste > Run (after schema.sql). Safe to run again.

create table if not exists public.invites (
  album_id uuid primary key references public.albums on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,59}$'),
  published boolean not null default false,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.invite_replies (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.invites on delete cascade,
  name text not null,
  phone text not null default '',
  attend text not null default 'yes' check (attend in ('yes', 'no', 'maybe')),
  guests int not null default 1 check (guests between 0 and 20),
  side text not null default '' check (side in ('', 'groom', 'bride')),
  wish text not null default '',
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists invite_replies_album on public.invite_replies (album_id, created_at desc);

grant select, insert, update, delete on public.invites to authenticated;
grant select, update, delete on public.invite_replies to authenticated;
revoke all on public.invites, public.invite_replies from anon;

alter table public.invites enable row level security;
alter table public.invite_replies enable row level security;

-- The couple's studio edits its own invitation and reads, hides or deletes the replies to it.
drop policy if exists "own invites" on public.invites;
create policy "own invites" on public.invites for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.albums a where a.id = album_id and a.user_id = auth.uid()));
drop policy if exists "own replies" on public.invite_replies;
create policy "own replies" on public.invite_replies for all
  using (exists (select 1 from public.invites i where i.album_id = invite_replies.album_id and i.user_id = auth.uid()));

-- Guests are signed out: they read a published invitation and write a reply only through these functions.
create or replace function public.get_invite(p_slug text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'slug', i.slug, 'data', i.data,
    'groom', a.groom, 'bride', a.bride, 'date', a.wedding_date, 'style', a.style,
    'photos', coalesce((select json_agg(p.path order by p.position) from public.album_photos p where p.album_id = a.id), '[]'::json),
    'tracks', coalesce((select json_agg(json_build_object('path', t.path, 'name', t.name) order by t.position) from public.album_tracks t where t.album_id = a.id), '[]'::json),
    'wishes', case when coalesce((i.data->>'wishes')::boolean, true) then coalesce((
      select json_agg(json_build_object('name', w.name, 'wish', w.wish, 'at', w.created_at) order by w.created_at desc)
      from (select r.name, r.wish, r.created_at from public.invite_replies r
            where r.album_id = a.id and r.wish <> '' and not r.hidden order by r.created_at desc limit 200) w), '[]'::json) else '[]'::json end)
  from public.invites i join public.albums a on a.id = i.album_id
  where i.slug = lower(p_slug) and i.published
$$;

-- Returns 'ok', or an error word: closed | bad | full.
create or replace function public.reply_invite(p_slug text, p_name text, p_phone text, p_attend text, p_guests int, p_side text, p_wish text)
returns text language plpgsql volatile security definer set search_path = public as $$
declare v_album uuid; v_rsvp boolean;
begin
  select album_id, coalesce((data->>'rsvp')::boolean, true) into v_album, v_rsvp from public.invites where slug = lower(p_slug) and published;
  if v_album is null or not v_rsvp then return 'closed'; end if;
  if length(trim(coalesce(p_name, ''))) = 0 then return 'bad'; end if;
  -- A spam guard: a link takes at most 3000 replies, and 30 in any 10 minutes.
  if (select count(*) from public.invite_replies where album_id = v_album) >= 3000
     or (select count(*) from public.invite_replies where album_id = v_album and created_at > now() - interval '10 minutes') >= 30 then
    return 'full';
  end if;
  insert into public.invite_replies (album_id, name, phone, attend, guests, side, wish)
  values (v_album, left(trim(p_name), 80), left(trim(coalesce(p_phone, '')), 20),
    case when p_attend in ('yes', 'no', 'maybe') then p_attend else 'yes' end,
    greatest(0, least(20, coalesce(p_guests, 1))),
    case when p_side in ('groom', 'bride') then p_side else '' end,
    left(trim(coalesce(p_wish, '')), 600));
  return 'ok';
end $$;

revoke all on function public.get_invite(text), public.reply_invite(text, text, text, text, int, text, text) from public;
grant execute on function public.get_invite(text), public.reply_invite(text, text, text, text, int, text, text) to anon, authenticated;

-- Guests may open the photos and music of an album whose invitation is published (signed links only;
-- the bucket stays private). Files live under <user id>/<album id>/...
create or replace function public.invite_media(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.invites i
    where i.published and i.user_id::text = (storage.foldername(p_name))[1] and i.album_id::text = (storage.foldername(p_name))[2])
$$;
revoke all on function public.invite_media(text) from public;
grant execute on function public.invite_media(text) to anon, authenticated;

drop policy if exists "invite media read" on storage.objects;
create policy "invite media read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'media' and public.invite_media(name));
