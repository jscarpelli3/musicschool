do $$
declare
  first_id uuid;
  repeated_id uuid;
begin
  begin
    first_id := public.record_public_sms_opt_in('SMS Verification', '+15555550199', 'MusicSchool Test');
    repeated_id := public.record_public_sms_opt_in('SMS Verification', '+15555550199', 'MusicSchool Test');
    if first_id <> repeated_id then raise exception 'Rapid duplicate SMS opt-in created another event'; end if;
    if not exists (
      select 1 from public.sms_opt_in_events event
      where event.id = first_id
        and event.event_type = 'opted_in'
        and event.source = 'web_form'
        and event.consent_version = 'sms-transactional-v1-2026-08-09'
        and event.consent_text like 'By checking this box%'
    ) then raise exception 'Canonical SMS consent evidence was not recorded'; end if;
    if (select count(*) from public.sms_opt_in_events where phone_e164 = '+15555550199') <> 1 then
      raise exception 'SMS opt-in idempotency failed';
    end if;
    raise exception using errcode = 'P0001', message = 'public_sms_opt_in_verification_rollback';
  exception when raise_exception then
    if sqlerrm <> 'public_sms_opt_in_verification_rollback' then raise; end if;
  end;
end;
$$;
