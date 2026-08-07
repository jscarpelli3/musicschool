-- Transactional invariant rehearsal. The synthetic rows are rolled back inside
-- the block, so this migration leaves no business data behind.

do $$
declare
  sample record;
  series_id uuid;
  term_id uuid;
  blocked boolean;
begin
  begin
    select
      event.school_id,
      event.product_id,
      event.teacher_id,
      event.student_id,
      event.place_id,
      school.created_by,
      product.name as offering_name,
      product.price_cents,
      product.currency,
      product.pricing_model
    into strict sample
    from public.lesson_events event
    join public.schools school on school.id = event.school_id
    join public.service_products product
      on product.school_id = event.school_id
     and product.id = event.product_id
    where event.place_id is not null
    limit 1;

    insert into public.lesson_series (
      school_id, product_id, teacher_id, student_id, default_place_id,
      recurrence_rule, starts_on, status, created_by
    ) values (
      sample.school_id, sample.product_id, sample.teacher_id, sample.student_id,
      sample.place_id, '{"frequency":"weekly"}'::jsonb, '2099-01-01', 'draft',
      sample.created_by
    ) returning id into series_id;

    insert into public.lesson_series_billing_terms (
      school_id, lesson_series_id, source_product_id, billing_mode,
      amount_cents, currency, offering_name, effective_from, created_by
    ) values (
      sample.school_id, series_id, sample.product_id, sample.pricing_model,
      sample.price_cents, sample.currency, sample.offering_name, '2099-01-01',
      sample.created_by
    ) returning id into term_id;

    blocked := false;
    begin
      insert into public.lesson_series_billing_terms (
        school_id, lesson_series_id, source_product_id, billing_mode,
        amount_cents, currency, offering_name, effective_from, created_by
      ) values (
        sample.school_id, series_id, sample.product_id, sample.pricing_model,
        sample.price_cents, sample.currency, sample.offering_name, '2099-02-01',
        sample.created_by
      );
    exception when exclusion_violation then
      blocked := true;
    end;
    if not blocked then
      raise exception 'Overlapping lesson-series billing terms were accepted';
    end if;

    blocked := false;
    begin
      update public.lesson_series_billing_terms
      set amount_cents = amount_cents + 1
      where id = term_id;
    exception when raise_exception then
      blocked := true;
    end;
    if not blocked then
      raise exception 'A billing-term amount snapshot was mutable';
    end if;

    update public.lesson_series_billing_terms
    set effective_until = '2099-01-31'
    where id = term_id;

    blocked := false;
    begin
      update public.lesson_series_billing_terms
      set effective_until = '2099-02-28'
      where id = term_id;
    exception when raise_exception then
      blocked := true;
    end;
    if not blocked then
      raise exception 'A closed billing term was closed a second time';
    end if;

    raise exception using
      errcode = 'P0001',
      message = 'lesson_series_billing_terms_verification_rollback';
  exception when raise_exception then
    if sqlerrm <> 'lesson_series_billing_terms_verification_rollback' then
      raise;
    end if;
  end;
end;
$$;
