do $$
begin
  if has_function_privilege('anon','public.get_client_portal_collection_accounts()','EXECUTE')
    or not has_function_privilege('authenticated','public.get_client_portal_collection_accounts()','EXECUTE')
    or has_function_privilege('anon','public.revoke_client_portal_auto_charge_mandate(uuid,uuid)','EXECUTE')
    or not has_function_privilege('authenticated','public.revoke_client_portal_auto_charge_mandate(uuid,uuid)','EXECUTE')
  then
    raise exception 'client portal mandate function grants are incorrect';
  end if;

  if position('payer_portal_authorizations' in pg_get_functiondef('public.get_client_portal_collection_accounts()'::regprocedure))=0
    or position('current_client_portal_access_state' in pg_get_functiondef('public.get_client_portal_collection_accounts()'::regprocedure))=0
    or position('payer_portal_authorizations' in pg_get_functiondef('public.revoke_client_portal_auto_charge_mandate(uuid,uuid)'::regprocedure))=0
    or position('for update' in lower(pg_get_functiondef('public.revoke_client_portal_auto_charge_mandate(uuid,uuid)'::regprocedure)))=0
  then
    raise exception 'client portal mandate authority or locking guard is missing';
  end if;
end;
$$;
