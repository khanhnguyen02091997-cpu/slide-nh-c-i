-- Couple fill-in link for online invitations: the studio sends the bride and groom a secret link
-- /d/<token> where they type their own names, parents, events and bank accounts; it is saved
-- straight into the invitation. Run once in Supabase: SQL Editor > New query > paste > Run
-- (after invite.sql). Safe to run again.

alter table public.invites add column if not exists couple_token text;
create unique index if not exists invites_couple_token on public.invites (couple_token) where couple_token is not null;

-- The keys of invites.data that the couple may change from their link.
create or replace function public.couple_keys() returns text[] language sql immutable as $$
  select array['groomFull', 'brideFull', 'groomFam', 'brideFam', 'events', 'gifts']
$$;

-- What the couple's page shows: names, date and the fields they can edit.
create or replace function public.couple_get(p_token text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'groom', a.groom, 'bride', a.bride, 'date', a.wedding_date, 'slug', i.slug, 'published', i.published,
    'data', (select coalesce(jsonb_object_agg(k, i.data->k), '{}'::jsonb) from unnest(public.couple_keys()) k where i.data ? k))
  from public.invites i join public.albums a on a.id = i.album_id
  where length(coalesce(p_token, '')) >= 24 and i.couple_token = p_token
$$;

-- Saves the couple's fields. Returns 'ok', or an error word: closed | bad.
create or replace function public.couple_save(p_token text, p_groom text, p_bride text, p_date date, p_data jsonb)
returns text language plpgsql volatile security definer set search_path = public as $$
declare v_album uuid; v_add jsonb;
begin
  if length(coalesce(p_token, '')) < 24 then return 'closed'; end if;
  select album_id into v_album from public.invites where couple_token = p_token;
  if v_album is null then return 'closed'; end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' or pg_column_size(p_data) > 40000 then return 'bad'; end if;
  if (p_data ? 'events' and jsonb_typeof(p_data->'events') <> 'array')
     or (p_data ? 'gifts' and jsonb_typeof(p_data->'gifts') <> 'array')
     or (p_data ? 'groomFam' and jsonb_typeof(p_data->'groomFam') <> 'object')
     or (p_data ? 'brideFam' and jsonb_typeof(p_data->'brideFam') <> 'object') then return 'bad'; end if;
  select coalesce(jsonb_object_agg(k, p_data->k), '{}'::jsonb) into v_add from unnest(public.couple_keys()) k where p_data ? k;
  update public.invites
    set data = data || v_add || jsonb_build_object('coupleAt', to_jsonb(now())), updated_at = now()
    where album_id = v_album;
  update public.albums
    set groom = coalesce(nullif(left(trim(p_groom), 60), ''), groom),
        bride = coalesce(nullif(left(trim(p_bride), 60), ''), bride),
        wedding_date = coalesce(p_date, wedding_date),
        updated_at = now()
    where id = v_album;
  return 'ok';
end $$;

revoke all on function public.couple_get(text), public.couple_save(text, text, text, date, jsonb) from public;
grant execute on function public.couple_get(text), public.couple_save(text, text, text, date, jsonb) to anon, authenticated;
