create or replace function public.prepare_billing_approval_reminder(
  p_approval_request_id uuid,p_token_hash text,p_body_sha256 text,p_expires_at timestamptz,
  p_recipient_email text,p_from_address text,p_subject text
) returns table(email_delivery_id uuid,recipient_email text,idempotency_key text)
language plpgsql security definer set search_path='' as $$
declare request_row public.billing_approval_requests%rowtype; period_status text; current_email text;
  delivery_id uuid; next_attempt integer; delivery_key text;
begin
  if auth.role()<>'service_role' then raise exception 'service_role_required'; end if;
  if p_token_hash!~'^[0-9a-f]{64}$' or p_body_sha256!~'^[0-9a-f]{64}$' then raise exception 'invalid_hash'; end if;
  if p_expires_at<=now() or p_expires_at>now()+interval '7 days' then raise exception 'invalid_expiration'; end if;
  perform pg_advisory_xact_lock(hashtextextended('billing-reminder:'||p_approval_request_id::text,0));
  select * into request_row from public.billing_approval_requests where id=p_approval_request_id for update;
  if not found or request_row.approval_status<>'pending' then return; end if;
  select period.status into period_status from public.billing_periods period
    where period.id=request_row.billing_period_id and period.amount_due_cents=request_row.amount_cents
      and period.currency=upper(request_row.currency) for update;
  if period_status is distinct from 'approval_pending' then return; end if;
  select lower(trim(person.email)) into current_email from public.billing_accounts account
    join public.people person on person.id=account.billing_contact_person_id and person.school_id=account.school_id
    where account.id=request_row.billing_account_id and account.school_id=request_row.school_id;
  if current_email is null or current_email<>lower(trim(p_recipient_email))
    or exists(select 1 from public.email_suppressions suppression where suppression.recipient_email=current_email) then return; end if;
  if not exists(select 1 from public.email_deliveries delivery where delivery.approval_request_id=request_row.id
      and delivery.status in('accepted','sent','delivered','delayed'))
    or (select max(delivery.created_at) from public.email_deliveries delivery where delivery.approval_request_id=request_row.id)>now()-interval '7 days'
    or exists(select 1 from public.email_deliveries delivery where delivery.approval_request_id=request_row.id and delivery.status='pending') then return; end if;
  select coalesce(max(delivery.attempt_number),0)+1 into next_attempt from public.email_deliveries delivery
    where delivery.approval_request_id=request_row.id;
  delivery_key:='billing-reminder/'||request_row.id::text||'/attempt/'||next_attempt::text;
  update public.billing_approval_requests set token_hash=p_token_hash,expires_at=p_expires_at where id=request_row.id;
  insert into public.email_deliveries(school_id,billing_account_id,approval_request_id,recipient_email,message_kind,
    from_address,subject,body_sha256,idempotency_key,template_version,attempt_number,created_by)
  values(request_row.school_id,request_row.billing_account_id,request_row.id,current_email,'billing_reminder',
    p_from_address,p_subject,p_body_sha256,delivery_key,1,next_attempt,request_row.created_by) returning id into delivery_id;
  insert into public.billing_approval_events(school_id,approval_request_id,event_type,channel,evidence)
  values(request_row.school_id,request_row.id,'delivery_retried','email',jsonb_build_object('reason','scheduled_reminder','email_delivery_id',delivery_id,'attempt_number',next_attempt));
  insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata)
  values(request_row.school_id,request_row.created_by,'billing_approval.reminder_prepared','billing_approval_request',request_row.id,
    jsonb_build_object('email_delivery_id',delivery_id,'attempt_number',next_attempt));
  return query select delivery_id,current_email,delivery_key;
end; $$;
