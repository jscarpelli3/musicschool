do $$
begin
  if has_function_privilege('anon','public.list_due_billing_approval_reminders()','EXECUTE')
    or has_function_privilege('authenticated','public.list_due_billing_approval_reminders()','EXECUTE')
    or not has_function_privilege('service_role','public.list_due_billing_approval_reminders()','EXECUTE')
    or has_function_privilege('anon','public.prepare_billing_approval_reminder(uuid,text,text,timestamptz,text,text,text)','EXECUTE')
    or has_function_privilege('authenticated','public.prepare_billing_approval_reminder(uuid,text,text,timestamptz,text,text,text)','EXECUTE')
    or not has_function_privilege('service_role','public.prepare_billing_approval_reminder(uuid,text,text,timestamptz,text,text,text)','EXECUTE') then
    raise exception 'billing reminder service boundary is invalid';
  end if;
  if position('interval ''7 days''' in pg_get_functiondef('public.prepare_billing_approval_reminder(uuid,text,text,timestamptz,text,text,text)'::regprocedure))=0
    or position('email_suppressions' in pg_get_functiondef('public.prepare_billing_approval_reminder(uuid,text,text,timestamptz,text,text,text)'::regprocedure))=0 then
    raise exception 'billing reminder throttle or suppression guard is missing';
  end if;
end $$;
