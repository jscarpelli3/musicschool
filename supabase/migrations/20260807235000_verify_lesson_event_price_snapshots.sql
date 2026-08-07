-- Rehearse atomic occurrence snapshot capture and immutability. Temporary rows
-- are intentionally rolled back inside the block.

do $$
declare
  sample public.lesson_events%rowtype;
  event_id uuid;
  snapshot_id uuid;
  blocked boolean := false;
begin
  begin
    select * into strict sample from public.lesson_events limit 1;

    insert into public.lesson_events (
      school_id, product_id, teacher_id, student_id, starts_at, ends_at,
      status, notes, place_id, created_by
    ) values (
      sample.school_id, sample.product_id, sample.teacher_id, sample.student_id,
      '2098-01-15 18:00:00+00', '2098-01-15 18:30:00+00',
      'scheduled', '__price snapshot verification', sample.place_id,
      sample.created_by
    ) returning id into event_id;

    select id into snapshot_id
    from public.lesson_event_price_snapshots
    where lesson_event_id = event_id;

    if snapshot_id is null then
      raise exception 'Lesson event committed without an automatic price snapshot';
    end if;

    begin
      update public.lesson_event_price_snapshots
      set amount_cents = amount_cents + 1
      where id = snapshot_id;
    exception when raise_exception then
      blocked := true;
    end;
    if not blocked then
      raise exception 'Lesson event price snapshot remained mutable';
    end if;

    raise exception using
      errcode = 'P0001',
      message = 'lesson_event_price_snapshot_verification_rollback';
  exception when raise_exception then
    if sqlerrm <> 'lesson_event_price_snapshot_verification_rollback' then
      raise;
    end if;
  end;
end;
$$;
