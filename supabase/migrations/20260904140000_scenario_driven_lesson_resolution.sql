-- Resolve every lesson-change origin through one scenario-driven transaction.
-- Request origin is audit context only; policy and service truth come from scenario.

alter table public.lesson_events drop constraint lesson_events_outcome_check;
alter table public.lesson_events add constraint lesson_events_outcome_check
  check (outcome is null or outcome in (
    'completed','student_cancelled','teacher_cancelled','school_cancelled','no_show','partial'
  ));

create function public.apply_lesson_change_resolution_core(
  p_school_id uuid,
  p_request_id uuid,
  p_request_disposition text,
  p_actual_outcome jsonb,
  p_internal_reason text,
  p_decision_source text,
  p_actor_profile_id uuid,
  p_actor_role text,
  p_initiated_by_auth_user_id uuid
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare
  request_row public.lesson_change_requests%rowtype;
  event_row public.lesson_events%rowtype;
  policy_row public.cancellation_policy_outcomes%rowtype;
  existing_revision public.lesson_change_decision_revisions%rowtype;
  actual jsonb;
  policy_json jsonb;
  policy_snapshot jsonb;
  timing_value text;
  revision_id uuid;
  entitlement_id uuid;
  adjustment_id uuid;
  revision_number integer;
  is_override boolean:=false;
  duration_value integer;
  expiration_value timestamptz;
  adjustment jsonb;
  adjustment_actions jsonb:='[]'::jsonb;
  final_status text;
  event_status text;
  event_outcome text;
  expected_service_outcome text;
  summary_text text;
  recipient record;
begin
  if p_request_disposition not in ('approved','declined') then raise exception 'invalid_request_disposition'; end if;
  if p_decision_source not in ('staff_review','system_policy') then raise exception 'invalid_decision_source'; end if;
  if (p_decision_source='staff_review' and p_actor_profile_id is null)
    or (p_decision_source='system_policy' and (p_actor_profile_id is not null or p_initiated_by_auth_user_id is null))
  then raise exception 'invalid_decision_actor'; end if;
  if p_internal_reason is not null and length(trim(p_internal_reason)) not between 1 and 1000 then
    raise exception 'invalid_internal_reason';
  end if;

  select * into request_row from public.lesson_change_requests
  where school_id=p_school_id and id=p_request_id for update;
  if not found then raise exception 'request_not_found'; end if;
  if request_row.current_decision_revision_id is not null then
    select * into existing_revision from public.lesson_change_decision_revisions
    where school_id=p_school_id and id=request_row.current_decision_revision_id;
    if not found then raise exception 'resolved_request_revision_missing'; end if;
    return jsonb_build_object('outcome','already_resolved','request_id',p_request_id,
      'request_status',request_row.status,'decision_revision_id',existing_revision.id);
  end if;
  if request_row.status not in ('pending','in_progress') then raise exception 'terminal_request_without_revision'; end if;

  select * into event_row from public.lesson_events
  where school_id=p_school_id and id=request_row.lesson_event_id for update;
  if not found then raise exception 'lesson_not_found'; end if;
  if event_row.status<>'scheduled' then raise exception 'lesson_no_longer_scheduled'; end if;
  perform 1 from public.lesson_accounting_overrides
    where school_id=p_school_id and lesson_event_id=event_row.id for update;
  perform 1 from public.lesson_service_entitlements
    where school_id=p_school_id and source_request_id=p_request_id for update;
  perform 1 from public.billing_account_pending_adjustments
    where school_id=p_school_id and source_request_id=p_request_id for update;
  if exists(select 1 from public.lesson_accounting_overrides
      where school_id=p_school_id and lesson_event_id=event_row.id)
    or exists(select 1 from public.lesson_service_entitlements
      where school_id=p_school_id and source_request_id=p_request_id)
    or exists(select 1 from public.billing_account_pending_adjustments
      where school_id=p_school_id and source_request_id=p_request_id)
  then raise exception 'resolution_artifact_conflict'; end if;

  timing_value:=case
    when request_row.scenario in ('teacher_cancellation','school_cancellation','student_no_show') then 'not_applicable'
    when request_row.within_policy_window then 'timely' else 'late' end;
  select * into policy_row from public.cancellation_policy_outcomes outcome
  where outcome.school_id=p_school_id and outcome.policy_version_id=request_row.policy_version_id
    and outcome.scenario=request_row.scenario and outcome.timing_bucket=timing_value;
  if not found then raise exception 'scenario_policy_outcome_unavailable'; end if;

  policy_json:=jsonb_strip_nulls(jsonb_build_object(
    'calendar_action',policy_row.calendar_action,'service_outcome',policy_row.service_outcome,
    'original_charge_treatment',policy_row.original_charge_treatment,
    'replacement_kind',policy_row.replacement_kind,
    'replacement_minutes',case policy_row.replacement_minutes_rule
      when 'original_duration' then greatest(5,extract(epoch from(event_row.ends_at-event_row.starts_at))::integer/60)
      when 'fixed' then policy_row.fixed_replacement_minutes end,
    'teacher_constraint',case when policy_row.replacement_kind='replacement_minutes'
      then policy_row.teacher_constraint else 'unrestricted' end,
    'replacement_teacher_id',case when policy_row.replacement_kind='replacement_minutes'
      and policy_row.teacher_constraint='required' then event_row.teacher_id end,
    'transferable_within_account',policy_row.transferable_within_account,
    'expires_at',case when policy_row.expiration_days is null then null
      when policy_row.expiration_anchor='original_lesson' then event_row.starts_at+(policy_row.expiration_days*interval '1 day')
      when policy_row.expiration_anchor='request' then request_row.requested_at+(policy_row.expiration_days*interval '1 day')
      else now()+(policy_row.expiration_days*interval '1 day') end,
    'adjustment_actions',case when policy_row.adjustment_kind in ('fee','credit') then
      jsonb_build_array(jsonb_build_object('kind',policy_row.adjustment_kind,'amount_cents',policy_row.adjustment_amount_cents))
      else '[]'::jsonb end,
    'refund_action',case when policy_row.original_charge_treatment='manual_financial_review'
      then 'manual_financial_review' else 'none' end));
  policy_snapshot:=policy_json||jsonb_build_object('policy_outcome_id',policy_row.id,
    'policy_version_id',request_row.policy_version_id,'scenario',request_row.scenario,
    'timing_bucket',timing_value);

  if p_request_disposition='declined' then
    if p_actual_outcome is not null then raise exception 'decline_has_effects'; end if;
    actual:=jsonb_build_object('calendar_action','leave_scheduled','service_outcome','scheduled_not_yet_serviced',
      'original_charge_treatment','unchanged','replacement_kind','none','teacher_constraint','unrestricted',
      'transferable_within_account',true,'adjustment_actions','[]'::jsonb,'refund_action','none');
    summary_text:='The school declined this request. The lesson remains scheduled.';
    final_status:='declined';
  else
    actual:=jsonb_strip_nulls(coalesce(p_actual_outcome,policy_json));
    if jsonb_typeof(actual)<>'object' or not actual ?& array[
      'calendar_action','service_outcome','original_charge_treatment','replacement_kind',
      'teacher_constraint','transferable_within_account','adjustment_actions','refund_action'
    ] then raise exception 'incomplete_actual_outcome'; end if;
    if (actual - array['calendar_action','service_outcome','original_charge_treatment','replacement_kind',
      'replacement_minutes','teacher_constraint','replacement_teacher_id','transferable_within_account',
      'expires_at','adjustment_actions','refund_action'])<>'{}'::jsonb
    then raise exception 'unknown_actual_outcome_field'; end if;
    if actual->>'calendar_action' not in ('leave_scheduled','cancel','retain_for_later','reschedule_now','manual_review')
      or actual->>'service_outcome' not in ('scheduled_not_yet_serviced','serviced','not_serviced_student_cancelled',
        'not_serviced_teacher_cancelled','not_serviced_school_cancelled','not_serviced_no_show','manual_review')
      or actual->>'original_charge_treatment' not in ('unchanged','keep_full_charge','waive_full_charge','reduce_charge','account_credit','manual_financial_review')
      or actual->>'replacement_kind' not in ('none','replacement_minutes','reschedule_now','manual_review')
      or actual->>'teacher_constraint' not in ('required','preferred','unrestricted')
      or actual->>'refund_action' not in ('none','manual_financial_review','refund_requested','refund_submitted','refund_succeeded','refund_failed')
      or jsonb_typeof(actual->'transferable_within_account')<>'boolean'
      or jsonb_typeof(actual->'adjustment_actions')<>'array'
    then raise exception 'invalid_actual_outcome'; end if;
    if actual->>'calendar_action' in ('reschedule_now','manual_review')
      or actual->>'replacement_kind' in ('reschedule_now','manual_review') then raise exception 'outcome_requires_unsupported_scheduling_flow'; end if;
    if actual->>'service_outcome' in ('serviced','manual_review') then raise exception 'service_outcome_not_finalizable'; end if;
    if actual->>'original_charge_treatment' in ('reduce_charge','account_credit','manual_financial_review')
      or actual->>'refund_action'<>'none' then raise exception 'financial_outcome_not_finalizable'; end if;
    if (actual->>'calendar_action'='leave_scheduled')<>(actual->>'service_outcome'='scheduled_not_yet_serviced') then
      raise exception 'calendar_service_outcome_mismatch';
    end if;
    if (actual->>'calendar_action'='retain_for_later')<>(actual->>'replacement_kind'='replacement_minutes') then
      raise exception 'calendar_replacement_outcome_mismatch';
    end if;
    expected_service_outcome:=case request_row.scenario
      when 'student_cancellation' then 'not_serviced_student_cancelled'
      when 'student_reschedule' then 'not_serviced_student_cancelled'
      when 'teacher_cancellation' then 'not_serviced_teacher_cancelled'
      when 'school_cancellation' then 'not_serviced_school_cancelled'
      when 'student_no_show' then 'not_serviced_no_show' end;
    if expected_service_outcome is null or actual->>'service_outcome'<>expected_service_outcome then
      raise exception 'scenario_service_outcome_mismatch';
    end if;

    duration_value:=nullif(actual->>'replacement_minutes','')::integer;
    expiration_value:=nullif(actual->>'expires_at','')::timestamptz;
    if (actual->>'replacement_kind'='replacement_minutes')<>(duration_value is not null)
      or (duration_value is not null and duration_value not between 5 and 480)
    then raise exception 'invalid_replacement_minutes'; end if;
    if actual->>'teacher_constraint'='required' and coalesce((actual->>'replacement_teacher_id')::uuid,event_row.teacher_id)<>event_row.teacher_id then
      raise exception 'invalid_required_replacement_teacher';
    end if;
    if actual->>'replacement_kind'<>'replacement_minutes' and (actual ? 'expires_at' or actual ? 'replacement_teacher_id') then
      raise exception 'replacement_fields_without_replacement';
    end if;
    if jsonb_array_length(actual->'adjustment_actions')>2 then raise exception 'too_many_adjustments'; end if;
    for adjustment in select value from jsonb_array_elements(actual->'adjustment_actions') loop
      if adjustment->>'kind' not in ('fee','credit')
        or coalesce((adjustment->>'amount_cents')::integer,0) not between 1 and 1000000
      then raise exception 'invalid_adjustment_action'; end if;
    end loop;
    if (select count(*)<>count(distinct item->>'kind') from jsonb_array_elements(actual->'adjustment_actions') item)
    then raise exception 'duplicate_adjustment_kind'; end if;
    is_override:=actual<>policy_json;
    if is_override and nullif(trim(coalesce(p_internal_reason,'')),'') is null then raise exception 'override_reason_required'; end if;
    final_status:='approved';
    summary_text:=case actual->>'replacement_kind'
      when 'replacement_minutes' then 'The lesson change was approved and replacement lesson time is available to schedule.'
      else 'The lesson change was approved. No replacement lesson was created.' end;
  end if;

  select coalesce(max(revision.revision_number),0)+1 into revision_number
  from public.lesson_change_decision_revisions revision where revision.request_id=p_request_id;
  adjustment_actions:=actual->'adjustment_actions';
  insert into public.lesson_change_decision_revisions(
    school_id,request_id,revision_number,request_disposition,calendar_action,service_outcome,
    original_charge_treatment,replacement_kind,replacement_minutes,beneficiary_student_id,
    teacher_constraint,replacement_teacher_id,transferable_within_account,expires_at,
    adjustment_actions,refund_action,policy_outcome_id,policy_snapshot,actual_outcome_snapshot,
    is_policy_override,internal_reason,payer_summary,decided_by,decision_source,
    initiated_by_auth_user_id,decided_at
  ) values(
    p_school_id,p_request_id,revision_number,p_request_disposition,actual->>'calendar_action',actual->>'service_outcome',
    actual->>'original_charge_treatment',actual->>'replacement_kind',duration_value,event_row.student_id,
    actual->>'teacher_constraint',case when actual->>'teacher_constraint'='required' then event_row.teacher_id
      else nullif(actual->>'replacement_teacher_id','')::uuid end,
    (actual->>'transferable_within_account')::boolean,expiration_value,adjustment_actions,actual->>'refund_action',
    policy_row.id,policy_snapshot,actual,is_override,
    nullif(trim(coalesce(p_internal_reason,'')),''),summary_text,p_actor_profile_id,p_decision_source,
    p_initiated_by_auth_user_id,now()
  ) returning id into revision_id;

  if p_request_disposition='approved' then
    if actual->>'calendar_action'<>'leave_scheduled' then
      event_status:=case when actual->>'service_outcome'='not_serviced_no_show' then 'no_show' else 'cancelled' end;
      event_outcome:=case actual->>'service_outcome'
        when 'not_serviced_student_cancelled' then 'student_cancelled'
        when 'not_serviced_teacher_cancelled' then 'teacher_cancelled'
        when 'not_serviced_school_cancelled' then 'school_cancelled'
        when 'not_serviced_no_show' then 'no_show' end;
      update public.lesson_events set status=event_status,outcome=event_outcome,
        cancellation_timing=case when timing_value in ('timely','late') then timing_value end
      where school_id=p_school_id and id=event_row.id;
    end if;
    if actual->>'original_charge_treatment'<>'unchanged' then
      insert into public.lesson_accounting_overrides(lesson_event_id,school_id,decision_revision_id,disposition,reason_code)
      values(event_row.id,p_school_id,revision_id,case actual->>'original_charge_treatment'
        when 'keep_full_charge' then 'charge' when 'waive_full_charge' then 'waive' end,
        'scenario_driven_resolution');
    end if;
    if actual->>'replacement_kind'='replacement_minutes' then
      insert into public.lesson_service_entitlements(school_id,billing_account_id,student_id,assigned_teacher_id,
        source_lesson_event_id,source_request_id,duration_minutes,expires_at,created_by,creation_source,initiated_by_auth_user_id)
      values(p_school_id,request_row.billing_account_id,event_row.student_id,
        case when actual->>'teacher_constraint'='required' then event_row.teacher_id end,event_row.id,p_request_id,
        duration_value,expiration_value,p_actor_profile_id,
        case when p_decision_source='staff_review' then 'staff_decision' else 'system_policy' end,p_initiated_by_auth_user_id)
      returning id into entitlement_id;
    end if;
    for adjustment in select value from jsonb_array_elements(adjustment_actions) loop
      if p_actor_profile_id is null then raise exception 'automatic_adjustment_actor_schema_unsupported'; end if;
      insert into public.billing_account_pending_adjustments(school_id,billing_account_id,source_request_id,kind,
        amount_cents,description,created_by)
      values(p_school_id,request_row.billing_account_id,p_request_id,adjustment->>'kind',(adjustment->>'amount_cents')::integer,
        case adjustment->>'kind' when 'fee' then 'Lesson change fee' else 'Lesson change account credit' end,p_actor_profile_id)
      returning id into adjustment_id;
    end loop;
  end if;

  update public.lesson_change_requests set status=final_status,current_decision_revision_id=revision_id,updated_at=now()
  where school_id=p_school_id and id=p_request_id;
  update public.owner_notifications set read_at=coalesce(read_at,now()),resolved_at=coalesce(resolved_at,now()),
    metadata=coalesce(metadata,'{}')||jsonb_build_object('request_status',final_status,'decision_revision_id',revision_id)
  where school_id=p_school_id and entity_type='lesson_change_request' and entity_id=p_request_id;

  for recipient in
    select request_row.requester_email email,'requester'::text recipient_kind
    union
    select profile.email,member.role from public.school_members member join public.profiles profile on profile.id=member.profile_id
      where member.school_id=p_school_id and member.status='active' and member.role in ('owner','admin')
    union
    select person.email,'teacher' from public.people person
      where person.school_id=p_school_id and person.id=event_row.teacher_id
  loop
    if nullif(lower(trim(recipient.email)),'') is not null then
      insert into public.lesson_request_email_outbox(school_id,request_id,recipient_kind,recipient_email,subject,message_text,idempotency_key)
      values(p_school_id,p_request_id,recipient.recipient_kind,lower(trim(recipient.email)),'Lesson change request resolved',summary_text,
        'scenario-resolution/'||revision_id||'/'||lower(trim(recipient.email))) on conflict(idempotency_key) do nothing;
    end if;
  end loop;
  insert into public.domain_events(school_id,event_type,entity_type,entity_id,actor_profile_id,actor_role,source,payload)
  values(p_school_id,'lesson_change_request.'||final_status,'lesson_change_request',p_request_id,p_actor_profile_id,p_actor_role,
    'scenario_resolution',jsonb_build_object('decision_revision_id',revision_id,'scenario',request_row.scenario,
      'origin_kind',request_row.origin_kind,'policy_outcome_id',policy_row.id,'is_policy_override',is_override,
      'entitlement_id',entitlement_id,'adjustment_id',adjustment_id,'decision_source',p_decision_source,
      'initiated_by_auth_user_id',p_initiated_by_auth_user_id));
  insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata)
  values(p_school_id,p_actor_profile_id,'lesson_change_request.'||final_status,'lesson_change_request',p_request_id,
    jsonb_build_object('decision_revision_id',revision_id,'scenario',request_row.scenario,'origin_kind',request_row.origin_kind,
      'policy_outcome_id',policy_row.id,'is_policy_override',is_override));
  return jsonb_build_object('outcome',final_status,'request_id',p_request_id,'decision_revision_id',revision_id,
    'entitlement_id',entitlement_id,'adjustment_id',adjustment_id,'message',summary_text);
end $$;
revoke all on function public.apply_lesson_change_resolution_core(uuid,uuid,text,jsonb,text,text,uuid,text,uuid)
  from public,anon,authenticated;

create function public.resolve_lesson_change_request(
  p_school_id uuid,p_request_id uuid,p_request_disposition text,p_actual_outcome jsonb default null,p_internal_reason text default null
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare actor_id uuid:=auth.uid(); actor_role text;
begin
  select role into actor_role from public.school_members
  where school_id=p_school_id and profile_id=actor_id and status='active';
  if actor_id is null or actor_role not in ('owner','admin') then raise exception 'not_authorized'; end if;
  return public.apply_lesson_change_resolution_core(p_school_id,p_request_id,p_request_disposition,p_actual_outcome,
    p_internal_reason,'staff_review',actor_id,actor_role,actor_id);
end $$;
revoke all on function public.resolve_lesson_change_request(uuid,uuid,text,jsonb,text) from public,anon;
grant execute on function public.resolve_lesson_change_request(uuid,uuid,text,jsonb,text) to authenticated;

-- Keep the old UI callable while routing its limited vocabulary through the core.
create or replace function public.resolve_owner_lesson_change_request(
  p_school_id uuid,p_request_id uuid,p_decision text,p_lesson_resolution text,
  p_adjustment_kind text,p_adjustment_amount_cents integer,p_reason text
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare actor_id uuid:=auth.uid(); actor_role text; request_row public.lesson_change_requests%rowtype; event_row public.lesson_events%rowtype;
  policy_row public.cancellation_policy_outcomes%rowtype; timing_value text; actual jsonb; adjustments jsonb:='[]'::jsonb;
begin
  select role into actor_role from public.school_members
  where school_id=p_school_id and profile_id=actor_id and status='active';
  if actor_id is null or actor_role not in ('owner','admin') then raise exception 'not_authorized'; end if;
  if p_decision='declined' then
    return public.resolve_lesson_change_request(p_school_id,p_request_id,'declined',null,p_reason);
  end if;
  if p_decision<>'approved' or p_lesson_resolution not in ('count_as_serviced','retain_for_reschedule','waive')
    or p_adjustment_kind is not null and p_adjustment_kind not in ('fee','credit')
    or coalesce(p_adjustment_amount_cents,0) not between 0 and 1000000
  then raise exception 'invalid_legacy_resolution'; end if;
  select * into request_row from public.lesson_change_requests where school_id=p_school_id and id=p_request_id;
  if not found then raise exception 'request_not_found'; end if;
  select * into event_row from public.lesson_events where school_id=p_school_id and id=request_row.lesson_event_id;
  timing_value:=case when request_row.scenario in ('teacher_cancellation','school_cancellation','student_no_show') then 'not_applicable'
    when request_row.within_policy_window then 'timely' else 'late' end;
  select * into policy_row from public.cancellation_policy_outcomes where school_id=p_school_id
    and policy_version_id=request_row.policy_version_id and scenario=request_row.scenario and timing_bucket=timing_value;
  if not found then raise exception 'scenario_policy_outcome_unavailable'; end if;
  if p_adjustment_kind is not null and p_adjustment_amount_cents>0 then
    adjustments:=jsonb_build_array(jsonb_build_object('kind',p_adjustment_kind,'amount_cents',p_adjustment_amount_cents));
  end if;
  actual:=jsonb_strip_nulls(jsonb_build_object(
    'calendar_action',case when p_lesson_resolution='retain_for_reschedule' then 'retain_for_later' else 'cancel' end,
    'service_outcome',case request_row.scenario when 'student_cancellation' then 'not_serviced_student_cancelled'
      when 'student_reschedule' then 'not_serviced_student_cancelled' when 'teacher_cancellation' then 'not_serviced_teacher_cancelled'
      when 'school_cancellation' then 'not_serviced_school_cancelled' when 'student_no_show' then 'not_serviced_no_show' end,
    'original_charge_treatment',case p_lesson_resolution when 'count_as_serviced' then 'keep_full_charge' else 'waive_full_charge' end,
    'replacement_kind',case when p_lesson_resolution='retain_for_reschedule' then 'replacement_minutes' else 'none' end,
    'replacement_minutes',case when p_lesson_resolution='retain_for_reschedule' then
      greatest(5,extract(epoch from(event_row.ends_at-event_row.starts_at))::integer/60) end,
    'teacher_constraint',case when p_lesson_resolution='retain_for_reschedule' then policy_row.teacher_constraint else 'unrestricted' end,
    'replacement_teacher_id',case when p_lesson_resolution='retain_for_reschedule' and policy_row.teacher_constraint='required' then event_row.teacher_id end,
    'transferable_within_account',policy_row.transferable_within_account,
    'expires_at',case when p_lesson_resolution='retain_for_reschedule' and policy_row.expiration_days is not null then
      case policy_row.expiration_anchor when 'original_lesson' then event_row.starts_at+(policy_row.expiration_days*interval '1 day')
        when 'request' then request_row.requested_at+(policy_row.expiration_days*interval '1 day')
        else now()+(policy_row.expiration_days*interval '1 day') end end,
    'adjustment_actions',adjustments,'refund_action','none'));
  return public.resolve_lesson_change_request(p_school_id,p_request_id,'approved',actual,p_reason);
end $$;
revoke all on function public.resolve_owner_lesson_change_request(uuid,uuid,text,text,text,integer,text) from public,anon;
grant execute on function public.resolve_owner_lesson_change_request(uuid,uuid,text,text,text,integer,text) to authenticated;
