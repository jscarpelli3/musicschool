-- Explicitly prove that calendar months bill their actual materialized count,
-- never an assumed four lessons. Every row rolls back after the assertions.

do $$
declare
  sample record;
  month_start date;
  lesson_count integer;
  occurrence integer;
  period_id uuid;
  price_cents bigint;
  actual_count integer;
  actual_amount bigint;
begin
  begin
    select event.school_id, event.product_id, event.teacher_id, event.student_id,
      event.place_id, event.created_by, mapping.billing_account_id,
      member.profile_id as owner_id, product.price_cents
    into strict sample
    from public.lesson_events event
    join public.billing_account_students mapping
      on mapping.school_id = event.school_id and mapping.student_id = event.student_id
    join public.school_members member
      on member.school_id = event.school_id and member.role = 'owner' and member.status = 'active'
    join public.service_products product
      on product.school_id = event.school_id and product.id = event.product_id
    where product.pricing_model = 'per_session'
    limit 1;
    perform set_config('request.jwt.claim.sub', sample.owner_id::text, true);
    price_cents := sample.price_cents;

    for month_start, lesson_count in
      select * from (values
        ('2095-01-01'::date, 3),
        ('2095-02-01'::date, 4),
        ('2095-03-01'::date, 5)
      ) as months(month_start, lesson_count)
    loop
      for occurrence in 1..lesson_count loop
        insert into public.lesson_events (
          school_id, product_id, teacher_id, student_id, place_id,
          starts_at, ends_at, status, notes, created_by
        ) values (
          sample.school_id, sample.product_id, sample.teacher_id, sample.student_id,
          sample.place_id,
          ((month_start + occurrence * 2) + time '18:00') at time zone 'UTC',
          ((month_start + occurrence * 2) + time '18:30') at time zone 'UTC',
          'scheduled', '__variable month verification', sample.created_by
        );
      end loop;

      period_id := public.prepare_family_billing_draft(
        sample.school_id, sample.billing_account_id, month_start
      );
      select count(*), coalesce(sum(amount_cents), 0)
      into actual_count, actual_amount
      from public.billing_line_items
      where billing_period_id = period_id and source_type = 'lesson';
      if actual_count <> lesson_count or actual_amount <> lesson_count * price_cents then
        raise exception 'Variable month failed: expected % lessons/% cents, got %/%',
          lesson_count, lesson_count * price_cents, actual_count, actual_amount;
      end if;
    end loop;

    raise exception using errcode = 'P0001', message = 'variable_lesson_months_verification_rollback';
  exception when raise_exception then
    if sqlerrm <> 'variable_lesson_months_verification_rollback' then raise; end if;
  end;
end;
$$;
