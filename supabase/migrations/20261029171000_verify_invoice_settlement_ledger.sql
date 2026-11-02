do $$ begin
  if not exists(select 1 from pg_class where relnamespace='public'::regnamespace and relname='invoice_settlement_entries' and relrowsecurity) then raise exception 'invoice settlement RLS missing'; end if;
  if has_table_privilege('authenticated','public.invoice_settlement_entries','INSERT') or has_table_privilege('authenticated','public.invoice_settlement_entries','UPDATE') or has_table_privilege('authenticated','public.invoice_settlement_entries','DELETE') then raise exception 'invoice settlement mutation exposed'; end if;
  if not has_function_privilege('service_role','public.record_invoice_settlement_entry(uuid,uuid,uuid,text,text,bigint,timestamptz,text,text,uuid,uuid)','EXECUTE') then raise exception 'service role settlement function missing'; end if;
  if not has_function_privilege('service_role','public.apply_invoice_refund_event(uuid,text,text,text,text,text)','EXECUTE') then raise exception 'service role refund reconciliation missing'; end if;
  if not exists(select 1 from pg_trigger where tgname='payment_attempts_block_manual_settlement' and not tgisinternal) then raise exception 'manual settlement collection guard missing'; end if;
end $$;
