create table public.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  billing_account_id uuid not null,
  approval_request_id uuid not null,
  recipient_email text not null check (recipient_email = lower(recipient_email) and length(recipient_email) <= 320),
  message_kind text not null check (message_kind in ('billing_approval', 'billing_reminder', 'schedule_notice', 'access_link', 'receipt_notice')),
  provider text not null default 'resend' check (provider = 'resend'),
  provider_email_id text,
  from_address text not null,
  subject text not null check (length(subject) between 1 and 300),
  body_sha256 text not null check (body_sha256 ~ '^[0-9a-f]{64}$'),
  idempotency_key text not null unique check (length(idempotency_key) between 1 and 256),
  template_version integer not null default 1 check (template_version > 0),
  status text not null default 'pending' check (status in (
    'pending', 'accepted', 'sent', 'delivered', 'delayed',
    'bounced', 'complained', 'failed', 'suppressed', 'cancelled'
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
  unique (provider, provider_email_id),
  unique (school_id, id),
  foreign key (school_id, billing_account_id)
    references public.billing_accounts(school_id, id) on delete restrict,
  foreign key (school_id, approval_request_id)
    references public.billing_approval_requests(school_id, id) on delete restrict
);

create index email_deliveries_approval_time_idx on public.email_deliveries(approval_request_id, created_at desc);
create index email_deliveries_status_time_idx on public.email_deliveries(status, created_at);
create trigger email_deliveries_set_updated_at before update on public.email_deliveries
for each row execute function public.set_updated_at();

alter table public.email_deliveries enable row level security;
create policy email_deliveries_admin_select on public.email_deliveries for select to authenticated
using (public.has_school_role(school_id, array['owner','admin']));
grant select on public.email_deliveries to authenticated;

create table public.email_delivery_events (
  id bigint generated always as identity primary key,
  provider text not null default 'resend' check (provider = 'resend'),
  provider_event_id text not null,
  provider_email_id text not null,
  delivery_id uuid references public.email_deliveries(id) on delete restrict,
  event_type text not null,
  occurred_at timestamptz not null,
  recipient_email text,
  received_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create index email_delivery_events_unmatched_idx on public.email_delivery_events(provider_email_id, received_at)
where delivery_id is null;
alter table public.email_delivery_events enable row level security;
create policy email_delivery_events_admin_select on public.email_delivery_events for select to authenticated
using (delivery_id is not null and exists (
  select 1 from public.email_deliveries delivery
  where delivery.id = delivery_id and public.has_school_role(delivery.school_id, array['owner','admin'])
));
grant select on public.email_delivery_events to authenticated;

create table public.email_suppressions (
  recipient_email text primary key check (recipient_email = lower(recipient_email) and length(recipient_email) <= 320),
  reason text not null check (reason in ('bounced', 'complained', 'provider_suppressed')),
  provider text not null default 'resend' check (provider = 'resend'),
  provider_event_id text not null,
  suppressed_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.email_suppressions enable row level security;

create or replace function public.create_billing_approval_email_delivery(
  p_school_id uuid,
  p_billing_period_id uuid,
  p_token_hash text,
  p_recipient_email text,
  p_from_address text,
  p_subject text,
  p_body_sha256 text,
  p_expires_at timestamptz
)
returns table (approval_request_id uuid, email_delivery_id uuid, idempotency_key text)
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  period_row public.billing_periods%rowtype;
  request_id uuid;
  delivery_id uuid;
  next_version integer;
  snapshot jsonb;
  normalized_email text := lower(trim(p_recipient_email));
  delivery_key text;
begin
  if actor_id is null or not public.has_school_role(p_school_id, array['owner','admin']) then raise exception 'not_authorized'; end if;
  if p_token_hash !~ '^[0-9a-f]{64}$' or p_body_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'invalid_hash'; end if;
  if normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or length(normalized_email) > 320 then raise exception 'invalid_recipient_email'; end if;
  if exists (select 1 from public.email_suppressions where recipient_email = normalized_email) then raise exception 'recipient_suppressed'; end if;
  if p_expires_at <= now() or p_expires_at > now() + interval '7 days' then raise exception 'invalid_expiration'; end if;

  perform pg_advisory_xact_lock(hashtextextended('billing-approval:' || p_billing_period_id::text, 0));
  select * into period_row from public.billing_periods where school_id = p_school_id and id = p_billing_period_id for update;
  if not found then raise exception 'billing_period_not_found'; end if;
  if period_row.status not in ('locked','approval_pending') then raise exception 'billing_period_not_locked'; end if;
  if period_row.amount_due_cents <= 0 then raise exception 'billing_period_has_no_amount'; end if;

  select coalesce(max(request.request_version), 0) + 1 into next_version
  from public.billing_approval_requests request where request.billing_period_id = period_row.id;

  update public.billing_approval_requests request set approval_status = 'cancelled', cancelled_at = now()
  where request.billing_period_id = period_row.id and request.approval_status = 'pending';
  insert into public.billing_approval_events (school_id, approval_request_id, event_type, channel, evidence)
  select request.school_id, request.id, 'cancelled', 'system', jsonb_build_object('reason', 'superseded')
  from public.billing_approval_requests request where request.billing_period_id = period_row.id
    and request.approval_status = 'cancelled' and request.cancelled_at >= transaction_timestamp();

  select coalesce(jsonb_agg(jsonb_build_object(
    'label', item.description,
    'detail', case when item.service_date is null then 'Period adjustment' else item.service_date::text end,
    'amount_cents', item.amount_cents
  ) order by item.service_date nulls last, item.created_at), '[]'::jsonb)
  into snapshot from public.billing_line_items item where item.billing_period_id = period_row.id;

  insert into public.billing_approval_requests (
    school_id, billing_account_id, billing_period_id, token_hash, period_label,
    line_items, amount_cents, currency, expires_at, created_by, request_version
  ) values (
    p_school_id, period_row.billing_account_id, period_row.id, p_token_hash, period_row.label,
    snapshot, period_row.amount_due_cents, lower(period_row.currency), p_expires_at, actor_id, next_version
  ) returning id into request_id;

  insert into public.billing_approval_events (school_id, approval_request_id, event_type, channel, evidence)
  values (p_school_id, request_id, 'created', 'approval_link',
    jsonb_build_object('billing_period_id', period_row.id, 'request_version', next_version, 'delivery', 'email'));

  delivery_key := 'billing-approval/' || request_id::text;
  insert into public.email_deliveries (
    school_id, billing_account_id, approval_request_id, recipient_email, message_kind,
    from_address, subject, body_sha256, idempotency_key, attempt_number, created_by
  ) values (
    p_school_id, period_row.billing_account_id, request_id, normalized_email, 'billing_approval',
    p_from_address, p_subject, p_body_sha256, delivery_key, 1, actor_id
  ) returning id into delivery_id;

  if period_row.status = 'locked' then update public.billing_periods set status = 'approval_pending' where id = period_row.id; end if;
  insert into public.audit_log (school_id, actor_profile_id, action, entity_type, entity_id, metadata)
  values (p_school_id, actor_id, 'billing_approval.email_prepared', 'billing_approval_request', request_id,
    jsonb_build_object('billing_period_id', period_row.id, 'email_delivery_id', delivery_id, 'request_version', next_version));
  return query select request_id, delivery_id, delivery_key;
end;
$$;

create or replace function public.apply_email_delivery_status(p_delivery_id uuid, p_event_type text, p_occurred_at timestamptz)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  normalized_status text := case p_event_type
    when 'email.sent' then 'sent' when 'email.delivered' then 'delivered'
    when 'email.delivery_delayed' then 'delayed' when 'email.bounced' then 'bounced'
    when 'email.complained' then 'complained' when 'email.failed' then 'failed'
    when 'email.suppressed' then 'suppressed' else null end;
  current_event_time timestamptz;
begin
  if auth.role() <> 'service_role' then raise exception 'not_authorized'; end if;
  if normalized_status is null then return; end if;
  select max(occurred_at) into current_event_time from public.email_delivery_events
    where delivery_id = p_delivery_id and event_type in ('email.sent','email.delivered','email.delivery_delayed','email.bounced','email.complained','email.failed','email.suppressed');
  if current_event_time is not null and current_event_time > p_occurred_at then return; end if;
  update public.email_deliveries set
    status = normalized_status,
    sent_at = case when normalized_status in ('sent','delivered') then coalesce(sent_at, p_occurred_at) else sent_at end,
    delivered_at = case when normalized_status = 'delivered' then coalesce(delivered_at, p_occurred_at) else delivered_at end,
    failed_at = case when normalized_status in ('bounced','complained','failed','suppressed') then coalesce(failed_at, p_occurred_at) else failed_at end
  where id = p_delivery_id;
end;
$$;

create or replace function public.complete_email_provider_submission(p_delivery_id uuid, p_provider_email_id text)
returns void language plpgsql security definer set search_path = ''
as $$
declare event record;
begin
  if auth.role() <> 'service_role' then raise exception 'not_authorized'; end if;
  if nullif(trim(p_provider_email_id), '') is null then raise exception 'invalid_provider_email_id'; end if;
  update public.email_deliveries set provider_email_id = p_provider_email_id, status = 'accepted', accepted_at = now()
  where id = p_delivery_id and status = 'pending';
  if not found then raise exception 'email_delivery_not_pending'; end if;
  for event in update public.email_delivery_events set delivery_id = p_delivery_id
    where delivery_id is null and provider = 'resend' and provider_email_id = p_provider_email_id
    returning event_type, occurred_at
  loop perform public.apply_email_delivery_status(p_delivery_id, event.event_type, event.occurred_at); end loop;
end;
$$;

create or replace function public.fail_email_provider_submission(p_delivery_id uuid, p_provider_error_code text default null, p_provider_error_message text default null)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'not_authorized'; end if;
  update public.email_deliveries set status = 'failed', provider_error_code = left(nullif(p_provider_error_code, ''), 80),
    provider_error_message = left(coalesce(nullif(p_provider_error_message, ''), 'Provider request failed.'), 500), failed_at = coalesce(failed_at, now())
  where id = p_delivery_id and status = 'pending';
end;
$$;

create or replace function public.record_resend_delivery_event(
  p_provider_event_id text, p_provider_email_id text, p_event_type text,
  p_occurred_at timestamptz, p_recipient_email text default null
)
returns text language plpgsql security definer set search_path = ''
as $$
declare target_delivery_id uuid; inserted_id bigint; normalized_email text := lower(trim(p_recipient_email));
begin
  if auth.role() <> 'service_role' then raise exception 'not_authorized'; end if;
  if nullif(trim(p_provider_event_id), '') is null or nullif(trim(p_provider_email_id), '') is null then raise exception 'invalid_provider_event'; end if;
  select id into target_delivery_id from public.email_deliveries where provider = 'resend' and provider_email_id = p_provider_email_id;
  insert into public.email_delivery_events (provider_event_id, provider_email_id, delivery_id, event_type, occurred_at, recipient_email)
  values (p_provider_event_id, p_provider_email_id, target_delivery_id, p_event_type, p_occurred_at, nullif(normalized_email, ''))
  on conflict (provider, provider_event_id) do nothing returning id into inserted_id;
  if inserted_id is null then return 'duplicate'; end if;
  if p_event_type in ('email.bounced','email.complained','email.suppressed') and normalized_email <> '' then
    insert into public.email_suppressions (recipient_email, reason, provider_event_id, suppressed_at)
    values (normalized_email, case p_event_type when 'email.bounced' then 'bounced' when 'email.complained' then 'complained' else 'provider_suppressed' end, p_provider_event_id, p_occurred_at)
    on conflict (recipient_email) do update set reason = excluded.reason, provider_event_id = excluded.provider_event_id, suppressed_at = excluded.suppressed_at;
  end if;
  if target_delivery_id is null then return 'pending_reconciliation'; end if;
  perform public.apply_email_delivery_status(target_delivery_id, p_event_type, p_occurred_at);
  return 'recorded';
end;
$$;

revoke all on function public.create_billing_approval_email_delivery(uuid,uuid,text,text,text,text,text,timestamptz) from public, anon;
grant execute on function public.create_billing_approval_email_delivery(uuid,uuid,text,text,text,text,text,timestamptz) to authenticated;
revoke all on function public.apply_email_delivery_status(uuid,text,timestamptz) from public, anon, authenticated;
revoke all on function public.complete_email_provider_submission(uuid,text) from public, anon, authenticated;
revoke all on function public.fail_email_provider_submission(uuid,text,text) from public, anon, authenticated;
revoke all on function public.record_resend_delivery_event(text,text,text,timestamptz,text) from public, anon, authenticated;
grant execute on function public.apply_email_delivery_status(uuid,text,timestamptz) to service_role;
grant execute on function public.complete_email_provider_submission(uuid,text) to service_role;
grant execute on function public.fail_email_provider_submission(uuid,text,text) to service_role;
grant execute on function public.record_resend_delivery_event(text,text,text,timestamptz,text) to service_role;

comment on table public.email_deliveries is 'Durable email delivery attempts created before provider calls. Approval links and message bodies are represented only by hashes.';
comment on table public.email_delivery_events is 'Append-only, replay-safe Resend webhook events keyed by the signed Svix delivery ID.';
comment on table public.email_suppressions is 'Global safety suppression for permanent bounces, complaints, and provider suppression events.';
