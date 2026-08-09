do $$
declare
  phone constant text := '+15555550298';
  first_id uuid;
  second_id uuid;
  result text;
begin
  begin
    first_id := public.record_public_sms_opt_in('Consent Test', phone, 'Verification School A');
    second_id := public.record_public_sms_opt_in('Consent Test', phone, 'Verification School B');
    if first_id = second_id then raise exception 'School-specific opt-ins were incorrectly deduplicated'; end if;

    perform set_config('request.jwt.claim.role', 'service_role', true);
    if public.get_sms_consent_state(phone, 'Verification School A') <> 'opted_in' then
      raise exception 'Web consent was not recognized';
    end if;

    result := public.record_twilio_sms_consent_event(
      phone, 'opted_out', 'SM' || repeat('6', 32), 'MG' || repeat('7', 32), repeat('8', 64)
    );
    if result <> 'recorded' then raise exception 'STOP was not recorded'; end if;
    if public.get_sms_consent_state(phone, 'Verification School A') <> 'opted_out'
      or public.get_sms_consent_state(phone, 'Verification School B') <> 'opted_out' then
      raise exception 'STOP did not block the shared messaging program globally';
    end if;
    result := public.record_twilio_sms_consent_event(
      phone, 'help_requested', 'SM' || repeat('9', 32), 'MG' || repeat('7', 32), repeat('a', 64)
    );
    if public.get_sms_consent_state(phone, 'Verification School A') <> 'opted_out' then
      raise exception 'HELP incorrectly changed consent state';
    end if;
    result := public.record_twilio_sms_consent_event(
      phone, 'opted_in', 'SM' || repeat('b', 32), 'MG' || repeat('7', 32), repeat('c', 64)
    );
    if public.get_sms_consent_state(phone, 'Verification School A') <> 'opted_in' then
      raise exception 'START did not restore consent';
    end if;
    result := public.record_twilio_sms_consent_event(
      phone, 'opted_in', 'SM' || repeat('b', 32), 'MG' || repeat('7', 32), repeat('c', 64)
    );
    if result <> 'duplicate' then raise exception 'Inbound keyword replay was not idempotent'; end if;

    raise exception using errcode = 'P0001', message = 'sms_keyword_consent_verification_rollback';
  exception when raise_exception then
    if sqlerrm <> 'sms_keyword_consent_verification_rollback' then raise; end if;
  end;
end;
$$;
