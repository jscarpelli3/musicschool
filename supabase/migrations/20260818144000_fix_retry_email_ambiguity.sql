create or replace function public.retry_billing_approval_email_delivery(
  p_school_id uuid,
  p_approval_request_id uuid,
  p_token_hash text,
  p_body_sha256 text,
  p_expires_at timestamptz
)
returns table (email_delivery_id uuid, recipient_email text, from_address text, subject text, idempotency_key text)
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  request_row public.billing_approval_requests%rowtype;
  prior_delivery public.email_deliveries%rowtype;
  delivery_id uuid;
  next_attempt integer;
  delivery_key text;
begin
  if actor_id is null or not public.has_school_role(p_school_id, array['owner','admin']) then raise exception 'not_authorized'; end if;
  if p_token_hash !~ '^[0-9a-f]{64}$' or p_body_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'invalid_hash'; end if;
  if p_expires_at <= now() or p_expires_at > now() + interval '7 days' then raise exception 'invalid_expiration'; end if;

  perform pg_advisory_xact_lock(hashtextextended('billing-approval:' || p_approval_request_id::text, 0));
  select * into request_row from public.billing_approval_requests
  where school_id = p_school_id and id = p_approval_request_id for update;
  if not found then raise exception 'approval_request_not_found'; end if;
  if request_row.approval_status <> 'pending' then raise exception 'approval_request_not_pending'; end if;

  select * into prior_delivery from public.email_deliveries
  where school_id = p_school_id and approval_request_id = p_approval_request_id
  order by attempt_number desc, created_at desc limit 1 for update;
  if not found or prior_delivery.status <> 'failed' then raise exception 'latest_delivery_not_retryable'; end if;
  if exists (select 1 from public.email_suppressions suppression where suppression.recipient_email = prior_delivery.recipient_email) then raise exception 'recipient_suppressed'; end if;

  select coalesce(max(delivery.attempt_number), 0) + 1 into next_attempt
  from public.email_deliveries delivery where delivery.approval_request_id = p_approval_request_id;
  delivery_key := 'billing-approval/' || p_approval_request_id::text || '/attempt/' || next_attempt::text;

  update public.billing_approval_requests
  set token_hash = p_token_hash, expires_at = p_expires_at
  where id = p_approval_request_id;

  insert into public.email_deliveries (
    school_id, billing_account_id, approval_request_id, recipient_email, message_kind,
    from_address, subject, body_sha256, idempotency_key, template_version, attempt_number, created_by
  ) values (
    prior_delivery.school_id, prior_delivery.billing_account_id, prior_delivery.approval_request_id,
    prior_delivery.recipient_email, prior_delivery.message_kind, prior_delivery.from_address,
    prior_delivery.subject, p_body_sha256, delivery_key, prior_delivery.template_version,
    next_attempt, actor_id
  ) returning id into delivery_id;

  insert into public.billing_approval_events (school_id, approval_request_id, event_type, channel, evidence)
  values (p_school_id, p_approval_request_id, 'delivery_retried', 'email',
    jsonb_build_object('prior_delivery_id', prior_delivery.id, 'email_delivery_id', delivery_id, 'attempt_number', next_attempt));
  insert into public.audit_log (school_id, actor_profile_id, action, entity_type, entity_id, metadata)
  values (p_school_id, actor_id, 'billing_approval.email_retried', 'billing_approval_request', p_approval_request_id,
    jsonb_build_object('prior_delivery_id', prior_delivery.id, 'email_delivery_id', delivery_id, 'attempt_number', next_attempt));

  return query select delivery_id, prior_delivery.recipient_email, prior_delivery.from_address, prior_delivery.subject, delivery_key;
end;
$$;
