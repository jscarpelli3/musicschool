-- Prove both timing branches without leaving fixtures behind.
do $$
declare
  sample record; before_event uuid; after_future_event uuid; after_past_event uuid;
  period_id uuid; actual_amount bigint; blocked boolean := false;
begin
  begin
    select event.school_id,event.product_id,event.teacher_id,event.student_id,event.place_id,event.created_by,
      mapping.billing_account_id,member.profile_id owner_id,product.price_cents
    into strict sample
    from public.lesson_events event
    join public.billing_account_students mapping on mapping.school_id=event.school_id and mapping.student_id=event.student_id
    join public.school_members member on member.school_id=event.school_id and member.role='owner' and member.status='active'
    join public.service_products product on product.school_id=event.school_id and product.id=event.product_id and product.pricing_model='per_session'
    limit 1;
    perform set_config('request.jwt.claim.sub',sample.owner_id::text,true);

    update public.service_products set billing_timing_override='before_service' where school_id=sample.school_id and id=sample.product_id;
    insert into public.lesson_events(school_id,product_id,teacher_id,student_id,place_id,starts_at,ends_at,status,created_by)
    values(sample.school_id,sample.product_id,sample.teacher_id,sample.student_id,sample.place_id,'2096-01-10 18:00Z','2096-01-10 18:30Z','scheduled',sample.created_by)
    returning id into before_event;
    period_id:=public.prepare_family_billing_draft(sample.school_id,sample.billing_account_id,'2096-01-01');
    select amount_cents into strict actual_amount from public.billing_line_items where billing_period_id=period_id and source_id=before_event;
    if actual_amount<>sample.price_cents then raise exception 'before_service_future_lesson_not_charged'; end if;

    update public.service_products set billing_timing_override='after_service' where school_id=sample.school_id and id=sample.product_id;
    insert into public.lesson_events(school_id,product_id,teacher_id,student_id,place_id,starts_at,ends_at,status,created_by)
    values(sample.school_id,sample.product_id,sample.teacher_id,sample.student_id,sample.place_id,'2096-02-10 18:00Z','2096-02-10 18:30Z','scheduled',sample.created_by)
    returning id into after_future_event;
    begin
      perform public.prepare_family_billing_draft(sample.school_id,sample.billing_account_id,'2096-02-01');
    exception when others then blocked := sqlerrm like 'after_service_period_is_not_complete%'; end;
    if not blocked then raise exception 'after_service_future_period_was_not_blocked'; end if;

    insert into public.lesson_events(school_id,product_id,teacher_id,student_id,place_id,starts_at,ends_at,status,outcome,created_by)
    values(sample.school_id,sample.product_id,sample.teacher_id,sample.student_id,sample.place_id,'2020-01-10 18:00Z','2020-01-10 18:30Z','completed','completed',sample.created_by)
    returning id into after_past_event;
    period_id:=public.prepare_family_billing_draft(sample.school_id,sample.billing_account_id,'2020-01-01');
    select amount_cents into strict actual_amount from public.billing_line_items where billing_period_id=period_id and source_id=after_past_event;
    if actual_amount<>sample.price_cents then raise exception 'after_service_completed_lesson_not_charged'; end if;

    raise exception using errcode='P0001',message='explicit_billing_timing_verification_rollback';
  exception when raise_exception then
    if sqlerrm<>'explicit_billing_timing_verification_rollback' then raise; end if;
  end;
end; $$;
