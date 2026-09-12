do $$
declare trigger_count integer;
begin
  if not exists(select 1 from public.email_delivery_source_types where source_kind='billing_statement_notice' and source_table='billing_statement_notice_deliveries')
    or has_function_privilege('anon','public.prepare_billing_statement_notice(uuid,uuid,text,text,text)','EXECUTE')
    or not has_function_privilege('authenticated','public.prepare_billing_statement_notice(uuid,uuid,text,text,text)','EXECUTE')
  then raise exception 'statement notice registry or grants are incorrect'; end if;
  select count(*) into trigger_count from pg_trigger where not tgisinternal and tgname='billing_statement_notice_register_provider_identity';
  if trigger_count<>1 then raise exception 'statement notice registry trigger is missing'; end if;
  if position('advance_notice_interval_active' in pg_get_functiondef('public.get_billing_collection_readiness(uuid,uuid)'::regprocedure))=0
    or position('delivered_at' in pg_get_functiondef('public.get_billing_collection_readiness(uuid,uuid)'::regprocedure))=0
  then raise exception 'statement notice readiness gate is incomplete'; end if;
end;
$$;
