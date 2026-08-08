-- Rehearse the structured reason path. The nested block deliberately rolls
-- back every test row after the assertions.
do $$
declare
  sample record;
  target_day date;
  target_local timestamp;
  moving_id uuid;
begin
  begin
    select event.school_id, event.product_id, event.teacher_id, event.student_id,
      event.place_id, event.created_by, event.ends_at - event.starts_at as duration,
      member.profile_id as owner_id, school.timezone, rule.weekday, rule.start_time
    into strict sample
    from public.lesson_events event
    join public.school_members member
      on member.school_id = event.school_id and member.role = 'owner' and member.status = 'active'
    join public.schools school on school.id = event.school_id
    join public.teacher_availability_rules rule
      on rule.school_id = event.school_id and rule.teacher_id = event.teacher_id
      and rule.effective_until is null
      and rule.end_time - rule.start_time >= event.ends_at - event.starts_at
    where event.status = 'scheduled'
    limit 1;

    select day::date into strict target_day
    from generate_series('2093-08-01'::date, '2093-08-31'::date, interval '1 day') day
    where extract(dow from day)::integer = sample.weekday order by day limit 1;
    target_local := target_day + sample.start_time;
    perform set_config('request.jwt.claim.sub', sample.owner_id::text, true);

    insert into public.lesson_events (
      school_id, product_id, teacher_id, student_id, place_id,
      starts_at, ends_at, status, notes, created_by
    ) values (
      sample.school_id, sample.product_id, sample.teacher_id, sample.student_id,
      sample.place_id, (target_local - interval '7 days') at time zone sample.timezone,
      (target_local - interval '7 days' + sample.duration) at time zone sample.timezone,
      'scheduled', '__structured reason verification', sample.created_by
    ) returning id into moving_id;

    perform public.reschedule_lesson_as_owner(
      sample.school_id, moving_id, sample.teacher_id, sample.place_id,
      target_local, 'calendar', 'other::Family travel changed unexpectedly', false
    );

    if not exists (
      select 1 from public.lesson_events
      where id = moving_id
        and reschedule_reason_code = 'other'
        and reschedule_reason_detail = 'Family travel changed unexpectedly'
    ) then raise exception 'Structured reason was not stored on the lesson'; end if;
    if not exists (
      select 1 from public.lesson_event_changes
      where lesson_event_id = moving_id
        and reason_code = 'other'
        and reason = 'Family travel changed unexpectedly'
    ) then raise exception 'Structured reason was not stored in immutable history'; end if;

    raise exception using errcode = 'P0001', message = 'structured_reschedule_reason_verification_rollback';
  exception when raise_exception then
    if sqlerrm <> 'structured_reschedule_reason_verification_rollback' then raise; end if;
  end;
end;
$$;
