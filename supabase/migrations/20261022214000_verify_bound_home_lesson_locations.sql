do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'lesson_events'
      and column_name = 'service_location_id'
  ) then raise exception 'lesson service location binding is missing'; end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.lesson_places'::regclass
      and conname = 'lesson_places_student_home_details_private'
  ) then raise exception 'student-home shared-detail privacy constraint is missing'; end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.lesson_events'::regclass
      and tgname = 'lesson_events_require_student_home_location'
      and not tgisinternal
  ) then raise exception 'bound home lesson enforcement trigger is missing'; end if;

  if exists (
    select 1 from public.lesson_events event
    join public.lesson_places place
      on place.school_id = event.school_id and place.id = event.place_id
    where place.kind = 'student_home'
      and event.created_at >= now()
      and event.service_location_id is null
  ) then raise exception 'new home lessons must bind a protected location'; end if;
end
$$;
