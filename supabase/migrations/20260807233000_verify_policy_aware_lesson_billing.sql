-- Rehearse policy-driven outcomes and published-rule immutability. The outer
-- subtransaction intentionally rolls back every synthetic policy and event edit.

do $$
declare
  sample record;
  policy_id uuid;
  version_id uuid;
  result jsonb;
  blocked boolean;
begin
  begin
    select event.id as event_id, event.school_id, event.product_id, school.created_by
    into strict sample
    from public.lesson_events event
    join public.schools school on school.id = event.school_id
    where event.status = 'cancelled'
      and event.outcome = 'student_cancelled'
    limit 1;

    insert into public.school_policies (
      school_id, kind, name, is_default, status, created_by
    ) values (
      sample.school_id, 'cancellation',
      '__billing resolver verification ' || gen_random_uuid()::text,
      false, 'active', sample.created_by
    ) returning id into policy_id;

    insert into public.school_policy_versions (
      school_id, policy_id, version_number, effective_from, published_at, created_by
    ) values (
      sample.school_id, policy_id, 1, '2000-01-01', now(), sample.created_by
    ) returning id into version_id;

    insert into public.cancellation_policy_rules (
      policy_version_id, timely_cancel_disposition, late_cancel_disposition,
      no_show_disposition, teacher_cancel_disposition
    ) values (version_id, 'waive', 'charge', 'manual_review', 'credit');

    insert into public.service_product_policy_selections (
      school_id, product_id, policy_kind, use_school_default, policy_id
    ) values (
      sample.school_id, sample.product_id, 'cancellation', false, policy_id
    )
    on conflict (product_id, policy_kind) do update set
      use_school_default = false,
      policy_id = excluded.policy_id;

    update public.lesson_events
    set status = 'cancelled', outcome = 'student_cancelled', cancellation_timing = 'timely'
    where id = sample.event_id;
    result := public.compute_lesson_event_billing_disposition(sample.school_id, sample.event_id);
    if result ->> 'disposition' <> 'waive' or result ->> 'policy_version_id' <> version_id::text then
      raise exception 'Timely cancellation did not resolve to the published policy waiver';
    end if;

    update public.lesson_events set cancellation_timing = 'late' where id = sample.event_id;
    result := public.compute_lesson_event_billing_disposition(sample.school_id, sample.event_id);
    if result ->> 'disposition' <> 'charge' then
      raise exception 'Late cancellation did not resolve to charge';
    end if;

    update public.lesson_events
    set status = 'no_show', outcome = 'no_show', cancellation_timing = null
    where id = sample.event_id;
    result := public.compute_lesson_event_billing_disposition(sample.school_id, sample.event_id);
    if result ->> 'disposition' <> 'owner_review' or result ->> 'policy_disposition' <> 'manual_review' then
      raise exception 'Manual-review no-show policy was not preserved';
    end if;

    update public.lesson_events
    set status = 'cancelled', outcome = 'teacher_cancelled', cancellation_timing = 'timely'
    where id = sample.event_id;
    result := public.compute_lesson_event_billing_disposition(sample.school_id, sample.event_id);
    if result ->> 'disposition' <> 'credit' then
      raise exception 'Teacher cancellation did not resolve to credit';
    end if;

    blocked := false;
    begin
      update public.cancellation_policy_rules
      set late_cancel_disposition = 'waive'
      where policy_version_id = version_id;
    exception when raise_exception then
      blocked := true;
    end;
    if not blocked then
      raise exception 'Published cancellation rules remained mutable';
    end if;

    raise exception using
      errcode = 'P0001',
      message = 'policy_aware_lesson_billing_verification_rollback';
  exception when raise_exception then
    if sqlerrm <> 'policy_aware_lesson_billing_verification_rollback' then
      raise;
    end if;
  end;
end;
$$;
