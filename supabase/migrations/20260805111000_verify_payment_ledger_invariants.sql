-- Transactional invariant rehearsal. The fixture is intentionally rolled back
-- after assertions, while a successful migration records that the checks ran.

do $$
declare
  target_school_id uuid;
  target_profile_id uuid;
  target_billing_account_id uuid;
  target_currency text;
  period_id uuid := gen_random_uuid();
  connection_id uuid := gen_random_uuid();
  customer_id uuid := gen_random_uuid();
  method_id uuid := gen_random_uuid();
  approval_id uuid := gen_random_uuid();
  attempt_id uuid := gen_random_uuid();
  attempt_key uuid := gen_random_uuid();
  calculated bigint;
begin
  begin
    select school.id, school.created_by, school.currency
      into target_school_id, target_profile_id, target_currency
    from public.schools school
    order by school.created_at
    limit 1;

    select account.id into target_billing_account_id
    from public.billing_accounts account
    where account.school_id = target_school_id
    order by account.created_at
    limit 1;

    if target_school_id is null or target_billing_account_id is null then
      raise exception 'Payment ledger invariant check requires one school and billing account';
    end if;

    insert into public.school_payment_connections (
      id, school_id, livemode, provider_account_id, status,
      details_submitted, charges_enabled, payouts_enabled
    ) values (
      connection_id, target_school_id, false,
      'acct_invariant_' || replace(connection_id::text, '-', ''),
      'enabled', true, true, true
    );

    insert into public.billing_provider_customers (
      id, school_id, billing_account_id, payment_connection_id,
      provider_customer_id, email
    ) values (
      customer_id, target_school_id, target_billing_account_id, connection_id,
      'cus_invariant_' || replace(customer_id::text, '-', ''),
      'invariant@example.invalid'
    );

    insert into public.billing_payment_methods (
      id, school_id, billing_account_id, provider_customer_id,
      provider_payment_method_id, method_type, display_label,
      brand, last_four, exp_month, exp_year, is_default
    ) values (
      method_id, target_school_id, target_billing_account_id, customer_id,
      'pm_invariant_' || replace(method_id::text, '-', ''),
      'card', 'Test card ending 4242', 'visa', '4242', 12, 2099, true
    );

    insert into public.payment_method_consents (
      school_id, billing_account_id, payment_method_id, usage_scope,
      terms_version, terms_sha256, channel, provider_setup_intent_id,
      accepted_at
    ) values (
      target_school_id, target_billing_account_id, method_id, 'off_session',
      'invariant-v1', repeat('a', 64), 'stripe_hosted',
      'seti_invariant_' || replace(method_id::text, '-', ''), now()
    );

    insert into public.billing_periods (
      id, school_id, billing_account_id, period_start, period_end,
      label, currency, created_by
    ) values (
      period_id, target_school_id, target_billing_account_id,
      date '2099-01-01', date '2099-01-31',
      'Invariant rehearsal', target_currency, target_profile_id
    );

    insert into public.billing_line_items (
      school_id, billing_period_id, source_type, description,
      service_date, quantity, unit_amount_cents, created_by
    ) values (
      target_school_id, period_id, 'lesson', 'Invariant lesson',
      date '2099-01-02', 1, 10000, target_profile_id
    );

    select amount_due_cents into calculated from public.billing_periods where id = period_id;
    if calculated <> 10000 then
      raise exception 'Line-item total did not recalculate; got %', calculated;
    end if;

    begin
      update public.billing_periods set amount_due_cents = 99999 where id = period_id;
      raise exception '__expected_direct_amount_change_to_fail__';
    exception when others then
      if sqlerrm = '__expected_direct_amount_change_to_fail__' then raise; end if;
    end;

    update public.billing_periods set status = 'review' where id = period_id;
    update public.billing_periods set status = 'locked' where id = period_id;

    begin
      update public.billing_line_items set unit_amount_cents = 1 where billing_period_id = period_id;
      raise exception '__expected_locked_line_change_to_fail__';
    exception when others then
      if sqlerrm = '__expected_locked_line_change_to_fail__' then raise; end if;
    end;

    begin
      update public.billing_periods set status = 'paid' where id = period_id;
      raise exception '__expected_invalid_period_transition_to_fail__';
    exception when others then
      if sqlerrm = '__expected_invalid_period_transition_to_fail__' then raise; end if;
    end;

    insert into public.billing_approval_requests (
      id, school_id, billing_account_id, billing_period_id, token_hash,
      period_label, line_items, amount_cents, currency, expires_at,
      approval_status, approved_at, created_by
    ) values (
      approval_id, target_school_id, target_billing_account_id, period_id,
      encode(extensions.digest(gen_random_uuid()::text, 'sha256'), 'hex'),
      'Invariant rehearsal', '[{"label":"Invariant lesson","amount_cents":10000}]',
      10000, lower(target_currency), now() + interval '1 hour',
      'approved', now(), target_profile_id
    );

    update public.billing_periods set status = 'approval_pending' where id = period_id;
    update public.billing_periods set status = 'approved' where id = period_id;

    insert into public.payment_attempts (
      id, school_id, billing_account_id, billing_period_id,
      payment_connection_id, provider_customer_id, payment_method_id,
      approval_request_id, amount_cents, currency, idempotency_key, created_by
    ) values (
      attempt_id, target_school_id, target_billing_account_id, period_id,
      connection_id, customer_id, method_id, approval_id,
      10000, target_currency, attempt_key, target_profile_id
    );

    begin
      insert into public.payment_attempts (
        school_id, billing_account_id, billing_period_id,
        payment_connection_id, provider_customer_id, payment_method_id,
        approval_request_id, amount_cents, currency, idempotency_key, created_by
      ) values (
        target_school_id, target_billing_account_id, period_id,
        connection_id, customer_id, method_id, approval_id,
        10000, target_currency, attempt_key, target_profile_id
      );
      raise exception '__expected_duplicate_attempt_key_to_fail__';
    exception when others then
      if sqlerrm = '__expected_duplicate_attempt_key_to_fail__' then raise; end if;
    end;

    update public.payment_attempts
      set status = 'submitted', provider_payment_intent_id = 'pi_invariant_' || replace(attempt_id::text, '-', '')
    where id = attempt_id;
    update public.payment_attempts set status = 'succeeded' where id = attempt_id;

    begin
      insert into public.payment_refunds (
        school_id, payment_attempt_id, amount_cents, currency,
        idempotency_key, created_by
      ) values (
        target_school_id, attempt_id, 10001, target_currency,
        gen_random_uuid(), target_profile_id
      );
      raise exception '__expected_over_refund_to_fail__';
    exception when others then
      if sqlerrm = '__expected_over_refund_to_fail__' then raise; end if;
    end;

    raise exception '__rollback_payment_ledger_fixture__';
  exception when others then
    if sqlerrm <> '__rollback_payment_ledger_fixture__' then raise; end if;
  end;
end;
$$;
