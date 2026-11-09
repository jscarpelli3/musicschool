create table public.platform_incidents(
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null unique check(length(fingerprint) between 8 and 240),
  provider text not null check(provider in('application','stripe','resend','twilio','supabase')),
  severity text not null check(severity in('info','warning','urgent')),
  status text not null default 'open' check(status in('open','acknowledged','resolved')),
  title text not null check(length(title) between 3 and 160),
  summary text not null check(length(summary) between 3 and 1000),
  source_kind text not null check(length(source_kind) between 2 and 100),
  source_id text check(source_id is null or length(source_id)<=240),
  school_id uuid references public.schools(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(metadata)='object'),
  occurrence_count integer not null default 1 check(occurrence_count>0),
  alert_cycle integer not null default 1 check(alert_cycle>0),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index platform_incidents_status_severity_idx on public.platform_incidents(status,severity,last_seen_at desc);
create index platform_incidents_school_idx on public.platform_incidents(school_id,last_seen_at desc) where school_id is not null;

create table public.platform_incident_alert_deliveries(
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.platform_incidents(id) on delete cascade,
  alert_cycle integer not null check(alert_cycle>0),
  recipient_profile_id uuid references public.profiles(id) on delete set null,
  recipient_email text not null check(recipient_email=lower(trim(recipient_email)) and length(recipient_email)<=320),
  status text not null default 'pending' check(status in('pending','accepted','failed','reconciliation_required')),
  attempt_count integer not null default 0 check(attempt_count>=0),
  provider_email_id text,
  last_error_code text check(last_error_code is null or length(last_error_code)<=120),
  last_attempted_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(incident_id,alert_cycle,recipient_email)
);
create index platform_incident_alert_pending_idx on public.platform_incident_alert_deliveries(status,updated_at);

create trigger platform_incidents_set_updated_at before update on public.platform_incidents
for each row execute function public.set_updated_at();
create trigger platform_incident_alert_deliveries_set_updated_at before update on public.platform_incident_alert_deliveries
for each row execute function public.set_updated_at();

alter table public.platform_incidents enable row level security;
alter table public.platform_incident_alert_deliveries enable row level security;
revoke all on public.platform_incidents,public.platform_incident_alert_deliveries from public,anon,authenticated;

create or replace function public.record_platform_incident(
  p_fingerprint text,p_provider text,p_severity text,p_title text,p_summary text,
  p_source_kind text,p_source_id text default null,p_school_id uuid default null,p_metadata jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare incident_id uuid;
begin
  if auth.role()<>'service_role' then raise exception 'not_authorized'; end if;
  if length(trim(p_fingerprint)) not between 8 and 240
    or p_provider not in('application','stripe','resend','twilio','supabase')
    or p_severity not in('info','warning','urgent')
    or length(trim(p_title)) not between 3 and 160
    or length(trim(p_summary)) not between 3 and 1000
    or length(trim(p_source_kind)) not between 2 and 100
    or jsonb_typeof(coalesce(p_metadata,'{}'::jsonb))<>'object'
  then raise exception 'invalid_platform_incident'; end if;

  insert into public.platform_incidents(
    fingerprint,provider,severity,title,summary,source_kind,source_id,school_id,metadata
  ) values(
    trim(p_fingerprint),p_provider,p_severity,trim(p_title),trim(p_summary),trim(p_source_kind),nullif(trim(p_source_id),''),p_school_id,coalesce(p_metadata,'{}'::jsonb)
  ) on conflict(fingerprint) do update set
    provider=excluded.provider,
    severity=case
      when public.platform_incidents.severity='urgent' or excluded.severity='urgent' then 'urgent'
      when public.platform_incidents.severity='warning' or excluded.severity='warning' then 'warning'
      else 'info' end,
    status=case when public.platform_incidents.status='resolved' then 'open' else public.platform_incidents.status end,
    title=excluded.title,summary=excluded.summary,source_kind=excluded.source_kind,
    source_id=coalesce(excluded.source_id,public.platform_incidents.source_id),
    school_id=coalesce(excluded.school_id,public.platform_incidents.school_id),
    metadata=excluded.metadata,
    occurrence_count=public.platform_incidents.occurrence_count+1,
    alert_cycle=public.platform_incidents.alert_cycle+case when public.platform_incidents.status='resolved' then 1 else 0 end,
    last_seen_at=now(),
    acknowledged_at=case when public.platform_incidents.status='resolved' then null else public.platform_incidents.acknowledged_at end,
    acknowledged_by=case when public.platform_incidents.status='resolved' then null else public.platform_incidents.acknowledged_by end,
    resolved_at=null,resolved_by=null
  returning id into incident_id;
  return incident_id;
end $$;
revoke all on function public.record_platform_incident(text,text,text,text,text,text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.record_platform_incident(text,text,text,text,text,text,text,uuid,jsonb) to service_role;

create or replace function public.change_platform_incident_status(p_incident_id uuid,p_status text)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
  if actor is null or not exists(select 1 from public.platform_admins where profile_id=actor and status='active') then raise exception 'not_authorized'; end if;
  if p_status not in('open','acknowledged','resolved') then raise exception 'invalid_incident_status'; end if;
  update public.platform_incidents set status=p_status,
    acknowledged_at=case when p_status='acknowledged' then now() when p_status='open' then null else acknowledged_at end,
    acknowledged_by=case when p_status='acknowledged' then actor when p_status='open' then null else acknowledged_by end,
    resolved_at=case when p_status='resolved' then now() else null end,
    resolved_by=case when p_status='resolved' then actor else null end
  where id=p_incident_id;
  if not found then raise exception 'incident_not_found'; end if;
end $$;
revoke all on function public.change_platform_incident_status(uuid,text) from public,anon;
grant execute on function public.change_platform_incident_status(uuid,text) to authenticated;

create or replace function public.scan_platform_health_incidents()
returns integer language plpgsql security definer set search_path='' as $$
declare source record; incident_count integer:=0;
begin
  if auth.role()<>'service_role' then raise exception 'not_authorized'; end if;

  for source in select id,provider_event_id,event_type,processing_status,processing_attempts,last_error,received_at
    from public.payment_provider_events
    where received_at>=now()-interval '24 hours' and (
      processing_status='failed' or processing_status in('received','processing') and received_at<now()-interval '10 minutes'
    )
  loop
    perform public.record_platform_incident(
      'stripe-event:'||source.id::text,'stripe','urgent','Stripe webhook needs attention',
      case when source.processing_status='failed' then 'A Stripe webhook failed during local processing.' else 'A Stripe webhook has remained unprocessed beyond the recovery window.' end,
      'payment_provider_event',source.id::text,null,
      jsonb_build_object('event_type',source.event_type,'processing_status',source.processing_status,'attempts',source.processing_attempts)
    ); incident_count:=incident_count+1;
  end loop;

  for source in select id,school_id,source_kind,status from public.email_delivery_registry
    where updated_at>=now()-interval '24 hours' and status in('failed','bounced','complained','suppressed')
  loop
    perform public.record_platform_incident(
      'resend-delivery:'||source.id::text,'resend',case when source.status='complained' then 'urgent' else 'warning' end,
      'Email delivery issue','A transactional email reached a terminal provider state.',
      'email_delivery_registry',source.id::text,source.school_id,
      jsonb_build_object('source_kind',source.source_kind,'delivery_status',source.status)
    ); incident_count:=incident_count+1;
  end loop;

  for source in select id,school_id,status,provider_error_code from public.sms_deliveries
    where updated_at>=now()-interval '24 hours' and status in('failed','undelivered')
  loop
    perform public.record_platform_incident(
      'twilio-delivery:'||source.id::text,'twilio','warning','SMS delivery issue',
      'A transactional text message reached a terminal provider state.',
      'sms_delivery',source.id::text,source.school_id,
      jsonb_build_object('delivery_status',source.status,'provider_error_code',source.provider_error_code)
    ); incident_count:=incident_count+1;
  end loop;

  for source in
    select id,school_id,'owner_notification_email'::text as source_kind from public.owner_notification_email_outbox where status='reconciliation_required' and updated_at>=now()-interval '7 days'
    union all select id,school_id,'lesson_request_email' from public.lesson_request_email_outbox where status='reconciliation_required' and updated_at>=now()-interval '7 days'
    union all select id,school_id,'lesson_created_email' from public.lesson_created_email_outbox where status='reconciliation_required' and updated_at>=now()-interval '7 days'
    union all select id,school_id,'billing_statement_notice' from public.billing_statement_notice_deliveries where status='reconciliation_required' and updated_at>=now()-interval '7 days'
  loop
    perform public.record_platform_incident(
      'resend-reconciliation:'||source.source_kind||':'||source.id::text,'resend','urgent',
      'Email outcome requires reconciliation','Resend may have accepted an email that Common Time could not finalize locally. Do not retry until reviewed.',
      source.source_kind,source.id::text,source.school_id,'{}'::jsonb
    ); incident_count:=incident_count+1;
  end loop;
  return incident_count;
end $$;
revoke all on function public.scan_platform_health_incidents() from public,anon,authenticated;
grant execute on function public.scan_platform_health_incidents() to service_role;

comment on table public.platform_incidents is 'Deduplicated, privacy-minimized operational incidents for Common Time platform administrators.';
comment on table public.platform_incident_alert_deliveries is 'Durable super-admin email-alert attempts for urgent platform incidents.';
