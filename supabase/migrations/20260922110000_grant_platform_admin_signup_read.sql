-- The platform-admin page reads launch-interest records with the server-only
-- Supabase secret key. Make that boundary explicit without exposing the table
-- to browser roles.
revoke all on table public.early_access_signups from public, anon, authenticated;
grant select on table public.early_access_signups to service_role;

do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.early_access_signups'::regclass)
    or not has_table_privilege('service_role', 'public.early_access_signups', 'SELECT')
    or has_table_privilege('anon', 'public.early_access_signups', 'SELECT')
    or has_table_privilege('authenticated', 'public.early_access_signups', 'SELECT') then
    raise exception 'platform_admin_signup_read_grants_incorrect';
  end if;
end;
$$;
