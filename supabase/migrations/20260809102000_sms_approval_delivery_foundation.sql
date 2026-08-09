alter table public.billing_approval_requests
  add column request_version integer not null default 1 check (request_version > 0),
  add column cancelled_at timestamptz,
  add constraint billing_approval_cancelled_at_check check (
    cancelled_at is null or approval_status = 'cancelled'
  );

create table public.sms_deliveries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  billing_account_id uuid not null,
  approval_request_id uuid not null,
  recipient_phone_e164 text not null check (recipient_phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  message_kind text not null check (message_kind in ('billing_approval', 'billing_reminder', 'schedule_notice', 'access_link')),
  provider text not null default 'twilio' check (provider = 'twilio'),
  provider_message_sid text,
  messaging_service_sid text,
  body_sha256 text not null check (body_sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'pending' check (status in (
    'pending', 'accepted', 'queued', 'sending', 'sent', 'delivered',
    'undelivered', 'failed', 'cancelled'
  )),
  attempt_number integer not null default 1 check (attempt_number > 0),
  provider_error_code text,
  provider_error_message text,
  accepted_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_message_sid),
  unique (school_id, id),
  foreign key (school_id, billing_account_id)
    references public.billing_accounts(school_id, id) on delete restrict,
  foreign key (school_id, approval_request_id)
    references public.billing_approval_requests(school_id, id) on delete restrict
);

create index sms_deliveries_approval_time_idx
  on public.sms_deliveries(approval_request_id, created_at desc);
create index sms_deliveries_status_time_idx
  on public.sms_deliveries(status, created_at);

create trigger sms_deliveries_set_updated_at
before update on public.sms_deliveries
for each row execute function public.set_updated_at();

alter table public.sms_deliveries enable row level security;
create policy sms_deliveries_admin_select on public.sms_deliveries for select to authenticated
using (public.has_school_role(school_id, array['owner','admin']));
grant select on public.sms_deliveries to authenticated;

create or replace function public.create_billing_approval_sms_delivery(
  p_school_id uuid,
  p_billing_period_id uuid,
  p_token_hash text,
  p_recipient_phone_e164 text,
  p_body_sha256 text,
  p_messaging_service_sid text,
  p_expires_at timestamptz
)
returns table (approval_request_id uuid, sms_delivery_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  period_row public.billing_periods%rowtype;
  request_id uuid;
  delivery_id uuid;
  next_version integer;
  snapshot jsonb;
begin
  if actor_id is null or not public.has_school_role(p_school_id, array['owner','admin']) then
    raise exception 'not_authorized';
  end if;
  if p_token_hash !~ '^[0-9a-f]{64}$' or p_body_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_hash';
  end if;
  if p_recipient_phone_e164 !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'invalid_recipient_phone'; end if;
  if p_messaging_service_sid !~ '^MG[0-9a-fA-F]{32}$' then raise exception 'invalid_messaging_service'; end if;
  if p_expires_at <= now() or p_expires_at > now() + interval '7 days' then raise exception 'invalid_expiration'; end if;

  perform pg_advisory_xact_lock(hashtextextended('billing-approval:' || p_billing_period_id::text, 0));
  select * into period_row from public.billing_periods
  where school_id = p_school_id and id = p_billing_period_id for update;
  if not found then raise exception 'billing_period_not_found'; end if;
  if period_row.status not in ('locked','approval_pending') then raise exception 'billing_period_not_locked'; end if;
  if period_row.amount_due_cents <= 0 then raise exception 'billing_period_has_no_amount'; end if;

  select coalesce(max(request.request_version), 0) + 1 into next_version
  from public.billing_approval_requests request
  where request.billing_period_id = period_row.id;

  update public.billing_approval_requests request
  set approval_status = 'cancelled', cancelled_at = now()
  where request.billing_period_id = period_row.id and request.approval_status = 'pending';

  insert into public.billing_approval_events (school_id, approval_request_id, event_type, channel, evidence)
  select request.school_id, request.id, 'cancelled', 'system', jsonb_build_object('reason', 'superseded')
  from public.billing_approval_requests request
  where request.billing_period_id = period_row.id
    and request.approval_status = 'cancelled'
    and request.cancelled_at >= transaction_timestamp();

  select coalesce(jsonb_agg(jsonb_build_object(
    'label', item.description,
    'detail', case when item.service_date is null then 'Period adjustment' else item.service_date::text end,
    'amount_cents', item.amount_cents
  ) order by item.service_date nulls last, item.created_at), '[]'::jsonb)
  into snapshot
  from public.billing_line_items item where item.billing_period_id = period_row.id;

  insert into public.billing_approval_requests (
    school_id, billing_account_id, billing_period_id, token_hash, period_label,
    line_items, amount_cents, currency, expires_at, created_by, request_version
  ) values (
    p_school_id, period_row.billing_account_id, period_row.id, p_token_hash, period_row.label,
    snapshot, period_row.amount_due_cents, lower(period_row.currency), p_expires_at, actor_id, next_version
  ) returning id into request_id;

  insert into public.billing_approval_events (
    school_id, approval_request_id, event_type, channel, evidence
  ) values (
    p_school_id, request_id, 'created', 'approval_link',
    jsonb_build_object('billing_period_id', period_row.id, 'request_version', next_version, 'delivery', 'sms')
  );

  insert into public.sms_deliveries (
    school_id, billing_account_id, approval_request_id, recipient_phone_e164,
    message_kind, messaging_service_sid, body_sha256, attempt_number, created_by
  ) values (
    p_school_id, period_row.billing_account_id, request_id, p_recipient_phone_e164,
    'billing_approval', p_messaging_service_sid, p_body_sha256, 1, actor_id
  ) returning id into delivery_id;

  if period_row.status = 'locked' then
    update public.billing_periods set status = 'approval_pending' where id = period_row.id;
  end if;

  insert into public.audit_log (school_id, actor_profile_id, action, entity_type, entity_id, metadata)
  values (p_school_id, actor_id, 'billing_approval.sms_prepared', 'billing_approval_request', request_id,
    jsonb_build_object('billing_period_id', period_row.id, 'sms_delivery_id', delivery_id, 'request_version', next_version));

  return query select request_id, delivery_id;
end;
$$;

revoke all on function public.create_billing_approval_sms_delivery(uuid,uuid,text,text,text,text,timestamptz) from public, anon;
grant execute on function public.create_billing_approval_sms_delivery(uuid,uuid,text,text,text,text,timestamptz) to authenticated;

comment on table public.sms_deliveries is
  'One durable provider delivery attempt created before any external SMS call; bearer message bodies are represented only by hashes.';
