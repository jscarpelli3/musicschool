create table public.platform_admins (
  profile_id uuid primary key references public.profiles(id) on delete restrict,
  status text not null default 'active' check(status in('active','suspended')),
  granted_by uuid references public.profiles(id) on delete restrict,
  granted_at timestamptz not null default now(),
  notes text check(notes is null or length(notes)<=500)
);
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from public,anon,authenticated;

insert into public.platform_admins(profile_id,status,notes)
values('14e7620d-5443-4257-bc76-a8f7b4966d3c','active','Initial Common Time platform administrator');

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.platform_admins where profile_id=auth.uid() and status='active')
$$;
revoke all on function public.is_platform_admin() from public,anon;
grant execute on function public.is_platform_admin() to authenticated;
