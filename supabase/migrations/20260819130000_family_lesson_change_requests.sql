alter table public.cancellation_policy_rules
  add column timely_request_guidance text not null default 'Requests made within the cancellation period are normally approved.'
    check (length(trim(timely_request_guidance)) between 1 and 1000),
  add column late_request_guidance text not null default 'Requests outside the cancellation period may still be approved, but the lesson may be counted as serviced.'
    check (length(trim(late_request_guidance)) between 1 and 1000);

create table public.lesson_change_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  billing_account_id uuid not null,
  lesson_event_id uuid not null,
  request_type text not null check (request_type in ('cancellation','reschedule')),
  requested_resolution text not null check (requested_resolution in ('cancel','reschedule','lesson_credit')),
  status text not null default 'pending' check (status in ('pending','in_progress','approved','declined','withdrawn','superseded')),
  requester_auth_user_id uuid not null,
  requester_email text not null,
  requested_at timestamptz not null default now(),
  policy_version_id uuid not null references public.school_policy_versions(id) on delete restrict,
  cutoff_hours integer not null check (cutoff_hours between 0 and 8760),
  within_policy_window boolean not null,
  policy_disposition text not null,
  policy_guidance text not null check (length(trim(policy_guidance)) between 1 and 1000),
  lesson_starts_at_snapshot timestamptz not null,
  accounting_state text not null check (accounting_state in ('unaccounted','draft','locked','approved','paid')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id,id),
  foreign key (school_id,billing_account_id) references public.billing_accounts(school_id,id) on delete restrict,
  foreign key (school_id,lesson_event_id) references public.lesson_events(school_id,id) on delete restrict
);
create unique index lesson_change_requests_one_pending_type
  on public.lesson_change_requests(lesson_event_id,request_type) where status in ('pending','in_progress');
create index lesson_change_requests_school_queue on public.lesson_change_requests(school_id,status,requested_at);
alter table public.lesson_change_requests enable row level security;
revoke all on table public.lesson_change_requests from public,anon,authenticated;

create table public.lesson_request_email_outbox (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  request_id uuid not null,
  recipient_kind text not null check (recipient_kind in ('requester','owner','admin','teacher')),
  recipient_email text not null,
  subject text not null,
  message_text text not null,
  idempotency_key text not null unique,
  status text not null default 'pending' check (status in ('pending','accepted','sent','delivered','delayed','failed','bounced','complained','suppressed')),
  provider_email_id text unique,
  provider_error_code text,
  provider_error_message text,
  accepted_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (school_id,request_id) references public.lesson_change_requests(school_id,id) on delete restrict
);
create index lesson_request_email_outbox_status_idx on public.lesson_request_email_outbox(status,created_at);
alter table public.lesson_request_email_outbox enable row level security;
revoke all on table public.lesson_request_email_outbox from public,anon,authenticated;

comment on table public.lesson_change_requests is 'Immutable-at-submission family requests; creating one never changes a lesson, billing period, payment, credit, or entitlement.';

alter table public.owner_notifications drop constraint owner_notifications_kind_check;
alter table public.owner_notifications add constraint owner_notifications_kind_check
  check (kind in ('payer_approved','payer_rejected','payment_failed','lesson_change_requested'));

create or replace function public.preview_client_lesson_change_request(p_lesson_event_id uuid,p_request_type text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare event_row record; policy_row record; cutoff integer; within_window boolean; accounting text;
begin
  if auth.role()<>'authenticated' or public.current_client_portal_access_state()<>'ready'
    or p_request_type not in ('cancellation','reschedule') then raise exception 'portal_access_denied' using errcode='42501'; end if;
  select event.*,mapping.billing_account_id into event_row
  from public.lesson_events event
  join public.billing_account_students mapping on mapping.school_id=event.school_id and mapping.student_id=event.student_id
  join public.payer_portal_authorizations portal_auth on portal_auth.school_id=mapping.school_id and portal_auth.billing_account_id=mapping.billing_account_id
  where event.id=p_lesson_event_id and event.status='scheduled'
    and portal_auth.normalized_email=lower(nullif(trim(auth.jwt()->>'email'),''));
  if not found then raise exception 'lesson_not_available' using errcode='42501'; end if;

  select version.id,rules.student_cancel_cutoff_hours,rules.student_reschedule_cutoff_hours,
    rules.timely_cancel_disposition,rules.late_cancel_disposition,rules.timely_request_guidance,rules.late_request_guidance
  into policy_row from public.school_policies policy
  join public.school_policy_versions version on version.school_id=policy.school_id and version.policy_id=policy.id
  join public.cancellation_policy_rules rules on rules.policy_version_id=version.id
  where policy.school_id=event_row.school_id and policy.kind='cancellation' and policy.status='active'
    and policy.id=coalesce((select selection.policy_id from public.service_product_policy_selections selection
      where selection.school_id=event_row.school_id and selection.product_id=event_row.product_id
        and selection.policy_kind='cancellation' and not selection.use_school_default),
      (select default_policy.id from public.school_policies default_policy where default_policy.school_id=event_row.school_id
        and default_policy.kind='cancellation' and default_policy.status='active' and default_policy.is_default))
    and version.published_at is not null and coalesce(version.effective_from,version.published_at)<=event_row.starts_at
  order by coalesce(version.effective_from,version.published_at) desc,version.version_number desc limit 1;
  if not found then raise exception 'published_cancellation_policy_required'; end if;
  cutoff:=case when p_request_type='cancellation' then policy_row.student_cancel_cutoff_hours else policy_row.student_reschedule_cutoff_hours end;
  within_window:=now()<=event_row.starts_at-(cutoff*interval '1 hour');
  select case
    when bool_or(period.status='paid') then 'paid'
    when bool_or(period.status in ('approved','collecting','payment_failed')) then 'approved'
    when bool_or(period.status in ('locked','approval_pending')) then 'locked'
    when bool_or(period.status in ('draft','review')) then 'draft'
    else 'unaccounted' end into accounting
  from public.billing_line_items item join public.billing_periods period on period.id=item.billing_period_id
  where item.school_id=event_row.school_id and item.source_type='lesson' and item.source_id=event_row.id;
  return jsonb_build_object('lesson_id',event_row.id,'school_id',event_row.school_id,'billing_account_id',event_row.billing_account_id,
    'request_type',p_request_type,'lesson_starts_at',event_row.starts_at,'policy_version_id',policy_row.id,
    'cutoff_hours',cutoff,'within_policy_window',within_window,
    'policy_disposition',case when within_window then policy_row.timely_cancel_disposition else policy_row.late_cancel_disposition end,
    'policy_guidance',case when within_window then policy_row.timely_request_guidance else policy_row.late_request_guidance end,
    'accounting_state',coalesce(accounting,'unaccounted'));
end; $$;

create or replace function public.submit_client_lesson_change_request(p_lesson_event_id uuid,p_request_type text,p_requested_resolution text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare preview jsonb; request_row public.lesson_change_requests%rowtype; existing_id uuid; recipient record; notice_id uuid; title_text text; message text;
begin
  if (p_request_type='cancellation' and p_requested_resolution not in ('cancel','reschedule','lesson_credit'))
    or (p_request_type='reschedule' and p_requested_resolution<>'reschedule') then raise exception 'invalid_resolution'; end if;
  preview:=public.preview_client_lesson_change_request(p_lesson_event_id,p_request_type);
  select id into existing_id from public.lesson_change_requests where lesson_event_id=p_lesson_event_id
    and request_type=p_request_type and status in ('pending','in_progress');
  if existing_id is not null then return jsonb_build_object('request_id',existing_id,'result','already_pending'); end if;
  insert into public.lesson_change_requests(school_id,billing_account_id,lesson_event_id,request_type,requested_resolution,
    requester_auth_user_id,requester_email,policy_version_id,cutoff_hours,within_policy_window,policy_disposition,
    policy_guidance,lesson_starts_at_snapshot,accounting_state)
  values((preview->>'school_id')::uuid,(preview->>'billing_account_id')::uuid,p_lesson_event_id,p_request_type,p_requested_resolution,
    auth.uid(),lower(trim(auth.jwt()->>'email')),(preview->>'policy_version_id')::uuid,(preview->>'cutoff_hours')::integer,
    (preview->>'within_policy_window')::boolean,preview->>'policy_disposition',preview->>'policy_guidance',
    (preview->>'lesson_starts_at')::timestamptz,preview->>'accounting_state') returning * into request_row;
  title_text:=case when p_request_type='cancellation' then 'New lesson cancellation request' else 'New lesson reschedule request' end;
  message:='Submitted '||to_char(request_row.requested_at,'Mon FMDD, YYYY at FMHH12:MI AM TZ')||'. '||case when request_row.within_policy_window then 'Within policy window.' else 'Outside policy window.' end;
  for recipient in
    select member.profile_id,profile.email,member.role from public.school_members member join public.profiles profile on profile.id=member.profile_id
      where member.school_id=request_row.school_id and member.status='active' and member.role in ('owner','admin')
    union
    select person.profile_id,person.email,'teacher' from public.lesson_events event join public.people person on person.id=event.teacher_id and person.school_id=event.school_id
      where event.id=request_row.lesson_event_id and person.status='active'
  loop
    if recipient.profile_id is not null then
      insert into public.owner_notifications(school_id,recipient_profile_id,kind,title,message,href,dedupe_key,entity_type,entity_id,metadata)
      values(request_row.school_id,recipient.profile_id,'lesson_change_requested',title_text,message,'/schools/'||request_row.school_id,
        'lesson-request:'||request_row.id, 'lesson_change_request',request_row.id,jsonb_build_object('lesson_event_id',request_row.lesson_event_id,'request_type',request_row.request_type))
      on conflict(recipient_profile_id,dedupe_key) do nothing;
    end if;
    if nullif(lower(trim(recipient.email)),'') is not null then
      insert into public.lesson_request_email_outbox(school_id,request_id,recipient_kind,recipient_email,subject,message_text,idempotency_key)
      values(request_row.school_id,request_row.id,case when recipient.role='teacher' then 'teacher' else recipient.role end,lower(trim(recipient.email)),title_text,message,
        'lesson-request/'||request_row.id||'/'||lower(trim(recipient.email))) on conflict(idempotency_key) do nothing;
    end if;
  end loop;
  insert into public.lesson_request_email_outbox(school_id,request_id,recipient_kind,recipient_email,subject,message_text,idempotency_key)
  values(request_row.school_id,request_row.id,'requester',request_row.requester_email,'Your lesson request was received',
    message||' The lesson remains scheduled until the school confirms a change. '||request_row.policy_guidance,
    'lesson-request/'||request_row.id||'/requester') on conflict(idempotency_key) do nothing;
  return jsonb_build_object('request_id',request_row.id,'result','submitted','requested_at',request_row.requested_at,
    'within_policy_window',request_row.within_policy_window,'cutoff_hours',request_row.cutoff_hours,'policy_guidance',request_row.policy_guidance,
    'accounting_state',request_row.accounting_state);
end; $$;

revoke all on function public.preview_client_lesson_change_request(uuid,text) from public,anon;
revoke all on function public.submit_client_lesson_change_request(uuid,text,text) from public,anon;
grant execute on function public.preview_client_lesson_change_request(uuid,text) to authenticated;
grant execute on function public.submit_client_lesson_change_request(uuid,text,text) to authenticated;
