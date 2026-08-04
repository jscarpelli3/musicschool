-- Identity and tenant security foundation.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  timezone text not null,
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  family_billing_mode text not null default 'fixed_monthly'
    check (family_billing_mode in ('fixed_monthly', 'monthly_usage')),
  logo_path text,
  primary_color text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index schools_created_by_idx on public.schools(created_by);

create trigger schools_set_updated_at
before update on public.schools
for each row execute function public.set_updated_at();

create table public.school_members (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'teacher', 'staff')),
  status text not null default 'active'
    check (status in ('invited', 'active', 'suspended', 'inactive')),
  invited_by uuid references public.profiles(id),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, profile_id)
);

create index school_members_profile_idx on public.school_members(profile_id);
create index school_members_school_active_idx
  on public.school_members(school_id, profile_id)
  where status = 'active';
create unique index school_members_one_owner_idx
  on public.school_members(school_id)
  where role = 'owner' and status = 'active';

create trigger school_members_set_updated_at
before update on public.school_members
for each row execute function public.set_updated_at();

create table public.audit_log (
  id bigint generated always as identity primary key,
  school_id uuid references public.schools(id) on delete restrict,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_school_created_idx
  on public.audit_log(school_id, created_at desc);
create index audit_log_entity_idx
  on public.audit_log(entity_type, entity_id);

create or replace function public.sync_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'),
    new.phone
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    phone = coalesce(excluded.phone, public.profiles.phone);

  return new;
end;
$$;

create trigger auth_user_profile_inserted
after insert on auth.users
for each row execute function public.sync_auth_user_profile();

create trigger auth_user_profile_updated
after update of email, phone, raw_user_meta_data on auth.users
for each row execute function public.sync_auth_user_profile();

insert into public.profiles (id, email, full_name, avatar_url, phone)
select
  id,
  email,
  coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name'),
  coalesce(raw_user_meta_data ->> 'avatar_url', raw_user_meta_data ->> 'picture'),
  phone
from auth.users
on conflict (id) do nothing;

create or replace function public.is_school_member(target_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.school_members
    where school_id = target_school_id
      and profile_id = (select auth.uid())
      and status = 'active'
  );
$$;

create or replace function public.has_school_role(
  target_school_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.school_members
    where school_id = target_school_id
      and profile_id = (select auth.uid())
      and role = any(allowed_roles)
      and status = 'active'
  );
$$;

create or replace function public.shares_school_with(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.school_members mine
    join public.school_members theirs on theirs.school_id = mine.school_id
    where mine.profile_id = (select auth.uid())
      and mine.status = 'active'
      and theirs.profile_id = target_profile_id
      and theirs.status = 'active'
  );
$$;

alter table public.profiles enable row level security;
alter table public.schools enable row level security;
alter table public.school_members enable row level security;
alter table public.audit_log enable row level security;

create policy profiles_select_related
on public.profiles for select
to authenticated
using (id = (select auth.uid()) or public.shares_school_with(id));

create policy profiles_update_self
on public.profiles for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy schools_select_member
on public.schools for select
to authenticated
using (public.is_school_member(id));

create policy schools_update_management
on public.schools for update
to authenticated
using (public.has_school_role(id, array['owner', 'admin']))
with check (public.has_school_role(id, array['owner', 'admin']));

create policy school_members_select_school
on public.school_members for select
to authenticated
using (public.is_school_member(school_id));

create policy audit_log_select_management
on public.audit_log for select
to authenticated
using (public.has_school_role(school_id, array['owner', 'admin']));

create or replace function public.create_school(
  school_name text,
  school_timezone text default 'America/Chicago'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_profile_id uuid := auth.uid();
  new_school_id uuid;
  base_slug text;
  generated_slug text;
begin
  if current_profile_id is null then
    raise exception 'Authentication required';
  end if;

  if length(trim(school_name)) not between 1 and 120 then
    raise exception 'School name must be between 1 and 120 characters';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_timezone_names where name = school_timezone
  ) then
    raise exception 'Invalid timezone';
  end if;

  insert into public.profiles (id, email)
  select id, email from auth.users where id = current_profile_id
  on conflict (id) do nothing;

  base_slug := trim(both '-' from lower(regexp_replace(trim(school_name), '[^a-zA-Z0-9]+', '-', 'g')));
  if base_slug = '' then
    base_slug := 'school';
  end if;
  generated_slug := base_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  insert into public.schools (name, slug, timezone, created_by)
  values (trim(school_name), generated_slug, school_timezone, current_profile_id)
  returning id into new_school_id;

  insert into public.school_members (
    school_id,
    profile_id,
    role,
    status,
    joined_at
  ) values (
    new_school_id,
    current_profile_id,
    'owner',
    'active',
    now()
  );

  insert into public.audit_log (
    school_id,
    actor_profile_id,
    action,
    entity_type,
    entity_id
  ) values (
    new_school_id,
    current_profile_id,
    'school.created',
    'school',
    new_school_id
  );

  return new_school_id;
end;
$$;

revoke all on public.profiles from anon;
revoke all on public.schools from anon;
revoke all on public.school_members from anon;
revoke all on public.audit_log from anon;

grant select, update on public.profiles to authenticated;
grant select, update on public.schools to authenticated;
grant select on public.school_members to authenticated;
grant select on public.audit_log to authenticated;

revoke all on function public.create_school(text, text) from public;
revoke all on function public.create_school(text, text) from anon;
grant execute on function public.create_school(text, text) to authenticated;
