create table public.platform_support_incidents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  reported_by uuid not null references public.profiles(id) on delete restrict,
  kind text not null check(kind in ('email_delivery_failure')),
  failure_category text not null check(failure_category in ('temporary','configuration','recipient','suppression','unknown')),
  status text not null default 'open' check(status in ('open','acknowledged','resolved')),
  source_type text not null check(source_type in ('owner_notification_email_outbox')),
  source_id uuid not null,
  summary text not null check(length(summary) between 1 and 300),
  diagnostics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  unique(school_id,id)
);
create unique index platform_support_incidents_open_source_idx
  on public.platform_support_incidents(source_type,source_id) where status in ('open','acknowledged');
create index platform_support_incidents_status_time_idx on public.platform_support_incidents(status,created_at);
alter table public.platform_support_incidents enable row level security;
create policy platform_support_incidents_school_admin_select on public.platform_support_incidents for select to authenticated
  using(public.has_school_role(school_id,array['owner','admin']));
grant select on public.platform_support_incidents to authenticated;

create or replace function public.report_owner_notification_email_problem(p_delivery_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor_id uuid:=auth.uid(); delivery_row public.owner_notification_email_outbox%rowtype; incident_id uuid; category text;
begin
  if actor_id is null then raise exception 'not_authorized'; end if;
  select * into delivery_row from public.owner_notification_email_outbox where id=p_delivery_id;
  if not found or not public.has_school_role(delivery_row.school_id,array['owner','admin']) then raise exception 'not_authorized'; end if;
  if delivery_row.status <> 'failed' then raise exception 'delivery_not_failed'; end if;
  category:=case
    when lower(coalesce(delivery_row.provider_error_message,'')) like '%api key%invalid%' or lower(coalesce(delivery_row.provider_error_code,'')) in ('authentication_error','unauthorized') then 'configuration'
    when lower(coalesce(delivery_row.provider_error_message,'')) like '%invalid `to`%' or lower(coalesce(delivery_row.provider_error_message,'')) like '%recipient%' then 'recipient'
    when lower(coalesce(delivery_row.provider_error_code,'')) in ('rate_limit_exceeded','rate_limit_error') or lower(coalesce(delivery_row.provider_error_message,'')) ~ '(timeout|temporar|unavailable|rate limit)' then 'temporary'
    when delivery_row.status in ('bounced','complained','suppressed') then 'suppression'
    else 'unknown' end;
  select id into incident_id from public.platform_support_incidents
    where source_type='owner_notification_email_outbox' and source_id=p_delivery_id and status in ('open','acknowledged');
  if incident_id is not null then return incident_id; end if;
  insert into public.platform_support_incidents(school_id,reported_by,kind,failure_category,source_type,source_id,summary,diagnostics)
  values(delivery_row.school_id,actor_id,'email_delivery_failure',category,'owner_notification_email_outbox',p_delivery_id,
    'Owner notification email failed',jsonb_build_object(
      'approval_request_id',delivery_row.approval_request_id,'notification_id',delivery_row.notification_id,
      'provider_error_code',delivery_row.provider_error_code,'retry_count',delivery_row.retry_count,
      'failed_at',delivery_row.failed_at,'deployment_commit',nullif(nullif(current_setting('request.headers',true),'')::jsonb->>'x-vercel-git-commit-sha','')
    )) returning id into incident_id;
  insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata)
  values(delivery_row.school_id,actor_id,'platform_support.email_problem_reported','platform_support_incident',incident_id,
    jsonb_build_object('source_id',p_delivery_id,'failure_category',category));
  return incident_id;
end; $$;

revoke all on function public.report_owner_notification_email_problem(uuid) from public,anon;
grant execute on function public.report_owner_notification_email_problem(uuid) to authenticated;
