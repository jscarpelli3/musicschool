-- Structured occurrence locations for school rooms, student homes, and custom places.

alter table public.lesson_events
  add column location_type text not null default 'school'
    check (location_type in ('school', 'student_home', 'custom')),
  add column school_room text,
  add column custom_location text;

update public.lesson_events event
set
  location_type = case teacher.external_ref
    when 'demo-teacher-evan' then 'student_home'
    else 'school'
  end,
  school_room = case teacher.external_ref
    when 'demo-owner' then 'Studio A'
    when 'demo-teacher-lena' then 'Voice Room'
    else null
  end
from public.people teacher
where teacher.id = event.teacher_id
  and teacher.school_id = event.school_id;

alter table public.lesson_events
  add constraint lesson_events_location_details_check check (
    (location_type = 'school' and custom_location is null)
    or (location_type = 'student_home' and school_room is null and custom_location is null)
    or (
      location_type = 'custom'
      and school_room is null
      and length(trim(custom_location)) between 1 and 240
    )
  );

revoke update on public.lesson_events from authenticated;
grant update (
  product_id,
  teacher_id,
  student_id,
  starts_at,
  ends_at,
  status,
  notes,
  location_type,
  school_room,
  custom_location
) on public.lesson_events to authenticated;
