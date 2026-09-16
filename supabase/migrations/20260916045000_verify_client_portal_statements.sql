do $$
declare signature regprocedure := 'public.get_client_portal_statements()'::regprocedure;
begin
  if has_function_privilege('public',signature,'execute')
    or has_function_privilege('anon',signature,'execute')
    or not has_function_privilege('authenticated',signature,'execute')
  then raise exception 'client portal statement grants are incorrect'; end if;

  if position('payer_portal_authorizations' in pg_get_functiondef(signature))=0
    or position('current_client_portal_access_state' in pg_get_functiondef(signature))=0
    or position('billing_line_items' in pg_get_functiondef(signature))=0
    or position('approval_pending' in pg_get_functiondef(signature))=0
    or position('payment_failed' in pg_get_functiondef(signature))=0
  then raise exception 'client portal statement boundary is incomplete'; end if;
end;
$$;
