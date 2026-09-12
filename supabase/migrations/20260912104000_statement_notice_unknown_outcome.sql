create or replace function public.mark_billing_statement_notice_reconciliation_required(p_delivery_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
begin
  if auth.role()<>'service_role' then raise exception 'not_authorized'; end if;
  update public.billing_statement_notice_deliveries
  set status='reconciliation_required',provider_error_code='provider_outcome_unknown'
  where id=p_delivery_id and status='pending';
  if not found then raise exception 'statement_notice_not_pending'; end if;
end;
$$;
revoke all on function public.mark_billing_statement_notice_reconciliation_required(uuid) from public,anon,authenticated;
grant execute on function public.mark_billing_statement_notice_reconciliation_required(uuid) to service_role;
