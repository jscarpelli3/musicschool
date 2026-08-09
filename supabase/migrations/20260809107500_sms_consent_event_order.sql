alter table public.sms_opt_in_events
  add column event_sequence bigint generated always as identity;

create unique index sms_opt_in_events_sequence_idx
  on public.sms_opt_in_events(event_sequence);

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
  order by event.event_sequence desc limit 1;
  if keyword_event is not null then return keyword_event; end if;

  select event.event_type into school_event
  from public.sms_opt_in_events event
  where event.phone_e164 = p_phone_e164
    and lower(trim(event.school_name)) = lower(trim(p_school_name))
    and event.event_type in ('opted_in','opted_out')
  order by event.event_sequence desc limit 1;
  return coalesce(school_event, 'not_enrolled');
end;
$$;

revoke all on function public.get_sms_consent_state(text,text) from public, anon, authenticated;
grant execute on function public.get_sms_consent_state(text,text) to service_role;
