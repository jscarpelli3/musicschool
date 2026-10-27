do $$
declare approve_signature regprocedure:='public.approve_client_portal_billing_request(uuid,uuid)'::regprocedure; reject_signature regprocedure:='public.reject_client_portal_billing_request(uuid,uuid,text,text)'::regprocedure;
begin
  if has_function_privilege('anon',approve_signature,'execute') or not has_function_privilege('authenticated',approve_signature,'execute')
    or has_function_privilege('anon',reject_signature,'execute') or not has_function_privilege('authenticated',reject_signature,'execute') then raise exception 'portal invoice decision grants are incorrect'; end if;
  if position('payer_portal_authorizations' in pg_get_functiondef(approve_signature))=0 or position('current_client_portal_access_state' in pg_get_functiondef(approve_signature))=0
    or position('amount_due_cents=request_row.amount_cents' in pg_get_functiondef(approve_signature))=0
    or position('payer_portal_authorizations' in pg_get_functiondef(reject_signature))=0 or position('current_client_portal_access_state' in pg_get_functiondef(reject_signature))=0
    or position('amount_due_cents=request_row.amount_cents' in pg_get_functiondef(reject_signature))=0 then raise exception 'portal invoice decision boundary is incomplete'; end if;
end; $$;
