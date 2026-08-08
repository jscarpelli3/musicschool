-- Rehearse a cross-month move, immutable history, and billing-month retention.
-- Every synthetic record is rolled back inside this migration.

do $$
declare
  sample record;
  original_day date;
  destination_day date;
  original_local timestamp;
  destination_local timestamp;
  event_id uuid;
  original_billing_date date;
  original_period_id uuid;
  destination_period_id uuid;
  original_lines integer;
  destination_lines integer;
  change_id uuid;
  history_blocked boolean := false;
begin
  begin
    select event.school_id, event.product_id, event.teacher_id, event.student_id,
      event.place_id, event.created_by, event.ends_at - event.starts_at as duration,
      mapping.billing_account_id, member.profile_id as owner_id,
      school.timezone, rule.weekday, rule.start_time
    into strict sample
    from public.lesson_events event
    join public.billing_account_students mapping
      on mapping.school_id = event.school_id and mapping.student_id = event.student_id
    join public.school_members member
      on member.school_id = event.school_id and member.role = 'owner' and member.status = 'active'
    join public.schools school on school.id = event.school_id
    join public.teacher_availability_rules rule
      on rule.school_id = event.school_id and rule.teacher_id = event.teacher_id
      and rule.effective_until is null
      and rule.end_time - rule.start_time >= event.ends_at - event.starts_at
    where event.status = 'scheduled'
    limit 1;

    select day::date into strict original_day
    from generate_series('2093-05-01'::date, '2093-05-31'::date, interval '1 day') day
    where extract(dow from day)::integer = sample.weekday order by day desc limit 1;
    select day::date into strict destination_day
    from generate_series('2093-06-01'::date, '2093-06-30'::date, interval '1 day') day
    where extract(dow from day)::integer = sample.weekday order by day limit 1;
    original_local := original_day + sample.start_time;
    destination_local := destination_day + sample.start_time;
    perform set_config('request.jwt.claim.sub', sample.owner_id::text, true);

    insert into public.lesson_events (
      school_id, product_id, teacher_id, student_id, place_id,
      starts_at, ends_at, status, notes, created_by
    ) values (
      sample.school_id, sample.product_id, sample.teacher_id, sample.student_id,
      sample.place_id, original_local at time zone sample.timezone,
      (original_local + sample.duration) at time zone sample.timezone,
      'scheduled', '__reschedule verification', sample.created_by
    ) returning id into event_id;

    select billing_service_date into strict original_billing_date
    from public.lesson_event_price_snapshots where lesson_event_id = event_id;
    if original_billing_date <> original_day then raise exception 'Initial billing date was not captured'; end if;

    perform public.reschedule_lesson_as_owner(
      sample.school_id, event_id, sample.teacher_id, sample.place_id,
      destination_local, 'calendar', 'Cross-month reschedule verification', false
    );

    if not exists (
      select 1 from public.lesson_events
      where id = event_id and status = 'scheduled'
        and starts_at = destination_local at time zone sample.timezone
        and ends_at = (destination_local + sample.duration) at time zone sample.timezone
    ) then raise exception 'Reschedule did not preserve identity, status, and duration'; end if;
    if (select billing_service_date from public.lesson_event_price_snapshots where lesson_event_id = event_id) <> original_day then
      raise exception 'Reschedule moved the immutable billing service date';
    end if;

    select id into strict change_id from public.lesson_event_changes
    where lesson_event_id = event_id and change_type = 'rescheduled';
    begin
      update public.lesson_event_changes set reason = 'mutated' where id = change_id;
    exception when raise_exception then history_blocked := true;
    end;
    if not history_blocked then raise exception 'Reschedule history remained mutable'; end if;

    original_period_id := public.prepare_family_billing_draft(
      sample.school_id, sample.billing_account_id, date_trunc('month', original_day)::date
    );
    destination_period_id := public.prepare_family_billing_draft(
      sample.school_id, sample.billing_account_id, date_trunc('month', destination_day)::date
    );
    select count(*) into original_lines from public.billing_line_items
      where billing_period_id = original_period_id and source_id = event_id;
    select count(*) into destination_lines from public.billing_line_items
      where billing_period_id = destination_period_id and source_id = event_id;
    if original_lines <> 1 or destination_lines <> 0 then
      raise exception 'Cross-month move changed or duplicated the financial month';
    end if;

    raise exception using errcode = 'P0001', message = 'owner_lesson_reschedule_verification_rollback';
  exception when raise_exception then
    if sqlerrm <> 'owner_lesson_reschedule_verification_rollback' then raise; end if;
  end;
end;
$$;

