create or replace function public.reset_unsubmitted_invoice_checkout_attempt(
  p_request_id uuid,
  p_provider_account_id text,
  p_checkout_session_id text
) returns void
language plpgsql security definer set search_path=''
as $$
declare
  request_row public.invoice_checkout_requests%rowtype;
  connection_account text;
  attempt_row public.payment_attempts%rowtype;
begin
  if auth.role() <> 'service_role' then raise exception 'service_role_required'; end if;

  select * into request_row from public.invoice_checkout_requests where id=p_request_id for update;
  if not found or request_row.status <> 'open' then return; end if;
  if request_row.provider_checkout_session_id is distinct from p_checkout_session_id then raise exception 'checkout_session_mismatch'; end if;

  select provider_account_id into connection_account from public.school_payment_connections where id=request_row.payment_connection_id;
  if connection_account is distinct from p_provider_account_id then raise exception 'connected_account_mismatch'; end if;

  select * into attempt_row from public.payment_attempts where id=request_row.payment_attempt_id for update;
  if attempt_row.payment_method_id is not null then raise exception 'saved_method_attempt_cannot_be_reset'; end if;
  if attempt_row.status in ('submitted','processing') then
    update public.payment_attempts
      set status='created', failure_code=null, failure_message=null
      where id=attempt_row.id;
    update public.billing_periods
      set status='approved'
      where id=request_row.billing_period_id and status='collecting';
    update public.billing_approval_requests
      set payment_status='not_started'
      where id=request_row.approval_request_id and payment_status='processing';
  end if;
end;
$$;

revoke all on function public.reset_unsubmitted_invoice_checkout_attempt(uuid,text,text) from public,anon,authenticated;
grant execute on function public.reset_unsubmitted_invoice_checkout_attempt(uuid,text,text) to service_role;

comment on function public.reset_unsubmitted_invoice_checkout_attempt(uuid,text,text) is
  'Restores an open, unpaid hosted Checkout reservation that was incorrectly presented as a submitted payment.';
