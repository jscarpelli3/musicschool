alter table public.billing_statement_notice_deliveries
add column provider_error_code text check(provider_error_code is null or length(provider_error_code)<=80);

do $$
declare definition text;
begin
  definition:=pg_get_functiondef('public.prepare_billing_statement_notice(uuid,uuid,text,text,text)'::regprocedure);
  definition:=replace(definition,
    'from public.email_suppressions where recipient_email=normalized_email',
    'from public.email_suppressions suppression where suppression.recipient_email=normalized_email');
  execute definition;
end;
$$;

create or replace function public.fail_billing_statement_notice_submission(p_delivery_id uuid,p_code text default null)
returns void language plpgsql security definer set search_path=''
as $$
begin
  if auth.role()<>'service_role' then raise exception 'not_authorized'; end if;
  update public.billing_statement_notice_deliveries
  set status='failed',failed_at=now(),provider_error_code=left(nullif(trim(p_code),''),80)
  where id=p_delivery_id and status='pending';
end;
$$;

revoke all on function public.fail_billing_statement_notice_submission(uuid,text) from public,anon,authenticated;
grant execute on function public.fail_billing_statement_notice_submission(uuid,text) to service_role;
