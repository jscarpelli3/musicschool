create table public.invoice_settlement_entries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  billing_account_id uuid not null,
  billing_period_id uuid not null,
  entry_type text not null check (entry_type in ('external_payment','write_off','external_refund','reversal')),
  method text check (method is null or method in ('cash','check','venmo','zelle','bank_transfer','card_external','other')),
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  occurred_at timestamptz not null,
  reference text,
  note text,
  source_entry_id uuid references public.invoice_settlement_entries(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (school_id, id),
  foreign key (school_id, billing_account_id, billing_period_id)
    references public.billing_periods(school_id, billing_account_id, id) on delete restrict,
  check (length(coalesce(reference,'')) <= 200),
  check (length(coalesce(note,'')) <= 1000),
  check ((entry_type='external_payment' and method is not null and source_entry_id is null)
    or (entry_type='write_off' and method is null and source_entry_id is null)
    or (entry_type in ('external_refund','reversal') and method is null and source_entry_id is not null))
);

create unique index invoice_settlement_one_reversal_idx
  on public.invoice_settlement_entries(source_entry_id) where entry_type='reversal';
create index invoice_settlement_period_idx
  on public.invoice_settlement_entries(billing_period_id,created_at);

alter table public.invoice_settlement_entries enable row level security;
create policy invoice_settlement_entries_admin_select on public.invoice_settlement_entries
  for select to authenticated using (public.has_school_role(school_id,array['owner','admin']));
revoke all on public.invoice_settlement_entries from public,anon,authenticated;
grant select on public.invoice_settlement_entries to authenticated;
grant select,insert on public.invoice_settlement_entries to service_role;

create or replace function public.prevent_invoice_settlement_mutation()
returns trigger language plpgsql set search_path='' as $$
begin raise exception 'invoice_settlement_entries_are_append_only'; end; $$;
create trigger invoice_settlement_entries_immutable
  before update or delete on public.invoice_settlement_entries
  for each row execute function public.prevent_invoice_settlement_mutation();
revoke all on function public.prevent_invoice_settlement_mutation() from public,anon,authenticated;

create or replace function public.record_invoice_settlement_entry(
  p_school_id uuid,p_billing_account_id uuid,p_billing_period_id uuid,p_entry_type text,
  p_method text,p_amount_cents bigint,p_occurred_at timestamptz,p_reference text,p_note text,
  p_source_entry_id uuid,p_created_by uuid
) returns uuid language plpgsql security definer set search_path='' as $$
declare period_row public.billing_periods%rowtype; source_row public.invoice_settlement_entries%rowtype;
  stripe_paid bigint; external_paid bigint; written_off bigint; reversed bigint; refunded bigint;
  outstanding bigint; result_id uuid;
begin
  if auth.role()<>'service_role' then raise exception 'service_role_required'; end if;
  select * into period_row from public.billing_periods where id=p_billing_period_id and school_id=p_school_id and billing_account_id=p_billing_account_id for update;
  if not found then raise exception 'invoice_not_found'; end if;
  if p_amount_cents is null or p_amount_cents<=0 then raise exception 'invalid_amount'; end if;
  if p_entry_type not in('external_payment','write_off','external_refund','reversal') then raise exception 'invalid_entry_type'; end if;
  if period_row.status in('draft','review','locked','approval_pending','void') then raise exception 'invoice_not_settleable'; end if;

  select coalesce(sum(amount_cents),0) into stripe_paid from public.payment_attempts where billing_period_id=p_billing_period_id and status='succeeded';
  select
    coalesce(sum(amount_cents) filter(where entry_type='external_payment'),0),
    coalesce(sum(amount_cents) filter(where entry_type='write_off'),0),
    coalesce(sum(amount_cents) filter(where entry_type='reversal'),0),
    coalesce(sum(amount_cents) filter(where entry_type='external_refund'),0)
  into external_paid,written_off,reversed,refunded
  from public.invoice_settlement_entries where billing_period_id=p_billing_period_id;
  outstanding:=greatest(period_row.amount_due_cents-stripe_paid-external_paid-written_off+reversed,0);

  if p_entry_type in('external_payment','write_off') then
    if exists(select 1 from public.payment_attempts where billing_period_id=p_billing_period_id and status in('created','submitted','processing','requires_action'))
      or exists(select 1 from public.invoice_checkout_requests where billing_period_id=p_billing_period_id and status in('created','open'))
    then raise exception 'active_stripe_collection_must_be_resolved_first'; end if;
    if p_source_entry_id is not null or p_amount_cents>outstanding then raise exception 'amount_exceeds_outstanding_balance'; end if;
    if p_entry_type='external_payment' and p_method not in('cash','check','venmo','zelle','bank_transfer','card_external','other') then raise exception 'invalid_payment_method'; end if;
    if p_entry_type='write_off' and nullif(trim(coalesce(p_note,'')),'') is null then raise exception 'write_off_note_required'; end if;
  else
    select * into source_row from public.invoice_settlement_entries where id=p_source_entry_id and billing_period_id=p_billing_period_id for update;
    if not found then raise exception 'settlement_source_not_found'; end if;
    if p_entry_type='reversal' then
      if source_row.entry_type not in('external_payment','write_off') or p_amount_cents<>source_row.amount_cents then raise exception 'invalid_reversal'; end if;
      if exists(select 1 from public.invoice_settlement_entries where source_entry_id=source_row.id and entry_type='reversal') then raise exception 'entry_already_reversed'; end if;
    else
      if source_row.entry_type<>'external_payment' then raise exception 'external_refund_requires_external_payment'; end if;
      if p_amount_cents>(source_row.amount_cents-coalesce((select sum(amount_cents) from public.invoice_settlement_entries where source_entry_id=source_row.id and entry_type='external_refund'),0)) then raise exception 'refund_exceeds_payment'; end if;
    end if;
  end if;

  insert into public.invoice_settlement_entries(school_id,billing_account_id,billing_period_id,entry_type,method,amount_cents,currency,occurred_at,reference,note,source_entry_id,created_by)
  values(p_school_id,p_billing_account_id,p_billing_period_id,p_entry_type,case when p_entry_type='external_payment' then p_method else null end,p_amount_cents,period_row.currency,coalesce(p_occurred_at,now()),nullif(trim(coalesce(p_reference,'')),''),nullif(trim(coalesce(p_note,'')),''),p_source_entry_id,p_created_by)
  returning id into result_id;

  if p_entry_type in('external_payment','write_off') and p_amount_cents=outstanding and period_row.status<>'paid' then
    update public.billing_periods set status='paid',paid_at=case when p_entry_type='external_payment' then coalesce(p_occurred_at,now()) else now() end where id=period_row.id;
  end if;
  insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata)
  values(p_school_id,p_created_by,'invoice_settlement.'||p_entry_type,'billing_period',p_billing_period_id,
    jsonb_build_object('entry_id',result_id,'amount_cents',p_amount_cents,'currency',period_row.currency,'method',p_method,'source_entry_id',p_source_entry_id,'reference',nullif(trim(coalesce(p_reference,'')),''),'note',nullif(trim(coalesce(p_note,'')),'')));
  if p_entry_type='reversal' and period_row.status='paid' then
    update public.billing_periods set status='approved',paid_at=null where id=period_row.id;
  end if;
  return result_id;
end; $$;
revoke all on function public.record_invoice_settlement_entry(uuid,uuid,uuid,text,text,bigint,timestamptz,text,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.record_invoice_settlement_entry(uuid,uuid,uuid,text,text,bigint,timestamptz,text,text,uuid,uuid) to service_role;

create or replace function public.prevent_stripe_collection_after_manual_settlement()
returns trigger language plpgsql set search_path='' as $$
begin
  if exists(
    select 1 from public.invoice_settlement_entries entry
    where entry.billing_period_id=new.billing_period_id
      and entry.entry_type in('external_payment','write_off')
      and not exists(select 1 from public.invoice_settlement_entries reversal where reversal.source_entry_id=entry.id and reversal.entry_type='reversal')
  ) then raise exception 'invoice_has_manual_settlement'; end if;
  return new;
end; $$;
create trigger payment_attempts_block_manual_settlement
  before insert on public.payment_attempts
  for each row execute function public.prevent_stripe_collection_after_manual_settlement();
revoke all on function public.prevent_stripe_collection_after_manual_settlement() from public,anon,authenticated;

create or replace function public.apply_invoice_refund_event(
  p_payment_refund_id uuid,p_provider_account_id text,p_provider_refund_id text,p_status text,
  p_failure_message text,p_provider_event_id text
) returns void language plpgsql security definer set search_path='' as $$
declare refund_row public.payment_refunds%rowtype; connected_account text;
begin
  if auth.role()<>'service_role' then raise exception 'service_role_required'; end if;
  if p_status not in('submitted','succeeded','failed') then raise exception 'invalid_refund_status'; end if;
  select * into refund_row from public.payment_refunds where id=p_payment_refund_id for update;
  if not found then raise exception 'payment_refund_not_found'; end if;
  select connection.provider_account_id into connected_account
  from public.payment_attempts attempt join public.school_payment_connections connection on connection.id=attempt.payment_connection_id
  where attempt.id=refund_row.payment_attempt_id;
  if connected_account is distinct from p_provider_account_id then raise exception 'connected_account_mismatch'; end if;
  if refund_row.provider_refund_id is not null and refund_row.provider_refund_id is distinct from p_provider_refund_id then raise exception 'provider_refund_mismatch'; end if;
  if refund_row.status='succeeded' and p_status<>'succeeded' then return; end if;
  perform set_config('app.payment_state_source','stripe_webhook',true);
  perform set_config('app.provider_event_id',coalesce(p_provider_event_id,''),true);
  update public.payment_refunds set status=p_status,provider_refund_id=p_provider_refund_id,
    failure_message=case when p_status='failed' then left(coalesce(p_failure_message,'Stripe could not complete this refund.'),1000) else null end
  where id=refund_row.id;
end; $$;
revoke all on function public.apply_invoice_refund_event(uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.apply_invoice_refund_event(uuid,text,text,text,text,text) to service_role;

comment on table public.invoice_settlement_entries is 'Append-only owner-recorded invoice settlement ledger. External money and write-offs never masquerade as Stripe activity; corrections use compensating entries.';

-- Settlement can close an approved/failed invoice without pretending a Stripe
-- attempt passed through collecting. Cancelling an unpaid Checkout reservation
-- can also return the period to its already-approved state.
create or replace function public.guard_billing_period_transition()
returns trigger language plpgsql set search_path = '' as $$
declare line_count integer;
begin
  if old.status <> new.status then
    if (select auth.uid()) is not null and current_user not in ('postgres','service_role')
      and new.status in ('approved','collecting','paid','payment_failed')
    then raise exception 'This billing status is controlled by the approval or payment workflow'; end if;
    if old.status = 'approval_pending' and new.status = 'review' and current_user not in ('postgres','service_role') then
      raise exception 'A submitted approval must be rejected or replaced through its workflow';
    end if;
    if not (
      (old.status = 'draft' and new.status in ('review','void'))
      or (old.status = 'review' and new.status in ('draft','locked','void'))
      or (old.status = 'locked' and new.status in ('review','approval_pending','void'))
      or (old.status = 'approval_pending' and new.status in ('review','approved','void'))
      or (old.status = 'approved' and new.status in ('collecting','paid','void'))
      or (old.status = 'collecting' and new.status in ('approved','paid','payment_failed'))
      or (old.status = 'payment_failed' and new.status in ('approved','collecting','paid','void'))
      or (old.status = 'paid' and new.status = 'approved')
    ) then raise exception 'Invalid billing period transition: % -> %', old.status, new.status; end if;
    if new.status = 'locked' then
      select count(*) into line_count from public.billing_line_items where billing_period_id = new.id;
      if line_count = 0 or new.amount_due_cents <= 0 then raise exception 'A billing period needs positive line items before locking'; end if;
      new.locked_at := now();
    elsif new.status = 'approved' then
      if not exists (select 1 from public.billing_approval_requests approval where approval.billing_period_id = new.id and approval.approval_status = 'approved' and approval.amount_cents = new.amount_due_cents) then raise exception 'An approved matching request is required'; end if;
      new.approved_at := now();
    elsif new.status = 'paid' then new.paid_at := now();
    elsif new.status = 'void' then new.voided_at := now();
    end if;
  end if;
  return new;
end;
$$;
