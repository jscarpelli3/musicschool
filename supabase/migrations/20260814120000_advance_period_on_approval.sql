create or replace function public.guard_billing_period_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  line_count integer;
begin
  if old.status <> new.status then
    if (select auth.uid()) is not null
      and current_user not in ('postgres', 'service_role')
      and new.status in ('approved', 'collecting', 'paid', 'payment_failed')
    then
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
  return new;
end;
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

  if not found then return 'not_found'; end if;
  if request_record.approval_status = 'approved' then return 'already_approved'; end if;
  if request_record.approval_status <> 'pending' then return request_record.approval_status; end if;

  if request_record.expires_at <= now() then
    update public.billing_approval_requests set approval_status = 'expired' where id = request_record.id;
    insert into public.billing_approval_events (school_id, approval_request_id, event_type, channel)
    values (request_record.school_id, request_record.id, 'expired', 'system');
    return 'expired';
  end if;

  update public.billing_approval_requests
  set approval_status = 'approved', approved_at = now()
  where id = request_record.id;

  if request_record.billing_period_id is not null then
    update public.billing_periods
    set status = 'approved'
    where id = request_record.billing_period_id
      and school_id = request_record.school_id
      and billing_account_id = request_record.billing_account_id
      and status = 'approval_pending'
      and amount_due_cents = request_record.amount_cents;
    if not found then raise exception 'approval_period_transition_failed'; end if;
  end if;

  insert into public.billing_approval_events (school_id, approval_request_id, event_type, channel, evidence)
  values (
    request_record.school_id, request_record.id, 'approved', 'approval_link',
    jsonb_build_object('amount_cents', request_record.amount_cents, 'currency', request_record.currency, 'period_label', request_record.period_label)
  );
  return 'approved';
end;
$$;

revoke all on function public.approve_billing_request(text) from public;
grant execute on function public.approve_billing_request(text) to anon, authenticated;

update public.billing_periods period
set status = 'approved'
where period.status = 'approval_pending'
  and exists (
    select 1 from public.billing_approval_requests request
    where request.billing_period_id = period.id
      and request.approval_status = 'approved'
      and request.amount_cents = period.amount_due_cents
  );

comment on function public.approve_billing_request(text) is
  'Atomically records payer approval and advances its exact matching billing period without initiating collection.';
