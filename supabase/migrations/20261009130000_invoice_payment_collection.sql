-- Owner-initiated, off-session collection for an exact approved statement.

create unique index payment_attempts_one_open_or_paid_period_idx
  on public.payment_attempts(billing_period_id)
  where status in ('created','submitted','processing','requires_action','succeeded');

grant select, insert, update on public.payment_attempts to service_role;
grant select, update on public.billing_periods to service_role;
grant select on public.school_payment_connections, public.billing_provider_customers,
  public.billing_payment_methods, public.payment_method_consents,
  public.billing_approval_requests to service_role;

create or replace function public.apply_invoice_payment_intent_event(
  p_payment_attempt_id uuid,
  p_provider_account_id text,
  p_payment_intent_id text,
  p_status text,
  p_charge_id text default null,
  p_failure_code text default null,
  p_failure_message text default null,
  p_provider_event_id text default null
) returns void
language plpgsql security definer set search_path=''
as $$
declare
  attempt public.payment_attempts%rowtype;
  connection_account text;
  period_status text;
begin
  if auth.role() <> 'service_role' then raise exception 'service_role_required'; end if;
  if p_status not in ('submitted','processing','requires_action','succeeded','failed') then
    raise exception 'unsupported_payment_intent_status';
  end if;

  select * into attempt from public.payment_attempts where id=p_payment_attempt_id for update;
  if not found then raise exception 'payment_attempt_not_found'; end if;
  select provider_account_id into connection_account
    from public.school_payment_connections where id=attempt.payment_connection_id;
  if connection_account is distinct from p_provider_account_id then raise exception 'connected_account_mismatch'; end if;
  if attempt.provider_payment_intent_id is not null
    and attempt.provider_payment_intent_id is distinct from p_payment_intent_id then
    raise exception 'payment_intent_mismatch';
  end if;
  if attempt.status='succeeded' then
    if p_status<>'succeeded' then raise exception 'succeeded_payment_is_terminal'; end if;
    return;
  end if;

  perform set_config('app.payment_state_source',case when p_provider_event_id is null then 'system' else 'stripe_webhook' end,true);
  perform set_config('app.provider_event_id',coalesce(p_provider_event_id,''),true);

  if attempt.status='created' and p_status in ('submitted','processing','requires_action','succeeded') then
    update public.payment_attempts set status='submitted',provider_payment_intent_id=p_payment_intent_id
      where id=attempt.id;
    attempt.status:='submitted';
  elsif attempt.provider_payment_intent_id is null then
    update public.payment_attempts set provider_payment_intent_id=p_payment_intent_id where id=attempt.id;
  end if;

  if attempt.status is distinct from p_status then
    update public.payment_attempts set status=p_status,
      provider_charge_id=coalesce(p_charge_id,provider_charge_id),
      failure_code=case when p_status in ('failed','requires_action') then p_failure_code else null end,
      failure_message=case when p_status in ('failed','requires_action') then left(p_failure_message,1000) else null end
      where id=attempt.id;
  end if;

  select status into period_status from public.billing_periods where id=attempt.billing_period_id for update;
  if period_status in ('approved','payment_failed') then
    update public.billing_periods set status='collecting' where id=attempt.billing_period_id;
    period_status:='collecting';
  end if;
  if p_status='succeeded' and period_status='collecting' then
    update public.billing_periods set status='paid' where id=attempt.billing_period_id;
  elsif p_status in ('failed','requires_action') and period_status='collecting' then
    update public.billing_periods set status='payment_failed' where id=attempt.billing_period_id;
  end if;
end;
$$;

revoke all on function public.apply_invoice_payment_intent_event(uuid,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.apply_invoice_payment_intent_event(uuid,text,text,text,text,text,text,text) to service_role;

comment on function public.apply_invoice_payment_intent_event(uuid,text,text,text,text,text,text,text) is
  'Atomically applies an authoritative connected-account PaymentIntent state to its reserved invoice attempt and billing period.';
