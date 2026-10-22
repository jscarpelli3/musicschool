alter table public.lesson_places
  add column kind text not null default 'school'
  check (kind in ('school', 'student_home', 'online', 'other'));

update public.lesson_places set kind = 'student_home'
where lower(trim(name)) in ('student home', 'student''s home', 'in home', 'in-home');

create table public.family_service_locations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  billing_account_id uuid not null,
  mode text not null default 'stored' check (mode in ('stored', 'arranged_privately')),
  label text not null default 'Home' check (length(trim(label)) between 1 and 80),
  address_line_1 text,
  address_line_2 text,
  city text,
  region text,
  postal_code text,
  access_notes text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, id),
  foreign key (school_id, billing_account_id)
    references public.billing_accounts(school_id, id) on delete cascade,
  check (
    (mode = 'stored' and length(trim(address_line_1)) between 1 and 160
      and length(trim(city)) between 1 and 120
      and length(trim(region)) between 1 and 120
      and length(trim(postal_code)) between 1 and 24)
    or
    (mode = 'arranged_privately' and address_line_1 is null and address_line_2 is null
      and city is null and region is null and postal_code is null and access_notes is null)
  ),
  check (address_line_2 is null or length(trim(address_line_2)) between 1 and 160),
  check (access_notes is null or length(trim(access_notes)) between 1 and 500)
);

create unique index family_service_locations_one_active_per_account
  on public.family_service_locations(school_id, billing_account_id)
  where status = 'active';

create trigger family_service_locations_set_updated_at
before update on public.family_service_locations
for each row execute function public.set_updated_at();

alter table public.family_service_locations enable row level security;

create policy family_service_locations_manage
on public.family_service_locations for all to authenticated
using (public.has_school_capability(school_id, 'school.billing.manage'))
with check (public.has_school_capability(school_id, 'school.billing.manage'));

grant select, insert, update, delete on public.family_service_locations to authenticated;

create or replace function public.enforce_student_home_location()
returns trigger language plpgsql security definer set search_path = '' as $$
declare place_kind text;
begin
  select place.kind into place_kind
  from public.lesson_places place
  where place.school_id = new.school_id and place.id = new.place_id and place.status = 'active';

  if place_kind = 'student_home' and not exists (
    select 1
    from public.billing_account_students link
    join public.family_service_locations location
      on location.school_id = link.school_id
     and location.billing_account_id = link.billing_account_id
     and location.status = 'active'
    where link.school_id = new.school_id and link.student_id = new.student_id
  ) then
    raise exception 'student_home_location_required';
  end if;
  return new;
end
$$;

create trigger lesson_events_require_student_home_location
before insert or update of school_id, student_id, place_id on public.lesson_events
for each row execute function public.enforce_student_home_location();

create table public.service_location_access_log (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  service_location_id uuid not null,
  lesson_event_id uuid not null,
  actor_profile_id uuid not null references public.profiles(id),
  purpose text not null default 'assigned_lesson' check (purpose in ('assigned_lesson', 'management_review')),
  accessed_at timestamptz not null default now(),
  foreign key (school_id, service_location_id)
    references public.family_service_locations(school_id, id) on delete restrict,
  foreign key (school_id, lesson_event_id)
    references public.lesson_events(school_id, id) on delete restrict
);

create index service_location_access_log_school_time
  on public.service_location_access_log(school_id, accessed_at desc);

alter table public.service_location_access_log enable row level security;
create policy service_location_access_log_management_read
on public.service_location_access_log for select to authenticated
using (public.has_school_capability(school_id, 'school.billing.manage'));
grant select on public.service_location_access_log to authenticated;

comment on table public.family_service_locations is
  'Protected operational home-service details. Never use lesson_places.details or lesson notes for a family address.';
comment on column public.family_service_locations.mode is
  'stored keeps the minimum service address; arranged_privately records that the school deliberately keeps it outside Common Time.';
