create or replace function public.publish_default_cancellation_policy(
  p_school_id uuid,
  p_name text,
  p_cancel_cutoff_hours integer,
  p_reschedule_cutoff_hours integer,
  p_timely_disposition text,
  p_late_lesson_resolution text,
  p_late_reschedule_fee_cents integer,
  p_replacement_window_days integer,
  p_must_keep_assigned_teacher boolean,
  p_timely_guidance text,
  p_late_guidance text
)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  actor_id uuid:=auth.uid();
  actor_school_role text;
  target_policy_id uuid;
  version_id uuid;
  next_version integer;
  clean_name text:=trim(coalesce(p_name,''));
  clean_timely text:=trim(coalesce(p_timely_guidance,''));
  clean_late text:=trim(coalesce(p_late_guidance,''));
  late_billing_disposition text;
begin
  select member.role into actor_school_role from public.school_members member
  where member.school_id=p_school_id and member.profile_id=actor_id and member.status='active';
  if actor_id is null or actor_school_role not in ('owner','admin') then raise exception 'not_authorized'; end if;
  if length(clean_name) not between 1 and 120
    or p_cancel_cutoff_hours not between 0 and 8760
    or p_reschedule_cutoff_hours not between 0 and 8760
    or p_timely_disposition not in ('charge','credit','waive','manual_review')
    or p_late_lesson_resolution not in ('count_as_serviced','retain_for_reschedule','waive','manual_review')
    or p_late_reschedule_fee_cents not between 0 and 1000000
    or (p_replacement_window_days is not null and p_replacement_window_days not between 0 and 365)
    or length(clean_timely) not between 1 and 1000
    or length(clean_late) not between 1 and 1000
  then raise exception 'invalid_cancellation_policy'; end if;
  if p_late_lesson_resolution<>'retain_for_reschedule' and p_late_reschedule_fee_cents<>0 then
    raise exception 'fee_requires_reschedule_entitlement';
  end if;

  select policy.id into target_policy_id from public.school_policies policy
  where policy.school_id=p_school_id and policy.kind='cancellation'
    and policy.status='active' and policy.is_default for update;
  if target_policy_id is null then
    insert into public.school_policies(school_id,kind,name,is_default,status,created_by)
    values(p_school_id,'cancellation',clean_name,true,'active',actor_id)
    returning id into target_policy_id;
  else
    update public.school_policies set name=clean_name where id=target_policy_id;
  end if;

  select coalesce(max(version.version_number),0)+1 into next_version
  from public.school_policy_versions version where version.policy_id=target_policy_id;
  insert into public.school_policy_versions(
    school_id,policy_id,version_number,editor_content,plain_text,effective_from,published_at,created_by
  ) values (
    p_school_id,target_policy_id,next_version,
    jsonb_build_object(
      'cancel_cutoff_hours',p_cancel_cutoff_hours,'reschedule_cutoff_hours',p_reschedule_cutoff_hours,
      'timely_disposition',p_timely_disposition,'late_lesson_resolution',p_late_lesson_resolution,
      'late_reschedule_fee_cents',p_late_reschedule_fee_cents,'replacement_window_days',p_replacement_window_days,
      'must_keep_assigned_teacher',p_must_keep_assigned_teacher,'timely_guidance',clean_timely,'late_guidance',clean_late
    ),
    clean_timely||E'\n\n'||clean_late,now(),now(),actor_id
  ) returning id into version_id;

  late_billing_disposition:=case p_late_lesson_resolution
    when 'count_as_serviced' then 'charge' when 'waive' then 'waive' else 'manual_review' end;
  insert into public.cancellation_policy_rules(
    policy_version_id,student_cancel_cutoff_hours,student_reschedule_cutoff_hours,
    replacement_window_days,must_keep_assigned_teacher,timely_cancel_disposition,
    late_cancel_disposition,no_show_disposition,teacher_cancel_disposition,
    timely_request_guidance,late_request_guidance,late_lesson_resolution,
    late_reschedule_fee_cents,late_fee_timing
  ) values (
    version_id,p_cancel_cutoff_hours,p_reschedule_cutoff_hours,p_replacement_window_days,
    p_must_keep_assigned_teacher,p_timely_disposition,late_billing_disposition,'charge','credit',
    clean_timely,clean_late,p_late_lesson_resolution,p_late_reschedule_fee_cents,'next_open_invoice'
  );
  insert into public.domain_events(school_id,event_type,entity_type,entity_id,actor_profile_id,actor_role,source,payload)
  values(p_school_id,'school.cancellation_policy_published','school_policy',target_policy_id,actor_id,actor_school_role,
    'policy_editor',jsonb_build_object('policy_version_id',version_id,'version_number',next_version));
  insert into public.audit_log(school_id,actor_profile_id,action,entity_type,entity_id,metadata)
  values(p_school_id,actor_id,'school.cancellation_policy_published','school_policy',target_policy_id,
    jsonb_build_object('policy_version_id',version_id,'version_number',next_version));
  return version_id;
end $$;

revoke all on function public.publish_default_cancellation_policy(uuid,text,integer,integer,text,text,integer,integer,boolean,text,text) from public,anon;
grant execute on function public.publish_default_cancellation_policy(uuid,text,integer,integer,text,text,integer,integer,boolean,text,text) to authenticated;
