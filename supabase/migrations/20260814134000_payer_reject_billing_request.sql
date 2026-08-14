alter table public.billing_approval_requests drop constraint billing_approval_requests_approval_status_check;
alter table public.billing_approval_requests add constraint billing_approval_requests_approval_status_check
  check (approval_status in ('pending','approved','rejected','expired','cancelled'));
alter table public.billing_approval_requests
  add column rejected_at timestamptz,
  add column rejection_reason_code text check (rejection_reason_code is null or rejection_reason_code in (
    'lesson_did_not_happen','wrong_lesson_or_date','wrong_amount','missing_credit','duplicate_charge','other'
  )),
  add column rejection_note text check (rejection_note is null or length(rejection_note) <= 1000),
  add constraint billing_approval_rejection_fields_check check (
    (approval_status = 'rejected' and rejected_at is not null and rejection_reason_code is not null)
    or (approval_status <> 'rejected' and rejected_at is null and rejection_reason_code is null and rejection_note is null)
  );

alter table public.billing_approval_events drop constraint billing_approval_events_event_type_check;
alter table public.billing_approval_events add constraint billing_approval_events_event_type_check
  check (event_type in ('created','viewed','approved','rejected','expired','cancelled','payment_started','payment_succeeded','payment_failed'));

create or replace function public.guard_billing_period_transition()
returns trigger language plpgsql set search_path = ''
as $$
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
      or (old.status = 'approved' and new.status in ('collecting','void'))
      or (old.status = 'collecting' and new.status in ('paid','payment_failed'))
      or (old.status = 'payment_failed' and new.status in ('collecting','void'))
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

create or replace function public.reject_billing_request(raw_token text, p_reason_code text, p_note text default null)
returns text language plpgsql security definer set search_path = ''
as $$
declare request_row public.billing_approval_requests%rowtype; clean_note text := nullif(trim(p_note), '');
begin
  if p_reason_code not in ('lesson_did_not_happen','wrong_lesson_or_date','wrong_amount','missing_credit','duplicate_charge','other') then return 'invalid_reason'; end if;
  if p_reason_code = 'other' and clean_note is null then return 'note_required'; end if;
  if length(clean_note) > 1000 then return 'note_too_long'; end if;
  select * into request_row from public.billing_approval_requests request
  where request.token_hash = encode(extensions.digest(raw_token, 'sha256'), 'hex') for update;
  if not found then return 'not_found'; end if;
  if request_row.approval_status = 'rejected' then return 'already_rejected'; end if;
  if request_row.approval_status <> 'pending' then return request_row.approval_status; end if;
  if request_row.expires_at <= now() then
    update public.billing_approval_requests set approval_status = 'expired' where id = request_row.id;
    insert into public.billing_approval_events (school_id,approval_request_id,event_type,channel) values (request_row.school_id,request_row.id,'expired','system');
    return 'expired';
  end if;
  update public.billing_approval_requests set approval_status = 'rejected', rejected_at = now(), rejection_reason_code = p_reason_code, rejection_note = clean_note where id = request_row.id;
  if request_row.billing_period_id is not null then
    update public.billing_periods set status = 'review', locked_at = null
    where id = request_row.billing_period_id and status = 'approval_pending' and amount_due_cents = request_row.amount_cents;
    if not found then raise exception 'rejection_period_transition_failed'; end if;
  end if;
  insert into public.billing_approval_events (school_id,approval_request_id,event_type,channel,evidence)
  values (request_row.school_id,request_row.id,'rejected','approval_link',jsonb_build_object('reason_code',p_reason_code,'note',clean_note,'amount_cents',request_row.amount_cents));
  return 'rejected';
end;
$$;

revoke all on function public.reject_billing_request(text,text,text) from public;
grant execute on function public.reject_billing_request(text,text,text) to anon, authenticated;

comment on function public.reject_billing_request(text,text,text) is
  'Rejects one exact pending proposal, preserves structured payer feedback, and returns its period to owner review without changing lines.';
