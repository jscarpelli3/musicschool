-- Payer-present lesson Checkout is orchestrated by server actions and signed
-- webhooks using the service client. Persistent branch databases do not grant
-- these privileges implicitly, so declare the smallest complete contract.

revoke all
  on table public.lesson_payment_requests
  from public, anon;

revoke insert, update, delete
  on table public.lesson_payment_requests
  from authenticated;

revoke delete
  on table public.lesson_payment_requests
  from service_role;

grant select, insert, update
  on table public.lesson_payment_requests
  to service_role;

-- Eligibility checks are read-only. Financial state may be changed only on
-- lesson_payment_requests here; provider completion remains behind the
-- service-role-only complete_lesson_payment_request function.
grant select
  on table
    public.lesson_events,
    public.lesson_event_price_snapshots,
    public.billing_account_students,
    public.billing_accounts
  to service_role;

do $$
declare
  prerequisite regclass;
begin
  if not has_table_privilege('service_role', 'public.lesson_payment_requests', 'SELECT')
    or not has_table_privilege('service_role', 'public.lesson_payment_requests', 'INSERT')
    or not has_table_privilege('service_role', 'public.lesson_payment_requests', 'UPDATE') then
    raise exception 'service_role_lesson_payment_request_privileges_missing';
  end if;

  if has_table_privilege('service_role', 'public.lesson_payment_requests', 'DELETE') then
    raise exception 'service_role_lesson_payment_request_delete_must_remain_denied';
  end if;

  foreach prerequisite in array array[
    'public.lesson_events'::regclass,
    'public.lesson_event_price_snapshots'::regclass,
    'public.billing_account_students'::regclass,
    'public.billing_accounts'::regclass,
    'public.school_payment_connections'::regclass,
    'public.service_products'::regclass
  ] loop
    if not has_table_privilege('service_role', prerequisite, 'SELECT') then
      raise exception 'service_role_lesson_quick_pay_read_missing: %', prerequisite;
    end if;
  end loop;

  if not has_table_privilege('service_role', 'public.audit_log', 'INSERT')
    or not has_sequence_privilege('service_role', 'public.audit_log_id_seq', 'USAGE')
    or not has_function_privilege(
      'service_role',
      'public.complete_lesson_payment_request(uuid,text,text,text,text,timestamptz)',
      'EXECUTE'
    ) then
    raise exception 'service_role_lesson_quick_pay_completion_contract_missing';
  end if;
end;
$$;
