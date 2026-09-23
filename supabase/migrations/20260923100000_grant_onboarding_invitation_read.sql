-- Invitation validation and setup prefill run only through the server-side
-- Supabase secret client. Browser roles must not be able to enumerate invites.
revoke all on table public.school_onboarding_invitations from public, anon, authenticated;
grant select on table public.school_onboarding_invitations to service_role;

do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.school_onboarding_invitations'::regclass)
    or not has_table_privilege('service_role', 'public.school_onboarding_invitations', 'SELECT')
    or has_table_privilege('anon', 'public.school_onboarding_invitations', 'SELECT')
    or has_table_privilege('authenticated', 'public.school_onboarding_invitations', 'SELECT') then
    raise exception 'onboarding_invitation_read_grants_incorrect';
  end if;
end;
$$;
