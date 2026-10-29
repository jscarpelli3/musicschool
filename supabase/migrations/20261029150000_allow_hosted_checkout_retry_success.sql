create or replace function public.validate_payment_attempt()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_period public.billing_periods%rowtype;
  target_connection public.school_payment_connections%rowtype;
  target_method public.billing_payment_methods%rowtype;
  target_approval public.billing_approval_requests%rowtype;
begin
  if tg_op = 'UPDATE' and (
    new.school_id <> old.school_id
    or new.billing_account_id <> old.billing_account_id
    or new.billing_period_id <> old.billing_period_id
    or new.payment_connection_id <> old.payment_connection_id
    or new.provider_customer_id <> old.provider_customer_id
    or new.payment_method_id is distinct from old.payment_method_id
    or new.approval_request_id is distinct from old.approval_request_id
    or new.amount_cents <> old.amount_cents
    or new.currency <> old.currency
    or new.idempotency_key <> old.idempotency_key
  ) then
    raise exception 'Payment attempt scope and amount are immutable';
  end if;

  if tg_op = 'UPDATE' then
    if old.provider_payment_intent_id is not null
      and new.provider_payment_intent_id is distinct from old.provider_payment_intent_id then
      raise exception 'Provider payment intent reference is immutable once set';
    end if;
    if old.status <> new.status and not (
      (old.status = 'created' and new.status in ('submitted', 'failed', 'cancelled'))
      or (old.status = 'submitted' and new.status in ('processing', 'requires_action', 'succeeded', 'failed', 'cancelled'))
      or (old.status = 'processing' and new.status in ('requires_action', 'succeeded', 'failed'))
      or (old.status = 'requires_action' and new.status in ('submitted', 'processing', 'succeeded', 'failed', 'cancelled'))
      or (old.status = 'failed' and new.status in ('submitted', 'processing', 'succeeded')
        and old.payment_method_id is null
        and exists (
          select 1 from public.invoice_checkout_requests checkout_request
          where checkout_request.payment_attempt_id = old.id
            and checkout_request.status = 'open'
        ))
    ) then
      raise exception 'Invalid payment attempt transition: % -> %', old.status, new.status;
    end if;
    if new.status = 'submitted' and old.status <> 'submitted' then new.submitted_at := now(); end if;
    if new.status = 'succeeded' and old.status <> 'succeeded' then new.succeeded_at := now(); end if;
    if new.status = 'failed' and old.status <> 'failed' then new.failed_at := now(); end if;
    return new;
  end if;

  select * into target_period from public.billing_periods where id = new.billing_period_id;
  if target_period.status not in ('approved', 'collecting', 'payment_failed')
    or new.amount_cents <> target_period.amount_due_cents
    or new.currency <> target_period.currency then
    raise exception 'Payment attempt must match an approved billing period';
  end if;

  select * into target_connection from public.school_payment_connections where id = new.payment_connection_id;
  if target_connection.status <> 'enabled' or not target_connection.charges_enabled then
    raise exception 'Payment connection is not enabled for charges';
  end if;

  if new.approval_request_id is not null then
    select * into target_approval from public.billing_approval_requests where id = new.approval_request_id;
    if target_approval.approval_status <> 'approved'
      or target_approval.billing_period_id <> new.billing_period_id
      or target_approval.amount_cents <> new.amount_cents then
      raise exception 'Payment attempt approval does not match the billing period';
    end if;
  end if;

  if new.payment_method_id is not null then
    select * into target_method from public.billing_payment_methods where id = new.payment_method_id;
    if target_method.status <> 'active' then raise exception 'Payment method is not active'; end if;
    if not exists (
      select 1 from public.payment_method_consents consent
      where consent.payment_method_id = new.payment_method_id
        and consent.usage_scope = 'off_session'
        and consent.revoked_at is null
    ) then
      raise exception 'Off-session payment method consent is required';
    end if;
  end if;
  return new;
end;
$$;

comment on function public.validate_payment_attempt() is
  'Keeps payment scope immutable while allowing the same open hosted Checkout PaymentIntent to recover from a declined card.';
