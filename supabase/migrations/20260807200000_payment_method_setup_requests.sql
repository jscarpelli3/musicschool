create table public.payment_method_setup_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  billing_account_id uuid not null,
  provider_customer_id uuid not null,
  initiated_by uuid not null references public.profiles(id) on delete restrict,
  provider_checkout_session_id text unique,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'expired', 'canceled', 'failed')),
  terms_version text not null,
  terms_text text not null check (length(trim(terms_text)) between 20 and 4000),
  terms_sha256 text not null check (terms_sha256 ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, id),
  foreign key (school_id, billing_account_id)
    references public.billing_accounts(school_id, id) on delete restrict,
  foreign key (school_id, provider_customer_id, billing_account_id)
    references public.billing_provider_customers(school_id, id, billing_account_id) on delete restrict,
  check (completed_at is null or completed_at >= created_at),
  check (expires_at > created_at)
);

create index payment_method_setup_requests_account_idx
  on public.payment_method_setup_requests(school_id, billing_account_id, created_at desc);

create trigger payment_method_setup_requests_set_updated_at
before update on public.payment_method_setup_requests
for each row execute function public.set_updated_at();

alter table public.payment_method_setup_requests enable row level security;

create policy payment_method_setup_requests_admin_select
on public.payment_method_setup_requests for select to authenticated
using (public.has_school_role(school_id, array['owner','admin']));

grant select on public.payment_method_setup_requests to authenticated;

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
begin
  select * into target_request
  from public.payment_method_setup_requests
  where id = p_setup_request_id
  for update;

  if not found then
    raise exception 'Payment method setup request not found';
  end if;
  if target_request.provider_checkout_session_id <> p_provider_checkout_session_id then
    raise exception 'Checkout session does not match setup request';
  end if;
  if target_request.status = 'completed' then
    select id into target_method_id
    from public.billing_payment_methods
    where provider_customer_id = target_request.provider_customer_id
      and provider_payment_method_id = p_provider_payment_method_id;
    if target_method_id is null then
      raise exception 'Completed setup request has no payment method';
    end if;
    return target_method_id;
  end if;
  if target_request.status <> 'pending' then
    raise exception 'Payment method setup request is not pending';
  end if;
  if target_request.expires_at < p_accepted_at then
    raise exception 'Payment method setup request expired';
  end if;

  update public.billing_payment_methods
  set is_default = false
  where provider_customer_id = target_request.provider_customer_id
    and is_default;

  insert into public.billing_payment_methods (
    school_id, billing_account_id, provider_customer_id,
    provider_payment_method_id, method_type, display_label,
    brand, last_four, exp_month, exp_year, is_default, status
  ) values (
    target_request.school_id, target_request.billing_account_id, target_request.provider_customer_id,
    p_provider_payment_method_id, p_method_type, p_display_label,
    p_brand, p_last_four, p_exp_month, p_exp_year, true, 'active'
  )
  on conflict (provider_customer_id, provider_payment_method_id) do update set
    method_type = excluded.method_type,
    display_label = excluded.display_label,
    brand = excluded.brand,
    last_four = excluded.last_four,
    exp_month = excluded.exp_month,
    exp_year = excluded.exp_year,
    is_default = true,
    status = 'active'
  returning id into target_method_id;

  insert into public.payment_method_consents (
    school_id, billing_account_id, payment_method_id, usage_scope,
    terms_version, terms_sha256, channel, provider_setup_intent_id,
    evidence, accepted_at
  ) values (
    target_request.school_id, target_request.billing_account_id, target_method_id, 'off_session',
    target_request.terms_version, target_request.terms_sha256, 'stripe_hosted', p_provider_setup_intent_id,
    coalesce(p_evidence, '{}'::jsonb), p_accepted_at
  ) on conflict (payment_method_id, provider_setup_intent_id) do nothing;

  update public.payment_method_setup_requests
  set status = 'completed', completed_at = p_accepted_at
  where id = target_request.id;

  return target_method_id;
end;
$$;

revoke all on function public.complete_payment_method_setup(uuid, text, text, text, text, text, text, text, smallint, smallint, timestamptz, jsonb) from public;
revoke all on function public.complete_payment_method_setup(uuid, text, text, text, text, text, text, text, smallint, smallint, timestamptz, jsonb) from anon;
revoke all on function public.complete_payment_method_setup(uuid, text, text, text, text, text, text, text, smallint, smallint, timestamptz, jsonb) from authenticated;
grant execute on function public.complete_payment_method_setup(uuid, text, text, text, text, text, text, text, smallint, smallint, timestamptz, jsonb) to service_role;

comment on table public.payment_method_setup_requests is
  'Durable, expiring bindings between a family, Stripe Checkout setup session, and exact authorization terms.';
