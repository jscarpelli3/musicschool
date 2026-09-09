do $$
begin
  if exists(select 1 from public.billing_line_items where charge_category_code is null)
    or exists(select 1 from public.billing_collection_mandates where cardinality(permitted_charge_categories)=0)
  then raise exception 'billing category backfill is incomplete'; end if;
  if has_function_privilege('anon','public.get_billing_collection_readiness(uuid,uuid)','EXECUTE')
    or not has_function_privilege('authenticated','public.get_billing_collection_readiness(uuid,uuid)','EXECUTE')
  then raise exception 'collection readiness grants are incorrect'; end if;
  if position('permitted_charge_categories' in pg_get_functiondef('public.get_billing_collection_readiness(uuid,uuid)'::regprocedure))=0
    or position('mandate_cap_exceeded' in pg_get_functiondef('public.get_billing_collection_readiness(uuid,uuid)'::regprocedure))=0
    or position('advance_notice_required' in pg_get_functiondef('public.get_billing_collection_readiness(uuid,uuid)'::regprocedure))=0
  then raise exception 'collection readiness contract is incomplete'; end if;
end;
$$;
