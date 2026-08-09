create table public.sms_delivery_status_events (
  id bigint generated always as identity primary key,
  provider text not null default 'twilio' check (provider = 'twilio'),
  provider_message_sid text not null check (provider_message_sid ~ '^SM[0-9a-fA-F]{32}$'),
  delivery_id uuid references public.sms_deliveries(id) on delete restrict,
  event_fingerprint text not null check (event_fingerprint ~ '^[0-9a-f]{64}$'),
  provider_status text not null,
  provider_error_code text,
  received_at timestamptz not null default now(),
  unique (provider, event_fingerprint)
);

create index sms_delivery_status_events_unmatched_idx
  on public.sms_delivery_status_events(provider_message_sid, received_at)
  where delivery_id is null;

alter table public.sms_delivery_status_events enable row level security;
create policy sms_delivery_status_events_admin_select
on public.sms_delivery_status_events for select to authenticated
using (
  delivery_id is not null and exists (
    select 1 from public.sms_deliveries delivery
    where delivery.id = delivery_id
      and public.has_school_role(delivery.school_id, array['owner','admin'])
  )
);
grant select on public.sms_delivery_status_events to authenticated;

create or replace function public.apply_sms_delivery_status(
  p_delivery_id uuid,
  p_provider_status text,
  p_provider_error_code text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_status text := case p_provider_status
    when 'scheduled' then 'accepted'
    when 'canceled' then 'cancelled'
    else p_provider_status
  end;
  delivery public.sms_deliveries%rowtype;
  current_rank integer;
  incoming_rank integer;
begin
  if auth.role() <> 'service_role' then raise exception 'not_authorized'; end if;
  if normalized_status not in ('accepted','queued','sending','sent','delivered','undelivered','failed','cancelled') then
    return;
  end if;

  select * into delivery from public.sms_deliveries where id = p_delivery_id for update;
  if not found then return; end if;
  if delivery.status = 'delivered' then return; end if;

  current_rank := case delivery.status
    when 'pending' then 0 when 'accepted' then 1 when 'queued' then 2
    when 'sending' then 3 when 'sent' then 4 when 'delivered' then 6 else 5 end;
  incoming_rank := case normalized_status
    when 'accepted' then 1 when 'queued' then 2 when 'sending' then 3
    when 'sent' then 4 when 'delivered' then 6 else 5 end;
  if incoming_rank < current_rank then return; end if;

  update public.sms_deliveries set
    status = normalized_status,
    provider_error_code = case when normalized_status in ('failed','undelivered') then nullif(p_provider_error_code, '') else provider_error_code end,
    accepted_at = case when normalized_status = 'accepted' then coalesce(accepted_at, now()) else accepted_at end,
    sent_at = case when normalized_status in ('sent','delivered') then coalesce(sent_at, now()) else sent_at end,
    delivered_at = case when normalized_status = 'delivered' then coalesce(delivered_at, now()) else delivered_at end,
    failed_at = case when normalized_status in ('failed','undelivered') then coalesce(failed_at, now()) else failed_at end
  where id = p_delivery_id;
end;
$$;

create or replace function public.record_twilio_delivery_status(
  p_provider_message_sid text,
  p_provider_status text,
  p_provider_error_code text,
  p_event_fingerprint text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_delivery_id uuid;
  inserted_id bigint;
begin
  if auth.role() <> 'service_role' then raise exception 'not_authorized'; end if;
  if p_provider_message_sid !~ '^SM[0-9a-fA-F]{32}$' or p_event_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_provider_event';
  end if;

  select id into target_delivery_id from public.sms_deliveries
  where provider = 'twilio' and provider_message_sid = p_provider_message_sid;

  insert into public.sms_delivery_status_events (
    provider_message_sid, delivery_id, event_fingerprint, provider_status, provider_error_code
  ) values (
    p_provider_message_sid, target_delivery_id, p_event_fingerprint, p_provider_status, nullif(p_provider_error_code, '')
  ) on conflict (provider, event_fingerprint) do nothing returning id into inserted_id;
  if inserted_id is null then return 'duplicate'; end if;
  if target_delivery_id is null then return 'pending_reconciliation'; end if;

  perform public.apply_sms_delivery_status(target_delivery_id, p_provider_status, p_provider_error_code);
  return 'recorded';
end;
$$;

create or replace function public.complete_sms_provider_submission(
  p_delivery_id uuid,
  p_provider_message_sid text,
  p_provider_status text,
  p_provider_error_code text default null,
  p_provider_error_message text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  event record;
begin
  if auth.role() <> 'service_role' then raise exception 'not_authorized'; end if;
  if p_provider_message_sid !~ '^SM[0-9a-fA-F]{32}$' then raise exception 'invalid_provider_message_sid'; end if;

  update public.sms_deliveries set
    provider_message_sid = p_provider_message_sid,
    provider_error_message = left(nullif(p_provider_error_message, ''), 500)
  where id = p_delivery_id and status = 'pending';
  if not found then raise exception 'sms_delivery_not_pending'; end if;

  perform public.apply_sms_delivery_status(p_delivery_id, p_provider_status, p_provider_error_code);
  for event in
    update public.sms_delivery_status_events set delivery_id = p_delivery_id
    where delivery_id is null and provider = 'twilio' and provider_message_sid = p_provider_message_sid
    returning provider_status, provider_error_code, received_at
  loop
    perform public.apply_sms_delivery_status(p_delivery_id, event.provider_status, event.provider_error_code);
  end loop;
end;
$$;

revoke all on function public.apply_sms_delivery_status(uuid,text,text) from public, anon, authenticated;
revoke all on function public.record_twilio_delivery_status(text,text,text,text) from public, anon, authenticated;
revoke all on function public.complete_sms_provider_submission(uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.apply_sms_delivery_status(uuid,text,text) to service_role;
grant execute on function public.record_twilio_delivery_status(text,text,text,text) to service_role;
grant execute on function public.complete_sms_provider_submission(uuid,text,text,text,text) to service_role;

comment on table public.sms_delivery_status_events is
  'Append-only, replay-safe Twilio delivery callbacks. Events may wait unmatched if they race the provider submission response.';
