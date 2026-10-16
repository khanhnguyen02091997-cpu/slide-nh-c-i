-- Open test: everyone gets every Pro feature and the code box is hidden.
-- Turn ON:  run this whole file (SQL Editor > New query > paste > Run).
-- Turn OFF: run   update public.app_flags set open_beta = false;
-- Note: running schema.sql or free-limits.sql again also turns the open test off (it restores the normal plan functions).
-- Needs schema.sql and free-limits.sql to have been run before. Safe to run again.

create table if not exists public.app_flags (id int primary key default 1 check (id = 1), open_beta boolean not null default false);
alter table public.app_flags enable row level security;
revoke all on public.app_flags from anon, authenticated;
insert into public.app_flags (id, open_beta) values (1, true) on conflict (id) do update set open_beta = true;

create or replace function public.open_beta() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select open_beta from public.app_flags where id = 1), false)
$$;

-- Same as in schema.sql, plus the open test flag: { pro, admin, until, kind, beta }.
create or replace function public.my_plan() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'admin', public.is_admin(),
    'beta', public.open_beta(),
    'pro', public.open_beta() or public.is_admin() or exists (select 1 from public.activation_codes c where c.redeemed_by = auth.uid() and not c.revoked and c.expires_at > now()),
    'until', (select max(c.expires_at) from public.activation_codes c where c.redeemed_by = auth.uid() and not c.revoked and c.expires_at > now()),
    'kind', (select c.kind from public.activation_codes c where c.redeemed_by = auth.uid() and not c.revoked and c.expires_at > now() order by c.expires_at desc limit 1))
$$;

-- Same as in free-limits.sql, plus the open test flag.
create or replace function public.is_pro(p_uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.open_beta()
      or exists (select 1 from public.app_admins a join auth.users u on lower(u.email) = lower(a.email)
                 where u.id = p_uid and u.email_confirmed_at is not null)
      or exists (select 1 from public.activation_codes c
                 where c.redeemed_by = p_uid and not c.revoked and c.expires_at > now())
$$;

revoke all on function public.open_beta(), public.is_pro(uuid) from public, anon, authenticated;
revoke all on function public.my_plan() from public, anon;
grant execute on function public.my_plan() to authenticated;
