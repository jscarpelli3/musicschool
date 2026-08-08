-- Rehearse non-overridable conflicts and an explicit owner availability
-- override. All rows roll back after the assertions.

do $$
declare
  sample record;
  occupied_day date;
  moving_day date;
  occupied_local timestamp;
  moving_local timestamp;
  outside_local timestamp;
  occupied_id uuid;
  moving_id uuid;
  conflict_blocked boolean := false;
  availability_blocked boolean := false;
begin
  begin
    select event.school_id, event.product_id, event.teacher_id, event.student_id,
      event.place_id, event.created_by, event.ends_at - event.starts_at as duration,
      member.profile_id as owner_id, school.timezone,
      rule.weekday, rule.start_time, rule.end_time
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

    select day::date into strict occupied_day
    from generate_series('2092-07-01'::date, '2092-07-31'::date, interval '1 day') day
    where extract(dow from day)::integer = sample.weekday order by day limit 1;
    moving_day := occupied_day + 7;
    occupied_local := occupied_day + sample.start_time;
    moving_local := moving_day + sample.start_time;
    outside_local := moving_day + sample.end_time + interval '1 hour';
    perform set_config('request.jwt.claim.sub', sample.owner_id::text, true);

    insert into public.lesson_events (
      school_id, product_id, teacher_id, student_id, place_id,
      starts_at, ends_at, status, notes, created_by
    ) values (
      sample.school_id, sample.product_id, sample.teacher_id, sample.student_id,
      sample.place_id, occupied_local at time zone sample.timezone,
      (occupied_local + sample.duration) at time zone sample.timezone,
      'scheduled', '__occupied reschedule verification', sample.created_by
    ) returning id into occupied_id;

    insert into public.lesson_events (
      school_id, product_id, teacher_id, student_id, place_id,
      starts_at, ends_at, status, notes, created_by
    ) values (
      sample.school_id, sample.product_id, sample.teacher_id, sample.student_id,
      sample.place_id, moving_local at time zone sample.timezone,
      (moving_local + sample.duration) at time zone sample.timezone,
      'scheduled', '__moving reschedule verification', sample.created_by
    ) returning id into moving_id;

    begin
      perform public.reschedule_lesson_as_owner(
        sample.school_id, moving_id, sample.teacher_id, sample.place_id,
        occupied_local, 'calendar', 'Conflict verification', true
      );
    exception when raise_exception then
      if sqlerrm = 'teacher_conflict' then conflict_blocked := true; else raise; end if;
    end;
    if not conflict_blocked then raise exception 'Owner override bypassed a hard teacher conflict'; end if;
    if exists (select 1 from public.lesson_event_changes where lesson_event_id = moving_id) then
      raise exception 'Failed conflict attempt wrote change history';
    end if;

    begin
      perform public.reschedule_lesson_as_owner(
        sample.school_id, moving_id, sample.teacher_id, sample.place_id,
        outside_local, 'lesson_detail', 'Availability verification', false
      );
    exception when raise_exception then
      if sqlerrm = 'outside_teacher_availability' then availability_blocked := true; else raise; end if;
    end;
    if not availability_blocked then raise exception 'Outside availability was accepted without override'; end if;

    perform public.reschedule_lesson_as_owner(
      sample.school_id, moving_id, sample.teacher_id, sample.place_id,
      outside_local, 'lesson_detail', 'Owner approved an off-hours exception', true
    );
    if not exists (
      select 1 from public.lesson_event_changes
      where lesson_event_id = moving_id
        and source = 'lesson_detail'
        and policy_result = 'owner_availability_override'
    ) then raise exception 'Owner availability override evidence was not recorded'; end if;

    raise exception using errcode = 'P0001', message = 'reschedule_conflict_override_verification_rollback';
  exception when raise_exception then
    if sqlerrm <> 'reschedule_conflict_override_verification_rollback' then raise; end if;
  end;
end;
$$;

