-- Prove fixed-monthly tuition is charged once per series/month while individual
-- occurrences remain visible without multiplying the monthly amount.

do $$
declare
  sample record;
  series_id uuid;
  term_id uuid;
  period_id uuid;
  occurrence integer;
  base_count integer;
  occurrence_count integer;
  actual_amount bigint;
  tuition_amount constant bigint := 12345;
begin
  begin
    select event.school_id, event.product_id, event.teacher_id, event.student_id,
      event.place_id, event.created_by, mapping.billing_account_id,
      member.profile_id as owner_id, product.name, product.currency
    into strict sample
    from public.lesson_events event
    join public.billing_account_students mapping
      on mapping.school_id = event.school_id and mapping.student_id = event.student_id
    join public.school_members member
      on member.school_id = event.school_id and member.role = 'owner' and member.status = 'active'
    join public.service_products product
      on product.school_id = event.school_id and product.id = event.product_id
    limit 1;
    perform set_config('request.jwt.claim.sub', sample.owner_id::text, true);

    insert into public.lesson_series (
      school_id, product_id, teacher_id, student_id, default_place_id,
      recurrence_rule, starts_on, status, created_by
    ) values (
      sample.school_id, sample.product_id, sample.teacher_id, sample.student_id,
      sample.place_id, '{"frequency":"weekly"}'::jsonb, '2094-04-01', 'active',
      sample.created_by
    ) returning id into series_id;

    insert into public.lesson_series_billing_terms (
      school_id, lesson_series_id, source_product_id, billing_mode,
      amount_cents, currency, offering_name, effective_from, created_by
    ) values (
      sample.school_id, series_id, sample.product_id, 'fixed_monthly',
      tuition_amount, sample.currency, sample.name, '2094-04-01', sample.created_by
    ) returning id into term_id;

    for occurrence in 1..4 loop
      insert into public.lesson_events (
        school_id, product_id, teacher_id, student_id, place_id,
        starts_at, ends_at, status, notes, lesson_series_id, created_by
      ) values (
        sample.school_id, sample.product_id, sample.teacher_id, sample.student_id,
        sample.place_id,
        (('2094-04-01'::date + occurrence * 5) + time '18:00') at time zone 'UTC',
        (('2094-04-01'::date + occurrence * 5) + time '18:30') at time zone 'UTC',
        'scheduled', '__fixed monthly verification', series_id, sample.created_by
      );
    end loop;

    period_id := public.prepare_family_billing_draft(
      sample.school_id, sample.billing_account_id, '2094-04-01'
    );
    select count(*) into base_count from public.billing_line_items
    where billing_period_id = period_id and source_type = 'lesson_series'
      and billing_terms_id = term_id and amount_cents = tuition_amount;
    select count(*) into occurrence_count from public.billing_line_items
    where billing_period_id = period_id and source_type = 'lesson' and amount_cents = 0;
    select amount_due_cents into actual_amount from public.billing_periods where id = period_id;
    if base_count <> 1 or occurrence_count <> 4 or actual_amount <> tuition_amount then
      raise exception 'Fixed monthly draft multiplied or obscured tuition: base %, occurrences %, amount %',
        base_count, occurrence_count, actual_amount;
    end if;

    raise exception using errcode = 'P0001', message = 'fixed_monthly_draft_verification_rollback';
  exception when raise_exception then
    if sqlerrm <> 'fixed_monthly_draft_verification_rollback' then raise; end if;
  end;
end;
$$;
