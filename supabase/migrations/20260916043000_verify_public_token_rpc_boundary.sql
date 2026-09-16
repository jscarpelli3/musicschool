do $$
declare
  signature regprocedure;
  signatures regprocedure[] := array[
    'public.get_billing_approval(text)'::regprocedure,
    'public.approve_billing_request(text)'::regprocedure,
    'public.reject_billing_request(text,text,text)'::regprocedure,
    'public.get_auto_charge_enrollment(text)'::regprocedure,
    'public.record_public_sms_opt_in(text,text,text)'::regprocedure
  ];
begin
  foreach signature in array signatures loop
    if has_function_privilege('public', signature, 'execute')
      or has_function_privilege('anon', signature, 'execute')
      or has_function_privilege('authenticated', signature, 'execute')
      or not has_function_privilege('service_role', signature, 'execute')
    then
      raise exception 'public token RPC grant boundary is incorrect: %', signature;
    end if;
  end loop;

  if exists (
    select 1
    from public.billing_approval_requests
    where token_hash = encode(
      extensions.digest('17ecf8ce-f299-49ee-955f-09922eb9bfb0', 'sha256'),
      'hex'
    )
  ) then
    raise exception 'expired plaintext demo approval token was not removed';
  end if;
end;
$$;
