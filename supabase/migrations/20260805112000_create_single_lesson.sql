-- Transactional creation for a one-time private lesson.

create or replace function public.create_single_lesson(
  p_school_id uuid,
  p_product_id uuid,
  p_teacher_id uuid,
  p_student_id uuid,
  p_place_id uuid,
  p_local_start timestamp without time zone,
  p_notes text default null,
  p_allow_outside_availability boolean default false,
  p_override_reason text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  school_timezone text;
  product_duration integer;
  product_format text;
  starts_at_utc timestamptz;
  ends_at_utc timestamptz;
  local_day date := p_local_start::date;
  local_start_time time := p_local_start::time;
  local_end_time time;
  local_weekday integer := extract(dow from p_local_start)::integer;
  event_id uuid;
begin
  if actor_id is null or not public.has_school_role(p_school_id, array['owner','admin']) then
    raise exception 'not_authorized';
  end if;
  if p_allow_outside_availability and nullif(trim(p_override_reason), '') is null then
    raise exception 'override_reason_required';
  end if;

  select timezone into school_timezone from public.schools where id = p_school_id;
  select duration_minutes, format into product_duration, product_format
  from public.service_products
  where school_id = p_school_id and id = p_product_id and status = 'active';
  if school_timezone is null or product_duration is null then raise exception 'invalid_school_or_offering'; end if;
  if product_format <> 'private_lesson' then raise exception 'group_class_requires_roster'; end if;
  if not exists (select 1 from public.teachers where school_id = p_school_id and person_id = p_teacher_id) then raise exception 'invalid_teacher'; end if;
  if not exists (select 1 from public.students where school_id = p_school_id and person_id = p_student_id and enrollment_status in ('active','prospect')) then raise exception 'invalid_student'; end if;
  if not exists (select 1 from public.lesson_places where school_id = p_school_id and id = p_place_id and status = 'active') then raise exception 'invalid_place'; end if;

  starts_at_utc := p_local_start at time zone school_timezone;
  ends_at_utc := (p_local_start + make_interval(mins => product_duration)) at time zone school_timezone;
  local_end_time := (p_local_start + make_interval(mins => product_duration))::time;
  if starts_at_utc <= now() - interval '1 day' then raise exception 'lesson_too_far_in_past'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_school_id::text, 0));

  if not p_allow_outside_availability and not exists (
    select 1 from public.teacher_availability_rules rule
    where rule.school_id = p_school_id
      and rule.teacher_id = p_teacher_id
      and rule.weekday = local_weekday
      and rule.effective_from <= local_day
      and (rule.effective_until is null or rule.effective_until >= local_day)
      and rule.start_time <= local_start_time
      and rule.end_time >= local_end_time
  ) then raise exception 'outside_teacher_availability'; end if;

  if exists (
    select 1 from public.lesson_events event
    where event.school_id = p_school_id and event.teacher_id = p_teacher_id
      and event.status not in ('cancelled','rescheduled')
      and tstzrange(event.starts_at, event.ends_at, '[)') && tstzrange(starts_at_utc, ends_at_utc, '[)')
  ) then raise exception 'teacher_conflict'; end if;
  if exists (
    select 1 from public.lesson_events event
    where event.school_id = p_school_id and event.student_id = p_student_id
      and event.status not in ('cancelled','rescheduled')
      and tstzrange(event.starts_at, event.ends_at, '[)') && tstzrange(starts_at_utc, ends_at_utc, '[)')
  ) then raise exception 'student_conflict'; end if;

  insert into public.lesson_events (
    school_id, product_id, teacher_id, student_id, place_id,
    starts_at, ends_at, status, notes, is_series_exception, exception_reason, created_by
  ) values (
    p_school_id, p_product_id, p_teacher_id, p_student_id, p_place_id,
    starts_at_utc, ends_at_utc, 'scheduled', nullif(trim(p_notes), ''), true,
    case when p_allow_outside_availability then 'Outside availability: ' || trim(p_override_reason) else 'One-time lesson' end,
    actor_id
  ) returning id into event_id;

  insert into public.audit_log (school_id, actor_profile_id, action, entity_type, entity_id, metadata)
  values (p_school_id, actor_id, 'lesson.created', 'lesson_event', event_id,
    jsonb_build_object('one_time', true, 'outside_availability_override', p_allow_outside_availability));
  return event_id;
end;
$$;

revoke all on function public.create_single_lesson(uuid,uuid,uuid,uuid,uuid,timestamp without time zone,text,boolean,text) from public, anon;
grant execute on function public.create_single_lesson(uuid,uuid,uuid,uuid,uuid,timestamp without time zone,text,boolean,text) to authenticated;
