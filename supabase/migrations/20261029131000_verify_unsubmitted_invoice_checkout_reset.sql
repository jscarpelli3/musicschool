do $$
begin
  if has_function_privilege('anon','public.reset_unsubmitted_invoice_checkout_attempt(uuid,text,text)','EXECUTE')
    or has_function_privilege('authenticated','public.reset_unsubmitted_invoice_checkout_attempt(uuid,text,text)','EXECUTE') then
    raise exception 'unsubmitted Checkout reset is publicly executable';
  end if;
  if position('request_row.status <> ''open''' in pg_get_functiondef('public.reset_unsubmitted_invoice_checkout_attempt(uuid,text,text)'::regprocedure))=0
    or position('attempt_row.payment_method_id is not null' in pg_get_functiondef('public.reset_unsubmitted_invoice_checkout_attempt(uuid,text,text)'::regprocedure))=0
    or position('p_checkout_session_id' in pg_get_functiondef('public.reset_unsubmitted_invoice_checkout_attempt(uuid,text,text)'::regprocedure))=0
    or position('p_provider_account_id' in pg_get_functiondef('public.reset_unsubmitted_invoice_checkout_attempt(uuid,text,text)'::regprocedure))=0 then
    raise exception 'unsubmitted Checkout reset lost a required state or provider binding';
  end if;
end $$;
