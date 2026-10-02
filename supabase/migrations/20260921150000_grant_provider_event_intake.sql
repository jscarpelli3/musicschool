-- Webhook intake uses a server-only Supabase secret key. Branch databases can
-- differ in default table grants, so make this boundary explicit.
revoke all on table public.payment_provider_events from public, anon, authenticated;
grant select, insert, update on table public.payment_provider_events to service_role;

do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.payment_provider_events'::regclass)
    or not has_table_privilege('service_role', 'public.payment_provider_events', 'SELECT')
    or not has_table_privilege('service_role', 'public.payment_provider_events', 'INSERT')
    or not has_table_privilege('service_role', 'public.payment_provider_events', 'UPDATE')
    or has_table_privilege('anon', 'public.payment_provider_events', 'SELECT')
    or has_table_privilege('anon', 'public.payment_provider_events', 'INSERT')
    or has_table_privilege('anon', 'public.payment_provider_events', 'UPDATE')
    or has_table_privilege('authenticated', 'public.payment_provider_events', 'SELECT')
    or has_table_privilege('authenticated', 'public.payment_provider_events', 'INSERT')
    or has_table_privilege('authenticated', 'public.payment_provider_events', 'UPDATE') then
    raise exception 'provider_event_intake_grants_incorrect';
  end if;
end;
$$;
