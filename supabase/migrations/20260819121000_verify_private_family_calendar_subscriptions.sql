do $$
begin
  if has_table_privilege('anon','public.payer_calendar_subscriptions','SELECT')
    or has_table_privilege('authenticated','public.payer_calendar_subscriptions','SELECT')
  then raise exception 'Calendar subscription credentials are directly readable'; end if;

  if has_function_privilege('anon','public.get_payer_calendar_subscription(text)','EXECUTE')
    or has_function_privilege('authenticated','public.get_payer_calendar_subscription(text)','EXECUTE')
  then raise exception 'Calendar bearer lookup escaped the service role'; end if;

  if not has_function_privilege('service_role','public.get_payer_calendar_subscription(text)','EXECUTE')
  then raise exception 'Calendar route cannot resolve a subscription'; end if;

  if has_function_privilege('anon','public.rotate_client_portal_calendar_subscription(uuid)','EXECUTE')
    or not has_function_privilege('authenticated','public.rotate_client_portal_calendar_subscription(uuid)','EXECUTE')
  then raise exception 'Calendar token rotation has incorrect grants'; end if;

  if position('billing_account_students' in pg_get_functiondef('public.get_payer_calendar_subscription(text)'::regprocedure))=0
  then raise exception 'Calendar feed is not bounded through the billing account'; end if;
end;
$$;
