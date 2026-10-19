do $$
declare prepare_definition text; remove_definition text;
begin
  if exists(
    select 1 from pg_constraint
    where conrelid='public.billing_periods'::regclass
      and contype='u' and pg_get_constraintdef(oid) ilike '%billing_account_id%period_start%period_end%'
  ) then raise exception 'legacy_one_invoice_per_month_constraint_remains'; end if;

  if not exists(select 1 from pg_indexes where schemaname='public' and indexname='billing_periods_one_editable_month'
    and indexdef ilike '%where%status%') then raise exception 'editable_invoice_month_guard_missing'; end if;
  if not exists(select 1 from pg_indexes where schemaname='public' and tablename='billing_source_invoice_allocations'
    and indexdef ilike '%school_id%source_type%source_id%') then raise exception 'source_allocation_unique_guard_missing'; end if;
  if not exists(select 1 from pg_trigger where tgrelid='public.billing_periods'::regclass and tgname='billing_periods_sync_source_allocations' and not tgisinternal)
    then raise exception 'source_allocation_trigger_missing'; end if;

  prepare_definition:=pg_get_functiondef('public.prepare_family_billing_draft(uuid,uuid,date)'::regprocedure);
  remove_definition:=pg_get_functiondef('public.remove_source_from_billing_draft(uuid,uuid,uuid,text)'::regprocedure);
  if prepare_definition not ilike '%billing_period_line_exclusions%'
    or prepare_definition not ilike '%billing_source_invoice_allocations%'
    or prepare_definition not ilike '%status in (''draft'',''review'')%'
    then raise exception 'draft_generator_missing_flexible_batching_guards'; end if;
  if remove_definition not ilike '%billing_period_is_not_editable%'
    or remove_definition not ilike '%billing_period.source_deferred%'
    then raise exception 'draft_source_removal_contract_missing'; end if;

  if has_table_privilege('anon','public.billing_period_line_exclusions','SELECT')
    or has_table_privilege('anon','public.billing_source_invoice_allocations','SELECT')
    or has_table_privilege('authenticated','public.billing_period_line_exclusions','INSERT,UPDATE,DELETE')
    or has_table_privilege('authenticated','public.billing_source_invoice_allocations','INSERT,UPDATE,DELETE')
    then raise exception 'flexible_invoice_table_grants_too_broad'; end if;
  if has_function_privilege('anon','public.remove_source_from_billing_draft(uuid,uuid,uuid,text)','EXECUTE')
    or not has_function_privilege('authenticated','public.remove_source_from_billing_draft(uuid,uuid,uuid,text)','EXECUTE')
    then raise exception 'draft_source_removal_grants_incorrect'; end if;
end $$;
