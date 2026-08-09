alter table public.sms_opt_in_events
  add column provider_message_sid text,
  add column messaging_service_sid text,
  add column event_fingerprint text,
  add constraint sms_opt_in_events_provider_message_sid_check check (
    provider_message_sid is null or provider_message_sid ~ '^SM[0-9a-fA-F]{32}$'
  ),
  add constraint sms_opt_in_events_messaging_service_sid_check check (
    messaging_service_sid is null or messaging_service_sid ~ '^MG[0-9a-fA-F]{32}$'
  ),
  add constraint sms_opt_in_events_event_fingerprint_check check (
    event_fingerprint is null or event_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  add constraint sms_opt_in_events_provider_message_sid_key unique (provider_message_sid),
  add constraint sms_opt_in_events_event_fingerprint_key unique (event_fingerprint);

create or replace function public.record_twilio_sms_consent_event(
  p_phone_e164 text,
  p_event_type text,
  p_provider_message_sid text,
  p_messaging_service_sid text,
  p_event_fingerprint text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'not_authorized'; end if;
  if p_phone_e164 !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'invalid_phone'; end if;
  if p_event_type not in ('opted_in','opted_out','help_requested') then raise exception 'invalid_event_type'; end if;
  if p_provider_message_sid !~ '^SM[0-9a-fA-F]{32}$'
    or p_messaging_service_sid !~ '^MG[0-9a-fA-F]{32}$'
    or p_event_fingerprint !~ '^[0-9a-f]{64}$' then raise exception 'invalid_provider_event'; end if;

  insert into public.sms_opt_in_events (
    phone_e164, full_name, school_name, event_type, source,
    provider_message_sid, messaging_service_sid, event_fingerprint,
    consent_version, consent_text, metadata
  ) values (
    p_phone_e164, 'SMS recipient', 'MusicSchool', p_event_type, 'sms_keyword',
    p_provider_message_sid, p_messaging_service_sid, p_event_fingerprint,
    'twilio-keyword-v1-2026-08-09', null,
    jsonb_build_object('program', 'MusicSchool Transactional Messages', 'provider', 'twilio')
  ) on conflict do nothing;
  if not found then return 'duplicate'; end if;
  return 'recorded';
end;
$$;

create or replace function public.get_sms_consent_state(
  p_phone_e164 text,
  p_school_name text
)
returns text
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  keyword_event text;
  school_event text;
begin
  if auth.role() <> 'service_role' then raise exception 'not_authorized'; end if;
  select event.event_type into keyword_event
  from public.sms_opt_in_events event
  where event.phone_e164 = p_phone_e164
    and event.source = 'sms_keyword'
    and event.event_type in ('opted_in','opted_out')
  order by event.occurred_at desc, event.id desc limit 1;
  if keyword_event is not null then return keyword_event; end if;

  select event.event_type into school_event
  from public.sms_opt_in_events event
  where event.phone_e164 = p_phone_e164
    and lower(trim(event.school_name)) = lower(trim(p_school_name))
    and event.event_type in ('opted_in','opted_out')
  order by event.occurred_at desc, event.id desc limit 1;
  return coalesce(school_event, 'not_enrolled');
end;
$$;

revoke all on function public.record_twilio_sms_consent_event(text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.get_sms_consent_state(text,text) from public, anon, authenticated;
grant execute on function public.record_twilio_sms_consent_event(text,text,text,text,text) to service_role;
grant execute on function public.get_sms_consent_state(text,text) to service_role;

-- The original five-minute idempotency check must be school-specific: one phone
-- may legitimately enroll with two schools on the shared platform.
create or replace function public.record_public_sms_opt_in(
  p_full_name text,
  p_phone_e164 text,
  p_school_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  canonical_version constant text := 'sms-transactional-v1-2026-08-09';
  canonical_text constant text := 'By checking this box and submitting this form, I consent to receive recurring transactional text messages from MusicSchool and the music school named above about lesson scheduling, billing approvals, payment status, reminders, and secure account access. Message frequency varies. Message and data rates may apply. Reply HELP for help or STOP to opt out. Consent is not a condition of purchase.';
  created_id uuid;
begin
  if length(trim(p_full_name)) not between 1 and 160 then raise exception 'invalid_full_name'; end if;
  if length(trim(p_school_name)) not between 1 and 160 then raise exception 'invalid_school_name'; end if;
  if p_phone_e164 !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'invalid_phone'; end if;

  perform pg_advisory_xact_lock(hashtextextended('sms-opt-in:' || p_phone_e164 || ':' || lower(trim(p_school_name)), 0));
  select event.id into created_id
  from public.sms_opt_in_events event
  where event.phone_e164 = p_phone_e164
    and lower(trim(event.school_name)) = lower(trim(p_school_name))
    and event.event_type = 'opted_in'
    and event.consent_version = canonical_version
    and event.occurred_at > now() - interval '5 minutes'
  order by event.occurred_at desc limit 1;
  if created_id is not null then return created_id; end if;

  insert into public.sms_opt_in_events (
    phone_e164, full_name, school_name, event_type, source,
    consent_version, consent_text, metadata
  ) values (
    p_phone_e164, trim(p_full_name), trim(p_school_name), 'opted_in', 'web_form',
    canonical_version, canonical_text,
    jsonb_build_object('program', 'MusicSchool Transactional Messages')
  ) returning id into created_id;
  return created_id;
end;
$$;

revoke all on function public.record_public_sms_opt_in(text,text,text) from public;
grant execute on function public.record_public_sms_opt_in(text,text,text) to anon, authenticated;
