-- Free plan limits enforced by the database, so they hold even if someone edits the web page.
-- Run once in Supabase: SQL Editor > New query > paste > Run (after schema.sql). Safe to run again.
-- Free: at most 10 photos per album. Pro (activation code) and admins: no limit.

create or replace function public.is_pro(p_uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_admins a join auth.users u on lower(u.email) = lower(a.email)
                 where u.id = p_uid and u.email_confirmed_at is not null)
      or exists (select 1 from public.activation_codes c
                 where c.redeemed_by = p_uid and not c.revoked and c.expires_at > now())
$$;

-- Photo rows: an 11th new photo in a free album is refused. Re-saving existing rows is always fine.
create or replace function public.free_photo_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.album_photos where id = new.id) then return new; end if;
  if not public.is_pro(new.user_id)
     and (select count(*) from public.album_photos where album_id = new.album_id) >= 10 then
    raise exception 'free_photo_limit' using hint = 'Bản miễn phí tối đa 10 ảnh mỗi album';
  end if;
  return new;
end $$;
drop trigger if exists free_photo_limit on public.album_photos;
create trigger free_photo_limit before insert on public.album_photos
  for each row execute function public.free_photo_limit();

-- Photo files: a free user cannot upload an 11th file into one album's photos folder
-- (<user id>/<album id>/photos/...), so storage cannot be filled behind the app's back.
create or replace function public.free_photo_room(p_name text) returns boolean
language sql stable security definer set search_path = public, storage as $$
  select (storage.foldername(p_name))[3] is distinct from 'photos'
      or public.is_pro(auth.uid())
      or (select count(*) from storage.objects o
          where o.bucket_id = 'media'
            and o.name like (storage.foldername(p_name))[1] || '/' || (storage.foldername(p_name))[2] || '/photos/%') < 10
$$;
drop policy if exists "free photo limit" on storage.objects;
create policy "free photo limit" on storage.objects as restrictive for insert to authenticated
  with check (bucket_id <> 'media' or public.free_photo_room(name));

revoke all on function public.is_pro(uuid), public.free_photo_limit(), public.free_photo_room(text) from public, anon, authenticated;
grant execute on function public.free_photo_room(text) to authenticated;
