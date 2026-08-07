-- Rehearse draft creation, refresh, manual-line preservation, and blocker
-- rollback. The outer subtransaction removes every synthetic business row.

do $$
declare
  sample record;
  future_event_id uuid;
  past_event_id uuid;
  period_id uuid;
  refreshed_period_id uuid;
  snapshot_amount bigint;
  calculated_amount bigint;
  generated_count integer;
  manual_count integer;
  blocked boolean := false;
begin
  begin
    select
      event.school_id,
      event.product_id,
      event.teacher_id,
      event.student_id,
      event.place_id,
      event.created_by,
      mapping.billing_account_id,
      member.profile_id as owner_id
    into strict sample
    from public.lesson_events event
    join public.billing_account_students mapping
      on mapping.school_id = event.school_id and mapping.student_id = event.student_id
    join public.school_members member
      on member.school_id = event.school_id
     and member.role = 'owner'
     and member.status = 'active'
    limit 1;

    perform set_config('request.jwt.claim.sub', sample.owner_id::text, true);

    insert into public.lesson_events (
      school_id, product_id, teacher_id, student_id, place_id,
      starts_at, ends_at, status, notes, created_by
    ) values (
      sample.school_id, sample.product_id, sample.teacher_id, sample.student_id,
      sample.place_id, '2097-02-11 18:00:00+00', '2097-02-11 18:30:00+00',
      'scheduled', '__billing draft success verification', sample.created_by
    ) returning id into future_event_id;

    select amount_cents into strict snapshot_amount
    from public.lesson_event_price_snapshots
    where lesson_event_id = future_event_id;

    period_id := public.prepare_family_billing_draft(
      sample.school_id, sample.billing_account_id, '2097-02-01'
    );

    select count(*), coalesce(sum(amount_cents), 0)
    into generated_count, calculated_amount
    from public.billing_line_items
    where billing_period_id = period_id and source_type = 'lesson';
    if generated_count <> 1 or calculated_amount <> snapshot_amount then
      raise exception 'Expected one generated future lesson charge';
    end if;

    insert into public.billing_line_items (
      school_id, billing_period_id, source_type, description,
      unit_amount_cents, created_by
    ) values (
      sample.school_id, period_id, 'manual_adjustment',
      '__verification manual adjustment', 100, sample.owner_id
    );
    update public.billing_periods set status = 'review' where id = period_id;

    refreshed_period_id := public.prepare_family_billing_draft(
      sample.school_id, sample.billing_account_id, '2097-02-01'
    );
    if refreshed_period_id <> period_id then
      raise exception 'Draft refresh created a duplicate billing period';
    end if;

    select count(*) into manual_count
    from public.billing_line_items
    where billing_period_id = period_id and source_type = 'manual_adjustment';
    select amount_due_cents into calculated_amount
    from public.billing_periods where id = period_id and status = 'draft';
    if manual_count <> 1 or calculated_amount <> snapshot_amount + 100 then
      raise exception 'Draft refresh did not preserve its manual adjustment';
    end if;

    insert into public.lesson_events (
      school_id, product_id, teacher_id, student_id, place_id,
      starts_at, ends_at, status, notes, created_by
    ) values (
      sample.school_id, sample.product_id, sample.teacher_id, sample.student_id,
      sample.place_id, '2000-02-11 18:00:00+00', '2000-02-11 18:30:00+00',
      'scheduled', '__billing draft blocker verification', sample.created_by
    ) returning id into past_event_id;

    begin
      perform public.prepare_family_billing_draft(
        sample.school_id, sample.billing_account_id, '2000-02-01'
      );
    exception when raise_exception then
      if sqlerrm like 'lesson_requires_owner_review:%' then blocked := true; else raise; end if;
    end;
    if not blocked then raise exception 'Past unresolved lesson did not block its draft'; end if;
    if exists (
      select 1 from public.billing_periods
      where billing_account_id = sample.billing_account_id
        and period_start = '2000-02-01'
        and period_end = '2000-02-29'
    ) then raise exception 'Blocked draft left a partial billing period'; end if;

    raise exception using
      errcode = 'P0001',
      message = 'family_billing_draft_verification_rollback';
  exception when raise_exception then
    if sqlerrm <> 'family_billing_draft_verification_rollback' then raise; end if;
  end;
end;
$$;
