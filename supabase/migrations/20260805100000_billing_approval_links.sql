-- Single-use billing approval links. Approval and collection remain separate:
-- this records consent for an exact amount, but never represents a payment.

create extension if not exists pgcrypto with schema extensions;

create table public.billing_approval_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  billing_account_id uuid not null,
  token_hash text not null unique,
  period_label text not null check (length(trim(period_label)) between 1 and 120),
  line_items jsonb not null check (jsonb_typeof(line_items) = 'array'),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  collection_action text not null default 'authorize_only'
    check (collection_action in ('authorize_only', 'authorize_and_charge')),
  approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'expired', 'cancelled')),
  payment_status text not null default 'not_started'
    check (payment_status in ('not_started', 'processing', 'succeeded', 'failed')),
  stripe_payment_intent_id text,
  expires_at timestamptz not null,
  approved_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, id),
  foreign key (school_id, billing_account_id)
    references public.billing_accounts(school_id, id) on delete cascade,
  check (approved_at is null or approval_status = 'approved')
);

create index billing_approval_requests_school_status_idx
  on public.billing_approval_requests(school_id, approval_status, expires_at);

create trigger billing_approval_requests_set_updated_at
before update on public.billing_approval_requests
for each row execute function public.set_updated_at();

create table public.billing_approval_events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  approval_request_id uuid not null,
  event_type text not null check (event_type in (
    'created', 'viewed', 'approved', 'expired', 'cancelled',
    'payment_started', 'payment_succeeded', 'payment_failed'
  )),
  channel text not null default 'approval_link'
    check (channel in ('approval_link', 'sms_reply', 'in_app', 'system')),
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (school_id, approval_request_id)
    references public.billing_approval_requests(school_id, id) on delete cascade
);

create index billing_approval_events_request_idx
  on public.billing_approval_events(approval_request_id, created_at);

alter table public.billing_approval_requests enable row level security;
alter table public.billing_approval_events enable row level security;

create policy billing_approval_requests_select_admin
on public.billing_approval_requests for select to authenticated
using (public.has_school_role(school_id, array['owner', 'admin']));

create policy billing_approval_requests_manage_admin
on public.billing_approval_requests for all to authenticated
using (public.has_school_role(school_id, array['owner', 'admin']))
with check (public.has_school_role(school_id, array['owner', 'admin']));

create policy billing_approval_events_select_admin
on public.billing_approval_events for select to authenticated
using (public.has_school_role(school_id, array['owner', 'admin']));

grant select, insert, update, delete on public.billing_approval_requests to authenticated;
grant select on public.billing_approval_events to authenticated;

create or replace function public.get_billing_approval(raw_token text)
returns table (
  school_name text,
  billing_account_name text,
  period_label text,
  line_items jsonb,
  amount_cents integer,
  currency text,
  approval_status text,
  payment_status text,
  collection_action text,
  expires_at timestamptz,
  approved_at timestamptz
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    school.name,
    account.name,
    request.period_label,
    request.line_items,
    request.amount_cents,
    request.currency,
    case
      when request.approval_status = 'pending' and request.expires_at <= now() then 'expired'
      else request.approval_status
    end,
    request.payment_status,
    request.collection_action,
    request.expires_at,
    request.approved_at
  from public.billing_approval_requests request
  join public.schools school on school.id = request.school_id
  join public.billing_accounts account on account.id = request.billing_account_id
  where request.token_hash = encode(extensions.digest(raw_token, 'sha256'), 'hex')
  limit 1;
$$;

create or replace function public.approve_billing_request(raw_token text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_record public.billing_approval_requests%rowtype;
begin
  select * into request_record
  from public.billing_approval_requests request
  where request.token_hash = encode(extensions.digest(raw_token, 'sha256'), 'hex')
  for update;

  if not found then
    return 'not_found';
  end if;

  if request_record.approval_status = 'approved' then
    return 'already_approved';
  end if;

  if request_record.approval_status <> 'pending' then
    return request_record.approval_status;
  end if;

  if request_record.expires_at <= now() then
    update public.billing_approval_requests
    set approval_status = 'expired'
    where id = request_record.id;

    insert into public.billing_approval_events (
      school_id, approval_request_id, event_type, channel
    ) values (
      request_record.school_id, request_record.id, 'expired', 'system'
    );
    return 'expired';
  end if;

  update public.billing_approval_requests
  set approval_status = 'approved', approved_at = now()
  where id = request_record.id;

  insert into public.billing_approval_events (
    school_id, approval_request_id, event_type, channel, evidence
  ) values (
    request_record.school_id,
    request_record.id,
    'approved',
    'approval_link',
    jsonb_build_object(
      'amount_cents', request_record.amount_cents,
      'currency', request_record.currency,
      'period_label', request_record.period_label
    )
  );

  return 'approved';
end;
$$;

revoke all on function public.get_billing_approval(text) from public;
revoke all on function public.approve_billing_request(text) from public;
grant execute on function public.get_billing_approval(text) to anon, authenticated;
grant execute on function public.approve_billing_request(text) to anon, authenticated;

-- A fake, non-chargeable request gives the first approval screen a stable preview.
do $$
declare
  target_school_id uuid;
  target_account_id uuid;
  owner_profile_id uuid;
  demo_token constant text := '17ecf8ce-f299-49ee-955f-09922eb9bfb0';
begin
  select s.id, s.created_by into target_school_id, owner_profile_id
  from public.schools s
  order by s.created_at
  limit 1;

  select account.id into target_account_id
  from public.billing_accounts account
  where account.school_id = target_school_id
  order by account.created_at
  limit 1;

  if target_school_id is not null and target_account_id is not null then
    insert into public.billing_approval_requests (
      school_id,
      billing_account_id,
      token_hash,
      period_label,
      line_items,
      amount_cents,
      currency,
      expires_at,
      created_by
    ) values (
      target_school_id,
      target_account_id,
      encode(extensions.digest(demo_token, 'sha256'), 'hex'),
      'August 2026 · preview',
      '[{"label":"Maya Chen · weekly piano lessons","detail":"4 lessons × $40.00","amount_cents":16000},{"label":"Leo Chen · weekly guitar lessons","detail":"4 lessons × $40.00","amount_cents":16000}]'::jsonb,
      32000,
      'usd',
      '2026-09-01 00:00:00+00',
      owner_profile_id
    );
  end if;
end;
$$;
