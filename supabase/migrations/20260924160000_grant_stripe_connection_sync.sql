-- Stripe account synchronization is performed only by the server-side
-- service client. New branch databases do not implicitly grant table access
-- to service_role, so make the narrow persistence contract explicit.

revoke delete
  on table public.school_payment_connections
  from service_role;

grant select, insert, update
  on table public.school_payment_connections
  to service_role;

grant insert
  on table public.audit_log
  to service_role;

grant usage, select
  on sequence public.audit_log_id_seq
  to service_role;

do $$
begin
  if not has_table_privilege('service_role', 'public.school_payment_connections', 'SELECT')
    or not has_table_privilege('service_role', 'public.school_payment_connections', 'INSERT')
    or not has_table_privilege('service_role', 'public.school_payment_connections', 'UPDATE') then
    raise exception 'service_role_stripe_connection_sync_privileges_missing';
  end if;

  if has_table_privilege('service_role', 'public.school_payment_connections', 'DELETE') then
    raise exception 'service_role_stripe_connection_delete_must_remain_denied';
  end if;

  if not has_table_privilege('service_role', 'public.audit_log', 'INSERT')
    or not has_sequence_privilege('service_role', 'public.audit_log_id_seq', 'USAGE') then
    raise exception 'service_role_stripe_connection_audit_privileges_missing';
  end if;
end;
$$;
