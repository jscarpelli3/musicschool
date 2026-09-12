revoke all on function public.client_portal_email_access_state(text) from public,anon,authenticated;
grant execute on function public.client_portal_email_access_state(text) to service_role;

do $$
begin
  if has_function_privilege('anon','public.client_portal_email_access_state(text)','EXECUTE')
    or has_function_privilege('authenticated','public.client_portal_email_access_state(text)','EXECUTE')
    or not has_function_privilege('service_role','public.client_portal_email_access_state(text)','EXECUTE')
  then raise exception 'portal access-state probe remains exposed'; end if;
end;
$$;

comment on function public.client_portal_email_access_state(text) is
  'Private preflight for server-side OTP delivery decisions. Public callers receive a uniform response.';
