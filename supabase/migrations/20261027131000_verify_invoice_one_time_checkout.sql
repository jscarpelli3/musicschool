do $$
begin
  if has_table_privilege('anon','public.invoice_checkout_requests','SELECT')
    or has_table_privilege('authenticated','public.invoice_checkout_requests','SELECT') then
    raise exception 'invoice checkout requests are directly readable';
  end if;
  if has_function_privilege('anon','public.complete_invoice_checkout_request(uuid,text,text,text,text,text)','EXECUTE')
    or has_function_privilege('authenticated','public.complete_invoice_checkout_request(uuid,text,text,text,text,text)','EXECUTE')
    or has_function_privilege('anon','public.expire_invoice_checkout_request(uuid,text,text)','EXECUTE')
    or has_function_privilege('authenticated','public.expire_invoice_checkout_request(uuid,text,text)','EXECUTE') then
    raise exception 'invoice checkout settlement functions are publicly executable';
  end if;
  if position('apply_invoice_payment_intent_event' in pg_get_functiondef('public.complete_invoice_checkout_request(uuid,text,text,text,text,text)'::regprocedure))=0 then
    raise exception 'invoice checkout completion does not use the verified invoice ledger transition';
  end if;
end $$;
