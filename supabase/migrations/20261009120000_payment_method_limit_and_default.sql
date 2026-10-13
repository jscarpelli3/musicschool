-- Families may retain up to three active payment methods. The first method is
-- default automatically; later methods require an explicit audited choice.

create or replace function public.set_default_billing_payment_method(p_payment_method_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.billing_payment_methods%rowtype;
begin
  if auth.role() <> 'service_role' then raise exception 'not_authorized'; end if;
  select * into target from public.billing_payment_methods
  where id = p_payment_method_id for update;
  if not found or target.status <> 'active' then raise exception 'active_payment_method_required'; end if;

  update public.billing_payment_methods set is_default = false
  where provider_customer_id = target.provider_customer_id and status = 'active' and is_default;
  update public.billing_payment_methods set is_default = true where id = target.id;
end;
$$;

revoke all on function public.set_default_billing_payment_method(uuid) from public, anon, authenticated;
grant execute on function public.set_default_billing_payment_method(uuid) to service_role;

create or replace function public.complete_payment_method_setup(
  p_setup_request_id uuid,
  p_provider_checkout_session_id text,
  p_provider_setup_intent_id text,
  p_provider_payment_method_id text,
  p_method_type text,
  p_display_label text,
  p_brand text,
  p_last_four text,
  p_exp_month smallint,
  p_exp_year smallint,
  p_accepted_at timestamptz,
  p_evidence jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_request public.payment_method_setup_requests%rowtype;
  target_method_id uuid;
  active_method_count integer;
  make_default boolean;
begin
  select * into target_request from public.payment_method_setup_requests
  where id = p_setup_request_id for update;
  if not found then raise exception 'Payment method setup request not found'; end if;
  if target_request.provider_checkout_session_id <> p_provider_checkout_session_id then raise exception 'Checkout session does not match setup request'; end if;
  if target_request.status = 'completed' then
    select id into target_method_id from public.billing_payment_methods
    where provider_customer_id = target_request.provider_customer_id and provider_payment_method_id = p_provider_payment_method_id;
    if target_method_id is null then raise exception 'Completed setup request has no payment method'; end if;
    return target_method_id;
  end if;
  if target_request.status <> 'pending' then raise exception 'Payment method setup request is not pending'; end if;
  if target_request.expires_at < p_accepted_at then raise exception 'Payment method setup request expired'; end if;

  perform pg_advisory_xact_lock(hashtextextended('payment-method-limit:' || target_request.provider_customer_id::text, 0));
  select count(*) into active_method_count from public.billing_payment_methods
  where provider_customer_id = target_request.provider_customer_id and status = 'active';
  if active_method_count >= 3 and not exists (
    select 1 from public.billing_payment_methods
    where provider_customer_id = target_request.provider_customer_id and provider_payment_method_id = p_provider_payment_method_id
  ) then raise exception 'active_payment_method_limit_reached'; end if;
  make_default := active_method_count = 0;

  insert into public.billing_payment_methods (
    school_id, billing_account_id, provider_customer_id, provider_payment_method_id,
    method_type, display_label, brand, last_four, exp_month, exp_year, is_default, status
  ) values (
    target_request.school_id, target_request.billing_account_id, target_request.provider_customer_id, p_provider_payment_method_id,
    p_method_type, p_display_label, p_brand, p_last_four, p_exp_month, p_exp_year, make_default, 'active'
  ) on conflict (provider_customer_id, provider_payment_method_id) do update set
    method_type = excluded.method_type, display_label = excluded.display_label,
    brand = excluded.brand, last_four = excluded.last_four,
    exp_month = excluded.exp_month, exp_year = excluded.exp_year, status = 'active'
  returning id into target_method_id;

  insert into public.payment_method_consents (
    school_id, billing_account_id, payment_method_id, usage_scope, terms_version,
    terms_sha256, channel, provider_setup_intent_id, evidence, accepted_at
  ) values (
    target_request.school_id, target_request.billing_account_id, target_method_id, 'off_session', target_request.terms_version,
    target_request.terms_sha256, 'stripe_hosted', p_provider_setup_intent_id, coalesce(p_evidence, '{}'::jsonb), p_accepted_at
  ) on conflict (payment_method_id, provider_setup_intent_id) do nothing;

  update public.payment_method_setup_requests set status = 'completed', completed_at = p_accepted_at
  where id = target_request.id;
  return target_method_id;
end;
$$;

revoke all on function public.complete_payment_method_setup(uuid,text,text,text,text,text,text,text,smallint,smallint,timestamptz,jsonb) from public, anon, authenticated;
grant execute on function public.complete_payment_method_setup(uuid,text,text,text,text,text,text,text,smallint,smallint,timestamptz,jsonb) to service_role;

comment on function public.set_default_billing_payment_method(uuid) is
  'Atomically selects the active default card without changing any existing card-specific collection mandate.';
