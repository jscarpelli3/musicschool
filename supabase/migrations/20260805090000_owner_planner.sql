-- Teacher availability and scheduled lesson occurrences for the owner planner.

alter table public.service_products
  add constraint service_products_school_id_id_unique unique (school_id, id);

create table public.teacher_availability_rules (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  teacher_id uuid not null,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  effective_from date not null default current_date,
  effective_until date,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (school_id, teacher_id)
    references public.teachers(school_id, person_id) on delete cascade,
  check (start_time < end_time),
  check (effective_until is null or effective_until >= effective_from)
);

create index teacher_availability_rules_lookup_idx
  on public.teacher_availability_rules(school_id, teacher_id, weekday, effective_from);

create trigger teacher_availability_rules_set_updated_at
before update on public.teacher_availability_rules
for each row execute function public.set_updated_at();

create table public.lesson_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  product_id uuid not null,
  teacher_id uuid not null,
  student_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'completed', 'cancelled', 'no_show')),
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (school_id, product_id)
    references public.service_products(school_id, id) on delete restrict,
  foreign key (school_id, teacher_id)
    references public.teachers(school_id, person_id) on delete restrict,
  foreign key (school_id, student_id)
    references public.students(school_id, person_id) on delete restrict,
  check (starts_at < ends_at)
);

create index lesson_events_school_time_idx
  on public.lesson_events(school_id, starts_at, ends_at);
create index lesson_events_teacher_time_idx
  on public.lesson_events(school_id, teacher_id, starts_at);
create index lesson_events_student_time_idx
  on public.lesson_events(school_id, student_id, starts_at);

create trigger lesson_events_set_updated_at
before update on public.lesson_events
for each row execute function public.set_updated_at();

alter table public.teacher_availability_rules enable row level security;
alter table public.lesson_events enable row level security;

create policy teacher_availability_select_member
on public.teacher_availability_rules for select to authenticated
using (public.is_school_member(school_id));

create policy teacher_availability_insert_admin
on public.teacher_availability_rules for insert to authenticated
with check (
  created_by = (select auth.uid())
  and public.has_school_role(school_id, array['owner', 'admin'])
);

create policy teacher_availability_update_admin
on public.teacher_availability_rules for update to authenticated
using (public.has_school_role(school_id, array['owner', 'admin']))
with check (public.has_school_role(school_id, array['owner', 'admin']));

create policy teacher_availability_delete_admin
on public.teacher_availability_rules for delete to authenticated
using (public.has_school_role(school_id, array['owner', 'admin']));

create policy lesson_events_select_member
on public.lesson_events for select to authenticated
using (public.is_school_member(school_id));

create policy lesson_events_insert_admin
on public.lesson_events for insert to authenticated
with check (
  created_by = (select auth.uid())
  and public.has_school_role(school_id, array['owner', 'admin'])
);

create policy lesson_events_update_admin
on public.lesson_events for update to authenticated
using (public.has_school_role(school_id, array['owner', 'admin']))
with check (public.has_school_role(school_id, array['owner', 'admin']));

create policy lesson_events_delete_admin
on public.lesson_events for delete to authenticated
using (public.has_school_role(school_id, array['owner', 'admin']));

grant select, insert, update, delete on public.teacher_availability_rules to authenticated;
grant select, insert, update, delete on public.lesson_events to authenticated;

-- Add a small working catalog and recurring demo schedule to the sole school.
do $$
declare
  target_school_id uuid;
  owner_profile_id uuid;
  school_timezone text;
  school_currency text;
  school_count integer;
begin
  select count(*) into school_count from public.schools;
  if school_count <> 1 then
    raise exception 'Planner demo requires exactly one school; found %', school_count;
  end if;

  select id, created_by, timezone, currency
  into target_school_id, owner_profile_id, school_timezone, school_currency
  from public.schools;

  insert into public.service_products (
    school_id, name, description, format, duration_minutes,
    sessions_per_interval, interval_count, interval_unit,
    pricing_model, price_cents, currency, capacity, created_by
  ) values
    (target_school_id, 'Weekly 30-minute lesson', 'Individual weekly instruction.', 'private_lesson', 30, 1, 1, 'week', 'fixed_monthly', 16000, school_currency, 1, owner_profile_id),
    (target_school_id, 'Weekly 45-minute lesson', 'Extended individual weekly instruction.', 'private_lesson', 45, 1, 1, 'week', 'fixed_monthly', 22000, school_currency, 1, owner_profile_id),
    (target_school_id, 'Weekly 60-minute lesson', 'Individual weekly instruction for advanced students.', 'private_lesson', 60, 1, 1, 'week', 'fixed_monthly', 28000, school_currency, 1, owner_profile_id);

  insert into public.teacher_availability_rules (
    school_id, teacher_id, weekday, start_time, end_time, effective_from, created_by
  )
  select target_school_id, teacher.id, schedule.weekday, schedule.start_time, schedule.end_time,
    date_trunc('month', current_date)::date, owner_profile_id
  from (values
    ('demo-owner', 1, time '14:00', time '19:00'),
    ('demo-owner', 2, time '14:00', time '19:00'),
    ('demo-owner', 3, time '14:00', time '18:00'),
    ('demo-teacher-lena', 2, time '15:00', time '20:00'),
    ('demo-teacher-lena', 4, time '15:00', time '20:00'),
    ('demo-teacher-lena', 6, time '09:00', time '13:00'),
    ('demo-teacher-evan', 1, time '15:00', time '19:00'),
    ('demo-teacher-evan', 3, time '15:00', time '19:00'),
    ('demo-teacher-evan', 5, time '15:00', time '19:00')
  ) as schedule(teacher_ref, weekday, start_time, end_time)
  join public.people teacher
    on teacher.school_id = target_school_id and teacher.external_ref = schedule.teacher_ref;

  insert into public.lesson_events (
    school_id, product_id, teacher_id, student_id,
    starts_at, ends_at, status, created_by
  )
  select
    target_school_id,
    product.id,
    teacher.id,
    student.id,
    ((date_trunc('week', current_date)::date + schedule.day_offset + (week_number * 7)) + schedule.start_time)
      at time zone school_timezone,
    ((date_trunc('week', current_date)::date + schedule.day_offset + (week_number * 7)) + schedule.start_time
      + make_interval(mins => product.duration_minutes)) at time zone school_timezone,
    'scheduled',
    owner_profile_id
  from generate_series(-1, 5) as weeks(week_number)
  cross join (values
    ('demo-student-maya', 'demo-owner', 'Weekly 30-minute lesson', 0, time '15:00'),
    ('demo-student-noah', 'demo-owner', 'Weekly 45-minute lesson', 0, time '16:00'),
    ('demo-student-ava', 'demo-owner', 'Weekly 60-minute lesson', 1, time '14:30'),
    ('demo-student-julian', 'demo-owner', 'Weekly 45-minute lesson', 1, time '16:00'),
    ('demo-student-leo', 'demo-teacher-lena', 'Weekly 30-minute lesson', 1, time '15:00'),
    ('demo-student-sophie', 'demo-teacher-lena', 'Weekly 45-minute lesson', 1, time '16:00'),
    ('demo-student-amelia', 'demo-teacher-lena', 'Weekly 60-minute lesson', 3, time '15:00'),
    ('demo-student-grace', 'demo-teacher-lena', 'Weekly 30-minute lesson', 3, time '16:30'),
    ('demo-student-oliver', 'demo-teacher-evan', 'Weekly 30-minute lesson', 2, time '15:00'),
    ('demo-student-lucas', 'demo-teacher-evan', 'Weekly 45-minute lesson', 2, time '16:00'),
    ('demo-student-harper', 'demo-teacher-evan', 'Weekly 30-minute lesson', 4, time '15:00'),
    ('demo-student-ethan', 'demo-teacher-evan', 'Weekly 45-minute lesson', 4, time '16:00')
  ) as schedule(student_ref, teacher_ref, product_name, day_offset, start_time)
  join public.people teacher
    on teacher.school_id = target_school_id and teacher.external_ref = schedule.teacher_ref
  join public.people student
    on student.school_id = target_school_id and student.external_ref = schedule.student_ref
  join public.service_products product
    on product.school_id = target_school_id and product.name = schedule.product_name;

  insert into public.audit_log (
    school_id, actor_profile_id, action, entity_type, metadata
  ) values (
    target_school_id,
    owner_profile_id,
    'demo_planner.created',
    'school',
    jsonb_build_object('availability_rules', 9, 'weekly_lessons', 12, 'weeks', 7)
  );
end;
$$;
