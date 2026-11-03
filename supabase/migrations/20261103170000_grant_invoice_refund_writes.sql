grant select, insert, update on table public.payment_refunds to service_role;

do $$
begin
  if not has_table_privilege('service_role', 'public.payment_refunds', 'SELECT')
    or not has_table_privilege('service_role', 'public.payment_refunds', 'INSERT')
    or not has_table_privilege('service_role', 'public.payment_refunds', 'UPDATE')
  then
    raise exception 'service_role_invoice_refund_privileges_incorrect';
  end if;
end
$$;
