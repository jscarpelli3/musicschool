grant select on public.billing_period_line_exclusions,public.billing_source_invoice_allocations to service_role;

do $$ begin
  if not has_table_privilege('service_role','public.billing_period_line_exclusions','SELECT')
    or not has_table_privilege('service_role','public.billing_source_invoice_allocations','SELECT')
    or has_table_privilege('service_role','public.billing_period_line_exclusions','INSERT,UPDATE,DELETE')
    or has_table_privilege('service_role','public.billing_source_invoice_allocations','INSERT,UPDATE,DELETE')
  then raise exception 'flexible_invoice_service_visibility_incorrect'; end if;
end $$;
