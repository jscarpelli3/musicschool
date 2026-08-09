create table public.sms_opt_in_events (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  full_name text not null check (length(trim(full_name)) between 1 and 160),
  school_name text not null check (length(trim(school_name)) between 1 and 160),
  event_type text not null check (event_type in ('opted_in', 'opted_out', 'help_requested')),
  source text not null check (source in ('web_form', 'sms_keyword', 'paper', 'verbal', 'staff_recorded')),
  consent_version text,
  consent_text text,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index sms_opt_in_events_phone_time_idx on public.sms_opt_in_events(phone_e164, occurred_at desc);

alter table public.sms_opt_in_events enable row level security;

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

  perform pg_advisory_xact_lock(hashtextextended('sms-opt-in:' || p_phone_e164, 0));
  if exists (
    select 1 from public.sms_opt_in_events event
    where event.phone_e164 = p_phone_e164
      and event.event_type = 'opted_in'
      and event.consent_version = canonical_version
      and event.occurred_at > now() - interval '5 minutes'
  ) then
    select event.id into created_id
    from public.sms_opt_in_events event
    where event.phone_e164 = p_phone_e164
      and event.event_type = 'opted_in'
      and event.consent_version = canonical_version
    order by event.occurred_at desc limit 1;
    return created_id;
  end if;

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

revoke all on table public.sms_opt_in_events from public, anon, authenticated;
revoke all on function public.record_public_sms_opt_in(text,text,text) from public;
grant execute on function public.record_public_sms_opt_in(text,text,text) to anon, authenticated;

comment on table public.sms_opt_in_events is
  'Append-only evidence for SMS enrollment, opt-out, and help events. Public callers can record only canonical web-form opt-in through the constrained function.';
