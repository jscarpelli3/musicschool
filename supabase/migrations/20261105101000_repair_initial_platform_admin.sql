-- The original bootstrap used a profile UUID from an earlier environment. Bind
-- the initial platform administrator to the verified production login instead.
insert into public.platform_admins(profile_id,status,notes)
select profile.id,'active','Initial Common Time platform administrator'
from public.profiles profile
where lower(trim(profile.email))='scarpelli.jon@gmail.com'
on conflict(profile_id) do update
set status='active',notes='Initial Common Time platform administrator';

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path='' as $$
  select
    lower(trim(coalesce(auth.jwt()->>'email','')))='scarpelli.jon@gmail.com'
    or exists(
      select 1 from public.platform_admins
      where profile_id=auth.uid() and status='active'
    )
$$;

revoke all on function public.is_platform_admin() from public,anon;
grant execute on function public.is_platform_admin() to authenticated;
