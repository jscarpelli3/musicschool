-- Replace hard-coded lesson location categories with school-owned place vocabulary.

create table public.lesson_places (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  details text check (details is null or length(trim(details)) between 1 and 500),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, id)
);

create unique index lesson_places_school_name_unique
  on public.lesson_places(school_id, lower(name));
create index lesson_places_school_status_idx
  on public.lesson_places(school_id, status, name);

create trigger lesson_places_set_updated_at
before update on public.lesson_places
for each row execute function public.set_updated_at();

alter table public.lesson_places enable row level security;

create policy lesson_places_select_member
on public.lesson_places for select to authenticated
using (public.is_school_member(school_id));

create policy lesson_places_insert_owner_or_teacher
on public.lesson_places for insert to authenticated
with check (
  created_by = (select auth.uid())
  and public.has_school_role(school_id, array['owner', 'admin', 'teacher'])
);

create policy lesson_places_update_owner_or_creator
on public.lesson_places for update to authenticated
using (
  public.has_school_role(school_id, array['owner', 'admin'])
  or (
    created_by = (select auth.uid())
    and public.has_school_role(school_id, array['teacher'])
  )
)
with check (
  public.has_school_role(school_id, array['owner', 'admin'])
  or (
    created_by = (select auth.uid())
    and public.has_school_role(school_id, array['teacher'])
  )
);

create policy lesson_places_delete_management
on public.lesson_places for delete to authenticated
using (public.has_school_role(school_id, array['owner', 'admin']));

grant select, insert, delete on public.lesson_places to authenticated;
grant update (name, details, status) on public.lesson_places to authenticated;

insert into public.lesson_places (school_id, name, created_by)
select
  event.school_id,
  case
    when event.location_type = 'school' then coalesce(nullif(trim(event.school_room), ''), 'At school')
    when event.location_type = 'student_home' then 'Student home'
    else event.custom_location
  end,
  (array_agg(event.created_by order by event.created_at))[1]
from public.lesson_events event
group by
  event.school_id,
  case
    when event.location_type = 'school' then coalesce(nullif(trim(event.school_room), ''), 'At school')
    when event.location_type = 'student_home' then 'Student home'
    else event.custom_location
  end;

alter table public.lesson_events add column place_id uuid;

update public.lesson_events event
set place_id = place.id
from public.lesson_places place
where place.school_id = event.school_id
  and place.name = case
    when event.location_type = 'school' then coalesce(nullif(trim(event.school_room), ''), 'At school')
    when event.location_type = 'student_home' then 'Student home'
    else event.custom_location
  end;

alter table public.lesson_events
  alter column place_id set not null,
  add constraint lesson_events_school_place_fkey
    foreign key (school_id, place_id)
    references public.lesson_places(school_id, id) on delete restrict,
  drop constraint lesson_events_location_details_check,
  drop column location_type,
  drop column school_room,
  drop column custom_location;

revoke update on public.lesson_events from authenticated;
grant update (
  product_id,
  teacher_id,
  student_id,
  starts_at,
  ends_at,
  status,
  notes,
  place_id
) on public.lesson_events to authenticated;
