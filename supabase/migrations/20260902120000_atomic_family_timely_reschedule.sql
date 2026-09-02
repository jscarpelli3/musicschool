-- A policy may automatically approve a timely family reschedule without
-- pretending that an owner personally made the decision. Monetary credits and
-- refunds remain owner-reviewed until allocation-safe financial flows exist.

alter table public.lesson_change_decision_revisions
  alter column decided_by drop not null,
  add column decision_source text not null default 'staff_review'
    check (decision_source in ('staff_review','system_policy')),
  add column initiated_by_auth_user_id uuid;

alter table public.lesson_change_decision_revisions
  add constraint lesson_change_decision_revision_actor_truth check (
    (decision_source='staff_review' and decided_by is not null)
    or (decision_source='system_policy' and decided_by is null and initiated_by_auth_user_id is not null)
  );

alter table public.lesson_accounting_overrides
  alter column request_decision_id drop not null,
  add column decision_revision_id uuid unique,
  add foreign key(school_id,decision_revision_id) references public.lesson_change_decision_revisions(school_id,id) on delete restrict,
  add constraint lesson_accounting_override_one_decision check (
    (request_decision_id is not null)::integer+(decision_revision_id is not null)::integer=1
  );

alter table public.lesson_service_entitlements
  alter column created_by drop not null,
  add column creation_source text not null default 'staff_decision'
    check (creation_source in ('staff_decision','system_policy')),
  add column initiated_by_auth_user_id uuid,
  add constraint lesson_service_entitlement_actor_truth check (
    (creation_source='staff_decision' and created_by is not null)
    or (creation_source='system_policy' and created_by is null and initiated_by_auth_user_id is not null)
  );

create or replace function public.compute_lesson_event_billing_disposition(
  p_school_id uuid,p_lesson_event_id uuid,p_as_of timestamptz default now()
) returns jsonb language plpgsql stable set search_path='' as $$
declare override_row public.lesson_accounting_overrides%rowtype;
begin
  select * into override_row from public.lesson_accounting_overrides
  where school_id=p_school_id and lesson_event_id=p_lesson_event_id;
  if found then
    return jsonb_build_object('lesson_event_id',p_lesson_event_id,'state','resolved',
      'disposition',override_row.disposition,'reason_code',override_row.reason_code,
      'policy_version_id',null,'policy_disposition',null,
      'request_decision_id',override_row.request_decision_id,
      'decision_revision_id',override_row.decision_revision_id);
  end if;
  return public.compute_policy_lesson_event_billing_disposition(p_school_id,p_lesson_event_id,p_as_of);
end $$;
revoke all on function public.compute_lesson_event_billing_disposition(uuid,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.compute_lesson_event_billing_disposition(uuid,uuid,timestamptz) to service_role;

create function public.apply_automatic_family_timely_reschedule(p_lesson_event_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare
  preview jsonb; event_row public.lesson_events%rowtype; request_row public.lesson_change_requests%rowtype;
  rules public.cancellation_policy_rules%rowtype; revision_id uuid; entitlement_id uuid; outcome_id uuid;
  existing_request record; recipient record; title_text text; message_text text; duration_minutes integer;
begin
  preview:=public.preview_client_lesson_change_request(p_lesson_event_id,'reschedule');
  if (preview->>'within_policy_window')::boolean is not true or preview->>'approval_mode'<>'automatic' then
    raise exception 'automatic_approval_not_available';
  end if;
  select * into event_row from public.lesson_events
  where id=p_lesson_event_id and school_id=(preview->>'school_id')::uuid for update;
  if not found or event_row.status<>'scheduled' then raise exception 'lesson_no_longer_available'; end if;
  select id,status into existing_request from public.lesson_change_requests
  where lesson_event_id=p_lesson_event_id and request_type='reschedule' and status in ('pending','in_progress','approved')
  order by requested_at desc limit 1;
  if found then return jsonb_build_object('request_id',existing_request.id,'result','already_'||existing_request.status); end if;
  select * into rules from public.cancellation_policy_rules where policy_version_id=(preview->>'policy_version_id')::uuid;
  if not found then raise exception 'policy_snapshot_unavailable'; end if;
  duration_minutes:=greatest(5,extract(epoch from(event_row.ends_at-event_row.starts_at))::integer/60);

  insert into public.lesson_change_requests(school_id,billing_account_id,lesson_event_id,request_type,requested_resolution,
    status,requester_auth_user_id,requester_email,policy_version_id,cutoff_hours,within_policy_window,
    policy_disposition,policy_guidance,lesson_starts_at_snapshot,accounting_state)
  values((preview->>'school_id')::uuid,(preview->>'billing_account_id')::uuid,p_lesson_event_id,'reschedule','reschedule',
    'approved',auth.uid(),lower(trim(auth.jwt()->>'email')),(preview->>'policy_version_id')::uuid,
    (preview->>'cutoff_hours')::integer,true,preview->>'policy_disposition',preview->>'policy_guidance',
    (preview->>'lesson_starts_at')::timestamptz,preview->>'accounting_state') returning * into request_row;
  select id into outcome_id from public.cancellation_policy_outcomes
  where policy_version_id=request_row.policy_version_id and scenario='student_reschedule' and timing_bucket='timely';
  insert into public.lesson_change_decision_revisions(
    school_id,request_id,revision_number,request_disposition,calendar_action,service_outcome,
    original_charge_treatment,replacement_kind,replacement_minutes,beneficiary_student_id,
    teacher_constraint,replacement_teacher_id,transferable_within_account,expires_at,
    policy_outcome_id,policy_snapshot,actual_outcome_snapshot,payer_summary,decision_source,
    initiated_by_auth_user_id,decided_at
  ) values(
    event_row.school_id,request_row.id,1,'approved','retain_for_later','not_serviced_student_cancelled',
    'waive_full_charge','replacement_minutes',duration_minutes,event_row.student_id,
    case when rules.must_keep_assigned_teacher then 'required' else 'unrestricted' end,
    case when rules.must_keep_assigned_teacher then event_row.teacher_id end,true,
    case when rules.replacement_window_days is null then null else now()+(rules.replacement_window_days*interval '1 day') end,
    outcome_id,jsonb_build_object('policy_version_id',request_row.policy_version_id,'within_policy_window',true,
      'access_settings',preview->'access_settings_snapshot'),
    jsonb_build_object('calendar_action','retain_for_later','service_outcome','not_serviced_student_cancelled',
      'original_charge_treatment','waive_full_charge','replacement_minutes',duration_minutes),
    'Your timely reschedule was approved automatically. The lesson is now available to schedule for another time.',
    'system_policy',auth.uid(),now()
  ) returning id into revision_id;
  update public.lesson_change_requests set current_decision_revision_id=revision_id where id=request_row.id;
  insert into public.lesson_accounting_overrides(lesson_event_id,school_id,decision_revision_id,disposition,reason_code)
  values(event_row.id,event_row.school_id,revision_id,'waive','automatic_timely_reschedule');
  update public.lesson_events set status='cancelled',outcome='student_cancelled',cancellation_timing='timely'
  where id=event_row.id;
  insert into public.lesson_service_entitlements(school_id,billing_account_id,student_id,assigned_teacher_id,
    source_lesson_event_id,source_request_id,duration_minutes,expires_at,created_by,creation_source,initiated_by_auth_user_id)
  values(event_row.school_id,request_row.billing_account_id,event_row.student_id,
    case when rules.must_keep_assigned_teacher then event_row.teacher_id end,event_row.id,request_row.id,
    duration_minutes,case when rules.replacement_window_days is null then null else now()+(rules.replacement_window_days*interval '1 day') end,
    null,'system_policy',auth.uid())
  returning id into entitlement_id;
  title_text:='Timely lesson reschedule approved automatically';
  message_text:='The family rescheduled the lesson from '||to_char(event_row.starts_at,'Dy, Mon FMDD, YYYY at FMHH12:MI AM TZ')||
    '. The original occurrence was cancelled and the lesson is available to schedule again.';
  for recipient in
    select member.profile_id,profile.email,member.role from public.school_members member join public.profiles profile on profile.id=member.profile_id
      where member.school_id=event_row.school_id and member.status='active' and member.role in ('owner','admin')
    union
    select person.profile_id,person.email,'teacher' from public.people person
      where person.school_id=event_row.school_id and person.id=event_row.teacher_id and person.status='active'
  loop
    if recipient.profile_id is not null then
      insert into public.owner_notifications(school_id,recipient_profile_id,kind,title,message,dedupe_key,entity_type,entity_id,metadata,resolved_at)
      values(event_row.school_id,recipient.profile_id,'lesson_change_requested',title_text,message_text,
        'automatic-reschedule:'||request_row.id,'lesson_change_request',request_row.id,
        jsonb_build_object('lesson_event_id',event_row.id,'teacher_id',event_row.teacher_id,'student_id',event_row.student_id,'automatic',true),now())
      on conflict(recipient_profile_id,dedupe_key) do nothing;
    end if;
    if nullif(lower(trim(recipient.email)),'') is not null then
      insert into public.lesson_request_email_outbox(school_id,request_id,recipient_kind,recipient_email,subject,message_text,idempotency_key)
      values(event_row.school_id,request_row.id,case when recipient.role='teacher' then 'teacher' else recipient.role end,
        lower(trim(recipient.email)),title_text,message_text,'automatic-reschedule/'||request_row.id||'/'||lower(trim(recipient.email)))
      on conflict(idempotency_key) do nothing;
    end if;
  end loop;
  insert into public.lesson_request_email_outbox(school_id,request_id,recipient_kind,recipient_email,subject,message_text,idempotency_key)
  values(event_row.school_id,request_row.id,'requester',request_row.requester_email,
    'Your lesson was returned for rescheduling',
    'Your timely reschedule was approved automatically. The original lesson is cancelled and is now available to schedule for another time.',
    'automatic-reschedule/'||request_row.id||'/requester') on conflict(idempotency_key) do nothing;
  insert into public.domain_events(school_id,event_type,entity_type,entity_id,actor_profile_id,actor_role,source,payload)
  values(event_row.school_id,'lesson_change_request.automatically_approved','lesson_change_request',request_row.id,null,
    'family','family_portal',jsonb_build_object('revision_id',revision_id,'entitlement_id',entitlement_id,
      'initiated_by_auth_user_id',auth.uid(),'policy_version_id',request_row.policy_version_id));
  return jsonb_build_object('request_id',request_row.id,'result','automatically_approved','requested_at',request_row.requested_at,
    'decision_revision_id',revision_id,'entitlement_id',entitlement_id,'message','Lesson cancelled and returned for rescheduling.');
end $$;
revoke all on function public.apply_automatic_family_timely_reschedule(uuid) from public,anon;
grant execute on function public.apply_automatic_family_timely_reschedule(uuid) to authenticated;

create function public.submit_client_lesson_change_action(
  p_lesson_event_id uuid,p_request_type text,p_requested_resolution text
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare preview jsonb;
begin
  preview:=public.preview_client_lesson_change_request(p_lesson_event_id,p_request_type);
  if p_request_type='reschedule' and p_requested_resolution='reschedule'
    and (preview->>'within_policy_window')::boolean and preview->>'approval_mode'='automatic'
  then return public.apply_automatic_family_timely_reschedule(p_lesson_event_id); end if;
  return public.submit_client_lesson_change_request(p_lesson_event_id,p_request_type,p_requested_resolution);
end $$;
revoke all on function public.submit_client_lesson_change_action(uuid,text,text) from public,anon;
grant execute on function public.submit_client_lesson_change_action(uuid,text,text) to authenticated;

do $$ begin
  if has_function_privilege('anon','public.apply_automatic_family_timely_reschedule(uuid)','EXECUTE')
    or has_function_privilege('anon','public.submit_client_lesson_change_action(uuid,text,text)','EXECUTE')
  then raise exception 'anonymous automatic cancellation access detected'; end if;
end $$;
