-- Submission records actor/channel and business scenario independently. Policy is
-- selected by scenario; no downstream service meaning is inferred from origin.

alter table public.lesson_change_requests
  add column policy_outcome_id uuid,
  add column request_note text check (request_note is null or length(trim(request_note)) between 1 and 1000);

update public.lesson_change_requests request
set policy_outcome_id=outcome.id
from public.cancellation_policy_outcomes outcome
where outcome.school_id=request.school_id
  and outcome.policy_version_id=request.policy_version_id
  and outcome.scenario=request.scenario
  and outcome.timing_bucket=case
    when request.scenario in ('teacher_cancellation','school_cancellation','student_no_show') then 'not_applicable'
    when request.within_policy_window then 'timely' else 'late' end;

do $$ begin
  if exists(select 1 from public.lesson_change_requests where policy_outcome_id is null) then
    raise exception 'lesson_change_request_policy_outcome_backfill_failed';
  end if;
end $$;

alter table public.lesson_change_requests alter column policy_outcome_id set not null;
alter table public.lesson_change_requests add constraint lesson_change_requests_policy_outcome_fk
  foreign key(school_id,policy_outcome_id)
  references public.cancellation_policy_outcomes(school_id,id) on delete restrict;

create function public.set_lesson_change_request_policy_outcome()
returns trigger language plpgsql set search_path='' as $$
declare expected_outcome_id uuid;
begin
  select outcome.id into expected_outcome_id
  from public.cancellation_policy_outcomes outcome
  where outcome.school_id=new.school_id
    and outcome.policy_version_id=new.policy_version_id
    and outcome.scenario=new.scenario
    and outcome.timing_bucket=case
      when new.scenario in ('teacher_cancellation','school_cancellation','student_no_show') then 'not_applicable'
      when new.within_policy_window then 'timely' else 'late' end;
  if expected_outcome_id is null then raise exception 'scenario_policy_outcome_unavailable'; end if;
  if new.policy_outcome_id is not null and new.policy_outcome_id<>expected_outcome_id then
    raise exception 'request_policy_outcome_mismatch';
  end if;
  new.policy_outcome_id:=expected_outcome_id;
  return new;
end $$;

-- PostgreSQL runs same-event triggers by name; this follows the legacy family
-- scenario compatibility trigger and therefore sees its explicit action mapping.
create trigger lesson_change_requests_set_policy_outcome
before insert on public.lesson_change_requests for each row
execute function public.set_lesson_change_request_policy_outcome();
revoke all on function public.set_lesson_change_request_policy_outcome() from public,anon,authenticated;

drop index public.lesson_change_requests_one_pending_type;
create unique index lesson_change_requests_one_pending_scenario
  on public.lesson_change_requests(lesson_event_id,scenario)
  where status in ('pending','in_progress');

comment on column public.lesson_change_requests.policy_outcome_id is
  'Immutable scenario-and-timing policy recipe selected when the request was submitted.';
comment on column public.lesson_change_requests.request_note is
  'Optional requester context; never used to infer origin, scenario, service, or financial truth.';

create function public.submit_lesson_change_request_core(
  p_school_id uuid,
  p_lesson_event_id uuid,
  p_request_type text,
  p_requested_resolution text,
  p_origin_kind text,
  p_scenario text,
  p_requester_auth_user_id uuid,
  p_requester_email text,
  p_request_note text,
  p_actor_role text,
  p_source text
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare
  event_row public.lesson_events%rowtype;
  policy_row record;
  outcome_row public.cancellation_policy_outcomes%rowtype;
  request_row public.lesson_change_requests%rowtype;
  billing_account_id_value uuid;
  existing_request record;
  cutoff_value integer;
  timing_value text;
  within_window boolean;
  accounting_value text;
  clean_email text:=lower(nullif(trim(p_requester_email),''));
  clean_note text:=nullif(trim(coalesce(p_request_note,'')),'');
  title_text text;
  message_text text;
  recipient record;
begin
  if p_school_id is null or p_lesson_event_id is null or p_requester_auth_user_id is null or clean_email is null then
    raise exception 'invalid_request_identity';
  end if;
  if p_request_type not in ('cancellation','reschedule')
    or p_requested_resolution not in ('cancel','reschedule','lesson_credit')
    or p_origin_kind not in ('family','teacher','owner','system')
    or p_scenario not in ('student_cancellation','student_reschedule','student_no_show','teacher_cancellation','school_cancellation')
    or nullif(trim(coalesce(p_actor_role,'')),'') is null
    or nullif(trim(coalesce(p_source,'')),'') is null
  then raise exception 'invalid_lesson_change_request'; end if;
  if length(clean_email)>320 or (clean_note is not null and length(clean_note)>1000) then
    raise exception 'invalid_requester_details';
  end if;

  select * into event_row from public.lesson_events event
  where event.school_id=p_school_id and event.id=p_lesson_event_id for update;
  if not found then raise exception 'lesson_not_found'; end if;
  if event_row.status<>'scheduled' then raise exception 'lesson_not_available'; end if;

  select request.id,request.status into existing_request
  from public.lesson_change_requests request
  where request.school_id=p_school_id and request.lesson_event_id=p_lesson_event_id
    and request.scenario=p_scenario and request.status in ('pending','in_progress')
  order by request.requested_at desc limit 1 for update;
  if found then
    return jsonb_build_object('request_id',existing_request.id,'result','already_'||existing_request.status);
  end if;

  select mapping.billing_account_id into billing_account_id_value
  from public.billing_account_students mapping
  where mapping.school_id=p_school_id and mapping.student_id=event_row.student_id;
  if not found then raise exception 'lesson_billing_account_not_found'; end if;

  select version.id policy_version_id,rules.student_cancel_cutoff_hours,rules.student_reschedule_cutoff_hours
  into policy_row
  from public.school_policies policy
  join public.school_policy_versions version
    on version.school_id=policy.school_id and version.policy_id=policy.id
  join public.cancellation_policy_rules rules on rules.policy_version_id=version.id
  where policy.school_id=p_school_id and policy.kind='cancellation' and policy.status='active'
    and policy.id=coalesce(
      (select selection.policy_id from public.service_product_policy_selections selection
       where selection.school_id=p_school_id and selection.product_id=event_row.product_id
         and selection.policy_kind='cancellation' and not selection.use_school_default),
      (select default_policy.id from public.school_policies default_policy
       where default_policy.school_id=p_school_id and default_policy.kind='cancellation'
         and default_policy.status='active' and default_policy.is_default))
    and version.published_at is not null
    and coalesce(version.effective_from,version.published_at)<=event_row.starts_at
  order by coalesce(version.effective_from,version.published_at) desc,version.version_number desc
  limit 1;
  if not found then raise exception 'published_cancellation_policy_required'; end if;

  if p_scenario in ('teacher_cancellation','school_cancellation','student_no_show') then
    cutoff_value:=0;
    timing_value:='not_applicable';
    within_window:=true;
  else
    cutoff_value:=case p_scenario when 'student_reschedule' then policy_row.student_reschedule_cutoff_hours
      else policy_row.student_cancel_cutoff_hours end;
    within_window:=now()<=event_row.starts_at-(cutoff_value*interval '1 hour');
    timing_value:=case when within_window then 'timely' else 'late' end;
  end if;

  select * into outcome_row from public.cancellation_policy_outcomes outcome
  where outcome.school_id=p_school_id and outcome.policy_version_id=policy_row.policy_version_id
    and outcome.scenario=p_scenario and outcome.timing_bucket=timing_value;
  if not found then raise exception 'scenario_policy_outcome_unavailable'; end if;

  select case
    when bool_or(period.status='paid') then 'paid'
    when bool_or(period.status in ('approved','collecting','payment_failed')) then 'approved'
    when bool_or(period.status in ('locked','approval_pending')) then 'locked'
    when bool_or(period.status in ('draft','review')) then 'draft'
    else 'unaccounted' end into accounting_value
  from public.billing_line_items item
  join public.billing_periods period on period.id=item.billing_period_id
  where item.school_id=p_school_id and item.source_type='lesson' and item.source_id=event_row.id;

  insert into public.lesson_change_requests(
    school_id,billing_account_id,lesson_event_id,request_type,requested_resolution,status,
    requester_auth_user_id,requester_email,policy_version_id,policy_outcome_id,cutoff_hours,
    within_policy_window,policy_disposition,policy_guidance,lesson_starts_at_snapshot,
    accounting_state,origin_kind,scenario,request_note
  ) values(
    p_school_id,billing_account_id_value,event_row.id,p_request_type,p_requested_resolution,'pending',
    p_requester_auth_user_id,clean_email,policy_row.policy_version_id,outcome_row.id,cutoff_value,
    within_window,outcome_row.original_charge_treatment,outcome_row.family_guidance,event_row.starts_at,
    coalesce(accounting_value,'unaccounted'),p_origin_kind,p_scenario,clean_note
  ) returning * into request_row;

  title_text:=case p_scenario
    when 'teacher_cancellation' then 'Teacher cancellation needs review'
    when 'school_cancellation' then 'School cancellation needs review'
    when 'student_no_show' then 'Student no-show needs review'
    when 'student_reschedule' then 'Lesson reschedule needs review'
    else 'Lesson cancellation needs review' end;
  message_text:=case p_scenario
    when 'teacher_cancellation' then 'The assigned teacher reported that this lesson must be cancelled.'
    when 'school_cancellation' then 'The school initiated a cancellation for this lesson.'
    when 'student_no_show' then 'A student no-show was reported for this lesson.'
    when 'student_reschedule' then 'A lesson reschedule was requested.'
    else 'A lesson cancellation was requested.' end
    ||' The lesson remains scheduled until the request is resolved.'
    ||case when clean_note is null then '' else ' Note: '||clean_note end;

  for recipient in
    select member.profile_id,profile.email,member.role
    from public.school_members member join public.profiles profile on profile.id=member.profile_id
    where member.school_id=p_school_id and member.status='active' and member.role in ('owner','admin')
    union
    select person.profile_id,person.email,'teacher'
    from public.people person
    where person.school_id=p_school_id and person.id=event_row.teacher_id and person.status='active'
  loop
    if recipient.profile_id is not null then
      insert into public.owner_notifications(
        school_id,recipient_profile_id,kind,title,message,href,dedupe_key,entity_type,entity_id,metadata
      ) values(
        p_school_id,recipient.profile_id,'lesson_change_requested',title_text,message_text,
        '/schools/'||p_school_id||'/approvals?request='||request_row.id,
        'lesson-request:'||request_row.id,'lesson_change_request',request_row.id,
        jsonb_build_object('lesson_event_id',event_row.id,'origin_kind',p_origin_kind,'scenario',p_scenario,
          'policy_outcome_id',outcome_row.id,'requester_auth_user_id',p_requester_auth_user_id)
      ) on conflict(recipient_profile_id,dedupe_key) do nothing;
    end if;
    if nullif(lower(trim(recipient.email)),'') is not null then
      insert into public.lesson_request_email_outbox(
        school_id,request_id,recipient_kind,recipient_email,subject,message_text,idempotency_key
      ) values(
        p_school_id,request_row.id,recipient.role,lower(trim(recipient.email)),title_text,message_text,
        'lesson-request/'||request_row.id||'/'||lower(trim(recipient.email))
      ) on conflict(idempotency_key) do nothing;
    end if;
  end loop;

  insert into public.lesson_request_email_outbox(
    school_id,request_id,recipient_kind,recipient_email,subject,message_text,idempotency_key
  ) values(
    p_school_id,request_row.id,'requester',clean_email,'Your lesson change was recorded',
    message_text||' The school will notify you when it is resolved.',
    'lesson-request/'||request_row.id||'/requester'
  ) on conflict(idempotency_key) do nothing;

  insert into public.domain_events(
    school_id,event_type,entity_type,entity_id,actor_profile_id,actor_role,source,payload
  ) values(
    p_school_id,'lesson_change_request.submitted','lesson_change_request',request_row.id,
    p_requester_auth_user_id,p_actor_role,p_source,
    jsonb_build_object('lesson_event_id',event_row.id,'origin_kind',p_origin_kind,'scenario',p_scenario,
      'policy_version_id',policy_row.policy_version_id,'policy_outcome_id',outcome_row.id,
      'timing_bucket',timing_value,'accounting_state',coalesce(accounting_value,'unaccounted'))
  );
  insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata)
  values(p_school_id,p_requester_auth_user_id,'lesson_change_request.submitted','lesson_change_request',request_row.id,
    jsonb_build_object('lesson_event_id',event_row.id,'origin_kind',p_origin_kind,'scenario',p_scenario,
      'policy_version_id',policy_row.policy_version_id,'policy_outcome_id',outcome_row.id));

  return jsonb_build_object('request_id',request_row.id,'result','submitted','requested_at',request_row.requested_at,
    'origin_kind',request_row.origin_kind,'scenario',request_row.scenario,'policy_outcome_id',request_row.policy_outcome_id,
    'accounting_state',request_row.accounting_state,'policy_guidance',request_row.policy_guidance);
end $$;

revoke all on function public.submit_lesson_change_request_core(uuid,uuid,text,text,text,text,uuid,text,text,text,text)
  from public,anon,authenticated;

create function public.submit_assigned_teacher_cancellation(
  p_school_id uuid,p_lesson_event_id uuid,p_request_note text default null
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare actor_id uuid:=auth.uid(); actor_email text; assigned_teacher_id uuid; member_role text;
begin
  select member.role into member_role from public.school_members member
  where member.school_id=p_school_id and member.profile_id=actor_id and member.status='active';
  if actor_id is null or member_role not in ('teacher','owner','admin') then raise exception 'not_authorized'; end if;

  select event.teacher_id,coalesce(profile.email,person.email) into assigned_teacher_id,actor_email
  from public.lesson_events event
  join public.people person on person.school_id=event.school_id and person.id=event.teacher_id
    and person.profile_id=actor_id and person.status='active'
  join public.teachers teacher on teacher.school_id=person.school_id and teacher.person_id=person.id
  left join public.profiles profile on profile.id=actor_id
  where event.school_id=p_school_id and event.id=p_lesson_event_id;
  if not found or assigned_teacher_id is null then raise exception 'not_assigned_teacher'; end if;
  if nullif(trim(actor_email),'') is null then raise exception 'teacher_email_required'; end if;

  return public.submit_lesson_change_request_core(
    p_school_id,p_lesson_event_id,'cancellation','cancel','teacher','teacher_cancellation',
    actor_id,actor_email,p_request_note,member_role,'teacher_portal'
  );
end $$;

revoke all on function public.submit_assigned_teacher_cancellation(uuid,uuid,text) from public,anon;
grant execute on function public.submit_assigned_teacher_cancellation(uuid,uuid,text) to authenticated;

comment on function public.submit_assigned_teacher_cancellation(uuid,uuid,text) is
  'Submits, but does not resolve, a cancellation for the authenticated active teacher assigned to the lesson.';

-- Keep the established family RPC contract while routing it through the same
-- submission transaction used by staff-facing origin points.
create or replace function public.submit_client_lesson_change_request(
  p_lesson_event_id uuid,p_request_type text,p_requested_resolution text
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare preview jsonb; scenario_value text;
begin
  if (p_request_type='cancellation' and p_requested_resolution not in ('cancel','reschedule','lesson_credit'))
    or (p_request_type='reschedule' and p_requested_resolution<>'reschedule')
  then raise exception 'invalid_resolution'; end if;

  -- This preserves the payer-account authorization boundary before the private
  -- core receives the independently stated origin and business scenario.
  preview:=public.preview_client_lesson_change_request(p_lesson_event_id,p_request_type);
  scenario_value:=case p_request_type
    when 'reschedule' then 'student_reschedule'
    else 'student_cancellation' end;

  return public.submit_lesson_change_request_core(
    (preview->>'school_id')::uuid,p_lesson_event_id,p_request_type,p_requested_resolution,
    'family',scenario_value,auth.uid(),lower(trim(auth.jwt()->>'email')),null,
    'payer','family_portal'
  );
end $$;

revoke all on function public.submit_client_lesson_change_request(uuid,text,text) from public,anon;
grant execute on function public.submit_client_lesson_change_request(uuid,text,text) to authenticated;

comment on function public.submit_client_lesson_change_request(uuid,text,text) is
  'Authorized family wrapper around the origin-agnostic lesson-change submission transaction.';
