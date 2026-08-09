create or replace function public.fail_sms_provider_submission(
  p_delivery_id uuid,
  p_provider_error_code text default null,
  p_provider_error_message text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'not_authorized'; end if;
  update public.sms_deliveries set
    status = 'failed',
    provider_error_code = left(nullif(p_provider_error_code, ''), 40),
    provider_error_message = left(coalesce(nullif(p_provider_error_message, ''), 'Provider request failed.'), 500),
    failed_at = coalesce(failed_at, now())
  where id = p_delivery_id and status = 'pending';
end;
$$;

revoke all on function public.fail_sms_provider_submission(uuid,text,text) from public, anon, authenticated;
grant execute on function public.fail_sms_provider_submission(uuid,text,text) to service_role;
