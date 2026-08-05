-- Durable, tenant-scoped payment ledger. No raw payment credentials belong here.

create table public.school_payment_connections (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  provider text not null default 'stripe' check (provider in ('stripe')),
  livemode boolean not null default false,
  provider_account_id text,
  status text not null default 'not_started'
    check (status in ('not_started', 'onboarding', 'restricted', 'enabled', 'disconnected')),
  details_submitted boolean not null default false,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  disabled_reason text,
  currently_due jsonb not null default '[]'::jsonb check (jsonb_typeof(currently_due) = 'array'),
  eventually_due jsonb not null default '[]'::jsonb check (jsonb_typeof(eventually_due) = 'array'),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, id),
  unique (school_id, provider, livemode),
  unique (provider, provider_account_id)
);

create trigger school_payment_connections_set_updated_at
before update on public.school_payment_connections
for each row execute function public.set_updated_at();

create table public.billing_provider_customers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  billing_account_id uuid not null,
  payment_connection_id uuid not null,
  provider_customer_id text not null,
  email text,
  status text not null default 'active' check (status in ('active', 'archived')),
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, id),
  unique (school_id, id, billing_account_id),
  unique (school_id, id, payment_connection_id),
  unique (payment_connection_id, billing_account_id),
  unique (payment_connection_id, provider_customer_id),
  foreign key (school_id, billing_account_id)
    references public.billing_accounts(school_id, id) on delete restrict,
  foreign key (school_id, payment_connection_id)
    references public.school_payment_connections(school_id, id) on delete restrict
);

create trigger billing_provider_customers_set_updated_at
before update on public.billing_provider_customers
for each row execute function public.set_updated_at();

create table public.billing_payment_methods (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  billing_account_id uuid not null,
  provider_customer_id uuid not null,
  provider_payment_method_id text not null,
  method_type text not null check (method_type in ('card', 'us_bank_account', 'other')),
  display_label text not null,
  brand text,
  last_four text check (last_four is null or last_four ~ '^[0-9]{4}$'),
  exp_month smallint check (exp_month is null or exp_month between 1 and 12),
  exp_year smallint check (exp_year is null or exp_year between 2020 and 2200),
  is_default boolean not null default false,
  status text not null default 'active' check (status in ('active', 'expired', 'detached')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, id),
  unique (school_id, id, billing_account_id),
  unique (provider_customer_id, provider_payment_method_id),
  foreign key (school_id, billing_account_id)
    references public.billing_accounts(school_id, id) on delete restrict,
  foreign key (school_id, provider_customer_id, billing_account_id)
    references public.billing_provider_customers(school_id, id, billing_account_id) on delete restrict
);

create unique index billing_payment_methods_one_default_idx
  on public.billing_payment_methods(provider_customer_id)
  where is_default and status = 'active';

create trigger billing_payment_methods_set_updated_at
before update on public.billing_payment_methods
for each row execute function public.set_updated_at();

create table public.payment_method_consents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  billing_account_id uuid not null,
  payment_method_id uuid not null,
  usage_scope text not null check (usage_scope in ('on_session', 'off_session')),
  terms_version text not null,
  terms_sha256 text not null check (terms_sha256 ~ '^[0-9a-f]{64}$'),
  channel text not null check (channel in ('stripe_hosted', 'in_app', 'imported')),
  provider_setup_intent_id text,
  evidence jsonb not null default '{}'::jsonb,
  accepted_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (school_id, id),
  unique (payment_method_id, provider_setup_intent_id),
  foreign key (school_id, billing_account_id)
    references public.billing_accounts(school_id, id) on delete restrict,
  foreign key (school_id, payment_method_id, billing_account_id)
    references public.billing_payment_methods(school_id, id, billing_account_id) on delete restrict,
  check (revoked_at is null or revoked_at >= accepted_at)
);

create table public.billing_periods (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  billing_account_id uuid not null,
  period_start date not null,
  period_end date not null,
  label text not null check (length(trim(label)) between 1 and 120),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'draft' check (status in (
    'draft', 'review', 'locked', 'approval_pending', 'approved',
    'collecting', 'paid', 'payment_failed', 'void'
  )),
  amount_due_cents bigint not null default 0,
  locked_at timestamptz,
  approved_at timestamptz,
  paid_at timestamptz,
  voided_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, id),
  unique (school_id, billing_account_id, id),
  unique (billing_account_id, period_start, period_end),
  foreign key (school_id, billing_account_id)
    references public.billing_accounts(school_id, id) on delete restrict,
  check (period_end >= period_start),
  check (amount_due_cents >= 0)
);

create index billing_periods_school_status_idx
  on public.billing_periods(school_id, status, period_start desc);

create trigger billing_periods_set_updated_at
before update on public.billing_periods
for each row execute function public.set_updated_at();

create table public.billing_line_items (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  billing_period_id uuid not null,
  source_type text not null check (source_type in (
    'lesson', 'class', 'fee', 'credit', 'discount', 'manual_adjustment'
  )),
  source_id uuid,
  description text not null check (length(trim(description)) between 1 and 500),
  service_date date,
  quantity integer not null default 1 check (quantity between 1 and 10000),
  unit_amount_cents bigint not null,
  amount_cents bigint generated always as (quantity::bigint * unit_amount_cents) stored,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, id),
  foreign key (school_id, billing_period_id)
    references public.billing_periods(school_id, id) on delete cascade
);

create unique index billing_line_items_source_unique_idx
  on public.billing_line_items(billing_period_id, source_type, source_id)
  where source_id is not null;

create index billing_line_items_period_idx
  on public.billing_line_items(billing_period_id, service_date, created_at);

create trigger billing_line_items_set_updated_at
before update on public.billing_line_items
for each row execute function public.set_updated_at();

alter table public.billing_approval_requests
  add column billing_period_id uuid,
  add constraint billing_approval_requests_period_fkey
    foreign key (school_id, billing_account_id, billing_period_id)
    references public.billing_periods(school_id, billing_account_id, id) on delete restrict;

create table public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  billing_account_id uuid not null,
  billing_period_id uuid not null,
  payment_connection_id uuid not null,
  provider_customer_id uuid not null,
  payment_method_id uuid,
  approval_request_id uuid,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'created' check (status in (
    'created', 'submitted', 'processing', 'requires_action',
    'succeeded', 'failed', 'cancelled'
  )),
  idempotency_key uuid not null unique,
  provider_payment_intent_id text,
  provider_charge_id text,
  failure_code text,
  failure_message text,
  receipt_url text,
  submitted_at timestamptz,
  succeeded_at timestamptz,
  failed_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, id),
  unique (payment_connection_id, provider_payment_intent_id),
  foreign key (school_id, billing_account_id, billing_period_id)
    references public.billing_periods(school_id, billing_account_id, id) on delete restrict,
  foreign key (school_id, payment_connection_id)
    references public.school_payment_connections(school_id, id) on delete restrict,
  foreign key (school_id, provider_customer_id, billing_account_id)
    references public.billing_provider_customers(school_id, id, billing_account_id) on delete restrict,
  foreign key (school_id, provider_customer_id, payment_connection_id)
    references public.billing_provider_customers(school_id, id, payment_connection_id) on delete restrict,
  foreign key (school_id, payment_method_id, billing_account_id)
    references public.billing_payment_methods(school_id, id, billing_account_id) on delete restrict,
  foreign key (school_id, approval_request_id)
    references public.billing_approval_requests(school_id, id) on delete restrict
);

create index payment_attempts_period_idx
  on public.payment_attempts(billing_period_id, created_at desc);
create index payment_attempts_school_status_idx
  on public.payment_attempts(school_id, status, created_at desc);

create trigger payment_attempts_set_updated_at
before update on public.payment_attempts
for each row execute function public.set_updated_at();

create table public.payment_refunds (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  payment_attempt_id uuid not null,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'created'
    check (status in ('created', 'submitted', 'succeeded', 'failed', 'cancelled')),
  reason text,
  idempotency_key uuid not null unique,
  provider_refund_id text,
  failure_code text,
  failure_message text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, id),
  unique (payment_attempt_id, provider_refund_id),
  foreign key (school_id, payment_attempt_id)
    references public.payment_attempts(school_id, id) on delete restrict
);

create trigger payment_refunds_set_updated_at
before update on public.payment_refunds
for each row execute function public.set_updated_at();

create table public.payment_disputes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  payment_attempt_id uuid not null,
  provider_dispute_id text not null,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  reason text,
  status text not null,
  evidence_due_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, id),
  unique (payment_attempt_id, provider_dispute_id),
  foreign key (school_id, payment_attempt_id)
    references public.payment_attempts(school_id, id) on delete restrict
);

create trigger payment_disputes_set_updated_at
before update on public.payment_disputes
for each row execute function public.set_updated_at();

create table public.payment_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('stripe')),
  provider_event_id text not null unique,
  livemode boolean not null,
  provider_account_id text,
  event_type text not null,
  provider_object_id text,
  api_version text,
  payload jsonb not null,
  processing_status text not null default 'received'
    check (processing_status in ('received', 'processing', 'processed', 'failed', 'ignored')),
  processing_attempts integer not null default 0 check (processing_attempts >= 0),
  last_error text,
  provider_created_at timestamptz,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index payment_provider_events_processing_idx
  on public.payment_provider_events(processing_status, received_at);
create index payment_provider_events_object_idx
  on public.payment_provider_events(provider_account_id, provider_object_id);

create table public.payment_state_history (
  id bigint generated always as identity primary key,
  school_id uuid not null references public.schools(id) on delete restrict,
  entity_type text not null check (entity_type in (
    'connection', 'billing_period', 'approval', 'payment_attempt', 'refund', 'dispute'
  )),
  entity_id uuid not null,
  from_status text,
  to_status text not null,
  source text not null check (source in ('user', 'system', 'stripe_webhook', 'reconciliation')),
  provider_event_id text,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index payment_state_history_entity_idx
  on public.payment_state_history(entity_type, entity_id, created_at);

create or replace function public.record_payment_state_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_status text := case when tg_op = 'INSERT' then null else old.status end;
  state_source text := nullif(current_setting('app.payment_state_source', true), '');
  state_event_id text := nullif(current_setting('app.provider_event_id', true), '');
begin
  if tg_op = 'UPDATE' and old.status = new.status then return new; end if;
  if state_source is null then
    state_source := case when (select auth.uid()) is null then 'system' else 'user' end;
  end if;
  insert into public.payment_state_history (
    school_id, entity_type, entity_id, from_status, to_status,
    source, provider_event_id, actor_profile_id
  ) values (
    new.school_id, tg_argv[0], new.id, previous_status, new.status,
    state_source, state_event_id, (select auth.uid())
  );
  return new;
end;
$$;

revoke all on function public.record_payment_state_change() from public;

create trigger school_payment_connections_history
after insert or update on public.school_payment_connections
for each row execute function public.record_payment_state_change('connection');
create trigger billing_periods_history
after insert or update on public.billing_periods
for each row execute function public.record_payment_state_change('billing_period');
create trigger payment_attempts_history
after insert or update on public.payment_attempts
for each row execute function public.record_payment_state_change('payment_attempt');
create trigger payment_refunds_history
after insert or update on public.payment_refunds
for each row execute function public.record_payment_state_change('refund');
create trigger payment_disputes_history
after insert or update on public.payment_disputes
for each row execute function public.record_payment_state_change('dispute');

-- Line-item amounts remain editable only while the period is a draft/review.
create or replace function public.guard_billing_line_item_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_period_id uuid := coalesce(new.billing_period_id, old.billing_period_id);
  target_status text;
begin
  select status into target_status
  from public.billing_periods
  where id = target_period_id
  for update;

  if target_status not in ('draft', 'review') then
    raise exception 'Billing line items are immutable after a period is locked';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger billing_line_items_guard
before insert or update or delete on public.billing_line_items
for each row execute function public.guard_billing_line_item_mutation();

create or replace function public.recalculate_billing_period_amount()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_period_id uuid := coalesce(new.billing_period_id, old.billing_period_id);
begin
  update public.billing_periods period
  set amount_due_cents = coalesce((
    select sum(item.amount_cents)
    from public.billing_line_items item
    where item.billing_period_id = target_period_id
  ), 0)
  where period.id = target_period_id;
  return coalesce(new, old);
end;
$$;

create trigger billing_line_items_recalculate
after insert or update or delete on public.billing_line_items
for each row execute function public.recalculate_billing_period_amount();

create or replace function public.guard_billing_period_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  line_count integer;
begin
  if old.status <> new.status then
    if (select auth.uid()) is not null and new.status in ('approved', 'collecting', 'paid', 'payment_failed') then
      raise exception 'This billing status is controlled by the approval or payment workflow';
    end if;
    if not (
      (old.status = 'draft' and new.status in ('review', 'void'))
      or (old.status = 'review' and new.status in ('draft', 'locked', 'void'))
      or (old.status = 'locked' and new.status in ('review', 'approval_pending', 'void'))
      or (old.status = 'approval_pending' and new.status in ('approved', 'void'))
      or (old.status = 'approved' and new.status in ('collecting', 'void'))
      or (old.status = 'collecting' and new.status in ('paid', 'payment_failed'))
      or (old.status = 'payment_failed' and new.status in ('collecting', 'void'))
    ) then
      raise exception 'Invalid billing period transition: % -> %', old.status, new.status;
    end if;

    if new.status = 'locked' then
      select count(*) into line_count from public.billing_line_items where billing_period_id = new.id;
      if line_count = 0 or new.amount_due_cents <= 0 then
        raise exception 'A billing period needs positive line items before locking';
      end if;
      new.locked_at := now();
    elsif new.status = 'approved' then
      if not exists (
        select 1 from public.billing_approval_requests approval
        where approval.billing_period_id = new.id
          and approval.approval_status = 'approved'
          and approval.amount_cents = new.amount_due_cents
      ) then
        raise exception 'An approved matching request is required';
      end if;
      new.approved_at := now();
    elsif new.status = 'paid' then
      new.paid_at := now();
    elsif new.status = 'void' then
      new.voided_at := now();
    end if;
  end if;

  if old.status not in ('draft', 'review') and (
    new.amount_due_cents <> old.amount_due_cents
    or new.period_start <> old.period_start
    or new.period_end <> old.period_end
    or new.currency <> old.currency
    or new.billing_account_id <> old.billing_account_id
  ) then
    raise exception 'Locked billing period amounts and scope are immutable';
  end if;
  return new;
end;
$$;

create trigger billing_periods_guard_transition
before update on public.billing_periods
for each row execute function public.guard_billing_period_transition();

create or replace function public.guard_billing_period_amount()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  calculated_amount bigint;
begin
  if new.amount_due_cents is distinct from old.amount_due_cents then
    select coalesce(sum(item.amount_cents), 0) into calculated_amount
    from public.billing_line_items item
    where item.billing_period_id = new.id;
    if new.amount_due_cents <> calculated_amount then
      raise exception 'Billing period amount must equal its line items';
    end if;
  end if;
  return new;
end;
$$;

create trigger billing_periods_guard_amount
before update of amount_due_cents on public.billing_periods
for each row execute function public.guard_billing_period_amount();

create or replace function public.validate_billing_approval_period()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_period public.billing_periods%rowtype;
begin
  if new.billing_period_id is null then return new; end if;
  select * into target_period from public.billing_periods where id = new.billing_period_id;
  if target_period.status not in ('locked', 'approval_pending', 'approved') then
    raise exception 'Approval requests require a locked billing period';
  end if;
  if new.amount_cents <> target_period.amount_due_cents
    or upper(new.currency) <> target_period.currency then
    raise exception 'Approval amount must match the locked billing period';
  end if;
  return new;
end;
$$;

create trigger billing_approval_requests_validate_period
before insert or update of billing_period_id, amount_cents, currency
on public.billing_approval_requests
for each row execute function public.validate_billing_approval_period();

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
    if target_method.status <> 'active' then
      raise exception 'Payment method is not active';
    end if;
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

create trigger payment_attempts_validate
before insert or update on public.payment_attempts
for each row execute function public.validate_payment_attempt();

create or replace function public.validate_payment_refund()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_attempt public.payment_attempts%rowtype;
  reserved_amount bigint;
begin
  if tg_op = 'UPDATE' and (
    new.school_id <> old.school_id
    or new.payment_attempt_id <> old.payment_attempt_id
    or new.amount_cents <> old.amount_cents
    or new.currency <> old.currency
    or new.idempotency_key <> old.idempotency_key
  ) then
    raise exception 'Refund scope and amount are immutable';
  end if;

  select * into target_attempt from public.payment_attempts where id = new.payment_attempt_id for update;
  if target_attempt.status <> 'succeeded' or target_attempt.currency <> new.currency then
    raise exception 'Refunds require a succeeded payment in the same currency';
  end if;
  select coalesce(sum(refund.amount_cents), 0) into reserved_amount
  from public.payment_refunds refund
  where refund.payment_attempt_id = new.payment_attempt_id
    and refund.id <> new.id
    and refund.status in ('created', 'submitted', 'succeeded');
  if reserved_amount + new.amount_cents > target_attempt.amount_cents then
    raise exception 'Refund total cannot exceed the payment amount';
  end if;
  return new;
end;
$$;

create trigger payment_refunds_validate
before insert or update on public.payment_refunds
for each row execute function public.validate_payment_refund();

create or replace function public.guard_provider_event_payload()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.provider <> old.provider
    or new.provider_event_id <> old.provider_event_id
    or new.livemode <> old.livemode
    or new.provider_account_id is distinct from old.provider_account_id
    or new.event_type <> old.event_type
    or new.provider_object_id is distinct from old.provider_object_id
    or new.api_version is distinct from old.api_version
    or new.payload <> old.payload
    or new.provider_created_at is distinct from old.provider_created_at
    or new.received_at <> old.received_at then
    raise exception 'Provider event identity and payload are immutable';
  end if;
  return new;
end;
$$;

create trigger payment_provider_events_guard_payload
before update on public.payment_provider_events
for each row execute function public.guard_provider_event_payload();

alter table public.school_payment_connections enable row level security;
alter table public.billing_provider_customers enable row level security;
alter table public.billing_payment_methods enable row level security;
alter table public.payment_method_consents enable row level security;
alter table public.billing_periods enable row level security;
alter table public.billing_line_items enable row level security;
alter table public.payment_attempts enable row level security;
alter table public.payment_refunds enable row level security;
alter table public.payment_disputes enable row level security;
alter table public.payment_provider_events enable row level security;
alter table public.payment_state_history enable row level security;

create policy payment_connections_admin_select on public.school_payment_connections for select to authenticated using (public.has_school_role(school_id, array['owner','admin']));
create policy provider_customers_admin_select on public.billing_provider_customers for select to authenticated using (public.has_school_role(school_id, array['owner','admin']));
create policy payment_methods_admin_select on public.billing_payment_methods for select to authenticated using (public.has_school_role(school_id, array['owner','admin']));
create policy payment_consents_admin_select on public.payment_method_consents for select to authenticated using (public.has_school_role(school_id, array['owner','admin']));
create policy billing_periods_admin_select on public.billing_periods for select to authenticated using (public.has_school_role(school_id, array['owner','admin']));
create policy billing_periods_admin_insert on public.billing_periods for insert to authenticated with check (created_by = (select auth.uid()) and public.has_school_role(school_id, array['owner','admin']));
create policy billing_periods_admin_update on public.billing_periods for update to authenticated using (public.has_school_role(school_id, array['owner','admin'])) with check (public.has_school_role(school_id, array['owner','admin']));
create policy billing_line_items_admin_select on public.billing_line_items for select to authenticated using (public.has_school_role(school_id, array['owner','admin']));
create policy billing_line_items_admin_insert on public.billing_line_items for insert to authenticated with check (created_by = (select auth.uid()) and public.has_school_role(school_id, array['owner','admin']));
create policy billing_line_items_admin_update on public.billing_line_items for update to authenticated using (public.has_school_role(school_id, array['owner','admin'])) with check (public.has_school_role(school_id, array['owner','admin']));
create policy billing_line_items_admin_delete on public.billing_line_items for delete to authenticated using (public.has_school_role(school_id, array['owner','admin']));
create policy payment_attempts_admin_select on public.payment_attempts for select to authenticated using (public.has_school_role(school_id, array['owner','admin']));
create policy payment_refunds_admin_select on public.payment_refunds for select to authenticated using (public.has_school_role(school_id, array['owner','admin']));
create policy payment_disputes_admin_select on public.payment_disputes for select to authenticated using (public.has_school_role(school_id, array['owner','admin']));
create policy payment_history_admin_select on public.payment_state_history for select to authenticated using (public.has_school_role(school_id, array['owner','admin']));

grant select on public.school_payment_connections, public.billing_provider_customers,
  public.billing_payment_methods, public.payment_method_consents,
  public.payment_attempts, public.payment_refunds, public.payment_disputes,
  public.payment_state_history to authenticated;
grant select, insert, update on public.billing_periods to authenticated;
grant select, insert, update, delete on public.billing_line_items to authenticated;

comment on column public.billing_accounts.stripe_customer_id is
  'Deprecated compatibility field. New customer references belong to billing_provider_customers and are scoped to a school payment connection.';
comment on table public.payment_provider_events is
  'Service-role-only immutable provider payload intake. No authenticated policies or grants by design.';
