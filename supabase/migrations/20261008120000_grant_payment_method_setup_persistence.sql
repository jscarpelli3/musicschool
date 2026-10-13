-- Saved-card setup is orchestrated by server actions and Stripe webhooks using
-- the service client. Persistent branch databases do not grant these table
-- privileges implicitly, so declare the smallest complete workflow contract.

grant select
  on table
    public.schools,
    public.billing_accounts,
    public.people,
    public.school_payment_connections
  to service_role;

revoke delete
  on table
    public.billing_provider_customers,
    public.payment_method_setup_requests
  from service_role;

grant select, insert, update
  on table
    public.billing_provider_customers,
    public.payment_method_setup_requests
  to service_role;

grant insert
  on table public.audit_log
  to service_role;

grant usage, select
  on sequence public.audit_log_id_seq
  to service_role;

do $$
declare
  prerequisite regclass;
begin
  foreach prerequisite in array array[
    'public.schools'::regclass,
    'public.billing_accounts'::regclass,
    'public.people'::regclass,
    'public.school_payment_connections'::regclass
  ] loop
    if not has_table_privilege('service_role', prerequisite, 'SELECT') then
      raise exception 'service_role_payment_method_setup_read_missing: %', prerequisite;
    end if;
  end loop;

  foreach prerequisite in array array[
    'public.billing_provider_customers'::regclass,
    'public.payment_method_setup_requests'::regclass
  ] loop
    if not has_table_privilege('service_role', prerequisite, 'SELECT')
      or not has_table_privilege('service_role', prerequisite, 'INSERT')
      or not has_table_privilege('service_role', prerequisite, 'UPDATE') then
      raise exception 'service_role_payment_method_setup_persistence_missing: %', prerequisite;
    end if;

    if has_table_privilege('service_role', prerequisite, 'DELETE') then
      raise exception 'service_role_payment_method_setup_delete_must_remain_denied: %', prerequisite;
    end if;
  end loop;

  if not has_table_privilege('service_role', 'public.audit_log', 'INSERT')
    or not has_sequence_privilege('service_role', 'public.audit_log_id_seq', 'USAGE')
    or not has_function_privilege(
      'service_role',
      'public.complete_payment_method_setup(uuid,text,text,text,text,text,text,text,smallint,smallint,timestamptz,jsonb)',
      'EXECUTE'
    ) then
    raise exception 'service_role_payment_method_setup_completion_contract_missing';
  end if;
end;
$$;
