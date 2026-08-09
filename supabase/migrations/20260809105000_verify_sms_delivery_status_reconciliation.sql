do $$
declare
  sample record;
  period_id uuid;
  delivery_id uuid;
  message_sid constant text := 'SM' || repeat('a', 32);
  result text;
begin
  begin
    select account.school_id, account.id as billing_account_id, member.profile_id as owner_id
    into strict sample
    from public.billing_accounts account
    join public.school_members member on member.school_id = account.school_id
      and member.role = 'owner' and member.status = 'active'
    limit 1;
    perform set_config('request.jwt.claim.sub', sample.owner_id::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);

    insert into public.billing_periods (
      school_id, billing_account_id, period_start, period_end, label, currency, status, created_by
    ) values (
      sample.school_id, sample.billing_account_id, '2094-10-01', '2094-10-31',
      'SMS callback verification', 'USD', 'review', sample.owner_id
    ) returning id into period_id;
    insert into public.billing_line_items (
      school_id, billing_period_id, source_type, description, service_date,
      quantity, unit_amount_cents, created_by
    ) values (
      sample.school_id, period_id, 'manual_adjustment', 'Callback verification charge',
      '2094-10-10', 1, 5000, sample.owner_id
    );
    perform public.lock_family_billing_period(sample.school_id, period_id);
    select prepared.sms_delivery_id into strict delivery_id
    from public.create_billing_approval_sms_delivery(
      sample.school_id, period_id, repeat('1', 64), '+15555550199', repeat('2', 64),
      'MG' || repeat('3', 32), now() + interval '2 days'
    ) prepared;

    perform set_config('request.jwt.claim.role', 'service_role', true);
    result := public.record_twilio_delivery_status(message_sid, 'delivered', '', repeat('4', 64));
    if result <> 'pending_reconciliation' then raise exception 'Early callback was not retained'; end if;
    result := public.record_twilio_delivery_status(message_sid, 'delivered', '', repeat('4', 64));
    if result <> 'duplicate' then raise exception 'Callback replay was not idempotent'; end if;

    perform public.complete_sms_provider_submission(delivery_id, message_sid, 'accepted', null, null);
    if not exists (
      select 1 from public.sms_deliveries delivery
      where delivery.id = delivery_id and delivery.status = 'delivered'
        and delivery.provider_message_sid = message_sid and delivery.delivered_at is not null
    ) then raise exception 'Early callback did not reconcile after provider response'; end if;
    if exists (
      select 1 from public.sms_delivery_status_events event
      where event.provider_message_sid = message_sid and event.delivery_id is null
    ) then raise exception 'Reconciled callback remained orphaned'; end if;

    result := public.record_twilio_delivery_status(message_sid, 'queued', '', repeat('5', 64));
    if result <> 'recorded' then raise exception 'Out-of-order callback was not logged'; end if;
    if not exists (select 1 from public.sms_deliveries where id = delivery_id and status = 'delivered') then
      raise exception 'Out-of-order callback regressed terminal delivery state';
    end if;

    raise exception using errcode = 'P0001', message = 'sms_delivery_status_verification_rollback';
  exception when raise_exception then
    if sqlerrm <> 'sms_delivery_status_verification_rollback' then raise; end if;
  end;
end;
$$;
