create table public.early_access_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null check(email=lower(trim(email)) and length(email) between 3 and 320),
  name text check(name is null or length(name) between 1 and 160),
  school_name text check(school_name is null or length(school_name) between 1 and 160),
  source text not null default 'marketing_landing' check(length(source) between 1 and 80),
  status text not null default 'subscribed' check(status in('subscribed','unsubscribed','invited','converted')),
  consented_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(email)
);
alter table public.early_access_signups enable row level security;
revoke all on public.early_access_signups from public,anon,authenticated;

create or replace function public.record_early_access_signup(p_email text,p_name text default null,p_school_name text default null)
returns void language plpgsql security definer set search_path='' as $$
declare normalized_email text:=lower(trim(p_email));
begin
 if auth.role()<>'service_role' then raise exception 'not_authorized'; end if;
 if normalized_email!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(normalized_email)>320
   or length(coalesce(nullif(trim(p_name),''),''))>160 or length(coalesce(nullif(trim(p_school_name),''),''))>160 then raise exception 'invalid_signup'; end if;
 insert into public.early_access_signups(email,name,school_name)
 values(normalized_email,nullif(trim(p_name),''),nullif(trim(p_school_name),''))
 on conflict(email) do update set
   name=coalesce(excluded.name,early_access_signups.name),
   school_name=coalesce(excluded.school_name,early_access_signups.school_name),
   status=case when early_access_signups.status='unsubscribed' then 'subscribed' else early_access_signups.status end,
   consented_at=case when early_access_signups.status='unsubscribed' then now() else early_access_signups.consented_at end,
   updated_at=now();
end $$;
revoke all on function public.record_early_access_signup(text,text,text) from public,anon,authenticated;
grant execute on function public.record_early_access_signup(text,text,text) to service_role;
