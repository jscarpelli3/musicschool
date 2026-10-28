create table public.invoice_checkout_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  billing_account_id uuid not null,
  billing_period_id uuid not null,
  approval_request_id uuid not null,
  payment_attempt_id uuid not null unique,
  payment_connection_id uuid not null,
  provider_customer_id uuid not null,
  provider_checkout_session_id text unique,
  checkout_url text,
  status text not null default 'created' check(status in('created','open','succeeded','expired','cancelled','failed')),
  amount_cents bigint not null check(amount_cents>0),
  currency text not null check(currency~'^[A-Z]{3}$'),
  expires_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(school_id,id),
  foreign key(school_id,billing_account_id,billing_period_id) references public.billing_periods(school_id,billing_account_id,id) on delete restrict,
  foreign key(school_id,approval_request_id) references public.billing_approval_requests(school_id,id) on delete restrict,
  foreign key(school_id,payment_attempt_id) references public.payment_attempts(school_id,id) on delete restrict,
  foreign key(school_id,payment_connection_id) references public.school_payment_connections(school_id,id) on delete restrict,
  foreign key(school_id,provider_customer_id,billing_account_id) references public.billing_provider_customers(school_id,id,billing_account_id) on delete restrict,
  check(expires_at>created_at),
  check(completed_at is null or completed_at>=created_at)
);

create unique index invoice_checkout_requests_one_active_period
  on public.invoice_checkout_requests(billing_period_id)
  where status in('created','open');
create index invoice_checkout_requests_period_idx on public.invoice_checkout_requests(billing_period_id,created_at desc);
create trigger invoice_checkout_requests_set_updated_at before update on public.invoice_checkout_requests
  for each row execute function public.set_updated_at();

alter table public.invoice_checkout_requests enable row level security;
revoke all on public.invoice_checkout_requests from public,anon,authenticated;
grant select,insert,update on public.invoice_checkout_requests to service_role;

create or replace function public.sync_invoice_approval_payment_status()
returns trigger language plpgsql security definer set search_path='' as $$
declare next_status text; event_name text;
begin
  if new.approval_request_id is null or new.status=old.status then return new; end if;
  next_status:=case
    when new.status in('submitted','processing') then 'processing'
    when new.status='succeeded' then 'succeeded'
    when new.status in('requires_action','failed') then 'failed'
    else null end;
  if next_status is null then return new; end if;
  update public.billing_approval_requests set payment_status=next_status where id=new.approval_request_id;
  event_name:=case when next_status='processing' then 'payment_started' when next_status='succeeded' then 'payment_succeeded' else 'payment_failed' end;
  insert into public.billing_approval_events(school_id,approval_request_id,event_type,channel,evidence)
    values(new.school_id,new.approval_request_id,event_name,'system',jsonb_build_object('payment_attempt_id',new.id,'status',new.status));
  return new;
end; $$;

drop trigger if exists payment_attempts_sync_approval_status on public.payment_attempts;
create trigger payment_attempts_sync_approval_status after update of status on public.payment_attempts
  for each row execute function public.sync_invoice_approval_payment_status();
revoke all on function public.sync_invoice_approval_payment_status() from public,anon,authenticated;

create or replace function public.complete_invoice_checkout_request(
  p_request_id uuid,p_provider_account_id text,p_checkout_session_id text,
  p_payment_intent_id text,p_charge_id text,p_provider_event_id text
) returns void language plpgsql security definer set search_path='' as $$
declare request_row public.invoice_checkout_requests%rowtype;
begin
  if auth.role()<>'service_role' then raise exception 'service_role_required'; end if;
  select * into request_row from public.invoice_checkout_requests where id=p_request_id for update;
  if not found then raise exception 'invoice_checkout_request_not_found'; end if;
  if request_row.provider_checkout_session_id is distinct from p_checkout_session_id then raise exception 'checkout_session_mismatch'; end if;
  if request_row.status='succeeded' then return; end if;
  if request_row.status not in('open','created') then raise exception 'invoice_checkout_request_not_open'; end if;
  perform public.apply_invoice_payment_intent_event(request_row.payment_attempt_id,p_provider_account_id,p_payment_intent_id,'succeeded',p_charge_id,null,null,p_provider_event_id);
  update public.invoice_checkout_requests set status='succeeded',completed_at=now(),checkout_url=null where id=request_row.id;
end; $$;

create or replace function public.expire_invoice_checkout_request(
  p_request_id uuid,p_provider_account_id text,p_checkout_session_id text
) returns void language plpgsql security definer set search_path='' as $$
declare request_row public.invoice_checkout_requests%rowtype; connection_account text; attempt_status text;
begin
  if auth.role()<>'service_role' then raise exception 'service_role_required'; end if;
  select * into request_row from public.invoice_checkout_requests where id=p_request_id for update;
  if not found or request_row.provider_checkout_session_id is distinct from p_checkout_session_id then return; end if;
  select provider_account_id into connection_account from public.school_payment_connections where id=request_row.payment_connection_id;
  if connection_account is distinct from p_provider_account_id then raise exception 'connected_account_mismatch'; end if;
  if request_row.status not in('created','open') then return; end if;
  select status into attempt_status from public.payment_attempts where id=request_row.payment_attempt_id for update;
  if attempt_status in('created','submitted','requires_action') then
    update public.payment_attempts set status='cancelled',failure_code='checkout_expired',failure_message='The hosted one-time payment page expired.' where id=request_row.payment_attempt_id;
  end if;
  update public.billing_periods set status='approved'
    where id=request_row.billing_period_id and status in('collecting','payment_failed');
  update public.invoice_checkout_requests set status='expired',checkout_url=null where id=request_row.id;
end; $$;

revoke all on function public.complete_invoice_checkout_request(uuid,text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.expire_invoice_checkout_request(uuid,text,text) from public,anon,authenticated;
grant execute on function public.complete_invoice_checkout_request(uuid,text,text,text,text,text) to service_role;
grant execute on function public.expire_invoice_checkout_request(uuid,text,text) to service_role;

comment on table public.invoice_checkout_requests is 'Short-lived Stripe-hosted payments for one exact approved invoice; no reusable payment-method consent is created.';
