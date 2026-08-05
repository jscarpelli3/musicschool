-- Recurring intent, per-occurrence exceptions, and what actually happened.

create table public.lesson_series (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  product_id uuid not null,
  teacher_id uuid not null,
  student_id uuid not null,
  default_place_id uuid not null,
  recurrence_rule jsonb not null,
  starts_on date not null,
  ends_on date,
  status text not null default 'active' check (status in ('draft', 'active', 'paused', 'ended', 'cancelled')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, id),
  foreign key (school_id, product_id) references public.service_products(school_id, id) on delete restrict,
  foreign key (school_id, teacher_id) references public.teachers(school_id, person_id) on delete restrict,
  foreign key (school_id, student_id) references public.students(school_id, person_id) on delete restrict,
  foreign key (school_id, default_place_id) references public.lesson_places(school_id, id) on delete restrict,
  check (ends_on is null or ends_on >= starts_on)
);

create trigger lesson_series_set_updated_at before update on public.lesson_series
for each row execute function public.set_updated_at();

alter table public.lesson_series enable row level security;
create policy lesson_series_member_select on public.lesson_series for select to authenticated using (public.is_school_member(school_id));
create policy lesson_series_admin_manage on public.lesson_series for all to authenticated using (public.has_school_role(school_id, array['owner','admin'])) with check (public.has_school_role(school_id, array['owner','admin']));
grant select, insert, update, delete on public.lesson_series to authenticated;

alter table public.lesson_events
  add column lesson_series_id uuid,
  add column is_series_exception boolean not null default false,
  add column exception_reason text,
  add column actual_starts_at timestamptz,
  add column actual_ends_at timestamptz,
  add column actual_place_id uuid,
  add column outcome text check (outcome is null or outcome in ('completed', 'student_cancelled', 'teacher_cancelled', 'no_show', 'partial')),
  add column staff_notes text,
  add foreign key (school_id, lesson_series_id) references public.lesson_series(school_id, id) on delete restrict,
  add foreign key (school_id, actual_place_id) references public.lesson_places(school_id, id) on delete restrict,
  add check (actual_ends_at is null or (actual_starts_at is not null and actual_ends_at > actual_starts_at));

revoke update on public.lesson_events from authenticated;
grant update (product_id, teacher_id, student_id, starts_at, ends_at, status, notes, place_id, lesson_series_id, is_series_exception, exception_reason, actual_starts_at, actual_ends_at, actual_place_id, outcome, staff_notes) on public.lesson_events to authenticated;
