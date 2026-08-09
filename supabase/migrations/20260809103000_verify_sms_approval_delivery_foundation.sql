do $$
declare
  sample record;
  period_id uuid;
  first_request uuid;
  first_delivery uuid;
  second_request uuid;
  second_delivery uuid;
begin
  begin
    select account.school_id, account.id as billing_account_id, member.profile_id as owner_id
    into strict sample
    from public.billing_accounts account
    join public.school_members member on member.school_id = account.school_id
      and member.role = 'owner' and member.status = 'active'
    limit 1;
    perform set_config('request.jwt.claim.sub', sample.owner_id::text, true);

    insert into public.billing_periods (
      school_id, billing_account_id, period_start, period_end, label, currency, status, created_by
    ) values (
      sample.school_id, sample.billing_account_id, '2094-09-01', '2094-09-30',
      'SMS delivery verification', 'USD', 'review', sample.owner_id
    ) returning id into period_id;
    insert into public.billing_line_items (
      school_id, billing_period_id, source_type, description, service_date,
      quantity, unit_amount_cents, created_by
    ) values (
      sample.school_id, period_id, 'manual_adjustment', 'Verification lesson charge',
      '2094-09-10', 1, 4500, sample.owner_id
    );
    perform public.lock_family_billing_period(sample.school_id, period_id);

    select result.approval_request_id, result.sms_delivery_id into strict first_request, first_delivery
    from public.create_billing_approval_sms_delivery(
      sample.school_id, period_id, repeat('a', 64), '+15555550199', repeat('b', 64),
      'MG' || repeat('c', 32), now() + interval '2 days'
    ) result;
    if not exists (select 1 from public.billing_periods where id = period_id and status = 'approval_pending') then
      raise exception 'Prepared SMS did not advance period to approval_pending';
    end if;
    if not exists (
      select 1 from public.sms_deliveries delivery
      where delivery.id = first_delivery and delivery.status = 'pending'
        and delivery.provider_message_sid is null and delivery.body_sha256 = repeat('b', 64)
    ) then raise exception 'Durable pre-provider SMS delivery was not recorded'; end if;

    select result.approval_request_id, result.sms_delivery_id into strict second_request, second_delivery
    from public.create_billing_approval_sms_delivery(
      sample.school_id, period_id, repeat('d', 64), '+15555550199', repeat('e', 64),
      'MG' || repeat('c', 32), now() + interval '2 days'
    ) result;
    if first_request = second_request or first_delivery = second_delivery then raise exception 'Replacement reused prior identities'; end if;
    if not exists (
      select 1 from public.billing_approval_requests request
      where request.id = first_request and request.approval_status = 'cancelled' and request.cancelled_at is not null
    ) then raise exception 'Superseded approval request remained active'; end if;
    if not exists (
      select 1 from public.billing_approval_requests request
      where request.id = second_request and request.approval_status = 'pending'
        and request.request_version = 2 and request.amount_cents = 4500
        and jsonb_array_length(request.line_items) = 1
    ) then raise exception 'Replacement approval snapshot is incomplete'; end if;

    raise exception using errcode = 'P0001', message = 'sms_approval_delivery_verification_rollback';
  exception when raise_exception then
    if sqlerrm <> 'sms_approval_delivery_verification_rollback' then raise; end if;
  end;
end;
$$;
