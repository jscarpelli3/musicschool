alter table public.students
  add column primary_teacher_id uuid;

alter table public.students
  add constraint students_primary_teacher_school_fk
  foreign key (school_id, primary_teacher_id)
  references public.teachers (school_id, person_id);

comment on column public.students.primary_teacher_id is
  'The student''s explicit default teacher for new scheduling; individual lessons may override it.';

update public.students student
set primary_teacher_id = coalesce(
  (
    select series.teacher_id
    from public.lesson_series series
    where series.school_id = student.school_id
      and series.student_id = student.person_id
      and series.status = 'active'
    order by series.starts_on desc, series.created_at desc
    limit 1
  ),
  (
    select event.teacher_id
    from public.lesson_events event
    where event.school_id = student.school_id
      and event.student_id = student.person_id
      and event.status not in ('cancelled', 'rescheduled')
    order by event.starts_at desc, event.created_at desc
    limit 1
  )
);

create index students_primary_teacher_idx
  on public.students (school_id, primary_teacher_id)
  where primary_teacher_id is not null;
