-- Rehearse locking, post-lock immutability, and refresh rejection. All synthetic
-- records roll back inside this migration.

do $$
declare
  sample record;
  event_id uuid;
  period_id uuid;
  line_id uuid;
  blocked_mutation boolean := false;
  blocked_refresh boolean := false;
begin
  begin
    select event.school_id, event.product_id, event.teacher_id, event.student_id,
      event.place_id, event.created_by, mapping.billing_account_id,
      member.profile_id as owner_id
    into strict sample
    from public.lesson_events event
    join public.billing_account_students mapping
      on mapping.school_id = event.school_id and mapping.student_id = event.student_id
    join public.school_members member
      on member.school_id = event.school_id and member.role = 'owner' and member.status = 'active'
    limit 1;
    perform set_config('request.jwt.claim.sub', sample.owner_id::text, true);

    insert into public.lesson_events (
      school_id, product_id, teacher_id, student_id, place_id,
      starts_at, ends_at, status, notes, created_by
    ) values (
      sample.school_id, sample.product_id, sample.teacher_id, sample.student_id,
      sample.place_id, '2096-03-11 18:00:00+00', '2096-03-11 18:30:00+00',
      'scheduled', '__billing lock verification', sample.created_by
    ) returning id into event_id;

    period_id := public.prepare_family_billing_draft(
      sample.school_id, sample.billing_account_id, '2096-03-01'
    );
    select id into strict line_id from public.billing_line_items
    where billing_period_id = period_id and source_id = event_id;

    perform public.lock_family_billing_period(sample.school_id, period_id);
    if not exists (select 1 from public.billing_periods where id = period_id and status = 'locked' and locked_at is not null) then
      raise exception 'Billing period did not lock';
    end if;

    begin
      update public.billing_line_items set unit_amount_cents = unit_amount_cents + 1 where id = line_id;
    exception when raise_exception then blocked_mutation := true;
    end;
    if not blocked_mutation then raise exception 'Locked billing line remained mutable'; end if;

    begin
      perform public.prepare_family_billing_draft(
        sample.school_id, sample.billing_account_id, '2096-03-01'
      );
    exception when raise_exception then
      if sqlerrm = 'billing_period_is_not_refreshable' then blocked_refresh := true; else raise; end if;
    end;
    if not blocked_refresh then raise exception 'Locked billing period remained refreshable'; end if;

    raise exception using errcode = 'P0001', message = 'family_billing_lock_verification_rollback';
  exception when raise_exception then
    if sqlerrm <> 'family_billing_lock_verification_rollback' then raise; end if;
  end;
end;
$$;
