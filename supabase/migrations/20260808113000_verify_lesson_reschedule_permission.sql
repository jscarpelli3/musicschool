-- Verify persistence, audit evidence, and the hard scheduling guard. The
-- deliberate terminal exception rolls every test mutation back.
do $$
declare
  sample record;
  blocked boolean := false;
begin
  begin
    select event.id, event.school_id, member.profile_id as owner_id
    into strict sample
    from public.lesson_events event
    join public.school_members member
      on member.school_id = event.school_id and member.role = 'owner' and member.status = 'active'
    where event.status = 'scheduled' and event.starts_at > now()
    limit 1;

    perform set_config('request.jwt.claim.sub', sample.owner_id::text, true);
    perform public.set_lesson_reschedule_permission(
      sample.school_id, sample.id, false, 'Fixed-date master class'
    );

    if not exists (
      select 1 from public.lesson_events
      where id = sample.id and not reschedule_allowed
        and reschedule_blocked_reason = 'Fixed-date master class'
    ) then raise exception 'Reschedule permission did not persist'; end if;
    if not exists (
      select 1 from public.audit_log
      where entity_id = sample.id and action = 'lesson.reschedule_blocked'
    ) then raise exception 'Reschedule permission audit evidence missing'; end if;

    begin
      update public.lesson_events set starts_at = starts_at + interval '1 hour', ends_at = ends_at + interval '1 hour'
      where id = sample.id;
    exception when raise_exception then
      if sqlerrm = 'lesson_reschedule_blocked' then blocked := true; else raise; end if;
    end;
    if not blocked then raise exception 'Blocked lesson accepted a scheduling change'; end if;

    perform public.set_lesson_reschedule_permission(sample.school_id, sample.id, true, null);
    if exists (
      select 1 from public.lesson_events
      where id = sample.id and (not reschedule_allowed or reschedule_blocked_reason is not null)
    ) then raise exception 'Reschedule permission did not restore cleanly'; end if;

    raise exception using errcode = 'P0001', message = 'reschedule_permission_verification_rollback';
  exception when raise_exception then
    if sqlerrm <> 'reschedule_permission_verification_rollback' then raise; end if;
  end;
end;
$$;
