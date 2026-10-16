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

-- Explicit grants, so the app works even when "Automatically expose new tables" is off.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.albums, public.album_photos, public.album_tracks to authenticated;
grant select on public.ai_usage to authenticated;

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

-- ---------- Pro plan: activation codes sold by hand ----------
-- Admins are listed by email. After running this file, add yourself once:
--   insert into public.app_admins (email) values ('ban@gmail.com');
create table if not exists public.app_admins (email text primary key);

create table if not exists public.activation_codes (
  code text primary key,                 -- CUOI-XXXX-XXXX
  kind text not null,                    -- wedding | studio | year
  days int not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  redeemed_by uuid references auth.users on delete set null,
  redeemed_email text,
  redeemed_at timestamptz,
  expires_at timestamptz,
  revoked boolean not null default false
);

create table if not exists public.redeem_fails (
  user_id uuid not null references auth.users on delete cascade,
  day date not null default current_date,
  count int not null default 0,
  primary key (user_id, day)
);

-- No policies: these tables are reached only through the functions below.
alter table public.app_admins enable row level security;
alter table public.activation_codes enable row level security;
alter table public.redeem_fails enable row level security;
revoke all on public.app_admins, public.activation_codes, public.redeem_fails from anon, authenticated;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.app_admins a join auth.users u on lower(u.email) = lower(a.email)
    where u.id = auth.uid() and u.email_confirmed_at is not null)
$$;

-- { pro, admin, until, kind } for the signed-in person. Admins always count as Pro.
create or replace function public.my_plan() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'admin', public.is_admin(),
    'pro', public.is_admin() or exists (select 1 from public.activation_codes c where c.redeemed_by = auth.uid() and not c.revoked and c.expires_at > now()),
    'until', (select max(c.expires_at) from public.activation_codes c where c.redeemed_by = auth.uid() and not c.revoked and c.expires_at > now()),
    'kind', (select c.kind from public.activation_codes c where c.redeemed_by = auth.uid() and not c.revoked and c.expires_at > now() order by c.expires_at desc limit 1))
$$;

-- 8 random characters without look-alikes (no 0/O, 1/I): 32^8 combinations.
create or replace function public.new_code() returns text
language plpgsql volatile set search_path = public as $$
declare a text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; b bytea := decode(md5(gen_random_uuid()::text), 'hex'); s text := '';
begin
  for i in 0..7 loop s := s || substr(a, get_byte(b, i) % 32 + 1, 1); end loop;
  return 'CUOI-' || substr(s, 1, 4) || '-' || substr(s, 5, 4);
end $$;

-- Customer enters a code. Returns {error} or the new plan. Errors are returned, not raised,
-- so the failed-attempt counter is kept (10 wrong codes per person per day).
create or replace function public.redeem_code(p_code text) returns json
language plpgsql volatile security definer set search_path = public as $$
declare v text; c public.activation_codes; fails int; base timestamptz;
begin
  if auth.uid() is null then return json_build_object('error', 'signed_out'); end if;
  select count into fails from public.redeem_fails where user_id = auth.uid() and day = current_date;
  if coalesce(fails, 0) >= 10 then return json_build_object('error', 'too_many'); end if;
  v := regexp_replace(upper(coalesce(p_code, '')), '[^A-Z0-9]', '', 'g');
  if length(v) = 12 and left(v, 4) = 'CUOI' then v := substr(v, 5); end if;
  select * into c from public.activation_codes where code = 'CUOI-' || substr(v, 1, 4) || '-' || substr(v, 5, 4) for update;
  if not found or length(v) <> 8 or c.revoked then
    insert into public.redeem_fails (user_id) values (auth.uid())
    on conflict (user_id, day) do update set count = public.redeem_fails.count + 1;
    return json_build_object('error', 'invalid');
  end if;
  if c.redeemed_by = auth.uid() then return json_build_object('error', 'already_yours'); end if;
  if c.redeemed_by is not null then return json_build_object('error', 'used'); end if;
  -- A new code adds its days after the current plan ends, so nothing is lost by redeeming early.
  select greatest(now(), coalesce(max(expires_at), now())) into base
  from public.activation_codes where redeemed_by = auth.uid() and not revoked;
  update public.activation_codes set redeemed_by = auth.uid(), redeemed_at = now(),
    redeemed_email = (select email from auth.users where id = auth.uid()),
    expires_at = base + make_interval(days => c.days)
  where code = c.code;
  return public.my_plan();
end $$;

create or replace function public.admin_create_codes(p_kind text, p_qty int, p_note text default '')
returns setof public.activation_codes
language plpgsql volatile security definer set search_path = public as $$
declare d int; made int := 0; r public.activation_codes;
begin
  if not public.is_admin() then raise exception 'not admin'; end if;
  d := case p_kind when 'wedding' then 60 when 'studio' then 30 when 'year' then 365 end;
  if d is null then raise exception 'unknown kind'; end if;
  if p_qty is null or p_qty < 1 or p_qty > 100 then raise exception 'qty 1-100'; end if;
  while made < p_qty loop
    insert into public.activation_codes (code, kind, days, note)
    values (public.new_code(), p_kind, d, left(coalesce(p_note, ''), 200))
    on conflict (code) do nothing returning * into r;
    if found then made := made + 1; return next r; end if;
  end loop;
end $$;

create or replace function public.admin_list_codes() returns setof public.activation_codes
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not admin'; end if;
  return query select * from public.activation_codes order by created_at desc limit 1000;
end $$;

create or replace function public.admin_set_revoked(p_code text, p_revoked boolean) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not admin'; end if;
  update public.activation_codes set revoked = p_revoked where code = p_code;
end $$;

revoke all on function public.is_admin(), public.my_plan(), public.new_code(), public.redeem_code(text),
  public.admin_create_codes(text, int, text), public.admin_list_codes(), public.admin_set_revoked(text, boolean) from public, anon;
grant execute on function public.is_admin(), public.my_plan(), public.redeem_code(text),
  public.admin_create_codes(text, int, text), public.admin_list_codes(), public.admin_set_revoked(text, boolean) to authenticated;
